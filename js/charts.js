/* IRONFORGE — graphes canvas, sans dépendance. Style « app pro » :
   aire dégradée, lignes lissées, barres arrondies, grille discrète. */

const FONT = '600 11px -apple-system,system-ui,sans-serif';

function setup(canvas, h) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.width = canvas.clientWidth * dpr;
  const H = canvas.height = (h || 170) * dpr;
  ctx.clearRect(0, 0, W, H);
  ctx.scale(dpr, dpr);
  return { ctx, W: canvas.clientWidth, H: h || 170 };
}

function empty(ctx, W, H) {
  ctx.fillStyle = 'rgba(255,255,255,.30)';
  ctx.font = FONT; ctx.textAlign = 'center';
  ctx.fillText('Pas encore de données — logge tes séances.', W / 2, H / 2);
}

export function lineChart(canvas, points, opts = {}) {
  const { ctx, W, H } = setup(canvas, opts.height);
  if (!points.length) return empty(ctx, W, H);
  const padX = 14, padT = 14, padB = 22;
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  let minY = opts.minY ?? Math.min(...ys), maxY = opts.maxY ?? Math.max(...ys);
  if (minY === maxY) { minY -= 1; maxY += 1; }
  const sx = (x) => padX + (maxX === minX ? .5 : (x - minX) / (maxX - minX)) * (W - 2 * padX);
  const sy = (y) => H - padB - (y - minY) / (maxY - minY) * (H - padT - padB);
  const color = opts.color || '#ff5a2c';

  // grille horizontale
  ctx.strokeStyle = 'rgba(255,255,255,.06)'; ctx.lineWidth = 1;
  for (let i = 0; i <= 3; i++) { const y = padT + i * (H - padT - padB) / 3; ctx.beginPath(); ctx.moveTo(padX, y); ctx.lineTo(W - padX, y); ctx.stroke(); }

  // aire dégradée
  const grad = ctx.createLinearGradient(0, padT, 0, H - padB);
  grad.addColorStop(0, hexA(color, .28)); grad.addColorStop(1, hexA(color, 0));
  ctx.beginPath();
  points.forEach((p, i) => { const X = sx(p.x), Y = sy(p.y); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); });
  ctx.lineTo(sx(points[points.length - 1].x), H - padB);
  ctx.lineTo(sx(points[0].x), H - padB); ctx.closePath();
  ctx.fillStyle = grad; ctx.fill();

  // ligne
  ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath();
  points.forEach((p, i) => { const X = sx(p.x), Y = sy(p.y); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); });
  ctx.stroke();

  // dernier point + valeur
  const last = points[points.length - 1];
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(sx(last.x), sy(last.y), 4, 0, 7); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(sx(last.x), sy(last.y), 1.8, 0, 7); ctx.fill();
}

export function barChart(canvas, bars, opts = {}) {
  const { ctx, W, H } = setup(canvas, opts.height);
  if (!bars.length || bars.every((b) => !b.v)) return empty(ctx, W, H);
  const padX = 12, padT = 14, padB = 22;
  const maxV = Math.max(...bars.map((b) => b.v), 1);
  const slot = (W - 2 * padX) / bars.length;
  const bw = Math.min(slot * .62, 34);
  const r = 5;
  bars.forEach((b, i) => {
    const x = padX + i * slot + (slot - bw) / 2;
    const hgt = Math.max(2, b.v / maxV * (H - padT - padB));
    const y = H - padB - hgt;
    const g = ctx.createLinearGradient(0, y, 0, H - padB);
    g.addColorStop(0, b.color || '#4aa8ff'); g.addColorStop(1, hexA(b.color || '#4aa8ff', .35));
    ctx.fillStyle = g;
    roundRectTop(ctx, x, y, bw, hgt, r); ctx.fill();
    if (b.label) { ctx.fillStyle = 'rgba(255,255,255,.40)'; ctx.font = FONT; ctx.textAlign = 'center'; ctx.fillText(b.label, x + bw / 2, H - 7); }
  });
}

function roundRectTop(ctx, x, y, w, h, r) {
  r = Math.min(r, h, w / 2);
  ctx.beginPath();
  ctx.moveTo(x, y + h); ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r); ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h); ctx.closePath();
}

function hexA(hex, a) {
  const m = hex.replace('#', '');
  const n = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
