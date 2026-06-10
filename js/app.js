/* IRONFORGE — point d'entrée : routeur + init + service worker. */
import * as S from './store.js';
import * as E from './engine.js';
import * as V from './views.js';
import { phaseInfo } from './engine.js';

const app = document.getElementById('app');
const tabbar = document.getElementById('tabbar');

const ROUTES = {
  today: V.renderToday,
  plan: V.renderPlan,
  log: V.renderLog,
  review: V.renderReview,
  progress: V.renderProgress,
  more: V.renderMore,
  nutrition: V.renderNutrition,
  body: V.renderBody,
  coach: V.renderCoach,
  profile: V.renderProfile
};

const PRIMARY = ['today', 'plan', 'log', 'review', 'progress', 'more'];

function route() {
  const st = S.getState();
  if (!st.onboarded) { V.renderOnboarding(app); markActive(null); return; }

  const r = (location.hash.replace('#', '') || 'today');
  const render = ROUTES[r] || V.renderToday;
  app.scrollTop = 0;
  render(app);
  markActive(r);
  paintPhasePill();
}

function markActive(r) {
  tabbar.querySelectorAll('.tab').forEach((b) => {
    const tabRoute = b.dataset.route;
    const isActive = tabRoute === r || (tabRoute === 'more' && !PRIMARY.includes(r) && r);
    b.classList.toggle('active', !!isActive);
  });
}

function paintPhasePill() {
  const st = S.getState();
  const pill = document.getElementById('phase-pill');
  if (!st.onboarded) { pill.textContent = ''; return; }
  const w = E.currentWeek(st);
  const ph = phaseInfo(w.phaseId);
  pill.textContent = `${ph.emoji} S${w.index + 1}${w.deload ? ' 🔻' : ''}`;
}

tabbar.querySelectorAll('.tab').forEach((b) => {
  b.onclick = () => { location.hash = '#' + b.dataset.route; };
});

window.addEventListener('hashchange', route);
window.addEventListener('state-changed', () => {
  // ne re-render que la pastille pour ne pas casser les formulaires en cours
  paintPhasePill();
});

route();

/* Service worker (hors-ligne) — ignoré silencieusement en dev sans HTTPS */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
