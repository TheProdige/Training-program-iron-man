/* IRONFORGE — données & constantes du domaine.
   Tout est paramétrable ici : phases, exercices maison, zones, exigences Ironman. */

export const APP_VERSION = 2;

/* ---------- Macrocycle : échafaudage flexible (réécrit par la revue hebdo) ---------- */
// Proportions sur la durée totale (par défaut 48 semaines). Le moteur répartit dessus.
export const PHASES = [
  { id: 'test',     name: 'Semaine 0 — Tests',        emoji: '🧪', share: 0.02, focus: 'Mesurer la ligne de base', priorities: ['test'] },
  { id: 'hyper',    name: 'Hypertrophie + Base',      emoji: '💪', share: 0.26, focus: 'Construire du muscle, endurance facile (Z2)', priorities: ['muscle', 'aerobic-base'] },
  { id: 'strength', name: 'Force + Montée aérobie',   emoji: '🏋️', share: 0.24, focus: 'Convertir en force, monter volume + seuil', priorities: ['strength', 'aerobic-build', 'threshold'] },
  { id: 'specific', name: 'Ironman — Spécifique',     emoji: '🔴', share: 0.32, focus: 'Volume endurance + bricks, muscu en maintien lourd', priorities: ['endurance', 'maintain-muscle'] },
  { id: 'peak',     name: 'Pic & Affûtage',           emoji: '🎯', share: 0.10, focus: 'Allures de course, taper, arriver frais', priorities: ['race-pace', 'taper'] },
  { id: 'transition', name: 'Transition / Récup',     emoji: '♻️', share: 0.06, focus: 'Repos actif, on repart ensuite', priorities: ['recovery'] }
];

/* ---------- Bibliothèque d'exercices maison (haltères / KB / banc / barre traction) ---------- */
export const EXERCISES = {
  push:  [ 'Développé couché haltères', 'Développé incliné haltères', 'Développé militaire haltères', 'Pompes (lestées si besoin)', 'Dips entre 2 appuis' ],
  pull:  [ 'Tractions', 'Rowing haltère un bras', 'Rowing penché haltères', 'Curl biceps haltères', 'Face pull élastique' ],
  legs:  [ 'Goblet squat', 'Fentes marchées haltères', 'Soulevé de terre roumain haltères', 'Hip thrust', 'Mollets debout' ],
  core:  [ 'Gainage planche', 'Gainage latéral', 'Hollow hold', 'Relevés de jambes', 'Pallof press élastique' ]
};

/* Séances muscu types selon la priorité de phase (full-body en base, split léger ensuite) */
export const STRENGTH_TEMPLATES = {
  hyper:    { scheme: '3-4 × 8-12', rir: '1-2', sessions: 3, note: 'Hypertrophie : tempo contrôlé, congestion.' },
  strength: { scheme: '4-5 × 4-6',  rir: '1-2', sessions: 3, note: 'Force : charges lourdes, repos longs.' },
  specific: { scheme: '3 × 4-6',    rir: '2-3', sessions: 2, note: 'Maintien lourd : peu de volume, on garde la force sans fatigue.' },
  peak:     { scheme: '2 × 5',      rir: '3',   sessions: 1, note: 'Entretien léger pendant le taper.' }
};

/* ---------- Zones d'endurance ---------- */
// % de FTP (puissance vélo) — modèle de Coggan simplifié
export const POWER_ZONES = [
  { z: 'Z1', label: 'Récup',    lo: 0.00, hi: 0.55 },
  { z: 'Z2', label: 'Endurance', lo: 0.56, hi: 0.75 },
  { z: 'Z3', label: 'Tempo',    lo: 0.76, hi: 0.90 },
  { z: 'Z4', label: 'Seuil',    lo: 0.91, hi: 1.05 },
  { z: 'Z5', label: 'VO2max',   lo: 1.06, hi: 1.20 }
];

/* ---------- Exigences pour FINIR un Ironman (cibles « finisher » prudentes) ---------- */
// Sert à l'analyse du maillon faible. Ajustable.
export const IM_TARGETS = {
  ftpWkg: 2.8,            // W/kg utile pour rouler 180 km sans exploser
  run5kSec: 24 * 60,      // base de vitesse course (5 km en ~24 min ou mieux)
  swimCss100Sec: 130,     // allure seuil nage ~2:10/100m ou mieux
  longRideMin: 300,       // savoir tenir ~5h de vélo en phase spécifique
  longRunMin: 150         // savoir tenir ~2h30 de course
};

/* ---------- Nutrition ---------- */
export const NUTRITION = {
  proteinGPerLb: 0.9,           // ~2 g/kg
  // multiplicateur calorique selon la priorité de phase (sur la maintenance)
  kcalPhaseFactor: { hyper: 1.12, strength: 1.05, specific: 1.0, peak: 1.02, transition: 1.0, test: 1.0 },
  carbsPerEnduranceHour: 60,    // g de glucides ajoutés par heure d'endurance planifiée
  fatMinGPerLb: 0.3
};

export const RPE_HELP = 'RPE = effort perçu /10. 4-5 = facile, tu discutes (Z2). 8 = dur. 10 = max.';

/* ---------- Templates de semaine (jours 0=Lun … 6=Dim) selon priorité de phase ---------- */
// Chaque entrée : type de séance + intention. Le moteur chiffre selon tes repères.
export const WEEK_TEMPLATES = {
  hyper: [
    { type: 'strength', tag: 'A', intent: 'Full-body A' },
    { type: 'bike', zone: 'Z2', intent: 'Vélo facile' },
    { type: 'strength', tag: 'B', intent: 'Full-body B' },
    { type: 'swim', intent: 'Technique + endurance' },
    { type: 'run', zone: 'Z2', intent: 'Course facile' },
    { type: 'bike', zone: 'Z2', intent: 'Sortie longue facile', long: true },
    { type: 'rest', intent: 'Repos / marche' }
  ],
  strength: [
    { type: 'strength', tag: 'A', intent: 'Force bas du corps' },
    { type: 'bike', zone: 'Z4', intent: 'Vélo seuil (intervalles)' },
    { type: 'strength', tag: 'B', intent: 'Force haut du corps' },
    { type: 'run', zone: 'Z3', intent: 'Course tempo' },
    { type: 'swim', intent: 'Endurance' },
    { type: 'bike', zone: 'Z2', intent: 'Sortie longue', long: true },
    { type: 'rest', intent: 'Repos' }
  ],
  specific: [
    { type: 'swim', intent: 'Seuil nage' },
    { type: 'bike', zone: 'Z4', intent: 'Vélo intervalles' },
    { type: 'strength', tag: 'M', intent: 'Maintien lourd' },
    { type: 'run', zone: 'Z3', intent: 'Course tempo' },
    { type: 'bike', zone: 'Z2', intent: 'Vélo facile' },
    { type: 'brick', intent: 'Vélo long + transition course', long: true },
    { type: 'run', zone: 'Z2', intent: 'Course longue', long: true }
  ],
  peak: [
    { type: 'swim', intent: 'Allure course' },
    { type: 'bike', zone: 'Z3', intent: 'Allure course (court)' },
    { type: 'run', zone: 'Z3', intent: 'Allure course (court)' },
    { type: 'strength', tag: 'M', intent: 'Entretien léger' },
    { type: 'rest', intent: 'Repos' },
    { type: 'brick', intent: 'Brick court allure course', long: false },
    { type: 'rest', intent: 'Repos' }
  ],
  transition: [
    { type: 'rest', intent: 'Repos' },
    { type: 'bike', zone: 'Z2', intent: 'Vélo plaisir' },
    { type: 'strength', tag: 'A', intent: 'Muscu plaisir' },
    { type: 'rest', intent: 'Repos' },
    { type: 'run', zone: 'Z2', intent: 'Footing léger' },
    { type: 'bike', zone: 'Z2', intent: 'Sortie facile' },
    { type: 'rest', intent: 'Repos' }
  ],
  test: [
    { type: 'strength', tag: 'TEST', intent: 'Tests force + photos' },
    { type: 'bike', zone: 'TEST', intent: 'Test FTP 20 min' },
    { type: 'bike', zone: 'Z1', intent: 'Récup active' },
    { type: 'run', zone: 'TEST', intent: 'Test 5 km chrono' },
    { type: 'swim', intent: 'Test CSS (400+200)' },
    { type: 'bike', zone: 'Z2', intent: 'Sortie longue facile', long: true },
    { type: 'rest', intent: 'Repos + 1re revue' }
  ]
};

export const READINESS_QUESTIONS = [
  { key: 'sleep',    label: 'Sommeil', emojis: ['😴 mauvais', '😐 moyen', '🙂 correct', '😃 super'] },
  { key: 'soreness', label: 'Courbatures', emojis: ['🥵 fortes', '😣 moyennes', '🙂 légères', '💪 aucune'] },
  { key: 'energy',   label: 'Énergie', emojis: ['🪫 vide', '😐 basse', '🙂 ok', '⚡ pleine'] },
  { key: 'stress',   label: 'Stress', emojis: ['😫 élevé', '😕 moyen', '🙂 bas', '🧘 zen'] }
];
