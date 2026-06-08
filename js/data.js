// data.js — base de connaissances entraînement : bibliothèque d'exercices,
// templates de séances muscu, macrocycle (phases) et templates hebdomadaires,
// calcul des zones d'intensité. Tout est piloté par la science de l'entraînement
// concurrent (gestion de l'interférence muscu/endurance).

// ----------------------------------------------------------------------------
// 1) TEMPLATES MUSCU
//   Chaque exo : { name, sets, rep:[min,max], main?:true, note? }
//   `main:true` => mouvement principal suivi pour la surcharge progressive / 1RM.
// ----------------------------------------------------------------------------
export const LIFT_TEMPLATES = {
  upperA: {
    title: 'Haut du corps A — Poussée (hypertrophie)',
    exercises: [
      { name: 'Développé couché', sets: 4, rep: [6, 8], main: true },
      { name: 'Développé militaire', sets: 3, rep: [8, 10] },
      { name: 'Développé incliné haltères', sets: 3, rep: [10, 12] },
      { name: 'Dips', sets: 3, rep: [10, 12] },
      { name: 'Élévations latérales', sets: 3, rep: [12, 15] },
      { name: 'Extensions triceps poulie', sets: 3, rep: [12, 15] }
    ]
  },
  upperB: {
    title: 'Haut du corps B — Tirage (hypertrophie)',
    exercises: [
      { name: 'Tractions/Tirage', sets: 4, rep: [6, 10], main: true },
      { name: 'Rowing barre', sets: 4, rep: [8, 10] },
      { name: 'Tirage horizontal', sets: 3, rep: [10, 12] },
      { name: 'Face pull', sets: 3, rep: [15, 20] },
      { name: 'Curl barre', sets: 3, rep: [10, 12] },
      { name: 'Curl incliné haltères', sets: 3, rep: [12, 15] }
    ]
  },
  lowerA: {
    title: 'Bas du corps A — Squat (hypertrophie)',
    exercises: [
      { name: 'Squat', sets: 4, rep: [6, 8], main: true },
      { name: 'Presse à cuisses', sets: 3, rep: [10, 12] },
      { name: 'Leg curl', sets: 3, rep: [10, 12] },
      { name: 'Mollets debout', sets: 4, rep: [12, 15] },
      { name: 'Gainage', sets: 3, rep: [45, 60], note: 'secondes' }
    ]
  },
  lowerB: {
    title: 'Bas du corps B — Chaîne postérieure (hypertrophie)',
    exercises: [
      { name: 'Soulevé de terre', sets: 4, rep: [5, 6], main: true },
      { name: 'Hip thrust', sets: 3, rep: [8, 10] },
      { name: 'Fentes marchées', sets: 3, rep: [10, 12] },
      { name: 'Leg extension', sets: 3, rep: [12, 15] },
      { name: 'Mollets assis', sets: 4, rep: [15, 20] }
    ]
  },
  upperStrength: {
    title: 'Haut du corps — Force',
    exercises: [
      { name: 'Développé couché', sets: 5, rep: [4, 6], main: true },
      { name: 'Tractions/Tirage', sets: 4, rep: [5, 7], main: true },
      { name: 'Développé militaire', sets: 4, rep: [5, 7] },
      { name: 'Rowing barre', sets: 4, rep: [6, 8] },
      { name: 'Accessoires bras', sets: 2, rep: [10, 12] }
    ]
  },
  lowerStrength: {
    title: 'Bas du corps — Force',
    exercises: [
      { name: 'Squat', sets: 5, rep: [4, 6], main: true },
      { name: 'Soulevé de terre', sets: 3, rep: [3, 5], main: true },
      { name: 'Presse à cuisses', sets: 3, rep: [8, 10] },
      { name: 'Mollets debout', sets: 4, rep: [10, 12] }
    ]
  },
  fullStrength: {
    title: 'Full-body — Force',
    exercises: [
      { name: 'Squat', sets: 4, rep: [4, 6], main: true },
      { name: 'Développé couché', sets: 4, rep: [4, 6], main: true },
      { name: 'Tractions/Tirage', sets: 4, rep: [6, 8], main: true },
      { name: 'Développé militaire', sets: 3, rep: [6, 8] }
    ]
  },
  upperMaint: {
    title: 'Haut du corps — Maintien (lourd, peu de volume)',
    exercises: [
      { name: 'Développé couché', sets: 3, rep: [4, 6], main: true },
      { name: 'Tractions/Tirage', sets: 3, rep: [5, 7], main: true },
      { name: 'Développé militaire', sets: 2, rep: [6, 8] }
    ]
  },
  lowerMaint: {
    title: 'Bas du corps — Maintien (lourd, peu de volume)',
    exercises: [
      { name: 'Squat', sets: 3, rep: [4, 6], main: true },
      { name: 'Soulevé de terre', sets: 2, rep: [3, 5], main: true },
      { name: 'Mollets debout', sets: 3, rep: [12, 15] }
    ]
  },
  fullLight: {
    title: 'Full-body — Maintien léger (affûtage)',
    exercises: [
      { name: 'Squat', sets: 2, rep: [5, 5], note: 'léger, explosif' },
      { name: 'Développé couché', sets: 2, rep: [5, 5], note: 'léger, explosif' },
      { name: 'Tractions/Tirage', sets: 2, rep: [6, 8] },
      { name: 'Mobilité + gainage', sets: 3, rep: [45, 45], note: 'secondes' }
    ]
  }
};

// Mouvements principaux suivis pour les graphes 1RM
export const MAIN_LIFTS = ['Squat', 'Développé couché', 'Soulevé de terre', 'Développé militaire', 'Tractions/Tirage'];

// ----------------------------------------------------------------------------
// 2) MACROCYCLE — phases (semaines cibles, recalculées au prorata du temps réel
//    jusqu'à la course). Modèle "bodybuilding d'abord, puis bascule endurance".
// ----------------------------------------------------------------------------
export const PHASES = [
  {
    key: 'hypertrophy',
    name: 'Hypertrophie — Base',
    emphasis: 'Bodybuilding',
    targetWeeks: 12,
    focus: 'Construire du muscle. Endurance = base aérobie facile (Z2) pour ne pas freiner la prise de masse (effet d\'interférence).',
    color: '#e23636'
  },
  {
    key: 'strength',
    name: 'Force + Aérobie',
    emphasis: 'Équilibre',
    targetWeeks: 10,
    focus: 'Convertir le muscle en force, monter le volume aérobie et introduire le travail au seuil (FTP, tempo).',
    color: '#f0a020'
  },
  {
    key: 'specific',
    name: 'Triathlon — Spécifique',
    emphasis: 'Endurance',
    targetWeeks: 10,
    focus: 'Priorité endurance et spécificité course. Muscu réduite à 2x maintien lourd pour préserver la masse acquise.',
    color: '#3b82f6'
  },
  {
    key: 'peak',
    name: 'Pic & Affûtage',
    emphasis: 'Course',
    targetWeeks: 8,
    focus: 'Allures de course, réduction du volume (taper) pour arriver frais et affûté le jour J.',
    color: '#a371f7'
  }
];

// ----------------------------------------------------------------------------
// 3) TEMPLATES HEBDO par phase (5 jours d'entraînement, 2 repos)
//   jours indexés 0=Lun ... 6=Dim. Chaque jour = tableau de séances.
//   Séance muscu : { kind:'lift', t:'<cle template>' }
//   Séance endurance : { kind:'swim|bike|run|brick', focus, zone, dur }  (dur = minutes base)
//   Repos : { kind:'rest' }
//   Les doubles séances (muscu + endurance le même jour) sont à idéalement
//   espacer (matin/soir) pour limiter l'interférence.
// ----------------------------------------------------------------------------
export const WEEK_TEMPLATES = {
  hypertrophy: [
    [{ kind: 'lift', t: 'upperA' }, { kind: 'swim', focus: 'Technique + aérobie', zone: 'Z2', dur: 30 }], // Lun
    [{ kind: 'lift', t: 'lowerA' }],                                                                       // Mar
    [{ kind: 'rest' }],                                                                                    // Mer
    [{ kind: 'lift', t: 'upperB' }, { kind: 'bike', focus: 'Base aérobie', zone: 'Z2', dur: 45 }],         // Jeu
    [{ kind: 'lift', t: 'lowerB' }, { kind: 'run', focus: 'Footing facile', zone: 'Z2', dur: 30 }],        // Ven
    [{ kind: 'rest' }],                                                                                     // Sam
    [{ kind: 'bike', focus: 'Sortie longue facile (alterne vélo/course)', zone: 'Z2', dur: 75 }]           // Dim
  ],
  strength: [
    [{ kind: 'lift', t: 'upperStrength' }, { kind: 'swim', focus: 'Aérobie + CSS', zone: 'Z2', dur: 35 }], // Lun
    [{ kind: 'bike', focus: 'Intervalles FTP', zone: 'Z4', dur: 60 }],                                     // Mar
    [{ kind: 'rest' }],                                                                                     // Mer
    [{ kind: 'lift', t: 'lowerStrength' }, { kind: 'run', focus: 'Tempo au seuil', zone: 'Z3', dur: 40 }], // Jeu
    [{ kind: 'rest' }],                                                                                     // Ven
    [{ kind: 'lift', t: 'fullStrength' }, { kind: 'swim', focus: 'Endurance', zone: 'Z2', dur: 30 }],      // Sam
    [{ kind: 'brick', focus: 'Sortie longue + transition course', zone: 'Z2', dur: 100 }]                  // Dim
  ],
  specific: [
    [{ kind: 'lift', t: 'upperMaint' }, { kind: 'swim', focus: 'CSS + technique', zone: 'Z3', dur: 40 }],  // Lun
    [{ kind: 'bike', focus: 'Sweet-spot / FTP', zone: 'Z4', dur: 80 }],                                    // Mar
    [{ kind: 'rest' }],                                                                                     // Mer
    [{ kind: 'run', focus: 'Intervalles au seuil', zone: 'Z4', dur: 55 }],                                 // Jeu
    [{ kind: 'lift', t: 'lowerMaint' }, { kind: 'swim', focus: 'Endurance allure course', zone: 'Z2', dur: 35 }], // Ven
    [{ kind: 'rest' }],                                                                                     // Sam
    [{ kind: 'brick', focus: 'Brick long : vélo long + course', zone: 'Z2', dur: 120 }]                    // Dim
  ],
  peak: [
    [{ kind: 'lift', t: 'fullLight' }, { kind: 'swim', focus: 'Allure course + aisance', zone: 'Z3', dur: 30 }], // Lun
    [{ kind: 'bike', focus: 'Efforts allure course', zone: 'Z3', dur: 60 }],                               // Mar
    [{ kind: 'rest' }],                                                                                     // Mer
    [{ kind: 'run', focus: 'Allure course + lignes', zone: 'Z3', dur: 40 }, { kind: 'swim', focus: 'Récup active', zone: 'Z2', dur: 25 }], // Jeu
    [{ kind: 'rest' }],                                                                                     // Ven
    [{ kind: 'lift', t: 'fullLight' }, { kind: 'swim', focus: 'Aisance', zone: 'Z2', dur: 20 }],           // Sam
    [{ kind: 'brick', focus: 'Brick modéré (réduit en affûtage)', zone: 'Z2', dur: 90 }]                   // Dim
  ]
};

export const DAY_NAMES = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
export const DAY_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

export const DISCIPLINE_ICON = { lift: '🏋️', swim: '🏊', bike: '🚴', run: '🏃', brick: '🔁', rest: '😴' };
export const DISCIPLINE_LABEL = { lift: 'Muscu', swim: 'Natation', bike: 'Vélo', run: 'Course', brick: 'Brick', rest: 'Repos' };

// ----------------------------------------------------------------------------
// 4) ZONES D'INTENSITÉ — calculées depuis les repères de l'athlète.
// ----------------------------------------------------------------------------
export function paceStr(secPerKm) {
  if (!secPerKm || secPerKm <= 0) return '—';
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, '0')}/km`;
}

// Facteur d'intensité (% du seuil) par zone — sert au load et aux prescriptions.
const ZONE_FACTORS = { Z1: 0.5, Z2: 0.68, Z3: 0.85, Z4: 1.0, Z5: 1.12 };
export function zoneFactor(zone) { return ZONE_FACTORS[zone] ?? 0.7; }

export function bikeZone(zone, ftp) {
  const f = { Z2: [0.56, 0.75], Z3: [0.76, 0.90], Z4: [0.91, 1.05], Z5: [1.06, 1.20] }[zone] || [0.56, 0.75];
  return `${Math.round(ftp * f[0])}–${Math.round(ftp * f[1])} W`;
}
export function runZonePace(zone, thr) {
  // allure plus lente = sec/km plus grand ; on part du seuil.
  const f = { Z2: [1.25, 1.15], Z3: [1.10, 1.04], Z4: [1.02, 0.98], Z5: [0.97, 0.93] }[zone] || [1.25, 1.15];
  return `${paceStr(thr * f[0])} → ${paceStr(thr * f[1])}`;
}
export function swimZonePace(zone, css) {
  const f = { Z2: [1.12, 1.06], Z3: [1.05, 1.01], Z4: [1.0, 0.97], Z5: [0.96, 0.93] }[zone] || [1.12, 1.06];
  return `${paceStr(css * f[0])} → ${paceStr(css * f[1])} (/100m)`;
}
export function hrZone(zone, maxHr, restHr) {
  // Karvonen : %réserve FC. Z2 60-70%, Z3 70-80%, Z4 80-90%, Z5 90-100%.
  const f = { Z2: [0.60, 0.70], Z3: [0.70, 0.80], Z4: [0.80, 0.90], Z5: [0.90, 1.0] }[zone] || [0.60, 0.70];
  const r = maxHr - restHr;
  return `${Math.round(restHr + r * f[0])}–${Math.round(restHr + r * f[1])} bpm`;
}
