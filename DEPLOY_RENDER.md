# Déploiement sur Render - Configuration

## 🚨 PROBLÈME CORS ACTUEL

Le backend sur Render bloque les requêtes du frontend Vercel car l'origine n'est pas autorisée.

**Erreur:** `Access to fetch at 'https://sap-backend-tsjq.onrender.com/api/auth/login' from origin 'https://parsa-umber.vercel.app' has been blocked by CORS policy`

## ✅ SOLUTION

Ajouter l'URL Vercel dans les variables d'environnement Render.

### Étape 1 : Se connecter à Render

1. Aller sur https://dashboard.render.com
2. Se connecter avec ton compte
3. Sélectionner le service `sap-backend-tsjq`

### Étape 2 : Modifier la variable CORS_ORIGINS

1. Cliquer sur **Environment** dans le menu de gauche
2. Trouver la variable `CORS_ORIGINS`
3. Cliquer sur **Edit**

### Étape 3 : Ajouter l'URL Vercel

**Valeur actuelle (probablement) :**
```
http://localhost:3000,http://localhost:8000
```

**Nouvelle valeur (à copier-coller) :**
```
https://parsa-umber.vercel.app,https://sap-backend-tsjq.onrender.com,http://localhost:3000,http://localhost:8000
```

### Étape 4 : Sauvegarder et redéployer

1. Cliquer sur **Save Changes**
2. Render va automatiquement redéployer l'application
3. Attendre 2-3 minutes pour que le déploiement soit terminé

### Étape 5 : Vérifier

1. Retourner sur https://parsa-umber.vercel.app
2. Essayer de se connecter
3. L'erreur CORS devrait disparaître

## 📋 Liste Complète des Variables d'Environnement pour Render

Voici toutes les variables d'environnement nécessaires sur Render :

```bash
# Base de données MongoDB Atlas
MONGODB_URL=mongodb+srv://sap_mobile:Sapsap2025@cluster-clickcollect.wxb71.mongodb.net/
MONGODB_DB_NAME=test_sap_db

# JWT
JWT_SECRET_KEY=LR4C9bW4nVzhaF8rDyTYslWwO_pxROJytSfsOkcDWdY
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=1440
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7

# MFA
MFA_ENCRYPTION_KEY=40voWHR3Q2-dnQpw7lOluzBn8zVMTgxrNsKY3xRYkac

# Email (SendGrid)
SENDGRID_API_KEY=votre_cle_api_sendgrid_ici
SENDGRID_FROM_EMAIL=noreply@sap.ht
SENDGRID_FROM_NAME=Système d'Alerte Précoce

# Application
APP_ENV=production
APP_DEBUG=False
APP_HOST=0.0.0.0
APP_PORT=8000

# CORS - CRITIQUE!
CORS_ORIGINS=https://parsa-umber.vercel.app,https://sap-backend-tsjq.onrender.com,http://localhost:3000

# Scheduler
SCHEDULER_ENABLED=True
ALERT_CALCULATION_HOUR=2

# Seuils d'alerte
ALERT_THRESHOLD_SURVEILLANCE=15
ALERT_THRESHOLD_ALERTE=30
ALERT_THRESHOLD_URGENCE=50
```

## 🔍 Comment Vérifier si CORS est bien configuré

### Méthode 1 : Via les logs Render

1. Aller dans **Logs** sur Render
2. Au démarrage, tu devrais voir :
```
🔧 Configuration SAP:
  CORS Origins: ['https://parsa-umber.vercel.app', 'https://sap-backend-tsjq.onrender.com', ...]
```

### Méthode 2 : Via curl

```bash
curl -I https://sap-backend-tsjq.onrender.com/health \
  -H "Origin: https://parsa-umber.vercel.app"
```

Tu devrais voir dans la réponse :
```
Access-Control-Allow-Origin: https://parsa-umber.vercel.app
```

### Méthode 3 : Via la console du navigateur

1. Ouvrir https://parsa-umber.vercel.app
2. Ouvrir la console (F12)
3. Essayer de se connecter
4. Si CORS est OK, tu ne verras plus l'erreur rouge

## 🚀 Après la Configuration

Une fois CORS configuré, tu dois aussi :

### 1. Configurer l'URL du backend dans le frontend Vercel

Le frontend doit pointer vers le bon backend. Vérifier dans Vercel :

**Variables d'environnement Vercel :**
- `VITE_API_URL` = `https://sap-backend-tsjq.onrender.com`

Ou modifier le code du frontend pour détecter automatiquement :

```javascript
// frontend/modules/api.js
const API_BASE_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:8000'
    : 'https://sap-backend-tsjq.onrender.com';  // URL du backend Render
```

### 2. Synchroniser la base de données

Si tu utilises MongoDB Atlas, assure-toi que :
- ✅ Les utilisateurs existent dans `test_sap_db`
- ✅ Les _id sont des ObjectId
- ✅ Les rôles sont au format array: `roles: ["agent"]`

Tu peux utiliser le script :
```bash
python backend/scripts/convert_all_ids_to_objectid.py
```

## 📝 Checklist de Déploiement

- [ ] CORS_ORIGINS configuré avec l'URL Vercel
- [ ] Backend redéployé sur Render
- [ ] MongoDB Atlas accessible
- [ ] Utilisateurs créés dans test_sap_db
- [ ] Format ObjectId pour les _id
- [ ] Format array pour les roles
- [ ] Frontend Vercel pointe vers backend Render
- [ ] Test de connexion réussi

## 🆘 Dépannage

### Erreur persiste après configuration CORS

1. **Vérifier que le redéploiement est terminé**
   - Aller dans Render > Events
   - Attendre que le statut soit "Live"

2. **Vider le cache du navigateur**
   ```javascript
   // Console du navigateur
   localStorage.clear();
   location.reload();
   ```

3. **Vérifier les logs Render**
   - Chercher "CORS Origins" dans les logs
   - Confirmer que l'URL Vercel est présente

### Backend ne démarre pas

1. **Vérifier toutes les variables d'environnement**
   - Toutes les variables de `.env.production.example` doivent être définies

2. **Vérifier MongoDB Atlas**
   - L'IP de Render doit être autorisée (ou autoriser 0.0.0.0/0)
   - Les credentials MongoDB sont corrects

### Erreur 401 Unauthorized

1. **Vérifier les utilisateurs dans MongoDB**
2. **Vérifier que les mots de passe sont corrects**
3. **Vérifier le format des roles** : `["agent"]` pas `"agent"`

## 📞 Support

Si le problème persiste :
1. Consulter les logs Render (onglet Logs)
2. Consulter la console du navigateur (F12)
3. Vérifier les variables d'environnement
