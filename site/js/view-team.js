/* Team shell (band + tabs), Schedule page, Team (roster) page. */
const VTeam = (() => {
  const BALL = `<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="21" fill="#e8742a" stroke="#1d1d1d" stroke-width="2"/><path d="M3 24h42M24 3v42M9 9c8 6 8 24 0 30M39 9c-8 6-8 24 0 30" fill="none" stroke="#1d1d1d" stroke-width="2"/></svg>`;

  function band(active) {
    const t = U.D.team;
    const tabs = [["schedule", "Schedule"], ["stats", "Stats"], ["team", "Team"], ["lineups", "Lineups"], ["glossary", "Glossary"]];
    return `<section class="team-band">
      <div class="team-id"><div class="team-logo">${BALL}</div>
        <div><h1 class="team-name">${U.esc(t.name)}</h1>
          <div class="pills"><span class="pill">${U.record()}</span><span class="pill">${U.esc(t.season)}</span><span class="pill">${U.esc(t.location)}</span></div></div></div>
      <nav class="tabs">${tabs.map(([k, l]) => `<a href="#/${k}" class="${k === active ? "active" : ""}">${l}</a>`).join("")}</nav>
    </section>`;
  }

  function schedule(app) {
    const g = U.games;
    const pf = g.reduce((a, x) => a + x.score_us, 0), pa = g.reduce((a, x) => a + x.score_opponent, 0);
    const byMonth = {};
    [...g].reverse().forEach((x) => (byMonth[new Date(x.date + "T12:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" })] ||= []).push(x));
    const last5 = g.slice(-5).map((x) => x.result).join("");
    app.innerHTML = `${band("schedule")}<main class="page">
      <div class="tiles">
        <div class="tile"><div class="lbl">Record</div><div class="val">${U.record()}</div><div class="sub">Last 5: ${last5}</div></div>
        <div class="tile"><div class="lbl">Points / game</div><div class="val">${(pf / g.length).toFixed(1)}</div><div class="sub">${pf} total</div></div>
        <div class="tile"><div class="lbl">Allowed / game</div><div class="val">${(pa / g.length).toFixed(1)}</div><div class="sub">${pa} total</div></div>
        <div class="tile"><div class="lbl">Avg margin</div><div class="val">${S.fmt.signed((pf - pa) / g.length, 1)}</div><div class="sub">per game</div></div>
      </div>
      <h2 class="section-title">Margin by game</h2>
      <div id="margin"></div>
      <h2 class="section-title">Schedule</h2>
      ${Object.entries(byMonth).map(([mo, list]) => `<div class="sched-month">${mo}</div>${list.map(row).join("")}`).join("")}
    </main>`;
    C.bars(app.querySelector("#margin"), {
      ariaLabel: "Point margin by game",
      valueFmt: (v) => S.fmt.signed(v),
      bars: g.map((x) => {
        const m = x.score_us - x.score_opponent;
        return {
          label: U.shortDate(x.date), value: m, color: m >= 0 ? "var(--pos)" : "var(--neg)", href: `#/game/${x.event_id}/recap`,
          tip: `<div class="tt-title">${U.esc(U.gameLabel(x))}</div><div>${U.shortDate(x.date)} · <b>${x.result} ${x.score_us}-${x.score_opponent}</b></div><div class="note">Click for game details</div>`,
        };
      }),
    });
  }

  const row = (x) => {
    const d = new Date(x.date + "T12:00:00");
    return `<a class="sched-row" href="#/game/${x.event_id}/recap">
      <div class="sched-date"><div class="dow">${d.toLocaleDateString("en-US", { weekday: "short" })}</div><div class="day">${d.getDate()}</div></div>
      <div><div class="sched-opp">${U.esc(U.gameLabel(x))}</div><div class="sched-loc">${U.esc(x.location || "")} · ${U.esc(x.datetime_text.split(",").slice(1).join(",").trim())}</div></div>
      <div class="sched-res res-${x.result}">${x.result} ${x.score_us}-${x.score_opponent}</div></a>`;
  };

  function team(app) {
    const ids = U.games.map((g) => g.event_id);
    const tot = Object.fromEntries(S.playerTotals(ids).map((p) => [p.player, p]));
    app.innerHTML = `${band("team")}<main class="page"><h1 class="page-title">Roster</h1>
      <div class="roster">${U.players.map((p) => {
        const t = tot[p.name];
        const per = (k) => (t.gp ? (t[k] / t.gp).toFixed(1) : "—");
        return `<a href="#/player/${p.number}"><div class="jersey">${p.number}</div><div><div><b>${U.esc(p.name)}</b></div>
          <div class="line">${t.gp} GP · ${per("pts")} PPG · ${t.gp ? ((t.oreb + t.dreb) / t.gp).toFixed(1) : "—"} RPG · ${per("stl")} SPG</div></div></a>`;
      }).join("")}</div>
      <p class="note" style="margin-top:16px">Staff: Stan Ng, Kate Chan Ng, Isaiah Villafana</p></main>`;
  }

  return { band, schedule, team };
})();
