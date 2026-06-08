# 🔱 IRONFORGE — Ironman + Musculation, à la maison

Système d'entraînement **hybride et adaptatif** : préparer un **Ironman complet** tout en
devenant **musclé et athlétique**, entièrement **à la maison**. C'est une **PWA** : tu l'installes
sur ton téléphone, elle marche **hors-ligne**, et **toutes tes données restent sur ton appareil**
(aucun serveur, aucun compte).

> Conçu sur mesure à partir d'un vrai bilan (voir [`docs/INTAKE.md`](docs/INTAKE.md)).
> Plan complet : [`docs/PLAN.md`](docs/PLAN.md) · Semaine de tests : [`docs/SEMAINE-0.md`](docs/SEMAINE-0.md).

## La philosophie : pas un plan figé, une boucle vivante 🔁

Le cœur du système est la **revue hebdomadaire** : chaque dimanche, l'app analyse tes résultats
(adhérence, KPI, ACWR, readiness, maillon faible) et **propose** des ajustements — garder, changer,
enlever, ajouter — **avec le pourquoi**. **Tu décides.** La semaine suivante se régénère sur tes
décisions. Le macrocycle (~48 semaines) n'est qu'un **échafaudage flexible**.

## Le moteur adaptatif

- **Périodisation « muscle d'abord, endurance ensuite »** pour limiter l'effet d'interférence.
- **Surcharge progressive muscu** (double progression : +5 lb quand tu boucles le haut de la fourchette).
- **Ramp d'endurance bornée par l'ACWR** (charge aiguë 7j / chronique 28j) pour progresser sans se blesser.
- **Autorégulation quotidienne** : un check « comment tu te sens ? » applique un multiplicateur (×0.65 → ×1.05).
- **Deload automatique** (1 semaine sur 4) + **affûtage** avant la course.
- **Analyse du maillon faible** : compare tes KPI aux exigences Ironman et dit quoi prioriser.

## Suivi des macros

Cibles **périodisées** selon la phase et la charge du jour : protéine haute constante, glucides qui
montent les gros jours d'endurance, calories pilotées par l'objectif. Suivi de l'adhérence.

## Les écrans

- **🎯 Aujourd'hui** — séance du jour chiffrée + check ressenti + ACWR + macros.
- **🗺️ Plan** — le macrocycle complet (phases, deloads).
- **✍️ Logger** — muscu (exos/charges/reps/RIR) et endurance (durée/zone/RPE/puissance).
- **🔁 Revue** — bilan hebdo + propositions à accepter/refuser.
- **📈 Progrès** — charge hebdo, poids, maillon faible.
- **🍽️ Nutrition** · **📐 Corps** (mesures + photos) · **💬 Coach IA** · **⚙️ Profil** (repères, export/import).

## Le coach IA (optionnel)

Chat propulsé par **Claude** qui connaît tes vraies données (phase, séance, ACWR, logs, macros,
maillon faible). Il analyse d'abord, propose ensuite, **tu tranches**. Clé API Anthropic saisie
dans l'app, **stockée uniquement en local**. Sans clé, l'app reste 100 % fonctionnelle.

## Technique

- PWA vanilla JS (modules ES), zéro dépendance, zéro build.
- Données dans `localStorage`, photos dans `IndexedDB`. Schéma versionné + **export/import JSON**.
- Hors-ligne via service worker.

## Lancer en local

```bash
python3 -m http.server 8080   # puis ouvrir http://localhost:8080
```

Ou via GitHub Pages (déploiement auto sur `main`).
