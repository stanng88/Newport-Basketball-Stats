/* Player detail: season line, points by game, game log, on/off, lineups, insights. */
const VPlayer = (() => {
  function render(app, number) {
    const p = U.playerByNumber[number];
    if (!p) { app.innerHTML = `${VTeam.band("team")}<main class="page"><p class="empty">Player not found.</p></main>`; return; }
    const all = U.games.map((g) => g.event_id);
    const season = S.playerTotals(all).find((r) => r.player === p.name);
    const r = S.rates(season);
    const gp = season.gp || 1;
    const log = gameLog(p);
    const oo = S.onOff(all).find((x) => x.player === p.name);
    const lus = S.lineups(all, 5).filter((l) => l.players.includes(p.name)).sort((a, b) => b.poss - a.poss).slice(0, 8);
    const ins = U.D.insights.filter((i) => i.scope === "player" && i.label.startsWith(`${p.name},`));

    app.innerHTML = `${VTeam.band("team")}<main class="page">
      <div class="team-id" style="margin-bottom:18px"><div class="jersey" style="width:56px;height:56px;font-size:20px">${p.number}</div>
        <div><h1 class="page-title" style="margin:0">${U.esc(p.name)}</h1><div class="note">#${p.number} · ${season.gp} games played · ${season.gs} starts</div></div></div>
      <div class="tiles">
        ${tile("PPG", (season.pts / gp).toFixed(1), `${season.pts} pts`)}
        ${tile("RPG", ((season.oreb + season.dreb) / gp).toFixed(1), `${season.oreb} off · ${season.dreb} def`)}
        ${tile("APG", (season.ast / gp).toFixed(1), `${season.ast} ast · ${season.tov} TO`)}
        ${tile("SPG", (season.stl / gp).toFixed(1), `${season.blk} blocks`)}
        ${tile("FG%", S.fmt.pct(r.fg_pct), `${season.fgm}-${season.fga}`)}
        ${tile("3PT%", S.fmt.pct(r.fg3_pct), `${season.fg3m}-${season.fg3a}`)}
        ${tile("FT%", S.fmt.pct(r.ft_pct), `${season.ftm}-${season.fta}`)}
        ${tile("+/-", oo.on.plays ? S.fmt.signed(oo.on.pm) : "—", oo.on.plays ? `On NET ${S.fmt.signed(oo.on.net, 1)}` : "")}
      </div>
      <h2 class="section-title">Points by game</h2><div id="ptsChart"></div>
      <h2 class="section-title">Game log</h2><div id="log"></div>
      <h2 class="section-title">On / off court</h2>
      <div class="callout">How the team does with ${U.esc(p.name.split(" ")[0])} on the court vs. off it, per 100 possessions. Based on plays where the five on court are known.</div>
      <div id="onoff"></div>
      <h2 class="section-title">Most-used lineups with ${U.esc(p.name)}</h2><div id="lus"></div>
      <h2 class="section-title">Insights</h2>
      ${insightsHtml(ins)}
    </main>`;

    C.bars(app.querySelector("#ptsChart"), {
      ariaLabel: `Points by game for ${p.name}`,
      bars: log.map((g) => ({ label: U.shortDate(g.date), value: g.played ? g.pts : 0, color: "var(--series-us)", href: `#/game/${g.event_id}/box`,
        tip: `<div class="tt-title">${U.esc(g.opp)}</div>${g.played ? `<div><b>${g.pts}</b> pts · ${g.reb} reb · ${g.ast} ast · ${g.stl} stl</div><div>FG ${g.fgm}-${g.fga} · 3PT ${g.fg3m}-${g.fg3a} · FT ${g.ftm}-${g.fta}</div>` : "<div>Did not play</div>"}` })),
    });
    U.table(app.querySelector("#log"), {
      cols: [
        { key: "date", label: "Date", left: true, fmt: (g) => `<a href="#/game/${g.event_id}/box">${U.shortDate(g.date)} ${U.esc(g.opp)}</a>`, val: (g) => g.date },
        { key: "res", label: "Result", fmt: (g) => `<span class="res-${g.result}">${g.res}</span>`, val: (g) => g.margin },
        { key: "pts", label: "PTS" }, { key: "fg", label: "FG", fmt: (g) => `${g.fgm}-${g.fga}`, val: (g) => g.fgm },
        { key: "fg3", label: "3PT", fmt: (g) => `${g.fg3m}-${g.fg3a}`, val: (g) => g.fg3m }, { key: "ft", label: "FT", fmt: (g) => `${g.ftm}-${g.fta}`, val: (g) => g.ftm },
        { key: "reb", label: "REB" }, { key: "ast", label: "AST" }, { key: "stl", label: "STL" }, { key: "blk", label: "BLK" }, { key: "tov", label: "TO" }, { key: "pf", label: "PF" },
        { key: "pm", label: "+/-", fmt: (g) => (g.pm === null ? "—" : S.signedCell(g.pm)) },
      ],
      rows: log.filter((g) => g.played),
      sort: { key: "date", dir: "desc" },
    });
    U.table(app.querySelector("#onoff"), {
      cols: [
        { key: "k", label: "", left: true, fmt: (x) => (x.k === "On court" ? "<b>On court</b>" : "Off court") },
        { key: "poss", label: "Poss", fmt: (x) => S.fmt.int(x.poss) },
        { key: "ortg", label: "Off RTG", title: "Points scored per 100 possessions", fmt: (x) => S.fmt.d1(x.ortg) },
        { key: "drtg", label: "Def RTG", title: "Points allowed per 100 possessions", fmt: (x) => S.fmt.d1(x.drtg) },
        { key: "net", label: "Net", fmt: (x) => (x.net === null ? "—" : S.signedCell(x.net, 1)) },
        { key: "efg", label: "eFG%", fmt: (x) => S.fmt.pct(x.r.efg) },
        { key: "oefg", label: "Opp eFG%", fmt: (x) => S.fmt.pct(x.ropp.efg) },
        { key: "tovp", label: "TO%", title: "Turnovers per possession", fmt: (x) => S.fmt.pct(x.tov_pct) },
        { key: "otovp", label: "Opp TO%", fmt: (x) => S.fmt.pct(x.opp_tov_pct) },
        { key: "orb", label: "OREB%", fmt: (x) => S.fmt.pct(x.oreb_pct) },
      ],
      rows: [{ k: "On court", ...oo.on }, { k: "Off court", ...oo.off }],
    });
    VLineups.table(app.querySelector("#lus"), lus);
  }

  const tile = (l, v, s) => `<div class="tile"><div class="lbl">${l}</div><div class="val">${v}</div><div class="sub">${s}</div></div>`;

  function gameLog(p) {
    const oc = {};
    for (const s of U.D.stints) if (s.players.includes(p.name)) {
      const o = (oc[s.event_id] ||= { pm: 0 });
      o.pm += s.us.pts - s.opp.pts;
    }
    return U.games.map((g) => {
      const t = S.playerTotals([g.event_id]).find((x) => x.player === p.name);
      return { ...t, event_id: g.event_id, date: g.date, opp: U.gameLabel(g), result: g.result, res: `${g.result} ${g.score_us}-${g.score_opponent}`,
        margin: g.score_us - g.score_opponent, played: t.gp > 0, reb: t.oreb + t.dreb, pm: oc[g.event_id] ? oc[g.event_id].pm : null };
    });
  }

  function insightsHtml(ins) {
    if (!ins.length) return `<p class="empty">No player insights.</p>`;
    const byGame = {};
    ins.forEach((i) => (byGame[i.event_id] ||= []).push(i.text));
    return U.games.filter((g) => byGame[g.event_id]).reverse().map((g) => `<div class="ins-block"><div class="ins-cat"><a href="#/game/${g.event_id}/insights">${U.shortDate(g.date)} · ${U.esc(U.gameLabel(g))} (${g.result} ${g.score_us}-${g.score_opponent})</a></div>
      <ul>${byGame[g.event_id].map((t) => `<li>${U.esc(t)}</li>`).join("")}</ul></div>`).join("");
  }

  return { render };
})();
