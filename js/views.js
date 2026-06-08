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

let mountEl = null;
let bound = false;
let route = 'today';
const vs = { planWeek: null, readiness: 'good', progressLift: 'Squat' };
let logDraft = null;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function mount(r) {
  route = r || route;
  mountEl = document.getElementById('app');
  bindOnce();
  const st = getState();
  if (!st.onboarded) { mountEl.innerHTML = viewOnboarding(st); updateChrome(st, 'profile'); return; }
  mountEl.innerHTML = ({
    today: viewToday, plan: viewPlan, log: viewLog, progress: viewProgress, profile: viewProfile
  }[route] || viewToday)(st);
  updateChrome(st, route);
  mountEl.scrollTo?.(0, 0);
  window.scrollTo(0, 0);
}
function rerender() { mount(route); }

function updateChrome(st, activeRoute) {
  const pill = document.getElementById('phasePill');
  if (st.onboarded) {
    const macro = buildMacro(st);
    const w = currentWeekIndex(st);
    const ctx = loadingContext(macro, w);
    pill.textContent = `${ctx.phase.name} · S${ctx.wInPhase + 1}/${ctx.phase.weeks}`;
  } else pill.textContent = 'Configuration';
  document.querySelectorAll('.tab').forEach((t) =>
    t.classList.toggle('active', t.dataset.route === activeRoute));
}

// ============================================================ ONBOARDING
function viewOnboarding(st) {
  const p = st.profile, m = p.metrics, l = p.lifts1rm;
  return `
  <h1 class="screen-title">🔥 Bienvenue dans IRONFORGE</h1>
  <div class="notice">
    Le système <b>ne suppose rien sur ta forme</b>. Tu rentres tes vrais repères ci-dessous
    (ou tu laisses les valeurs par défaut), il <b>démarre conservateur</b> et s'auto-calibre
    ensuite à partir de ce que tu logges réellement + ton ressenti du jour. Aucune donnée ne quitte ton téléphone.
  </div>
  <form id="onboardForm">
    <div class="card">
      <h3>Toi</h3>
      <label>Prénom</label><input name="name" value="${esc(p.name)}" placeholder="Ton prénom" />
      <div class="grid3">
        <div><label>Poids (kg)</label><input name="bodyweightKg" type="number" step="0.5" value="${p.bodyweightKg}" /></div>
        <div><label>Taille (cm)</label><input name="heightCm" type="number" value="${p.heightCm}" /></div>
        <div><label>Âge</label><input name="age" type="number" value="${p.age}" /></div>
      </div>
    </div>
    <div class="card">
      <h3>Objectif course</h3>
      <div class="grid2">
        <div><label>Type</label>
          <select name="raceType">
            <option value="70.3" ${p.raceType === '70.3' ? 'selected' : ''}>Ironman 70.3 (demi)</option>
            <option value="full" ${p.raceType === 'full' ? 'selected' : ''}>Ironman complet</option>
          </select>
        </div>
        <div><label>Date de course</label><input name="raceDate" type="date" value="${p.raceDate || defaultRaceDate()}" /></div>
      </div>
      <label>Jours d'entraînement / semaine</label>
      <select name="daysPerWeek">
        ${[4, 5, 6].map((n) => `<option value="${n}" ${p.daysPerWeek === n ? 'selected' : ''}>${n} jours</option>`).join('')}
      </select>
      <p class="small muted">Le plan est calé sur 5 j/sem (4 muscu + endurance, ou 2-3 muscu + endurance selon la phase).</p>
    </div>
    <div class="card">
      <h3>Repères de performance <span class="muted">(approx. ok, ajustables après)</span></h3>
      <div class="grid2">
        <div><label>FTP vélo (W)</label><input name="ftpWatts" type="number" value="${m.ftpWatts}" /></div>
        <div><label>CSS natation (sec/100m)</label><input name="swimCss" type="number" value="${m.swimCss}" /></div>
        <div><label>Allure seuil course (sec/km)</label><input name="runThreshold" type="number" value="${m.runThreshold}" /><span class="small muted">${paceStr(m.runThreshold)}</span></div>
        <div><label>FC max / FC repos</label>
          <div class="grid2"><input name="maxHr" type="number" value="${m.maxHr}" /><input name="restHr" type="number" value="${m.restHr}" /></div>
        </div>
      </div>
    </div>
    <div class="card">
      <h3>Tes maxis muscu (1RM estimé, kg)</h3>
      <p class="small muted">Pas sûr ? Mets une estimation prudente. Le moteur partira à ~90% et montera selon tes séances.</p>
      <div class="grid2">
        ${MAIN_LIFTS.map((n) => `<div><label>${esc(n)}</label><input name="orm_${esc(n)}" type="number" step="2.5" value="${l[n] || ''}" /></div>`).join('')}
      </div>
    </div>
    <button class="btn" type="submit" data-action="start-program">🚀 Démarrer mon programme</button>
  </form>`;
}
function defaultRaceDate() { return addDaysISO(todayISO(), 7 * 40); }

// ============================================================ TODAY
function viewToday(st) {
  const dp = dailyPlan(st, todayISO(), vs.readiness);
  const { ctx } = dp;
  const macro = buildMacro(st);
  const tw = totalWeeks(macro);
  const acwr = computeACWR(st);
  const done = st.sessions.filter((s) => s.date === todayISO());
  const rd = READINESS[vs.readiness];

  let badges = `<span class="badge ${ctx.phase.key}">${esc(ctx.phase.emphasis)}</span>`;
  if (ctx.taper) badges += ` <span class="badge deload">AFFÛTAGE</span>`;
  else if (ctx.isDeload) badges += ` <span class="badge deload">DELOAD</span>`;

  const sessHtml = dp.sessions.map((s) => sessionCard(s, true)).join('');

  return `
  <h1 class="screen-title">${DAY_NAMES[dp.weekday]} <span class="muted small">· ${fmtDate(todayISO())}</span></h1>
  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
      <div><h2>${esc(ctx.phase.name)}</h2><div class="small muted">Semaine ${dp.weekIdx + 1} / ${tw} du macrocycle · ${badges}</div></div>
    </div>
    <div class="small muted" style="margin-top:8px">${esc(ctx.phase.focus)}</div>
    ${ctx.weeksToRace >= 0 ? `<div class="small" style="margin-top:8px">🏁 <b>${ctx.weeksToRace}</b> semaines avant la course</div>` : ''}
  </div>

  <div class="card">
    <h3>Comment tu te sens aujourd'hui&nbsp;?</h3>
    <div class="grid3" style="grid-template-columns:repeat(5,1fr);gap:6px">
      ${Object.entries(READINESS).map(([k, v]) =>
        `<button class="btn ${k === vs.readiness ? '' : 'secondary'} small" data-action="readiness" data-key="${k}" style="flex-direction:column;font-size:11px;padding:8px 4px">${v.label}</button>`).join('')}
    </div>
    <div class="small muted" style="margin-top:8px">${esc(rd.note)} ${vs.readiness !== 'good' ? `<b>(×${rd.factor})</b>` : ''}</div>
  </div>

  <div class="notice ${acwr.status === 'high' ? 'danger' : acwr.status === 'ok' ? 'ok' : ''}">
    <b>Charge (ACWR ${acwr.ratio || '—'})</b> · aiguë 7j ${acwr.acute} / chronique ${acwr.chronic}<br/>${esc(acwr.advice)}
  </div>

  ${done.length ? `<div class="notice ok">✅ ${done.length} séance(s) loggée(s) aujourd'hui. Bien joué.</div>` : ''}

  <h3 style="margin:18px 0 8px;color:var(--muted)">Au programme aujourd'hui</h3>
  ${sessHtml || '<div class="empty">Repos</div>'}`;
}

function sessionCard(s, withLog) {
  if (s.kind === 'rest') {
    return `<div class="card acc-rest"><div class="sess"><div class="ic">😴</div><div class="body"><div class="t">Repos / récupération</div><div class="d">Mobilité, marche, sommeil. La récup, c'est là que les gains se construisent.</div></div></div></div>`;
  }
  const ic = DISCIPLINE_ICON[s.kind];
  let body = '';
  if (s.kind === 'lift') {
    body = `<ul class="ex-list">${s.exercises.map((e) =>
      `<li><span>${esc(e.name)}${e.main ? ' ⭐' : ''}${e.advice ? `<br/><span class="small muted">${esc(e.advice)}</span>` : ''}</span><span class="prescr">${esc(e.prescription)}</span></li>`).join('')}</ul>`;
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

  return `
  <h1 class="screen-title">🗺️ Plan</h1>
  <div class="card">
    <h3>Macrocycle (${tw} semaines)</h3>
    <div style="display:flex;border-radius:8px;overflow:hidden;margin:8px 0">${macroBar}</div>
    <div class="legend">${macro.map((ph) => `<span><i style="background:${ph.color}"></i>${esc(ph.name)} · ${ph.weeks}s</span>`).join('')}</div>
  </div>

  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
      <button class="btn secondary small" data-action="week-prev">‹</button>
      <div class="center"><b>Semaine ${vs.planWeek + 1}</b><div class="small muted">${esc(ctx.phase.name)} · S${ctx.wInPhase + 1}/${ctx.phase.weeks} ${ctx.isDeload ? '· <span style="color:var(--gold)">DELOAD</span>' : ''}</div></div>
      <button class="btn secondary small" data-action="week-next">›</button>
    </div>
    ${vs.planWeek !== cur ? `<button class="btn ghost small" style="margin-top:8px;width:100%" data-action="week-now">↩ Revenir à la semaine actuelle</button>` : ''}
    <div class="stat-row" style="margin-top:12px">
      <div class="stat"><div class="n red">${wp.totalLoad}</div><div class="l">Charge sRPE</div></div>
      <div class="stat"><div class="n gold">${Math.round(weekHours(wp))}h</div><div class="l">Volume</div></div>
      <div class="stat"><div class="n blue">${wp.days.flat().filter((s) => s.kind !== 'rest').length}</div><div class="l">Séances</div></div>
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

  const recent = [...st.sessions].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 12);
  const recentHtml = recent.length ? recent.map((s) => `
    <div class="sess">
      <div class="ic">${DISCIPLINE_ICON[s.kind]}</div>
      <div class="body">
        <div class="t">${esc(s.title || DISCIPLINE_LABEL[s.kind])}</div>
        <div class="d">${fmtDate(s.date)} · ${s.durationMin ? s.durationMin + ' min · ' : ''}RPE ${s.rpe || '—'} · charge ${s.load}</div>
      </div>
      <button class="x-set" data-action="del-session" data-id="${s.id}" title="Supprimer">🗑️</button>
    </div>`).join('') : '<div class="empty small">Aucune séance loggée pour l\'instant.</div>';

  return `<h1 class="screen-title">✍️ Logger</h1>${form}
    <div class="card"><h3>Séances récentes</h3>${recentHtml}</div>`;
}

function logFormHtml(d) {
  const dateInput = `<label>Date</label><input id="ld_date" type="date" value="${d.date}" />`;
  if (d.kind === 'lift') {
    const exs = d.exercises.map((ex, i) => {
      const rows = ex.sets.map((s, j) => `
        <div class="set-grid" data-ex="${i}" data-set="${j}">
          <div class="small muted center">${j + 1}</div>
          <input class="ls-w" inputmode="decimal" value="${s.weight ?? ''}" placeholder="kg" />
          <input class="ls-r" inputmode="numeric" value="${s.reps ?? ''}" placeholder="reps" />
          <input class="ls-rpe" inputmode="decimal" value="${s.rpe ?? ''}" placeholder="RPE" />
          <button class="x-set" data-action="del-set" data-ex="${i}" data-set="${j}">✕</button>
        </div>`).join('');
      return `<div class="card acc-lift" style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:center"><b>${esc(ex.name)}</b></div>
        <div class="set-grid"><div class="h">#</div><div class="h">Charge</div><div class="h">Reps</div><div class="h">RPE</div><div></div></div>
        ${rows}
        <button class="btn ghost small" style="margin-top:8px;width:100%" data-action="add-set" data-ex="${i}">+ série</button>
      </div>`;
    }).join('');
    return `<div class="card"><h3>${esc(d.title)}</h3>${dateInput}
      <label>Durée totale (min, optionnel)</label><input id="ld_dur" type="number" value="${d.durationMin || ''}" placeholder="ex: 70" />
      </div>${exs}
      <div class="btn-row"><button class="btn green" data-action="save-log">✅ Enregistrer</button>
      <button class="btn ghost" data-action="cancel-log" style="width:auto">Annuler</button></div>`;
  }
  // Endurance
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

  return `<h1 class="screen-title">📈 Progrès</h1>
  <div class="card"><div class="stat-row">
    <div class="stat"><div class="n red">${total}</div><div class="l">Séances</div></div>
    <div class="stat"><div class="n gold">${load28}</div><div class="l">Charge 28j</div></div>
    <div class="stat"><div class="n green">${streak}</div><div class="l">Série (j)</div></div>
    <div class="stat"><div class="n blue">${ctx.weeksToRace}</div><div class="l">Sem. → course</div></div>
  </div></div>

  <div class="card"><h3>Progression du macrocycle</h3>
    <div class="bar"><i style="width:${Math.round(((cur + 1) / tw) * 100)}%"></i></div>
    <div class="small muted" style="margin-top:6px">Semaine ${cur + 1} / ${tw} · ${esc(ctx.phase.name)}</div>
  </div>

  <div class="card"><h3>Charge hebdomadaire (sRPE)</h3>${barChart(bars)}
    <div class="small muted">Indicateur d'entraînement total. Les pics suivis de creux = bonne périodisation.</div>
  </div>

  <div class="card"><h3>Force — 1RM estimé</h3>
    <select data-action="pick-lift" style="margin-bottom:10px">
      ${MAIN_LIFTS.map((n) => `<option value="${esc(n)}" ${n === vs.progressLift ? 'selected' : ''}>${esc(n)}</option>`).join('')}
    </select>
    ${liftHist.length ? lineChart(liftSeries) : '<div class="empty small"><div class="big">🏋️</div>Logge des séances de muscu pour voir ta courbe de force.</div>'}
    ${liftHist.length ? `<div class="small muted">Dernier e1RM : <b>${liftHist[liftHist.length - 1].e1rm} kg</b> · départ ${liftHist[0].e1rm} kg</div>` : ''}
  </div>

  <div class="card"><h3>Répartition par discipline (28j)</h3>${barChart(discBars)}</div>`;
}
function computeStreak(st) {
  const dates = new Set(st.sessions.map((s) => s.date));
  let streak = 0, cursor = todayISO();
  // tolère 1 jour de repos : on compte les jours actifs des 30 derniers jours
  for (let i = 0; i < 60; i++) { if (dates.has(addDaysISO(cursor, -i))) streak++; else if (i > 0 && !dates.has(addDaysISO(cursor, -i)) && !dates.has(addDaysISO(cursor, -(i + 1)))) break; }
  return streak;
}

// ============================================================ PROFILE
function viewProfile(st) {
  const p = st.profile, m = p.metrics, l = p.lifts1rm;
  return `<h1 class="screen-title">⚙️ Profil & réglages</h1>
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
  <div class="card" style="margin-top:14px"><h3>Données</h3>
    <div class="btn-row"><button class="btn secondary" data-action="export">⬇️ Exporter</button>
    <button class="btn secondary" data-action="import">⬆️ Importer</button></div>
    <button class="btn ghost" style="margin-top:10px" data-action="reset">🗑️ Tout réinitialiser</button>
  </div>
  <div class="card"><h3>Comment ça marche</h3>
    <p class="small muted">Macrocycle bodybuilding → endurance, cycles de charge 3:1 (deload auto), surcharge progressive sur la muscu (basée sur tes vraies séances), ramp d'endurance bornée par l'ACWR pour éviter la blessure, et auto-régulation selon ton ressenti du jour. Bref : ça part prudent et ça s'adapte à <b>toi</b>.</p>
  </div>`;
}

// ============================================================ EVENTS
function bindOnce() {
  if (bound) return; bound = true;
  mountEl.addEventListener('click', onClick);
  mountEl.addEventListener('change', onChange);
  mountEl.addEventListener('submit', onSubmit);
  mountEl.addEventListener('input', onInput);
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
  }
}

const num = (v) => { const n = parseFloat(v); return isNaN(n) ? null : n; };

function doOnboard(form) {
  const fd = new FormData(form);
  update((st) => {
    const p = st.profile;
    p.name = fd.get('name') || '';
    p.bodyweightKg = +fd.get('bodyweightKg') || p.bodyweightKg;
    p.heightCm = +fd.get('heightCm') || p.heightCm;
    p.age = +fd.get('age') || p.age;
    p.raceType = fd.get('raceType');
    p.raceDate = fd.get('raceDate') || null;
    p.daysPerWeek = +fd.get('daysPerWeek') || 5;
    p.metrics.ftpWatts = +fd.get('ftpWatts') || p.metrics.ftpWatts;
    p.metrics.swimCss = +fd.get('swimCss') || p.metrics.swimCss;
    p.metrics.runThreshold = +fd.get('runThreshold') || p.metrics.runThreshold;
    p.metrics.maxHr = +fd.get('maxHr') || p.metrics.maxHr;
    p.metrics.restHr = +fd.get('restHr') || p.metrics.restHr;
    for (const n of MAIN_LIFTS) { const v = +fd.get('orm_' + n); if (v) p.lifts1rm[n] = v; }
    st.onboarded = true;
    st.startDate = todayISO();
  });
  route = 'today'; rerender();
}

function doSaveProfile(form) {
  const fd = new FormData(form);
  update((st) => {
    const p = st.profile;
    p.bodyweightKg = +fd.get('bodyweightKg') || p.bodyweightKg;
    p.metrics.ftpWatts = +fd.get('ftpWatts') || p.metrics.ftpWatts;
    p.metrics.swimCss = +fd.get('swimCss') || p.metrics.swimCss;
    p.metrics.runThreshold = +fd.get('runThreshold') || p.metrics.runThreshold;
    p.metrics.maxHr = +fd.get('maxHr') || p.metrics.maxHr;
    p.metrics.restHr = +fd.get('restHr') || p.metrics.restHr;
    p.raceType = fd.get('raceType');
    p.raceDate = fd.get('raceDate') || null;
    for (const n of MAIN_LIFTS) { const v = +fd.get('orm_' + n); if (v) p.lifts1rm[n] = v; }
  });
  toast('Profil enregistré ✅'); rerender();
}

function openDraftFrom(slim) {
  if (slim.kind === 'lift') {
    logDraft = {
      kind: 'lift', date: todayISO(), title: slim.title, tplKey: slim.tplKey,
      exercises: slim.exercises.map((e) => ({
        name: e.name,
        sets: Array.from({ length: e.sets }, () => ({ weight: e.weight || null, reps: e.reps || null, rpe: null }))
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
