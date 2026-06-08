// coach.js — Coach IA conversationnel propulsé par l'API Claude.
// Appel direct depuis le navigateur (PWA statique, pas de backend).
// La clé API est saisie par l'utilisateur et stockée UNIQUEMENT en local,
// dans une clé localStorage séparée de l'export de données (jamais commitée,
// jamais envoyée ailleurs qu'à api.anthropic.com).

import { getState } from './store.js';
import {
  buildMacro, currentWeekIndex, loadingContext, dailyPlan, computeACWR,
  todayISO, daysBetween
} from './engine.js';
import { MAIN_LIFTS, DISCIPLINE_LABEL, paceStr } from './data.js';

const KEY_STORE = 'ironforge.apikey';
const MODEL = 'claude-opus-4-8';
const ENDPOINT = 'https://api.anthropic.com/v1/messages';

export function getApiKey() { return localStorage.getItem(KEY_STORE) || ''; }
export function setApiKey(k) {
  if (k) localStorage.setItem(KEY_STORE, k.trim());
  else localStorage.removeItem(KEY_STORE);
}
export function hasApiKey() { return !!getApiKey(); }

// ----------------------------------------------------------- Contexte athlète
// Résumé compact injecté dans le system prompt pour que le coach connaisse
// les données réelles de l'utilisateur.
export function athleteContext() {
  const st = getState();
  const p = st.profile, m = p.metrics;
  const macro = buildMacro(st);
  const wk = currentWeekIndex(st);
  const ctx = loadingContext(macro, wk);
  const dp = dailyPlan(st, todayISO(), 'good');
  const acwr = computeACWR(st);

  const todaySess = dp.sessions.map((s) => {
    if (s.kind === 'rest') return 'Repos';
    if (s.kind === 'lift') return `Muscu: ${s.title}`;
    return `${DISCIPLINE_LABEL[s.kind]} ${s.durMin}min (${s.zone}) — ${s.title}`;
  }).join(' + ');

  const lifts = MAIN_LIFTS.map((n) => {
    const h = (st.history[n] || []).slice(-1)[0];
    return `${n}: ${h ? h.e1rm + 'kg (e1RM)' : (p.lifts1rm[n] || '?') + 'kg (déclaré)'}`;
  }).join(', ');

  const recent = [...st.sessions].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 8)
    .map((s) => `${s.date} ${DISCIPLINE_LABEL[s.kind] || s.kind}${s.durationMin ? ' ' + s.durationMin + 'min' : ''} RPE${s.rpe || '?'} charge${s.load}`)
    .join(' | ') || 'aucune séance loggée';

  return `PROFIL ATHLÈTE
- Poids ${p.bodyweightKg}kg, ${p.age} ans, objectif ${p.raceType === 'full' ? 'Ironman complet' : 'Ironman 70.3'}${p.raceDate ? ` le ${p.raceDate}` : ''}, ${p.daysPerWeek} j/sem.
- Repères: FTP ${m.ftpWatts}W, CSS ${paceStr(m.swimCss)}/100m, allure seuil ${paceStr(m.runThreshold)}, FCmax ${m.maxHr}, FCrepos ${m.restHr}.
- 1RM: ${lifts}

PROGRAMME (macrocycle ${macro.length} phases)
- Phase actuelle: ${ctx.phase.name} (${ctx.phase.emphasis}), semaine ${ctx.wInPhase + 1}/${ctx.phase.weeks}, semaine ${wk + 1} du macro.
- ${ctx.isDeload ? 'SEMAINE DE DELOAD.' : ctx.taper ? 'AFFÛTAGE.' : 'Semaine de charge.'} ${ctx.weeksToRace >= 0 ? ctx.weeksToRace + ' semaines avant la course.' : ''}
- Au programme aujourd'hui: ${todaySess || 'repos'}

CHARGE & FATIGUE
- ACWR ${acwr.ratio || 'n/a'} (aiguë ${acwr.acute} / chronique ${acwr.chronic}) — ${acwr.advice}

SÉANCES RÉCENTES: ${recent}`;
}

function systemPrompt() {
  return `Tu es le coach personnel d'IRONFORGE, expert en entraînement hybride (triathlon Ironman + bodybuilding) et en entraînement concurrent. Tu parles à ton athlète en français, de façon directe, motivante et concrète.

Rôle:
- Réponds à ses questions, ajuste ses séances en fonction de son ressenti, explique le "pourquoi".
- Gère l'effet d'interférence muscu/endurance, la périodisation, la surcharge progressive, la récupération et la nutrition de base.
- Donne des conseils CONCRETS et chiffrés (charges, allures, watts, durées, séries/reps) en t'appuyant sur les données réelles ci-dessous.
- Reste prudent: pars conservateur, priorise la santé, repère les signaux d'alerte (douleur articulaire, fatigue persistante, sommeil/HRV dégradés) et recommande repos ou avis médical si besoin.
- L'app ajuste déjà automatiquement le plan (surcharge, ACWR, deload, auto-régulation selon le ressenti du jour). Tu complètes par du conseil et des explications; tu ne prétends pas modifier la base de données toi-même — si une vraie modif du plan est nécessaire, dis-lui quoi changer dans l'app (Profil, ressenti du jour, etc.).
- Sois concis par défaut (quelques phrases), développe quand la question le mérite. Pas de baratin.
- Tu n'es pas médecin: pour blessure/santé, recommande un professionnel.

Voici les données actuelles de ton athlète (mises à jour à chaque message):

${athleteContext()}`;
}

// ----------------------------------------------------------- Appel streaming
// messages: [{role:'user'|'assistant', content:'...'}]
// onDelta(textChunk), onDone(fullText), onError(err)
export async function streamReply(messages, { onDelta, onDone, onError }) {
  const apiKey = getApiKey();
  if (!apiKey) { onError(new Error('Aucune clé API configurée.')); return; }

  let full = '';
  try {
    const resp = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4000,
        stream: true,
        thinking: { type: 'adaptive' },
        output_config: { effort: 'medium' },
        system: systemPrompt(),
        messages
      })
    });

    if (!resp.ok || !resp.body) {
      let msg = `Erreur API (${resp.status})`;
      try { const j = await resp.json(); msg = j?.error?.message || msg; } catch {}
      if (resp.status === 401) msg = 'Clé API invalide. Vérifie-la dans les réglages du coach.';
      throw new Error(msg);
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() || '';
      for (const block of events) {
        const line = block.split('\n').find((l) => l.startsWith('data:'));
        if (!line) continue;
        const data = line.slice(5).trim();
        if (!data || data === '[DONE]') continue;
        let evt;
        try { evt = JSON.parse(data); } catch { continue; }
        if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
          full += evt.delta.text;
          onDelta(evt.delta.text);
        } else if (evt.type === 'error') {
          throw new Error(evt.error?.message || 'Erreur de streaming');
        }
      }
    }
    onDone(full);
  } catch (e) {
    onError(e);
  }
}
