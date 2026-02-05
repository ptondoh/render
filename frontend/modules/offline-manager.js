/**
 * Offline Manager - Gestion du stockage local et synchronisation
 *
 * Responsabilités :
 * 1. Stockage des collectes dans IndexedDB quand offline
 * 2. Queue des requêtes en attente
 * 3. Synchronisation automatique quand online
 * 4. Notifications à l'utilisateur
 */

class OfflineManager {
    constructor() {
        this.dbName = 'sap_offline';
        this.dbVersion = 1;
        this.db = null;
        this.syncInProgress = false;
        this.syncListeners = [];
    }

    /**
     * Initialise IndexedDB
     */
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                console.error('❌ IndexedDB error:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('✅ IndexedDB initialized');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Store pour les collectes en attente
                if (!db.objectStoreNames.contains('pending_collectes')) {
                    const collectesStore = db.createObjectStore('pending_collectes', {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    collectesStore.createIndex('timestamp', 'timestamp', { unique: false });
                    collectesStore.createIndex('synced', 'synced', { unique: false });
                }

                // Store pour les requêtes génériques
                if (!db.objectStoreNames.contains('pending_requests')) {
                    const requestsStore = db.createObjectStore('pending_requests', {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    requestsStore.createIndex('timestamp', 'timestamp', { unique: false });
                    requestsStore.createIndex('synced', 'synced', { unique: false });
                }

                console.log('🔄 IndexedDB schema updated');
            };
        });
    }

    /**
     * Sauvegarde une collecte offline
     */
    async saveCollecte(collecteData) {
        if (!this.db) {
            await this.init();
        }

        const transaction = this.db.transaction(['pending_collectes'], 'readwrite');
        const store = transaction.objectStore('pending_collectes');

        const item = {
            data: collecteData,
            timestamp: new Date().toISOString(),
            synced: false,
            retries: 0
        };

        return new Promise((resolve, reject) => {
            const request = store.add(item);

            request.onsuccess = () => {
                console.log('💾 Collecte saved offline:', request.result);
                this.notifySyncListeners('collecte_saved', { id: request.result });
                resolve(request.result);
            };

            request.onerror = () => {
                console.error('❌ Error saving collecte:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Récupère toutes les collectes non synchronisées
     */
    async getPendingCollectes() {
        if (!this.db) {
            await this.init();
        }

        const transaction = this.db.transaction(['pending_collectes'], 'readonly');
        const store = transaction.objectStore('pending_collectes');

        return new Promise((resolve, reject) => {
            const results = [];
            const request = store.openCursor();

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    // Filtrer manuellement les collectes non synchronisées
                    if (cursor.value.synced === false) {
                        results.push(cursor.value);
                    }
                    cursor.continue();
                } else {
                    console.log(`📋 Found ${results.length} pending collectes`);
                    resolve(results);
                }
            };

            request.onerror = () => {
                console.error('❌ Error getting pending collectes:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Marque une collecte comme synchronisée
     */
    async markCollecteAsSynced(id) {
        if (!this.db) {
            await this.init();
        }

        const transaction = this.db.transaction(['pending_collectes'], 'readwrite');
        const store = transaction.objectStore('pending_collectes');

        return new Promise((resolve, reject) => {
            const getRequest = store.get(id);

            getRequest.onsuccess = () => {
                const item = getRequest.result;
                if (item) {
                    item.synced = true;
                    item.syncedAt = new Date().toISOString();

                    const updateRequest = store.put(item);

                    updateRequest.onsuccess = () => {
                        console.log('✅ Collecte marked as synced:', id);
                        resolve(true);
                    };

                    updateRequest.onerror = () => {
                        console.error('❌ Error updating collecte:', updateRequest.error);
                        reject(updateRequest.error);
                    };
                } else {
                    resolve(false);
                }
            };

            getRequest.onerror = () => {
                reject(getRequest.error);
            };
        });
    }

    /**
     * Supprime une collecte
     */
    async deleteCollecte(id) {
        if (!this.db) {
            await this.init();
        }

        const transaction = this.db.transaction(['pending_collectes'], 'readwrite');
        const store = transaction.objectStore('pending_collectes');

        return new Promise((resolve, reject) => {
            const request = store.delete(id);

            request.onsuccess = () => {
                console.log('🗑️  Collecte deleted:', id);
                resolve(true);
            };

            request.onerror = () => {
                console.error('❌ Error deleting collecte:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Synchronise toutes les collectes en attente
     */
    async syncPendingCollectes(apiClient) {
        if (this.syncInProgress) {
            console.log('⏳ Sync already in progress');
            return { success: false, message: 'Sync already in progress' };
        }

        this.syncInProgress = true;
        this.notifySyncListeners('sync_started');

        try {
            const pendingCollectes = await this.getPendingCollectes();

            if (pendingCollectes.length === 0) {
                console.log('✅ No collectes to sync');
                this.syncInProgress = false;
                this.notifySyncListeners('sync_completed', { synced: 0, failed: 0 });
                return { success: true, synced: 0, failed: 0 };
            }

            console.log(`🔄 Starting sync of ${pendingCollectes.length} collectes...`);

            let synced = 0;
            let failed = 0;

            for (const item of pendingCollectes) {
                try {
                    // Envoyer au backend
                    const response = await apiClient.post('/collectes', item.data);

                    if (response) {
                        // Succès - supprimer de IndexedDB
                        await this.deleteCollecte(item.id);
                        synced++;
                        console.log(`✅ Collecte ${item.id} synced`);
                    } else {
                        failed++;
                        console.error(`❌ Collecte ${item.id} sync failed`);
                    }

                } catch (error) {
                    failed++;
                    console.error(`❌ Error syncing collecte ${item.id}:`, error.message);

                    // Incrémenter retry count
                    item.retries = (item.retries || 0) + 1;

                    // Si trop de retries, marquer comme failed
                    if (item.retries >= 5) {
                        console.error(`⚠️  Collecte ${item.id} marked as failed after 5 retries`);
                    }
                }
            }

            console.log(`✅ Sync completed: ${synced} synced, ${failed} failed`);

            this.syncInProgress = false;
            this.notifySyncListeners('sync_completed', { synced, failed });

            return { success: true, synced, failed };

        } catch (error) {
            console.error('❌ Sync error:', error);
            this.syncInProgress = false;
            this.notifySyncListeners('sync_error', { error: error.message });
            return { success: false, error: error.message };
        }
    }

    /**
     * Compte les collectes en attente
     */
    async getPendingCount() {
        if (!this.db) {
            await this.init();
        }

        const pending = await this.getPendingCollectes();
        return pending.length;
    }

    /**
     * Enregistre un listener pour les events de sync
     */
    onSyncEvent(callback) {
        this.syncListeners.push(callback);

        return () => {
            this.syncListeners = this.syncListeners.filter(cb => cb !== callback);
        };
    }

    /**
     * Notifie tous les listeners
     */
    notifySyncListeners(event, data = {}) {
        this.syncListeners.forEach(callback => {
            try {
                callback(event, data);
            } catch (error) {
                console.error('Error in sync listener:', error);
            }
        });

        // Event personnalisé global
        window.dispatchEvent(new CustomEvent('offlinesync', {
            detail: { event, data }
        }));
    }

    /**
     * Nettoyage des données synchronisées (> 7 jours)
     */
    async cleanupOldData() {
        if (!this.db) {
            await this.init();
        }

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const transaction = this.db.transaction(['pending_collectes'], 'readwrite');
        const store = transaction.objectStore('pending_collectes');
        const index = store.index('synced');

        return new Promise((resolve, reject) => {
            const request = index.openCursor(true); // synced = true
            let deleted = 0;

            request.onsuccess = (event) => {
                const cursor = event.target.result;

                if (cursor) {
                    const item = cursor.value;
                    const syncedDate = new Date(item.syncedAt);

                    if (syncedDate < sevenDaysAgo) {
                        cursor.delete();
                        deleted++;
                    }

                    cursor.continue();
                } else {
                    console.log(`🧹 Cleaned up ${deleted} old collectes`);
                    resolve(deleted);
                }
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Reset complet (pour debug/tests)
     */
    async resetAll() {
        if (!this.db) {
            await this.init();
        }

        const transaction = this.db.transaction(['pending_collectes'], 'readwrite');
        const store = transaction.objectStore('pending_collectes');

        return new Promise((resolve, reject) => {
            const request = store.clear();

            request.onsuccess = () => {
                console.log('🗑️  All offline data cleared');
                resolve(true);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }
}

// Instance globale
let offlineManagerInstance = null;

/**
 * Initialise et retourne l'instance globale
 */
export async function initOfflineManager() {
    if (!offlineManagerInstance) {
        offlineManagerInstance = new OfflineManager();
        await offlineManagerInstance.init();
    }
    return offlineManagerInstance;
}

/**
 * Retourne l'instance existante
 */
export function getOfflineManager() {
    if (!offlineManagerInstance) {
        throw new Error('OfflineManager not initialized. Call initOfflineManager() first.');
    }
    return offlineManagerInstance;
}

export default OfflineManager;
