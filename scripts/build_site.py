"""Bundle processed data + derived analytics into site/data.js (loaded by site/index.html).

Run after scripts/normalize.py:  python -m scripts.build_site
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from scripts.analytics import build_stints, lineup_coverage, player_period_box, team_period_box

ROOT = Path(__file__).resolve().parent.parent
PROCESSED = ROOT / "data" / "processed"
SITE = ROOT / "site"
TEAM = {"name": "Newport Select Gold 14U", "season": "Winter 2026-27", "location": "Bellevue, WA"}

PLAY_KEYS = ("seq", "period", "team", "action", "player", "number", "personal_fouls", "points", "score_us", "score_opponent")


def load(name: str):
    return json.loads((PROCESSED / name).read_text(encoding="utf-8"))


def compact_plays(plays: list[dict]) -> dict[str, list[list]]:
    """Plays grouped by game as arrays (keys in PLAY_KEYS order) to keep the bundle small."""
    out: dict[str, list[list]] = {}
    for p in sorted(plays, key=lambda p: (p["event_id"], p["seq"])):
        out.setdefault(p["event_id"], []).append([p[k] for k in PLAY_KEYS])
    return out


def main() -> None:
    plays = load("plays.json")
    data = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "team": TEAM,
        "games": load("games.json"),
        "players": load("players.json"),
        "season_stats": load("season_stats.json"),
        "box_scores": load("box_scores.json"),
        "insights": load("insights.json"),
        "play_keys": list(PLAY_KEYS),
        "plays": compact_plays(plays),
        "player_period_box": player_period_box(plays),
        "team_period_box": team_period_box(plays),
        "stints": [s.to_dict() for s in build_stints(plays)],
        "lineup_coverage": lineup_coverage(plays),
    }
    SITE.mkdir(exist_ok=True)
    js = "window.DATA = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n"
    (SITE / "data.js").write_text(js, encoding="utf-8")
    print(f"site/data.js written: {len(js) / 1024:.0f} KB, {len(data['games'])} games, {len(data['stints'])} stints")


if __name__ == "__main__":
    main()
