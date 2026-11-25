/* Stat aggregation: player/team totals, rates, lineup combinations, on/off. */
const S = (() => {
  const KEYS = ["pts", "fgm", "fga", "fg3m", "fg3a", "ftm", "fta", "oreb", "dreb", "tov", "stl", "ast", "blk", "pf"];
  const zero = () => Object.fromEntries(KEYS.map((k) => [k, 0]));
  const add = (a, b) => Object.fromEntries(KEYS.map((k) => [k, a[k] + (b[k] || 0)]));
  const sum = (rows) => rows.reduce(add, zero());

  const div = (a, b) => (b ? a / b : null);
  const poss = (s) => s.fga + 0.44 * s.fta - s.oreb + s.tov;
  const rates = (s) => ({
    reb: s.oreb + s.dreb,
    fg2m: s.fgm - s.fg3m,
    fg2a: s.fga - s.fg3a,
    fg_pct: div(s.fgm, s.fga),
    fg3_pct: div(s.fg3m, s.fg3a),
    ft_pct: div(s.ftm, s.fta),
    efg: div(s.fgm + 0.5 * s.fg3m, s.fga),
    ts: div(s.pts, 2 * (s.fga + 0.44 * s.fta)),
    ast_to: div(s.ast, s.tov),
    three_rate: div(s.fg3a, s.fga),
    ft_rate: div(s.fta, s.fga),
  });

  const fmt = {
    pct: (v) => (v === null || v === undefined ? "—" : `${Math.round(v * 100)}%`),
    d1: (v) => (v === null || v === undefined ? "—" : v.toFixed(1)),
    d2: (v) => (v === null || v === undefined ? "—" : v.toFixed(2)),
    int: (v) => (v === null || v === undefined ? "—" : String(Math.round(v))),
    signed: (v, d = 0) => (v === null || v === undefined ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(d)}`),
    made: (m, a) => `${m}-${a}`,
  };
  const signedCell = (v, d = 0) => `<span class="${v > 0 ? "pos" : v < 0 ? "neg" : ""}">${fmt.signed(v, d)}</span>`;

  /** Games played per player per game from the official box (GP=1). */
  const gpIndex = () => {
    const idx = {};
    for (const b of U.D.box_scores) {
      if (b.number === null || b.GP !== "1") continue;
      (idx[b.player] ||= {})[b.event_id] = { gs: b.GS === "1" };
    }
    return idx;
  };
  const GP = gpIndex();

  /** Player totals over a set of games (and optional periods) from play-derived box rows. */
  function playerTotals(gameIds, periodFilter) {
    const set = new Set(gameIds);
    const out = {};
    for (const p of U.players) out[p.name] = { player: p.name, number: p.number, gp: 0, gs: 0, ...zero() };
    for (const [name, games] of Object.entries(GP)) {
      if (!out[name]) continue;
      for (const [id, g] of Object.entries(games)) if (set.has(id)) { out[name].gp += 1; out[name].gs += g.gs ? 1 : 0; }
    }
    for (const r of U.D.player_period_box) {
      if (!set.has(r.event_id) || (periodFilter && r.period !== periodFilter) || !out[r.player]) continue;
      Object.assign(out[r.player], add(out[r.player], r));
    }
    return Object.values(out);
  }

  function teamTotals(gameIds, team, periodFilter) {
    const set = new Set(gameIds);
    return sum(U.D.team_period_box.filter((r) => set.has(r.event_id) && r.team === team && (!periodFilter || r.period === periodFilter)));
  }

  /** Plus/minus and on-court possessions per player from stints. */
  function onCourt(gameIds) {
    const set = new Set(gameIds);
    const out = {};
    for (const s of U.D.stints) {
      if (!set.has(s.event_id)) continue;
      for (const name of s.players) {
        const o = (out[name] ||= { us: zero(), opp: zero(), plays: 0 });
        o.us = add(o.us, s.us);
        o.opp = add(o.opp, s.opp);
        o.plays += s.plays;
      }
    }
    return out;
  }

  const combos = (arr, k) => {
    if (k === arr.length) return [arr];
    if (k === 1) return arr.map((x) => [x]);
    const res = [];
    arr.forEach((x, i) => combos(arr.slice(i + 1), k - 1).forEach((c) => res.push([x, ...c])));
    return res;
  };

  /** Aggregate stints into k-player combinations. */
  function lineups(gameIds, size) {
    const set = new Set(gameIds);
    const acc = new Map();
    for (const s of U.D.stints) {
      if (!set.has(s.event_id)) continue;
      for (const c of combos(s.players, size)) {
        const key = c.join("|");
        const o = acc.get(key) || { players: c, us: zero(), opp: zero(), plays: 0, stints: 0, games: new Set() };
        o.us = add(o.us, s.us);
        o.opp = add(o.opp, s.opp);
        o.plays += s.plays;
        o.stints += 1;
        o.games.add(s.event_id);
        acc.set(key, o);
      }
    }
    return [...acc.values()].map(lineupRow);
  }

  function lineupRow(o) {
    const pu = poss(o.us), po = poss(o.opp);
    const ortg = pu > 0 ? (100 * o.us.pts) / pu : null;
    const drtg = po > 0 ? (100 * o.opp.pts) / po : null;
    return {
      ...o,
      gp: o.games ? o.games.size : 0,
      poss_us: pu,
      poss_opp: po,
      poss: (pu + po) / 2,
      pts_for: o.us.pts,
      pts_against: o.opp.pts,
      pm: o.us.pts - o.opp.pts,
      ortg,
      drtg,
      net: ortg !== null && drtg !== null ? ortg - drtg : null,
      r: rates(o.us),
      ropp: rates(o.opp),
      tov_pct: pu > 0 ? o.us.tov / pu : null,
      opp_tov_pct: po > 0 ? o.opp.tov / po : null,
      oreb_pct: div(o.us.oreb, o.us.oreb + o.opp.dreb),
      dreb_pct: div(o.us.dreb, o.us.dreb + o.opp.oreb),
    };
  }

  /** On/off split per player across selected games. */
  function onOff(gameIds) {
    const set = new Set(gameIds);
    const stints = U.D.stints.filter((s) => set.has(s.event_id));
    return U.players.map((p) => {
      const on = { us: zero(), opp: zero(), plays: 0 };
      const off = { us: zero(), opp: zero(), plays: 0 };
      const played = GP[p.name] || {};
      for (const s of stints) {
        if (!played[s.event_id]) continue; // "off" means on the bench in games they played, not games they missed
        const t = s.players.includes(p.name) ? on : off;
        t.us = add(t.us, s.us);
        t.opp = add(t.opp, s.opp);
        t.plays += s.plays;
      }
      const ron = lineupRow(on), roff = lineupRow(off);
      return { player: p.name, number: p.number, on: ron, off: roff, diff: ron.net !== null && roff.net !== null ? ron.net - roff.net : null };
    });
  }

  return { KEYS, zero, add, sum, poss, rates, fmt, signedCell, playerTotals, teamTotals, onCourt, lineups, lineupRow, onOff, GP };
})();
