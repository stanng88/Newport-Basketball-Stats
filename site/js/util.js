/* Shared helpers: escaping, data indexes, sortable tables, tooltip. */
const U = (() => {
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const D = window.DATA;
  const games = [...D.games].sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time));
  const gameById = Object.fromEntries(games.map((g) => [g.event_id, g]));
  const playsByGame = Object.fromEntries(
    Object.entries(D.plays).map(([id, rows]) => [id, rows.map((r) => Object.fromEntries(D.play_keys.map((k, i) => [k, r[i]])))])
  );
  const players = [...D.players].sort((a, b) => a.number - b.number);
  const playerByNumber = Object.fromEntries(players.map((p) => [p.number, p]));
  const numberByName = Object.fromEntries(players.map((p) => [p.name, p.number]));

  const record = () => {
    const w = games.filter((g) => g.result === "W").length;
    return `${w}-${games.length - w}`;
  };
  const gameLabel = (g) => `${g.home_away === "away" ? "@" : "vs."} ${g.opponent}`;
  const shortDate = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const initials = (name) => (name || "").split(/\s+/).map((s) => s[0]).join("").slice(0, 2).toUpperCase();
  const playerLink = (name) => {
    const n = numberByName[name];
    return n === undefined ? esc(name) : `<a href="#/player/${n}">${esc(name)}</a>`;
  };
  const periodLabel = (g, p) => (g.period_format === "quarters" ? `Q${p}` : g.period_format === "halves" ? `H${p}` : "Full game");

  /**
   * Render a sortable table into `el`.
   * cols: [{ key, label, title?, fmt?(row)->html, val?(row)->sortable, left? }]
   */
  function table(el, { cols, rows, total, sort, onSort }) {
    let state = sort || null;
    const draw = () => {
      const sorted = [...rows];
      const c = state && cols.find((x) => x.key === state.key);
      if (state && !c) state = null;
      if (c) {
        const val = c.val || ((r) => r[c.key]);
        sorted.sort((a, b) => {
          const va = val(a), vb = val(b);
          const na = va === null || va === undefined || Number.isNaN(va), nb = vb === null || vb === undefined || Number.isNaN(vb);
          if (na || nb) return na - nb;
          const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
          return cmp * (state.dir === "asc" ? 1 : -1);
        });
      }
      const cell = (c, r) => (c.fmt ? c.fmt(r) : esc(r[c.key]));
      el.innerHTML = `<div class="table-wrap"><table class="stats"><thead><tr>${cols
        .map((c) => `<th data-k="${c.key}" class="${c.left ? "left" : ""} ${state && state.key === c.key ? "sorted" : ""}" title="${esc(c.title || "")}">${esc(c.label)}${state && state.key === c.key ? (state.dir === "asc" ? " ↑" : " ↓") : ""}</th>`)
        .join("")}</tr></thead><tbody>${sorted
        .map((r) => `<tr>${cols.map((c) => `<td class="${c.left ? "left" : ""} ${c.cls || ""}">${cell(c, r)}</td>`).join("")}</tr>`)
        .join("")}${total ? `<tr class="total">${cols.map((c) => `<td class="${c.left ? "left" : ""}">${cell(c, total)}</td>`).join("")}</tr>` : ""}</tbody></table></div>`;
      el.querySelectorAll("th").forEach((th) =>
        th.addEventListener("click", () => {
          const k = th.dataset.k;
          state = state && state.key === k ? { key: k, dir: state.dir === "asc" ? "desc" : "asc" } : { key: k, dir: cols[0].key === k ? "asc" : "desc" };
          onSort && onSort(state);
          draw();
        })
      );
    };
    draw();
  }

  const tip = document.getElementById("tooltip");
  const showTip = (html, x, y) => {
    tip.innerHTML = html;
    tip.hidden = false;
    const r = tip.getBoundingClientRect();
    const left = Math.min(x + 14, window.innerWidth - r.width - 8);
    const top = y + 14 + r.height > window.innerHeight ? y - r.height - 10 : y + 14;
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  };
  const hideTip = () => (tip.hidden = true);

  const seg = (name, options, current) =>
    `<div class="seg" data-seg="${name}">${options.map((o) => `<button data-v="${esc(o.v)}" class="${o.v === current ? "on" : ""}">${esc(o.label)}</button>`).join("")}</div>`;
  const linkseg = (name, options, current) =>
    `<div class="linkseg" data-seg="${name}">${options.map((o) => `<button data-v="${esc(o.v)}" class="${o.v === current ? "on" : ""}">${esc(o.label)}</button>`).join("")}</div>`;
  const bindSeg = (root, name, cb) =>
    root.querySelectorAll(`[data-seg="${name}"] button`).forEach((b) => b.addEventListener("click", () => cb(b.dataset.v)));

  return { esc, D, games, gameById, playsByGame, players, playerByNumber, numberByName, record, gameLabel, shortDate, initials, playerLink, periodLabel, table, showTip, hideTip, seg, linkseg, bindSeg };
})();
