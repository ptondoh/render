/**
 * Page Tableau de bord
 * Affichage différent selon le rôle de l'utilisateur
 */

import auth from '../modules/auth.js';
import api from '../modules/api.js';
import { Card, Button, Badge, Spinner, StatusIndicator, showToast } from '../modules/ui.js';

export default function DashboardPage() {
    const container = document.createElement('div');
    container.className = 'space-y-6';

    const user = auth.getCurrentUser();

    // État
    let isLoading = true;
    let stats = null;
    let alertes = [];
    let collectes = [];

    // Header avec message de bienvenue
    function renderHeader() {
        const header = document.createElement('div');
        header.className = 'mb-8';

        const greeting = document.createElement('h1');
        greeting.className = 'text-3xl font-bold text-gray-900 mb-2';

        const hour = new Date().getHours();
        let greetingText = 'Bonjour';
        if (hour < 12) greetingText = 'Bon matin';
        else if (hour < 18) greetingText = 'Bon après-midi';
        else greetingText = 'Bonsoir';

        greeting.textContent = `${greetingText}, ${user.nom || 'Utilisateur'}!`;

        const subtitle = document.createElement('p');
        subtitle.className = 'text-gray-600';
        subtitle.textContent = getRoleDescription(user.role);

        header.appendChild(greeting);
        header.appendChild(subtitle);

        return header;
    }

    // Description du rôle
    function getRoleDescription(role) {
        switch (role) {
            case 'agent':
                return 'Agent de terrain - Collecte de prix sur les marchés';
            case 'décideur':
                return 'Décideur - Validation et gestion des alertes';
            case 'bailleur':
                return 'Administrateur - Configuration et gestion du système';
            default:
                return 'Bienvenue sur le Système d\'Alerte Précoce';
        }
    }

    // Carte de statistiques
    function renderStatCard(title, value, description, variant = 'default', onClick = null) {
        const card = document.createElement('div');

        // Ajouter les classes de base et le style cliquable si onClick est fourni
        if (onClick) {
            card.className = 'bg-white rounded-lg shadow-md border border-gray-200 p-6 cursor-pointer hover:shadow-lg hover:border-blue-300 transition-all';
            card.onclick = onClick;
        } else {
            card.className = 'bg-white rounded-lg shadow-md border border-gray-200 p-6';
        }

        const titleEl = document.createElement('h3');
        titleEl.className = 'text-sm font-medium text-gray-600 mb-2';
        titleEl.textContent = title;

        const valueEl = document.createElement('p');
        valueEl.className = `text-3xl font-bold mb-2 ${getStatColor(variant)}`;
        valueEl.textContent = value;

        const descEl = document.createElement('p');
        descEl.className = 'text-sm text-gray-500';
        descEl.textContent = description;

        card.appendChild(titleEl);
        card.appendChild(valueEl);
        card.appendChild(descEl);

        return card;
    }

    function getStatColor(variant) {
        switch (variant) {
            case 'success': return 'text-green-600';
            case 'warning': return 'text-yellow-600';
            case 'danger': return 'text-red-600';
            default: return 'text-blue-600';
        }
    }

    // Dashboard Agent
    function renderAgentDashboard() {
        const content = document.createElement('div');
        content.className = 'space-y-6';

        // Statistiques - 3 tuiles cliquables
        const statsGrid = document.createElement('div');
        statsGrid.className = 'grid grid-cols-1 md:grid-cols-3 gap-6';

        if (stats) {
            // Tuile 1: Mes collectes (toutes)
            statsGrid.appendChild(renderStatCard(
                'Mes collectes',
                stats.total_collectes || 0,
                'Voir toutes mes collectes',
                'default',
                () => window.location.hash = '#/mes-collectes'
            ));

            // Tuile 2: Collectes du jour
            const today = new Date().toISOString().split('T')[0];
            const collectesToday = collectes.filter(c => {
                const collecteDate = new Date(c.date).toISOString().split('T')[0];
                return collecteDate === today;
            }).length;

            statsGrid.appendChild(renderStatCard(
                'Collectes du jour',
                collectesToday,
                'Voir mes collectes d\'aujourd\'hui',
                'success',
                () => window.location.hash = '#/collectes-jour'
            ));

            // Tuile 3: Nouvelle collecte
            statsGrid.appendChild(renderStatCard(
                'Nouvelle collecte',
                '+',
                'Ajouter une nouvelle collecte',
                'default',
                () => window.location.hash = '#/collectes'
            ));
        }

        content.appendChild(statsGrid);

        // Dernières collectes
        if (collectes && collectes.length > 0) {
            const collectesCard = Card({
                title: 'Mes dernières collectes',
                children: [
                    (() => {
                        const list = document.createElement('div');
                        list.className = 'space-y-3';

                        collectes.slice(0, 5).forEach(collecte => {
                            const item = renderCollecteItem(collecte);
                            list.appendChild(item);
                        });

                        return list;
                    })()
                ]
            });

            content.appendChild(collectesCard);
        }

        return content;
    }

    // Dashboard Décideur
    function renderDecideurDashboard() {
        const content = document.createElement('div');
        content.className = 'space-y-6';

        // Statistiques
        const statsGrid = document.createElement('div');
        statsGrid.className = 'grid grid-cols-1 md:grid-cols-3 gap-6';

        if (stats) {
            statsGrid.appendChild(renderStatCard(
                'Alertes actives',
                stats.alertes_actives || 0,
                'Nécessitent attention',
                'danger',
                () => window.location.hash = '#/alertes'
            ));

            statsGrid.appendChild(renderStatCard(
                'Alertes urgentes',
                stats.alertes_urgentes || 0,
                'Niveau urgence',
                'danger',
                () => window.location.hash = '#/alertes?niveau=urgence'
            ));

            statsGrid.appendChild(renderStatCard(
                'Marchés surveillés',
                stats.marches_surveilles || 0,
                'Avec prix élevés',
                'default',
                () => window.location.hash = '#/alertes'
            ));
        }

        content.appendChild(statsGrid);

        // ── Module 6 : Liens analyse pour décideurs ─────────────────────────
        const analyseSection = document.createElement('div');
        analyseSection.className = 'mb-2';

        const analyseTitre = document.createElement('h2');
        analyseTitre.className = 'text-lg font-semibold text-gray-900 mb-3';
        analyseTitre.textContent = '📊 Tableau de bord d\'analyse';
        analyseSection.appendChild(analyseTitre);

        const analyseGrid = document.createElement('div');
        analyseGrid.className = 'grid grid-cols-1 md:grid-cols-3 gap-4';

        [
            { href: '#/tableau-bord-national', icon: '🗺️', titre: 'Vue nationale', desc: 'Carte interactive + KPIs', color: 'blue' },
            { href: '#/indicateurs-detailles?type=top10', icon: '🏆', titre: 'Indicateurs détaillés', desc: 'Top 10 zones, prix, historique', color: 'orange' },
            { href: '#/drilldown-geo', icon: '🔍', titre: 'Drill-down géographique', desc: 'Explorer jusqu\'à la commune', color: 'green' }
        ].forEach(item => {
            const card = document.createElement('a');
            card.href = item.href;
            card.className = `block p-4 bg-white rounded-lg shadow border border-${item.color}-200 hover:border-${item.color}-400 hover:shadow-md transition-all`;
            card.innerHTML = `
                <div class="text-2xl mb-2">${item.icon}</div>
                <div class="font-semibold text-gray-900 mb-1">${item.titre}</div>
                <div class="text-sm text-gray-500">${item.desc}</div>
            `;
            analyseGrid.appendChild(card);
        });

        analyseSection.appendChild(analyseGrid);
        content.appendChild(analyseSection);

        // Actions rapides
        const alertesCard = Card({
            title: 'Gestion des alertes',
            children: [
                (() => {
                    const div = document.createElement('div');
                    div.className = 'text-center py-4';

                    const btn = Button({
                        text: 'Consulter les alertes',
                        variant: 'danger',
                        onClick: () => window.location.hash = '#/alertes'
                    });

                    div.appendChild(btn);
                    return div;
                })()
            ]
        });

        content.appendChild(alertesCard);

        // Alertes récentes
        if (alertes && alertes.length > 0) {
            const alertesListCard = Card({
                title: 'Alertes récentes',
                children: [
                    (() => {
                        const list = document.createElement('div');
                        list.className = 'space-y-3';

                        alertes.slice(0, 5).forEach(alerte => {
                            const item = renderAlerteItem(alerte);
                            list.appendChild(item);
                        });

                        return list;
                    })()
                ]
            });

            content.appendChild(alertesListCard);
        }

        return content;
    }

    // Dashboard Bailleur (Admin)
    function renderBailleurDashboard() {
        const content = document.createElement('div');
        content.className = 'space-y-6';

        // Titre section
        const sectionTitle = document.createElement('h2');
        sectionTitle.className = 'text-xl font-semibold text-gray-900 mb-4';
        sectionTitle.textContent = 'Configuration du système';

        content.appendChild(sectionTitle);

        // Tuiles de configuration - 6 tuiles cliquables
        const configGrid = document.createElement('div');
        configGrid.className = 'grid grid-cols-1 md:grid-cols-3 gap-6';

        // Tuile 1: Unités de mesure
        configGrid.appendChild(renderStatCard(
            'Unités de mesure',
            '📏',
            'Gérer les unités de mesure',
            'default',
            () => window.location.hash = '#/admin/unites'
        ));

        // Tuile 2: Catégories
        configGrid.appendChild(renderStatCard(
            'Catégories',
            '📂',
            'Gérer les catégories de produits',
            'default',
            () => window.location.hash = '#/admin/categories'
        ));

        // Tuile 3: Produits
        configGrid.appendChild(renderStatCard(
            'Produits',
            '🛒',
            'Gérer les produits',
            'default',
            () => window.location.hash = '#/admin/produits'
        ));

        // Tuile 4: Départements
        configGrid.appendChild(renderStatCard(
            'Départements',
            '🗺️',
            'Gérer les départements',
            'default',
            () => window.location.hash = '#/admin/departements'
        ));

        // Tuile 5: Communes
        configGrid.appendChild(renderStatCard(
            'Communes',
            '🏘️',
            'Gérer les communes',
            'default',
            () => window.location.hash = '#/admin/communes'
        ));

        // Tuile 6: Marchés
        configGrid.appendChild(renderStatCard(
            'Marchés',
            '🏪',
            'Gérer les marchés',
            'default',
            () => window.location.hash = '#/admin/marches'
        ));

        // Tuile 7: Import
        configGrid.appendChild(renderStatCard(
            'Import',
            '📊',
            'Importer des données en masse',
            'primary',
            () => window.location.hash = '#/admin/import'
        ));

        // Tuile 8: Utilisateurs
        configGrid.appendChild(renderStatCard(
            'Utilisateurs',
            '👥',
            'Gérer les comptes utilisateurs',
            'default',
            () => window.location.hash = '#/admin/utilisateurs'
        ));

        // Tuile 9: Rôles
        configGrid.appendChild(renderStatCard(
            'Rôles',
            '🎭',
            'Gérer les rôles du système',
            'default',
            () => window.location.hash = '#/admin/roles'
        ));

        // Tuile 10: Permissions
        configGrid.appendChild(renderStatCard(
            'Permissions',
            '🔑',
            'Gérer les permissions',
            'default',
            () => window.location.hash = '#/admin/permissions'
        ));

        content.appendChild(configGrid);

        return content;
    }

    // Rendu d'un item de collecte
    function renderCollecteItem(collecte) {
        const item = document.createElement('div');
        item.className = 'flex justify-between items-center p-4 border border-gray-200 rounded-lg';

        const left = document.createElement('div');
        left.className = 'flex-1';

        const title = document.createElement('p');
        title.className = 'font-medium text-gray-900';
        title.textContent = `${collecte.produit_nom || 'Produit'} dans ${collecte.marche_nom || 'Marché'}`;

        const meta = document.createElement('p');
        meta.className = 'text-sm text-gray-600';
        const periode = collecte.periode ? ` - ${collecte.periode}` : '';
        // Utiliser created_at pour l'heure de collecte, sinon date
        const dateTime = collecte.created_at ? formatDateTime(collecte.created_at) : formatDate(collecte.date);
        meta.textContent = `${dateTime}${periode} - ${collecte.prix} HTG`;

        left.appendChild(title);
        left.appendChild(meta);

        item.appendChild(left);

        return item;
    }

    // Rendu d'un item d'alerte
    function renderAlerteItem(alerte) {
        const item = document.createElement('div');
        item.className = 'flex justify-between items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer';
        item.onclick = () => window.location.hash = '#/alertes';

        const left = document.createElement('div');
        left.className = 'flex-1';

        const title = document.createElement('p');
        title.className = 'font-medium text-gray-900';
        title.textContent = `${alerte.produit_nom} - ${alerte.marche_nom}`;

        const meta = document.createElement('p');
        meta.className = 'text-sm text-gray-600';
        meta.textContent = `Prix: ${alerte.prix_actuel} HTG (+${Math.round(alerte.ecart_pourcentage)}%)`;

        left.appendChild(title);
        left.appendChild(meta);

        const right = StatusIndicator({ level: alerte.niveau });

        item.appendChild(left);
        item.appendChild(right);

        return item;
    }

    // Helpers
    function getCollecteStatusVariant(statut) {
        switch (statut) {
            case 'validée': return 'success';
            case 'rejetée': return 'danger';
            case 'soumise': return 'warning';
            default: return 'default';
        }
    }

    function formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('fr-FR');
    }

    function formatDateTime(dateString) {
        const date = new Date(dateString);
        const dateStr = date.toLocaleDateString('fr-FR');
        const timeStr = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        return `${dateStr} ${timeStr}`;
    }

    // Chargement des données
    async function loadData() {
        try {
            // Charger les statistiques selon les rôles
            if (auth.hasRole('agent')) {
                const statsData = await api.get('/api/collectes/statistiques/resume');
                stats = statsData;

                const collectesData = await api.get('/api/collectes?limit=10');
                collectes = collectesData;
            }

            if (auth.hasRole('décideur')) {
                const [alertesStats, alertesData] = await Promise.all([
                    api.get('/api/alertes/statistiques/resume'),
                    api.get('/api/alertes?limit=10')
                ]);

                stats = {
                    alertes_actives: alertesStats.total_alertes_actives || 0,
                    alertes_urgentes: alertesStats.par_niveau?.urgence || 0,
                    marches_surveilles: 0 // À implémenter
                };

                alertes = alertesData;
            }

            // Les bailleurs n'ont pas besoin de charger de statistiques
            // (leur dashboard affiche uniquement des tuiles de configuration)

            isLoading = false;
            render();

        } catch (error) {
            console.error('Erreur lors du chargement des données:', error);
            showToast({
                message: 'Erreur lors du chargement des données',
                type: 'error'
            });
            isLoading = false;
            render();
        }
    }

    // Rendu du loader
    function renderLoader() {
        const loader = document.createElement('div');
        loader.className = 'flex items-center justify-center py-12';

        const content = document.createElement('div');
        content.className = 'text-center';

        content.appendChild(Spinner({ size: 'lg' }));

        const text = document.createElement('p');
        text.className = 'mt-4 text-gray-600';
        text.textContent = 'Chargement...';

        content.appendChild(text);
        loader.appendChild(content);

        return loader;
    }

    // Fonction de rendu
    function render() {
        container.innerHTML = '';
        container.appendChild(renderHeader());

        if (isLoading) {
            container.appendChild(renderLoader());
        } else {
            // Gérer les multi-rôles - afficher tous les dashboards correspondants
            const dashboards = [];

            // Vérifier chaque rôle et ajouter le dashboard correspondant
            if (auth.hasRole('agent')) {
                dashboards.push({
                    name: 'Agent',
                    render: renderAgentDashboard
                });
            }

            if (auth.hasRole('décideur')) {
                dashboards.push({
                    name: 'Décideur',
                    render: renderDecideurDashboard
                });
            }

            if (auth.hasRole('bailleur')) {
                dashboards.push({
                    name: 'Administration',
                    render: renderBailleurDashboard
                });
            }

            // Si aucun rôle reconnu
            if (dashboards.length === 0) {
                const errorDiv = document.createElement('div');
                errorDiv.innerHTML = '<p class="text-center text-gray-600">Rôle non reconnu</p>';
                container.appendChild(errorDiv);
                return;
            }

            // Afficher tous les dashboards
            dashboards.forEach((dashboard, index) => {
                // Ajouter un titre de section si multi-rôles
                if (dashboards.length > 1) {
                    const sectionHeader = document.createElement('div');
                    sectionHeader.className = 'mb-4 pb-2 border-b border-gray-200';

                    const sectionTitle = document.createElement('h2');
                    sectionTitle.className = 'text-2xl font-bold text-gray-900';
                    sectionTitle.textContent = `Tableau de bord ${dashboard.name}`;

                    sectionHeader.appendChild(sectionTitle);
                    container.appendChild(sectionHeader);
                }

                // Rendre le dashboard
                const dashboardContent = dashboard.render();
                container.appendChild(dashboardContent);

                // Ajouter un espaceur entre les dashboards
                if (index < dashboards.length - 1) {
                    const spacer = document.createElement('div');
                    spacer.className = 'h-8';
                    container.appendChild(spacer);
                }
            });
        }
    }

    // Charger les données au montage
    loadData();

    // Rendu initial
    render();

    return container;
}
