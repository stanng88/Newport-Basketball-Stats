"""Derived analytics from normalized play-by-play: on-court lineups (stints) and box scores.

A *stint* is a run of consecutive plays in one game during which the same five of our
players were on court. Stats inside a stint are counted for both teams so lineups can be
compared on points, possessions and efficiency.

Scorekeepers sometimes log a substitution a few plays late (one player checks in, a play
happens, then the player leaving is recorded). When a substitution batch leaves a lineup
of other than five, the next batch is pulled forward if it arrives within MERGE_WINDOW
plays and completes a five-player lineup. Plays where the lineup still is not exactly
five are left without a lineup and excluded from lineup stats.
"""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from itertools import groupby
from typing import Iterable

MERGE_WINDOW = 4
SUB_ACTIONS = {"sub_in", "sub_out"}

# action -> stat increments for the acting team
ACTION_STATS: dict[str, dict[str, int]] = {
    "2-point FG made": {"pts": 2, "fgm": 1, "fga": 1},
    "2-point FG missed": {"fga": 1},
    "3-point FG made": {"pts": 3, "fgm": 1, "fga": 1, "fg3m": 1, "fg3a": 1},
    "3-point FG missed": {"fga": 1, "fg3a": 1},
    "Free throw made": {"pts": 1, "ftm": 1, "fta": 1},
    "Free throw missed": {"fta": 1},
    "Offensive rebound": {"oreb": 1},
    "Defensive rebound": {"dreb": 1},
    "Rebound": {"dreb": 1},
    "Turnover": {"tov": 1},
    "Steal": {"stl": 1},
    "Assist": {"ast": 1},
    "Block": {"blk": 1},
    "Foul committed": {"pf": 1},
}
STAT_KEYS = ("pts", "fgm", "fga", "fg3m", "fg3a", "ftm", "fta", "oreb", "dreb", "tov", "stl", "ast", "blk", "pf")


def empty_stats() -> dict[str, int]:
    return {k: 0 for k in STAT_KEYS}


def add_play(stats: dict[str, int], action: str) -> dict[str, int]:
    """Return a new stats dict with the play's increments applied."""
    inc = ACTION_STATS.get(action, {})
    return {k: stats[k] + inc.get(k, 0) for k in STAT_KEYS}


def possessions(s: dict[str, int]) -> float:
    return s["fga"] + 0.44 * s["fta"] - s["oreb"] + s["tov"]


def _is_our_sub(p: dict) -> bool:
    return p["team"] == "us" and p["action"] in SUB_ACTIONS


def _apply(on: frozenset[str], batch: Iterable[dict]) -> frozenset[str]:
    cur = set(on)
    for p in batch:
        (cur.add if p["action"] == "sub_in" else cur.discard)(p["player"])
    return frozenset(cur)


def _batch_end(plays: list[dict], start: int) -> int:
    end = start
    while end < len(plays) and _is_our_sub(plays[end]):
        end += 1
    return end


def assign_lineups(plays: list[dict]) -> list[frozenset[str] | None]:
    """For one game's chronological plays, return the five on court at each play (None if unknown).

    Substitution plays themselves get None.
    """
    result: list[frozenset[str] | None] = [None] * len(plays)
    consumed: set[int] = set()
    on: frozenset[str] = frozenset()
    i = 0
    while i < len(plays):
        if i in consumed:
            i += 1
            continue
        if _is_our_sub(plays[i]):
            end = _batch_end(plays, i)
            on = _apply(on, (p for k, p in enumerate(plays[i:end], i) if k not in consumed))
            if len(on) != 5:
                on = _pull_forward_late_batch(plays, end, on, consumed)
            i = end
            continue
        result[i] = on if len(on) == 5 else None
        i += 1
    return result


def _pull_forward_late_batch(plays: list[dict], start: int, on: frozenset[str], consumed: set[int]) -> frozenset[str]:
    gap = 0
    j = start
    while j < len(plays) and gap <= MERGE_WINDOW:
        if _is_our_sub(plays[j]):
            end = _batch_end(plays, j)
            merged = _apply(on, plays[j:end])
            if len(merged) == 5:
                consumed.update(range(j, end))
                return merged
            return on
        gap += 1
        j += 1
    return on


@dataclass(frozen=True)
class Stint:
    event_id: str
    period: int
    players: tuple[str, ...]
    first_seq: int
    last_seq: int
    plays: int
    us: dict = field(hash=False)
    opp: dict = field(hash=False)

    def to_dict(self) -> dict:
        return {
            "event_id": self.event_id,
            "period": self.period,
            "players": list(self.players),
            "first_seq": self.first_seq,
            "last_seq": self.last_seq,
            "plays": self.plays,
            "us": self.us,
            "opp": self.opp,
        }


def build_stints(plays: list[dict]) -> list[Stint]:
    """Build stints for all games. `plays` are normalized play rows (any game order)."""
    stints: list[Stint] = []
    by_game: dict[str, list[dict]] = defaultdict(list)
    for p in plays:
        by_game[p["event_id"]].append(p)
    for event_id, game_plays in by_game.items():
        game_plays = sorted(game_plays, key=lambda p: p["seq"])
        lineups = assign_lineups(game_plays)
        tagged = [(lu, p) for lu, p in zip(lineups, game_plays) if not _is_our_sub(p)]
        # group by lineup and period, keeping runs contiguous
        for (lineup, period), run in groupby(tagged, key=lambda t: (t[0], t[1]["period"])):
            run = list(run)
            if lineup is None:
                continue
            us, opp = empty_stats(), empty_stats()
            for _, p in run:
                if p["team"] == "us":
                    us = add_play(us, p["action"])
                else:
                    opp = add_play(opp, p["action"])
            stints.append(Stint(
                event_id=event_id, period=period, players=tuple(sorted(lineup)),
                first_seq=run[0][1]["seq"], last_seq=run[-1][1]["seq"], plays=len(run), us=us, opp=opp,
            ))
    return stints


def lineup_coverage(plays: list[dict]) -> dict[str, float]:
    """Share of non-substitution plays per game that have a known five-player lineup."""
    by_game: dict[str, list[dict]] = defaultdict(list)
    for p in plays:
        by_game[p["event_id"]].append(p)
    out = {}
    for event_id, game_plays in by_game.items():
        game_plays = sorted(game_plays, key=lambda p: p["seq"])
        lineups = assign_lineups(game_plays)
        known = [lu for lu, p in zip(lineups, game_plays) if not _is_our_sub(p)]
        out[event_id] = round(sum(1 for lu in known if lu) / len(known), 4) if known else 0.0
    return out


def player_period_box(plays: list[dict]) -> list[dict]:
    """Per player, per game, per period counting stats from play-by-play (our team only)."""
    acc: dict[tuple, dict[str, int]] = {}
    for p in plays:
        if p["team"] != "us" or not p["player"] or p["action"] in SUB_ACTIONS:
            continue
        key = (p["event_id"], p["period"], p["player"], p["number"])
        acc[key] = add_play(acc.get(key, empty_stats()), p["action"])
    return [
        {"event_id": e, "period": per, "player": name, "number": num, **stats}
        for (e, per, name, num), stats in sorted(acc.items(), key=lambda kv: (kv[0][0], kv[0][1], kv[0][3] or 0))
    ]


def team_period_box(plays: list[dict]) -> list[dict]:
    """Team totals per game, per period, for both teams."""
    acc: dict[tuple, dict[str, int]] = {}
    for p in plays:
        if p["action"] in SUB_ACTIONS:
            continue
        key = (p["event_id"], p["period"], p["team"])
        acc[key] = add_play(acc.get(key, empty_stats()), p["action"])
    return [{"event_id": e, "period": per, "team": t, **s} for (e, per, t), s in sorted(acc.items())]
