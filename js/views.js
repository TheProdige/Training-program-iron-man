/* IRONFORGE — rendu des écrans + câblage des événements. */
import * as S from './store.js';
import * as E from './engine.js';
import { lineChart, barChart } from './charts.js';
import { askCoach } from './coach.js';
import { READINESS_QUESTIONS, RPE_HELP, PHASES } from './data.js';

const h = (strings, ...v) => strings.map((s, i) => s + (v[i] ?? '')).join('');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const num = (id) => { const v = parseFloat(document.getElementById(id).value); return isNaN(v) ? null : v; };
const val = (id) => document.getElementById(id).value.trim();

/* =================== ONBOARDING =================== */
export function renderOnboarding(el) {
  const p = S.getState().profile;
  el.innerHTML = h`
  <section class="view">
    <h1>Bienvenue 🔱</h1>
    <p class="muted">On pose ta ligne de base. Réponds à ce que tu sais, le reste se mesurera en Semaine 0.</p>
    <div class="card">
      <h3>Toi</h3>
      <label>Prénom <input id="ob-name" value="${esc(p.name)}"></label>
      <div class="row">
        <label>Âge <input id="ob-age" type="number" inputmode="numeric" value="${p.age ?? ''}"></label>
        <label>Sexe <select id="ob-sex"><option value="H"${p.sex==='H'?' selected':''}>H</option><option value="F"${p.sex==='F'?' selected':''}>F</option></select></label>
      </div>
      <div class="row">
        <label>Taille (cm) <input id="ob-h" type="number" inputmode="numeric" value="${p.heightCm ?? ''}"></label>
        <label>Poids (lb) <input id="ob-w" type="number" inputmode="decimal" value="${p.weightLb ?? ''}"></label>
      </div>
      <div class="row">
        <label>Poids cible (lb) <input id="ob-gw" type="number" inputmode="decimal" value="${p.goalWeightLb ?? ''}"></label>
        <label>Sommeil visé (h) <input id="ob-sleep" type="number" inputmode="decimal" value="${p.sleepNeed ?? 8}"></label>
      </div>
    </div>
    <div class="card">
      <h3>Cap</h3>
      <label>Curseur muscle ↔ Ironman
        <select id="ob-emph">
          <option value="balanced"${p.emphasis==='balanced'?' selected':''}>Équilibré (reco)</option>
          <option value="muscle"${p.emphasis==='muscle'?' selected':''}>Penche muscle</option>
          <option value="ironman"${p.emphasis==='ironman'?' selected':''}>Penche Ironman</option>
        </select>
      </label>
      <label>Date de course (vide = 48 semaines) <input id="ob-race" type="date" value="${p.raceDate ?? ''}"></label>
    </div>
    <div class="card">
      <h3>Repères de départ (optionnels)</h3>
      <p class="muted">${RPE_HELP}</p>
      <div class="row">
        <label>FTP vélo (W) <input id="ob-ftp" type="number" inputmode="numeric"></label>
        <label>5 km (min) <input id="ob-5k" type="number" inputmode="decimal" placeholder="22.5"></label>
      </div>
      <div class="row">
        <label>Max pompes <input id="ob-pu" type="number" inputmode="numeric"></label>
        <label>Max tractions <input id="ob-pl" type="number" inputmode="numeric"></label>
      </div>
    </div>
    <button class="btn primary big" id="ob-go">C'est parti →</button>
  </section>`;

  document.getElementById('ob-go').onclick = () => {
    S.update((st) => {
      Object.assign(st.profile, {
        name: val('ob-name'), age: num('ob-age'), sex: val('ob-sex'),
        heightCm: num('ob-h'), weightLb: num('ob-w'), goalWeightLb: num('ob-gw'),
        sleepNeed: num('ob-sleep') || 8, emphasis: val('ob-emph'),
        raceDate: val('ob-race') || null, startDate: S.todayISO()
      });
      const fk = num('ob-5k');
      Object.assign(st.benchmarks, {
        ftp: num('ob-ftp'), run5kSec: fk ? Math.round(fk * 60) : null,
        maxPushups: num('ob-pu'), maxPullups: num('ob-pl'), updatedAt: S.todayISO()
      });
      st.onboarded = true;
    });
    location.hash = '#today';
  };
}

/* =================== AUJOURD'HUI =================== */
export function renderToday(el) {
  const st = S.getState();
  const iso = S.todayISO();
  const plan = E.todayPlan(st, iso);
  const a = E.acwr(st.logs.sessions, iso);
  const flag = E.acwrFlag(a.ratio);
  const nut = E.nutritionTarget(st, iso);
  const r = st.logs.readiness.find((x) => x.date === iso);

  el.innerHTML = h`
  <section class="view">
    <div class="card hero">
      <div class="muted">${plan.phase.emoji} ${plan.phase.name} · Semaine ${plan.week.index + 1}${plan.week.deload ? ' · 🔻 DELOAD' : ''}</div>
      <h1>${esc(plan.detail.title)}</h1>
      <ul class="lines">${plan.detail.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
      <div class="muted small">Multiplicateur du jour : ×${plan.mult}</div>
    </div>

    <div class="card">
      <h3>Comment tu te sens ? ${r ? '✅' : ''}</h3>
      <div id="readiness">${READINESS_QUESTIONS.map((q) => h`
        <div class="rd-q"><span>${q.label}</span>
          <div class="rd-opts" data-key="${q.key}">
            ${q.emojis.map((e2, i) => `<button class="rd-opt${r && r[q.key]===i?' on':''}" data-v="${i}">${e2}</button>`).join('')}
          </div>
        </div>`).join('')}
      </div>
    </div>

    <div class="grid2">
      <div class="card stat"><div class="muted">ACWR</div><div class="big ${flag.level}">${a.ratio || '—'}</div><div class="small">${esc(flag.msg)}</div></div>
      <div class="card stat"><div class="muted">Macros du jour</div>
        ${nut ? h`<div class="big">${nut.kcal}<span class="unit">kcal</span></div>
        <div class="small">P ${nut.proteinG} · G ${nut.carbsG} · L ${nut.fatG} g</div>` : '<div class="small">Complète ton profil</div>'}
      </div>
    </div>

    <div class="row">
      <a class="btn primary" href="#log">✍️ Logger cette séance</a>
      <a class="btn" href="#nutrition">🍽️ Nutrition</a>
    </div>
  </section>`;

  // readiness wiring
  el.querySelectorAll('.rd-opts').forEach((group) => {
    group.querySelectorAll('.rd-opt').forEach((btn) => {
      btn.onclick = () => {
        const key = group.dataset.key, v = +btn.dataset.v;
        const entry = st.logs.readiness.find((x) => x.date === iso) || { date: iso };
        entry[key] = v;
        S.setReadiness(entry);
        renderToday(el);
      };
    });
  });
}

/* =================== PLAN =================== */
export function renderPlan(el) {
  const st = S.getState();
  const cycle = E.buildMacrocycle(st);
  const cur = E.currentWeek(st);
  el.innerHTML = h`
  <section class="view">
    <h1>🗺️ Plan</h1>
    <p class="muted">Échafaudage flexible — réécrit à chaque revue du dimanche. Total ${cycle.length} semaines.</p>
    ${PHASES.map((ph) => {
      const ws = cycle.filter((w) => w.phaseId === ph.id);
      if (!ws.length) return '';
      return h`<div class="card">
        <h3>${ph.emoji} ${ph.name}</h3>
        <div class="small muted">${ph.focus} · semaines ${ws[0].index + 1}–${ws[ws.length-1].index + 1}</div>
        <div class="weekdots">${ws.map((w) => `<span class="dot${w.index===cur.index?' cur':''}${w.deload?' deload':''}" title="Semaine ${w.index+1}${w.deload?' (deload)':''}"></span>`).join('')}</div>
      </div>`;
    }).join('')}
  </section>`;
}

/* =================== LOGGER =================== */
export function renderLog(el) {
  const iso = S.todayISO();
  el.innerHTML = h`
  <section class="view">
    <h1>✍️ Logger</h1>
    <div class="tabs" id="log-tabs">
      <button data-t="strength" class="on">💪 Muscu</button>
      <button data-t="bike">🚴 Vélo</button>
      <button data-t="run">🏃 Course</button>
      <button data-t="swim">🏊 Nage</button>
    </div>
    <div id="log-body"></div>
  </section>`;
  const body = document.getElementById('log-body');
  const tabs = document.getElementById('log-tabs');
  const show = (t) => {
    tabs.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.t === t));
    if (t === 'strength') body.innerHTML = strengthForm();
    else body.innerHTML = enduranceForm(t);
    wireLog(t, body, el);
  };
  tabs.querySelectorAll('button').forEach((b) => b.onclick = () => show(b.dataset.t));
  show('strength');
}

function strengthForm() {
  return h`
    <div class="card">
      <div id="exrows"></div>
      <button class="btn" id="add-ex">+ Ajouter un exercice</button>
      <label>Durée (min) <input id="s-dur" type="number" inputmode="numeric" value="50"></label>
      <label>RPE séance <input id="s-rpe" type="number" inputmode="decimal" min="1" max="10" value="7"></label>
      <button class="btn primary big" id="save-strength">Enregistrer</button>
    </div>`;
}
function enduranceForm(type) {
  return h`
    <div class="card">
      <label>Durée (min) <input id="e-dur" type="number" inputmode="numeric" value="50"></label>
      <label>RPE <input id="e-rpe" type="number" inputmode="decimal" min="1" max="10" value="5"></label>
      <label>Distance (km) <input id="e-dist" type="number" inputmode="decimal"></label>
      ${type === 'bike' ? '<label>Puissance moy (W) <input id="e-pw" type="number" inputmode="numeric"></label>' : ''}
      ${type === 'swim' ? '<label>Mètres <input id="e-m" type="number" inputmode="numeric"></label>' : ''}
      <label>Note <input id="e-note" placeholder="ressenti, météo…"></label>
      <button class="btn primary big" id="save-end">Enregistrer</button>
    </div>`;
}

function exRow(i) {
  return h`<div class="exrow" data-i="${i}">
    <input class="ex-name" placeholder="Exercice" list="exlist">
    <input class="ex-w" type="number" inputmode="decimal" placeholder="lb">
    <input class="ex-r" type="number" inputmode="numeric" placeholder="reps">
    <input class="ex-rir" type="number" inputmode="numeric" placeholder="RIR">
  </div>`;
}

function wireLog(type, body, rootEl) {
  const iso = S.todayISO();
  if (type === 'strength') {
    const rows = document.getElementById('exrows');
    let i = 0;
    const add = () => { rows.insertAdjacentHTML('beforeend', exRow(i++)); };
    add(); add(); add();
    if (!document.getElementById('exlist')) {
      const dl = document.createElement('datalist'); dl.id = 'exlist';
      ['Développé couché haltères','Développé incliné haltères','Développé militaire haltères','Tractions','Rowing haltère un bras','Goblet squat','Fentes marchées haltères','Soulevé roumain haltères','Gainage planche'].forEach((n) => { const o = document.createElement('option'); o.value = n; dl.appendChild(o); });
      document.body.appendChild(dl);
    }
    document.getElementById('add-ex').onclick = add;
    document.getElementById('save-strength').onclick = () => {
      const exercises = [...rows.querySelectorAll('.exrow')].map((r) => ({
        name: r.querySelector('.ex-name').value.trim(),
        weight: parseFloat(r.querySelector('.ex-w').value) || null,
        reps: parseInt(r.querySelector('.ex-r').value) || null,
        rir: r.querySelector('.ex-rir').value === '' ? null : parseInt(r.querySelector('.ex-rir').value)
      })).filter((e) => e.name);
      S.addSession({ date: iso, type: 'strength', exercises, durationMin: num('s-dur'), rpe: num('s-rpe') });
      toast('Séance muscu enregistrée 💪');
      location.hash = '#today';
    };
  } else {
    document.getElementById('save-end').onclick = () => {
      const s = { date: iso, type, durationMin: num('e-dur'), rpe: num('e-rpe'), distanceKm: num('e-dist'), note: val('e-note') };
      if (type === 'bike') s.avgPower = num('e-pw');
      if (type === 'swim') s.meters = num('e-m');
      S.addSession(s);
      toast('Séance endurance enregistrée ✅');
      location.hash = '#today';
    };
  }
}

/* =================== REVUE =================== */
export function renderReview(el) {
  const st = S.getState();
  const cur = E.currentWeek(st);
  const reviewIdx = Math.max(0, cur.index); // revue de la semaine courante
  const existing = st.logs.reviews.find((r) => r.weekIndex === reviewIdx);
  const rev = existing || E.buildWeeklyReview(st, reviewIdx);

  el.innerHTML = h`
  <section class="view">
    <h1>🔁 Revue — Semaine ${rev.weekIndex + 1}</h1>
    <div class="grid2">
      <div class="card stat"><div class="muted">Adhérence</div><div class="big">${rev.adherence}%</div><div class="small">${rev.done}/${rev.planned} séances</div></div>
      <div class="card stat"><div class="muted">ACWR</div><div class="big ${rev.flag.level}">${rev.acwr.ratio || '—'}</div><div class="small">${esc(rev.flag.msg)}</div></div>
    </div>
    <div class="card">
      <h3>Maillon faible</h3>
      ${rev.limiters.length ? rev.limiters.map((l) => `<div class="lim ${l.status}"><span>${esc(l.name)}</span><span class="small">${esc(l.detail)} · score ${l.score}</span></div>`).join('') : '<p class="muted">Fais tes tests (Semaine 0) pour activer l\'analyse.</p>'}
    </div>
    <div class="card">
      <h3>Propositions pour la semaine prochaine</h3>
      <p class="muted small">Accepte, refuse — tu décides.</p>
      <div id="proposals">${rev.proposals.map((p, i) => h`
        <div class="prop" data-i="${i}">
          <div><span class="tag">${esc(p.type)}</span> ${esc(p.text)}</div>
          <div class="prop-btns">
            <button class="mini ${p.accepted===true?'on':''}" data-a="1">✔️</button>
            <button class="mini ${p.accepted===false?'on':''}" data-a="0">✖️</button>
          </div>
        </div>`).join('')}</div>
      <button class="btn primary big" id="save-review">Enregistrer la revue</button>
    </div>
  </section>`;

  el.querySelectorAll('.prop').forEach((row) => {
    row.querySelectorAll('.mini').forEach((btn) => btn.onclick = () => {
      const i = +row.dataset.i; rev.proposals[i].accepted = btn.dataset.a === '1';
      row.querySelectorAll('.mini').forEach((b) => b.classList.remove('on'));
      btn.classList.add('on');
    });
  });
  document.getElementById('save-review').onclick = () => {
    S.saveReview(rev); toast('Revue enregistrée 🔁'); location.hash = '#today';
  };
}

/* =================== PROGRÈS =================== */
export function renderProgress(el) {
  const st = S.getState();
  el.innerHTML = h`
  <section class="view">
    <h1>📈 Progrès</h1>
    <div class="card"><h3>Charge hebdomadaire (sRPE)</h3><canvas id="c-load"></canvas></div>
    <div class="card"><h3>Poids corporel (lb)</h3><canvas id="c-weight"></canvas></div>
    <div class="card"><h3>Maillon faible</h3>
      ${E.limiterAnalysis(st).map((l) => `<div class="lim ${l.status}"><span>${esc(l.name)}</span><span class="small">${esc(l.detail)}</span></div>`).join('') || '<p class="muted">À activer après tes tests.</p>'}
    </div>
  </section>`;
  // charge hebdo (8 dernières semaines)
  const bars = [];
  for (let w = 7; w >= 0; w--) {
    let sum = 0;
    for (let d = 0; d < 7; d++) { const iso = E.addDays(S.todayISO(), -(w * 7 + d)); sum += E.dailyLoad(st.logs.sessions, iso); }
    bars.push({ v: sum });
  }
  barChart(document.getElementById('c-load'), bars);
  const wpts = st.logs.body.slice().sort((a,b)=>a.date.localeCompare(b.date)).map((b, i) => ({ x: i, y: b.weightLb }));
  lineChart(document.getElementById('c-weight'), wpts, { color: '#3da8ff' });
}

/* =================== NUTRITION =================== */
export function renderNutrition(el) {
  const st = S.getState(); const iso = S.todayISO();
  const t = E.nutritionTarget(st, iso);
  const today = st.logs.nutrition.find((n) => n.date === iso) || {};
  el.innerHTML = h`
  <section class="view">
    <h1>🍽️ Nutrition</h1>
    ${t ? h`<div class="card"><h3>Cible du jour</h3>
      <div class="macros"><span>${t.kcal} kcal</span><span>P ${t.proteinG}g</span><span>G ${t.carbsG}g</span><span>L ${t.fatG}g</span></div>
      <p class="muted small">${esc(t.note)}</p></div>` : '<div class="card"><p class="muted">Complète ton profil (poids, taille, âge).</p></div>'}
    <div class="card"><h3>Ce que tu as mangé</h3>
      <div class="row"><label>kcal <input id="n-k" type="number" value="${today.kcal ?? ''}"></label>
      <label>Protéine (g) <input id="n-p" type="number" value="${today.protein ?? ''}"></label></div>
      <div class="row"><label>Glucides (g) <input id="n-c" type="number" value="${today.carbs ?? ''}"></label>
      <label>Lipides (g) <input id="n-f" type="number" value="${today.fat ?? ''}"></label></div>
      <label>Eau (L) <input id="n-w" type="number" inputmode="decimal" value="${today.water ?? ''}"></label>
      <button class="btn primary big" id="save-nut">Enregistrer</button>
    </div>
  </section>`;
  document.getElementById('save-nut').onclick = () => {
    S.addNutrition({ date: iso, kcal: num('n-k'), protein: num('n-p'), carbs: num('n-c'), fat: num('n-f'), water: num('n-w') });
    toast('Nutrition enregistrée 🍽️');
  };
}

/* =================== CORPS =================== */
export async function renderBody(el) {
  const st = S.getState(); const iso = S.todayISO();
  const last = st.logs.body.slice(-1)[0] || {};
  el.innerHTML = h`
  <section class="view">
    <h1>📐 Corps</h1>
    <div class="card"><h3>Mensurations (lb / cm)</h3>
      <div class="row"><label>Poids <input id="b-w" type="number" inputmode="decimal" value="${last.weightLb ?? ''}"></label>
      <label>% MG <input id="b-bf" type="number" inputmode="decimal" value="${last.bodyFat ?? ''}"></label></div>
      <div class="row"><label>Taille/ventre <input id="b-waist" type="number" value="${last.waist ?? ''}"></label>
      <label>Bras <input id="b-arm" type="number" value="${last.arm ?? ''}"></label></div>
      <div class="row"><label>Poitrine <input id="b-chest" type="number" value="${last.chest ?? ''}"></label>
      <label>Cuisse <input id="b-thigh" type="number" value="${last.thigh ?? ''}"></label></div>
      <button class="btn primary big" id="save-body">Enregistrer</button>
    </div>
    <div class="card"><h3>Photos de progression</h3>
      <input type="file" accept="image/*" id="b-photo" capture="environment">
      <div id="photos" class="photos"></div>
    </div>
  </section>`;
  document.getElementById('save-body').onclick = () => {
    S.addBody({ date: iso, weightLb: num('b-w'), bodyFat: num('b-bf'), waist: num('b-waist'), arm: num('b-arm'), chest: num('b-chest'), thigh: num('b-thigh') });
    // synchronise le poids profil
    const w = num('b-w'); if (w) S.update((s) => s.profile.weightLb = w);
    toast('Mesures enregistrées 📐');
  };
  document.getElementById('b-photo').onchange = async (ev) => {
    const f = ev.target.files[0]; if (!f) return;
    await S.addPhoto(f, iso); refreshPhotos();
  };
  async function refreshPhotos() {
    const photos = await S.listPhotos();
    const wrap = document.getElementById('photos');
    wrap.innerHTML = photos.map((p) => `<figure><img src="${URL.createObjectURL(p.blob)}"><figcaption>${p.date}<button class="mini" data-id="${p.id}">🗑️</button></figcaption></figure>`).join('') || '<p class="muted">Aucune photo.</p>';
    wrap.querySelectorAll('.mini').forEach((b) => b.onclick = async () => { await S.deletePhoto(b.dataset.id); refreshPhotos(); });
  }
  refreshPhotos();
}

/* =================== COACH =================== */
let chat = [];
export function renderCoach(el) {
  const st = S.getState();
  const hasKey = !!st.settings.coachApiKey;
  el.innerHTML = h`
  <section class="view">
    <h1>💬 Coach</h1>
    ${hasKey ? '' : '<div class="card warn">Ajoute ta clé API Anthropic dans Profil pour activer le coach. L\'app reste 100% fonctionnelle sans.</div>'}
    <div id="chat" class="chat">${chat.map((m) => `<div class="msg ${m.role}">${esc(m.content)}</div>`).join('')}</div>
    <div class="composer">
      <input id="chat-in" placeholder="Ex: j'ai mal dormi, j'adapte comment ?" ${hasKey ? '' : 'disabled'}>
      <button class="btn primary" id="chat-send" ${hasKey ? '' : 'disabled'}>→</button>
    </div>
  </section>`;
  const input = document.getElementById('chat-in');
  const send = async () => {
    const text = input.value.trim(); if (!text) return;
    input.value = '';
    chat.push({ role: 'user', content: text });
    chat.push({ role: 'assistant', content: '…' });
    paint();
    try {
      await askCoach(chat.filter((m) => m.content !== '…').map((m) => ({ role: m.role, content: m.content })), (_d, full) => {
        chat[chat.length - 1].content = full; paint();
      });
    } catch (e) {
      chat[chat.length - 1].content = e.message === 'NO_KEY' ? 'Pas de clé API.' : 'Erreur : ' + e.message;
      paint();
    }
  };
  function paint() {
    const c = document.getElementById('chat');
    c.innerHTML = chat.map((m) => `<div class="msg ${m.role}">${esc(m.content)}</div>`).join('');
    c.scrollTop = c.scrollHeight;
  }
  if (document.getElementById('chat-send')) document.getElementById('chat-send').onclick = send;
  if (input) input.onkeydown = (e) => { if (e.key === 'Enter') send(); };
}

/* =================== PROFIL / PARAMÈTRES =================== */
export function renderProfile(el) {
  const st = S.getState(); const p = st.profile; const b = st.benchmarks; const eq = st.equipment;
  el.innerHTML = h`
  <section class="view">
    <h1>⚙️ Profil</h1>
    <div class="card"><h3>Repères (mets à jour après chaque test)</h3>
      <div class="row"><label>FTP (W) <input id="p-ftp" type="number" value="${b.ftp ?? ''}"></label>
      <label>5 km (min) <input id="p-5k" type="number" inputmode="decimal" value="${b.run5kSec ? (b.run5kSec/60).toFixed(1) : ''}"></label></div>
      <div class="row"><label>CSS (s/100m) <input id="p-css" type="number" value="${b.cssSec100 ?? ''}"></label>
      <label>FC max <input id="p-hr" type="number" value="${b.maxHr ?? ''}"></label></div>
      <div class="row"><label>Bench 5RM (lb) <input id="p-bench" type="number" value="${b.bench5rm ?? ''}"></label>
      <label>Squat 5RM (lb) <input id="p-squat" type="number" value="${b.squat5rm ?? ''}"></label></div>
      <div class="row"><label>Max pompes <input id="p-pu" type="number" value="${b.maxPushups ?? ''}"></label>
      <label>Max tractions <input id="p-pl" type="number" value="${b.maxPullups ?? ''}"></label></div>
      <button class="btn primary" id="save-bench">Enregistrer les repères</button>
    </div>
    <div class="card"><h3>Cap</h3>
      <label>Curseur <select id="p-emph">
        <option value="balanced"${p.emphasis==='balanced'?' selected':''}>Équilibré</option>
        <option value="muscle"${p.emphasis==='muscle'?' selected':''}>Penche muscle</option>
        <option value="ironman"${p.emphasis==='ironman'?' selected':''}>Penche Ironman</option></select></label>
      <label>Date de course <input id="p-race" type="date" value="${p.raceDate ?? ''}"></label>
      <button class="btn primary" id="save-cap">Enregistrer le cap</button>
    </div>
    <div class="card"><h3>Coach IA (optionnel)</h3>
      <p class="muted small">Clé stockée uniquement sur cet appareil, envoyée seulement à l'API Claude.</p>
      <label>Clé API Anthropic <input id="p-key" type="password" value="${esc(st.settings.coachApiKey)}" placeholder="sk-ant-..."></label>
      <label>Modèle <input id="p-model" value="${esc(st.settings.coachModel)}"></label>
      <button class="btn primary" id="save-key">Enregistrer</button>
    </div>
    <div class="card"><h3>Tes données</h3>
      <button class="btn" id="export">⬇️ Exporter (JSON)</button>
      <label class="btn">⬆️ Importer<input id="import" type="file" accept="application/json" hidden></label>
      <button class="btn danger" id="reset">🗑️ Tout réinitialiser</button>
    </div>
  </section>`;

  document.getElementById('save-bench').onclick = () => {
    S.update((s) => {
      const fk = num('p-5k');
      Object.assign(s.benchmarks, {
        ftp: num('p-ftp'), run5kSec: fk ? Math.round(fk * 60) : s.benchmarks.run5kSec,
        cssSec100: num('p-css'), maxHr: num('p-hr'), bench5rm: num('p-bench'),
        squat5rm: num('p-squat'), maxPushups: num('p-pu'), maxPullups: num('p-pl'), updatedAt: S.todayISO()
      });
    });
    toast('Repères mis à jour — tout se recale ✅');
  };
  document.getElementById('save-cap').onclick = () => {
    S.update((s) => { s.profile.emphasis = val('p-emph'); s.profile.raceDate = val('p-race') || null; });
    toast('Cap mis à jour 🗺️');
  };
  document.getElementById('save-key').onclick = () => {
    S.update((s) => { s.settings.coachApiKey = val('p-key'); s.settings.coachModel = val('p-model') || 'claude-opus-4-8'; });
    toast('Coach configuré 💬');
  };
  document.getElementById('export').onclick = () => {
    const blob = new Blob([S.exportJSON()], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `ironforge-${S.todayISO()}.json`; a.click();
  };
  document.getElementById('import').onchange = async (ev) => {
    const f = ev.target.files[0]; if (!f) return;
    try { S.importJSON(await f.text()); toast('Données importées ✅'); location.hash = '#today'; }
    catch { toast('Fichier invalide ❌'); }
  };
  document.getElementById('reset').onclick = () => {
    if (confirm('Tout effacer ? Cette action est irréversible.')) { S.resetAll(); location.hash = '#today'; location.reload(); }
  };
}

/* =================== MORE (menu) =================== */
export function renderMore(el) {
  el.innerHTML = h`
  <section class="view">
    <h1>⋯ Plus</h1>
    <div class="menu">
      <a class="card link" href="#nutrition">🍽️ Nutrition</a>
      <a class="card link" href="#body">📐 Corps & photos</a>
      <a class="card link" href="#coach">💬 Coach IA</a>
      <a class="card link" href="#profile">⚙️ Profil & données</a>
    </div>
  </section>`;
}

/* =================== toast =================== */
let toastT;
export function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2200);
}
