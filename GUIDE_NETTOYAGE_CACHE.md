# Guide de Nettoyage du Cache - SAP

## Problème
Tous les rôles (agent, décideur, bailleur) voient la même interface UI avec tous les menus.

## Cause
Le cache du navigateur contient l'ancienne version de l'objet `user` **sans** le champ `role_names` nécessaire pour le nouveau système RBAC.

---

## Solution Rapide (Recommandée)

### Option 1 : Page de Nettoyage Automatique

1. Ouvrir dans le navigateur :
   ```
   http://localhost:3000/force-refresh.html
   ```

2. Cliquer sur **"Nettoyer et Reconnecter"**

3. Attendre la redirection automatique vers la page de login

4. Se reconnecter avec vos identifiants

✅ **Terminé !** Les menus s'afficheront correctement selon votre rôle.

---

### Option 2 : Nettoyage Manuel

1. **Ouvrir la Console du Navigateur**
   - Chrome/Edge : `F12` ou `Ctrl+Shift+J`
   - Firefox : `F12` ou `Ctrl+Shift+K`

2. **Exécuter ces commandes dans la console :**
   ```javascript
   // Vider localStorage
   localStorage.clear();

   // Vider sessionStorage
   sessionStorage.clear();

   // Désinscrire Service Workers
   navigator.serviceWorker.getRegistrations().then(registrations => {
       registrations.forEach(r => r.unregister());
   });

   // Vider les caches
   caches.keys().then(names => {
       names.forEach(name => caches.delete(name));
   });

   // Recharger la page
   location.reload(true);
   ```

3. **Se reconnecter**

---

### Option 3 : Hard Refresh + Déconnexion

1. Se déconnecter de l'application (bouton Déconnexion)

2. Faire un **Hard Refresh** :
   - Windows : `Ctrl + F5` ou `Ctrl + Shift + R`
   - Mac : `Cmd + Shift + R`

3. Se reconnecter

---

## Vérification du Succès

Après reconnexion, **chaque rôle doit voir** :

### 👤 Agent
- ✅ Menus visibles : Tableau de bord, Collectes, Alertes
- ❌ Menus cachés : Analyse, Administration

### 👔 Décideur
- ✅ Menus visibles : Tableau de bord, Collectes, Alertes, **📊 Analyse**
- ❌ Menus cachés : Administration

### 👨‍💼 Bailleur
- ✅ Menus visibles : Tableau de bord, Collectes, Alertes, **📊 Analyse**, **Administration**

---

## Comptes de Test Disponibles

```
Agent     : agent.test@sap.ht     / Agent123!
Décideur  : decideur.test@sap.ht / Decideur123!
Bailleur  : admin@sap.ht          / Test123!
```

---

## Vérification Technique (Développeurs)

Pour vérifier que `role_names` est bien présent :

1. Ouvrir la Console (F12)

2. Après connexion, exécuter :
   ```javascript
   JSON.parse(localStorage.getItem('user'))
   ```

3. Vérifier que l'objet contient :
   ```javascript
   {
     email: "...",
     roles: ["<objectid>"],          // ⚠️ Ancien format (ObjectIds)
     role_names: ["agent"]            // ✅ Nouveau format (noms)
   }
   ```

Si `role_names` est **absent**, le cache doit être nettoyé.

---

## Protection Automatique

✅ **Depuis la dernière mise à jour**, l'application détecte automatiquement l'ancien format et force la reconnexion avec un message :

> "Veuillez vous reconnecter suite à une mise à jour du système"

**Mais** les utilisateurs **déjà connectés** doivent d'abord se déconnecter ou nettoyer le cache manuellement.

---

## Support

Si le problème persiste après nettoyage :

1. Vérifier que le backend est bien démarré
2. Vérifier que le script seed a été exécuté :
   ```bash
   python backend/scripts/seed_permissions_roles.py
   python backend/scripts/create_test_users_rbac.py
   ```
3. Vérifier les logs console du navigateur (F12)
4. Vérifier les logs du backend

---

**Date de création** : 2026-02-24
**Version SAP** : 1.1.0 (avec RBAC dynamique)
