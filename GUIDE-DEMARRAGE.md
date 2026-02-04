# 🚀 Guide de Démarrage SAP - GARANTI SANS ERREUR

## ⚡ Démarrage Rapide (recommandé)

```bash
# Tout en une seule commande
npm start
```

Cette commande :
- ✅ Vérifie que tout est configuré
- ✅ Compile automatiquement le CSS Tailwind
- ✅ Démarre le serveur frontend (port 3000)
- ✅ Active le watch mode pour CSS

## 📋 Première Installation

Si c'est la première fois que vous clonez le projet :

```bash
# Installation complète
npm run setup
```

Cette commande :
- Installe toutes les dépendances (npm install)
- Compile le CSS Tailwind
- Vérifie que tout est OK

## 🔍 Vérification Manuelle

Pour vérifier que tout est prêt sans démarrer :

```bash
npm run check
```

**Sortie attendue :**
```
✅ CSS Tailwind présent (27.xx KB)
✅ Fichier .env présent
✅ node_modules présent
✅ Tout est prêt !
```

## 🛠️ Commandes Disponibles

### Développement

```bash
# Démarrage complet (recommandé)
npm start

# Développement avec watch mode
npm run dev

# Frontend seulement
npm run serve

# Backend seulement (dans un autre terminal)
cd backend
uvicorn main:app --reload --port 8000
```

### Build CSS

```bash
# Compiler le CSS (production)
npm run tailwind:build

# Compiler et surveiller les changements
npm run tailwind:watch
```

### Tests

```bash
# Tous les tests
npm test

# Interface de test Playwright
npm run test:ui
```

## 🚨 En Cas de Problème

### CSS manquant (page sans style)

```bash
# Solution 1 : Recompiler le CSS
npm run tailwind:build

# Solution 2 : Redémarrer avec npm start
npm start
```

### Mode "hors-ligne" persistant

1. Ouvrir : http://localhost:3000/uninstall-sw.html
2. Cliquer sur le bouton
3. Attendre le rechargement automatique

### Cache bloqué

1. Ouvrir : http://localhost:3000/clear-sw-cache.html
2. Suivre les instructions
3. Rafraîchir la page (Ctrl+Shift+R)

### Tout réinitialiser

```bash
# Supprimer et réinstaller tout
rm -rf node_modules package-lock.json frontend/dist
npm run setup
```

## 📂 Structure du Projet

```
sap-minimaliste/
├── frontend/
│   ├── index.html              # Page principale
│   ├── app.js                  # Router et logique
│   ├── styles.css              # Styles source Tailwind
│   ├── dist/
│   │   └── output.css          # ✅ CSS compilé (TOUJOURS présent)
│   ├── modules/
│   │   ├── api.js              # Client API
│   │   ├── auth.js             # Authentification
│   │   └── ui.js               # Composants UI
│   ├── pages/
│   │   ├── dashboard.js
│   │   ├── collectes.js
│   │   ├── alertes.js
│   │   ├── admin-*.js          # Pages administration
│   │   └── ...
│   ├── clear-sw-cache.html     # Outil nettoyage cache
│   └── uninstall-sw.html       # Désinstallation SW
├── backend/
│   ├── main.py                 # FastAPI app
│   ├── routers/                # Endpoints API
│   ├── models.py               # Modèles MongoDB
│   └── ...
├── check-setup.js              # ✅ Script de vérification
├── package.json                # ✅ Scripts automatiques
└── SERVICE-WORKER-EXPLICATIONS.md  # Documentation complète
```

## ✅ Garanties

### CSS Toujours Disponible

Le fichier `frontend/dist/output.css` est :
- ✅ Présent dans Git
- ✅ Compilé automatiquement avant chaque démarrage
- ✅ Vérifié par `npm run check`

**Vous ne verrez JAMAIS plus d'erreur "404 output.css"**

### Service Worker Désactivé

Le Service Worker est **temporairement désactivé** pour éviter :
- ❌ Problèmes de cache
- ❌ Anciennes versions servies
- ❌ Message "Mode hors-ligne" erroné

Nous le réactiverons plus tard avec une meilleure stratégie.

### Scripts Automatiques

Chaque fois que vous lancez `npm start` ou `npm run dev` :
1. Le CSS est automatiquement compilé (npm run prestart)
2. La configuration est vérifiée
3. Le serveur démarre seulement si tout est OK

## 🎯 Workflow Recommandé

### Développement quotidien

```bash
# Terminal 1 : Frontend + CSS watch
npm start

# Terminal 2 : Backend
cd backend
uvicorn main:app --reload --port 8000
```

### Avant de commiter

```bash
# Vérifier que tout est OK
npm run check

# Recompiler le CSS (si nécessaire)
npm run tailwind:build

# Tester
npm test
```

### Déploiement

```bash
# Production build du CSS
npm run tailwind:build

# Vérifier
npm run check

# Commiter tout
git add .
git commit -m "..."
git push
```

## 📞 Support

Si vous voyez une erreur non documentée ici :

1. Vérifier la console du navigateur (F12)
2. Exécuter `npm run check`
3. Lire `SERVICE-WORKER-EXPLICATIONS.md`
4. Essayer `npm run setup` (réinstallation complète)

---

**Plus jamais de problème CSS ou Service Worker ! 💪**
