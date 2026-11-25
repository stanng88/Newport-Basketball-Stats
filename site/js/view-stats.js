/* Season stats: Averages/Totals × Standard/Advanced with a game filter. */
const VStats = (() => {
  const state = { mode: "avg", view: "std", games: null, filterOpen: false, sort: null };

  const nameCell = (r) => (r.number === null ? "<b>Team</b>" : `${U.playerLink(r.player)}, #${r.number}`);
  const per = (k) => (r) => (r.gp ? r[k] / r.gp : null);
  const reb = (r) => r.oreb + r.dreb;

  function columns() {
    const n = { key: "player", label: "Player", fmt: nameCell, val: (r) => (r.number === null ? 999 : r.number), left: true };
    const gp = { key: "gp", label: "GP", title: "Games played" };
    const num = (key, label, title, f, fmt = S.fmt.d1) => ({ key, label, title, val: f, fmt: (r) => fmt(f(r)) });
    const made = (key, label, m, a) => ({ key, label, val: (r) => r[m], fmt: (r) => S.fmt.made(r[m], r[a]) });
    const pct = (key, label, title, f) => num(key, label, title, f, S.fmt.pct);
    if (state.view === "adv") {
      return [n, gp,
        pct("efg", "eFG%", "Effective FG%: (FGM + 0.5×3PM) / FGA", (r) => S.rates(r).efg),
        pct("ts", "TS%", "True shooting: PTS / (2×(FGA + 0.44×FTA))", (r) => S.rates(r).ts),
        num("ast_to", "AST/TO", "Assists per turnover", (r) => S.rates(r).ast_to, S.fmt.d2),
        pct("tr", "3PA rate", "Share of shots that are threes", (r) => S.rates(r).three_rate),
        pct("ftr", "FT rate", "Free throw attempts per field goal attempt", (r) => S.rates(r).ft_rate),
        { key: "pm", label: "+/-", title: "Point differential while on court (plays with a known lineup)", val: (r) => r.pm, fmt: (r) => (r.pm === undefined ? "—" : S.signedCell(r.pm)) },
        { key: "pmg", label: "+/- PG", title: "Plus/minus per game", val: (r) => (r.gp && r.pm !== undefined ? r.pm / r.gp : null), fmt: (r) => (r.gp && r.pm !== undefined ? S.signedCell(r.pm / r.gp, 1) : "—") },
        { key: "net", label: "On NET", title: "Net rating (points per 100 possessions, us minus them) while on court", val: (r) => r.net, fmt: (r) => (r.net === null || r.net === undefined ? "—" : S.signedCell(r.net, 1)) },
        num("onp", "On-court poss", "Estimated possessions (avg of both teams) while on court", (r) => r.onPoss, S.fmt.int),
      ];
    }
    if (state.mode === "tot") {
      return [n, gp, { key: "gs", label: "GS", title: "Games started" }, { key: "pts", label: "PTS" },
        made("fg", "FG", "fgm", "fga"), made("fg3", "3PT", "fg3m", "fg3a"), made("ft", "FT", "ftm", "fta"),
        { key: "oreb", label: "OREB" }, { key: "dreb", label: "DREB" }, { key: "reb", label: "REB", val: reb, fmt: reb },
        { key: "ast", label: "AST" }, { key: "stl", label: "STL" }, { key: "blk", label: "BLK" }, { key: "tov", label: "TO" }, { key: "pf", label: "PF" }];
    }
    return [n, gp, num("ppg", "PPG", "Points per game", per("pts")), num("rpg", "RPG", "Rebounds per game", (r) => (r.gp ? reb(r) / r.gp : null)),
      num("orpg", "ORPG", "Offensive rebounds per game", per("oreb")), num("apg", "APG", "Assists per game", per("ast")),
      num("spg", "SPG", "Steals per game", per("stl")), num("bpg", "BPG", "Blocks per game", per("blk")),
      num("topg", "TOPG", "Turnovers per game", per("tov")), num("pfpg", "PFPG", "Fouls per game", per("pf")),
      pct("fgp", "FG%", "Field goal %", (r) => S.rates(r).fg_pct), pct("3pp", "3PT%", "3-point %", (r) => S.rates(r).fg3_pct), pct("ftp", "FT%", "Free throw %", (r) => S.rates(r).ft_pct)];
  }

  function render(app) {
    const all = U.games.map((g) => g.event_id);
    const ids = state.games || all;
    const players = S.playerTotals(ids).filter((p) => p.gp > 0);
    const oc = S.onCourt(ids);
    for (const p of players) {
      const o = oc[p.player];
      if (o) {
        const row = S.lineupRow({ us: o.us, opp: o.opp, plays: o.plays });
        Object.assign(p, { pm: row.pm, net: row.net, onPoss: row.poss });
      }
    }
    const team = { player: "Team", number: null, gp: ids.length, gs: "", ...S.teamTotals(ids, "us") };
    const filtered = state.games && state.games.length !== all.length;

    app.innerHTML = `${VTeam.band("stats")}<main class="page">
      <h1 class="page-title">Stats</h1>
      <div class="controls">
        ${state.view === "adv" ? "" : U.seg("mode", [{ v: "avg", label: "Averages" }, { v: "tot", label: "Totals" }], state.mode)}
        ${U.linkseg("view", [{ v: "std", label: "Standard" }, { v: "adv", label: "Advanced" }], state.view)}
        <span class="spacer"></span>
        <span class="note">${filtered ? `${ids.length} of ${all.length} games` : "All games"}</span>
        <button class="btn" id="filterBtn">⚲ Filter games</button>
        ${filtered ? `<button class="btn" id="clearBtn">Clear</button>` : ""}
      </div>
      <div id="filter"></div>
      <div id="tbl"></div>
      <div class="legend-defs">${legend()}</div>
    </main>`;

    U.bindSeg(app, "mode", (v) => { state.mode = v; render(app); });
    U.bindSeg(app, "view", (v) => { state.view = v; render(app); });
    app.querySelector("#filterBtn").addEventListener("click", () => { state.filterOpen = !state.filterOpen; render(app); });
    const clr = app.querySelector("#clearBtn");
    if (clr) clr.addEventListener("click", () => { state.games = null; render(app); });
    if (state.filterOpen) filterPanel(app.querySelector("#filter"), app, ids);
    U.table(app.querySelector("#tbl"), { cols: columns(), rows: players, total: state.view === "adv" ? { ...team, ...teamAdv(ids) } : team, sort: state.sort, onSort: (s) => (state.sort = s) });
  }

  function teamAdv(ids) {
    const row = S.lineupRow({ us: S.teamTotals(ids, "us"), opp: S.teamTotals(ids, "opponent"), plays: 0 });
    return { pm: row.pm, net: row.net, onPoss: row.poss };
  }

  function filterPanel(el, app, ids) {
    const sel = new Set(ids);
    el.innerHTML = `<div class="filter-panel"><div class="controls" style="margin:0"><b>Filter games</b><span class="spacer"></span>
      <button class="btn" data-a="all">Select all</button><button class="btn" data-a="none">Select none</button><button class="btn" data-a="done">Done</button></div>
      <div class="games">${[...U.games].reverse().map((g) => `<label><input type="checkbox" value="${U.esc(g.event_id)}" ${sel.has(g.event_id) ? "checked" : ""}>
        <span>${U.shortDate(g.date)} · ${U.esc(U.gameLabel(g))}</span><span class="res-${U.esc(g.result)}" style="margin-left:auto">${U.esc(g.result)} ${U.esc(g.score_us)}-${U.esc(g.score_opponent)}</span></label>`).join("")}</div></div>`;
    el.querySelectorAll("input").forEach((cb) => cb.addEventListener("change", () => {
      const chosen = [...el.querySelectorAll("input:checked")].map((x) => x.value);
      state.games = chosen.length ? chosen : [U.games[U.games.length - 1].event_id];
      render(app);
    }));
    el.querySelector('[data-a="all"]').addEventListener("click", () => { state.games = null; render(app); });
    el.querySelector('[data-a="none"]').addEventListener("click", () => { state.games = [U.games[U.games.length - 1].event_id]; render(app); });
    el.querySelector('[data-a="done"]').addEventListener("click", () => { state.filterOpen = false; render(app); });
  }

  function legend() {
    const defs = state.view === "adv"
      ? [["eFG%", "Effective field goal %, threes count 1.5×"], ["TS%", "True shooting % incl. free throws"], ["AST/TO", "Assists per turnover"], ["3PA rate", "Threes as share of shots"], ["FT rate", "FTA per FGA"], ["+/-", "Point differential on court"], ["On NET", "Net points per 100 possessions on court"], ["Poss", "Estimated: FGA + 0.44×FTA − OREB + TO"]]
      : [["GP", "Games played"], ["PPG", "Points per game"], ["RPG", "Rebounds per game"], ["ORPG", "Offensive rebounds per game"], ["APG", "Assists per game"], ["SPG", "Steals per game"], ["BPG", "Blocks per game"], ["TOPG", "Turnovers per game"], ["PFPG", "Personal fouls per game"]];
    return defs.map(([k, v]) => `<div><b>${k}</b> ${v}</div>`).join("") + (state.view === "adv" ? `<div style="grid-column:1/-1">+/- and On NET use only plays where the five on court are known (see Lineups).</div>` : "") + `<div style="grid-column:1/-1"><a href="#/glossary">Full glossary of every stat →</a></div>`;
  }

  return { render };
})();
