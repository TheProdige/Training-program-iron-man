// store.js — persistance locale (localStorage) + état de l'app.
// Tout reste sur l'appareil de l'utilisateur, rien n'est envoyé en ligne.

const KEY = 'ironforge.state.v1';

const DEFAULT_STATE = {
  version: 1,
  onboarded: false,
  startDate: null,                 // ISO date du début du programme
  profile: {
    name: '',
    bodyweightKg: 80,
    heightCm: 178,
    age: 28,
    sex: 'M',
    simpleMode: true,              // mode débutant : langage simple, pas de chiffres compliqués
    raceType: '70.3',              // '70.3' | 'full'
    raceDate: null,                // ISO
    daysPerWeek: 5,
    // Repères de performance (servent au calcul des zones / prescriptions)
    metrics: {
      ftpWatts: 200,               // puissance seuil vélo
      swimCss: 110,                // Critical Swim Speed en sec/100m
      runThreshold: 300,           // allure seuil course en sec/km
      maxHr: 190,
      restHr: 55
    },
    // 1RM (max théorique) des mouvements principaux, en kg
    lifts1rm: {
      'Squat': 100,
      'Développé couché': 80,
      'Soulevé de terre': 120,
      'Développé militaire': 50,
      'Tractions/Tirage': 70
    }
  },
  sessions: [],   // séances loggées : voir engine.logSession
  history: {},    // historique par exercice : { exoName: [{date, weight, reps, rpe, e1rm}] }
  coachChat: []   // historique de discussion avec le coach IA : [{role, content}]
};

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const parsed = JSON.parse(raw);
    return deepMerge(structuredClone(DEFAULT_STATE), parsed);
  } catch (e) {
    console.warn('Lecture state échouée, reset.', e);
    return structuredClone(DEFAULT_STATE);
  }
}

function deepMerge(base, over) {
  if (Array.isArray(over)) return over;
  if (over && typeof over === 'object') {
    const out = { ...base };
    for (const k of Object.keys(over)) {
      out[k] = (k in base) ? deepMerge(base[k], over[k]) : over[k];
    }
    return out;
  }
  return over === undefined ? base : over;
}

export function getState() { return state; }

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (e) { console.error('Sauvegarde échouée', e); }
}

export function update(mutator) {
  mutator(state);
  save();
  return state;
}

export function resetAll() {
  state = structuredClone(DEFAULT_STATE);
  save();
}

export function exportJSON() {
  return JSON.stringify(state, null, 2);
}

export function importJSON(text) {
  const parsed = JSON.parse(text);
  state = deepMerge(structuredClone(DEFAULT_STATE), parsed);
  save();
}
