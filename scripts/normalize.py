"""Normalize raw GameChanger captures (data/raw) into DB-ready JSON (data/processed).

Outputs:
  games.json          one row per game (date, opponent, home/away, scores, result, format)
  plays.json          one row per play, chronological, with period, team, player, action, running score
  insights.json       one row per insight bullet (game, scope: period/player, team, text)
  box_scores.json     one row per player per game (from the single-game stats filter)
  season_stats.json   season averages / totals / advanced, one row per player per view
  players.json        roster (name, number)
"""
import json
import re
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "processed"
TEAM = "Newport Select Gold 14U"
SEASON_YEAR = 2026  # page dates omit the year; all games so far are Oct-Nov 2026

PLAYER_RE = re.compile(r"^(?P<name>.+?),\s*#?(?P<num>\d+)(?:\s*\((?P<pf>\d+) PF\))?$")
SCORE_RE = re.compile(r"(\d+)\s*-\s*(\d+)")

ACTION_POINTS = {"2-point FG made": 2, "3-point FG made": 3, "Free throw made": 1}


def clean(s):
    return s.replace("\xa0", " ").strip() if isinstance(s, str) else s


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def dump(name, data):
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / name).write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"{name}: {len(data)} rows")


def parse_header(text):
    """Header lines: date/time, arrive, FINAL, score, score, away team, home team."""
    lines = [clean(l) for l in text.split("\n") if clean(l)]
    teams = [l for l in lines if not re.fullmatch(r"\d+", l)][-2:]
    away, home = teams
    return {"datetime_text": lines[0], "away_team": away, "home_team": home}


def parse_player(text):
    m = PLAYER_RE.match(clean(text))
    if not m:
        return None, None, None
    return m["name"], int(m["num"]), int(m["pf"]) if m["pf"] else None


def parse_play(raw, our_side):
    lines = [clean(l) for l in raw["lines"]]
    body = lines[1:] if raw.get("avatar") and lines and lines[0] == raw["avatar"] else lines
    team = "us" if raw["side"] == our_side else "opponent"
    play = {"team": team, "action": None, "player": None, "number": None, "personal_fouls": None}
    if len(body) >= 2 and body[1] in ("entered the game", "sat down"):
        play["action"] = "sub_in" if body[1] == "entered the game" else "sub_out"
        play["player"], play["number"], _ = parse_player(body[0])
    else:
        play["action"] = body[0] if body else None
        actor = body[1][3:] if len(body) > 1 and body[1].startswith("by ") else None
        if actor:
            name, num, pf = parse_player(actor)
            if name:
                play.update(player=name, number=num, personal_fouls=pf)
    play["points"] = ACTION_POINTS.get(play["action"], 0)
    return play


def normalize_game(g, sched_row):
    hdr = parse_header(g["header_text"])
    our_side = "home" if hdr["home_team"] == TEAM else "away"
    opponent = hdr["away_team"] if our_side == "home" else hdr["home_team"]

    plays, period, seq = [], 1, 0
    away_score = home_score = 0
    final = None
    for raw in reversed(g["plays_raw_reverse_chronological"]):
        if raw["kind"] == "period_marker":
            m = re.search(r"Start of Period (\d+)", clean(raw["text"]))
            if m:
                period = int(m.group(1))
            continue
        if raw["kind"] == "final":
            final = [int(x) for x in SCORE_RE.search(clean(raw["text"])).groups()]
            continue
        seq += 1
        p = parse_play(raw, our_side)
        if raw.get("score"):
            away_score, home_score = [int(x) for x in SCORE_RE.search(clean(raw["score"])).groups()]
        us, them = (home_score, away_score) if our_side == "home" else (away_score, home_score)
        plays.append({"event_id": g["event_id"], "seq": seq, "period": period, **p, "score_us": us, "score_opponent": them})

    away_final, home_final = final if final else (away_score, home_score)
    us, them = (home_final, away_final) if our_side == "home" else (away_final, home_final)
    periods = sorted({p["period"] for p in plays})
    period_labels = [i["label"] for i in g["insights"] if i["group"] == "Period" and i["label"] != "Full game"]
    m = re.match(r"\w+ (\w+) (\d+), (\d+:\d+ [AP]M)", hdr["datetime_text"])
    start = datetime.strptime(f"{m[1]} {m[2]} {SEASON_YEAR} {m[3]}", "%b %d %Y %I:%M %p")
    game = {
        "event_id": g["event_id"],
        "date": start.date().isoformat(),
        "start_time": start.strftime("%H:%M"),
        "datetime_text": hdr["datetime_text"],
        "opponent": opponent,
        "home_away": our_side,
        "location": (sched_row or {}).get("text", "").split(" | ")[1] if sched_row else None,
        "score_us": us,
        "score_opponent": them,
        "result": "W" if us > them else "L" if us < them else "T",
        "period_format": "quarters" if period_labels[:1] == ["Q1"] else "halves" if period_labels[:1] == ["H1"] else "single_period",
        "periods_recorded": len(periods),
        "play_count": len(plays),
        "recap": clean(g["recap"]["text"]) if g.get("recap") else None,
        "url": g["url"],
    }
    return game, plays


def normalize_insights(g):
    rows = []
    for view in g["insights"]:
        scope = "period" if view["group"] == "Period" else "player"
        label = view["label"].split(" | ")[0]
        for container in view["insights"]:
            lines = [clean(l) for l in container["text"].split("\n") if clean(l)]
            header = lines[0] if lines else None
            for sec in container["sections"] or [{"heading": None, "points": container["bullets"]}]:
                points = sec["points"] or ([] if container["bullets"] else lines[2:] if scope == "period" else lines[1:])
                for text in points:
                    rows.append({
                        "event_id": g["event_id"], "scope": scope, "label": label,
                        "subject": header, "category": sec["heading"], "text": clean(text),
                    })
    return rows


def box_rows(per_game, games_by_key):
    rows = []
    for key, g in per_game.items():
        ev = games_by_key.get(clean(g["filter"]))
        adv = {r["Player"]: r for r in (g.get("advanced") or [])}
        for r in g.get("totals") or []:
            if r["Player"] == "Unassigned" and r.get("PTS") in ("0", ""):
                continue
            name, num, _ = parse_player(r["Player"]) if r["Player"] not in ("Team", "Unassigned") else (r["Player"], None, None)
            row = {"event_id": ev, "filter": clean(g["filter"]), "player": name, "number": num}
            row.update({k: v for k, v in r.items() if k != "Player"})
            row.update({k: v for k, v in adv.get(r["Player"], {}).items() if k not in ("Player", "GP")})
            rows.append(row)
    return rows


def main():
    schedule = load(RAW / "schedule.json")
    sched_by_id = {s["event_id"]: s for s in schedule}
    games, plays, insights = [], [], []
    for f in sorted((RAW / "games").glob("*.json")):
        g = load(f)
        game, gp = normalize_game(g, sched_by_id.get(g["event_id"]))
        games.append(game)
        plays += gp
        insights += normalize_insights(g)
    games.sort(key=lambda x: (x["date"], x["start_time"]))

    # Map the stats-filter label ("Nov 22 | vs. Hazen | W 43-21") to event ids via schedule text.
    games_by_key = {}
    for s in schedule:
        opp, _, res = s["text"].split(" | ")
        games_by_key[(opp, res)] = s["event_id"]
    per_game = load(RAW / "per_game_filtered_stats.json")
    filt_map = {}
    for g in per_game.values():
        parts = clean(g["filter"]).split(" | ")
        filt_map[clean(g["filter"])] = games_by_key.get((parts[1], parts[2]))

    season = load(RAW / "season_stats.json")
    season_rows = []
    for view, rows in season.items():
        for r in rows:
            name, num, _ = parse_player(r["Player"]) if r["Player"] != "Team" else ("Team", None, None)
            season_rows.append({"view": view, "player": name, "number": num, **{k: v for k, v in r.items() if k != "Player"}})

    players = sorted({(r["player"], r["number"]) for r in season_rows if r["number"] is not None}, key=lambda x: x[1])

    dump("games.json", games)
    dump("plays.json", plays)
    dump("insights.json", insights)
    dump("box_scores.json", box_rows(per_game, filt_map))
    dump("season_stats.json", season_rows)
    dump("players.json", [{"name": n, "number": num} for n, num in players])


if __name__ == "__main__":
    main()
