/**
 * Module 6.3 – Drill-down géographique
 * Navigation hiérarchique : National → Département → Commune (→ Section)
 * Profil complet par zone : alertes, historique, interventions, carte
 * Accès réservé aux rôles décideur et bailleur.
 *
 * Fonctionnalités :
 * - Export Excel du profil de commune (SheetJS)
 * - Partage par lien / courriel
 * - Configuration persistée (localStorage)
 */

import auth from '../modules/auth.js';
import api  from '../modules/api.js';
import { Button, Spinner, showToast } from '../modules/ui.js';
import {
    exportToExcel, buildProfilCommuneSheets,
    showShareModal, showConfigModal
} from '../modules/dashboard-utils.js';

export default function DrilldownGeoPage() {
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

    // ── Paramètres depuis l'URL ─────────────────────────────────────────────
    function getParamsFromURL() {
        const hash = window.location.hash;
        const qs   = hash.includes('?') ? hash.split('?')[1] : '';
        const p    = new URLSearchParams(qs);
        return { niveau: p.get('niveau') || 'national', zone_id: p.get('zone_id') || null };
    }

    let { niveau: currentNiveau, zone_id: currentZoneId } = getParamsFromURL();

    // ── État ────────────────────────────────────────────────────────────────
    let isLoading = false;
    let data      = null;
    let map       = null;

    const COULEURS = {
        normal:       { hex: '#22c55e', label: 'Normal',      icon: '🟢' },
        surveillance: { hex: '#eab308', label: 'Surveillance', icon: '🟡' },
        alerte:       { hex: '#f97316', label: 'Alerte',       icon: '🟠' },
        urgence:      { hex: '#ef4444', label: 'Urgence',      icon: '🔴' }
    };

    const NIVEAUX_LABEL = {
        national:    '🌐 Haïti (National)',
        departement: '🏛️ Département',
        commune:     '🏘️ Commune',
        section:     '🏡 Section communale'
    };

    function sanitize(str) {
        if (!str) return '';
        return String(str).replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function formatPopulation(n) {
        if (!n) return '–';
        if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
        if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}k`;
        return n.toString();
    }

    // ── Chargement ──────────────────────────────────────────────────────────
    async function loadData() {
        try {
            isLoading = true;
            data      = null;
            render();

            let url = `/api/dashboard/drilldown?niveau=${currentNiveau}`;
            if (currentZoneId) url += `&zone_id=${currentZoneId}`;

            data = await api.get(url);
        } catch (err) {
            showToast({ message: 'Erreur lors du chargement des données géographiques', type: 'error' });
            console.error(err);
            data = null;
        } finally {
            isLoading = false;
            render();
        }
    }

    // ── Navigation ──────────────────────────────────────────────────────────
    function naviguerVers(niveau, zoneId = null) {
        currentNiveau = niveau;
        currentZoneId = zoneId;
        const hash = zoneId
            ? `#/drilldown-geo?niveau=${niveau}&zone_id=${zoneId}`
            : `#/drilldown-geo?niveau=${niveau}`;
        history.replaceState(null, '', window.location.pathname + hash);
        loadData();
    }

    function remonter() {
        const nav = data?.navigation;
        if (!nav?.peut_remonter) return;
        naviguerVers(nav.niveau_parent, nav.parent_id || null);
    }

    // ── Header ──────────────────────────────────────────────────────────────
    function renderHeader() {
        const wrap = document.createElement('div');
        wrap.className = 'space-y-3';

        // Fil d'Ariane
        const breadcrumb = document.createElement('div');
        breadcrumb.className = 'flex flex-wrap items-center gap-1.5 text-sm text-gray-500';

        [
            { label: 'Tableau de bord',        href: '#/dashboard'            },
            { label: 'Vue nationale',           href: '#/tableau-bord-national' },
            { label: 'Drill-down géographique', href: null                     }
        ].forEach((c, i, arr) => {
            const el = c.href
                ? Object.assign(document.createElement('a'), { href: c.href, className: 'hover:text-blue-600', textContent: c.label })
                : Object.assign(document.createElement('span'), { className: 'text-gray-800 font-medium', textContent: c.label });
            breadcrumb.appendChild(el);
            if (i < arr.length - 1) {
                const sep = document.createElement('span');
                sep.textContent = '›';
                breadcrumb.appendChild(sep);
            }
        });

        const titleRow = document.createElement('div');
        titleRow.className = 'flex flex-wrap gap-4 items-center justify-between';

        const titleDiv = document.createElement('div');
        titleDiv.innerHTML = `
            <h1 class="text-3xl font-bold text-gray-900">🔍 Drill-down géographique</h1>
            <p class="text-gray-600 mt-1">
                Niveau actuel : <strong>${NIVEAUX_LABEL[currentNiveau] || currentNiveau}</strong>
                ${data?.zone_parent ? ` – ${sanitize(data.zone_parent.nom)}` : ''}
                ${data?.profil ? ` – ${sanitize(data.profil.localisation?.commune)}` : ''}
            </p>
        `;

        const actions = document.createElement('div');
        actions.className = 'flex gap-2 flex-wrap';

        if (data?.navigation?.peut_remonter) {
            actions.appendChild(Button({ text: '← Remonter', variant: 'secondary', size: 'sm', onClick: remonter }));
        }
        actions.appendChild(Button({
            text: '🌐 Vue nationale', variant: 'secondary', size: 'sm',
            onClick: () => naviguerVers('national')
        }));
        actions.appendChild(Button({
            text: '📤 Partager', variant: 'secondary', size: 'sm',
            onClick: () => showShareModal()
        }));
        actions.appendChild(Button({
            text: '⚙️ Config', variant: 'secondary', size: 'sm',
            onClick: () => showConfigModal(prefs => {
                showToast({ message: 'Préférences sauvegardées', type: 'success' });
            })
        }));

        titleRow.appendChild(titleDiv);
        titleRow.appendChild(actions);

        // Indicateur de niveau géographique (fil d'Ariane)
        const niveauBar = document.createElement('div');
        niveauBar.className = 'flex items-center gap-2 text-xs flex-wrap';

        const niveaux = ['national', 'departement', 'commune', 'section'];
        niveaux.forEach((n, i) => {
            const isActive = n === currentNiveau;
            const isPast   = niveaux.indexOf(currentNiveau) > i;

            const badge = document.createElement('span');
            badge.className = `px-2 py-1 rounded-full font-medium ${
                isActive ? 'bg-blue-600 text-white' :
                isPast   ? 'bg-blue-100 text-blue-700' :
                           'bg-gray-100 text-gray-400'
            }`;
            badge.textContent = NIVEAUX_LABEL[n];
            niveauBar.appendChild(badge);

            if (i < niveaux.length - 1) {
                const arrow = document.createElement('span');
                arrow.className = 'text-gray-300';
                arrow.textContent = '→';
                niveauBar.appendChild(arrow);
            }
        });

        wrap.appendChild(breadcrumb);
        wrap.appendChild(titleRow);
        wrap.appendChild(niveauBar);
        return wrap;
    }

    // ── Liste des zones (national / département) ────────────────────────────
    function renderZonesList() {
        const zones        = data?.zones || [];
        const niveauSuivant = zones[0]?.niveau_suivant || 'commune';

        const section = document.createElement('div');
        section.className = 'bg-white rounded-lg shadow overflow-hidden';

        const sectionHeader = document.createElement('div');
        sectionHeader.className = 'px-6 py-4 border-b border-gray-200 flex items-center justify-between';
        sectionHeader.innerHTML = `
            <div>
                <h3 class="text-lg font-semibold text-gray-800">
                    ${currentNiveau === 'national' ? '🏛️ Départements d\'Haïti' : '🏘️ Communes'}
                </h3>
                <p class="text-xs text-gray-400 mt-0.5">Cliquez sur une zone pour descendre dans les détails</p>
            </div>
            <span class="text-sm text-gray-500">${zones.length} zone(s)</span>
        `;
        section.appendChild(sectionHeader);

        if (!zones.length) {
            section.innerHTML += `<div class="p-12 text-center text-gray-500"><p>Aucune zone disponible.</p></div>`;
            return section;
        }

        const grid = document.createElement('div');
        grid.className = 'divide-y divide-gray-100';

        zones.forEach(zone => {
            const cfg = COULEURS[zone.niveau] || COULEURS.normal;
            const row = document.createElement('div');
            row.className = 'flex items-center gap-4 px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors';

            // Indicateur couleur
            const dot = document.createElement('div');
            dot.className = 'w-3 h-3 rounded-full shrink-0';
            dot.style.background = cfg.hex;

            // Infos zone
            const info = document.createElement('div');
            info.className = 'flex-1 min-w-0';
            info.innerHTML = `
                <div class="flex items-center gap-2">
                    <span class="font-medium text-gray-900">${sanitize(zone.nom)}</span>
                    ${zone.code ? `<span class="text-xs text-gray-400 font-mono">${zone.code}</span>` : ''}
                </div>
                <div class="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-3">
                    ${zone.nb_communes !== undefined ? `<span>🏘️ ${zone.nb_communes} communes</span>` : ''}
                    ${zone.nb_marches  !== undefined ? `<span>🏪 ${zone.nb_marches} marchés</span>`   : ''}
                    ${zone.population  ? `<span>👥 ${formatPopulation(zone.population)}</span>`        : ''}
                </div>
            `;

            // Compteur alertes
            const alerteBadge = document.createElement('div');
            alerteBadge.className = 'text-center shrink-0';
            alerteBadge.innerHTML = `
                <p class="text-xl font-bold" style="color:${zone.nb_alertes > 0 ? cfg.hex : '#9ca3af'};">
                    ${zone.nb_alertes}
                </p>
                <p class="text-xs text-gray-400">alerte(s)</p>
            `;

            // Badge niveau
            const niveauBadge = document.createElement('span');
            niveauBadge.className = 'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium shrink-0';
            niveauBadge.style.cssText = `background:${cfg.hex}22; color:${cfg.hex}; border:1px solid ${cfg.hex}55;`;
            niveauBadge.textContent = `${cfg.icon} ${cfg.label}`;

            // Flèche
            const arrow = document.createElement('span');
            arrow.className = 'text-gray-300 text-xl shrink-0';
            arrow.textContent = '→';

            row.appendChild(dot);
            row.appendChild(info);
            row.appendChild(alerteBadge);
            row.appendChild(niveauBadge);
            row.appendChild(arrow);
            row.onclick = () => naviguerVers(niveauSuivant, zone.id);

            grid.appendChild(row);
        });

        section.appendChild(grid);
        return section;
    }

    // ── Profil complet de commune ───────────────────────────────────────────
    function renderProfilCommune() {
        const profil = data?.profil;
        if (!profil) return document.createElement('div');

        const wrap = document.createElement('div');
        wrap.className = 'space-y-6';

        const cfg = COULEURS[profil.situation_securite_alimentaire?.niveau_global] || COULEURS.normal;

        // ── En-tête du profil ───────────────────────────────────────────────
        const header = document.createElement('div');
        header.className = 'bg-white rounded-lg shadow p-6';
        header.innerHTML = `
            <div class="flex flex-wrap gap-4 items-start justify-between">
                <div>
                    <h2 class="text-2xl font-bold text-gray-900">
                        🏘️ ${sanitize(profil.localisation?.commune)}
                    </h2>
                    <p class="text-gray-500 mt-1">
                        📍 ${sanitize(profil.localisation?.departement)}
                        ${profil.localisation?.code_departement ? ` (${profil.localisation.code_departement})` : ''}
                    </p>
                </div>
                <div class="flex items-center gap-3">
                    <span class="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold"
                          style="background:${cfg.hex}22; color:${cfg.hex}; border:2px solid ${cfg.hex}55;">
                        ${cfg.icon} ${cfg.label}
                    </span>
                    <span class="text-lg font-bold" style="color:${cfg.hex};">
                        ${profil.situation_securite_alimentaire?.nb_alertes_actives || 0} alerte(s)
                    </span>
                </div>
            </div>

            <!-- Démographie -->
            <div class="mt-5 grid grid-cols-3 gap-4 pt-5 border-t border-gray-100">
                <div class="text-center">
                    <p class="text-2xl font-bold text-blue-600">
                        ${formatPopulation(profil.demographie?.population || 0)}
                    </p>
                    <p class="text-xs text-gray-500 mt-1">Population</p>
                </div>
                <div class="text-center">
                    <p class="text-2xl font-bold text-blue-600">
                        ${profil.demographie?.nb_menages ? formatPopulation(profil.demographie.nb_menages) : '–'}
                    </p>
                    <p class="text-xs text-gray-500 mt-1">Ménages</p>
                </div>
                <div class="text-center">
                    <p class="text-2xl font-bold text-blue-600">
                        ${profil.situation_securite_alimentaire?.nb_marches || 0}
                    </p>
                    <p class="text-xs text-gray-500 mt-1">Marchés</p>
                </div>
            </div>
        `;
        wrap.appendChild(header);

        // ── Alertes actives ─────────────────────────────────────────────────
        const alertes = profil.situation_securite_alimentaire?.alertes_actives || [];
        if (alertes.length > 0) {
            const alertesSection = document.createElement('div');
            alertesSection.className = 'bg-white rounded-lg shadow p-6';
            alertesSection.innerHTML = `
                <h3 class="text-lg font-semibold text-gray-800 mb-4">⚠️ Alertes actives (${alertes.length})</h3>
            `;

            const table = document.createElement('table');
            table.className = 'min-w-full text-sm divide-y divide-gray-200';
            table.innerHTML = `
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-4 py-2 text-left   text-xs font-medium text-gray-500 uppercase">Produit</th>
                        <th class="px-4 py-2 text-left   text-xs font-medium text-gray-500 uppercase">Marché</th>
                        <th class="px-4 py-2 text-right  text-xs font-medium text-gray-500 uppercase">Prix réf.</th>
                        <th class="px-4 py-2 text-right  text-xs font-medium text-gray-500 uppercase">Prix actuel</th>
                        <th class="px-4 py-2 text-right  text-xs font-medium text-gray-500 uppercase">Variation</th>
                        <th class="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Niveau</th>
                    </tr>
                </thead>
            `;

            const tbody = document.createElement('tbody');
            tbody.className = 'divide-y divide-gray-100';
            alertes.forEach(a => {
                const aCfg = COULEURS[a.niveau] || COULEURS.surveillance;
                const tr   = document.createElement('tr');
                tr.className = 'hover:bg-gray-50';
                tr.innerHTML = `
                    <td class="px-4 py-2 font-medium text-gray-900">${sanitize(a.produit)}</td>
                    <td class="px-4 py-2 text-gray-600">${sanitize(a.marche)}</td>
                    <td class="px-4 py-2 text-right text-gray-500">${a.prix_reference} HTG</td>
                    <td class="px-4 py-2 text-right font-semibold">${a.prix_actuel} HTG</td>
                    <td class="px-4 py-2 text-right font-bold text-red-600">+${a.variation}%</td>
                    <td class="px-4 py-2 text-center">
                        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                              style="background:${aCfg.hex}22; color:${aCfg.hex}; border:1px solid ${aCfg.hex}55;">
                            ${aCfg.icon} ${aCfg.label}
                        </span>
                    </td>
                `;
                tbody.appendChild(tr);
            });

            table.appendChild(tbody);
            alertesSection.appendChild(table);
            wrap.appendChild(alertesSection);
        } else {
            const ok = document.createElement('div');
            ok.className = 'bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3';
            ok.innerHTML = `
                <span class="text-2xl">✅</span>
                <p class="text-green-700 font-medium">Aucune alerte active dans cette commune.</p>
            `;
            wrap.appendChild(ok);
        }

        // ── Carte des marchés ───────────────────────────────────────────────
        if (profil.marches?.length > 0) {
            const mapSection = document.createElement('div');
            mapSection.className = 'bg-white rounded-lg shadow p-6';
            mapSection.innerHTML = `
                <h3 class="text-lg font-semibold text-gray-800 mb-4">🗺️ Marchés de la commune</h3>
            `;
            const mapDiv = document.createElement('div');
            mapDiv.id = 'drilldown-commune-map';
            mapDiv.style.height = '280px';
            mapDiv.className = 'rounded-lg z-0';
            mapSection.appendChild(mapDiv);
            wrap.appendChild(mapSection);
            setTimeout(() => initCommuneMap(profil.marches, alertes), 150);
        }

        // ── Historique des alertes ──────────────────────────────────────────
        const historique = profil.historique_alertes || [];
        if (historique.length > 0) {
            const histSection = document.createElement('div');
            histSection.className = 'bg-white rounded-lg shadow p-6';
            histSection.innerHTML = `
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-lg font-semibold text-gray-800">📅 Historique des alertes (30 jours)</h3>
                    <span class="text-sm text-gray-400">${historique.length} événement(s)</span>
                </div>
            `;

            const tl = document.createElement('div');
            tl.className = 'relative border-l-2 border-gray-200 pl-6 space-y-4 max-h-72 overflow-y-auto';

            historique.forEach(h => {
                const hCfg = COULEURS[h.niveau] || COULEURS.normal;
                const item = document.createElement('div');
                item.className = 'relative';
                item.innerHTML = `
                    <div class="absolute -left-8 top-1 w-3 h-3 rounded-full border-2 border-white"
                         style="background:${hCfg.hex};"></div>
                    <div class="flex items-center justify-between gap-2">
                        <div>
                            <p class="text-sm font-medium text-gray-900">${sanitize(h.produit)}</p>
                            <p class="text-xs text-gray-500">
                                ${new Date(h.date).toLocaleDateString('fr-FR')} ·
                                <span style="color:${hCfg.hex}; font-weight:600;">${hCfg.label}</span> ·
                                +${h.variation}%
                            </p>
                        </div>
                        <span class="text-xs px-2 py-0.5 rounded-full shrink-0 ${
                            h.statut === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                        }">
                            ${h.statut === 'active' ? 'Active' : 'Résolue'}
                        </span>
                    </div>
                `;
                tl.appendChild(item);
            });

            histSection.appendChild(tl);
            wrap.appendChild(histSection);
        }

        // ── Interventions actives (collectes récentes) ──────────────────────
        const interventions = profil.interventions_actives || [];
        if (interventions.length > 0) {
            const intSection = document.createElement('div');
            intSection.className = 'bg-white rounded-lg shadow p-6';
            intSection.innerHTML = `
                <h3 class="text-lg font-semibold text-gray-800 mb-4">
                    🔬 Activités récentes (7 jours) –
                    <span class="text-blue-600">${interventions.length} collecte(s)</span>
                </h3>
            `;

            const list = document.createElement('div');
            list.className = 'space-y-2 max-h-60 overflow-y-auto';

            interventions.slice(0, 15).forEach(intv => {
                const item = document.createElement('div');
                item.className = 'flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 text-sm';
                item.innerHTML = `
                    <span class="text-lg shrink-0">📋</span>
                    <div class="flex-1 min-w-0">
                        <p class="font-medium text-gray-900 truncate">${sanitize(intv.produit)} – ${sanitize(intv.marche)}</p>
                        <p class="text-xs text-gray-400">
                            ${new Date(intv.date).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}
                        </p>
                    </div>
                    <span class="text-xs px-2 py-0.5 rounded-full shrink-0 ${
                        intv.statut === 'validee'  ? 'bg-green-100 text-green-700' :
                        intv.statut === 'rejetee'  ? 'bg-red-100 text-red-700'    :
                                                     'bg-blue-100 text-blue-700'
                    }">
                        ${intv.statut === 'validee' ? '✓ Validée' : intv.statut === 'rejetee' ? '✗ Rejetée' : '⏳ Soumise'}
                    </span>
                `;
                list.appendChild(item);
            });

            intSection.appendChild(list);
            wrap.appendChild(intSection);
        }

        // ── Notes ───────────────────────────────────────────────────────────
        if (profil.notes) {
            const notesSection = document.createElement('div');
            notesSection.className = 'bg-yellow-50 border border-yellow-200 rounded-lg p-4';
            notesSection.innerHTML = `
                <h4 class="font-semibold text-yellow-800 mb-1">📝 Notes et observations</h4>
                <p class="text-sm text-yellow-700">${sanitize(profil.notes)}</p>
            `;
            wrap.appendChild(notesSection);
        }

        // ── Actions globales ────────────────────────────────────────────────
        const actionsSection = document.createElement('div');
        actionsSection.className = 'bg-white rounded-lg shadow p-6';
        actionsSection.innerHTML = `<h3 class="text-lg font-semibold text-gray-800 mb-4">⚡ Actions</h3>`;

        const actionsGrid = document.createElement('div');
        actionsGrid.className = 'grid grid-cols-1 md:grid-cols-4 gap-3';

        const actionsDef = [
            {
                icon: '📥',
                label: 'Exporter Excel',
                color: 'blue',
                onClick: () => {
                    const sheets = buildProfilCommuneSheets(profil);
                    const commune = profil.localisation?.commune || 'commune';
                    const ok = exportToExcel(sheets, `profil_${commune}`);
                    if (ok) showToast({ message: 'Export Excel téléchargé', type: 'success' });
                }
            },
            {
                icon: '📤',
                label: 'Partager',
                color: 'green',
                onClick: () => showShareModal()
            },
            {
                icon: '⚙️',
                label: 'Configurer',
                color: 'purple',
                onClick: () => showConfigModal(prefs => {
                    showToast({ message: 'Préférences sauvegardées', type: 'success' });
                })
            },
            {
                icon: '←',
                label: 'Retour département',
                color: 'gray',
                onClick: remonter
            }
        ];

        actionsDef.forEach(({ icon, label, color, onClick }) => {
            const btn = document.createElement('button');
            btn.className = `flex items-center gap-2 px-4 py-3 border border-${color}-200 rounded-lg hover:border-${color}-400 hover:bg-${color}-50 transition-colors text-sm font-medium text-gray-700 hover:text-${color}-700`;
            btn.innerHTML = `<span>${icon}</span><span>${label}</span>`;
            btn.onclick = onClick;
            actionsGrid.appendChild(btn);
        });

        actionsSection.appendChild(actionsGrid);
        wrap.appendChild(actionsSection);

        return wrap;
    }

    // ── Carte Leaflet pour commune ──────────────────────────────────────────
    function initCommuneMap(marches, alertes) {
        if (typeof L === 'undefined') return;
        if (map) { map.remove(); map = null; }

        const marcheAvecGPS = marches.filter(m => m.latitude && m.longitude);

        if (!marcheAvecGPS.length) {
            const mapDiv = document.getElementById('drilldown-commune-map');
            if (mapDiv) {
                mapDiv.innerHTML = `
                    <div class="flex items-center justify-center h-full bg-gray-100 rounded-lg text-gray-400 text-sm">
                        📍 Coordonnées GPS non disponibles pour les marchés de cette commune.
                    </div>`;
            }
            return;
        }

        map = L.map('drilldown-commune-map').setView(
            [marcheAvecGPS[0].latitude, marcheAvecGPS[0].longitude],
            11
        );

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 15
        }).addTo(map);

        // Index alertes par nom de marché
        const alertesParMarche = {};
        alertes.forEach(a => {
            alertesParMarche[a.marche] = alertesParMarche[a.marche] || [];
            alertesParMarche[a.marche].push(a);
        });

        const ORD = ['normal', 'surveillance', 'alerte', 'urgence'];

        marcheAvecGPS.forEach(m => {
            const marcheAlertes = alertesParMarche[m.nom] || [];
            const niveauMax = marcheAlertes.length
                ? marcheAlertes.reduce((best, a) =>
                    ORD.indexOf(a.niveau) > ORD.indexOf(best) ? a.niveau : best, 'normal')
                : 'normal';

            const cfg = COULEURS[niveauMax] || COULEURS.normal;

            const marker = L.circleMarker([m.latitude, m.longitude], {
                radius: 10, fillColor: cfg.hex, color: '#fff',
                weight: 2, opacity: 1, fillOpacity: 0.85
            }).addTo(map);

            marker.bindPopup(`
                <div style="min-width:160px; font-family:sans-serif;">
                    <strong style="font-size:13px;">${m.nom}</strong>
                    <div style="margin-top:4px;">
                        <span style="background:${cfg.hex};color:#fff;padding:2px 6px;border-radius:10px;font-size:11px;">
                            ${cfg.icon} ${cfg.label}
                        </span>
                    </div>
                    ${marcheAlertes.length ? `
                    <div style="margin-top:6px; font-size:11px; color:#374151;">
                        ${marcheAlertes.map(a => `• ${a.produit} (+${a.variation}%)`).join('<br>')}
                    </div>` : '<p style="font-size:11px;color:#6b7280;margin-top:4px;">✅ Situation normale</p>'}
                </div>
            `);
        });

        if (marcheAvecGPS.length > 1) {
            map.fitBounds(
                L.latLngBounds(marcheAvecGPS.map(m => [m.latitude, m.longitude])),
                { padding: [20, 20] }
            );
        }
    }

    // ── Rendu principal ─────────────────────────────────────────────────────
    function render() {
        // Nettoyage carte Leaflet si page changée
        if (map && !document.getElementById('drilldown-commune-map')) {
            map.remove();
            map = null;
        }

        container.innerHTML = '';
        container.appendChild(renderHeader());

        if (isLoading) {
            const loader = document.createElement('div');
            loader.className = 'flex justify-center items-center py-16';
            loader.appendChild(Spinner({ size: 'lg' }));
            const txt = document.createElement('p');
            txt.className = 'ml-4 text-gray-600';
            txt.textContent = 'Chargement des données géographiques…';
            loader.appendChild(txt);
            container.appendChild(loader);
            return;
        }

        if (!data) {
            const err = document.createElement('div');
            err.className = 'bg-red-50 border border-red-200 rounded-lg p-6 text-center';
            err.innerHTML = `<div class="text-4xl mb-3">⚠️</div><p class="text-red-600 mb-4">Impossible de charger les données.</p>`;
            err.appendChild(Button({ text: '🔄 Réessayer', variant: 'danger', onClick: loadData }));
            container.appendChild(err);
            return;
        }

        // Section communale (placeholder)
        if (currentNiveau === 'section') {
            container.innerHTML += `
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
                    <div class="text-4xl mb-3">🚧</div>
                    <h3 class="text-lg font-semibold text-blue-800 mb-2">Sections communales – À venir</h3>
                    <p class="text-blue-600">Les sections communales seront disponibles dans une prochaine version du système.</p>
                </div>`;
            return;
        }

        if (currentNiveau === 'national' || currentNiveau === 'departement') {
            container.appendChild(renderZonesList());
        }

        if (currentNiveau === 'commune') {
            container.appendChild(renderProfilCommune());
        }
    }

    // Init
    loadData();
    render();

    return container;
}
