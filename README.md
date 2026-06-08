# 🔥 IRONFORGE — Entraînement hybride Ironman + Bodybuilding

Système d'entraînement **adaptatif** et **100% personnel** pour préparer un Ironman/70.3
tout en continuant à construire du muscle. C'est une **PWA** : tu l'installes sur ton
téléphone, elle marche **hors-ligne**, et **toutes tes données restent sur ton appareil**
(aucun serveur, aucun compte, aucun envoi en ligne).

## Mode simple (par défaut) 🙂

L'app démarre en **mode débutant** : zéro jargon, pas de chiffres compliqués. Chaque jour elle
te dit **quoi faire en français normal** (« 45 min de vélo tranquille — tu dois pouvoir
discuter », « 4 séries de 6-8 reps, prends un poids où les dernières sont dures »). Tu peux
basculer en **mode avancé** (watts, allures, 1RM, charge sRPE, ACWR…) depuis l'écran Profil.

## La philosophie

Le combo triathlon + bodybuilding est puissant mais piégeux à cause de **l'effet
d'interférence** (l'endurance peut freiner l'hypertrophie). IRONFORGE gère ça avec :

- **Macrocycle "muscu d'abord, puis endurance"** sur ~40 semaines (recalé sur ta date de course) :
  1. **Hypertrophie — Base** : on construit du muscle, endurance facile (Z2) seulement.
  2. **Force + Aérobie** : conversion en force, montée du volume aérobie + seuil (FTP, tempo).
  3. **Triathlon — Spécifique** : priorité endurance, muscu réduite à 2× maintien lourd pour garder la masse.
  4. **Pic & Affûtage** : allures de course, réduction du volume (taper) pour arriver frais.
- **Cycles de charge 3:1** : 3 semaines de progression + 1 semaine de **deload** automatique.
- **Gestion de l'interférence** : jambes lourdes séparées des séances de course de qualité,
  polarisation ~80/20 (beaucoup de facile, un peu de très dur).

## Le moteur adaptatif — « optimisé à chaque fois »

Il ne suppose **rien** sur ta forme. Il part **prudent** (≈ 90 % de tes repères) et s'ajuste :

- **Surcharge progressive muscu** basée sur tes **vraies séances loggées** (double progression
  + RPE) : tu montes la charge seulement quand tu as bouclé le haut de la fourchette de reps.
- **Ramp d'endurance bornée par l'ACWR** (ratio charge aiguë 7j / chronique 28j) pour
  augmenter le volume **sans te blesser**.
- **Auto-régulation du jour** : un check « comment tu te sens ? » qui réduit automatiquement
  charges et durées si tu es fatigué (de ×1.05 « en feu » à ×0.65 « cassé »).
- **Deload automatique** toutes les 4 semaines et **affûtage** avant la course.

## Le coach IA (💬)

En option, tu peux activer un **coach IA conversationnel propulsé par Claude (Opus)**. Tu lui
écris en langage naturel (« j'ai mal dormi, je tire un peu du genou, j'adapte comment ? ») et il
répond en connaissant **tes vraies données** : phase du macrocycle, séance du jour, ACWR, dernières
séances loggées, 1RM. Il explique le *pourquoi*, ajuste tes séances et repère les signaux d'alerte.

- Réponses en **streaming**, pensée adaptative.
- Nécessite une **clé API Anthropic** (console.anthropic.com), saisie dans l'app et stockée
  **uniquement en local** (jamais commitée, envoyée seulement à l'API Claude).
- Sans clé, l'app reste 100 % fonctionnelle : le moteur adaptatif n'a besoin d'aucune clé.

## Les écrans

- **🎯 Aujourd'hui** — ta séance du jour chiffrée (charges, watts, allures, FC), ton ressenti, ton ACWR.
- **🗺️ Plan** — vue du macrocycle complet + n'importe quelle semaine en détail.
- **💬 Coach** — chat avec ton coach IA (voir ci-dessus).
- **✍️ Logger** — enregistre tes séances (séries/reps/charge/RPE en muscu, durée/zone/puissance/FC en endurance).
- **📈 Progrès** — charge hebdo, courbe de 1RM estimé, répartition par discipline, progression du programme.
- **⚙️ Profil** — tes repères (FTP, CSS, allure seuil, 1RM) ; mets-les à jour quand tu retestes, tout se recale. Export/import de tes données.

## En ligne

**Lien direct (aucun réglage requis), servi via CDN depuis la branche `main` :**

➡️ **https://raw.githack.com/TheProdige/Training-program-iron-man/main/index.html**

Miroir : `https://cdn.jsdelivr.net/gh/TheProdige/Training-program-iron-man@main/index.html`

Sur mobile : ouvre ce lien puis « Ajouter à l'écran d'accueil » pour l'installer comme une app.

### Option : URL GitHub Pages propre

Pour une URL plus propre (`https://theprodige.github.io/Training-program-iron-man/`),
active **GitHub Pages une fois** : *Settings → Pages → Build and deployment → Source =
« GitHub Actions »*, puis lance le workflow `Deploy IRONFORGE to GitHub Pages`
(onglet Actions → Run workflow). Le token CI ne peut pas activer Pages tout seul,
d'où ce réglage manuel unique.

## Lancer en local

C'est du HTML/CSS/JS pur, **sans build ni dépendance**. Il faut juste un serveur HTTP local
(le service worker / les modules ES ne marchent pas en `file://`).

```bash
# au choix
python3 -m http.server 8080
#   ou
npx serve .
```

Puis ouvre **http://localhost:8080**. Sur mobile, « Ajouter à l'écran d'accueil » pour l'installer comme une app.

## Structure

```
index.html              coquille de l'app + navigation
manifest.webmanifest    métadonnées PWA (installable)
sw.js                   service worker (cache hors-ligne)
css/styles.css          thème sombre
js/
  app.js                routeur + enregistrement du service worker
  store.js              persistance localStorage
  data.js               bibliothèque d'exercices, phases, templates hebdo, zones
  engine.js             périodisation + planner + moteur adaptatif (progression, ACWR)
  charts.js             graphiques SVG sans dépendance
  coach.js              coach IA (appel API Claude en streaming, contexte athlète)
  views.js              rendu des écrans + interactions
.github/workflows/
  pages.yml             déploiement automatique sur GitHub Pages
```

> ⚠️ Outil de planification, pas un avis médical. Écoute ton corps, et fais valider par un pro
> si tu as un doute (santé, blessure, nutrition).
