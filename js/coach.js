/* IRONFORGE — coach IA (Claude). Optionnel. La clé API reste 100% locale,
   envoyée uniquement à api.anthropic.com. Sans clé, l'app reste pleinement fonctionnelle. */
import { getState } from './store.js';
import {
  currentWeek, phaseInfo, todayPlan, acwr, acwrFlag,
  nutritionTarget, limiterAnalysis, detailToText
} from './engine.js';

const SYSTEM = `Tu es IRONFORGE, le coach personnel d'endurance et de force de l'utilisateur.
Pas un coach générique : SON coach, qui connaît ses vraies données et le pousse au maximum sans le casser.

MISSION : le préparer à FINIR un IRONMAN complet d'ici ~1 an, tout en le rendant musclé et athlétique. Entraînement à la maison. La boxe a été abandonnée : focus Ironman + musculation.

STYLE : direct, motivant, honnête, tutoiement, français, concret et chiffré. Tu expliques toujours le POURQUOI, brièvement. Tu n'inventes JAMAIS de données ; si une info manque tu le dis.

PRINCIPES : périodisation muscle d'abord puis endurance ; polarisation 80/20 ; gestion de l'interférence (protéine haute, jambes lourdes loin de la course de qualité) ; surcharge progressive bornée par l'ACWR ; autorégulation (on coupe l'intensité avant le volume, le volume avant le sommeil).

BOUCLE HEBDO (PRIORITAIRE) : tu analyses D'ABORD les résultats, PUIS tu proposes des ajustements (garder/changer/enlever/ajouter) avec le pourquoi chiffré. Tu décides AVEC l'utilisateur : tu proposes, il tranche.

GARDE-FOUS : pas médecin (douleur aiguë/thoracique/articulaire suspecte -> repos + avis médical) ; jamais de déficit calorique agressif en gros bloc d'endurance ; tu ralentis sans culpabiliser quand la readiness est mauvaise.

Réponds court, actionnable, calibré sur les données ci-dessous. Termine par UNE action concrète quand c'est pertinent.`;

export function buildContext() {
  const s = getState();
  const week = currentWeek(s);
  const phase = phaseInfo(week.phaseId);
  const plan = todayPlan(s);
  const a = acwr(s.logs.sessions);
  const nut = nutritionTarget(s);
  const lim = limiterAnalysis(s);
  const recent = s.logs.sessions.slice(-10).map((x) => `${x.date} ${x.type} rpe${x.rpe || '?'} ${x.durationMin || ''}min`).join('; ');
  const body = s.logs.body.slice(-1)[0];
  return [
    `# Profil`, `${s.profile.age} ans, ${s.profile.weightLb} lb (cible ${s.profile.goalWeightLb}), ${s.profile.heightCm} cm, emphasis=${s.profile.emphasis}.`,
    `# Repères`, `FTP=${s.benchmarks.ftp ?? '?'}W, 5k=${s.benchmarks.run5kSec ?? '?'}s, CSS=${s.benchmarks.cssSec100 ?? '?'}s/100m, bench5RM=${s.benchmarks.bench5rm ?? '?'}, pompes=${s.benchmarks.maxPushups ?? '?'}, tractions=${s.benchmarks.maxPullups ?? '?'}.`,
    `# Phase`, `${phase.name} (sem ${week.index + 1}${week.deload ? ', DELOAD' : ''}). ${phase.focus}.`,
    `# Séance du jour`, `${detailToText(plan.detail)} (intensité readiness ×${plan.mult}).`,
    `# Charge/ACWR`, `ACWR=${a.ratio} (${acwrFlag(a.ratio).msg}).`,
    `# Nutrition cible`, nut ? `${nut.kcal} kcal, P${nut.proteinG}/G${nut.carbsG}/L${nut.fatG}. ${nut.note}` : 'non calculée',
    `# Corps`, body ? `${body.date}: ${body.weightLb} lb` : 'aucune mesure',
    `# Maillon faible`, lim.map((l) => `${l.name}:${l.status}(${l.detail})`).join(' | ') || 'à mesurer',
    `# Derniers logs`, recent || 'aucun'
  ].join('\n');
}

export async function askCoach(messages, onDelta) {
  const s = getState();
  const key = s.settings.coachApiKey;
  if (!key) throw new Error('NO_KEY');
  const sys = SYSTEM + '\n\n## Données réelles de l\'utilisateur\n' + buildContext();

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: s.settings.coachModel || 'claude-opus-4-8',
      max_tokens: 1024,
      system: sys,
      stream: true,
      messages
    })
  });
  if (!resp.ok || !resp.body) {
    const t = await resp.text().catch(() => '');
    throw new Error('API ' + resp.status + ' ' + t.slice(0, 200));
  }
  const reader = resp.body.getReader();
  const dec = new TextDecoder();
  let buf = '', full = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      try {
        const ev = JSON.parse(data);
        if (ev.type === 'content_block_delta' && ev.delta?.text) {
          full += ev.delta.text;
          onDelta && onDelta(ev.delta.text, full);
        }
      } catch { /* ignore keep-alive */ }
    }
  }
  return full;
}
