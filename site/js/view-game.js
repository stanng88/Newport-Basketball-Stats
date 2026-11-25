/* Game detail: Recap (+ game flow), Box Score (by period), Insights, Plays, Lineups. */
const VGame = (() => {
  const TABS = [["recap", "Recap"], ["box", "Box Score"], ["insights", "Insights"], ["plays", "Plays"], ["lineups", "Lineups"]];
  const state = { period: 0, insight: "Full game", playFilter: "all", playPlayer: "", reverse: true };
  let lastGame = null;

  function render(app, id, tab = "recap") {
    const g = U.gameById[id];
    if (!g) { app.innerHTML = `<main class="page"><p class="empty">Game not found. <a href="#/">Back to schedule</a></p></main>`; return; }
    if (lastGame !== id) Object.assign(state, { period: 0, insight: "Full game", playFilter: "all", playPlayer: "" });
    lastGame = id;
    const us = U.D.team.name;
    const [away, home] = g.home_away === "home" ? [g.opponent, us] : [us, g.opponent];
    const [as, hs] = g.home_away === "home" ? [g.score_opponent, g.score_us] : [g.score_us, g.score_opponent];
    app.innerHTML = `<section class="game-band"><a class="game-back" href="#/schedule">← Back to Schedule</a>
      <div class="scoreline">
        <div class="team ${away === us ? "us" : ""}">${U.esc(away)}</div>
        <div class="score">${as}</div>
        <div class="mid">${U.esc(g.datetime_text)}<div>${U.esc(g.location || "")}</div><div class="final">FINAL · ${g.result}</div></div>
        <div class="score">${hs}</div>
        <div class="team right ${home === us ? "us" : ""}">${U.esc(home)}</div>
      </div></section>
      <nav class="game-tabs">${TABS.map(([k, l]) => `<a href="#/game/${id}/${k}" class="${k === tab ? "active" : ""}">${l}</a>`).join("")}</nav>
      <main class="page" id="gbody"></main>`;
    const body = app.querySelector("#gbody");
    const views = new Map([["recap", recap], ["box", box], ["insights", insights], ["plays", plays], ["lineups", lineups]]);
    (views.get(tab) || recap)(body, g);
  }

  function lineScore(g) {
    const periods = [...new Set(U.D.team_period_box.filter((r) => r.event_id === g.event_id).map((r) => r.period))].sort();
    const pts = (team, p) => (U.D.team_period_box.find((r) => r.event_id === g.event_id && r.team === team && r.period === p) || { pts: 0 }).pts;
    return `<div class="table-wrap" style="max-width:520px"><table class="stats"><thead><tr><th class="left">Team</th>${periods.map((p) => `<th>${U.periodLabel(g, p)}</th>`).join("")}<th>T</th></tr></thead><tbody>
      <tr><td><b>${U.esc(U.D.team.name)}</b></td>${periods.map((p) => `<td>${pts("us", p)}</td>`).join("")}<td><b>${g.score_us}</b></td></tr>
      <tr><td>${U.esc(g.opponent)}</td>${periods.map((p) => `<td>${pts("opponent", p)}</td>`).join("")}<td><b>${g.score_opponent}</b></td></tr></tbody></table></div>`;
  }

  function recap(el, g) {
    const [title, ...rest] = (g.recap || "").split("\n").filter((l) => l.trim());
    const plays = U.playsByGame[g.event_id];
    const points = [], periods = [];
    let lastPeriod = 0;
    plays.filter((p) => p.action !== "sub_in" && p.action !== "sub_out").forEach((p, i) => {
      if (p.period !== lastPeriod) { periods.push({ i, label: U.periodLabel(g, p.period) }); lastPeriod = p.period; }
      points.push({ i, us: p.score_us, opp: p.score_opponent, period: U.periodLabel(g, p.period), label: describe(p) });
    });
    el.innerHTML = `<div class="narrow recap">
      <h2 class="section-title" style="margin-top:0">Game flow</h2><div id="flow"></div>
      <h2 class="section-title">Scoring by period</h2>${lineScore(g)}
      <h2 class="section-title">Recap</h2>
      ${title ? `<h1>${U.esc(title)}</h1><p class="note">${U.esc(rest[0] || "")}</p>${rest.slice(1).map((p) => `<p>${U.esc(p)}</p>`).join("")}` : `<p class="empty">No recap for this game.</p>`}
    </div>`;
    C.gameFlow(el.querySelector("#flow"), { points, periods, usName: "Newport", oppName: g.opponent });
  }

  function describe(p) {
    const who = p.team === "us" ? (p.player ? `${p.player}` : "Newport") : "Opponent";
    return `${p.action} — ${who}`;
  }

  function periodsOf(g) {
    return [...new Set(U.D.team_period_box.filter((r) => r.event_id === g.event_id).map((r) => r.period))].sort();
  }

  function box(el, g) {
    const ps = periodsOf(g);
    const per = state.period || null;
    const rows = S.playerTotals([g.event_id], per).filter((r) => r.gp > 0);
    const oc = {};
    for (const s of U.D.stints) if (s.event_id === g.event_id && (!per || s.period === per)) for (const n of s.players) {
      const o = (oc[n] ||= { pm: 0, plays: 0 });
      o.pm += s.us.pts - s.opp.pts;
      o.plays += s.plays;
    }
    rows.forEach((r) => Object.assign(r, { pm: oc[r.player] ? oc[r.player].pm : null, onPlays: oc[r.player] ? oc[r.player].plays : 0 }));
    const team = { player: "Team", number: null, ...S.teamTotals([g.event_id], "us", per), pm: null };
    const opp = { player: g.opponent, number: null, opp: true, ...S.teamTotals([g.event_id], "opponent", per), pm: null };
    el.innerHTML = `<div class="controls">${ps.length > 1 ? U.seg("period", [{ v: "0", label: "Full game" }, ...ps.map((p) => ({ v: String(p), label: U.periodLabel(g, p) }))], String(state.period)) : ""}
      <span class="spacer"></span><span class="note">Lineup coverage this game: ${Math.round((U.D.lineup_coverage[g.event_id] || 0) * 100)}% of plays</span></div>
      <div id="tbl"></div><h2 class="section-title">Team comparison</h2><div id="cmp"></div>`;
    U.bindSeg(el, "period", (v) => { state.period = +v; box(el, g); });
    const made = (m, a) => (r) => `${r[m]}-${r[a]}`;
    U.table(el.querySelector("#tbl"), {
      cols: [
        { key: "player", label: "Player", left: true, fmt: (r) => (r.number === null ? `<b>${U.esc(r.player)}</b>` : `${U.playerLink(r.player)}, #${r.number}`), val: (r) => r.number ?? 999 },
        { key: "pts", label: "PTS" }, { key: "fg", label: "FG", fmt: made("fgm", "fga"), val: (r) => r.fgm }, { key: "fg3", label: "3PT", fmt: made("fg3m", "fg3a"), val: (r) => r.fg3m },
        { key: "ft", label: "FT", fmt: made("ftm", "fta"), val: (r) => r.ftm }, { key: "oreb", label: "OREB" }, { key: "dreb", label: "DREB" },
        { key: "reb", label: "REB", val: (r) => r.oreb + r.dreb, fmt: (r) => r.oreb + r.dreb }, { key: "ast", label: "AST" }, { key: "stl", label: "STL" },
        { key: "blk", label: "BLK" }, { key: "tov", label: "TO" }, { key: "pf", label: "PF" },
        { key: "pm", label: "+/-", title: "Point differential while on court (known lineups only)", fmt: (r) => (r.pm === null || r.pm === undefined ? "" : S.signedCell(r.pm)) },
      ],
      rows, total: team, sort: { key: "pts", dir: "desc" },
    });
    const t = S.rates(team), o = S.rates(opp);
    const pu = S.poss(team), po = S.poss(opp);
    const line = (k, a, b) => `<tr><td>${k}</td><td>${a}</td><td>${b}</td></tr>`;
    el.querySelector("#cmp").innerHTML = `<div class="table-wrap" style="max-width:560px"><table class="stats"><thead><tr><th class="left"></th><th>${U.esc(U.D.team.name)}</th><th>${U.esc(g.opponent)}</th></tr></thead><tbody>
      ${line("Points", team.pts, opp.pts)}${line("FG", `${team.fgm}-${team.fga} (${S.fmt.pct(t.fg_pct)})`, `${opp.fgm}-${opp.fga} (${S.fmt.pct(o.fg_pct)})`)}
      ${line("3PT", `${team.fg3m}-${team.fg3a} (${S.fmt.pct(t.fg3_pct)})`, `${opp.fg3m}-${opp.fg3a} (${S.fmt.pct(o.fg3_pct)})`)}
      ${line("FT", `${team.ftm}-${team.fta} (${S.fmt.pct(t.ft_pct)})`, `${opp.ftm}-${opp.fta} (${S.fmt.pct(o.ft_pct)})`)}
      ${line("eFG%", S.fmt.pct(t.efg), S.fmt.pct(o.efg))}
      ${line("Rebounds (off-def)", `${team.oreb + team.dreb} (${team.oreb}-${team.dreb})`, `${opp.oreb + opp.dreb} (${opp.oreb}-${opp.dreb})`)}
      ${line("Turnovers", team.tov, opp.tov)}${line("Steals", team.stl, opp.stl)}${line("Fouls", team.pf, opp.pf)}
      ${line("Est. possessions", S.fmt.d1(pu), S.fmt.d1(po))}
      ${line("Points / 100 poss", S.fmt.d1(pu ? (100 * team.pts) / pu : null), S.fmt.d1(po ? (100 * opp.pts) / po : null))}
    </tbody></table></div><p class="note">Opponent players aren't tracked individually; their numbers are team totals from the play-by-play.</p>`;
  }

  function insights(el, g) {
    const rows = U.D.insights.filter((i) => i.event_id === g.event_id);
    const labels = [...new Set(rows.map((r) => `${r.scope}|${r.label}`))];
    const periodOpts = labels.filter((l) => l.startsWith("period|")).map((l) => l.slice(7));
    const playerOpts = labels.filter((l) => l.startsWith("player|")).map((l) => l.slice(7));
    if (!rows.some((r) => r.label === state.insight)) state.insight = periodOpts[0] || playerOpts[0];
    const sel = rows.filter((r) => r.label === state.insight);
    const groups = {};
    sel.forEach((r) => ((groups[r.scope === "player" ? r.label : r.subject] ||= {})[r.category || ""] ||= []).push(r.text));
    el.innerHTML = `<div class="narrow"><div class="controls"><select id="insSel">
        <optgroup label="Period">${periodOpts.map((o) => `<option ${o === state.insight ? "selected" : ""}>${U.esc(o)}</option>`).join("")}</optgroup>
        <optgroup label="Players">${playerOpts.map((o) => `<option ${o === state.insight ? "selected" : ""}>${U.esc(o)}</option>`).join("")}</optgroup>
      </select></div>
      ${Object.entries(groups).map(([subj, cats]) => `<div class="ins-block"><div class="ins-head"><span>${U.esc(subj)}</span></div>
        ${Object.entries(cats).map(([cat, items]) => `${cat ? `<div class="ins-cat">${U.esc(cat)}</div>` : ""}<ul>${items.map((t) => `<li>${U.esc(t)}</li>`).join("")}</ul>`).join("")}</div>`).join("") || `<p class="empty">No insights for this selection.</p>`}
    </div>`;
    el.querySelector("#insSel").addEventListener("change", (e) => { state.insight = e.target.value; insights(el, g); });
  }

  function plays(el, g) {
    const all = U.playsByGame[g.event_id];
    const names = [...new Set(all.filter((p) => p.team === "us" && p.player).map((p) => p.player))].sort();
    let list = all.filter((p) => {
      if (state.playFilter === "scoring") return p.points > 0;
      if (state.playFilter === "player") return p.player === state.playPlayer;
      return true;
    });
    if (state.reverse) list = [...list].reverse();
    let cur = null;
    const rows = [];
    for (const p of list) {
      if (p.period !== cur) { cur = p.period; rows.push(`<div class="period-row">${g.period_format === "single_period" ? "Full game" : `${state.reverse ? "" : "Start of "}${U.periodLabel(g, p.period)}`}</div>`); }
      rows.push(playRow(p, g));
    }
    el.innerHTML = `<div class="narrow"><div class="controls">
        ${U.linkseg("pf", [{ v: "all", label: "All Plays" }, { v: "scoring", label: "Scoring Plays" }, { v: "player", label: "Player" }], state.playFilter)}
        ${state.playFilter === "player" ? `<select id="pp">${names.map((n) => `<option ${n === state.playPlayer ? "selected" : ""}>${U.esc(n)}</option>`).join("")}</select>` : ""}
        <span class="spacer"></span><button class="btn" id="rev">${state.reverse ? "Reverse chronological" : "Chronological"}</button></div>
      <div class="period-row"><b>Final (${g.score_us} - ${g.score_opponent})</b> · ${list.length} plays</div>${rows.join("")}</div>`;
    U.bindSeg(el, "pf", (v) => { state.playFilter = v; if (v === "player" && !state.playPlayer) state.playPlayer = names[0]; plays(el, g); });
    const pp = el.querySelector("#pp");
    if (pp) pp.addEventListener("change", (e) => { state.playPlayer = e.target.value; plays(el, g); });
    el.querySelector("#rev").addEventListener("click", () => { state.reverse = !state.reverse; plays(el, g); });
  }

  function playRow(p, g) {
    const us = p.team === "us";
    const sub = p.action === "sub_in" || p.action === "sub_out";
    const fouls = p.personal_fouls ? ` (${p.personal_fouls} PF)` : "";
    const who = !us ? U.esc(g.opponent) : p.player ? `${U.playerLink(p.player)}, ${U.esc(p.number)}${fouls}` : "Newport";
    const what = sub ? (p.action === "sub_in" ? "entered the game" : "sat down") : U.esc(p.action);
    return `<div class="play ${sub ? "sub" : ""}"><div class="av ${us ? "" : "opp"}">${U.esc(U.initials(us ? p.player : g.opponent))}</div>
      <div>${sub ? `<div class="who">${who}</div><div class="what">${what}</div>` : `<div class="what">${what}</div><div class="who">by ${who}</div>`}</div>
      <div>${p.points ? `<span class="score-bub">${p.score_us} - ${p.score_opponent}</span>` : ""}</div></div>`;
  }

  function lineups(el, g) {
    const stints = U.D.stints.filter((s) => s.event_id === g.event_id);
    const cov = Math.round((U.D.lineup_coverage[g.event_id] || 0) * 100);
    el.innerHTML = `<div class="callout">Every stretch of the game with the same five on court, in order. ${cov}% of this game's plays have a known lineup; the rest happened while the scorebook showed more or fewer than five checked in.</div>
      <h2 class="section-title" style="margin-top:0">Lineups this game</h2><div id="agg"></div>
      <h2 class="section-title">Stint by stint</h2><div id="st"></div>`;
    VLineups.table(el.querySelector("#agg"), S.lineups([g.event_id], 5));
    U.table(el.querySelector("#st"), {
      cols: [
        { key: "first_seq", label: "#", left: true, fmt: (s) => String(s.idx) },
        { key: "period", label: "Period", fmt: (s) => U.periodLabel(g, s.period) },
        { key: "players", label: "Lineup", cls: "lineup-names", val: (s) => s.players.join(","), fmt: (s) => s.players.map(U.playerLink).join(", ") },
        { key: "plays", label: "Plays" },
        { key: "score", label: "Score", fmt: (s) => `${s.us.pts}-${s.opp.pts}`, val: (s) => s.us.pts },
        { key: "pm", label: "+/-", val: (s) => s.us.pts - s.opp.pts, fmt: (s) => S.signedCell(s.us.pts - s.opp.pts) },
        { key: "to", label: "TO", fmt: (s) => s.us.tov, val: (s) => s.us.tov },
        { key: "stl", label: "STL", fmt: (s) => s.us.stl, val: (s) => s.us.stl },
      ],
      rows: stints.map((s, i) => ({ ...s, idx: i + 1 })),
    });
  }

  return { render };
})();
