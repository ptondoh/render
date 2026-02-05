/**
 * Module API - Gestion des appels HTTP vers le backend
 * Inclut l'authentification automatique et la gestion des erreurs
 */

const API_BASE_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:8000'
    : 'https://sap-backend-tsjq.onrender.com';

/**
 * Classe pour gérer les appels API
 */
class ApiClient {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
    }

    /**
     * Récupérer le token d'accès depuis localStorage
     */
    getAccessToken() {
        return localStorage.getItem('access_token');
    }

    /**
     * Récupérer le token de rafraîchissement
     */
    getRefreshToken() {
        return localStorage.getItem('refresh_token');
    }

    /**
     * Construire les headers par défaut avec authentification
     */
    getHeaders(includeAuth = true) {
        const headers = {
            'Content-Type': 'application/json',
        };

        if (includeAuth) {
            const token = this.getAccessToken();
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
        }

        return headers;
    }

    /**
     * Effectuer une requête HTTP avec gestion des erreurs
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const config = {
            ...options,
            headers: {
                ...this.getHeaders(options.auth !== false),
                ...options.headers,
            },
        };

        try {
            const response = await fetch(url, config);

            // Si 401 et on a un refresh token, tenter de rafraîchir
            if (response.status === 401 && this.getRefreshToken() && options.retry !== false) {
                const refreshed = await this.refreshAccessToken();
                if (refreshed) {
                    // Réessayer la requête avec le nouveau token
                    return this.request(endpoint, { ...options, retry: false });
                } else {
                    // Échec du refresh, rediriger vers login
                    window.location.hash = '#/login';
                    throw new Error('Session expirée. Veuillez vous reconnecter.');
                }
            }

            // Parser la réponse
            const contentType = response.headers.get('content-type');
            let data;

            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                data = await response.text();
            }

            // Si la requête a échoué, lancer une erreur avec le message du serveur
            if (!response.ok) {
                const errorMessage = data.detail || data.message || `Erreur HTTP ${response.status}`;
                throw new Error(errorMessage);
            }

            return data;

        } catch (error) {
            console.error(`Erreur API ${endpoint}:`, error);
            throw error;
        }
    }

    /**
     * Rafraîchir le token d'accès
     */
    async refreshAccessToken() {
        try {
            const refreshToken = this.getRefreshToken();
            if (!refreshToken) {
                return false;
            }

            const response = await fetch(`${this.baseUrl}/api/auth/refresh`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${refreshToken}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                localStorage.setItem('access_token', data.access_token);
                return true;
            }

            return false;

        } catch (error) {
            console.error('Erreur lors du rafraîchissement du token:', error);
            return false;
        }
    }

    /**
     * Méthode GET
     */
    async get(endpoint, options = {}) {
        return this.request(endpoint, {
            ...options,
            method: 'GET',
        });
    }

    /**
     * Méthode POST
     */
    async post(endpoint, data, options = {}) {
        return this.request(endpoint, {
            ...options,
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    /**
     * Méthode PUT
     */
    async put(endpoint, data, options = {}) {
        return this.request(endpoint, {
            ...options,
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    /**
     * Méthode DELETE
     */
    async delete(endpoint, options = {}) {
        return this.request(endpoint, {
            ...options,
            method: 'DELETE',
        });
    }
}

// Instance globale du client API
const api = new ApiClient(API_BASE_URL);

// Exporter pour utilisation dans d'autres modules
export default api;
export { API_BASE_URL, ApiClient };
