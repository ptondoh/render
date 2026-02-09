# Gestion des Versions - SAP

## Système de Versioning Automatique

L'application dispose d'un système de gestion de versions qui vide automatiquement le cache du navigateur quand la structure de données change. Cela évite les problèmes de compatibilité après une mise à jour.

## Comment ça fonctionne

### 1. Détection automatique
- Au démarrage de l'application, la version est vérifiée
- Si la version a changé, le cache est automatiquement vidé
- L'utilisateur est notifié et redirigé vers la page de login si nécessaire

### 2. Version actuelle
La version est définie dans `frontend/modules/version-manager.js` :
```javascript
const APP_VERSION = '1.1.0';
```

### 3. Quand incrémenter la version

#### Version MAJEURE (x.0.0) - Changements incompatibles
- Refonte complète de l'architecture
- Changements majeurs de la base de données
- Suppression de fonctionnalités existantes
- Migration complexe requise

**Exemple :** 1.0.0 → 2.0.0

#### Version MINEURE (1.x.0) - Nouvelles fonctionnalités
- Ajout de nouvelles fonctionnalités
- Changements de structure de données (roles, champs, etc.)
- Modifications de l'API
- Ajout de nouveaux modules

**Exemple :** 1.0.0 → 1.1.0

#### Version PATCH (1.0.x) - Corrections
- Corrections de bugs
- Améliorations de performance
- Mises à jour de style
- Pas de changement de structure de données

**Exemple :** 1.0.0 → 1.0.1

## Procédure de mise à jour

### Étape 1 : Identifier le type de changement

Posez-vous ces questions :
- ✅ Est-ce qu'il y a un changement de structure de données ? → Version MINEURE
- ✅ Est-ce qu'il y a un changement d'API ? → Version MINEURE
- ✅ Est-ce une simple correction de bug ? → Version PATCH
- ✅ Est-ce une refonte majeure ? → Version MAJEURE

### Étape 2 : Modifier la version

Éditez `frontend/modules/version-manager.js` :

```javascript
// Avant
const APP_VERSION = '1.0.0';

// Après (exemple: ajout de fonctionnalité)
const APP_VERSION = '1.1.0';
```

### Étape 3 : Ajouter une migration si nécessaire

Si vous changez la structure de données, ajoutez une migration dans la fonction `migrateData()` :

```javascript
export function migrateData(fromVersion) {
    console.log(`[Migration] Début de la migration depuis ${fromVersion}`);

    try {
        // Exemple: Migration pour la version 1.2.0
        if (fromVersion < '1.2.0') {
            console.log('[Migration] Migration vers 1.2.0...');

            // Votre code de migration ici
            const userStr = localStorage.getItem('user');
            if (userStr) {
                const user = JSON.parse(userStr);
                // Modifier la structure...
                localStorage.setItem('user', JSON.stringify(user));
            }

            console.log('[Migration] ✅ Migration 1.2.0 terminée');
        }

        console.log('[Migration] ✅ Migration terminée');

    } catch (error) {
        console.error('[Migration] Erreur lors de la migration:', error);
    }
}
```

### Étape 4 : Tester

1. Ouvrez l'application avec l'ancienne version
2. Connectez-vous et naviguez
3. Déployez la nouvelle version
4. Rafraîchissez la page (F5)
5. Vérifiez que :
   - ✅ Le cache est vidé automatiquement
   - ✅ La notification s'affiche
   - ✅ L'utilisateur est redirigé vers login
   - ✅ La migration s'exécute correctement
   - ✅ Les données sont préservées (si migration)

### Étape 5 : Commit

```bash
git add frontend/modules/version-manager.js
git commit -m "chore: Bump version to X.X.X"
```

## Exemples de changements

### Exemple 1 : Ajout d'un nouveau champ utilisateur
```javascript
// Version: 1.0.0 → 1.1.0
const APP_VERSION = '1.1.0'; // Changed: Added user.departement_id

// Migration
if (fromVersion < '1.1.0') {
    // Pas de migration nécessaire, nouveau champ optionnel
}
```

### Exemple 2 : Changement de structure (roles)
```javascript
// Version: 1.0.0 → 1.1.0
const APP_VERSION = '1.1.0'; // Changed: roles string → array

// Migration
if (fromVersion < '1.1.0') {
    const userStr = localStorage.getItem('user');
    if (userStr) {
        const user = JSON.parse(userStr);
        if (user.role && typeof user.role === 'string') {
            user.roles = [user.role];
            delete user.role;
            localStorage.setItem('user', JSON.stringify(user));
        }
    }
}
```

### Exemple 3 : Simple correction de bug
```javascript
// Version: 1.0.0 → 1.0.1
const APP_VERSION = '1.0.1'; // Fixed: Dashboard loading error

// Pas de migration nécessaire
```

## Données préservées

Le système préserve automatiquement certaines données lors du nettoyage du cache :

- `user_preferences` - Préférences utilisateur
- `theme` - Thème de l'application
- `language` - Langue préférée

Pour ajouter d'autres clés à préserver, modifiez `version-manager.js` :

```javascript
const keysToKeep = [
    'user_preferences',
    'theme',
    'language',
    'your_new_key'  // Ajoutez ici
];
```

## Debug

### Forcer la vérification de version

Ouvrez la console du navigateur (F12) et exécutez :

```javascript
import('/modules/version-manager.js').then(m => {
    m.forceVersionUpdate();
    location.reload();
});
```

### Voir la version actuelle

```javascript
import('/modules/version-manager.js').then(m => {
    console.log('Version:', m.getAppVersion());
});
```

### Vider le cache manuellement

```javascript
localStorage.clear();
sessionStorage.clear();
location.reload();
```

## Checklist de déploiement

- [ ] Version incrémentée dans `version-manager.js`
- [ ] Migration ajoutée si nécessaire
- [ ] Testé en local avec ancienne version → nouvelle version
- [ ] Notification de mise à jour testée
- [ ] Redirection vers login testée
- [ ] Données préservées vérifiées
- [ ] Commit avec message descriptif
- [ ] Documentation mise à jour

## Historique des versions

### v1.1.0 (2026-02-08)
- Migration `roles`: string → array
- Support multi-rôles utilisateurs
- Ajout dashboard Administration

### v1.0.0 (2026-01-XX)
- Version initiale
