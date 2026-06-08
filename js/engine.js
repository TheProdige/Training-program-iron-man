// engine.js — le cerveau adaptatif.
//  - Périodisation : calcule la phase et la semaine courantes du macrocycle.
//  - Planner : transforme un template en séances concrètes avec prescriptions chiffrées.
//  - Progression : surcharge progressive sur la muscu + ramp d'endurance contrôlée
//    par l'ACWR (ratio charge aiguë/chronique) + déclenchement de deload.

import {
  PHASES, WEEK_TEMPLATES, LIFT_TEMPLATES,
  bikeZone, runZonePace, swimZonePace, hrZone, zoneFactor
} from './data.js';

// ---------------------------------------------------------------- Dates utils
export function todayISO(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function parseISO(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); }
export function daysBetween(aISO, bISO) {
  return Math.round((parseISO(bISO) - parseISO(aISO)) / 86400000);
}
export function weekdayMon(dateISO) { // Lun=0 ... Dim=6
  return (parseISO(dateISO).getDay() + 6) % 7;
}
export function addDaysISO(dateISO, n) {
  const d = parseISO(dateISO); d.setDate(d.getDate() + n); return todayISO(d);
}

// ------------------------------------------------------------- Macrocycle
// Construit la liste des phases avec semaines réelles, calées sur le temps
// disponible entre le début du programme et la date de course.
export function buildMacro(state) {
  const start = state.startDate || todayISO();
  const race = state.profile.raceDate;
  const targetTotal = PHASES.reduce((s, p) => s + p.targetWeeks, 0); // 40
  let totalWeeks = targetTotal;
  if (race) {
    const wk = Math.ceil((daysBetween(start, race) + 1) / 7);
    if (wk > 4) totalWeeks = wk;
  }
  // Répartition au prorata, minimum 2 semaines par phase.
  const raw = PHASES.map((p) => Math.max(2, Math.round((p.targetWeeks / targetTotal) * totalWeeks)));
  // Ajuste l'arrondi pour retomber sur totalWeeks (on touche la dernière phase).
  let diff = totalWeeks - raw.reduce((a, b) => a + b, 0);
  raw[raw.length - 1] = Math.max(2, raw[raw.length - 1] + diff);

  let cursor = 0;
  return PHASES.map((p, i) => {
    const weeks = raw[i];
    const phase = { ...p, weeks, startWeek: cursor, endWeek: cursor + weeks - 1 };
    cursor += weeks;
    return phase;
  });
}

export function totalWeeks(macro) { return macro[macro.length - 1].endWeek + 1; }

export function currentWeekIndex(state, dateISO = todayISO()) {
  const start = state.startDate || todayISO();
  return Math.max(0, Math.floor(daysBetween(start, dateISO) / 7));
}

export function phaseForWeek(macro, weekIdx) {
  for (const ph of macro) if (weekIdx >= ph.startWeek && weekIdx <= ph.endWeek) return ph;
  return macro[macro.length - 1]; // au-delà de la course : on reste sur le pic
}

// Position dans un cycle de charge 4 semaines : 3 build + 1 deload (3:1).
export function loadingContext(macro, weekIdx) {
  const phase = phaseForWeek(macro, weekIdx);
  const wInPhase = weekIdx - phase.startWeek;            // 0-based
  const posInBlock = wInPhase % 4;                        // 0,1,2 build / 3 deload
  let isDeload = posInBlock === 3;
  let ramp = [1.0, 1.08, 1.16, 0.6][posInBlock];

  // Affûtage : les 2 dernières semaines du pic réduisent fortement le volume.
  const tw = totalWeeks(macro);
  const weeksToRace = tw - 1 - weekIdx;
  let taper = false;
  if (phase.key === 'peak' && weeksToRace <= 1) { taper = true; isDeload = true; ramp = weeksToRace === 0 ? 0.45 : 0.6; }

  return { phase, wInPhase, posInBlock, isDeload, taper, ramp, weekIdx, weeksToRace };
}

// ------------------------------------------------------------- Charge (sRPE) & ACWR
// sRPE = durée(min) × intensité perçue(1-10). Métrique unique muscu + endurance.
const ZONE_SRPE = { Z1: 3, Z2: 4, Z3: 6, Z4: 8, Z5: 9 };
export function estimateSessionLoad(sess) {
  if (sess.kind === 'rest') return 0;
  if (sess.kind === 'lift') {
    const tpl = LIFT_TEMPLATES[sess.t];
    const sets = tpl ? tpl.exercises.reduce((s, e) => s + e.sets, 0) : 18;
    return Math.round(sets * 3 * 7); // ~3 min/série, RPE ~7
  }
  const dur = sess.dur || 45;
  return Math.round(dur * (ZONE_SRPE[sess.zone] || 5));
}

// Charge réellement loggée d'une séance enregistrée.
export function loggedLoad(s) {
  if (typeof s.load === 'number') return s.load;
  const rpe = s.rpe || 7;
  const dur = s.durationMin || 45;
  return Math.round(dur * rpe);
}

// ACWR : charge aiguë (7j) / charge chronique (moyenne hebdo sur 28j).
export function computeACWR(state, refISO = todayISO()) {
  let acute = 0, chronic = 0;
  for (const s of state.sessions) {
    const age = daysBetween(s.date, refISO);
    if (age < 0) continue;
    const L = loggedLoad(s);
    if (age < 7) acute += L;
    if (age < 28) chronic += L;
  }
  chronic = chronic / 4; // moyenne hebdomadaire
  const ratio = chronic > 0 ? acute / chronic : 0;
  let status = 'ok', advice = '';
  if (chronic === 0) { status = 'build'; advice = 'Pas encore d\'historique : construis ta base progressivement.'; }
  else if (ratio > 1.5) { status = 'high'; advice = 'Charge aiguë élevée (risque de blessure). Lève le pied / privilégie le facile.'; }
  else if (ratio > 1.3) { status = 'watch'; advice = 'Charge en hausse rapide. Surveille la fatigue, dors et mange bien.'; }
  else if (ratio < 0.8 && acute > 0) { status = 'low'; advice = 'Charge basse : tu peux pousser un peu plus cette semaine.'; }
  else { advice = 'Charge dans la zone optimale. Continue comme ça.'; }
  return { acute: Math.round(acute), chronic: Math.round(chronic), ratio: +ratio.toFixed(2), status, advice };
}

// ------------------------------------------------------------- Surcharge muscu
function roundLoad(kg, isLower) {
  const step = isLower ? 2.5 : 1.25; // incréments réalistes home-gym
  return Math.round(kg / step) * step;
}
function isLowerLift(name) { return /squat|terre|presse|fente|hip|mollet|leg/i.test(name); }

// Prescription adaptative pour un exo : utilise l'historique loggé si dispo,
// sinon part du 1RM déclaré.
export function nextLiftPrescription(state, exName, repRange, isDeload) {
  const [lo, hi] = repRange;
  const hist = (state.history[exName] || []).slice(-1)[0];
  const lower = isLowerLift(exName);
  let weight, reps = lo, note = '';

  if (hist && hist.weight) {
    weight = hist.weight; reps = lo;
    if (hist.reps >= hi && (hist.rpe || 7) <= 8) {
      weight = roundLoad(weight + (lower ? 5 : 2.5), lower); reps = lo;
      note = '↑ charge (tu as bouclé le haut de la fourchette)';
    } else if (hist.reps >= lo && (hist.rpe || 7) <= 9) {
      reps = Math.min(hi, hist.reps + 1);
      note = '+1 rep à charge égale';
    } else if ((hist.rpe || 7) >= 9.5 || hist.reps < lo) {
      weight = roundLoad(weight * 0.9, lower); reps = lo;
      note = '↓ -10% (séance précédente trop dure)';
    } else { note = 'on maintient'; }
  } else {
    // Pas d'historique : estime depuis le 1RM (Epley inversé), cible ~le bas de fourchette.
    const orm = state.profile.lifts1rm[exName] || guess1rm(state, exName);
    const target = Math.round((lo + hi) / 2);
    weight = roundLoad(orm / (1 + target / 30) * 0.92, lower); // 92% conservateur
    reps = lo;
    note = 'estimé depuis ton 1RM — ajuste au ressenti';
  }
  if (isDeload) { weight = roundLoad(weight * 0.85, lower); note = 'deload (-15%)'; }
  return { weight: Math.max(0, weight), reps, note };
}

// 1RM approximatif pour les accessoires non déclarés (fraction du bodyweight).
function guess1rm(state, exName) {
  const bw = state.profile.bodyweightKg || 80;
  const map = [
    [/incliné|développé/i, 0.6], [/rowing|tirage|traction/i, 0.7],
    [/presse/i, 1.6], [/hip thrust/i, 1.2], [/curl/i, 0.25],
    [/élévation|face pull|extension/i, 0.15], [/mollet/i, 0.8], [/dips/i, 0.5]
  ];
  for (const [re, f] of map) if (re.test(exName)) return Math.round(bw * f);
  return Math.round(bw * 0.5);
}

// e1RM (Epley)
export function epley1rm(weight, reps) { return Math.round(weight * (1 + reps / 30)); }

// ------------------------------------------------------------- Planner
// Résout une séance template -> objet concret avec prescriptions/cibles.
export function resolveSession(state, ref, ctx) {
  const out = { kind: ref.kind };
  if (ref.kind === 'rest') { out.title = 'Repos / récupération'; out.load = 0; return out; }

  const readiness = ctx.readiness || 1; // 1 = en forme, <1 = on lève le pied

  if (ref.kind === 'lift') {
    const tpl = LIFT_TEMPLATES[ref.t];
    out.title = tpl.title;
    out.tplKey = ref.t;
    out.exercises = tpl.exercises.map((e) => {
      const p = nextLiftPrescription(state, e.name, e.rep, ctx.isDeload);
      const w = roundLoad(p.weight * readiness, isLowerLift(e.name));
      const sets = ctx.isDeload ? Math.max(1, e.sets - 1) : e.sets;
      return {
        name: e.name, sets, rep: e.rep, note: e.note,
        prescription: e.note ? `${sets}×${e.rep[0]}-${e.rep[1]}` :
          `${sets}×${p.reps} @ ${w}kg`,
        weight: w, advice: p.note, main: !!e.main
      };
    });
    out.load = estimateSessionLoad(ref);
    return out;
  }

  // Endurance
  const m = state.profile.metrics;
  const dur = Math.max(15, Math.round((ref.dur || 45) * ctx.ramp * readiness));
  out.title = ref.focus;
  out.zone = ref.zone;
  out.durMin = dur;
  out.targets = enduranceTargets(ref, m);
  out.load = Math.round(dur * (ZONE_SRPE[ref.zone] || 5));
  return out;
}

function enduranceTargets(ref, m) {
  const t = { hr: hrZone(ref.zone, m.maxHr, m.restHr) };
  if (ref.kind === 'bike') t.main = bikeZone(ref.zone, m.ftpWatts);
  else if (ref.kind === 'run') t.main = runZonePace(ref.zone, m.runThreshold);
  else if (ref.kind === 'swim') t.main = swimZonePace(ref.zone, m.swimCss);
  else if (ref.kind === 'brick') t.main = `Vélo ${bikeZone('Z2', m.ftpWatts)} puis course ${runZonePace('Z3', m.runThreshold)}`;
  return t;
}

// Facteurs d'auto-régulation selon le ressenti du jour.
export const READINESS = {
  great: { factor: 1.05, label: 'En feu 🔥', note: 'Tu peux viser le haut des fourchettes.' },
  good:  { factor: 1.0,  label: 'En forme 💪', note: 'On suit le plan tel quel.' },
  ok:    { factor: 0.92, label: 'Moyen 😐', note: 'Charges/durées légèrement réduites.' },
  tired: { factor: 0.82, label: 'Fatigué 😮‍💨', note: 'On allège nettement, qualité > quantité.' },
  wreck: { factor: 0.65, label: 'Cassé 🥵', note: 'Séance très allégée, ou repos si la fatigue persiste.' }
};

// Plan résolu d'une journée (Today view). `readinessKey` auto-régule la séance.
export function dailyPlan(state, dateISO = todayISO(), readinessKey = 'good') {
  const macro = buildMacro(state);
  const weekIdx = currentWeekIndex(state, dateISO);
  const ctx = loadingContext(macro, weekIdx);
  ctx.readiness = (READINESS[readinessKey] || READINESS.good).factor;
  ctx.readinessKey = readinessKey;
  const wd = weekdayMon(dateISO);
  const refs = (WEEK_TEMPLATES[ctx.phase.key] || [])[wd] || [{ kind: 'rest' }];
  const sessions = refs.map((r) => resolveSession(state, r, ctx));
  return { dateISO, weekIdx, ctx, weekday: wd, sessions };
}

// Plan résolu d'une semaine entière (Plan view).
export function weekPlan(state, weekIdx) {
  const macro = buildMacro(state);
  const ctx = loadingContext(macro, weekIdx);
  const tpl = WEEK_TEMPLATES[ctx.phase.key] || [];
  const days = tpl.map((refs) => refs.map((r) => resolveSession(state, r, ctx)));
  const totalLoad = days.flat().reduce((s, x) => s + (x.load || 0), 0);
  return { weekIdx, ctx, days, totalLoad };
}

// ------------------------------------------------------------- Logging
export function logSession(state, data) {
  // data : { date, kind, title, durationMin, rpe, distanceKm?, avgPower?, avgHr?, exercises? }
  const id = 'S' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const load = computeLoggedLoad(data);
  const rec = { id, ...data, load };
  state.sessions.push(rec);

  // Met à jour l'historique muscu (meilleure série par exo) pour la surcharge.
  if (data.kind === 'lift' && Array.isArray(data.exercises)) {
    for (const ex of data.exercises) {
      const sets = (ex.sets || []).filter((s) => s.weight > 0 && s.reps > 0);
      if (!sets.length) continue;
      const best = sets.reduce((a, b) => (epley1rm(b.weight, b.reps) > epley1rm(a.weight, a.reps) ? b : a));
      const top = sets.reduce((a, b) => (b.weight > a.weight ? b : a)); // série la plus lourde
      if (!state.history[ex.name]) state.history[ex.name] = [];
      state.history[ex.name].push({
        date: data.date, weight: top.weight, reps: top.reps,
        rpe: top.rpe || data.rpe || 7, e1rm: epley1rm(best.weight, best.reps)
      });
    }
  }
  return rec;
}

function computeLoggedLoad(data) {
  if (data.kind === 'lift' && Array.isArray(data.exercises)) {
    const totalSets = data.exercises.reduce((s, e) => s + (e.sets ? e.sets.length : 0), 0);
    const dur = data.durationMin || totalSets * 3;
    return Math.round(dur * (data.rpe || 7));
  }
  const dur = data.durationMin || 45;
  return Math.round(dur * (data.rpe || ZONE_SRPE[data.zone] || 6));
}

export function sessionDoneToday(state, dateISO, kind) {
  return state.sessions.some((s) => s.date === dateISO && (!kind || s.kind === kind));
}
