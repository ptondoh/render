/**
 * Module Auth - Gestion de l'authentification
 * Login, logout, gestion des tokens JWT, MFA
 */

import api from './api.js';
import { showToast } from './ui.js';

/**
 * Classe pour gérer l'authentification
 */
class AuthManager {
    constructor() {
        this.user = null;
        this.loadUserFromStorage();
    }

    /**
     * Charger l'utilisateur depuis localStorage
     */
    loadUserFromStorage() {
        const userJson = localStorage.getItem('user');
        if (userJson) {
            try {
                this.user = JSON.parse(userJson);
            } catch (error) {
                console.error('Erreur lors du chargement de l\'utilisateur:', error);
                this.clearAuth();
            }
        }
    }

    /**
     * Sauvegarder l'utilisateur dans localStorage
     */
    saveUserToStorage(user) {
        this.user = user;
        localStorage.setItem('user', JSON.stringify(user));
    }

    /**
     * Connexion utilisateur
     */
    async login(email, password) {
        try {
            const response = await api.post('/api/auth/login', { email, password }, { auth: false });

            // Si MFA requis, retourner les données pour l'étape suivante
            if (response.mfa_required) {
                return {
                    success: true,
                    mfa_required: true,
                    temp_token: response.temp_token,
                };
            }

            // Sinon, sauvegarder les tokens et l'utilisateur
            localStorage.setItem('access_token', response.access_token);
            localStorage.setItem('refresh_token', response.refresh_token);
            this.saveUserToStorage(response.user);

            showToast({
                message: 'Connexion réussie!',
                type: 'success',
            });

            return {
                success: true,
                mfa_required: false,
                user: response.user,
            };

        } catch (error) {
            showToast({
                message: error.message || 'Erreur lors de la connexion',
                type: 'error',
            });
            throw error;
        }
    }

    /**
     * Vérifier le code MFA
     */
    async verifyMFA(tempToken, code) {
        try {
            const response = await api.post('/api/auth/verify-mfa', { code }, {
                auth: false,
                headers: {
                    'Authorization': `Bearer ${tempToken}`,
                },
            });

            // Sauvegarder les tokens et l'utilisateur
            localStorage.setItem('access_token', response.access_token);
            localStorage.setItem('refresh_token', response.refresh_token);
            this.saveUserToStorage(response.user);

            showToast({
                message: 'Authentification réussie!',
                type: 'success',
            });

            return {
                success: true,
                user: response.user,
            };

        } catch (error) {
            showToast({
                message: error.message || 'Code MFA invalide',
                type: 'error',
            });
            throw error;
        }
    }

    /**
     * Inscription nouvel utilisateur
     */
    async register(userData) {
        try {
            const response = await api.post('/api/auth/register', userData, { auth: false });

            showToast({
                message: 'Inscription réussie! Vous pouvez maintenant vous connecter.',
                type: 'success',
            });

            return {
                success: true,
                user: response,
            };

        } catch (error) {
            showToast({
                message: error.message || 'Erreur lors de l\'inscription',
                type: 'error',
            });
            throw error;
        }
    }

    /**
     * Déconnexion
     */
    logout() {
        this.clearAuth();
        showToast({
            message: 'Déconnexion réussie',
            type: 'info',
        });
        window.location.hash = '#/login';
    }

    /**
     * Nettoyer les données d'authentification
     */
    clearAuth() {
        this.user = null;
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
    }

    /**
     * Vérifier si l'utilisateur est authentifié
     */
    isAuthenticated() {
        return !!localStorage.getItem('access_token') && !!this.user;
    }

    /**
     * Obtenir l'utilisateur actuel
     */
    getCurrentUser() {
        return this.user;
    }

    /**
     * Vérifier si l'utilisateur a un rôle spécifique
     */
    hasRole(role) {
        return this.user && this.user.roles && this.user.roles.includes(role);
    }

    /**
     * Vérifier si l'utilisateur a l'un des rôles spécifiés
     */
    hasAnyRole(roles) {
        return this.user && this.user.roles && roles.some(role => this.user.roles.includes(role));
    }

    /**
     * Rafraîchir les données de l'utilisateur actuel
     */
    async refreshUserData() {
        try {
            const response = await api.get('/api/auth/me');
            this.saveUserToStorage(response);
            return response;
        } catch (error) {
            console.error('Erreur lors du rafraîchissement des données utilisateur:', error);
            throw error;
        }
    }

    /**
     * Configurer le MFA pour l'utilisateur actuel
     */
    async setupMFA() {
        try {
            const response = await api.post('/api/auth/mfa/setup', {});
            return {
                success: true,
                secret: response.secret,
                qr_code: response.qr_code,
                backup_codes: response.backup_codes,
            };
        } catch (error) {
            showToast({
                message: error.message || 'Erreur lors de la configuration du MFA',
                type: 'error',
            });
            throw error;
        }
    }

    /**
     * Activer le MFA après configuration
     */
    async verifyMFASetup(code) {
        try {
            const response = await api.post('/api/auth/mfa/verify-setup', { code });

            // Mettre à jour l'utilisateur local
            if (this.user) {
                this.user.mfa_enabled = true;
                this.saveUserToStorage(this.user);
            }

            showToast({
                message: 'MFA activé avec succès!',
                type: 'success',
            });

            return {
                success: true,
                message: response.message,
            };
        } catch (error) {
            showToast({
                message: error.message || 'Erreur lors de l\'activation du MFA',
                type: 'error',
            });
            throw error;
        }
    }

    /**
     * Désactiver le MFA
     */
    async disableMFA(password) {
        try {
            const response = await api.post('/api/auth/mfa/disable', { password });

            // Mettre à jour l'utilisateur local
            if (this.user) {
                this.user.mfa_enabled = false;
                this.saveUserToStorage(this.user);
            }

            showToast({
                message: 'MFA désactivé avec succès',
                type: 'success',
            });

            return {
                success: true,
                message: response.message,
            };
        } catch (error) {
            showToast({
                message: error.message || 'Erreur lors de la désactivation du MFA',
                type: 'error',
            });
            throw error;
        }
    }

    /**
     * Obtenir les initiales de l'utilisateur pour l'avatar
     */
    getUserInitials() {
        if (!this.user || !this.user.nom) return 'U';

        const names = this.user.nom.split(' ');
        if (names.length >= 2) {
            return (names[0][0] + names[1][0]).toUpperCase();
        }
        return names[0][0].toUpperCase();
    }

    /**
     * Obtenir le nom d'affichage de l'utilisateur
     */
    getUserDisplayName() {
        if (!this.user) return 'Utilisateur';

        if (this.user.prenom && this.user.nom) {
            return `${this.user.prenom} ${this.user.nom}`;
        }
        return this.user.nom || this.user.email;
    }
}

// Instance globale du gestionnaire d'authentification
const auth = new AuthManager();

// Exporter pour utilisation dans d'autres modules
export default auth;
