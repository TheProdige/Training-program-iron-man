/* IRONFORGE — store local. État versionné dans localStorage, photos dans IndexedDB.
   Aucune donnée ne quitte l'appareil (sauf l'appel optionnel à l'API Claude). */
import { APP_VERSION } from './data.js';

const KEY = 'ironforge.state';

/* Ligne de base du propriétaire (issue de docs/INTAKE.md).
   L'app s'ouvre déjà configurée pour lui : il n'y a plus qu'à logger et ajuster.
   Les repères non encore mesurés (FTP, CSS, pompes, tractions…) sont laissés à null
   et seront remplis pendant la Semaine 0. Tout est modifiable dans l'écran Profil. */
function emptyState() {
  return {
    version: APP_VERSION,
    onboarded: true,
    profile: {
      name: '', age: 19, sex: 'H', heightCm: 175,
      weightLb: 140, goalWeightLb: 160, sleepNeed: 8,
      emphasis: 'balanced',                 // balanced | muscle | ironman
      startDate: todayISO(), raceDate: null, // raceDate null => 48 semaines
      units: { weight: 'lb', distance: 'km' }
    },
    benchmarks: {
      ftp: null, run5kSec: 1350, cssSec100: null,   // 5 km ≈ 22:30 (à reconfirmer en test)
      bench5rm: 135, squat5rm: null, maxPushups: null, maxPullups: null,
      restingHr: null, maxHr: null, updatedAt: null
    },
    equipment: { dumbbellMaxLb: null, kettlebells: '', benchIncline: true, homeTrainer: true, roadBike: true, poolPerWeek: 1, hasFitbit: false },
    logs: { sessions: [], nutrition: [], body: [], readiness: [], reviews: [] },
    settings: { coachApiKey: '', coachModel: 'claude-opus-4-8', theme: 'dark' }
  };
}

export function todayISO(d = new Date()) {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}

let _state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    return migrate(parsed);
  } catch (e) {
    console.warn('State illisible, réinitialisation.', e);
    return emptyState();
  }
}

function migrate(s) {
  // Fusion défensive avec le schéma courant (ajoute les clés manquantes).
  const base = emptyState();
  const merged = deepMerge(base, s);
  merged.version = APP_VERSION;
  return merged;
}

function deepMerge(base, over) {
  if (Array.isArray(base)) return Array.isArray(over) ? over : base;
  if (base && typeof base === 'object') {
    const out = { ...base };
    for (const k of Object.keys(base)) {
      if (over && k in over) out[k] = deepMerge(base[k], over[k]);
    }
    // garde les clés supplémentaires éventuelles d'over (ex: futures)
    for (const k of Object.keys(over || {})) if (!(k in out)) out[k] = over[k];
    return out;
  }
  return over === undefined ? base : over;
}

export function getState() { return _state; }

export function save() {
  localStorage.setItem(KEY, JSON.stringify(_state));
  window.dispatchEvent(new CustomEvent('state-changed'));
}

export function update(fn) {
  fn(_state);
  save();
}

export function resetAll() {
  _state = emptyState();
  save();
}

/* ---------- Helpers d'ajout de logs ---------- */
export function addSession(session) {
  session.id = session.id || crypto.randomUUID();
  _state.logs.sessions.push(session);
  save();
}
export function addNutrition(entry) {
  // une entrée par jour : on remplace si même date
  _state.logs.nutrition = _state.logs.nutrition.filter((n) => n.date !== entry.date);
  _state.logs.nutrition.push(entry);
  save();
}
export function addBody(entry) {
  _state.logs.body = _state.logs.body.filter((b) => b.date !== entry.date);
  _state.logs.body.push(entry);
  save();
}
export function setReadiness(entry) {
  _state.logs.readiness = _state.logs.readiness.filter((r) => r.date !== entry.date);
  _state.logs.readiness.push(entry);
  save();
}
export function saveReview(review) {
  _state.logs.reviews = _state.logs.reviews.filter((r) => r.weekIndex !== review.weekIndex);
  _state.logs.reviews.push(review);
  save();
}

/* ---------- Export / import ---------- */
export function exportJSON() {
  return JSON.stringify(_state, null, 2);
}
export function importJSON(text) {
  const parsed = JSON.parse(text);
  _state = migrate(parsed);
  save();
}

/* ---------- Photos (IndexedDB) ---------- */
const DB_NAME = 'ironforge-photos';
function idb() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('photos', { keyPath: 'id' });
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
export async function addPhoto(blob, label) {
  const db = await idb();
  const id = crypto.randomUUID();
  await new Promise((res, rej) => {
    const tx = db.transaction('photos', 'readwrite');
    tx.objectStore('photos').put({ id, date: todayISO(), label: label || '', blob });
    tx.oncomplete = res; tx.onerror = () => rej(tx.error);
  });
  return id;
}
export async function listPhotos() {
  const db = await idb();
  return new Promise((res, rej) => {
    const tx = db.transaction('photos', 'readonly');
    const req = tx.objectStore('photos').getAll();
    req.onsuccess = () => res(req.result.sort((a, b) => a.date.localeCompare(b.date)));
    req.onerror = () => rej(req.error);
  });
}
export async function deletePhoto(id) {
  const db = await idb();
  await new Promise((res, rej) => {
    const tx = db.transaction('photos', 'readwrite');
    tx.objectStore('photos').delete(id);
    tx.oncomplete = res; tx.onerror = () => rej(tx.error);
  });
}
