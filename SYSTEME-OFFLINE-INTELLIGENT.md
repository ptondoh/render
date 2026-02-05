# 📱 Système Offline Intelligent - SAP

## 🎯 Objectif

Permettre aux agents terrain en Haïti de collecter les prix même sans connexion internet, avec synchronisation automatique au retour de la connexion.

---

## 🏗️ Architecture (3 composants)

### 1. **NetworkDetector** (`frontend/modules/network-detector.js`)
- Détecte de manière fiable l'état de la connexion internet
- Combine `navigator.onLine` + ping backend toutes les 10 secondes
- Émet des événements lors des changements de statut

### 2. **OfflineManager** (`frontend/modules/offline-manager.js`)
- Gère le stockage local dans IndexedDB
- Sauvegarde les collectes en attente
- Synchronise automatiquement au retour online

### 3. **Service Worker Intelligent** (`frontend/sw-smart.js`)
- Stratégie dynamique selon l'état réseau
- MODE ONLINE: Données fraîches du réseau
- MODE OFFLINE: Cache + queue locale

---

## 🔄 Comportement par Mode

### 📶 MODE ONLINE (Connexion active)

**Stratégie: Network First (toujours frais)**

✅ **Requêtes:**
- Toutes les requêtes vont **directement au backend**
- Aucune mise en cache pendant le mode online
- Garantie de données fraîches en temps réel

✅ **Interface:**
- Bandeau offline caché
- Fonctionnement normal de l'application

✅ **Cache:**
- Cache statique (STATIC_ASSETS) conservé pour installation
- Cache runtime (RUNTIME_CACHE) **NON utilisé**

### 📵 MODE OFFLINE (Pas de connexion)

**Stratégie: Cache First + Queue**

✅ **Lecture (GET):**
- Assets statiques servis depuis le cache
- Données API servies depuis le cache runtime
- Affichage du contenu disponible

✅ **Écriture (POST/PUT/DELETE):**
- Collectes sauvegardées dans IndexedDB
- Requêtes mises en queue
- Réponse 202 Accepted immédiate

✅ **Interface:**
- Bandeau orange affiché: "📵 Mode hors-ligne - Les données seront synchronisées automatiquement"
- Compteur de collectes en attente visible

### 🔄 RETOUR ONLINE (Transition OFFLINE → ONLINE)

**Séquence automatique:**

1. ✅ **Détection** (NetworkDetector)
   ```
   Ping backend réussi → Changement statut → Événement émis
   ```

2. ✅ **Nettoyage du cache** (Service Worker)
   ```javascript
   // Suppression du cache runtime
   caches.delete(RUNTIME_CACHE)
   console.log('[SW] ✅ Cache runtime vidé - Données fraîches garanties')
   ```

3. ✅ **Synchronisation** (OfflineManager)
   ```javascript
   // Envoi des collectes en attente
   syncPendingCollectes()
   → POST /api/collectes pour chaque collecte
   → Suppression de IndexedDB après succès
   ```

4. ✅ **Mise à jour UI**
   ```
   Bandeau orange disparaît
   Message de confirmation
   Compteur remis à zéro
   ```

---

## 📊 Flux de Données

### Collecte en mode ONLINE
```
Agent saisit prix
    ↓
POST /api/collectes
    ↓
Backend MongoDB
    ↓
✅ Confirmation immédiate
```

### Collecte en mode OFFLINE
```
Agent saisit prix
    ↓
Sauvegarde IndexedDB
    ↓
Queue locale (synced: false)
    ↓
⏳ En attente de connexion
```

### Synchronisation au retour ONLINE
```
Détection connexion
    ↓
Service Worker: Vide cache runtime
    ↓
OfflineManager: Récupère collectes pending
    ↓
Pour chaque collecte:
    POST /api/collectes
    ↓
    Suppression IndexedDB si succès
    ↓
✅ Synchronisation complète
```

---

## 🧪 Tests Automatisés

**Script:** `test_offline_system.cjs`

**Tests couverts:**
1. ✅ Chargement et initialisation (SW + NetworkDetector + OfflineManager)
2. ✅ Mode ONLINE normal (bandeau caché)
3. ✅ Détection passage OFFLINE (bandeau affiché)
4. ✅ Sauvegarde collecte offline (IndexedDB)
5. ✅ Compteur collectes en attente
6. ✅ Retour ONLINE + synchronisation automatique
7. ✅ Nettoyage cache au retour online

**Lancer les tests:**
```bash
node test_offline_system.cjs
```

---

## 🔧 Configuration

### IndexedDB Stores

**`pending_collectes`**
```javascript
{
    id: (auto-increment),
    data: {
        marche_id: string,
        produit_id: string,
        prix: number,
        unite_id: string,
        periode: string,
        date: ISO string,
        agent_id: string
    },
    timestamp: ISO string,
    synced: boolean,
    retries: number,
    syncedAt?: ISO string
}
```

**`pending_requests`**
```javascript
{
    id: (auto-increment),
    method: string,
    url: string,
    body: any,
    timestamp: ISO string,
    synced: boolean,
    retries: number
}
```

### Service Worker Caches

**`sap-v2`** (STATIC_ASSETS)
- Fichiers statiques pour mode offline
- Conservé même en mode online
- Nettoyé uniquement lors d'une nouvelle version

**`sap-runtime-v2`** (RUNTIME_CACHE)
- Données API et ressources dynamiques
- **Vidé automatiquement au retour online**
- Reconstruit en mode offline

---

## 🎛️ API OfflineManager

### Initialisation
```javascript
import { initOfflineManager, getOfflineManager } from './modules/offline-manager.js';

// Init
await initOfflineManager();

// Usage
const offlineManager = getOfflineManager();
```

### Méthodes principales

**Sauvegarder une collecte**
```javascript
const id = await offlineManager.saveCollecte({
    marche_id: 'marche-123',
    produit_id: 'produit-456',
    prix: 50,
    unite_id: 'kg',
    periode: 'matin1',
    date: new Date().toISOString(),
    agent_id: 'agent-789'
});
```

**Compter les collectes en attente**
```javascript
const count = await offlineManager.getPendingCount();
console.log(`${count} collectes en attente`);
```

**Synchroniser manuellement**
```javascript
const result = await offlineManager.syncPendingCollectes(apiClient);
console.log(`${result.synced} synchronisées, ${result.failed} échecs`);
```

**Écouter les événements**
```javascript
offlineManager.onSyncEvent((event, data) => {
    switch(event) {
        case 'sync_started':
            console.log('Sync started');
            break;
        case 'sync_completed':
            console.log(`Synced: ${data.synced}, Failed: ${data.failed}`);
            break;
        case 'sync_error':
            console.error(`Error: ${data.error}`);
            break;
    }
});
```

---

## 📈 Métriques et Monitoring

### Événements trackés

**NetworkDetector:**
- `statuschange` - Changement online/offline
- `ping_success` - Ping backend réussi
- `ping_failed` - Ping backend échoué

**OfflineManager:**
- `collecte_saved` - Collecte sauvegardée
- `sync_started` - Début synchronisation
- `sync_completed` - Fin synchronisation (+ stats)
- `sync_error` - Erreur synchronisation

**Service Worker:**
- `install` - Installation SW
- `activate` - Activation SW
- `NETWORK_STATUS` - Changement statut réseau
- Cache cleanup - Nettoyage au retour online

### Console logs

**Mode ONLINE:**
```
🌐 NetworkDetector initialized
✅ IndexedDB initialized
[SW] Network status updated: ONLINE
```

**Passage OFFLINE:**
```
📵 Browser says: OFFLINE
🌐 Network changed: ONLINE → OFFLINE
[SW] Network status updated: OFFLINE
```

**Retour ONLINE:**
```
📶 Browser says: ONLINE
[SW] Network status updated: ONLINE
[SW] Retour ONLINE détecté - Nettoyage du cache runtime...
[SW] ✅ Cache runtime vidé - Données fraîches garanties
🔄 Starting sync of X collectes...
✅ Sync completed: X synced, 0 failed
```

---

## 🚨 Gestion des Erreurs

### Échec de synchronisation

**Tentatives:**
- Maximum 5 retries par collecte
- Compteur `retries` incrémenté à chaque échec
- Après 5 échecs: marqué comme failed (mais conservé)

**Logs:**
```
❌ Error syncing collecte 123: Network error
⚠️  Collecte 123 marked as failed after 5 retries
```

### Nettoyage automatique

**Données synchronisées:**
- Supprimées après succès
- Collectes > 7 jours nettoyées via `cleanupOldData()`

---

## ✅ Résumé de la Réponse à la Question

**"Est-ce que lors du retour d'internet le service worker après la synchronisation des données vide son cache et se met à off ?"**

### ✅ OUI, exactement!

1. **Vide le cache runtime:**
   ```javascript
   caches.delete(RUNTIME_CACHE) // ✅ Exécuté au retour online
   ```

2. **Se met en mode "pass-through":**
   - Toutes les requêtes vont directement au réseau
   - Aucune mise en cache en mode online
   - Cache utilisé uniquement comme fallback

3. **Garantit données fraîches:**
   - Pas de versions obsolètes servies
   - Toujours la dernière version du backend
   - Performance optimale en mode online

---

## 📝 Notes Importantes

- Le cache **statique** (STATIC_ASSETS) est conservé pour permettre le fonctionnement offline
- Seul le cache **runtime** (données dynamiques) est vidé au retour online
- La synchronisation est **automatique** mais peut être déclenchée manuellement
- Les collectes en échec sont **conservées** pour retry manuel si nécessaire

---

## 🎯 Prochaines Étapes

- [ ] Monitoring backend des synchronisations
- [ ] Interface admin pour voir collectes en attente par agent
- [ ] Retry manuel en cas d'échec persistant
- [ ] Notification push au retour online
- [ ] Statistiques d'utilisation offline

---

**Version:** 2.0.0
**Date:** Février 2026
**Statut:** ✅ Production Ready
