# 🌍 Architecture des Environnements - SAP

## Vue d'ensemble

Le projet SAP utilise **3 environnements distincts** :

```
Développement (Local) → Test/Staging (Netlify+Render) → Production (TBD)
```

---

## 🏠 ENVIRONNEMENT LOCAL (Développement)

### Configuration

- **Frontend** : http://localhost:3000
- **Backend** : http://localhost:8000
- **Base de données** : MongoDB local (mongodb://localhost:27017)

### Utilisation

```bash
# Démarrer tout
npm start                    # Frontend + CSS watch
cd backend && uvicorn main:app --reload --port 8000  # Backend
```

### Caractéristiques

- ✅ Hot reload activé (modifications en temps réel)
- ✅ Debug complet
- ✅ Données de test
- ✅ Service Worker désactivé
- ✅ CSS compilé automatiquement

---

## 🧪 ENVIRONNEMENT TEST/STAGING (Netlify + Render)

### ⚠️ IMPORTANT : Ceci est pour les TESTS, PAS la production !

### Configuration

- **Frontend** : Netlify
  - Repo : https://github.com/ptondoh/render (branche render)
  - URL : https://votre-app.netlify.app

- **Backend** : Render
  - Repo : https://github.com/tep-parsa/sap-minimaliste (branche render)
  - URL : https://votre-backend.onrender.com

- **Base de données** : MongoDB Atlas (test cluster)

### Utilisation

**Push vers test/staging :**

```bash
# 1. S'assurer d'être sur la bonne branche
git checkout render

# 2. Compiler le CSS
npm run tailwind:build

# 3. Commiter les changements
git add .
git commit -m "feat: nouvelle fonctionnalité"

# 4. Push vers les repos de test
git push origin render          # Backend Render
git push public render:render   # Frontend Netlify
```

### Caractéristiques

- ✅ Similaire à la production
- ✅ Base de données séparée (données test)
- ✅ Accessible par l'équipe pour validation
- ⚠️ Performance peut être limitée (plans gratuits)
- ⚠️ Ne PAS utiliser pour les vrais utilisateurs

### Quand utiliser cet environnement ?

1. **Validation fonctionnelle** : Tester nouvelles features
2. **Tests d'intégration** : Vérifier frontend + backend
3. **Démonstration** : Montrer au client/équipe
4. **Tests de charge** : Vérifier performance avant prod
5. **Formation** : Entraîner les utilisateurs

---

## 🚀 ENVIRONNEMENT PRODUCTION

### ⚠️ À DÉFINIR

L'infrastructure de production sera différente de Test/Staging.

### Configuration attendue (à valider)

- **Frontend** : Serveur dédié / CDN
- **Backend** : Serveur dédié / Cloud
- **Base de données** : MongoDB Atlas (production cluster)
- **Domaine** : sap.gouv.ht (exemple)
- **HTTPS** : Certificat SSL
- **Monitoring** : Logs et alertes

### Différences avec Test/Staging

| Aspect | Test/Staging | Production |
|--------|--------------|------------|
| Utilisateurs | Équipe interne | Vrais utilisateurs |
| Données | Données test | Données réelles |
| Performance | Limitée (gratuit) | Optimale (payant) |
| Disponibilité | Best effort | 99.9% SLA |
| Backup | Non critique | Backup quotidien |
| Monitoring | Basique | Avancé (alertes) |
| Domaine | Temporaire | Officiel (.ht) |

---

## 🔄 Workflow de Déploiement

### 1. Développement Local

```bash
# Développer et tester en local
npm start
# ... développement ...
git commit -m "feat: nouvelle fonctionnalité"
```

### 2. Push vers Test/Staging

```bash
# Pousser vers environnement de test
git checkout render
git merge refactor-stack-minimaliste
npm run tailwind:build
git push origin render
git push public render:render
```

### 3. Validation Test/Staging

- ✅ Tester toutes les fonctionnalités
- ✅ Vérifier les intégrations
- ✅ Faire valider par le client/équipe
- ✅ Tests de charge si nécessaire

### 4. Déploiement Production

```bash
# QUAND l'infrastructure prod sera prête
# (Processus à définir)
```

---

## 📋 Checklist Avant Déploiement

### Test/Staging

- [ ] CSS compilé (`npm run tailwind:build`)
- [ ] Tests locaux passent (`npm test`)
- [ ] Pas d'erreurs console
- [ ] Backend répond correctement
- [ ] Variables d'environnement configurées

### Production (à définir)

- [ ] Backup base de données
- [ ] Variables d'environnement production
- [ ] HTTPS configuré
- [ ] Domaine configuré
- [ ] Monitoring activé
- [ ] Plan de rollback préparé
- [ ] Documentation utilisateur à jour

---

## 🔐 Variables d'Environnement

### Local (.env)

```env
MONGODB_URI=mongodb://localhost:27017/sap_db
API_URL=http://localhost:8000
JWT_SECRET=dev-secret-key
```

### Test/Staging

```env
MONGODB_URI=mongodb+srv://test-cluster.mongodb.net/sap_test
API_URL=https://votre-backend.onrender.com
JWT_SECRET=staging-secret-key
```

### Production (à définir)

```env
MONGODB_URI=mongodb+srv://prod-cluster.mongodb.net/sap_prod
API_URL=https://api.sap.gouv.ht
JWT_SECRET=production-secret-key-strong
```

---

## 📊 Monitoring

### Test/Staging

- Logs Netlify (frontend)
- Logs Render (backend)
- MongoDB Atlas monitoring

### Production (à prévoir)

- Monitoring temps réel
- Alertes email/SMS
- Dashboard métriques
- Logs centralisés
- Uptime monitoring

---

## 🆘 Support

### Problème en Local

1. Vérifier : `npm run check`
2. Réinstaller : `npm run setup`
3. Voir : `GUIDE-DEMARRAGE.md`

### Problème en Test/Staging

1. Vérifier logs Netlify/Render
2. Tester en local d'abord
3. Vérifier variables d'environnement
4. Contacter l'équipe

### Problème en Production

1. **NE PAS** déployer directement
2. Reproduire en Test/Staging
3. Corriger et valider en staging
4. Puis déployer en production
5. Plan de rollback si nécessaire

---

## 📝 Notes Importantes

1. **Netlify + Render = TEST uniquement**
   - Pas assez performant pour production réelle
   - Plans gratuits avec limitations
   - Bon pour validation et démo

2. **Données séparées**
   - Local : Données de développement
   - Test/Staging : Données test
   - Production : Données réelles (à protéger !)

3. **Ne JAMAIS mélanger les environnements**
   - Pas de test sur la prod
   - Pas de données prod sur staging
   - Toujours suivre le workflow

---

**Date de mise à jour :** 4 février 2026
**Version :** 0.7
