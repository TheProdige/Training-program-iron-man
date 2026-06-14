# 🧭 IRONFORGE — Système de suivi de vie (app native iOS)

## Vision
Un système personnel qui te **traque au quotidien et en temps réel**, fusionne toutes tes
données (santé, effort, vie), et te **pilote** comme un service de coaching premium —
mais qui t'appartient. Le matériel (Apple Watch + capteurs) capte ; **on bâtit le cerveau**.

## Décisions verrouillées
- **Plateforme** : app **native iOS (SwiftUI)** — débloque HealthKit + temps réel (BLE).
- **Matériel (approche budget, pas d'Apple Watch)** :
  - **Maintenant, 0 $** : iPhone seul (pas, distance, énergie via HealthKit).
  - **Live à l'effort, ~25-40 $** : sangle cardio **Bluetooth bon marché** (Coospo/Magene/Polar H9).
  - **24/7 (sommeil/HRV/FC repos), plus tard & optionnel** : Fitbit / Apple Watch SE d'occasion / Oura.
- **Données** : 100 % sur l'appareil (stockage local). Appel au coach IA = seul flux sortant (clé perso).
- **Workflow** : le code Swift est écrit ici et commité ; build/run dans **Xcode sur le Mac**.

## Feuille de route
- **M0 — Socle** ✅ *(en cours)* : projet SwiftUI, permissions HealthKit, dashboard des
  vraies données du jour (sommeil, HRV, FC repos, FC, pas, énergie). → le premier « wow ».
- **M1 — Mémoire & tendances** : stockage local (SwiftData), historique, courbes,
  **score de récupération** (HRV + sommeil + FC repos), notifications de check-in.
- **M2 — Live à l'effort** : **Bluetooth (sangle cardio BLE ~30 $)** → cardio/zones en **direct**
  pendant la séance, enregistrement workout HealthKit. *(App Apple Watch en option si tu en as une un jour.)*
- **M3 — Le cerveau (coach IA)** : Claude branché sur toutes les données (jour + live +
  historique) → analyse, te pilote, boucle de revue hebdo.
- **M4 — Vie complète** : nutrition, habitudes, humeur/mental, (+ ce que tu veux) →
  ton dashboard de vie unifié.

## Données de départ
Bilan complet du propriétaire : voir [`INTAKE.md`](./INTAKE.md) (réutilisé du projet précédent).
