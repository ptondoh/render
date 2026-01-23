/**
 * Service Worker - Mode hors-ligne (Version basique)
 * Sera complété dans la Section 8
 */

const CACHE_NAME = 'sap-v1';
const urlsToCache = [
    '/',
    '/frontend/index.html',
    '/frontend/dist/output.css',
    '/frontend/app.js',
    '/frontend/modules/api.js',
    '/frontend/modules/auth.js',
    '/frontend/modules/ui.js'
];

// Installation du Service Worker
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installation');

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker: Mise en cache des fichiers');
                return cache.addAll(urlsToCache);
            })
            .catch((error) => {
                console.error('Service Worker: Erreur lors de la mise en cache:', error);
            })
    );
});

// Activation du Service Worker
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activation');

    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Service Worker: Suppression ancien cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Interception des requêtes
self.addEventListener('fetch', (event) => {
    // Stratégie: Network First pour les API, Cache First pour les assets
    const { request } = event;
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
        // Network First pour les appels API
        event.respondWith(
            fetch(request)
                .catch(() => {
                    // Si offline, retourner une réponse d'erreur appropriée
                    return new Response(
                        JSON.stringify({ error: 'Mode hors-ligne' }),
                        {
                            status: 503,
                            statusText: 'Service Unavailable',
                            headers: { 'Content-Type': 'application/json' }
                        }
                    );
                })
        );
    } else {
        // Cache First pour les assets statiques, mais toujours essayer le réseau
        event.respondWith(
            caches.match(request)
                .then((cachedResponse) => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    // Si pas en cache, faire une vraie requête réseau
                    return fetch(request).catch((error) => {
                        console.error('SW: Erreur fetch pour', request.url, error);
                        // Fallback pour les pages HTML
                        if (request.destination === 'document') {
                            return caches.match('/frontend/index.html');
                        }
                        // Pour les autres ressources, propager l'erreur
                        throw error;
                    });
                })
        );
    }
});

// Message handling pour synchronisation (Section 8)
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
