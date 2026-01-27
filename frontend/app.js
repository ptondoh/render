/**
 * Application principale - Routeur SPA
 * Gestion de la navigation et des routes
 */

import auth from './modules/auth.js';
import { hideLoader } from './modules/ui.js';

/**
 * Définition des routes
 */
const routes = {
    '/': {
        title: 'Accueil',
        requireAuth: false,
        render: () => {
            // Rediriger vers dashboard si authentifié, sinon vers login
            if (auth.isAuthenticated()) {
                window.location.hash = '#/dashboard';
            } else {
                window.location.hash = '#/login';
            }
            return '';
        }
    },
    '/login': {
        title: 'Connexion - SAP',
        requireAuth: false,
        render: async () => {
            // Si déjà authentifié, rediriger vers dashboard
            if (auth.isAuthenticated()) {
                window.location.hash = '#/dashboard';
                return '';
            }

            const { default: LoginPage } = await import('./pages/login.js');
            return LoginPage();
        }
    },
    '/dashboard': {
        title: 'Tableau de bord - SAP',
        requireAuth: true,
        render: async () => {
            const { default: DashboardPage } = await import('./pages/dashboard.js');
            return DashboardPage();
        }
    },
    '/collectes': {
        title: 'Collectes de prix - SAP',
        requireAuth: true,
        render: async () => {
            const { default: CollectesPage } = await import('./pages/collectes.js');
            return CollectesPage();
        }
    },
    '/alertes': {
        title: 'Alertes - SAP',
        requireAuth: true,
        render: async () => {
            // const { default: AlertesPage } = await import('./pages/alertes.js');
            // return AlertesPage();
            return '<div class="text-center py-12"><h2 class="text-2xl font-bold text-gray-900 mb-4">Page Alertes</h2><p class="text-gray-600">À venir - Section 8</p></div>';
        }
    },
    '/profil': {
        title: 'Mon profil - SAP',
        requireAuth: true,
        render: async () => {
            return '<div class="text-center py-12"><h2 class="text-2xl font-bold text-gray-900 mb-4">Mon Profil</h2><p class="text-gray-600">À venir</p></div>';
        }
    },
    '/admin/unites': {
        title: 'Gestion Unités - SAP',
        requireAuth: true,
        render: async () => {
            const { default: AdminUnitesPage } = await import('./pages/admin-unites.js');
            return AdminUnitesPage();
        }
    },
    '/admin/categories': {
        title: 'Gestion Catégories - SAP',
        requireAuth: true,
        render: async () => {
            const { default: AdminCategoriesPage } = await import('./pages/admin-categories.js');
            return AdminCategoriesPage();
        }
    },
    '/admin/produits': {
        title: 'Gestion Produits - SAP',
        requireAuth: true,
        render: async () => {
            const { default: AdminProduitsPage } = await import('./pages/admin-produits.js');
            return AdminProduitsPage();
        }
    },
    '/admin/marches': {
        title: 'Gestion Marchés - SAP',
        requireAuth: true,
        render: async () => {
            const { default: AdminMarchesPage } = await import('./pages/admin-marches.js');
            return AdminMarchesPage();
        }
    },
    '404': {
        title: 'Page non trouvée - SAP',
        requireAuth: false,
        render: async () => {
            const { default: NotFoundPage } = await import('./pages/404.js');
            return NotFoundPage();
        }
    }
};

/**
 * Classe Router pour gérer la navigation
 */
class Router {
    constructor() {
        this.currentRoute = null;
        this.init();
    }

    /**
     * Initialiser le routeur
     */
    init() {
        // Écouter les changements de hash
        window.addEventListener('hashchange', () => this.handleRoute());
        window.addEventListener('load', () => this.handleRoute());

        // Initialiser les event listeners de la navigation
        this.initNavigation();
    }

    /**
     * Initialiser les event listeners de navigation
     */
    initNavigation() {
        // Menu utilisateur dropdown
        const userMenuButton = document.getElementById('user-menu-button');
        const userMenuDropdown = document.getElementById('user-menu-dropdown');

        if (userMenuButton && userMenuDropdown) {
            userMenuButton.addEventListener('click', (e) => {
                e.stopPropagation();
                userMenuDropdown.classList.toggle('hidden');
                // Fermer le menu admin si ouvert
                const adminDropdown = document.getElementById('admin-menu-dropdown');
                if (adminDropdown) {
                    adminDropdown.classList.add('hidden');
                }
            });

            // Fermer le dropdown quand on clique ailleurs
            document.addEventListener('click', () => {
                userMenuDropdown.classList.add('hidden');
            });
        }

        // Menu admin dropdown
        const adminMenuButton = document.getElementById('admin-menu-button');
        const adminMenuDropdown = document.getElementById('admin-menu-dropdown');

        if (adminMenuButton && adminMenuDropdown) {
            adminMenuButton.addEventListener('click', (e) => {
                e.stopPropagation();
                adminMenuDropdown.classList.toggle('hidden');
                // Fermer le menu utilisateur si ouvert
                if (userMenuDropdown) {
                    userMenuDropdown.classList.add('hidden');
                }
            });

            // Fermer le dropdown quand on clique ailleurs
            document.addEventListener('click', () => {
                adminMenuDropdown.classList.add('hidden');
            });
        }

        // Menu mobile toggle
        const mobileMenuButton = document.getElementById('mobile-menu-button');
        const mobileMenu = document.getElementById('mobile-menu');

        if (mobileMenuButton && mobileMenu) {
            mobileMenuButton.addEventListener('click', () => {
                mobileMenu.classList.toggle('hidden');
            });
        }

        // Boutons de déconnexion
        const logoutButtons = [
            document.getElementById('logout-button'),
            document.getElementById('mobile-logout-button')
        ];

        logoutButtons.forEach(btn => {
            if (btn) {
                btn.addEventListener('click', () => {
                    auth.logout();
                });
            }
        });
    }

    /**
     * Obtenir le chemin depuis le hash
     */
    getPath() {
        const hash = window.location.hash.slice(1); // Enlever le #
        return hash || '/';
    }

    /**
     * Trouver la route correspondante
     */
    findRoute(path) {
        return routes[path] || routes['404'];
    }

    /**
     * Mettre à jour l'interface utilisateur selon l'état d'authentification
     */
    updateUI() {
        const mainNav = document.getElementById('main-nav');
        const userNameEl = document.getElementById('user-name');
        const userInitialsEl = document.getElementById('user-initials');
        const adminMenuDesktop = document.getElementById('admin-menu-desktop');
        const adminMenuMobile = document.getElementById('admin-menu-mobile');

        if (auth.isAuthenticated()) {
            // Afficher la navigation
            mainNav.classList.remove('hidden');

            // Mettre à jour le nom et les initiales
            if (userNameEl) {
                userNameEl.textContent = auth.getUserDisplayName();
            }
            if (userInitialsEl) {
                userInitialsEl.textContent = auth.getUserInitials();
            }

            // Afficher/masquer les menus admin selon le rôle
            const isDecideur = auth.hasRole('décideur');
            if (adminMenuDesktop) {
                if (isDecideur) {
                    adminMenuDesktop.classList.remove('hidden');
                } else {
                    adminMenuDesktop.classList.add('hidden');
                }
            }
            if (adminMenuMobile) {
                if (isDecideur) {
                    adminMenuMobile.classList.remove('hidden');
                } else {
                    adminMenuMobile.classList.add('hidden');
                }
            }

            // Mettre à jour les liens actifs
            this.updateActiveLinks();
        } else {
            // Masquer la navigation
            mainNav.classList.add('hidden');
        }
    }

    /**
     * Mettre à jour les liens de navigation actifs
     */
    updateActiveLinks() {
        const currentPath = this.getPath();
        const navLinks = document.querySelectorAll('.nav-link');

        navLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (href === `#${currentPath}`) {
                link.classList.add('bg-blue-50', 'text-blue-600');
            } else {
                link.classList.remove('bg-blue-50', 'text-blue-600');
            }
        });
    }

    /**
     * Gérer le routage
     */
    async handleRoute() {
        const path = this.getPath();
        const route = this.findRoute(path);

        // Vérifier l'authentification si requise
        if (route.requireAuth && !auth.isAuthenticated()) {
            window.location.hash = '#/login';
            return;
        }

        // Mettre à jour le titre de la page
        document.title = route.title;

        // Mettre à jour l'interface utilisateur
        this.updateUI();

        // Rendre le contenu de la route
        try {
            const content = await route.render();
            const appContainer = document.getElementById('app');

            if (typeof content === 'string') {
                appContainer.innerHTML = content;
            } else if (content instanceof Node) {
                appContainer.innerHTML = '';
                appContainer.appendChild(content);
            }

            // Masquer le loader après le rendu
            hideLoader();

            // Sauvegarder la route actuelle
            this.currentRoute = path;

        } catch (error) {
            console.error('Erreur lors du rendu de la route:', error);
            const appContainer = document.getElementById('app');
            appContainer.innerHTML = `
                <div class="text-center py-12">
                    <div class="text-red-500 text-6xl mb-4">⚠️</div>
                    <h2 class="text-2xl font-bold text-gray-900 mb-4">Erreur</h2>
                    <p class="text-gray-600">${error.message}</p>
                    <a href="#/dashboard" class="inline-block mt-6 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                        Retour au tableau de bord
                    </a>
                </div>
            `;
        }
    }

    /**
     * Naviguer vers une route
     */
    navigate(path) {
        window.location.hash = `#${path}`;
    }
}

// Créer et démarrer le routeur
const router = new Router();

// Exporter le routeur pour utilisation dans d'autres modules
export default router;
