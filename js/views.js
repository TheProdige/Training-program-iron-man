// views.js — rendu de toutes les vues + interactions.
import { getState, update, save, resetAll, exportJSON, importJSON } from './store.js';
import {
  todayISO, buildMacro, totalWeeks, currentWeekIndex, dailyPlan, weekPlan,
  loadingContext, computeACWR, logSession, epley1rm, READINESS, daysBetween, addDaysISO
} from './engine.js';
import {
  DAY_NAMES, DAY_SHORT, DISCIPLINE_ICON, DISCIPLINE_LABEL, MAIN_LIFTS, LIFT_TEMPLATES, paceStr
} from './data.js';
import { lineChart, barChart } from './charts.js';
import { hasApiKey, getApiKey, setApiKey, streamReply } from './coach.js';

let mountEl = null;
let bound = false;
let route = 'today';
const vs = { planWeek: null, readiness: 'good', progressLift: 'Squat' };
let logDraft = null;
let coachBusy = false; // une requête coach en cours

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const isSimple = () => getState().profile.simpleMode !== false;

// Objectif du moment en langage simple, selon la phase du programme.
function plainPhase(key) {
  return {
    hypertrophy: 'On construit du muscle 💪 (et un peu de cardio facile)',
    strength: 'On gagne en force et on monte le cardio',
    specific: 'On met le paquet sur le cardio (triathlon)',
    peak: 'On peaufine la forme avant l\'objectif'
  }[key] || 'On progresse, étape par étape';
}
function plainPhaseShort(key) {
  return { hypertrophy: '💪 Muscle', strength: '💪 Force + cardio', specific: '🏊 Cardio', peak: '🏁 Affûtage' }[key] || key;
}
// Intensité d'une séance de cardio expliquée simplement.
function plainEffort(zone) {
  return {
    Z2: 'tranquille — tu dois pouvoir discuter en même temps',
    Z3: 'soutenu — tu parles juste par petites phrases',
    Z4: 'dur — par intervalles, tu récupères entre les efforts',
    Z5: 'très dur — efforts courts et intenses'
  }[zone] || 'à ton aise';
}

export function mount(r) {
  route = r || route;
  mountEl = document.getElementById('app');
  bindOnce();
  const st = getState();
  if (!st.onboarded) { mountEl.innerHTML = viewOnboarding(st); updateChrome(st, 'profile'); return; }
  mountEl.innerHTML = ({
    today: viewToday, plan: viewPlan, coach: viewCoach, log: viewLog, progress: viewProgress, profile: viewProfile
  }[route] || viewToday)(st);
  updateChrome(st, route);
  if (route === 'coach') { scrollCoachBottom(); focusCoachInput(); }
  else { mountEl.scrollTo?.(0, 0); window.scrollTo(0, 0); }
}
function rerender() { mount(route); }

function updateChrome(st, activeRoute) {
  const pill = document.getElementById('phasePill');
  if (st.onboarded) {
    const macro = buildMacro(st);
    const w = currentWeekIndex(st);
    const ctx = loadingContext(macro, w);
    pill.textContent = isSimple() ? `Semaine ${w + 1}` : `${ctx.phase.name} · S${ctx.wInPhase + 1}/${ctx.phase.weeks}`;
  } else pill.textContent = 'Bienvenue';
  document.querySelectorAll('.tab').forEach((t) =>
    t.classList.toggle('active', t.dataset.route === activeRoute));
}

// ============================================================ ONBOARDING
function viewOnboarding(st) {
  const p = st.profile;
  return `
  <h1 class="screen-title">🔥 Bienvenue !</h1>
  <div class="notice ok">
    Je te prépare un programme <b>Ironman + muscu</b>, en commençant <b>doucement</b>.
    Pas de chiffres compliqués : chaque jour, l'app te dit simplement <b>quoi faire</b>.
    Tu peux démarrer tout de suite. 💪
  </div>
  <form id="onboardForm">
    <div class="card">
      <label>Ton prénom (facultatif)</label>
      <input name="name" value="${esc(p.name)}" placeholder="Ton prénom" />
    </div>
    <div class="card">
      <h3>Combien de jours par semaine ?</h3>
      <div class="grid3">
        ${[3, 4, 5].map((n) => `
          <label style="display:flex;align-items:center;gap:8px;background:var(--bg3);border-radius:10px;padding:12px;cursor:pointer">
            <input type="radio" name="daysPerWeek" value="${n}" ${(+p.daysPerWeek || 5) === n ? 'checked' : ''} style="width:auto" /> ${n} jours
          </label>`).join('')}
      </div>
    </div>
    <button class="btn" type="submit" data-action="start-program">🚀 C'est parti !</button>
    <p class="small muted center" style="margin-top:10px">Tu pourras tout régler plus tard dans Profil.</p>
  </form>`;
}


// ============================================================ TODAY
function viewToday(st) {
  const dp = dailyPlan(st, todayISO(), vs.readiness);
  const { ctx } = dp;
  const macro = buildMacro(st);
  const tw = totalWeeks(macro);
  const acwr = computeACWR(st);
  const done = st.sessions.filter((s) => s.date === todayISO());
  const rd = READINESS[vs.readiness];
  const simple = isSimple();

  const sessHtml = dp.sessions.map((s) => sessionCard(s, true)).join('');

  // Bloc en-tête : simple ou détaillé.
  let header;
  if (simple) {
    header = `<div class="card">
      <h2>${esc(plainPhase(ctx.phase.key))}</h2>
      <div class="small muted" style="margin-top:6px">${ctx.isDeload || ctx.taper ? 'Semaine plus légère : on récupère 😌' : 'Semaine d\'entraînement normale'}</div>
    </div>`;
  } else {
    let badges = `<span class="badge ${ctx.phase.key}">${esc(ctx.phase.emphasis)}</span>`;
    if (ctx.taper) badges += ` <span class="badge deload">AFFÛTAGE</span>`;
    else if (ctx.isDeload) badges += ` <span class="badge deload">DELOAD</span>`;
    header = `<div class="card">
      <div><h2>${esc(ctx.phase.name)}</h2><div class="small muted">Semaine ${dp.weekIdx + 1} / ${tw} du macrocycle · ${badges}</div></div>
      <div class="small muted" style="margin-top:8px">${esc(ctx.phase.focus)}</div>
      ${ctx.weeksToRace >= 0 ? `<div class="small" style="margin-top:8px">🏁 <b>${ctx.weeksToRace}</b> semaines avant la course</div>` : ''}
    </div>`;
  }

  // Avertissement fatigue (simple), seulement si la charge grimpe vite.
  let loadNote = '';
  if (simple) {
    if (acwr.status === 'high') loadNote = `<div class="notice danger">⚠️ Tu en fais beaucoup ces jours-ci. Vas-y mollo et dors bien. 😴</div>`;
    else if (acwr.status === 'watch') loadNote = `<div class="notice">Tu montes en charge — pense à bien manger et dormir. 👍</div>`;
  } else {
    loadNote = `<div class="notice ${acwr.status === 'high' ? 'danger' : acwr.status === 'ok' ? 'ok' : ''}">
      <b>Charge (ACWR ${acwr.ratio || '—'})</b> · aiguë 7j ${acwr.acute} / chronique ${acwr.chronic}<br/>${esc(acwr.advice)}</div>`;
  }

  return `
  <h1 class="screen-title">${DAY_NAMES[dp.weekday]} <span class="muted small">· ${fmtDate(todayISO())}</span></h1>
  ${header}

  <div class="card">
    <h3>Comment tu te sens aujourd'hui&nbsp;?</h3>
    <div class="grid3" style="grid-template-columns:repeat(5,1fr);gap:6px">
      ${Object.entries(READINESS).map(([k, v]) =>
        `<button class="btn ${k === vs.readiness ? '' : 'secondary'} small" data-action="readiness" data-key="${k}" style="flex-direction:column;font-size:11px;padding:8px 4px">${v.label}</button>`).join('')}
    </div>
    <div class="small muted" style="margin-top:8px">${esc(rd.note)}</div>
  </div>

  ${loadNote}
  ${done.length ? `<div class="notice ok">✅ Séance faite aujourd'hui. Bravo ! 🎉</div>` : ''}

  <h3 style="margin:18px 0 8px;color:var(--muted)">Ta séance d'aujourd'hui</h3>
  ${sessHtml || '<div class="empty">Repos 😴</div>'}`;
}

function sessionCard(s, withLog) {
  if (s.kind === 'rest') {
    return `<div class="card acc-rest"><div class="sess"><div class="ic">😴</div><div class="body"><div class="t">Repos / récupération</div><div class="d">Mobilité, marche, sommeil. La récup, c'est là que les gains se construisent.</div></div></div></div>`;
  }
  const ic = DISCIPLINE_ICON[s.kind];
  const simple = isSimple();
  let body = '';
  if (s.kind === 'lift') {
    const cue = simple ? `<div class="notice" style="margin:0 0 8px;padding:9px 11px">💡 Prends un poids où les <b>2-3 dernières reps sont dures</b>. Trop facile&nbsp;? Monte un peu la prochaine fois. Garde le dos droit, et arrête si ça fait mal.</div>` : '';
    body = cue + `<ul class="ex-list">${s.exercises.map((e) => {
      const reps = `${e.sets} séries de ${e.rep[0]}-${e.rep[1]}`;
      const right = simple ? reps : esc(e.prescription);
      const advice = (!simple && e.advice) ? `<br/><span class="small muted">${esc(e.advice)}</span>` : '';
      return `<li><span>${esc(e.name)}${(!simple && e.main) ? ' ⭐' : ''}${advice}</span><span class="prescr">${right}</span></li>`;
    }).join('')}</ul>`;
  } else if (simple) {
    body = `<div class="d">⏱️ ${s.durMin} min · <b>${esc(plainEffort(s.zone))}</b></div>`;
  } else {
    const t = s.targets || {};
    body = `<div class="d">⏱️ ${s.durMin} min · zone ${s.zone}</div>
      ${t.main ? `<div class="tag">🎯 ${esc(t.main)}</div>` : ''}${t.hr ? `<div class="tag">❤️ ${esc(t.hr)}</div>` : ''}`;
  }
  const payload = encodeURIComponent(JSON.stringify(slimSession(s)));
  return `<div class="card acc-${s.kind}">
    <div class="sess"><div class="ic">${ic}</div><div class="body">
      <div class="t">${esc(DISCIPLINE_LABEL[s.kind])} — ${esc(s.title)}</div>${body}
    </div></div>
    ${withLog ? `<button class="btn small secondary" style="margin-top:10px;width:auto" data-action="log-from" data-payload="${payload}">✍️ Logger cette séance</button>` : ''}
  </div>`;
}
function slimSession(s) {
  if (s.kind === 'lift') return { kind: 'lift', title: s.title, tplKey: s.tplKey, exercises: s.exercises.map((e) => ({ name: e.name, sets: e.sets, reps: e.reps || e.rep[0], weight: e.weight })) };
  return { kind: s.kind, title: s.title, zone: s.zone, durMin: s.durMin };
}

// ============================================================ PLAN
function viewPlan(st) {
  const macro = buildMacro(st);
  const tw = totalWeeks(macro);
  const cur = currentWeekIndex(st);
  if (vs.planWeek === null) vs.planWeek = cur;
  vs.planWeek = Math.max(0, Math.min(tw - 1, vs.planWeek));
  const wp = weekPlan(st, vs.planWeek);
  const ctx = wp.ctx;

  const macroBar = macro.map((ph) => {
    const pct = (ph.weeks / tw) * 100;
    const active = vs.planWeek >= ph.startWeek && vs.planWeek <= ph.endWeek;
    return `<div title="${esc(ph.name)}" style="flex:${ph.weeks};background:${ph.color};opacity:${active ? 1 : 0.4};height:14px;${active ? 'box-shadow:0 0 0 2px #fff inset' : ''}"></div>`;
  }).join('');

  const days = wp.days.map((sessions, i) => {
    const isToday = i === ((require_weekday(st, vs.planWeek)));
    const tags = sessions.map((s) => s.kind === 'rest'
      ? `<span class="tag">😴 Repos</span>`
      : `<span class="tag">${DISCIPLINE_ICON[s.kind]} ${esc(DISCIPLINE_LABEL[s.kind])}${s.durMin ? ' ' + s.durMin + '′' : ''}</span>`).join('');
    return `<div class="day ${isToday ? 'today-day' : ''}">
      <div class="dh"><span class="dn">${DAY_NAMES[i]}</span>${isToday ? '<span class="badge">aujourd\'hui</span>' : ''}</div>
      <div>${tags}</div>
      ${sessions.filter((s) => s.kind === 'lift').map((s) => `<div class="small muted" style="margin-top:4px">${esc(s.title)}</div>`).join('')}
    </div>`;
  }).join('');

  const simple = isSimple();
  const subLine = simple
    ? `${esc(plainPhase(ctx.phase.key))}${ctx.isDeload ? ' · semaine légère 😌' : ''}`
    : `${esc(ctx.phase.name)} · S${ctx.wInPhase + 1}/${ctx.phase.weeks} ${ctx.isDeload ? '· <span style="color:var(--gold)">DELOAD</span>' : ''}`;

  return `
  <h1 class="screen-title">🗺️ ${simple ? 'Ma semaine' : 'Plan'}</h1>
  <div class="card">
    <h3>${simple ? 'Mon programme' : 'Macrocycle'} (${tw} semaines)</h3>
    <div style="display:flex;border-radius:8px;overflow:hidden;margin:8px 0">${macroBar}</div>
    <div class="legend">${macro.map((ph) => `<span><i style="background:${ph.color}"></i>${esc(simple ? plainPhaseShort(ph.key) : ph.name)}</span>`).join('')}</div>
  </div>

  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
      <button class="btn secondary small" data-action="week-prev">‹</button>
      <div class="center"><b>Semaine ${vs.planWeek + 1}</b><div class="small muted">${subLine}</div></div>
      <button class="btn secondary small" data-action="week-next">›</button>
    </div>
    ${vs.planWeek !== cur ? `<button class="btn ghost small" style="margin-top:8px;width:100%" data-action="week-now">↩ Revenir à cette semaine</button>` : ''}
    <div class="stat-row" style="margin-top:12px">
      <div class="stat"><div class="n gold">${Math.round(weekHours(wp))}h</div><div class="l">Temps</div></div>
      <div class="stat"><div class="n blue">${wp.days.flat().filter((s) => s.kind !== 'rest').length}</div><div class="l">Séances</div></div>
      ${simple ? '' : `<div class="stat"><div class="n red">${wp.totalLoad}</div><div class="l">Charge sRPE</div></div>`}
    </div>
  </div>

  <div class="week">${days}</div>`;
}
function require_weekday(st, weekIdx) { return weekIdx === currentWeekIndex(st) ? ((new Date().getDay() + 6) % 7) : -1; }
function weekHours(wp) { return wp.days.flat().reduce((s, x) => s + (x.durMin || (x.kind === 'lift' ? 60 : 0)), 0) / 60; }

// ============================================================ LOG
function viewLog(st) {
  let form = '';
  if (logDraft) form = logFormHtml(logDraft);
  else form = `
    <div class="card">
      <h3>Nouvelle séance — choisis la discipline</h3>
      <div class="grid3">
        ${['lift', 'swim', 'bike', 'run', 'brick'].map((k) =>
          `<button class="btn secondary" data-action="new-draft" data-kind="${k}" style="flex-direction:column;font-size:13px">${DISCIPLINE_ICON[k]}<span>${DISCIPLINE_LABEL[k]}</span></button>`).join('')}
      </div>
    </div>`;

  const simple = isSimple();
  const recent = [...st.sessions].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 12);
  const recentHtml = recent.length ? recent.map((s) => {
    const meta = simple
      ? `${fmtDate(s.date)}${s.durationMin ? ' · ' + s.durationMin + ' min' : ''}${s.rpe ? ' · effort ' + s.rpe + '/10' : ''}`
      : `${fmtDate(s.date)} · ${s.durationMin ? s.durationMin + ' min · ' : ''}RPE ${s.rpe || '—'} · charge ${s.load}`;
    return `<div class="sess">
      <div class="ic">${DISCIPLINE_ICON[s.kind]}</div>
      <div class="body">
        <div class="t">${esc(s.title || DISCIPLINE_LABEL[s.kind])}</div>
        <div class="d">${meta}</div>
      </div>
      <button class="x-set" data-action="del-session" data-id="${s.id}" title="Supprimer">🗑️</button>
    </div>`;
  }).join('') : '<div class="empty small">Pas encore de séance enregistrée.</div>';

  return `<h1 class="screen-title">✍️ Logger ma séance</h1>${form}
    <div class="card"><h3>Mes dernières séances</h3>${recentHtml}</div>`;
}

function logFormHtml(d) {
  const simple = isSimple();
  const dateInput = `<label>Date</label><input id="ld_date" type="date" value="${d.date}" />`;
  const effortLabel = simple ? 'Effort' : 'RPE';
  if (d.kind === 'lift') {
    const exs = d.exercises.map((ex, i) => {
      const rows = ex.sets.map((s, j) => `
        <div class="set-grid" data-ex="${i}" data-set="${j}">
          <div class="small muted center">${j + 1}</div>
          <input class="ls-w" inputmode="decimal" value="${s.weight ?? ''}" placeholder="kg" />
          <input class="ls-r" inputmode="numeric" value="${s.reps ?? ''}" placeholder="reps" />
          <input class="ls-rpe" inputmode="decimal" value="${s.rpe ?? ''}" placeholder="1-10" />
          <button class="x-set" data-action="del-set" data-ex="${i}" data-set="${j}">✕</button>
        </div>`).join('');
      return `<div class="card acc-lift" style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:center"><b>${esc(ex.name)}</b></div>
        <div class="set-grid"><div class="h">#</div><div class="h">Poids</div><div class="h">Reps</div><div class="h">${effortLabel}</div><div></div></div>
        ${rows}
        <button class="btn ghost small" style="margin-top:8px;width:100%" data-action="add-set" data-ex="${i}">+ série</button>
      </div>`;
    }).join('');
    return `<div class="card"><h3>${esc(d.title)}</h3>${dateInput}
      ${simple ? '<p class="small muted" style="margin-top:8px">Note le poids et le nombre de reps de chaque série. La colonne « Effort » (1 facile → 10 à fond) est facultative.</p>' : `<label>Durée totale (min, optionnel)</label><input id="ld_dur" type="number" value="${d.durationMin || ''}" placeholder="ex: 70" />`}
      </div>${exs}
      <div class="btn-row"><button class="btn green" data-action="save-log">✅ Enregistrer</button>
      <button class="btn ghost" data-action="cancel-log" style="width:auto">Annuler</button></div>`;
  }
  // Endurance
  if (simple) {
    return `<div class="card"><h3>${DISCIPLINE_ICON[d.kind]} ${esc(d.title || DISCIPLINE_LABEL[d.kind])}</h3>
      ${dateInput}
      <label>Combien de temps ? (minutes)</label><input id="ld_dur" type="number" value="${d.durationMin || ''}" placeholder="ex: 40" />
      <label>C'était dur ? (1 facile → 10 à fond) — facultatif</label><input id="ld_rpe" type="number" step="1" value="${d.rpe || ''}" placeholder="ex: 5" />
      </div>
      <div class="btn-row"><button class="btn green" data-action="save-log">✅ Enregistrer</button>
      <button class="btn ghost" data-action="cancel-log" style="width:auto">Annuler</button></div>`;
  }
  return `<div class="card"><h3>${DISCIPLINE_ICON[d.kind]} ${esc(d.title || DISCIPLINE_LABEL[d.kind])}</h3>
    ${dateInput}
    <div class="grid2">
      <div><label>Durée (min)</label><input id="ld_dur" type="number" value="${d.durationMin || ''}" placeholder="min" /></div>
      <div><label>Distance (km)</label><input id="ld_dist" type="number" step="0.1" value="${d.distanceKm || ''}" placeholder="km" /></div>
      ${d.kind === 'bike' ? `<div><label>Puissance moy. (W)</label><input id="ld_pow" type="number" value="${d.avgPower || ''}" /></div>` : ''}
      <div><label>FC moy. (bpm)</label><input id="ld_hr" type="number" value="${d.avgHr || ''}" /></div>
      <div><label>RPE ressenti (1-10)</label><input id="ld_rpe" type="number" step="0.5" value="${d.rpe || ''}" placeholder="ex: 6" /></div>
    </div></div>
    <div class="btn-row"><button class="btn green" data-action="save-log">✅ Enregistrer</button>
    <button class="btn ghost" data-action="cancel-log" style="width:auto">Annuler</button></div>`;
}

// ============================================================ PROGRESS
function viewProgress(st) {
  const macro = buildMacro(st);
  const cur = currentWeekIndex(st);
  const ctx = loadingContext(macro, cur);
  const tw = totalWeeks(macro);

  // Charge hebdo (8 dernières semaines réelles)
  const bars = [];
  for (let i = 7; i >= 0; i--) {
    const wkStart = addDaysISO(todayISO(), -7 * i - 6);
    const wkEnd = addDaysISO(todayISO(), -7 * i);
    const load = st.sessions.filter((s) => s.date >= wkStart && s.date <= wkEnd).reduce((a, s) => a + s.load, 0);
    bars.push({ label: i === 0 ? 'cette' : `-${i}`, value: load, color: i === 0 ? '#f0a020' : '#e23636' });
  }

  // e1RM du mouvement sélectionné
  const liftHist = st.history[vs.progressLift] || [];
  const liftSeries = [{ color: '#e23636', points: liftHist.map((h, i) => ({ x: i, y: h.e1rm })) }];

  // Répartition des disciplines (28j)
  const disc = {};
  st.sessions.filter((s) => daysBetween(s.date, todayISO()) < 28).forEach((s) => { disc[s.kind] = (disc[s.kind] || 0) + s.load; });
  const discBars = Object.entries(disc).map(([k, v]) => ({ label: DISCIPLINE_ICON[k], value: v, color: { lift: '#e23636', swim: '#3b82f6', bike: '#f0a020', run: '#2ea043', brick: '#a371f7' }[k] }));

  const total = st.sessions.length;
  const load28 = st.sessions.filter((s) => daysBetween(s.date, todayISO()) < 28).reduce((a, s) => a + s.load, 0);
  const streak = computeStreak(st);

  const simple = isSimple();
  return `<h1 class="screen-title">📈 ${simple ? 'Mes progrès' : 'Progrès'}</h1>
  <div class="card"><div class="stat-row">
    <div class="stat"><div class="n red">${total}</div><div class="l">Séances</div></div>
    <div class="stat"><div class="n green">${streak}</div><div class="l">Jours d'affilée</div></div>
    ${simple
      ? `<div class="stat"><div class="n blue">${Math.round(((cur + 1) / tw) * 100)}%</div><div class="l">Programme</div></div>`
      : `<div class="stat"><div class="n gold">${load28}</div><div class="l">Charge 28j</div></div>
         <div class="stat"><div class="n blue">${ctx.weeksToRace}</div><div class="l">Sem. → course</div></div>`}
  </div></div>

  <div class="card"><h3>${simple ? 'Ma progression' : 'Progression du macrocycle'}</h3>
    <div class="bar"><i style="width:${Math.round(((cur + 1) / tw) * 100)}%"></i></div>
    <div class="small muted" style="margin-top:6px">Semaine ${cur + 1} / ${tw}${simple ? '' : ' · ' + esc(ctx.phase.name)}</div>
  </div>

  <div class="card"><h3>${simple ? 'Mon effort chaque semaine' : 'Charge hebdomadaire (sRPE)'}</h3>${barChart(bars)}
    <div class="small muted">${simple ? 'Plus la barre est haute, plus tu as bossé cette semaine-là.' : 'Indicateur d\'entraînement total. Les pics suivis de creux = bonne périodisation.'}</div>
  </div>

  <div class="card"><h3>${simple ? 'Ma force qui monte 💪' : 'Force — 1RM estimé'}</h3>
    <select data-action="pick-lift" style="margin-bottom:10px">
      ${MAIN_LIFTS.map((n) => `<option value="${esc(n)}" ${n === vs.progressLift ? 'selected' : ''}>${esc(n)}</option>`).join('')}
    </select>
    ${liftHist.length ? lineChart(liftSeries) : '<div class="empty small"><div class="big">🏋️</div>Logge tes séances de muscu pour voir ta force grimper.</div>'}
    ${liftHist.length ? `<div class="small muted">${simple ? 'Aujourd\'hui' : 'Dernier e1RM'} : <b>${liftHist[liftHist.length - 1].e1rm} kg</b> · au départ ${liftHist[0].e1rm} kg</div>` : ''}
  </div>

  <div class="card"><h3>${simple ? 'Ce que je fais le plus (4 sem.)' : 'Répartition par discipline (28j)'}</h3>${barChart(discBars)}</div>`;
}
function computeStreak(st) {
  const dates = new Set(st.sessions.map((s) => s.date));
  let streak = 0, cursor = todayISO();
  // tolère 1 jour de repos : on compte les jours actifs des 30 derniers jours
  for (let i = 0; i < 60; i++) { if (dates.has(addDaysISO(cursor, -i))) streak++; else if (i > 0 && !dates.has(addDaysISO(cursor, -i)) && !dates.has(addDaysISO(cursor, -(i + 1)))) break; }
  return streak;
}

// ============================================================ COACH IA
function viewCoach(st) {
  if (!hasApiKey()) return coachSetupHtml();

  const chat = st.coachChat || [];
  const bubbles = chat.length
    ? chat.map((m) => coachBubble(m.role, esc(m.content))).join('')
    : `<div class="empty"><div class="big">💬</div>Pose ta première question à ton coach.<br/><span class="small">Ex : « j'ai mal dormi et mon genou tire un peu, j'adapte comment ma séance de demain ? »</span></div>`;

  return `
  <h1 class="screen-title">💬 Coach IA</h1>
  <div class="coach-wrap">
    <div class="coach-scroll" id="coachScroll">
      ${bubbles}
      <div id="coachStreaming" style="display:none">${coachBubble('assistant', '<span class="coach-typing">…</span>')}</div>
    </div>
    <div class="coach-input">
      <textarea id="coachInput" rows="1" placeholder="Écris à ton coach…" ${coachBusy ? 'disabled' : ''}></textarea>
      <button class="btn small" style="width:auto" data-action="coach-send" ${coachBusy ? 'disabled' : ''}>${coachBusy ? '…' : '➤'}</button>
    </div>
    <div class="coach-tools">
      <button class="btn ghost small" data-action="coach-clear" style="width:auto">🧹 Effacer</button>
      <button class="btn ghost small" data-action="coach-settings" style="width:auto">🔑 Clé API</button>
      <span class="small muted">Modèle Claude Opus · clé stockée en local</span>
    </div>
  </div>`;
}

function coachBubble(role, html) {
  return `<div class="cbubble ${role === 'user' ? 'me' : 'ai'}">${role === 'assistant' ? '🔥 ' : ''}${html}</div>`;
}

function coachSetupHtml() {
  return `<h1 class="screen-title">💬 Coach IA</h1>
  <div class="notice">
    Pour activer ton coach IA conversationnel, ajoute ta <b>clé API Anthropic</b>.
    Elle est stockée <b>uniquement sur cet appareil</b> (localStorage), n'est jamais commitée ni envoyée ailleurs qu'à l'API Claude.
    Récupère-la sur <b>console.anthropic.com</b> (un petit coût à l'usage s'applique).
  </div>
  <div class="card">
    <h3>Clé API Anthropic</h3>
    <input id="coachKey" type="password" placeholder="sk-ant-..." autocomplete="off" />
    <button class="btn" style="margin-top:10px" data-action="coach-savekey">Activer le coach</button>
    <p class="small muted" style="margin-top:10px">Sans clé, l'app reste 100% fonctionnelle (le moteur adaptatif ne nécessite aucune clé). Le coach IA ajoute juste le chat.</p>
  </div>`;
}

function scrollCoachBottom() {
  const el = document.getElementById('coachScroll');
  if (el) el.scrollTop = el.scrollHeight;
}
function focusCoachInput() {
  const el = document.getElementById('coachInput');
  if (el && !coachBusy) { autoGrow(el); }
}
function autoGrow(el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 140) + 'px'; }

// ============================================================ PROFILE
function viewProfile(st) {
  const p = st.profile, m = p.metrics, l = p.lifts1rm;
  const simple = isSimple();

  const modeCard = `<div class="card">
    <h3>Mode d'affichage</h3>
    <div class="small muted" style="margin-bottom:8px">${simple ? 'Mode simple : langage clair, pas de chiffres compliqués. 👍' : 'Mode avancé : watts, allures, 1RM, charge…'}</div>
    <button class="btn secondary" data-action="toggle-simple">${simple ? '🔧 Passer en mode avancé' : '🙂 Revenir au mode simple'}</button>
  </div>`;

  const dataCard = `<div class="card"><h3>Mes données</h3>
    <div class="btn-row"><button class="btn secondary" data-action="export">⬇️ Sauvegarder</button>
    <button class="btn secondary" data-action="import">⬆️ Restaurer</button></div>
    <button class="btn ghost" style="margin-top:10px" data-action="reset">🗑️ Tout recommencer à zéro</button>
  </div>`;

  if (simple) {
    return `<h1 class="screen-title">⚙️ Réglages</h1>
    <form id="profileForm">
      <div class="card">
        <label>Ton prénom</label><input name="name" value="${esc(p.name)}" placeholder="Ton prénom" />
        <label>Jours par semaine</label>
        <select name="daysPerWeek">
          ${[3, 4, 5, 6].map((n) => `<option value="${n}" ${(+p.daysPerWeek || 5) === n ? 'selected' : ''}>${n} jours</option>`).join('')}
        </select>
      </div>
      <button class="btn green" type="submit" data-action="save-profile">💾 Enregistrer</button>
    </form>
    ${modeCard}
    ${dataCard}
    <div class="card"><h3>C'est quoi cette app ?</h3>
      <p class="small muted">Un programme qui mélange <b>muscu</b> et <b>cardio (triathlon)</b>. Elle commence doucement et devient un peu plus dure quand tu progresses. Chaque jour, fais ce qui est marqué, dis-lui comment tu te sens, et logge ta séance. C'est tout. 💪</p>
    </div>`;
  }

  return `<h1 class="screen-title">⚙️ Profil & réglages</h1>
  ${modeCard}
  <form id="profileForm">
    <div class="card"><h3>Repères de performance</h3>
      <p class="small muted">Mets-les à jour quand tu retestes (FTP, CSS, allure seuil) — tout le plan se recale automatiquement.</p>
      <div class="grid2">
        <div><label>Poids (kg)</label><input name="bodyweightKg" type="number" step="0.5" value="${p.bodyweightKg}" /></div>
        <div><label>FTP vélo (W)</label><input name="ftpWatts" type="number" value="${m.ftpWatts}" /></div>
        <div><label>CSS natation (s/100m)</label><input name="swimCss" type="number" value="${m.swimCss}" /></div>
        <div><label>Allure seuil (s/km)</label><input name="runThreshold" type="number" value="${m.runThreshold}" /></div>
        <div><label>FC max</label><input name="maxHr" type="number" value="${m.maxHr}" /></div>
        <div><label>FC repos</label><input name="restHr" type="number" value="${m.restHr}" /></div>
      </div>
    </div>
    <div class="card"><h3>Course</h3>
      <div class="grid2">
        <div><label>Type</label><select name="raceType">
          <option value="70.3" ${p.raceType === '70.3' ? 'selected' : ''}>70.3</option>
          <option value="full" ${p.raceType === 'full' ? 'selected' : ''}>Complet</option></select></div>
        <div><label>Date</label><input name="raceDate" type="date" value="${p.raceDate || ''}" /></div>
      </div>
    </div>
    <div class="card"><h3>1RM (kg)</h3><div class="grid2">
      ${MAIN_LIFTS.map((n) => `<div><label>${esc(n)}</label><input name="orm_${esc(n)}" type="number" step="2.5" value="${l[n] || ''}" /></div>`).join('')}
    </div></div>
    <button class="btn green" type="submit" data-action="save-profile">💾 Enregistrer</button>
  </form>
  ${dataCard}`;
}

// ============================================================ EVENTS
function bindOnce() {
  if (bound) return; bound = true;
  mountEl.addEventListener('click', onClick);
  mountEl.addEventListener('change', onChange);
  mountEl.addEventListener('submit', onSubmit);
  mountEl.addEventListener('input', onInput);
  mountEl.addEventListener('keydown', (e) => {
    if (e.target.id === 'coachInput' && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); coachSend();
    }
  });
}

function onSubmit(e) {
  const action = e.target.querySelector('[data-action]')?.dataset.action || e.submitter?.dataset.action;
  if (e.target.id === 'onboardForm') { e.preventDefault(); doOnboard(e.target); }
  else if (e.target.id === 'profileForm') { e.preventDefault(); doSaveProfile(e.target); }
}

function onChange(e) {
  const a = e.target.closest('[data-action]');
  if (a?.dataset.action === 'pick-lift') { vs.progressLift = e.target.value; rerender(); }
}

function onInput(e) {
  if (e.target.id === 'coachInput') { autoGrow(e.target); return; }
  // Mise à jour live du brouillon de log (séries muscu / champs endurance)
  if (!logDraft) return;
  const row = e.target.closest('.set-grid');
  if (row) {
    const ei = +row.dataset.ex, si = +row.dataset.set;
    const set = logDraft.exercises[ei].sets[si];
    if (e.target.classList.contains('ls-w')) set.weight = num(e.target.value);
    if (e.target.classList.contains('ls-r')) set.reps = num(e.target.value);
    if (e.target.classList.contains('ls-rpe')) set.rpe = num(e.target.value);
  }
}

function onClick(e) {
  const a = e.target.closest('[data-action]');
  if (!a) return;
  const act = a.dataset.action;
  switch (act) {
    case 'readiness': vs.readiness = a.dataset.key; rerender(); break;
    case 'week-prev': vs.planWeek--; rerender(); break;
    case 'week-next': vs.planWeek++; rerender(); break;
    case 'week-now': vs.planWeek = currentWeekIndex(getState()); rerender(); break;
    case 'log-from': openDraftFrom(JSON.parse(decodeURIComponent(a.dataset.payload))); break;
    case 'new-draft': newDraft(a.dataset.kind); break;
    case 'add-set': addSet(+a.dataset.ex); break;
    case 'del-set': delSet(+a.dataset.ex, +a.dataset.set); break;
    case 'save-log': saveLog(); break;
    case 'cancel-log': logDraft = null; rerender(); break;
    case 'del-session': delSession(a.dataset.id); break;
    case 'export': doExport(); break;
    case 'import': doImport(); break;
    case 'reset': doReset(); break;
    case 'toggle-simple': update((st) => { st.profile.simpleMode = st.profile.simpleMode === false; }); rerender(); break;
    case 'coach-savekey': coachSaveKey(); break;
    case 'coach-send': coachSend(); break;
    case 'coach-clear': coachClear(); break;
    case 'coach-settings': coachSettings(); break;
  }
}

const num = (v) => { const n = parseFloat(v); return isNaN(n) ? null : n; };

function doOnboard(form) {
  const fd = new FormData(form);
  update((st) => {
    const p = st.profile;
    p.name = fd.get('name') || '';
    p.daysPerWeek = +fd.get('daysPerWeek') || p.daysPerWeek || 5;
    p.simpleMode = true;
    st.onboarded = true;
    st.startDate = todayISO();
  });
  route = 'today'; rerender();
}

function doSaveProfile(form) {
  const fd = new FormData(form);
  const has = (k) => fd.has(k);
  update((st) => {
    const p = st.profile;
    if (has('name')) p.name = fd.get('name') || '';
    if (has('daysPerWeek')) p.daysPerWeek = +fd.get('daysPerWeek') || p.daysPerWeek;
    if (has('bodyweightKg')) p.bodyweightKg = +fd.get('bodyweightKg') || p.bodyweightKg;
    if (has('ftpWatts')) p.metrics.ftpWatts = +fd.get('ftpWatts') || p.metrics.ftpWatts;
    if (has('swimCss')) p.metrics.swimCss = +fd.get('swimCss') || p.metrics.swimCss;
    if (has('runThreshold')) p.metrics.runThreshold = +fd.get('runThreshold') || p.metrics.runThreshold;
    if (has('maxHr')) p.metrics.maxHr = +fd.get('maxHr') || p.metrics.maxHr;
    if (has('restHr')) p.metrics.restHr = +fd.get('restHr') || p.metrics.restHr;
    if (has('raceType')) p.raceType = fd.get('raceType');
    if (has('raceDate')) p.raceDate = fd.get('raceDate') || null;
    for (const n of MAIN_LIFTS) { if (has('orm_' + n)) { const v = +fd.get('orm_' + n); if (v) p.lifts1rm[n] = v; } }
  });
  toast('Enregistré ✅'); rerender();
}

function openDraftFrom(slim) {
  if (slim.kind === 'lift') {
    const simple = isSimple();
    logDraft = {
      kind: 'lift', date: todayISO(), title: slim.title, tplKey: slim.tplKey,
      exercises: slim.exercises.map((e) => ({
        name: e.name,
        sets: Array.from({ length: e.sets }, () => ({ weight: simple ? null : (e.weight || null), reps: e.reps || null, rpe: null }))
      }))
    };
  } else {
    logDraft = { kind: slim.kind, date: todayISO(), title: slim.title, zone: slim.zone, durationMin: slim.durMin || null };
  }
  route = 'log'; rerender();
}

function newDraft(kind) {
  if (kind === 'lift') {
    // Génère depuis le template muscu du jour s'il existe, sinon upperA.
    const st = getState();
    const dp = dailyPlan(st, todayISO(), vs.readiness);
    const lift = dp.sessions.find((s) => s.kind === 'lift');
    openDraftFrom(slimSession(lift || resolveDefaultLift(st)));
  } else {
    logDraft = { kind, date: todayISO(), title: DISCIPLINE_LABEL[kind], durationMin: null };
    rerender();
  }
}
function resolveDefaultLift(st) {
  const ex = LIFT_TEMPLATES.upperA;
  return { kind: 'lift', title: ex.title, tplKey: 'upperA', exercises: ex.exercises.map((e) => ({ name: e.name, sets: e.sets, reps: e.rep[0], weight: st.profile.lifts1rm[e.name] ? Math.round(st.profile.lifts1rm[e.name] * 0.7) : null })) };
}

function addSet(ei) {
  syncDraftFromDom();
  const sets = logDraft.exercises[ei].sets;
  const last = sets[sets.length - 1] || {};
  sets.push({ weight: last.weight || null, reps: last.reps || null, rpe: null });
  rerender();
}
function delSet(ei, si) { syncDraftFromDom(); logDraft.exercises[ei].sets.splice(si, 1); rerender(); }

function syncDraftFromDom() {
  if (!logDraft) return;
  const d = document.getElementById('ld_date'); if (d) logDraft.date = d.value;
  const dur = document.getElementById('ld_dur'); if (dur) logDraft.durationMin = num(dur.value);
  const dist = document.getElementById('ld_dist'); if (dist) logDraft.distanceKm = num(dist.value);
  const pow = document.getElementById('ld_pow'); if (pow) logDraft.avgPower = num(pow.value);
  const hr = document.getElementById('ld_hr'); if (hr) logDraft.avgHr = num(hr.value);
  const rpe = document.getElementById('ld_rpe'); if (rpe) logDraft.rpe = num(rpe.value);
}

function saveLog() {
  syncDraftFromDom();
  if (logDraft.kind === 'lift') {
    logDraft.exercises.forEach((ex) => { ex.sets = ex.sets.filter((s) => s.weight > 0 && s.reps > 0); });
    logDraft.exercises = logDraft.exercises.filter((ex) => ex.sets.length);
    if (!logDraft.exercises.length) { toast('Renseigne au moins une série (charge + reps).'); return; }
  } else {
    if (!logDraft.durationMin) { toast('Renseigne au moins la durée.'); return; }
  }
  update((st) => logSession(st, logDraft));
  toast('Séance enregistrée 💪');
  logDraft = null; route = 'progress'; rerender();
}

function delSession(id) {
  if (!confirm('Supprimer cette séance ?')) return;
  update((st) => { st.sessions = st.sessions.filter((s) => s.id !== id); });
  rerender();
}

function doExport() {
  const blob = new Blob([exportJSON()], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `ironforge-backup-${todayISO()}.json`;
  a.click(); URL.revokeObjectURL(a.href);
}
function doImport() {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'application/json';
  inp.onchange = () => {
    const f = inp.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { try { importJSON(r.result); toast('Importé ✅'); rerender(); } catch { toast('Fichier invalide.'); } };
    r.readAsText(f);
  };
  inp.click();
}
function doReset() {
  if (!confirm('Tout effacer et recommencer ? (pense à exporter avant)')) return;
  resetAll(); route = 'today'; logDraft = null; vs.planWeek = null; rerender();
}

// ---- Coach IA
function coachSaveKey() {
  const el = document.getElementById('coachKey');
  const v = (el?.value || '').trim();
  if (!v.startsWith('sk-ant-')) { toast('Clé invalide (format sk-ant-...).'); return; }
  setApiKey(v);
  toast('Coach activé 🔥'); rerender();
}

function coachSettings() {
  const cur = getApiKey();
  const v = prompt('Clé API Anthropic (vide = supprimer) :', cur);
  if (v === null) return;
  setApiKey(v.trim());
  toast(v.trim() ? 'Clé mise à jour' : 'Clé supprimée'); rerender();
}

function coachClear() {
  if (!confirm('Effacer toute la discussion avec le coach ?')) return;
  update((st) => { st.coachChat = []; });
  rerender();
}

function coachSend() {
  if (coachBusy) return;
  const input = document.getElementById('coachInput');
  const text = (input?.value || '').trim();
  if (!text) return;

  update((st) => { st.coachChat.push({ role: 'user', content: text }); });
  coachBusy = true;
  rerender(); // affiche le message + champ désactivé

  // Affiche la bulle de streaming
  const streamWrap = document.getElementById('coachStreaming');
  if (streamWrap) streamWrap.style.display = 'block';
  const streamBubble = streamWrap?.querySelector('.cbubble');
  let acc = '';
  scrollCoachBottom();

  const history = getState().coachChat.slice(-20).map((m) => ({ role: m.role, content: m.content }));

  streamReply(history, {
    onDelta: (chunk) => {
      acc += chunk;
      if (streamBubble) streamBubble.innerHTML = '🔥 ' + esc(acc);
      scrollCoachBottom();
    },
    onDone: (full) => {
      coachBusy = false;
      update((st) => { st.coachChat.push({ role: 'assistant', content: full || '(réponse vide)' }); });
      rerender(); scrollCoachBottom();
    },
    onError: (err) => {
      coachBusy = false;
      update((st) => { st.coachChat.push({ role: 'assistant', content: '⚠️ ' + err.message }); });
      rerender(); scrollCoachBottom();
    }
  });
}

// ---- petit toast
function toast(msg) {
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = 'position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:#1f2630;color:#fff;border:1px solid #2a313c;padding:10px 16px;border-radius:10px;z-index:99;font-size:14px;box-shadow:0 4px 20px rgba(0,0,0,.5)';
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}

function fmtDate(iso) {
  const d = new Date(iso + 'T12:00');
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}
