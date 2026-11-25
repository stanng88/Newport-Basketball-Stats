/* Lineups: 5/4/3/2-player combinations, filters, on/off, shared lineup table. */
const VLineups = (() => {
  const state = { size: 5, game: "all", minPoss: 5, include: [], sort: { key: "poss", dir: "desc" } };

  /** Shared lineup table (also used on player and game pages). */
  function table(el, rows, opts = {}) {
    const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.net || 0)));
    U.table(el, {
      cols: [
        { key: "players", label: "Lineup", left: true, cls: "lineup-names", val: (r) => r.players.join(","), fmt: (r) => r.players.map(U.playerLink).join(", ") },
        { key: "gp", label: "GP", title: "Games this lineup played together" },
        { key: "plays", label: "Plays", title: "Plays logged with this group on court" },
        { key: "poss", label: "Poss", title: "Estimated possessions (avg of both teams)", fmt: (r) => S.fmt.int(r.poss) },
        { key: "pts_for", label: "PTS", title: "Points scored" },
        { key: "pts_against", label: "OPP", title: "Points allowed" },
        { key: "pm", label: "+/-", fmt: (r) => S.signedCell(r.pm) },
        { key: "ortg", label: "Off RTG", title: "Points scored per 100 possessions", fmt: (r) => S.fmt.d1(r.ortg) },
        { key: "drtg", label: "Def RTG", title: "Points allowed per 100 possessions", fmt: (r) => S.fmt.d1(r.drtg) },
        { key: "net", label: "Net RTG", title: "Off RTG − Def RTG", fmt: (r) => `<span class="bar-cell">${S.signedCell(r.net, 1)}<span class="mini-bar" style="width:${Math.round((Math.abs(r.net || 0) / maxAbs) * 40)}px;background:${(r.net || 0) >= 0 ? "var(--pos)" : "var(--neg)"}"></span></span>` },
        { key: "efg", label: "eFG%", val: (r) => r.r.efg, fmt: (r) => S.fmt.pct(r.r.efg) },
        { key: "oefg", label: "Opp eFG%", val: (r) => r.ropp.efg, fmt: (r) => S.fmt.pct(r.ropp.efg) },
        { key: "tov_pct", label: "TO%", title: "Our turnovers per possession", fmt: (r) => S.fmt.pct(r.tov_pct) },
        { key: "opp_tov_pct", label: "Forced TO%", title: "Opponent turnovers per possession", fmt: (r) => S.fmt.pct(r.opp_tov_pct) },
        { key: "oreb_pct", label: "OREB%", title: "Share of our misses we rebounded", fmt: (r) => S.fmt.pct(r.oreb_pct) },
        { key: "dreb_pct", label: "DREB%", title: "Share of their misses we rebounded", fmt: (r) => S.fmt.pct(r.dreb_pct) },
      ],
      rows,
      sort: opts.sort || { key: "poss", dir: "desc" },
      onSort: opts.onSort,
    });
  }

  function render(app) {
    const ids = state.game === "all" ? U.games.map((g) => g.event_id) : [state.game];
    const all = S.lineups(ids, state.size);
    const rows = all.filter((r) => r.poss >= state.minPoss && state.include.every((n) => r.players.includes(n)));
    const covered = U.D.stints.filter((s) => ids.includes(s.event_id)).reduce((a, s) => a + s.plays, 0);
    const totalPlays = ids.reduce((a, id) => a + U.playsByGame[id].filter((p) => p.action !== "sub_in" && p.action !== "sub_out").length, 0);
    const label = { 5: "5-man lineups", 4: "4-player groups", 3: "3-player groups", 2: "2-player pairs" }[state.size];

    app.innerHTML = `${VTeam.band("lineups")}<main class="page">
      <h1 class="page-title">Lineups</h1>
      <div class="callout">Lineups are rebuilt from substitutions in the play-by-play. Ratings are per 100 estimated possessions (FGA + 0.44×FTA − OREB + TO).
        ${Math.round((covered / totalPlays) * 100)}% of plays in the selected games have a known five on court; plays where the scorebook had more or fewer than five checked in are left out.
        Small samples swing a lot, so use the minimum-possessions filter.</div>
      <div class="controls">
        ${U.seg("size", [5, 4, 3, 2].map((n) => ({ v: String(n), label: n === 5 ? "5-man" : `${n}-player` })), String(state.size))}
        <label class="note">Games <select id="game"><option value="all">All games</option>${[...U.games].reverse().map((g) => `<option value="${U.esc(g.event_id)}" ${g.event_id === state.game ? "selected" : ""}>${U.shortDate(g.date)} ${U.esc(U.gameLabel(g))} (${U.esc(g.result)})</option>`).join("")}</select></label>
        <label class="note">Min possessions <input type="number" id="minp" min="0" step="1" value="${state.minPoss}" style="width:70px"></label>
        <span class="spacer"></span><span class="note">${rows.length} of ${all.length} ${label}</span>
      </div>
      <div class="controls"><span class="note">Must include:</span><div class="chips">${U.players.map((p) => `<button class="chip ${state.include.includes(p.name) ? "on" : ""}" data-p="${U.esc(p.name)}">#${p.number} ${U.esc(p.name)}</button>`).join("")}</div>
        ${state.include.length ? `<button class="btn" id="clr">Clear</button>` : ""}</div>
      <div id="tbl"></div>
      <h2 class="section-title">On / off court by player</h2>
      <p class="note">Team net rating with each player on the court vs. on the bench (same games and coverage as above). Positive "On − Off" means the team plays better with them out there.</p>
      <div id="onoff"></div>
    </main>`;

    const defaultMin = (size) => ({ 5: 5, 4: 8, 3: 10, 2: 15 }[size]);
    U.bindSeg(app, "size", (v) => { state.size = +v; state.minPoss = state.game === "all" ? defaultMin(+v) : 0; render(app); });
    app.querySelector("#game").addEventListener("change", (e) => { state.game = e.target.value; state.minPoss = e.target.value === "all" ? defaultMin(state.size) : 0; render(app); });
    app.querySelector("#minp").addEventListener("change", (e) => { state.minPoss = Math.max(0, +e.target.value || 0); render(app); });
    app.querySelectorAll(".chip").forEach((c) => c.addEventListener("click", () => {
      const n = c.dataset.p;
      state.include = state.include.includes(n) ? state.include.filter((x) => x !== n) : [...state.include, n].slice(-state.size);
      render(app);
    }));
    const clr = app.querySelector("#clr");
    if (clr) clr.addEventListener("click", () => { state.include = []; render(app); });

    table(app.querySelector("#tbl"), rows, { sort: state.sort, onSort: (s) => (state.sort = s) });
    U.table(app.querySelector("#onoff"), {
      cols: [
        { key: "player", label: "Player", left: true, fmt: (r) => `${U.playerLink(r.player)}, #${r.number}`, val: (r) => r.number },
        { key: "onposs", label: "On poss", val: (r) => r.on.poss, fmt: (r) => S.fmt.int(r.on.poss) },
        { key: "onpm", label: "On +/-", val: (r) => r.on.pm, fmt: (r) => S.signedCell(r.on.pm) },
        { key: "onnet", label: "On NET", val: (r) => r.on.net, fmt: (r) => (r.on.net === null ? "—" : S.signedCell(r.on.net, 1)) },
        { key: "offposs", label: "Off poss", val: (r) => r.off.poss, fmt: (r) => S.fmt.int(r.off.poss) },
        { key: "offnet", label: "Off NET", val: (r) => r.off.net, fmt: (r) => (r.off.net === null ? "—" : S.signedCell(r.off.net, 1)) },
        { key: "diff", label: "On − Off", fmt: (r) => (r.diff === null ? "—" : S.signedCell(r.diff, 1)) },
        { key: "onefg", label: "On eFG%", val: (r) => r.on.r.efg, fmt: (r) => S.fmt.pct(r.on.r.efg) },
        { key: "ondrtg", label: "On Def RTG", val: (r) => r.on.drtg, fmt: (r) => S.fmt.d1(r.on.drtg) },
      ],
      rows: S.onOff(ids).filter((r) => r.on.plays > 0),
      sort: { key: "diff", dir: "desc" },
    });
  }

  return { render, table };
})();
