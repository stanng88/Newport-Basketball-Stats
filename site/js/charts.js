/* Small SVG charts: game flow (two-series step line) and bar chart. Hover tooltips on both. */
const C = (() => {
  const NS = "http://www.w3.org/2000/svg";
  const niceMax = (v) => {
    const step = v <= 10 ? 2 : v <= 30 ? 5 : 10;
    return Math.max(step, Math.ceil(v / step) * step);
  };
  const ticks = (min, max) => {
    const span = max - min;
    const step = span <= 12 ? 2 : span <= 30 ? 5 : 10;
    const out = [];
    for (let t = Math.ceil(min / step) * step; t <= max; t += step) out.push(t);
    return out;
  };
  const svgPoint = (svg, evt) => {
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  };

  /**
   * Game flow: running score for both teams over the play sequence.
   * points: [{ i, us, opp, period, label }] — one per play, chronological.
   * periods: [{ i, label }] — index where each period starts.
   */
  function gameFlow(el, { points, periods, usName, oppName }) {
    const W = 800, H = 280, m = { t: 12, r: 120, b: 28, l: 36 };
    const n = points.length;
    const maxY = niceMax(Math.max(...points.map((p) => Math.max(p.us, p.opp)), 1));
    const x = (i) => m.l + (i / Math.max(n - 1, 1)) * (W - m.l - m.r);
    const y = (v) => H - m.b - (v / maxY) * (H - m.t - m.b);
    const step = (key) => points.map((p, k) => `${k ? "H" : "M"}${x(p.i).toFixed(1)}${k ? "" : `,${y(p[key]).toFixed(1)}`}V${y(p[key]).toFixed(1)}`).join("");
    const last = points[n - 1];
    const labelY = (v, other) => {
      const d = y(v) - y(other);
      return Math.abs(d) < 14 ? y(v) + (d >= 0 ? 7 : -7) : y(v);
    };

    el.innerHTML = `
      <div class="chart-legend"><span style="--c:var(--series-us)">${U.esc(usName)}</span><span style="--c:var(--series-opp)">${U.esc(oppName)}</span></div>
      <div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Running score by play">
        <g class="axis">${ticks(0, maxY).map((t) => `<line class="gridline" x1="${m.l}" x2="${W - m.r}" y1="${y(t)}" y2="${y(t)}"/><text x="${m.l - 6}" y="${y(t) + 4}" text-anchor="end">${t}</text>`).join("")}</g>
        ${periods.map((p) => `<line class="gridline" x1="${x(p.i)}" x2="${x(p.i)}" y1="${m.t}" y2="${H - m.b}" stroke-dasharray="3 3"/><text class="lbl" x="${x(p.i) + 4}" y="${H - m.b + 16}">${U.esc(p.label)}</text>`).join("")}
        <line class="baseline" x1="${m.l}" x2="${W - m.r}" y1="${y(0)}" y2="${y(0)}"/>
        <path d="${step("opp")}" fill="none" stroke="var(--series-opp)" stroke-width="2" stroke-linejoin="round"/>
        <path d="${step("us")}" fill="none" stroke="var(--series-us)" stroke-width="2" stroke-linejoin="round"/>
        <text class="lbl-strong" x="${W - m.r + 8}" y="${labelY(last.us, last.opp) + 4}">${last.us} ${U.esc(usName)}</text>
        <text class="lbl" x="${W - m.r + 8}" y="${labelY(last.opp, last.us) + 4}">${last.opp} ${U.esc(oppName)}</text>
        <line class="xhair" y1="${m.t}" y2="${H - m.b}" stroke="var(--text-2)" stroke-width="1" visibility="hidden"/>
        <circle class="dot-us" r="4" fill="var(--series-us)" stroke="var(--surface)" stroke-width="2" visibility="hidden"/>
        <circle class="dot-opp" r="4" fill="var(--series-opp)" stroke="var(--surface)" stroke-width="2" visibility="hidden"/>
        <rect class="hit" x="${m.l}" y="${m.t}" width="${W - m.l - m.r}" height="${H - m.t - m.b}" fill="transparent"/>
      </svg></div>`;

    const svg = el.querySelector("svg");
    const parts = ["xhair", "dot-us", "dot-opp"].map((c) => svg.querySelector(`.${c}`));
    const hit = svg.querySelector(".hit");
    hit.addEventListener("mousemove", (e) => {
      const px = svgPoint(svg, e).x;
      const k = Math.max(0, Math.min(n - 1, Math.round(((px - m.l) / (W - m.l - m.r)) * (n - 1))));
      const p = points[k];
      parts[0].setAttribute("x1", x(p.i));
      parts[0].setAttribute("x2", x(p.i));
      parts[1].setAttribute("cx", x(p.i));
      parts[1].setAttribute("cy", y(p.us));
      parts[2].setAttribute("cx", x(p.i));
      parts[2].setAttribute("cy", y(p.opp));
      parts.forEach((q) => q.setAttribute("visibility", "visible"));
      U.showTip(
        `<div class="tt-title">${U.esc(p.period)} · play ${k + 1}</div>
         <div class="tt-row"><span><i class="sw" style="--c:var(--series-us)"></i>${U.esc(usName)}</span><b>${p.us}</b></div>
         <div class="tt-row"><span><i class="sw" style="--c:var(--series-opp)"></i>${U.esc(oppName)}</span><b>${p.opp}</b></div>
         <div class="note" style="margin-top:4px">${U.esc(p.label)}</div>`,
        e.clientX, e.clientY
      );
    });
    hit.addEventListener("mouseleave", () => { parts.forEach((q) => q.setAttribute("visibility", "hidden")); U.hideTip(); });
  }

  /**
   * Vertical bars. bars: [{ label, value, color, tip(html), href? }]. Values may be negative (diverging).
   */
  function bars(el, { bars: data, height = 220, valueFmt = (v) => v, ariaLabel }) {
    const W = 800, H = height, m = { t: 18, r: 8, b: 40, l: 36 };
    const maxV = niceMax(Math.max(...data.map((d) => d.value), 0));
    const minV = Math.min(...data.map((d) => d.value), 0) < 0 ? -niceMax(-Math.min(...data.map((d) => d.value))) : 0;
    const y = (v) => m.t + ((maxV - v) / (maxV - minV)) * (H - m.t - m.b);
    const band = (W - m.l - m.r) / data.length;
    const bw = Math.min(42, band * 0.62);
    const r = 4;
    const barPath = (d, k) => {
      const cx = m.l + band * k + band / 2, x0 = cx - bw / 2, y0 = y(0), y1 = y(d.value);
      if (d.value === 0) return "";
      const up = d.value > 0, rr = Math.min(r, Math.abs(y1 - y0));
      return up
        ? `M${x0},${y0}V${y1 + rr}Q${x0},${y1} ${x0 + rr},${y1}H${x0 + bw - rr}Q${x0 + bw},${y1} ${x0 + bw},${y1 + rr}V${y0}Z`
        : `M${x0},${y0}V${y1 - rr}Q${x0},${y1} ${x0 + rr},${y1}H${x0 + bw - rr}Q${x0 + bw},${y1} ${x0 + bw},${y1 - rr}V${y0}Z`;
    };
    el.innerHTML = `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${U.esc(ariaLabel || "")}">
      <g class="axis">${ticks(minV, maxV).map((t) => `<line class="gridline" x1="${m.l}" x2="${W - m.r}" y1="${y(t)}" y2="${y(t)}"/><text x="${m.l - 6}" y="${y(t) + 4}" text-anchor="end">${t}</text>`).join("")}</g>
      ${data.map((d, k) => `<path d="${barPath(d, k)}" fill="${d.color}"/>`).join("")}
      <line class="baseline" x1="${m.l}" x2="${W - m.r}" y1="${y(0)}" y2="${y(0)}"/>
      ${data.map((d, k) => `<text class="lbl" x="${m.l + band * k + band / 2}" y="${H - m.b + 16}" text-anchor="middle">${U.esc(d.label)}</text>`).join("")}
      ${data.map((d, k) => `<text class="lbl" x="${m.l + band * k + band / 2}" y="${d.value >= 0 ? y(d.value) - 5 : y(d.value) + 13}" text-anchor="middle">${U.esc(valueFmt(d.value))}</text>`).join("")}
      ${data.map((d, k) => `<rect class="hit" data-k="${k}" x="${m.l + band * k}" y="${m.t}" width="${band}" height="${H - m.t - m.b}" fill="transparent" style="cursor:${d.href ? "pointer" : "default"}"/>`).join("")}
    </svg></div>`;
    el.querySelectorAll(".hit").forEach((h) => {
      const d = data[+h.dataset.k];
      h.addEventListener("mousemove", (e) => U.showTip(d.tip, e.clientX, e.clientY));
      h.addEventListener("mouseleave", U.hideTip);
      if (d.href) h.addEventListener("click", () => { U.hideTip(); location.hash = d.href; });
    });
  }

  return { gameFlow, bars };
})();
