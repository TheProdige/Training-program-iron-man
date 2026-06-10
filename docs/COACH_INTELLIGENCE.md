# 🧠 IRONFORGE Intelligence — design du coach augmenté

> Objectif : transformer le coach en **intelligence holistique** qui capte tout (récup, sommeil,
> nutrition, entraînement, corps, vie), **fusionne** ces signaux en décisions, et **pousse
> l'athlète au max de sa forme du jour, sans le casser.** Meilleure shape, le plus vite possible.

## Architecture en 2 couches

**1. Moteur déterministe (dans l'app, hors-ligne, sans clé)** — le « réflexe » :
- Calcule le **score de readiness (0-100)**, la **directive du jour**, l'**ACWR**, les **tendances**,
  les **alertes**, la **revue hebdo**. Marche partout, tout le temps, gratuit.

**2. Couche de raisonnement (Claude)** — le « cerveau » :
- Briefings en langage naturel, **insights croisés** entre piliers, **lecture des photos de repas**
  (macros), réécriture du plan, réponses aux questions.
- **Mode actuel : via les sessions Claude** (l'accès existant de l'utilisateur — aucun coût API).
  L'app **exporte un snapshot** structuré que l'utilisateur amène au coach.
- **Mode futur (option) : clé API Anthropic** dans l'app → intelligence autonome embarquée
  (briefing auto, photos-macros in-app). Coût : centimes/jour. Stockée 100% en local.

> Rappel : abonnement claude.ai ≠ API. L'app sans serveur ne peut pas utiliser l'abonnement ;
> d'où le mode « via les sessions » qui exploite l'accès existant sans clé.

## Les données captées (les piliers)

| Pilier | Données | Source |
|---|---|---|
| 🏋️ Entraînement | séances, sRPE, ACWR, volume/discipline, intensité 80/20, progression force | log app |
| 😴 Sommeil | durée, qualité, régularité, dette | check matin (ou Fitbit) |
| ❤️ Récupération | FC repos, VFC, courbatures, humeur, motivation, stress, énergie | check matin (ou Fitbit) |
| 🍽️ Nutrition | kcal, macros, protéine g/lb, hydratation, fueling, alcool, adhérence | log app + **photos→IA** |
| ➕ Corps & vie | poids lissé, mensurations, % MG, photos, pas/activité | log app (ou Fitbit) |

## Le score de readiness (0-100)

Fusion pondérée, calculée chaque matin :
- **Bien-être ~50 %** : moyenne de qualité de sommeil, courbatures, énergie, humeur, stress, motivation.
- **Durée de sommeil ~25 %** : ratio vs ton besoin (8 h).
- **Charge / ACWR ~15 %** : optimal si ACWR ∈ [0.8, 1.3], pénalisé au-delà.
- **FC repos ~10 %** : pénalité si élevée vs ta base (sinon redistribué).

### Directive du jour (pilote l'autorégulation)
| Score | Directive | Effet | Multiplicateur |
|---|---|---|---|
| ≥ 80 | 🟢 **Pousse** | ajoute une série / allonge la sortie | ×1.05 |
| 65-79 | 🟡 **Vas-y normal** | séance comme prévu | ×1.0 |
| 50-64 | 🟠 **Allège** | -15 à -25 %, baisse l'intensité | ×0.85 |
| < 50 | 🔴 **Récupère** | repos actif ou très facile | ×0.7 |

> En semaine de deload, la directive est plafonnée à 🟡.

## Les alertes croisées (proactives)
- **Dette de sommeil** : moyenne 7 j < besoin − 0.5 h.
- **ACWR à risque** : ratio > 1.4 → on consolide.
- **Sous-alimentation** : protéine moyenne 3 j < 80 % de la cible, ou kcal trop bas en gros bloc.
- **Readiness basse répétée** : 3 jours < 55 → on impose une vraie récup.
- **Monotonie** : 7 jours sans repos → risque, on insère du repos.
- **Feu vert gâché** : ACWR bas + readiness haute → « tu peux pousser plus, on en rajoute ».

## Rituel proactif (matin + soir)
- **Matin** : check 30 s → score + directive + 1 action claire + séance ajustée.
- **Soir** : « séance faite ? RPE ? bouffe ok ? » → alimente l'analyse du lendemain.

## Roadmap de build
1. **Check matin enrichi** (sommeil h + qualité, FC repos, courbatures, énergie, humeur, stress, motivation).
2. **Moteur de score + directive** (remplace le multiplicateur simple).
3. **Briefing du jour** sur l'écran Aujourd'hui + **alertes**.
4. **Check du soir** + adhérence nutrition rapide + hydratation.
5. **Revue hebdo multi-piliers** (intègre sommeil/récup/nutrition).
6. **Photos→macros** : via les sessions Claude maintenant ; in-app (clé API) plus tard.
7. **Intégration Fitbit** (upgrade) : import des données sommeil/FC/pas.
