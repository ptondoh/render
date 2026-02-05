# 🚀 Guide Déploiement Vercel - SAP Frontend

## Pourquoi Vercel?

Netlify a été suspendu pour dépassement de crédits. **Vercel offre un tier gratuit généreux:**
- ✅ 100 GB bande passante/mois
- ✅ Builds illimités
- ✅ HTTPS automatique
- ✅ Custom domain gratuit
- ✅ Deploy preview pour chaque PR

---

## 📋 Prérequis

1. Compte GitHub (vous l'avez déjà)
2. Compte Vercel gratuit (à créer)
3. Backend sur Render (vous l'avez déjà)

---

## 🔧 Étape 1: Préparer le Frontend

### 1.1 Créer un fichier de configuration Vercel

Créer `vercel.json` à la racine du projet:

```json
{
  "version": 2,
  "buildCommand": "cd frontend && npm install && npm run build",
  "outputDirectory": "frontend/dist",
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "https://votre-backend.onrender.com/api/$1"
    },
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ]
}
```

### 1.2 Vérifier package.json dans frontend/

```json
{
  "scripts": {
    "build": "npm run tailwind:build",
    "tailwind:build": "tailwindcss -i ./input.css -o ./dist/output.css --minify"
  }
}
```

---

## 🌐 Étape 2: Déployer sur Vercel

### Option A: Via l'Interface Web (Recommandé)

1. **Aller sur Vercel:**
   - https://vercel.com/signup
   - Se connecter avec GitHub

2. **Importer le projet:**
   - Cliquer "Add New Project"
   - Sélectionner le repo `sap-minimaliste`
   - Choisir la branche `v0.4`

3. **Configurer le build:**
   ```
   Framework Preset: Other
   Root Directory: ./
   Build Command: cd frontend && npm install && npm run build
   Output Directory: frontend/dist
   Install Command: npm install
   ```

4. **Variables d'environnement:**
   Ajouter dans Vercel Dashboard → Settings → Environment Variables:
   ```
   VITE_API_URL=https://votre-backend.onrender.com
   ```

5. **Déployer:**
   - Cliquer "Deploy"
   - Attendre 2-3 minutes
   - Votre app sera disponible sur `https://sap-minimaliste.vercel.app`

### Option B: Via CLI

```bash
# 1. Installer Vercel CLI
npm install -g vercel

# 2. Se connecter
vercel login

# 3. Aller dans le dossier du projet
cd "C:\claude-projet\TEP\Projet-Next - refactor"

# 4. Déployer
vercel

# Suivre les prompts:
# - Set up and deploy? Yes
# - Which scope? (votre compte)
# - Link to existing project? No
# - Project name? sap-minimaliste
# - In which directory is your code? ./
# - Override build settings? Yes
#   - Build Command: cd frontend && npm install && npm run build
#   - Output Directory: frontend/dist

# 5. Déployer en production
vercel --prod
```

---

## 🔗 Étape 3: Connecter Backend Render

### 3.1 Configurer CORS sur Render

Dans votre `backend/main.py`, mettre à jour CORS:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://sap-minimaliste.vercel.app",  # ← Ajouter l'URL Vercel
        "https://*.vercel.app"  # ← Autoriser tous les preview deployments
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Commit et push → Render redéploiera automatiquement

### 3.2 Configurer l'URL Backend dans Frontend

Option 1: Via variables d'environnement Vercel
```javascript
// frontend/modules/api.js
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
```

Option 2: Auto-détection
```javascript
// frontend/modules/api.js
const API_BASE_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:8000'
    : 'https://votre-backend.onrender.com';
```

---

## ✅ Étape 4: Vérifier le Déploiement

1. **Ouvrir l'URL Vercel:**
   - https://sap-minimaliste.vercel.app

2. **Tester le système offline:**
   - Ouvrir DevTools (F12)
   - Aller dans Network tab
   - Cocher "Offline"
   - Créer une collecte
   - Décocher "Offline"
   - Vérifier sync automatique

3. **Tester login:**
   - Email: `agent@sap.ht`
   - Mot de passe: `Test123!`

---

## 🎨 Étape 5: Custom Domain (Optionnel)

Si vous avez un domaine (ex: `sap.parsa.ht`):

1. **Dans Vercel Dashboard:**
   - Project Settings → Domains
   - Add Domain: `sap.parsa.ht`

2. **Chez votre registrar DNS:**
   - Ajouter un record CNAME:
     ```
     sap.parsa.ht → cname.vercel-dns.com
     ```

3. **Attendre propagation DNS** (quelques minutes)

---

## 🔄 Déploiements Automatiques

**Chaque fois que vous push sur GitHub:**
- ✅ Vercel détecte automatiquement
- ✅ Build et deploy automatique
- ✅ Preview URLs pour chaque PR
- ✅ Production deployment sur merge vers main

---

## 📊 Monitoring et Logs

**Vercel Dashboard:**
- Deployments: Voir l'historique
- Analytics: Visiteurs, performance
- Logs: Errors et warnings
- Speed Insights: Scores de performance

**Accès:**
- https://vercel.com/dashboard

---

## 💰 Limites Tier Gratuit

| Ressource | Limite Gratuite | Votre Usage Estimé |
|-----------|-----------------|-------------------|
| Bande passante | 100 GB/mois | ~10 GB/mois ✅ |
| Builds | Illimité | ~100/mois ✅ |
| Serverless invocations | 100K/mois | ~50K/mois ✅ |
| Edge Functions | 100K/mois | N/A ✅ |

**Conclusion:** Amplement suffisant pour phase de test! 🎉

---

## 🆘 Dépannage

### Erreur: "Build failed"
```bash
# Vérifier que le build fonctionne localement
cd frontend
npm install
npm run build

# Si erreur Tailwind
npm run tailwind:build
```

### Erreur: "API calls failing"
```bash
# Vérifier l'URL backend dans api.js
# Vérifier CORS dans backend/main.py
# Vérifier que Render backend est actif
```

### Erreur: "Service Worker not working"
```bash
# Vercel sert correctement les Service Workers
# Vérifier que sw-smart.js est dans frontend/
# Vérifier dans DevTools → Application → Service Workers
```

---

## 📱 Partager avec les Agents

**URL de test:**
```
https://sap-minimaliste.vercel.app
```

**Credentials:**
```
Email: agent@sap.ht
Mot de passe: Test123!
```

**Message à envoyer:**
```
🎉 Nouvelle version SAP disponible pour tests!

URL: https://sap-minimaliste.vercel.app

Connexion:
- Email: agent@sap.ht
- Mot de passe: Test123!

Nouveautés v2.0:
✅ Système offline intelligent
✅ Collecte sans internet
✅ Synchronisation automatique
✅ Performance améliorée

Testez en mode offline:
1. Coupez votre wifi/données
2. Collectez des prix
3. Rallumez internet
4. Vérifiez la sync automatique

Merci de reporter tout bug!
```

---

## 🎯 Prochaines Étapes

1. ✅ Déployer sur Vercel (ce guide)
2. ✅ Tester avec agents terrain
3. ✅ Collecter feedback
4. ✅ Itérer et améliorer
5. 🚀 Déploiement production final

---

**Support:**
- Vercel Docs: https://vercel.com/docs
- Vercel Support: https://vercel.com/support

**Statut:** ✅ Prêt à déployer
**Coût:** $0/mois (gratuit)
**Performance:** Excellent (CDN global)
