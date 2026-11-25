import json
from pathlib import Path

import pytest

from scripts.analytics import (
    add_play,
    assign_lineups,
    build_stints,
    empty_stats,
    player_period_box,
    possessions,
)

DATA = Path(__file__).resolve().parent.parent / "data" / "processed"
FIVE = ["A", "B", "C", "D", "E"]


def sub(seq, action, player, period=1):
    return {"event_id": "g", "seq": seq, "period": period, "team": "us", "action": action, "player": player, "number": None}


def play(seq, action, team="us", player="A", period=1):
    return {"event_id": "g", "seq": seq, "period": period, "team": team, "action": action, "player": player if team == "us" else None, "number": None}


def starters(start=1):
    return [sub(start + i, "sub_in", p) for i, p in enumerate(FIVE)]


class TestAssignLineups:
    def test_starting_five_is_on_court(self):
        plays = starters() + [play(6, "2-point FG made")]
        assert assign_lineups(plays)[-1] == frozenset(FIVE)

    def test_clean_substitution_swaps_player(self):
        plays = starters() + [play(6, "Turnover"), sub(7, "sub_out", "E"), sub(8, "sub_in", "F"), play(9, "Steal")]
        assert assign_lineups(plays)[-1] == frozenset(["A", "B", "C", "D", "F"])

    def test_late_sub_out_is_pulled_forward(self):
        plays = starters() + [sub(6, "sub_in", "F"), play(7, "Turnover", team="opponent"), sub(8, "sub_out", "E"), play(9, "Steal")]
        lineups = assign_lineups(plays)
        assert lineups[6] == frozenset(["A", "B", "C", "D", "F"])  # the play between the split subs
        assert lineups[-1] == frozenset(["A", "B", "C", "D", "F"])

    def test_unresolved_six_is_unknown(self):
        far = [play(7 + i, "Turnover", team="opponent") for i in range(10)]
        plays = starters() + [sub(6, "sub_in", "F")] + far
        assert all(lu is None for lu in assign_lineups(plays)[6:])

    def test_sub_plays_get_no_lineup(self):
        assert all(lu is None for lu in assign_lineups(starters()))


class TestStints:
    def test_stats_split_by_team_and_lineup(self):
        plays = starters() + [
            play(6, "3-point FG made"),
            play(7, "2-point FG made", team="opponent"),
            sub(8, "sub_out", "E"), sub(9, "sub_in", "F"),
            play(10, "Free throw made"),
        ]
        stints = build_stints(plays)
        assert len(stints) == 2
        assert stints[0].us["pts"] == 3 and stints[0].opp["pts"] == 2
        assert stints[1].players == ("A", "B", "C", "D", "F") and stints[1].us["pts"] == 1

    def test_period_change_starts_new_stint(self):
        plays = starters() + [play(6, "Turnover"), play(7, "Turnover", period=2)]
        assert [s.period for s in build_stints(plays)] == [1, 2]


def test_possessions_formula():
    s = empty_stats()
    for a in ["2-point FG missed", "Offensive rebound", "2-point FG made", "Free throw made", "Free throw missed", "Turnover"]:
        s = add_play(s, a)
    assert possessions(s) == pytest.approx(2 + 0.44 * 2 - 1 + 1)


@pytest.mark.skipif(not (DATA / "plays.json").exists(), reason="needs harvested data")
class TestAgainstHarvestedData:
    @pytest.fixture(scope="class")
    def plays(self):
        return json.loads((DATA / "plays.json").read_text(encoding="utf-8"))

    def test_rebuilt_box_scores_match_official(self, plays):
        official = json.loads((DATA / "box_scores.json").read_text(encoding="utf-8"))
        rebuilt: dict[tuple, dict] = {}
        for r in player_period_box(plays):
            key = (r["event_id"], r["player"])
            prev = rebuilt.get(key, empty_stats())
            rebuilt[key] = {k: prev[k] + r[k] for k in prev}
        mismatches = []
        for o in official:
            if o["player"] in ("Team", "Unassigned") or o.get("GP") in ("", "0"):
                continue
            r = rebuilt.get((o["event_id"], o["player"]), empty_stats())
            got = {"PTS": r["pts"], "AST": r["ast"], "STL": r["stl"], "TO": r["tov"], "PF": r["pf"],
                   "REB": r["oreb"] + r["dreb"], "FG": f"{r['fgm']}-{r['fga']}", "FT": f"{r['ftm']}-{r['fta']}"}
            for k, v in got.items():
                if str(v) != str(o[k]):
                    mismatches.append((o["event_id"][:8], o["player"], k, o[k], v))
        assert not mismatches, mismatches[:10]

    def test_lineups_cover_most_plays(self, plays):
        stints = build_stints(plays)
        covered = sum(s.plays for s in stints)
        total = sum(1 for p in plays if p["action"] not in ("sub_in", "sub_out"))
        assert covered / total > 0.85
        assert all(len(s.players) == 5 for s in stints)
