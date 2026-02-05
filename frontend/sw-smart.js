/**
 * Service Worker Intelligent - SAP
 *
 * STRATÉGIE :
 * - ONLINE  : Pass-through (pas de cache, requêtes directes)
 * - OFFLINE : Cache + Queue (stockage local, sync plus tard)
 *
 * VERSION : 2.0.0
 */

const CACHE_NAME = 'sap-v2';
const RUNTIME_CACHE = 'sap-runtime-v2';

// Fichiers à mettre en cache pour mode offline
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/dist/output.css',
    '/app.js',
    '/modules/api.js',
    '/modules/auth.js',
    '/modules/ui.js',
    '/modules/network-detector.js',
    '/modules/offline-manager.js',
    '/pages/dashboard.js',
    '/pages/collectes.js',
    '/pages/login.js'
];

// État réseau (mis à jour par les messages de la page)
let isOnline = true;

/**
 * Installation - Met en cache les assets statiques
 */
self.addEventListener('install', (event) => {
    console.log('[SW] Installing v2.0.0...');

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS).catch((error) => {
                    console.error('[SW] Cache failed for some assets:', error);
                    // Continue même si certains fichiers échouent
                    return Promise.resolve();
                });
            })
            .then(() => {
                console.log('[SW] Install complete');
                return self.skipWaiting(); // Active immédiatement
            })
    );
});

/**
 * Activation - Nettoie les anciens caches
 */
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating v2.0.0...');

    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
                            console.log('[SW] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('[SW] Activation complete');
                return self.clients.claim(); // Prend contrôle immédiatement
            })
    );
});

/**
 * Messages de la page principale
 */
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'NETWORK_STATUS') {
        const wasOnline = isOnline;
        isOnline = event.data.isOnline;
        console.log(`[SW] Network status updated: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);

        // Si retour ONLINE après période OFFLINE, vider le cache runtime
        if (isOnline && !wasOnline) {
            console.log('[SW] Retour ONLINE détecté - Nettoyage du cache runtime...');
            caches.delete(RUNTIME_CACHE)
                .then(() => {
                    console.log('[SW] ✅ Cache runtime vidé - Données fraîches garanties');
                })
                .catch((error) => {
                    console.error('[SW] ❌ Erreur nettoyage cache:', error);
                });
        }
    }

    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

/**
 * Fetch - Stratégie dynamique selon l'état réseau
 */
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Ignorer les requêtes non-HTTP
    if (!url.protocol.startsWith('http')) {
        return;
    }

    // Ignorer les requêtes vers d'autres domaines (CDN, etc.)
    if (url.origin !== location.origin && !url.pathname.startsWith('/api/')) {
        return;
    }

    // ═══════════════════════════════════════════════════════
    // MODE ONLINE : Network First (toujours données fraîches)
    // ═══════════════════════════════════════════════════════
    if (isOnline) {
        // ONLINE = TOUT vient du réseau (données fraîches garanties)
        event.respondWith(
            fetch(request)
                .then((response) => {
                    // Ne PAS mettre en cache en mode online
                    // Le cache sera reconstruit si/quand on passe offline
                    return response;
                })
                .catch((error) => {
                    console.error('[SW] Network request failed:', request.url, error);
                    // Fallback to cache uniquement si échec réseau
                    return caches.match(request)
                        .then((cached) => {
                            if (cached) {
                                console.log('[SW] Network failed, serving from cache:', request.url);
                                return cached;
                            }
                            throw error;
                        });
                })
        );
        return;
    }

    // ═══════════════════════════════════════════════════════
    // MODE OFFLINE : Cache + Queue
    // ═══════════════════════════════════════════════════════

    // POST/PUT/DELETE → Intercepter et notifier la page (géré par OfflineManager)
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
        event.respondWith(
            // Retourner une réponse "accepted" immédiatement
            new Response(
                JSON.stringify({
                    success: true,
                    offline: true,
                    message: 'Données sauvegardées localement, seront synchronisées plus tard'
                }),
                {
                    status: 202, // 202 Accepted
                    statusText: 'Accepted (Offline)',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Offline': 'true'
                    }
                }
            )
        );

        // Notifier la page pour qu'elle gère le stockage IndexedDB
        self.clients.matchAll().then((clients) => {
            clients.forEach((client) => {
                client.postMessage({
                    type: 'OFFLINE_REQUEST',
                    method: request.method,
                    url: request.url,
                    timestamp: new Date().toISOString()
                });
            });
        });

        return;
    }

    // GET → Servir depuis le cache
    event.respondWith(
        caches.match(request)
            .then((cached) => {
                if (cached) {
                    console.log('[SW] Serving from cache (offline):', request.url);
                    return cached;
                }

                // Pas en cache → Retourner erreur offline
                console.log('[SW] Not in cache (offline):', request.url);

                // Pour les API : retourner une réponse JSON vide
                if (url.pathname.startsWith('/api/')) {
                    return new Response(
                        JSON.stringify({
                            error: 'offline',
                            message: 'Pas de connexion Internet'
                        }),
                        {
                            status: 503,
                            statusText: 'Service Unavailable (Offline)',
                            headers: { 'Content-Type': 'application/json' }
                        }
                    );
                }

                // Pour HTML : servir la page principale depuis le cache
                return caches.match('/index.html')
                    .then((indexCached) => {
                        if (indexCached) {
                            return indexCached;
                        }
                        throw new Error('Application not available offline');
                    });
            })
    );
});

/**
 * Vérifie si un chemin est un asset statique
 */
function isStaticAsset(pathname) {
    const staticExtensions = ['.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.woff', '.woff2', '.ttf'];
    return staticExtensions.some(ext => pathname.endsWith(ext));
}

/**
 * Background Sync - Synchronisation en arrière-plan
 */
self.addEventListener('sync', (event) => {
    console.log('[SW] Background sync:', event.tag);

    if (event.tag === 'sync-collectes') {
        event.waitUntil(
            // Notifier la page pour qu'elle déclenche la synchro
            self.clients.matchAll().then((clients) => {
                clients.forEach((client) => {
                    client.postMessage({
                        type: 'TRIGGER_SYNC',
                        tag: event.tag
                    });
                });
            })
        );
    }
});

console.log('[SW] Service Worker Smart v2.0.0 loaded');
