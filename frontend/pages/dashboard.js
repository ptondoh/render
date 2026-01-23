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
                return 'Bailleur - Consultation et analyse des données';
            default:
                return 'Bienvenue sur le Système d\'Alerte Précoce';
        }
    }

    // Carte de statistiques
    function renderStatCard(title, value, description, variant = 'default') {
        const card = document.createElement('div');
        card.className = 'bg-white rounded-lg shadow-md border border-gray-200 p-6';

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

        // Statistiques
        const statsGrid = document.createElement('div');
        statsGrid.className = 'grid grid-cols-1 md:grid-cols-3 gap-6';

        if (stats) {
            statsGrid.appendChild(renderStatCard(
                'Mes collectes',
                stats.total_collectes || 0,
                'Total des collectes soumises'
            ));

            statsGrid.appendChild(renderStatCard(
                'Validées',
                stats.validees || 0,
                'Collectes validées',
                'success'
            ));

            statsGrid.appendChild(renderStatCard(
                'En attente',
                stats.en_attente || 0,
                'Collectes en cours de validation',
                'warning'
            ));
        }

        content.appendChild(statsGrid);

        // Bouton nouvelle collecte
        const actionCard = Card({
            title: 'Actions rapides',
            children: [
                (() => {
                    const div = document.createElement('div');
                    div.className = 'text-center py-4';

                    const btn = Button({
                        text: '+ Nouvelle collecte',
                        variant: 'primary',
                        size: 'lg',
                        onClick: () => window.location.hash = '#/collectes/nouvelle'
                    });

                    div.appendChild(btn);
                    return div;
                })()
            ]
        });

        content.appendChild(actionCard);

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
        statsGrid.className = 'grid grid-cols-1 md:grid-cols-4 gap-6';

        if (stats) {
            statsGrid.appendChild(renderStatCard(
                'Collectes en attente',
                stats.en_attente || 0,
                'À valider',
                'warning'
            ));

            statsGrid.appendChild(renderStatCard(
                'Alertes actives',
                stats.alertes_actives || 0,
                'Nécessitent attention',
                'danger'
            ));

            statsGrid.appendChild(renderStatCard(
                'Alertes urgentes',
                stats.alertes_urgentes || 0,
                'Niveau urgence',
                'danger'
            ));

            statsGrid.appendChild(renderStatCard(
                'Marchés surveillés',
                stats.marches_surveilles || 0,
                'Avec prix élevés'
            ));
        }

        content.appendChild(statsGrid);

        // Actions rapides
        const actionsGrid = document.createElement('div');
        actionsGrid.className = 'grid grid-cols-1 md:grid-cols-2 gap-6';

        const validateCard = Card({
            title: 'Validation des collectes',
            children: [
                (() => {
                    const div = document.createElement('div');
                    div.className = 'text-center py-4';

                    const btn = Button({
                        text: 'Voir les collectes en attente',
                        variant: 'primary',
                        onClick: () => window.location.hash = '#/collectes?statut=soumise'
                    });

                    div.appendChild(btn);
                    return div;
                })()
            ]
        });

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

        actionsGrid.appendChild(validateCard);
        actionsGrid.appendChild(alertesCard);

        content.appendChild(actionsGrid);

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

    // Dashboard Bailleur
    function renderBailleurDashboard() {
        const content = document.createElement('div');
        content.className = 'space-y-6';

        // Statistiques globales
        const statsGrid = document.createElement('div');
        statsGrid.className = 'grid grid-cols-1 md:grid-cols-4 gap-6';

        if (stats) {
            statsGrid.appendChild(renderStatCard(
                'Total collectes',
                stats.total_collectes || 0,
                'Sur tous les marchés'
            ));

            statsGrid.appendChild(renderStatCard(
                'Alertes actives',
                stats.alertes_actives || 0,
                'Toutes catégories',
                'warning'
            ));

            statsGrid.appendChild(renderStatCard(
                'Marchés',
                stats.total_marches || 0,
                'Dans le système'
            ));

            statsGrid.appendChild(renderStatCard(
                'Départements',
                stats.total_departements || 10,
                'Couverts'
            ));
        }

        content.appendChild(statsGrid);

        // Vue d'ensemble
        const overviewCard = Card({
            title: 'Vue d\'ensemble',
            children: [
                (() => {
                    const div = document.createElement('div');
                    div.className = 'text-center py-8';
                    div.innerHTML = '<p class="text-gray-600">Tableaux de bord et analyses détaillées à venir</p>';
                    return div;
                })()
            ]
        });

        content.appendChild(overviewCard);

        return content;
    }

    // Rendu d'un item de collecte
    function renderCollecteItem(collecte) {
        const item = document.createElement('div');
        item.className = 'flex justify-between items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer';
        item.onclick = () => window.location.hash = `#/collectes/${collecte.id}`;

        const left = document.createElement('div');
        left.className = 'flex-1';

        const title = document.createElement('p');
        title.className = 'font-medium text-gray-900';
        title.textContent = `Produit ${collecte.produit_id}`;

        const meta = document.createElement('p');
        meta.className = 'text-sm text-gray-600';
        meta.textContent = `${formatDate(collecte.date)} - ${collecte.prix} HTG`;

        left.appendChild(title);
        left.appendChild(meta);

        const right = Badge({
            text: collecte.statut.charAt(0).toUpperCase() + collecte.statut.slice(1),
            variant: getCollecteStatusVariant(collecte.statut)
        });

        item.appendChild(left);
        item.appendChild(right);

        return item;
    }

    // Rendu d'un item d'alerte
    function renderAlerteItem(alerte) {
        const item = document.createElement('div');
        item.className = 'flex justify-between items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer';
        item.onclick = () => window.location.hash = `#/alertes/${alerte.id}`;

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

    // Chargement des données
    async function loadData() {
        try {
            // Charger les statistiques selon le rôle
            if (user.role === 'agent') {
                const statsData = await api.get('/api/collectes/statistiques/resume');
                stats = statsData;

                const collectesData = await api.get('/api/collectes?limit=10');
                collectes = collectesData;

            } else if (user.role === 'décideur') {
                const [collectesStats, alertesStats, alertesData] = await Promise.all([
                    api.get('/api/collectes/statistiques/resume'),
                    api.get('/api/alertes/statistiques/resume'),
                    api.get('/api/alertes?limit=10')
                ]);

                stats = {
                    en_attente: collectesStats.par_statut?.soumise || 0,
                    alertes_actives: alertesStats.total_alertes_actives || 0,
                    alertes_urgentes: alertesStats.par_niveau?.urgence || 0,
                    marches_surveilles: 0 // À implémenter
                };

                alertes = alertesData;

            } else if (user.role === 'bailleur') {
                const [collectesStats, alertesStats] = await Promise.all([
                    api.get('/api/collectes/statistiques/resume'),
                    api.get('/api/alertes/statistiques/resume')
                ]);

                stats = {
                    total_collectes: collectesStats.total_collectes || 0,
                    alertes_actives: alertesStats.total_alertes_actives || 0,
                    total_marches: 0, // À implémenter
                    total_departements: 10
                };
            }

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
            let dashboardContent;

            switch (user.role) {
                case 'agent':
                    dashboardContent = renderAgentDashboard();
                    break;
                case 'décideur':
                    dashboardContent = renderDecideurDashboard();
                    break;
                case 'bailleur':
                    dashboardContent = renderBailleurDashboard();
                    break;
                default:
                    dashboardContent = document.createElement('div');
                    dashboardContent.innerHTML = '<p class="text-center text-gray-600">Rôle non reconnu</p>';
            }

            container.appendChild(dashboardContent);
        }
    }

    // Charger les données au montage
    loadData();

    // Rendu initial
    render();

    return container;
}
