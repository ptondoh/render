/**
 * Network Detector - Détection fiable de la connexion Internet
 *
 * Stratégie :
 * 1. navigator.onLine (première indication rapide)
 * 2. Ping backend toutes les 10s (confirmation réelle)
 * 3. Events pour notifier les changements d'état
 */

class NetworkDetector {
    constructor(backendUrl = 'http://localhost:8000') {
        this.backendUrl = backendUrl;
        this.isOnline = navigator.onLine;
        this.listeners = [];
        this.pingInterval = null;
        this.pingTimeout = 5000; // 5 secondes timeout
        this.pingFrequency = 10000; // Check toutes les 10 secondes

        this.init();
    }

    init() {
        console.log('🌐 NetworkDetector initialized');

        // Écouter les événements navigateur (rapide mais pas fiable à 100%)
        window.addEventListener('online', () => {
            console.log('📶 Browser says: ONLINE');
            this.checkConnection(); // Confirmer avec ping
        });

        window.addEventListener('offline', () => {
            console.log('📵 Browser says: OFFLINE');
            this.setOnlineStatus(false);
        });

        // Check initial
        this.checkConnection();

        // Ping régulier du backend
        this.startPinging();
    }

    /**
     * Vérifie la connexion en pingant le backend
     */
    async checkConnection() {
        try {
            // Ping avec timeout court
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.pingTimeout);

            const response = await fetch(`${this.backendUrl}/health`, {
                method: 'GET',
                signal: controller.signal,
                cache: 'no-cache'
            });

            clearTimeout(timeoutId);

            const isOnline = response.ok || response.status === 404; // 404 accepté (route peut ne pas exister)

            if (isOnline !== this.isOnline) {
                console.log(`🔄 Connection status changed: ${this.isOnline ? 'ONLINE' : 'OFFLINE'} → ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
                this.setOnlineStatus(isOnline);
            }

            return isOnline;

        } catch (error) {
            // Échec = offline
            if (this.isOnline) {
                console.log('📵 Connection lost:', error.message);
                this.setOnlineStatus(false);
            }
            return false;
        }
    }

    /**
     * Démarre le ping régulier
     */
    startPinging() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
        }

        this.pingInterval = setInterval(() => {
            this.checkConnection();
        }, this.pingFrequency);

        console.log(`⏱️  Ping started (every ${this.pingFrequency / 1000}s)`);
    }

    /**
     * Arrête le ping
     */
    stopPinging() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
            console.log('⏹️  Ping stopped');
        }
    }

    /**
     * Met à jour le statut et notifie les listeners
     */
    setOnlineStatus(isOnline) {
        const wasOnline = this.isOnline;
        this.isOnline = isOnline;

        // Notifier tous les listeners
        this.listeners.forEach(callback => {
            try {
                callback(isOnline, wasOnline);
            } catch (error) {
                console.error('Error in network listener:', error);
            }
        });

        // Event personnalisé pour le reste de l'app
        window.dispatchEvent(new CustomEvent('networkchange', {
            detail: { isOnline, wasOnline }
        }));
    }

    /**
     * Enregistre un listener pour les changements de connexion
     */
    onStatusChange(callback) {
        this.listeners.push(callback);

        // Retourner fonction de nettoyage
        return () => {
            this.listeners = this.listeners.filter(cb => cb !== callback);
        };
    }

    /**
     * Retourne l'état actuel
     */
    getStatus() {
        return this.isOnline;
    }

    /**
     * Force un check immédiat
     */
    forceCheck() {
        return this.checkConnection();
    }

    /**
     * Nettoyage
     */
    destroy() {
        this.stopPinging();
        this.listeners = [];
        console.log('🗑️  NetworkDetector destroyed');
    }
}

// Instance globale
let networkDetectorInstance = null;

/**
 * Initialise et retourne l'instance globale
 */
export function initNetworkDetector(backendUrl) {
    if (!networkDetectorInstance) {
        networkDetectorInstance = new NetworkDetector(backendUrl);
    }
    return networkDetectorInstance;
}

/**
 * Retourne l'instance existante
 */
export function getNetworkDetector() {
    if (!networkDetectorInstance) {
        throw new Error('NetworkDetector not initialized. Call initNetworkDetector() first.');
    }
    return networkDetectorInstance;
}

export default NetworkDetector;
