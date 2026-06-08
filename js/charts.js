// charts.js — petits graphiques SVG sans dépendance (fonctionne hors-ligne).

function svg(w, h, inner) {
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" role="img">${inner}</svg>`;
}

// Graphe en ligne. series = [{ points:[{x,y}], color }]; x = index, y = valeur.
export function lineChart(series, opts = {}) {
  const w = opts.w || 320, h = opts.h || 140, pad = 26;
  const all = series.flatMap((s) => s.points);
  if (all.length < 1) return emptyChart('Pas encore de données');
  const ys = all.map((p) => p.y);
  const xs = all.map((p) => p.x);
  let minY = Math.min(...ys), maxY = Math.max(...ys);
  if (minY === maxY) { minY -= 1; maxY += 1; }
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const spanX = maxX - minX || 1, spanY = maxY - minY || 1;
  const X = (x) => pad + ((x - minX) / spanX) * (w - pad - 8);
  const Y = (y) => h - pad - ((y - minY) / spanY) * (h - pad - 12);

  let grid = '';
  for (let i = 0; i <= 3; i++) {
    const gy = pad + ((h - pad - 12) / 3) * i + 0;
    const val = Math.round(maxY - (spanY / 3) * i);
    grid += `<line x1="${pad}" y1="${gy}" x2="${w - 8}" y2="${gy}" stroke="#2a313c" stroke-width="1"/>`;
    grid += `<text x="2" y="${gy + 3}" fill="#8b949e" font-size="9">${val}</text>`;
  }

  let paths = '';
  for (const s of series) {
    if (!s.points.length) continue;
    const d = s.points.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ');
    paths += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
    paths += s.points.map((p) => `<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="2.5" fill="${s.color}"/>`).join('');
  }
  return svg(w, h, grid + paths);
}

// Barres (ex : charge hebdo). bars = [{label, value, color?}]
export function barChart(bars, opts = {}) {
  const w = opts.w || 320, h = opts.h || 140, pad = 24;
  if (!bars.length) return emptyChart('Pas encore de données');
  const maxV = Math.max(...bars.map((b) => b.value), 1);
  const bw = (w - pad - 6) / bars.length;
  let out = '';
  for (let i = 0; i <= 2; i++) {
    const gy = pad + ((h - pad - 16) / 2) * i;
    out += `<line x1="${pad}" y1="${gy}" x2="${w - 4}" y2="${gy}" stroke="#2a313c"/>`;
  }
  bars.forEach((b, i) => {
    const bh = (b.value / maxV) * (h - pad - 18);
    const x = pad + i * bw + 2;
    const y = h - 16 - bh;
    out += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(bw - 4).toFixed(1)}" height="${bh.toFixed(1)}" rx="3" fill="${b.color || '#e23636'}"/>`;
    if (b.label) out += `<text x="${(x + (bw - 4) / 2).toFixed(1)}" y="${h - 4}" fill="#8b949e" font-size="9" text-anchor="middle">${b.label}</text>`;
  });
  return svg(w, h, out);
}

function emptyChart(msg) {
  return `<div class="empty small"><div class="big">📊</div>${msg}</div>`;
}
