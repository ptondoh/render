/**
 * Module 6.1 – Vue d'ensemble nationale pour décideurs
 * Carte interactive Haïti + KPIs + auto-refresh
 * Accès réservé aux rôles décideur et bailleur.
 */

import auth from '../modules/auth.js';
import api from '../modules/api.js';
import { Card, Button, Spinner, showToast } from '../modules/ui.js';
import {
    loadPreferences, savePreferences,
    showShareModal, showConfigModal
} from '../modules/dashboard-utils.js';

export default function TableauBordNationalPage() {
    const container = document.createElement('div');
    container.className = 'space-y-6';

    // Vérification d'accès
    if (!auth.hasAnyRole(['décideur', 'bailleur'])) {
        container.innerHTML = `
            <div class="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                <div class="text-4xl mb-3">🔒</div>
                <h2 class="text-xl font-bold text-red-800 mb-2">Accès refusé</h2>
                <p class="text-red-600">Ce module est réservé aux décideurs et administrateurs.</p>
                <a href="#/dashboard" class="inline-block mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
                    Retour au tableau de bord
                </a>
            </div>`;
        return container;
    }

    // ── Préférences persistées ──────────────────────────────────────────────
    let prefs = loadPreferences();

    // État
    let isLoading = true;
    let data = null;
    let map = null;
    let autoRefreshInterval = null;
    let autoRefreshActive = prefs.autoRefresh || false;
    const getRefreshMs = () => (prefs.refreshIntervalMin || 5) * 60 * 1000;

    // Couleurs par niveau
    const COULEURS = {
        normal:       { hex: '#22c55e', tailwind: 'green',  label: 'Normal',           icon: '🟢' },
        surveillance: { hex: '#eab308', tailwind: 'yellow', label: 'Surveillance',      icon: '🟡' },
        alerte:       { hex: '#f97316', tailwind: 'orange', label: 'Alerte active',     icon: '🟠' },
        urgence:      { hex: '#ef4444', tailwind: 'red',    label: 'Urgence critique',  icon: '🔴' }
    };

    // ──────────────────────────────────────────────
    // Chargement
    // ──────────────────────────────────────────────
    async function loadData() {
        try {
            isLoading = true;
            render();
            data = await api.get('/api/dashboard/national');
        } catch (err) {
            showToast({ message: 'Erreur lors du chargement du tableau de bord national', type: 'error' });
            console.error('Erreur tableau de bord national:', err);
            data = null;
        } finally {
            isLoading = false;
            render();
        }
    }

    // ──────────────────────────────────────────────
    // Header
    // ──────────────────────────────────────────────
    function renderHeader() {
        const header = document.createElement('div');
        header.className = 'flex flex-wrap gap-4 items-center justify-between';

        const titleDiv = document.createElement('div');
        titleDiv.innerHTML = `
            <h1 class="text-3xl font-bold text-gray-900">🗺️ Vue d'ensemble nationale</h1>
            <p class="text-gray-600 mt-1">Situation de sécurité alimentaire – Haïti</p>
        `;

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'flex items-center gap-3 flex-wrap';

        // Bouton auto-refresh
        const refreshToggle = document.createElement('button');
        refreshToggle.className = `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            autoRefreshActive
                ? 'bg-green-100 text-green-700 border border-green-300'
                : 'bg-gray-100 text-gray-600 border border-gray-300'
        }`;
        refreshToggle.textContent = autoRefreshActive
            ? `⏸ Auto-refresh ON (${prefs.refreshIntervalMin || 5} min)`
            : '▶ Auto-refresh';
        refreshToggle.onclick = toggleAutoRefresh;

        // Bouton actualiser manuellement
        const manualRefreshBtn = Button({
            text: '🔄 Actualiser',
            variant: 'secondary',
            size: 'sm',
            onClick: loadData
        });

        // Bouton Partager
        const shareBtn = Button({
            text: '📤 Partager',
            variant: 'secondary',
            size: 'sm',
            onClick: () => showShareModal()
        });

        // Bouton Configurer
        const configBtn = Button({
            text: '⚙️ Configurer',
            variant: 'secondary',
            size: 'sm',
            onClick: () => showConfigModal((newPrefs) => {
                prefs = newPrefs;
                // Relancer l'auto-refresh si l'intervalle a changé
                if (autoRefreshActive) {
                    if (autoRefreshInterval) clearInterval(autoRefreshInterval);
                    autoRefreshInterval = setInterval(loadData, getRefreshMs());
                }
                render();
            })
        });

        // Breadcrumb
        const breadcrumb = document.createElement('a');
        breadcrumb.href = '#/dashboard';
        breadcrumb.className = 'text-sm text-blue-600 hover:underline';
        breadcrumb.textContent = '← Tableau de bord';

        actionsDiv.appendChild(refreshToggle);
        actionsDiv.appendChild(manualRefreshBtn);
        actionsDiv.appendChild(shareBtn);
        actionsDiv.appendChild(configBtn);

        header.appendChild(titleDiv);
        header.appendChild(actionsDiv);

        const wrap = document.createElement('div');
        wrap.className = 'space-y-2';
        wrap.appendChild(breadcrumb);
        wrap.appendChild(header);

        return wrap;
    }

    // ──────────────────────────────────────────────
    // KPIs
    // ──────────────────────────────────────────────
    function renderKPIs() {
        const kpis = data?.kpis || {};
        const zones = kpis.zones_par_niveau || {};
        const evolution = kpis.evolution_6_mois || {};

        const grid = document.createElement('div');
        grid.className = 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4';

        const kpiItems = [
            {
                label: 'Zones par niveau',
                value: Object.entries(zones).map(([n, c]) => `${COULEURS[n]?.icon || '⚪'} ${c}`).join('  '),
                sub: 'Répartition des zones',
                color: 'blue',
                small: true
            },
            {
                label: 'Population à risque',
                value: formatPopulation(kpis.population_a_risque || 0),
                sub: 'Zones surveillance+',
                color: 'orange'
            },
            {
                label: 'Évolution 6 mois',
                value: `${evolution.variation_pct > 0 ? '+' : ''}${evolution.variation_pct || 0}%`,
                sub: evolution.tendance || 'stable',
                color: evolution.tendance === 'amélioration' ? 'green' : (evolution.tendance === 'dégradation' ? 'red' : 'gray')
            },
            {
                label: 'Alertes actives',
                value: kpis.alertes_actives || 0,
                sub: 'Nécessitent une action',
                color: (kpis.alertes_actives || 0) > 0 ? 'red' : 'green',
                clickable: '#/alertes'
            },
            {
                label: 'Activités récentes',
                value: kpis.interventions_actives || 0,
                sub: 'Collectes (7 derniers jours)',
                color: 'blue'
            },
            {
                label: 'Produit le + affecté',
                value: kpis.prix_cles?.[0]?.produit || '–',
                sub: kpis.prix_cles?.[0] ? `+${kpis.prix_cles[0].variation_pct}%` : 'Aucune alerte',
                color: 'red',
                small: true
            }
        ];

        kpiItems.forEach(kpi => {
            const card = document.createElement('div');
            card.className = `bg-white rounded-lg shadow border-l-4 border-${kpi.color}-500 p-4 ${kpi.clickable ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`;
            if (kpi.clickable) card.onclick = () => { window.location.hash = kpi.clickable; };

            card.innerHTML = `
                <p class="text-xs text-gray-500 mb-1 font-medium uppercase">${kpi.label}</p>
                <p class="text-${kpi.small ? 'base' : '2xl'} font-bold text-${kpi.color}-600 ${kpi.small ? 'leading-tight' : ''}">${kpi.value}</p>
                <p class="text-xs text-gray-400 mt-1">${kpi.sub}</p>
            `;
            grid.appendChild(card);
        });

        return grid;
    }

    // ──────────────────────────────────────────────
    // Carte interactive
    // ──────────────────────────────────────────────
    function renderMapSection() {
        const section = document.createElement('div');
        section.className = 'bg-white rounded-lg shadow p-4';

        const titleRow = document.createElement('div');
        titleRow.className = 'flex items-center justify-between mb-4';
        titleRow.innerHTML = `
            <h3 class="text-lg font-semibold text-gray-800">🗺️ Carte nationale interactive</h3>
        `;

        // Légende
        const legende = document.createElement('div');
        legende.className = 'flex flex-wrap gap-3 text-sm mb-4';
        Object.entries(COULEURS).forEach(([niveau, cfg]) => {
            legende.innerHTML += `
                <span class="flex items-center gap-1">
                    <span class="w-3 h-3 rounded-full inline-block" style="background:${cfg.hex}"></span>
                    <span class="text-gray-600">${cfg.label}</span>
                </span>`;
        });

        const mapDiv = document.createElement('div');
        mapDiv.id = 'national-map';
        mapDiv.style.height = '420px';
        mapDiv.className = 'rounded-lg z-0';

        section.appendChild(titleRow);
        section.appendChild(legende);
        section.appendChild(mapDiv);

        setTimeout(() => initMap(), 150);

        return section;
    }

    function initMap() {
        if (typeof L === 'undefined') {
            console.warn('Leaflet non disponible');
            return;
        }
        if (map) { map.remove(); map = null; }

        map = L.map('national-map', { zoomControl: true }).setView([18.9712, -72.2852], 7);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
            maxZoom: 13
        }).addTo(map);

        const departements = data?.carte?.departements || [];

        departements.forEach(dept => {
            const centres = getCentreDepartement(dept.code);
            if (!centres) return;

            const couleur = COULEURS[dept.niveau]?.hex || '#6b7280';

            const cercle = L.circleMarker([centres.lat, centres.lon], {
                radius: 22,
                fillColor: couleur,
                color: '#ffffff',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.85
            }).addTo(map);

            const popupContent = `
                <div style="min-width:200px; font-family:sans-serif;">
                    <div style="font-weight:700; font-size:15px; margin-bottom:8px; border-bottom:2px solid ${couleur}; padding-bottom:4px;">
                        ${dept.nom}
                    </div>
                    <div style="margin-bottom:6px;">
                        <span style="background:${couleur};color:#fff;padding:2px 8px;border-radius:12px;font-size:12px;font-weight:600;">
                            ${COULEURS[dept.niveau]?.label || dept.niveau}
                        </span>
                    </div>
                    <div style="font-size:12px; color:#374151; line-height:1.8;">
                        🏙️ ${dept.nb_communes} communes<br>
                        🏪 ${dept.nb_marches} marchés<br>
                        ⚠️ ${dept.nb_alertes} alerte(s) active(s)
                    </div>
                    <div style="margin-top:8px; padding-top:8px; border-top:1px solid #e5e7eb;">
                        <a href="#/drilldown-geo?niveau=departement&zone_id=${dept.id}"
                           style="color:#2563eb; font-size:12px; font-weight:500; text-decoration:none;">
                           🔍 Voir les détails →
                        </a>
                    </div>
                </div>
            `;

            cercle.bindPopup(popupContent, { maxWidth: 260 });

            cercle.on('click', () => {
                window.location.hash = `#/drilldown-geo?niveau=departement&zone_id=${dept.id}`;
            });
        });
    }

    function getCentreDepartement(code) {
        const centres = {
            'HT-OU': { lat: 18.5475, lon: -74.1313 }, // Ouest
            'HT-SU': { lat: 18.2000, lon: -73.7500 }, // Sud
            'HT-SD': { lat: 18.4333, lon: -73.7500 }, // Sud-Est
            'HT-NI': { lat: 19.6917, lon: -72.8333 }, // Nord
            'HT-NE': { lat: 19.6000, lon: -71.8500 }, // Nord-Est
            'HT-ND': { lat: 19.9333, lon: -73.0833 }, // Nord-Ouest
            'HT-AR': { lat: 19.1500, lon: -72.4000 }, // Artibonite
            'HT-CE': { lat: 19.0833, lon: -71.8667 }, // Centre
            'HT-GD': { lat: 18.8333, lon: -74.4167 }, // Grande-Anse
            'HT-NP': { lat: 18.5333, lon: -73.4667 }, // Nippes
        };
        return centres[code] || null;
    }

    // ──────────────────────────────────────────────
    // Tableau prix clés
    // ──────────────────────────────────────────────
    function renderPrixCles() {
        const prixCles = data?.kpis?.prix_cles || [];
        if (!prixCles.length) return document.createElement('div');

        const section = document.createElement('div');
        section.className = 'bg-white rounded-lg shadow p-4';

        section.innerHTML = `
            <h3 class="text-lg font-semibold text-gray-800 mb-4">📈 Prix clés – Produits les plus affectés</h3>
        `;

        const table = document.createElement('table');
        table.className = 'min-w-full text-sm';
        table.innerHTML = `
            <thead class="bg-gray-50">
                <tr>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Produit</th>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Marché</th>
                    <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Prix réf.</th>
                    <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Prix actuel</th>
                    <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Variation</th>
                    <th class="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Niveau</th>
                </tr>
            </thead>
        `;

        const tbody = document.createElement('tbody');
        tbody.className = 'divide-y divide-gray-200';

        prixCles.forEach(p => {
            const cfg = COULEURS[p.niveau] || COULEURS.surveillance;
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50';
            tr.innerHTML = `
                <td class="px-4 py-3 font-medium text-gray-900">${sanitize(p.produit)}</td>
                <td class="px-4 py-3 text-gray-600">${sanitize(p.marche)}</td>
                <td class="px-4 py-3 text-right text-gray-600">${p.prix_reference} HTG</td>
                <td class="px-4 py-3 text-right font-semibold text-gray-900">${p.prix_actuel} HTG</td>
                <td class="px-4 py-3 text-right font-bold text-red-600">+${p.variation_pct}%</td>
                <td class="px-4 py-3 text-center">
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                          style="background:${cfg.hex}22; color:${cfg.hex}; border:1px solid ${cfg.hex}55;">
                        ${cfg.icon} ${cfg.label}
                    </span>
                </td>
            `;
            tbody.appendChild(tr);
        });

        table.appendChild(tbody);
        section.appendChild(table);

        return section;
    }

    // ──────────────────────────────────────────────
    // Liens rapides module 6
    // ──────────────────────────────────────────────
    function renderLiensRapides() {
        const section = document.createElement('div');
        section.className = 'bg-white rounded-lg shadow p-4';

        section.innerHTML = `<h3 class="text-lg font-semibold text-gray-800 mb-4">🔗 Analyses approfondies</h3>`;

        const grid = document.createElement('div');
        grid.className = 'grid grid-cols-1 md:grid-cols-3 gap-4';

        const liens = [
            {
                href: '#/indicateurs-detailles?type=top10',
                icon: '🏆',
                titre: 'Top 10 zones à risque',
                desc: 'Classement des zones les plus critiques',
                color: 'red'
            },
            {
                href: '#/indicateurs-detailles?type=prix',
                icon: '📊',
                titre: 'Évolution des prix',
                desc: 'Graphiques interactifs par produit et marché',
                color: 'blue'
            },
            {
                href: '#/drilldown-geo',
                icon: '🔍',
                titre: 'Drill-down géographique',
                desc: 'Explorer zone par zone jusqu\'à la commune',
                color: 'green'
            }
        ];

        liens.forEach(lien => {
            const card = document.createElement('a');
            card.href = lien.href;
            card.className = `block p-4 border border-${lien.color}-200 rounded-lg hover:border-${lien.color}-400 hover:bg-${lien.color}-50 transition-colors`;
            card.innerHTML = `
                <div class="text-2xl mb-2">${lien.icon}</div>
                <div class="font-semibold text-gray-900 mb-1">${lien.titre}</div>
                <div class="text-sm text-gray-500">${lien.desc}</div>
            `;
            grid.appendChild(card);
        });

        section.appendChild(grid);
        return section;
    }

    // ──────────────────────────────────────────────
    // Auto-refresh
    // ──────────────────────────────────────────────
    function toggleAutoRefresh() {
        autoRefreshActive = !autoRefreshActive;
        // Persister la préférence
        prefs = { ...prefs, autoRefresh: autoRefreshActive };
        savePreferences(prefs);

        if (autoRefreshActive) {
            autoRefreshInterval = setInterval(loadData, getRefreshMs());
            showToast({
                message: `Auto-refresh activé (toutes les ${prefs.refreshIntervalMin || 5} minutes)`,
                type: 'success'
            });
        } else {
            if (autoRefreshInterval) clearInterval(autoRefreshInterval);
            autoRefreshInterval = null;
            showToast({ message: 'Auto-refresh désactivé', type: 'info' });
        }
        render();
    }

    // ──────────────────────────────────────────────
    // Utilitaires
    // ──────────────────────────────────────────────
    function formatPopulation(n) {
        if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
        if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
        return n.toString();
    }

    function sanitize(str) {
        if (!str) return '';
        return String(str).replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // ──────────────────────────────────────────────
    // Rendu
    // ──────────────────────────────────────────────
    function render() {
        // Recharger les préférences à chaque rendu pour refléter les changements
        prefs = loadPreferences();
        const widgets = prefs.widgets || {};

        container.innerHTML = '';
        container.appendChild(renderHeader());

        if (isLoading) {
            const loader = document.createElement('div');
            loader.className = 'flex justify-center items-center py-16';
            loader.appendChild(Spinner({ size: 'lg' }));
            const txt = document.createElement('p');
            txt.className = 'ml-4 text-gray-600';
            txt.textContent = 'Chargement des données nationales…';
            loader.appendChild(txt);
            container.appendChild(loader);
            return;
        }

        if (!data) {
            const err = document.createElement('div');
            err.className = 'bg-red-50 border border-red-200 rounded-lg p-6 text-center';
            err.innerHTML = `
                <div class="text-4xl mb-3">⚠️</div>
                <h3 class="text-lg font-semibold text-red-800 mb-2">Données non disponibles</h3>
                <p class="text-red-600 mb-4">Impossible de charger les données du tableau de bord national.</p>
            `;
            const retryBtn = Button({ text: '🔄 Réessayer', variant: 'danger', onClick: loadData });
            err.appendChild(retryBtn);
            container.appendChild(err);
            return;
        }

        // Metadata
        if (data.meta?.genere_a) {
            const metaBar = document.createElement('div');
            metaBar.className = 'text-xs text-gray-400 text-right';
            metaBar.textContent = `Données générées le ${new Date(data.meta.genere_a).toLocaleString('fr-FR')}`;
            container.appendChild(metaBar);
        }

        // Widgets filtrés selon les préférences
        if (widgets.kpis !== false) container.appendChild(renderKPIs());
        if (widgets.carte !== false) container.appendChild(renderMapSection());
        if (widgets.prixCles !== false) container.appendChild(renderPrixCles());
        if (widgets.liensRapides !== false) container.appendChild(renderLiensRapides());
    }

    // Nettoyage auto-refresh au démontage
    const observer = new MutationObserver(() => {
        if (!document.contains(container)) {
            if (autoRefreshInterval) clearInterval(autoRefreshInterval);
            observer.disconnect();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Init : démarrer auto-refresh si préférence persistée
    if (autoRefreshActive) {
        autoRefreshInterval = setInterval(loadData, getRefreshMs());
    }

    loadData();
    render();

    return container;
}
