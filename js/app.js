// app.js — bootstrap : routeur, navigation par onglets, service worker.
import { mount } from './views.js';

function go(route) {
  mount(route);
  try { history.replaceState({ route }, '', '#' + route); } catch {}
}

document.getElementById('tabbar').addEventListener('click', (e) => {
  const btn = e.target.closest('.tab');
  if (btn) go(btn.dataset.route);
});

// Démarrage
const initial = (location.hash || '#today').slice(1);
go(['today', 'plan', 'coach', 'log', 'progress', 'profile'].includes(initial) ? initial : 'today');

// Service worker (mode installable + hors-ligne)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((err) => console.warn('SW non enregistré', err));
  });
}
