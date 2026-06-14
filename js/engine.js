/* IRONFORGE — moteur adaptatif. Ne suppose rien : part de tes repères et s'ajuste.
   Tout est dérivé de l'état (store). Aucune dépendance externe. */
import {
  PHASES, WEEK_TEMPLATES, STRENGTH_TEMPLATES, POWER_ZONES,
  IM_TARGETS, NUTRITION, EXERCISES
} from './data.js';
import { todayISO } from './store.js';

/* ============ Dates ============ */
export function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return todayISO(d);
}
export function daysBetween(a, b) {
  return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
}
function mondayOf(iso) {
  const d = new Date(iso + 'T00:00:00');
  const dow = (d.getDay() + 6) % 7; // 0 = lundi
  return addDays(iso, -dow);
}

/* ============ Macrocycle ============ */
export function totalWeeks(state) {
  const { startDate, raceDate } = state.profile;
  if (raceDate) {
    const w = Math.ceil(daysBetween(startDate, raceDate) / 7);
    return Math.max(8, Math.min(72, w));
  }
  return 48;
}

// Construit la liste des semaines : phase + deload (1 semaine sur 4) + emphasis.
export function buildMacrocycle(state) {
  const weeks = totalWeeks(state);
  const out = [];
  // répartition des phases selon leur "share", emphasis ajuste muscle vs ironman
  const shares = phaseSharesForEmphasis(state.profile.emphasis);
  let acc = 0;
  const bounds = shares.map((s) => { acc += s.share; return { id: s.id, end: Math.round(acc * weeks) }; });
  for (let i = 0; i < weeks; i++) {
    const phase = bounds.find((b) => i < b.end) || bounds[bounds.length - 1];
    const inPhaseIndex = i - (bounds[bounds.findIndex((b) => b.id === phase.id) - 1]?.end || 0);
    const isDeload = phase.id !== 'test' && phase.id !== 'transition' && (inPhaseIndex % 4 === 3);
    out.push({ index: i, phaseId: phase.id, deload: isDeload, startDate: addDays(mondayOf(state.profile.startDate), i * 7) });
  }
  return out;
}

function phaseSharesForEmphasis(emphasis) {
  const base = PHASES.map((p) => ({ id: p.id, share: p.share }));
  if (emphasis === 'muscle') {
    bump(base, 'hyper', +0.06); bump(base, 'strength', +0.04); bump(base, 'specific', -0.10);
  } else if (emphasis === 'ironman') {
    bump(base, 'hyper', -0.06); bump(base, 'specific', +0.08); bump(base, 'peak', -0.02);
  }
  const sum = base.reduce((s, p) => s + p.share, 0);
  base.forEach((p) => p.share /= sum); // normalise
  return base;
}
function bump(arr, id, d) { const x = arr.find((a) => a.id === id); if (x) x.share = Math.max(0.02, x.share + d); }

export function currentWeek(state, iso = todayISO()) {
  const cycle = buildMacrocycle(state);
  const idx = Math.floor(daysBetween(mondayOf(state.profile.startDate), iso) / 7);
  return cycle[Math.max(0, Math.min(cycle.length - 1, idx))];
}
export function phaseInfo(phaseId) { return PHASES.find((p) => p.id === phaseId) || PHASES[0]; }

/* ============ Zones d'endurance ============ */
export function powerZone(ftp, watts) {
  if (!ftp || !watts) return null;
  const f = watts / ftp;
  return POWER_ZONES.find((z) => f >= z.lo && f <= z.hi) || POWER_ZONES[POWER_ZONES.length - 1];
}
export function powerForZone(ftp, zName) {
  const z = POWER_ZONES.find((x) => x.z === zName);
  if (!ftp || !z) return null;
  return { lo: Math.round(ftp * z.lo), hi: Math.round(ftp * z.hi) };
}
export function fmtPace(secPerKm) {
  if (!secPerKm) return '—';
  const m = Math.floor(secPerKm / 60), s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, '0')}/km`;
}
// allure seuil course estimée depuis le 5 km (le 5 km ~ allure seuil + ~3%)
export function thresholdPaceFrom5k(run5kSec) {
  if (!run5kSec) return null;
  return (run5kSec / 5) * 1.04;
}

/* ============ Charge & ACWR ============ */
// sRPE : durée (min) × RPE. Pour la muscu sans durée endurance, on estime.
export function sessionLoad(s) {
  const rpe = s.rpe || 6;
  const dur = s.durationMin || (s.type === 'strength' ? 45 : 45);
  return Math.round(dur * rpe);
}
export function dailyLoad(sessions, iso) {
  return sessions.filter((s) => s.date === iso).reduce((sum, s) => sum + sessionLoad(s), 0);
}
export function acwr(sessions, iso = todayISO(), types = null) {
  const pool = types ? sessions.filter((s) => types.includes(s.type)) : sessions;
  let acute = 0, chronic = 0;
  for (let i = 0; i < 28; i++) {
    const d = addDays(iso, -i);
    const load = dailyLoad(pool, d);
    chronic += load;
    if (i < 7) acute += load;
  }
  const acuteAvg = acute / 7;
  const chronicAvg = chronic / 28;
  const ratio = chronicAvg > 0 ? acuteAvg / chronicAvg : 0;
  return { ratio: round1(ratio), acuteAvg: Math.round(acuteAvg), chronicAvg: Math.round(chronicAvg) };
}
export function acwrFlag(ratio) {
  if (!ratio) return { level: 'na', msg: 'Pas encore assez de données.' };
  if (ratio > 1.5) return { level: 'high', msg: '⚠️ Charge en hausse rapide — risque de blessure. On consolide.' };
  if (ratio > 1.3) return { level: 'watch', msg: '🟠 Montée soutenue — surveille la récup.' };
  if (ratio < 0.8) return { level: 'low', msg: '🔵 Charge basse — on peut repousser un peu.' };
  return { level: 'ok', msg: '🟢 Charge bien équilibrée.' };
}

/* ============ Autorégulation : score de readiness + directive ============ */
// Fusionne bien-être + sommeil + charge + FC repos en un score 0-100.
export function readinessScore(state, r) {
  if (!r) return null;
  const need = state.profile.sleepNeed || 8;
  const wkeys = ['sleepQual', 'soreness', 'energy', 'mood', 'stress', 'motivation'];
  const present = wkeys.filter((k) => r[k] != null);
  const wellness = present.length ? present.reduce((s, k) => s + r[k], 0) / (present.length * 3) : 0.66;
  const sh = r.sleepHours != null ? Math.min(1, r.sleepHours / need) : 0.8;
  const a = acwr(state.logs.sessions, r.date);
  let load = 1;
  if (a.ratio) { if (a.ratio > 1.5) load = 0.5; else if (a.ratio > 1.3) load = 0.75; else if (a.ratio < 0.8) load = 0.9; }
  let rhrComp = null;
  const base = state.benchmarks.restingHr;
  if (r.rhr != null && base) { const d = r.rhr - base; rhrComp = d <= 0 ? 1 : d < 5 ? 0.85 : d < 10 ? 0.65 : 0.45; }
  const wW = 0.5, wS = 0.25, wL = 0.15, wR = 0.10;
  let score;
  if (rhrComp == null) { const tot = wW + wS + wL; score = (wW * wellness + wS * sh + wL * load) / tot; }
  else score = wW * wellness + wS * sh + wL * load + wR * rhrComp;
  return Math.round(Math.max(0, Math.min(1, score)) * 100);
}

export function directiveFor(score, deload) {
  let d;
  if (score == null) d = { label: 'Vas-y normal', emoji: '🟡', mult: 1, level: 'ok', advice: 'Pas de check ce matin — séance comme prévu.' };
  else if (score >= 80) d = { label: 'Pousse', emoji: '🟢', mult: 1.05, level: 'push', advice: 'Tu es frais : ajoute une série ou allonge un peu la sortie longue.' };
  else if (score >= 65) d = { label: 'Vas-y normal', emoji: '🟡', mult: 1.0, level: 'ok', advice: 'Séance comme prévu, exécution propre et appliquée.' };
  else if (score >= 50) d = { label: 'Allège', emoji: '🟠', mult: 0.85, level: 'ease', advice: 'Baisse le volume/intensité ~20 %. On consolide aujourd\'hui.' };
  else d = { label: 'Récupère', emoji: '🔴', mult: 0.7, level: 'recover', advice: 'Récup active ou très facile. Le repos fait partie de l\'entraînement.' };
  if (deload) { if (d.mult > 1) { d.mult = 1; d.label = 'Vas-y normal'; d.emoji = '🟡'; } d.mult = Math.min(d.mult, 0.85); }
  return d;
}

export function readinessMultiplier(r, state) {
  if (state) { const sc = readinessScore(state, r); if (sc != null) return directiveFor(sc, false).mult; }
  if (!r) return 1;
  const vals = ['sleepQual', 'sleep', 'soreness', 'energy', 'stress'].map((k) => r[k]).filter((x) => x != null);
  if (!vals.length) return 1;
  const avg = vals.reduce((a, b) => a + b, 0) / (vals.length * 3);
  return round2(0.65 + avg * 0.4);
}

/* Alertes croisées proactives. */
function lastN(arr, iso, n) { const from = addDays(iso, -(n - 1)); return arr.filter((x) => x.date >= from && x.date <= iso); }
export function insights(state, iso = todayISO()) {
  const out = [];
  const need = state.profile.sleepNeed || 8;
  const sl = lastN(state.logs.readiness, iso, 7).map((r) => r.sleepHours).filter((x) => x != null);
  if (sl.length >= 3) { const avg = sl.reduce((a, b) => a + b, 0) / sl.length; if (avg < need - 0.5) out.push({ level: 'warn', icon: '😴', msg: `Dette de sommeil : ${avg.toFixed(1)} h/nuit en moyenne (besoin ${need} h). Priorise le coucher.` }); }
  const a = acwr(state.logs.sessions, iso);
  if (a.ratio > 1.4) out.push({ level: 'high', icon: '⚠️', msg: `Charge en hausse rapide (ACWR ${a.ratio}) : risque de blessure, on consolide.` });
  else if (a.ratio && a.ratio < 0.9) out.push({ level: 'info', icon: '🔵', msg: `Charge basse (ACWR ${a.ratio}) — tu as de la marge pour pousser un peu.` });
  // Garde-fou course : c'est la discipline la plus traumatisante (tibias/tendons).
  // On la surveille à part, car un ACWR global « ok » peut masquer une course qui monte trop vite.
  const ra = acwr(state.logs.sessions, iso, ['run', 'brick']);
  if (ra.ratio > 1.4 && ra.acuteAvg > 0) out.push({ level: 'high', icon: '🏃', msg: `Charge de COURSE en hausse rapide (ACWR course ${ra.ratio}) : c'est ta discipline la plus traumatisante. Ralentis la montée du volume de course même si le reste va bien (règle des +10%/sem max).` });
  const nut = lastN(state.logs.nutrition, iso, 3); const t = nutritionTarget(state, iso);
  if (nut.length >= 2 && t) { const avgP = nut.reduce((s, n) => s + (n.protein || 0), 0) / nut.length; if (avgP < t.proteinG * 0.8) out.push({ level: 'warn', icon: '🥩', msg: `Protéine basse (~${Math.round(avgP)} g/j vs ${t.proteinG} cible) : tu freines ta prise de muscle.` }); }
  const scores = lastN(state.logs.readiness, iso, 3).map((r) => readinessScore(state, r)).filter((x) => x != null);
  if (scores.length >= 3 && scores.every((s) => s < 55)) out.push({ level: 'high', icon: '🛑', msg: '3 jours de readiness basse : prends une vraie journée de récup, ce n\'est pas de la paresse.' });
  let allTrained = true;
  for (let i = 0; i < 7; i++) if (dailyLoad(state.logs.sessions, addDays(iso, -i)) === 0) allTrained = false;
  if (allTrained) out.push({ level: 'warn', icon: '🔁', msg: '7 jours d\'affilée sans repos complet : insère une journée off pour surcompenser.' });
  return out;
}

/* ============ Séance du jour ============ */
export function todayPlan(state, iso = todayISO()) {
  const week = currentWeek(state, iso);
  const phase = phaseInfo(week.phaseId);
  const tplKey = WEEK_TEMPLATES[week.phaseId] ? week.phaseId : 'hyper';
  const tpl = WEEK_TEMPLATES[tplKey];
  const dow = (new Date(iso + 'T00:00:00').getDay() + 6) % 7; // 0=lundi
  const slot = tpl[dow];
  const readiness = state.logs.readiness.find((r) => r.date === iso);
  const score = readinessScore(state, readiness);
  const dir = directiveFor(score, week.deload);
  const mult = dir.mult;

  const detail = buildSessionDetail(state, slot, { mult, deload: week.deload });
  return { week, phase, slot, detail, mult, deload: week.deload, readinessScore: score, directive: dir };
}

/* ---- paramètres de séance par phase ---- */
const PHASE_LIFT = {
  hyper:      { sets: 4, repLo: 8,  repHi: 12, rir: '1-2', rest: '75-90 s', tempo: '3-0-1 (descente lente, pas de rebond)', dur: 55, note: 'Hypertrophie : cherche la tension et la congestion, technique stricte sur toute l\'amplitude.' },
  strength:   { sets: 4, repLo: 4,  repHi: 6,  rir: '1-2', rest: '2-3 min', tempo: 'Explosif en poussée, contrôlé en descente', dur: 60, note: 'Force : charges lourdes, repos complets, reste explosif et propre.' },
  specific:   { sets: 3, repLo: 4,  repHi: 6,  rir: '2-3', rest: '2-3 min', tempo: 'Contrôlé', dur: 40, note: 'Maintien lourd : peu de volume, on garde la force sans accumuler de fatigue (l\'endurance prime).' },
  peak:       { sets: 2, repLo: 5,  repHi: 5,  rir: '3',   rest: '2 min',   tempo: 'Léger et propre', dur: 30, note: 'Entretien pendant l\'affûtage : touche les charges, reste frais.' },
  transition: { sets: 2, repLo: 8,  repHi: 12, rir: '3',   rest: '90 s',    tempo: 'Confort', dur: 40, note: 'Repos actif : bouge pour le plaisir, sans forcer.' }
};
// jours d'entraînement : références "groupe:index" dans EXERCISES
const STRENGTH_DAYS = {
  A: ['legs:0', 'push:0', 'pull:1', 'legs:2', 'push:2'],   // goblet squat, DC haltères, rowing 1 bras, SDT roumain, dév. militaire
  B: ['legs:1', 'pull:0', 'push:1', 'legs:3', 'pull:3'],   // fentes, tractions, dév. incliné, hip thrust, curl
  M: ['legs:0', 'push:0', 'pull:0']                        // maintien : squat, DC, tractions
};
const CORE_DAYS = { A: ['core:0', 'core:2'], B: ['core:1', 'core:4'], M: ['core:0'] };
const exo = (ref) => { const [g, i] = ref.split(':'); return EXERCISES[g][+i]; };

function buildSessionDetail(state, slot, { mult, deload }) {
  const b = state.benchmarks;
  const phaseId = currentWeek(state).phaseId;
  if (slot.type === 'rest') {
    return { title: slot.intent, focus: 'Récupération', durationMin: 0, blocks: [
      { label: 'Aujourd\'hui', items: [
        'Repos complet, ou marche facile 20-30 min.',
        'Mobilité douce 5-10 min (hanches, épaules, et ton cou : rotations lentes).',
        'Vise tes 8 h de sommeil — c\'est là que les adaptations se construisent.' ] }
    ], notes: [] };
  }
  if (slot.type === 'strength') {
    return slot.tag === 'TEST' ? strengthTestSession() : strengthSession(state, slot, phaseId, deload, mult);
  }
  return enduranceSession(state, slot, phaseId, deload, mult, b);
}

/* ===== Muscu détaillée ===== */
function strengthSession(state, slot, phaseId, deload, mult) {
  const t = PHASE_LIFT[phaseId] || PHASE_LIFT.hyper;
  const tag = STRENGTH_DAYS[slot.tag] ? slot.tag : (phaseId === 'specific' || phaseId === 'peak' ? 'M' : 'A');
  let sets = t.sets;
  if (deload) sets = Math.max(1, sets - 1);
  if (mult < 0.8 && tag !== 'M') sets = Math.max(2, sets - 1);

  const warm = { label: '🔥 Échauffement (~8 min)', items: [
    '5 min cardio léger (corde à sauter, rameur ou vélo) pour monter en température.',
    `Mobilité ciblée 3 min : ${tag === 'B' ? 'dorsaux, épaules, hanches' : 'hanches, chevilles, épaules'}.`,
    'Sur le 1er exercice : 2 séries d\'échauffement légères (8-10 reps) avant les séries lourdes.'
  ] };

  const mains = STRENGTH_DAYS[tag].map((ref) => {
    const name = exo(ref);
    const sugg = suggestStrength(state, name);
    const load = sugg ? `vise ${sugg} lb` : `charge où les dernières reps sont à RIR ${t.rir}`;
    return `${name} — ${sets} × ${t.repLo}-${t.repHi} · repos ${t.rest} · RIR ${t.rir} · ${load}`;
  });
  const main = { label: `💪 Corps de séance (tempo ${t.tempo})`, items: mains };

  const core = { label: '🧱 Gainage (finisher)', items:
    CORE_DAYS[tag].map((ref) => `${exo(ref)} — 3 × 30-45 s · repos 30 s`) };

  const notes = [t.note,
    'Progression : quand tu boucles le HAUT de la fourchette de reps sur toutes les séries à RIR ≤ 1, monte de 5 lb la prochaine fois.'];
  if (tag !== 'B') notes.push('⚠️ Ton cou : sur les développés, garde la nuque neutre, ne pousse pas la tête dans le banc. Stoppe au moindre pincement.');
  if (deload) notes.push('🔻 Semaine de deload : volume réduit, on garde la technique, pas l\'ego.');

  return { title: slot.intent, focus: phaseId === 'specific' ? 'Maintien de la force' : 'Muscle / force',
    durationMin: deload ? Math.round(t.dur * 0.8) : t.dur, blocks: [warm, main, core], notes };
}

function strengthTestSession() {
  return { title: 'Tests de force + photos', focus: 'Ligne de base', durationMin: 60, blocks: [
    { label: '🔥 Échauffement (~10 min)', items: ['Cardio léger 5 min + mobilité épaules/hanches/cou.', 'Quelques séries légères avant chaque test lourd.'] },
    { label: '📋 Tests', items: [
      'Max pompes : 1 série stricte jusqu\'à l\'échec → note le nombre.',
      'Max tractions : 1 série jusqu\'à l\'échec (ou négatives si 0) → note.',
      'Développé couché haltères : monte jusqu\'à un 5RM propre (RIR 1-2) → note la charge.',
      'Goblet squat (ou fentes) : trouve un 5RM contrôlé → note.' ] },
    { label: '📐 Mesures', items: ['Poids + tour de taille, bras, poitrine, cuisse.', 'Photos face / profil / dos (même lumière, mêmes repères).'] }
  ], notes: ['On ne cherche pas le record absolu : un effort propre et répétable. Ces chiffres calibrent tout le reste.'] };
}

/* ===== Endurance détaillée ===== */
function enduranceSession(state, slot, phaseId, deload, mult, b) {
  const dur = Math.round(enduranceDuration(state, slot, deload) * mult);

  if (slot.type === 'bike' && slot.zone === 'TEST') return ftpTest();
  if (slot.type === 'run' && slot.zone === 'TEST') return run5kTest();
  if (slot.type === 'swim' && /test|css/i.test(slot.intent)) return cssTest();

  if (slot.type === 'bike') return bikeSession(slot, dur, b, phaseId, deload);
  if (slot.type === 'run') return runSession(slot, dur, b, phaseId, deload);
  if (slot.type === 'swim') return swimSession(dur, b, phaseId, deload, slot);
  if (slot.type === 'brick') return brickSession(dur, b, slot);
  return { title: slot.intent, focus: 'Endurance', durationMin: dur, blocks: [{ label: 'Séance', items: [`${dur} min facile.`] }], notes: [] };
}

function bikeSession(slot, dur, b, phaseId, deload) {
  const pw2 = powerForZone(b.ftp, 'Z2');
  const z2txt = pw2 ? `${pw2.lo}-${pw2.hi} W` : 'RPE 4-5, tu peux tenir une conversation';
  const warm = { label: '🔥 Échauffement (10 min)', items: ['Montée progressive jusqu\'en Z2.', '3 × 20 s d\'accélérations souples (récup 40 s) pour réveiller les jambes.'] };
  const cool = { label: '🧊 Retour au calme', items: ['5-10 min très facile en Z1, respiration calme.'] };

  if (slot.zone === 'Z4') {
    const set = bikeThresholdSet(phaseId, deload, b.ftp);
    return { title: slot.intent, focus: 'Seuil (FTP)', durationMin: dur, blocks: [
      { label: '🔥 Échauffement (15 min)', items: ['Montée progressive + 3 × 1 min en montant vers le seuil (récup 1 min).'] },
      { label: '🎯 Bloc principal', items: [set, 'Cadence 85-95 rpm. Reste RÉGULIER : ne pars pas trop fort, tiens la puissance.'] },
      cool ], notes: ['Objectif : repousser ton FTP, le moteur de tout ton vélo Ironman.'] };
  }
  if (slot.zone === 'Z3') {
    const pw3 = powerForZone(b.ftp, 'Z3');
    return { title: slot.intent, focus: 'Tempo', durationMin: dur, blocks: [warm,
      { label: '🎯 Bloc principal', items: [`${Math.max(20, dur - 25)} min en continu Z3 ${pw3 ? `(${pw3.lo}-${pw3.hi} W)` : '(RPE 6-7, phrases courtes)'} — cadence 85-90 rpm.`] },
      cool ], notes: [] };
  }
  // Z1 / Z2 (endurance, sortie longue)
  const main = { label: '🎯 Bloc principal', items: [`${Math.max(20, dur - 15)} min en continu Z2 (${z2txt}) — cadence 85-95 rpm, fluide.`] };
  if (slot.long) main.items.push('Ravitaillement : bois toutes les 15-20 min ; ~60 g de glucides/h au-delà d\'1 h.', 'Reste DANS la zone : la discipline du facile, c\'est ce qui construit ton moteur aérobie.');
  return { title: slot.intent, focus: slot.long ? 'Endurance longue' : 'Base aérobie', durationMin: dur, blocks: [warm, main, cool], notes: [] };
}

function bikeThresholdSet(phaseId, deload, ftp) {
  const plan = ({ hyper: { reps: 3, work: 5, rec: 3 }, strength: { reps: 4, work: 6, rec: 3 }, specific: { reps: 5, work: 8, rec: 4 }, peak: { reps: 4, work: 4, rec: 3 } })[phaseId] || { reps: 4, work: 6, rec: 3 };
  let reps = plan.reps; if (deload) reps = Math.max(2, reps - 2);
  const pw = powerForZone(ftp, 'Z4');
  const target = pw ? `${pw.lo}-${pw.hi} W` : 'RPE 8 — dur mais soutenable';
  return `${reps} × ${plan.work} min en Z4 (${target}) — récup ${plan.rec} min facile entre chaque.`;
}

function runSession(slot, dur, b, phaseId, deload) {
  const thr = thresholdPaceFrom5k(b.run5kSec);
  const warm = { label: '🔥 Échauffement (10 min)', items: ['Footing très lent + mobilité chevilles/hanches.', '3-4 lignes droites en accélération progressive (80 m).'] };
  const cool = { label: '🧊 Retour au calme', items: ['5-10 min footing lent + étirements doux mollets/quadriceps.'] };

  if (slot.zone === 'Z3') {
    const pace = thr ? thr * 1.04 : null;
    const blocks = phaseId === 'specific'
      ? [`2 × 15 min à allure tempo${pace ? ` (~${fmtPace(pace)})` : ' (RPE 6-7)'} — récup 3 min footing lent.`]
      : [`${Math.max(15, dur - 20)} min en continu à allure tempo${pace ? ` (~${fmtPace(pace)})` : ' (RPE 6-7, phrases courtes)'}.`];
    return { title: slot.intent, focus: 'Tempo / seuil', durationMin: dur, blocks: [warm, { label: '🎯 Bloc principal', items: blocks }, cool], notes: ['Le tempo améliore ton allure soutenable sur le marathon de l\'Ironman.'] };
  }
  // Z2 / longue
  const pace = thr ? thr * 1.15 : null;
  const main = { label: '🎯 Bloc principal', items: [`${Math.max(20, dur - 15)} min en Z2${pace ? ` (~${fmtPace(pace)})` : ' (RPE 4-5, tu peux parler)'} — foulée légère, cadence ~170-180 ppm.`] };
  if (slot.long) main.items.push('Si besoin en début de bloc : alterne 9 min course / 1 min marche.', 'Ravitaille-toi (gel/boisson) au-delà de 75 min.');
  return { title: slot.intent, focus: slot.long ? 'Endurance longue' : 'Base aérobie', durationMin: dur, blocks: [warm, main, cool], notes: [] };
}

function swimSession(dur, b, phaseId, deload, slot) {
  const css = b.cssSec100 ? Math.round(b.cssSec100) : null;
  const cssTxt = css ? `${fmtSec(css)}/100m` : 'allure soutenue mais contrôlée';
  const reps = ({ hyper: 6, strength: 8, specific: 10, peak: 6 })[phaseId] || 6;
  const r = deload ? Math.max(4, reps - 2) : reps;
  const isThreshold = /seuil/i.test(slot.intent);
  const main = isThreshold
    ? `${r} × 100 m à allure seuil (CSS ~${cssTxt}) — repos 20 s.`
    : `${r} × 100 m en aérobie souple (~CSS +8 s) — repos 15 s, technique nette.`;
  return { title: slot.intent, focus: 'Natation', durationMin: dur, blocks: [
    { label: '🔥 Échauffement', items: ['200-300 m easy en alternant crawl / dos.'] },
    { label: '🛠️ Éducatifs', items: ['4 × 50 m technique (rattrapé, poings fermés, 6 battements-3 mvts) — 15 s de repos.'] },
    { label: '🎯 Série principale', items: [main, css ? 'Cale ta vitesse sur l\'horloge, pas au feeling.' : 'Pas de chrono ? Reste régulier, expire dans l\'eau, roule les épaules.'] },
    { label: '🧊 Retour au calme', items: ['100-200 m easy, respiration ample.'] }
  ], notes: ['Pas de piscine ce jour ? Travail à sec 15-20 min : élastiques de nage (tirage crawl) + gainage + mobilité épaules.'] };
}

function brickSession(dur, b, slot) {
  const bike = Math.round(dur * 0.8), run = Math.max(15, dur - bike);
  const pw2 = powerForZone(b.ftp, 'Z2');
  const thr = thresholdPaceFrom5k(b.run5kSec);
  return { title: slot.intent, focus: 'Enchaînement vélo→course', durationMin: dur, blocks: [
    { label: '🚴 Vélo', items: [`${bike} min en Z2 ${pw2 ? `(${pw2.lo}-${pw2.hi} W)` : '(RPE 4-5)'} — garde des jambes pour la course.`] },
    { label: '🔁 Transition (T2)', items: ['Change vite (< 5 min). Vélo → chaussures de course immédiatement.'] },
    { label: '🏃 Course', items: [`${run} min en partant CONTRÔLÉ${thr ? ` (~${fmtPace(thr * 1.12)})` : ' (RPE 5)'} — les jambes seront lourdes les 5 premières min, c\'est normal et c\'est l\'intérêt.`] }
  ], notes: ['Le brick entraîne la sensation « jambes de coton » du jour J : c\'est la séance la plus spécifique de l\'Ironman.'] };
}

function ftpTest() {
  return { title: 'Test FTP (vélo)', focus: 'Mesure', durationMin: 50, blocks: [
    { label: '🔥 Échauffement (15 min)', items: ['Montée progressive + 3 × 1 min vifs (récup 1 min).'] },
    { label: '🎯 Test', items: ['20 min le plus FORT que tu peux tenir RÉGULIER (RPE 8-9).', 'Note la puissance moyenne (ou vitesse/résistance + RPE).'] },
    { label: '🧊 Retour au calme', items: ['10 min très facile.'] }
  ], notes: ['FTP ≈ 95 % de la moyenne des 20 min. Ne pars pas en sprint : c\'est un effort dur et constant.'] };
}
function run5kTest() {
  return { title: 'Test 5 km (course)', focus: 'Mesure', durationMin: 40, blocks: [
    { label: '🔥 Échauffement (10 min)', items: ['Footing lent + 3-4 lignes droites.'] },
    { label: '🎯 Test', items: ['5 km le plus vite possible à allure RÉGULIÈRE.', 'Note le temps total.'] },
    { label: '🧊 Retour au calme', items: ['5-10 min footing lent.'] }
  ], notes: ['Gère l\'allure : mieux vaut finir fort que partir trop vite et exploser.'] };
}
function cssTest() {
  return { title: 'Test CSS (natation)', focus: 'Mesure', durationMin: 45, blocks: [
    { label: '🔥 Échauffement', items: ['200-300 m easy + 4 × 25 m progressifs.'] },
    { label: '🎯 Test', items: ['400 m chrono (effort dur régulier).', 'Repos 5 min complet.', '200 m chrono.'] },
    { label: '🧮 Calcul', items: ['CSS = (400 − 200) m ÷ (temps400 − temps200) → ton allure seuil de nage.'] }
  ], notes: ['Garde une allure régulière sur chaque distance, ne pars pas trop vite.'] };
}

/* Aplatit une séance détaillée en texte (pour le coach IA). */
export function detailToText(detail) {
  if (!detail) return '';
  if (detail.lines) return detail.lines.join(' ');
  const parts = [detail.title];
  (detail.blocks || []).forEach((bl) => parts.push(`${bl.label}: ${bl.items.join(' / ')}`));
  if (detail.notes && detail.notes.length) parts.push('Notes: ' + detail.notes.join(' '));
  return parts.join(' | ');
}

function enduranceDuration(state, slot, deload) {
  const phaseId = currentWeek(state).phaseId;
  // base de minutes par type/phase ; les sorties longues grossissent avec la phase
  let base = 50;
  const longByPhase = { hyper: 90, strength: 120, specific: 180, peak: 75, transition: 60, test: 75 };
  if (slot.long) base = longByPhase[phaseId] || 90;
  else base = ({ bike: 60, run: 45, swim: 45, brick: 120 })[slot.type] || 50;
  if (deload) base = Math.round(base * 0.7);
  return base;
}

/* Surcharge progressive muscu : regarde le dernier log de l'exercice. */
export function suggestStrength(state, exoName) {
  const logs = state.logs.sessions
    .filter((s) => s.type === 'strength' && Array.isArray(s.exercises))
    .flatMap((s) => s.exercises.map((e) => ({ ...e, date: s.date })))
    .filter((e) => e.name === exoName)
    .sort((a, b) => b.date.localeCompare(a.date));
  if (!logs.length) return null;
  const last = logs[0];
  // double progression : si le haut de fourchette atteint (>=12 ou RIR>=2), +5 lb
  const topReached = (last.reps >= 12) || (last.rir != null && last.rir >= 2 && last.reps >= 10);
  return topReached ? (last.weight || 0) + 5 : (last.weight || null);
}

/* ============ Nutrition : cibles du jour ============ */
export function bmr(state) {
  const p = state.profile;
  if (!p.weightLb || !p.heightCm || !p.age) return null;
  const kg = p.weightLb * 0.4536;
  // Mifflin-St Jeor
  const base = 10 * kg + 6.25 * p.heightCm - 5 * p.age + (p.sex === 'F' ? -161 : 5);
  // Facteur NEAT seul (vie quotidienne, hors entraînement structuré) : l'énergie des
  // séances est ajoutée explicitement dans nutritionTarget via endHours*400. Mettre
  // ~1.45 ici reviendrait à compter l'entraînement deux fois.
  return Math.round(base * 1.3);
}
export function nutritionTarget(state, iso = todayISO()) {
  const maintenance = bmr(state);
  if (!maintenance) return null;
  const phaseId = currentWeek(state, iso).phaseId;
  const factor = NUTRITION.kcalPhaseFactor[phaseId] ?? 1;
  // ajout calorique selon endurance planifiée du jour
  const plan = todayPlan(state, iso);
  const endMin = ['bike', 'run', 'swim', 'brick'].includes(plan.slot.type) ? (plan.detail.durationMin || 0) : 0;
  const endHours = endMin / 60;
  const proteinG = Math.round((state.profile.weightLb || 140) * NUTRITION.proteinGPerLb);
  const carbsG = Math.round((state.profile.weightLb || 140) * 1.5 + endHours * NUTRITION.carbsPerEnduranceHour);
  const fatG = Math.round((state.profile.weightLb || 140) * NUTRITION.fatMinGPerLb);
  let kcal = Math.round(maintenance * factor + endHours * 400);
  // cohérence : recalcule kcal min depuis macros
  const macroKcal = proteinG * 4 + carbsG * 4 + fatG * 9;
  kcal = Math.max(kcal, macroKcal);
  return { kcal, proteinG, carbsG, fatG, note: emphasisNote(state.profile.emphasis, phaseId) };
}
function emphasisNote(emphasis, phaseId) {
  if (phaseId === 'hyper') return 'Léger surplus : c\'est le moment de construire du muscle.';
  if (phaseId === 'specific') return 'Mange pour soutenir le volume : glucides autour des grosses séances.';
  return 'Maintenance : protéine haute, glucides selon la charge.';
}

/* ============ Analyse du maillon faible ============ */
export function limiterAnalysis(state) {
  const b = state.benchmarks, p = state.profile;
  const items = [];
  if (b.ftp && p.weightLb) {
    const wkg = b.ftp / (p.weightLb * 0.4536);
    items.push(rank('Vélo (FTP)', wkg, IM_TARGETS.ftpWkg, `${round1(wkg)} W/kg vs ${IM_TARGETS.ftpWkg} cible`));
  }
  if (b.run5kSec) items.push(rank('Course (5k)', IM_TARGETS.run5kSec / b.run5kSec, 1, `${fmtSec(b.run5kSec)} sur 5 km`));
  if (b.cssSec100) items.push(rank('Nage (CSS)', IM_TARGETS.swimCss100Sec / b.cssSec100, 1, `${Math.round(b.cssSec100)} s/100m`));
  if (p.weightLb && p.goalWeightLb) {
    const prog = p.weightLb / p.goalWeightLb;
    // trainable=false : le poids se pilote par la nutrition, pas par l'emphase d'entraînement.
    // On l'affiche pour le suivi mais il ne doit pas prendre la tête du classement « quoi prioriser ».
    items.push(rank('Poids/muscle', prog, 1, `${p.weightLb} → ${p.goalWeightLb} lb`, false));
  }
  items.sort((a, b2) => a.score - b2.score);
  return items;
}
function rank(name, value, target, detail, trainable = true) {
  const score = round2(value / target);
  return { name, score, detail, trainable, status: score >= 1 ? 'ok' : score >= 0.85 ? 'proche' : 'frein' };
}

/* ============ Revue hebdomadaire ============ */
export function buildWeeklyReview(state, weekIndex) {
  const cycle = buildMacrocycle(state);
  const week = cycle[weekIndex] || currentWeek(state);
  const start = week.startDate, end = addDays(start, 6);
  const sessions = state.logs.sessions.filter((s) => s.date >= start && s.date <= end);
  const tpl = WEEK_TEMPLATES[week.phaseId] || WEEK_TEMPLATES.hyper;
  const planned = tpl.filter((s) => s.type !== 'rest').length;
  const done = sessions.length;
  const adherence = planned ? Math.round((done / planned) * 100) : 0;
  const a = acwr(state.logs.sessions, end);
  const flag = acwrFlag(a.ratio);
  const readinessWeek = state.logs.readiness.filter((r) => r.date >= start && r.date <= end);
  const avgReadiness = readinessWeek.length ? round1(readinessWeek.reduce((s, r) => s + readinessMultiplier(r), 0) / readinessWeek.length) : null;

  const proposals = [];
  if (adherence < 70) proposals.push({ id: 'adh', type: 'ajuster', text: `Adhérence ${adherence}% : on simplifie la semaine (moins de séances, mais tenues).` });
  if (flag.level === 'high') proposals.push({ id: 'acwr', type: 'réduire', text: 'ACWR élevé : -15% de volume endurance + 1 jour de récup en plus.' });
  if (flag.level === 'low' && adherence >= 90) proposals.push({ id: 'push', type: 'ajouter', text: 'Tu encaisses bien : +10% sur la sortie longue la semaine prochaine.' });
  if (avgReadiness != null && avgReadiness < 0.8) proposals.push({ id: 'recovery', type: 'réduire', text: 'Readiness basse cette semaine : priorise sommeil, baisse l\'intensité.' });
  const limiters = limiterAnalysis(state);
  // On ne propose une emphase d'entraînement que sur un limiteur entraînable (vélo/course/nage),
  // pas sur le poids (qui se règle par la nutrition).
  const trainableLimiter = limiters.find((l) => l.trainable !== false);
  if (trainableLimiter && trainableLimiter.status === 'frein') proposals.push({ id: 'limiter', type: 'accent', text: `Maillon faible : ${trainableLimiter.name}. On met l'accent dessus la semaine prochaine.` });
  if (!proposals.length) proposals.push({ id: 'keep', type: 'garder', text: 'Tout est cohérent : on garde le cap et on progresse.' });

  return {
    weekIndex: week.index, phaseId: week.phaseId, date: todayISO(),
    start, end, adherence, done, planned, acwr: a, flag, avgReadiness,
    limiters, proposals: proposals.map((p) => ({ ...p, accepted: null }))
  };
}

/* ============ utils ============ */
function round1(n) { return Math.round(n * 10) / 10; }
function round2(n) { return Math.round(n * 100) / 100; }
function fmtSec(s) { const m = Math.floor(s / 60); return `${m}:${String(Math.round(s % 60)).padStart(2, '0')}`; }
