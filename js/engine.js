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
export function acwr(sessions, iso = todayISO()) {
  let acute = 0, chronic = 0;
  for (let i = 0; i < 28; i++) {
    const d = addDays(iso, -i);
    const load = dailyLoad(sessions, d);
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

/* ============ Autorégulation (readiness -> multiplicateur) ============ */
export function readinessMultiplier(r) {
  if (!r) return 1;
  // moyenne des 4 réponses (0..3) -> 0..1
  const vals = ['sleep', 'soreness', 'energy', 'stress'].map((k) => (r[k] ?? 2));
  const avg = vals.reduce((a, b) => a + b, 0) / (vals.length * 3); // 0..1
  // mappe sur 0.65 .. 1.05
  return round2(0.65 + avg * 0.4);
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
  const mult = week.deload ? Math.min(readinessMultiplier(readiness), 0.8) : readinessMultiplier(readiness);

  const detail = buildSessionDetail(state, slot, { mult, deload: week.deload });
  return { week, phase, slot, detail, mult, deload: week.deload };
}

function buildSessionDetail(state, slot, { mult, deload }) {
  const b = state.benchmarks;
  if (slot.type === 'rest') return { title: slot.intent, lines: ['Récupération. Marche, mobilité, sommeil.'] };

  if (slot.type === 'strength') {
    const key = ({ hyper: 'hyper', strength: 'strength', specific: 'specific', peak: 'peak' })[currentWeek(state).phaseId] || 'hyper';
    const t = STRENGTH_TEMPLATES[key];
    const lines = [`Schéma : ${t.scheme} (RIR ${t.rir}). ${t.note}`];
    const groups = slot.tag === 'A' ? ['push', 'legs', 'core'] : slot.tag === 'B' ? ['pull', 'legs', 'core'] : ['push', 'pull', 'legs'];
    if (slot.tag === 'TEST') {
      return { title: 'Tests de force + photos', lines: [
        'Max pompes (1 série à l\'échec).', 'Max tractions (à l\'échec).',
        'Bench haltères : trouve ton 5RM (RIR 1-2).', 'Goblet squat / fentes : 5RM.',
        'Photos face/profil/dos + mensurations.' ] };
    }
    groups.forEach((g) => {
      const ex = EXERCISES[g][0];
      const sugg = suggestStrength(state, ex);
      lines.push(`• ${ex} — ${t.scheme}${sugg ? ` (essaie ${sugg} lb)` : ''}`);
      lines.push(`• ${EXERCISES[g][1]} — ${t.scheme}`);
    });
    if (deload) lines.push('🔻 Deload : -30% de volume, garde la technique.');
    return { title: slot.intent, lines };
  }

  // endurance
  const durBase = enduranceDuration(state, slot, deload);
  const dur = Math.round(durBase * mult);
  const lines = [];
  if (slot.type === 'bike') {
    if (slot.zone === 'TEST') return { title: 'Test FTP', lines: ['15 min échauffement', '20 min le plus fort RÉGULIER (RPE 8-9) — note la moyenne', '10 min retour au calme', 'FTP ≈ 95% de la moyenne des 20 min'] };
    const pw = powerForZone(b.ftp, slot.zone);
    lines.push(`${dur} min à vélo en ${slot.zone}.`);
    if (pw) lines.push(`Cible puissance : ${pw.lo}-${pw.hi} W.`); else lines.push('Sans capteur : règle au RPE (Z2 = 4-5, tu discutes ; Z4 = 8).');
  } else if (slot.type === 'run') {
    if (slot.zone === 'TEST') return { title: 'Test 5 km', lines: ['10 min échauffement', '5 km chrono allure régulière', '5-10 min retour au calme', 'Note ton temps.'] };
    const thr = thresholdPaceFrom5k(b.run5kSec);
    lines.push(`${dur} min de course en ${slot.zone}.`);
    if (thr) {
      const pace = slot.zone === 'Z2' ? thr * 1.15 : slot.zone === 'Z3' ? thr * 1.04 : thr;
      lines.push(`Allure cible ≈ ${fmtPace(pace)}.`);
    } else lines.push('Sans repère : Z2 = tu peux parler ; tempo = phrases courtes.');
  } else if (slot.type === 'swim') {
    lines.push(`${dur} min de natation — ${slot.intent}.`);
    if (b.cssSec100) lines.push(`Allure seuil (CSS) ≈ ${Math.round(b.cssSec100)} s/100m.`);
    lines.push('Si pas de piscine ce jour : travail à sec (élastiques de nage) 15-20 min.');
  } else if (slot.type === 'brick') {
    const bike = Math.round(dur * 0.8), run = Math.max(15, dur - bike);
    lines.push(`Vélo ${bike} min en Z2, puis enchaîne ${run} min de course.`);
    lines.push('Transition rapide : c\'est l\'enchaînement qu\'on entraîne.');
  }
  if (deload) lines.push('🔻 Semaine de deload : volume réduit, reste facile.');
  return { title: slot.intent, lines };
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
  return Math.round(base * 1.45); // facteur d'activité modéré-élevé (étudiant + sport)
}
export function nutritionTarget(state, iso = todayISO()) {
  const maintenance = bmr(state);
  if (!maintenance) return null;
  const phaseId = currentWeek(state, iso).phaseId;
  const factor = NUTRITION.kcalPhaseFactor[phaseId] ?? 1;
  // ajout calorique selon endurance planifiée du jour
  const plan = todayPlan(state, iso);
  const endMin = ['bike', 'run', 'swim', 'brick'].includes(plan.slot.type) ? (plan.detail.durMin || estDur(plan)) : 0;
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
function estDur(plan) { return plan.detail && plan.detail.lines ? 60 : 50; }
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
    items.push(rank('Poids/muscle', prog, 1, `${p.weightLb} → ${p.goalWeightLb} lb`));
  }
  items.sort((a, b2) => a.score - b2.score);
  return items;
}
function rank(name, value, target, detail) {
  const score = round2(value / target);
  return { name, score, detail, status: score >= 1 ? 'ok' : score >= 0.85 ? 'proche' : 'frein' };
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
  if (limiters[0] && limiters[0].status === 'frein') proposals.push({ id: 'limiter', type: 'accent', text: `Maillon faible : ${limiters[0].name}. On met l'accent dessus la semaine prochaine.` });
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
