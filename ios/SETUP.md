# 🛠️ Monter le projet dans Xcode (M0) — ~5 min

> Tu n'as **pas besoin de savoir coder**. Suis les étapes, c'est mécanique.
> Objectif M0 : voir tes **vraies données Apple Santé** dans l'app, sur ton iPhone.

## 1. Crée le projet
1. Ouvre **Xcode** → *File → New → Project…*
2. Onglet **iOS** → **App** → *Next*.
3. Renseigne :
   - **Product Name** : `Ironforge`
   - **Interface** : **SwiftUI**
   - **Language** : **Swift**
   - (laisse le reste par défaut) → *Next* → choisis un dossier → *Create*.

## 2. Mets le code à la place
1. Dans Xcode, à gauche, **supprime** les fichiers générés `ContentView.swift` et `IronforgeApp.swift`
   (clic droit → *Delete* → *Move to Trash*).
2. Glisse-dépose les fichiers du dossier **`ios/Ironforge/`** de ce repo dans le projet Xcode
   (dans le groupe « Ironforge »). Coche **« Copy items if needed »** et la **target Ironforge**.
   Fichiers : `IronforgeApp.swift`, `HealthManager.swift`, `TodayView.swift`,
   `MetricCard.swift`, `Metric.swift`, `Theme.swift`.

## 3. Active HealthKit
1. Clique sur le projet (icône bleue tout en haut) → target **Ironforge** → onglet
   **Signing & Capabilities**.
2. **+ Capability** (en haut à gauche de l'onglet) → double-clic sur **HealthKit**.

## 4. Autorise la lecture santé (texte affiché à l'utilisateur)
1. Même écran → onglet **Info** (ou ouvre `Info.plist`).
2. **+** pour ajouter une clé :
   - Clé : **Privacy - Health Share Usage Description**
   - Valeur : `IRONFORGE lit tes données santé pour analyser ta récupération et te coacher.`

## 5. Signe avec ton compte Apple (gratuit)
1. **Signing & Capabilities** → coche **Automatically manage signing**.
2. **Team** → *Add an Account…* → connecte-toi avec ton **Apple ID** (compte gratuit OK).

## 6. Lance sur TON iPhone
1. Branche ton iPhone en USB. En haut, choisis-le comme destination (au lieu du simulateur).
   > ⚠️ Lance sur le **vrai iPhone** : le simulateur n'a pas tes données (sommeil, FC repos,
   > HRV viennent de l'Apple Watch / Santé).
2. Appuie sur **▶︎ (Run)**. La 1re fois, iPhone : *Réglages → Général → VPN et gestion → Faire confiance*.
3. À l'ouverture, l'app demande l'accès à **Apple Santé** → **Autorise tout**.

✅ Tu dois voir tes tuiles se remplir : sommeil, HRV, FC repos, pas, énergie.

---

### Ça marche pas ?
- **Tout est « — »** : ouvre l'app **Santé**, vérifie que tu as bien des données (sommeil/FC) ;
  réautorise via *Réglages → Santé → Accès aux données → Ironforge*.
- **Erreur de signature** : assure-toi qu'une **Team** est sélectionnée (étape 5).
- Envoie-moi le message d'erreur exact, je corrige.
