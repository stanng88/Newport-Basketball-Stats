/* Hash router. Routes: #/schedule  #/stats  #/team  #/lineups  #/glossary  #/player/<number>  #/game/<id>/<tab> */
(() => {
  const app = document.getElementById("app");
  document.getElementById("generated").textContent = `Data through ${U.shortDate(U.games[U.games.length - 1].date)} · built ${new Date(U.D.generated_at).toLocaleDateString()}`;

  function route() {
    U.hideTip();
    const [page, a, b] = location.hash.replace(/^#\/?/, "").split("/");
    switch (page) {
      case "stats": return VStats.render(app);
      case "team": return VTeam.team(app);
      case "lineups": return VLineups.render(app);
      case "glossary": return VGlossary.render(app);
      case "player": return VPlayer.render(app, +a);
      case "game": return VGame.render(app, a, b);
      default: return VTeam.schedule(app);
    }
  }
  window.addEventListener("hashchange", () => { route(); window.scrollTo(0, 0); });
  route();
})();
