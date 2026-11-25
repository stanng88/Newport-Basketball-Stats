/* Glossary: every stat on the site with its definition, formula and how to read it. */
const VGlossary = (() => {
  // [abbr, name, formula or null, description]
  const SECTIONS = [
    {
      title: "Counting stats",
      intro: "Raw totals from the scorebook. These are the numbers in the box score and Totals view.",
      terms: [
        ["GP", "Games played", null, "Games the player appeared in (checked in at least once)."],
        ["GS", "Games started", null, "Games the player was in the starting five."],
        ["PTS", "Points", "2 × 2PM + 3 × 3PM + FTM", "Total points scored."],
        ["FG", "Field goals", "FGM-FGA", "Shots made and attempted from the floor (2s and 3s, not free throws). Shown as made-attempted, e.g. 5-12."],
        ["3PT", "Three-pointers", "3PM-3PA", "Shots made and attempted from behind the arc."],
        ["FT", "Free throws", "FTM-FTA", "Free throws made and attempted."],
        ["OREB", "Offensive rebounds", null, "Rebounds of our own missed shots. Each one gives us another chance to score."],
        ["DREB", "Defensive rebounds", null, "Rebounds of the opponent's missed shots. Each one ends their possession."],
        ["REB", "Total rebounds", "OREB + DREB", "All rebounds."],
        ["AST", "Assists", null, "Passes that lead directly to a made basket."],
        ["STL", "Steals", null, "Taking the ball away from the opponent (a turnover we forced)."],
        ["BLK", "Blocks", null, "Deflecting an opponent's shot attempt."],
        ["TO", "Turnovers", null, "Losing the ball without getting a shot off: bad pass, travel, offensive foul, stolen, etc."],
        ["PF", "Personal fouls", null, "Fouls committed. Five usually means fouling out."],
      ],
    },
    {
      title: "Per-game averages",
      intro: "Totals divided by games played (GP). Shown in the Averages view.",
      terms: [
        ["PPG", "Points per game", "PTS ÷ GP", "Average scoring per game played."],
        ["RPG", "Rebounds per game", "REB ÷ GP", "Average rebounds per game."],
        ["ORPG", "Offensive rebounds per game", "OREB ÷ GP", "Average offensive rebounds per game."],
        ["APG", "Assists per game", "AST ÷ GP", "Average assists per game."],
        ["SPG", "Steals per game", "STL ÷ GP", "Average steals per game."],
        ["BPG", "Blocks per game", "BLK ÷ GP", "Average blocks per game."],
        ["TOPG", "Turnovers per game", "TO ÷ GP", "Average turnovers per game. Lower is better."],
        ["PFPG", "Fouls per game", "PF ÷ GP", "Average fouls per game."],
      ],
    },
    {
      title: "Shooting percentages",
      intro: "How efficiently shots go in. A percentage on a handful of attempts swings a lot, so check the attempts too.",
      terms: [
        ["FG%", "Field goal percentage", "FGM ÷ FGA", "Share of field goal attempts made. Treats a three the same as a two."],
        ["3PT%", "Three-point percentage", "3PM ÷ 3PA", "Share of three-point attempts made."],
        ["FT%", "Free throw percentage", "FTM ÷ FTA", "Share of free throws made."],
        ["eFG%", "Effective field goal percentage", "(FGM + 0.5 × 3PM) ÷ FGA", "FG% with threes counted as 1.5 makes, since they're worth 50% more. The best single number for shooting from the floor."],
        ["TS%", "True shooting percentage", "PTS ÷ (2 × (FGA + 0.44 × FTA))", "Points per shot, including free throws. Rewards players who score efficiently by getting to the line as well as making shots. The 0.44 accounts for and-ones and three-shot fouls."],
      ],
    },
    {
      title: "Shot profile and ball security",
      intro: "How a player or team creates its offense.",
      terms: [
        ["3PA rate", "Three-point attempt rate", "3PA ÷ FGA", "Share of shots taken from three."],
        ["FT rate", "Free throw rate", "FTA ÷ FGA", "Free throws earned per shot. Higher means more attacking the basket and drawing fouls."],
        ["AST/TO", "Assist-to-turnover ratio", "AST ÷ TO", "Assists per turnover. Above 1 means a player creates more than they give away. Most useful for ball handlers."],
      ],
    },
    {
      title: "Possessions and ratings",
      intro: "Rates per possession make games and lineups comparable even when the pace or minutes differ. GameChanger doesn't log possessions, so they are estimated from the box score.",
      terms: [
        ["Poss", "Possessions (estimated)", "FGA + 0.44 × FTA − OREB + TO", "Times a team had the ball. A possession ends with a shot that isn't rebounded by the offense, free throws, or a turnover. When shown for a lineup or player, it's the average of our possessions and the opponent's while they were on the court."],
        ["Off RTG", "Offensive rating", "100 × PTS ÷ our possessions", "Points we score per 100 possessions. Higher is better."],
        ["Def RTG", "Defensive rating", "100 × opponent PTS ÷ their possessions", "Points we allow per 100 possessions. Lower is better."],
        ["Net RTG", "Net rating", "Off RTG − Def RTG", "How many points per 100 possessions we outscore the opponent by. Positive is good. The key number for comparing lineups."],
        ["TO%", "Turnover percentage", "TO ÷ our possessions", "Share of our possessions that end in a turnover. Lower is better."],
        ["Forced TO%", "Forced turnover percentage", "Opponent TO ÷ their possessions", "Share of the opponent's possessions that end in a turnover. Higher means more disruptive defense. Shown as Opp TO% on player pages."],
        ["OREB%", "Offensive rebound percentage", "OREB ÷ (OREB + opponent DREB)", "Share of our missed shots that we get back."],
        ["DREB%", "Defensive rebound percentage", "DREB ÷ (DREB + opponent OREB)", "Share of the opponent's misses that we rebound. Higher means fewer second chances for them."],
        ["Opp eFG%", "Opponent effective FG%", "Opponent (FGM + 0.5 × 3PM) ÷ FGA", "How well the opponent shot while a group was on the court. Lower is better defense."],
      ],
    },
    {
      title: "Plus/minus and on/off",
      intro: "What happens on the scoreboard while a player is on the court. These capture contributions the box score misses, like defense and spacing, but they also depend on teammates and opponents.",
      terms: [
        ["+/-", "Plus/minus", "Our PTS − opponent PTS while on court", "Point differential while the player (or lineup) was on the floor. +6 means the team outscored the opponent by 6 during that time."],
        ["+/- PG", "Plus/minus per game", "+/- ÷ GP", "Average plus/minus per game played."],
        ["On NET", "On-court net rating", "Net RTG while on court", "Team net rating with the player on the floor. The per-possession version of +/-."],
        ["On-court poss", "On-court possessions", null, "Estimated possessions the player was on the floor for. Use it to judge how much to trust their +/- and On NET."],
        ["On / Off", "On court vs. off court", null, "The team's numbers with a player on the court compared with the same games while they sat on the bench. Games the player missed aren't counted as off court."],
        ["On − Off", "On/off differential", "On NET − Off NET", "How much better (positive) or worse (negative) the team's net rating is with the player on the court. Small samples and who they usually play with both affect it."],
      ],
    },
    {
      title: "Lineups",
      intro: "Built from the substitutions in the play-by-play.",
      terms: [
        ["Lineup", "5-man lineup", null, "The five players on the court together. The Lineups page can also group by 4, 3 or 2 players, which combines every five-man lineup that included that group."],
        ["GP", "Games together", null, "On lineup tables: games in which the group shared the court at least once."],
        ["Plays", "Plays logged", null, "Scorebook entries (shots, rebounds, fouls, turnovers, etc.) recorded while the group was on the court. Substitutions don't count."],
        ["Stint", "Stint", null, "An unbroken stretch with the same five on the court. It ends at the next substitution or the end of a period. Shown on each game's Lineups tab."],
        ["Min poss", "Minimum possessions", null, "Filter that hides groups with too few possessions to say much. A lineup that's +20 over 3 possessions is noise."],
      ],
    },
  ];

  const NOTES = [
    "The scorebook doesn't log game time, so the site doesn't show minutes. Possessions and plays measure playing time instead.",
    "Box score stats come from GameChanger and match its totals. Plus/minus, ratings and lineups use only plays where exactly five of our players are known to be on court. Plays where the scorer was late entering a substitution are left out, which is why the Lineups page shows a coverage percentage.",
    "GameChanger recorded the Nov 7 game vs. Eckstein as a single period, so it has no quarter breakdown. Some games were played in halves and are labeled H1/H2.",
    "Possessions are an estimate (the standard formula used in college and pro analytics). They're close over a season but rough for a single short stint.",
  ];

  const state = { q: "" };

  function render(app) {
    app.innerHTML = `${VTeam.band("glossary")}<main class="page">
      <h1 class="page-title">Glossary</h1>
      <p class="note">What each stat on this site means and how it's calculated.</p>
      <div class="controls"><input type="search" id="gq" placeholder="Search stats, e.g. eFG or rebound" value="${U.esc(state.q)}" class="gloss-search" aria-label="Search glossary"><span class="spacer"></span><span class="note" id="gcount"></span></div>
      <nav class="gloss-toc">${SECTIONS.map((s, i) => `<a href="#" data-sec="${i}">${U.esc(s.title)}</a>`).join("")}</nav>
      <div id="gbody"></div>
      <h2 class="section-title">How the numbers are built</h2>
      <ul class="gloss-notes">${NOTES.map((n) => `<li>${U.esc(n)}</li>`).join("")}</ul>
    </main>`;
    const input = app.querySelector("#gq");
    input.addEventListener("input", () => { state.q = input.value; draw(app); });
    app.querySelectorAll(".gloss-toc a").forEach((a) => a.addEventListener("click", (e) => {
      e.preventDefault();
      const el = app.querySelector(`#gsec-${a.dataset.sec}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }));
    draw(app);
  }

  const matches = (t, q) => !q || t.some((x) => x && x.toLowerCase().includes(q));

  function draw(app) {
    const q = state.q.trim().toLowerCase();
    let n = 0;
    const html = SECTIONS.map((s, i) => {
      const terms = s.terms.filter((t) => matches(t, q));
      n += terms.length;
      if (!terms.length) return "";
      return `<section class="gloss-sec" id="gsec-${i}"><h2 class="section-title">${U.esc(s.title)}</h2>
        ${q ? "" : `<p class="note">${U.esc(s.intro)}</p>`}
        <dl class="gloss-list">${terms.map(([abbr, name, formula, desc]) => `<div class="gloss-item">
          <dt><span class="gloss-abbr">${U.esc(abbr)}</span><span class="gloss-name">${U.esc(name)}</span></dt>
          <dd>${formula ? `<code class="gloss-formula">${U.esc(formula)}</code>` : ""}<p>${U.esc(desc)}</p></dd></div>`).join("")}</dl></section>`;
    }).join("");
    app.querySelector("#gbody").innerHTML = html || `<p class="note">No stats match "${U.esc(state.q)}".</p>`;
    app.querySelector("#gcount").textContent = `${n} stat${n === 1 ? "" : "s"}`;
  }

  return { render };
})();
