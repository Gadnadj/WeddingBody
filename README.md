# Avant le oui

Carnet d'entraînement jusqu'au mariage : compte à rebours, créatine quotidienne, calendrier des séances, pesées hebdo avec courbe, photos d'évolution avec comparaison avant/après.

```
avant-le-oui/
├── backend/    → Render (Node + Express + MongoDB)
└── frontend/   → Netlify (site statique, installable sur l'écran d'accueil)
```

## 1. MongoDB Atlas (base de données)

1. Crée un cluster gratuit (M0) sur <https://www.mongodb.com/atlas>.
2. **Database Access** : crée un utilisateur avec mot de passe.
3. **Network Access** : ajoute `0.0.0.0/0` (Render n'a pas d'IP fixe en offre gratuite).
4. **Connect > Drivers** : copie l'URI `mongodb+srv://...` et remplace `<password>`. Ajoute le nom de base avant le `?` (ex. `/avantleoui`).

## 2. Render (backend)

1. Mets le dossier sur GitHub (ou seulement `backend/`).
2. Render > **New > Web Service**, branche le dépôt.
   - Root Directory : `backend` (si tu as mis tout le projet)
   - Build Command : `npm install`
   - Start Command : `npm start`
3. **Environment** : ajoute les 4 variables de `backend/.env.example` :
   - `MONGODB_URI` : l'URI d'Atlas
   - `APP_PASSWORD` : le mot de passe pour entrer dans l'appli
   - `JWT_SECRET` : une longue chaîne aléatoire
   - `FRONTEND_URL` : l'adresse Netlify (à remplir après l'étape 3, sans slash final)
4. Note l'URL du service, par exemple `https://avant-le-oui-api.onrender.com`. Tester : `/api/health` doit répondre `{"ok":true}`.

## 3. Netlify (frontend)

1. Ouvre `frontend/config.js` et remplace l'URL par celle de ton service Render.
2. Netlify > **Add new site > Deploy manually** : glisse le dossier `frontend/`.
   (Ou connecte GitHub avec *Base directory* `frontend`, sans commande de build.)
3. Copie l'adresse Netlify obtenue dans la variable `FRONTEND_URL` sur Render, puis redéploie le backend.

## 4. Sur ton téléphone

- **iPhone** (Safari) : Partager > *Sur l'écran d'accueil*.
- **Android** (Chrome) : menu ⋮ > *Installer l'application*.

Au premier lancement : mot de passe, puis date du mariage, début du programme (dimanche), poids de départ et objectif.

## À savoir

- **Offre gratuite Render** : le serveur s'endort après ~15 min sans activité, et le premier chargement peut prendre 30 à 60 s. L'appli le signale, et le « ping » automatique le garde éveillé tant qu'elle est ouverte. Pour l'éviter complètement, crée un moniteur gratuit sur uptimerobot.com qui appelle `/api/health` toutes les 5 minutes.
- **Photos** : réduites automatiquement sur le téléphone (1280 px max) puis stockées dans MongoDB. Le cluster gratuit offre 512 Mo, soit plusieurs centaines de photos.
- **Sécurité** : l'appli est protégée par un mot de passe unique (une seule personne). Choisis-en un solide.
- **Tester en local** : dans `backend/`, `npm install` puis lance avec les variables d'environnement (`MONGODB_URI=... APP_PASSWORD=... JWT_SECRET=... node server.js`). Pour le frontend, n'importe quel serveur statique fait l'affaire (`npx serve frontend`), avec `API_URL: 'http://localhost:3000'`.
