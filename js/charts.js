/* IRONFORGE — mini-graphes en canvas, sans dépendance (hors-ligne). */

export function lineChart(canvas, points, opts = {}) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width = canvas.clientWidth * devicePixelRatio;
  const H = canvas.height = (opts.height || 160) * devicePixelRatio;
  ctx.clearRect(0, 0, W, H);
  if (!points.length) { drawEmpty(ctx, W, H); return; }
  const pad = 24 * devicePixelRatio;
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = opts.minY ?? Math.min(...ys), maxY = opts.maxY ?? Math.max(...ys);
  const sx = (x) => pad + (maxX === minX ? 0.5 : (x - minX) / (maxX - minX)) * (W - 2 * pad);
  const sy = (y) => H - pad - (maxY === minY ? 0.5 : (y - minY) / (maxY - minY)) * (H - 2 * pad);

  // axe
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = devicePixelRatio;
  ctx.beginPath(); ctx.moveTo(pad, H - pad); ctx.lineTo(W - pad, H - pad); ctx.stroke();

  // ligne
  ctx.strokeStyle = opts.color || '#ff6a3d'; ctx.lineWidth = 2.5 * devicePixelRatio;
  ctx.beginPath();
  points.forEach((p, i) => { const X = sx(p.x), Y = sy(p.y); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); });
  ctx.stroke();

  // points
  ctx.fillStyle = opts.color || '#ff6a3d';
  points.forEach((p) => { ctx.beginPath(); ctx.arc(sx(p.x), sy(p.y), 3 * devicePixelRatio, 0, 7); ctx.fill(); });
}

export function barChart(canvas, bars, opts = {}) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width = canvas.clientWidth * devicePixelRatio;
  const H = canvas.height = (opts.height || 160) * devicePixelRatio;
  ctx.clearRect(0, 0, W, H);
  if (!bars.length) { drawEmpty(ctx, W, H); return; }
  const pad = 24 * devicePixelRatio;
  const maxV = Math.max(...bars.map((b) => b.v), 1);
  const bw = (W - 2 * pad) / bars.length;
  bars.forEach((b, i) => {
    const h = (b.v / maxV) * (H - 2 * pad);
    ctx.fillStyle = b.color || '#3da8ff';
    ctx.fillRect(pad + i * bw + bw * 0.15, H - pad - h, bw * 0.7, h);
  });
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath(); ctx.moveTo(pad, H - pad); ctx.lineTo(W - pad, H - pad); ctx.stroke();
}

function drawEmpty(ctx, W, H) {
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = `${13 * devicePixelRatio}px system-ui`;
  ctx.textAlign = 'center';
  ctx.fillText('Pas encore de données — logge tes séances.', W / 2, H / 2);
}
