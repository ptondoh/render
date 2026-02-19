/**
 * Module 6.2 – Indicateurs détaillés pour décideurs
 * 4 types : Top 10 zones | Évolution prix | Situation pluviométrique | Historique alertes
 * Accès réservé aux rôles décideur et bailleur.
 *
 * Fonctionnalités :
 * - Export Excel multi-feuilles (SheetJS)
 * - Partage par lien / courriel
 * - Configuration persistée (localStorage)
 * - Préférences de période et de type d'indicateur
 */

import auth from '../modules/auth.js';
import api  from '../modules/api.js';
import { Button, Spinner, showToast } from '../modules/ui.js';
import {
    loadPreferences, savePreferences,
    exportToExcel,
    buildTop10Sheets, buildPrixSheets, buildPluviometrieSheets, buildHistoriqueSheets,
    showShareModal, showConfigModal
} from '../modules/dashboard-utils.js';

export default function IndicateursDetaillesPage() {
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

    // ── Lire le type et la période depuis l'URL ou les préférences ─────────
    function getTypeFromURL() {
        const hash = window.location.hash;
        const qs   = hash.includes('?') ? hash.split('?')[1] : '';
        const params = new URLSearchParams(qs);
        return params.get('type') || loadPreferences().filtresDefaut.type || 'top10';
    }

    function getPeriodeFromURL() {
        const hash = window.location.hash;
        const qs   = hash.includes('?') ? hash.split('?')[1] : '';
        const params = new URLSearchParams(qs);
        return params.get('periode') || loadPreferences().filtresDefaut.periode || 'mois';
    }

    // ── État ────────────────────────────────────────────────────────────────
    let isLoading      = false;
    let data           = null;
    let activeType     = getTypeFromURL();
    let selectedPeriode = getPeriodeFromURL();

    // Couleurs par niveau
    const COULEURS = {
        normal:       { hex: '#22c55e', label: 'Normal',       icon: '🟢' },
        surveillance: { hex: '#eab308', label: 'Surveillance', icon: '🟡' },
        alerte:       { hex: '#f97316', label: 'Alerte',       icon: '🟠' },
        urgence:      { hex: '#ef4444', label: 'Urgence',      icon: '🔴' }
    };

    function sanitize(str) {
        if (!str) return '';
        return String(str).replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // ── Chargement ──────────────────────────────────────────────────────────
    async function loadData() {
        try {
            isLoading = true;
            data      = null;
            render();
            data = await api.get(
                `/api/dashboard/indicateurs?type_indicateur=${activeType}&periode=${selectedPeriode}`
            );
        } catch (err) {
            showToast({ message: 'Erreur lors du chargement des indicateurs', type: 'error' });
            console.error(err);
            data = null;
        } finally {
            isLoading = false;
            render();
        }
    }

    // ── Export Excel ────────────────────────────────────────────────────────
    function exporterExcel() {
        if (!data) {
            showToast({ message: 'Aucune donnée à exporter', type: 'error' });
            return;
        }

        const builders = {
            top10:        buildTop10Sheets,
            prix:         buildPrixSheets,
            pluviometrie: buildPluviometrieSheets,
            historique:   buildHistoriqueSheets
        };

        const buildFn = builders[activeType];
        if (!buildFn) return;

        const sheets   = buildFn(data);
        const filename = `indicateurs_${activeType}_${selectedPeriode}`;
        const ok = exportToExcel(sheets, filename);
        if (ok) showToast({ message: 'Export Excel téléchargé', type: 'success' });
    }

    // ── Header ──────────────────────────────────────────────────────────────
    function renderHeader() {
        const wrap = document.createElement('div');
        wrap.className = 'space-y-3';

        // Fil d'Ariane
        const breadcrumb = document.createElement('div');
        breadcrumb.className = 'flex items-center gap-2 text-sm text-gray-500';
        breadcrumb.innerHTML = `
            <a href="#/dashboard"              class="hover:text-blue-600">Tableau de bord</a>
            <span>›</span>
            <a href="#/tableau-bord-national"  class="hover:text-blue-600">Vue nationale</a>
            <span>›</span>
            <span class="text-gray-800 font-medium">Indicateurs détaillés</span>
        `;

        const titleRow = document.createElement('div');
        titleRow.className = 'flex flex-wrap gap-4 items-start justify-between';

        const titleDiv = document.createElement('div');
        titleDiv.innerHTML = `
            <h1 class="text-3xl font-bold text-gray-900">📊 Indicateurs détaillés</h1>
            <p class="text-gray-600 mt-1">Analyses approfondies de la situation de sécurité alimentaire</p>
        `;

        const actions = document.createElement('div');
        actions.className = 'flex items-center gap-2 flex-wrap';

        // Bouton Export Excel
        const exportBtn = Button({
            text: '📥 Exporter Excel',
            variant: 'secondary',
            size: 'sm',
            onClick: exporterExcel
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
            onClick: () => showConfigModal(prefs => {
                // Appliquer les nouvelles préférences
                selectedPeriode = prefs.filtresDefaut.periode;
                activeType      = prefs.filtresDefaut.type;
                showToast({ message: 'Préférences sauvegardées', type: 'success' });
                loadData();
            })
        });

        actions.appendChild(exportBtn);
        actions.appendChild(shareBtn);
        actions.appendChild(configBtn);

        titleRow.appendChild(titleDiv);
        titleRow.appendChild(actions);

        wrap.appendChild(breadcrumb);
        wrap.appendChild(titleRow);
        return wrap;
    }

    // ── Onglets ─────────────────────────────────────────────────────────────
    function renderTabs() {
        const tabs = [
            { key: 'top10',        icon: '🏆', label: 'Top 10 zones à risque' },
            { key: 'prix',         icon: '📈', label: 'Évolution des prix'    },
            { key: 'pluviometrie', icon: '🌧️', label: 'Situation pluviométrique' },
            { key: 'historique',   icon: '📅', label: 'Historique des alertes'   }
        ];

        const nav = document.createElement('div');
        nav.className = 'flex flex-wrap gap-2 border-b border-gray-200';

        tabs.forEach(tab => {
            const isActive = activeType === tab.key;
            const btn = document.createElement('button');
            btn.className = `flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                isActive
                    ? 'border-blue-600 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
            }`;
            btn.innerHTML = `${tab.icon} ${tab.label}`;
            btn.onclick = () => {
                activeType = tab.key;
                loadData();
            };
            nav.appendChild(btn);
        });

        return nav;
    }

    // ── Sélecteur de période ────────────────────────────────────────────────
    function renderPeriodeSelector() {
        const periodes = [
            { key: 'semaine',   label: '7 jours'  },
            { key: 'mois',      label: '30 jours' },
            { key: 'trimestre', label: '3 mois'   },
            { key: 'annee',     label: '12 mois'  }
        ];

        const wrap = document.createElement('div');
        wrap.className = 'flex items-center gap-2 text-sm';

        const lbl = document.createElement('span');
        lbl.className = 'text-gray-500 font-medium';
        lbl.textContent = 'Période :';
        wrap.appendChild(lbl);

        periodes.forEach(p => {
            const btn = document.createElement('button');
            btn.className = `px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                selectedPeriode === p.key
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`;
            btn.textContent = p.label;
            btn.onclick = () => { selectedPeriode = p.key; loadData(); };
            wrap.appendChild(btn);
        });

        return wrap;
    }

    // ── TOP 10 ZONES À RISQUE ───────────────────────────────────────────────
    function renderTop10() {
        const top10    = data?.top10_zones || [];
        const timeline = data?.timeline    || [];

        const wrap = document.createElement('div');
        wrap.className = 'space-y-6';

        if (!top10.length) {
            wrap.innerHTML = `
                <div class="bg-white rounded-lg shadow p-12 text-center text-gray-500">
                    <div class="text-4xl mb-3">✅</div>
                    <p class="font-medium">Aucune zone à risque détectée.</p>
                </div>`;
            return wrap;
        }

        // Tableau classement
        const tableSection = document.createElement('div');
        tableSection.className = 'bg-white rounded-lg shadow overflow-hidden';

        const tableHeader = document.createElement('div');
        tableHeader.className = 'px-6 py-4 border-b border-gray-200 flex items-center justify-between';
        tableHeader.innerHTML = `
            <h3 class="text-lg font-semibold text-gray-800">🏆 Top 10 zones les plus à risque</h3>
            <span class="text-sm text-gray-400">${top10.length} zone(s)</span>
        `;
        tableSection.appendChild(tableHeader);

        const tableWrap = document.createElement('div');
        tableWrap.className = 'overflow-x-auto';

        const table = document.createElement('table');
        table.className = 'min-w-full divide-y divide-gray-200 text-sm';
        table.innerHTML = `
            <thead class="bg-gray-50">
                <tr>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-12">Rang</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Zone / Marché</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Département</th>
                    <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Score max</th>
                    <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Niveau</th>
                    <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Alertes</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produits affectés</th>
                    <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Action</th>
                </tr>
            </thead>
        `;

        const tbody = document.createElement('tbody');
        tbody.className = 'bg-white divide-y divide-gray-200';

        top10.forEach(zone => {
            const cfg = COULEURS[zone.niveau_max] || COULEURS.surveillance;
            const tr  = document.createElement('tr');
            tr.className = 'hover:bg-gray-50 transition-colors cursor-pointer';

            const produits = (zone.alertes || [])
                .slice(0, 3)
                .map(a => `${sanitize(a.produit)} (+${a.variation}%)`)
                .join(', ');

            tr.innerHTML = `
                <td class="px-4 py-3">
                    <span class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                          style="background:${cfg.hex};">${zone.rang}</span>
                </td>
                <td class="px-4 py-3">
                    <div class="font-medium text-gray-900">${sanitize(zone.marche_nom)}</div>
                    <div class="text-xs text-gray-400">${sanitize(zone.commune)}</div>
                </td>
                <td class="px-4 py-3 text-gray-600">${sanitize(zone.departement)}</td>
                <td class="px-4 py-3 text-right font-bold text-red-600">+${zone.score_max}%</td>
                <td class="px-4 py-3 text-center">
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                          style="background:${cfg.hex}22; color:${cfg.hex}; border:1px solid ${cfg.hex}55;">
                        ${cfg.icon} ${cfg.label}
                    </span>
                </td>
                <td class="px-4 py-3 text-right text-gray-700">${zone.nb_alertes}</td>
                <td class="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">${produits || '–'}</td>
                <td class="px-4 py-3 text-center">
                    <a href="#/drilldown-geo?niveau=commune&zone_id=${zone.marche_id}"
                       class="text-blue-600 hover:text-blue-800 text-xs font-medium">
                       🔍 Détails →
                    </a>
                </td>
            `;
            tbody.appendChild(tr);
        });

        table.appendChild(tbody);
        tableWrap.appendChild(table);
        tableSection.appendChild(tableWrap);
        wrap.appendChild(tableSection);

        // Timeline historique
        if (timeline.length > 0) {
            const timelineSection = document.createElement('div');
            timelineSection.className = 'bg-white rounded-lg shadow p-6';
            timelineSection.innerHTML = `
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-lg font-semibold text-gray-800">📅 Timeline des alertes (30 derniers jours)</h3>
                    <span class="text-sm text-gray-400">${timeline.length} événement(s)</span>
                </div>
            `;

            const tlContainer = document.createElement('div');
            tlContainer.className = 'relative border-l-2 border-gray-200 pl-6 space-y-4 max-h-80 overflow-y-auto';

            timeline.slice(0, 30).forEach(event => {
                const cfg  = COULEURS[event.niveau] || COULEURS.normal;
                const item = document.createElement('div');
                item.className = 'relative';
                item.innerHTML = `
                    <div class="absolute -left-8 w-4 h-4 rounded-full border-2 border-white"
                         style="background:${cfg.hex};"></div>
                    <div class="flex items-start gap-3">
                        <div class="flex-1 min-w-0">
                            <p class="text-sm font-medium text-gray-900">
                                ${sanitize(event.produit)} – ${sanitize(event.marche)}
                            </p>
                            <p class="text-xs text-gray-500">
                                ${new Date(event.date).toLocaleDateString('fr-FR')} ·
                                <span style="color:${cfg.hex}; font-weight:600;">${cfg.icon} ${cfg.label}</span> ·
                                +${event.variation}%
                            </p>
                        </div>
                        <span class="text-xs px-2 py-0.5 rounded-full shrink-0 ${
                            event.statut === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                        }">
                            ${event.statut === 'active' ? '● Active' : '✓ Résolue'}
                        </span>
                    </div>
                `;
                tlContainer.appendChild(item);
            });

            timelineSection.appendChild(tlContainer);
            wrap.appendChild(timelineSection);
        }

        return wrap;
    }

    // ── ÉVOLUTION DES PRIX ──────────────────────────────────────────────────
    function renderPrix() {
        const series          = data?.series                || [];
        const produitsDispos  = data?.produits_disponibles  || [];
        const marchesDispos   = data?.marches_disponibles   || [];

        const wrap = document.createElement('div');
        wrap.className = 'space-y-6';

        // Barre d'info période
        const info = document.createElement('div');
        info.className = 'bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700';
        info.innerHTML = `
            ℹ️ Période : <strong>${selectedPeriode}</strong>
            ${data?.date_debut ? ` · Du ${new Date(data.date_debut).toLocaleDateString('fr-FR')}` : ''}
            ${data?.date_fin   ? ` au ${new Date(data.date_fin).toLocaleDateString('fr-FR')}` : ''}
            · <strong>${series.length}</strong> série(s)
        `;
        wrap.appendChild(info);

        if (!series.length) {
            const empty = document.createElement('div');
            empty.className = 'bg-white rounded-lg shadow p-12 text-center text-gray-500';
            empty.innerHTML = `
                <div class="text-4xl mb-3">📊</div>
                <p class="font-medium">Aucune donnée de prix disponible pour cette période.</p>
                <p class="text-sm mt-2 text-gray-400">Assurez-vous que des collectes ont été validées sur la période sélectionnée.</p>
            `;
            wrap.appendChild(empty);
            return wrap;
        }

        series.forEach(serie => {
            const section = document.createElement('div');
            section.className = 'bg-white rounded-lg shadow p-6';
            section.innerHTML = `
                <h3 class="text-base font-semibold text-gray-800 mb-1">
                    📦 ${sanitize(serie.produit)} – 🏪 ${sanitize(serie.marche)}
                </h3>
                <p class="text-xs text-gray-400 mb-4">${serie.donnees.length} point(s) de données</p>
            `;

            if (!serie.donnees.length) {
                section.innerHTML += `<p class="text-sm text-gray-400">Aucune donnée.</p>`;
                wrap.appendChild(section);
                return;
            }

            section.appendChild(renderMiniChart(serie.donnees));

            // Tableau de données (10 derniers)
            const tableWrap = document.createElement('div');
            tableWrap.className = 'mt-4 overflow-x-auto';

            const table = document.createElement('table');
            table.className = 'min-w-full text-xs divide-y divide-gray-200';
            table.innerHTML = `
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-3 py-2 text-left text-gray-500">Date</th>
                        <th class="px-3 py-2 text-right text-gray-500">Prix min</th>
                        <th class="px-3 py-2 text-right text-gray-500">Prix moyen</th>
                        <th class="px-3 py-2 text-right text-gray-500">Prix max</th>
                        <th class="px-3 py-2 text-right text-gray-500">Collectes</th>
                    </tr>
                </thead>
            `;
            const tbody = document.createElement('tbody');
            tbody.className = 'divide-y divide-gray-100';

            serie.donnees.slice(-10).forEach(d => {
                const tr = document.createElement('tr');
                tr.className = 'hover:bg-gray-50';
                tr.innerHTML = `
                    <td class="px-3 py-1.5 text-gray-700">${d.date}</td>
                    <td class="px-3 py-1.5 text-right text-blue-600">${d.prix_min} HTG</td>
                    <td class="px-3 py-1.5 text-right font-semibold text-gray-900">${d.prix_moyen} HTG</td>
                    <td class="px-3 py-1.5 text-right text-red-600">${d.prix_max} HTG</td>
                    <td class="px-3 py-1.5 text-right text-gray-500">${d.nb_collectes}</td>
                `;
                tbody.appendChild(tr);
            });

            table.appendChild(tbody);
            tableWrap.appendChild(table);
            section.appendChild(tableWrap);
            wrap.appendChild(section);
        });

        return wrap;
    }

    function renderMiniChart(donnees) {
        const W = 600, H = 120;
        const pad = { top: 10, right: 20, bottom: 30, left: 50 };

        const prixValues = donnees.map(d => d.prix_moyen);
        const minPrix    = Math.min(...prixValues) * 0.95;
        const maxPrix    = Math.max(...prixValues) * 1.05;
        const n          = donnees.length;

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
        svg.setAttribute('width',  '100%');
        svg.setAttribute('height', `${H}px`);
        svg.style.overflow = 'visible';

        const toX = i => pad.left + (i / (n - 1)) * (W - pad.left - pad.right);
        const toY = v => H - pad.bottom - ((v - minPrix) / (maxPrix - minPrix || 1)) * (H - pad.top - pad.bottom);

        // Zone remplie
        const area = donnees.map((d, i) => `${toX(i)},${toY(d.prix_moyen)}`).join(' ');
        const areaPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        areaPath.setAttribute('d', `M${area} L${toX(n - 1)},${H - pad.bottom} L${toX(0)},${H - pad.bottom} Z`);
        areaPath.setAttribute('fill', '#3b82f622');
        svg.appendChild(areaPath);

        // Ligne
        const linePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        linePath.setAttribute('d', `M ${donnees.map((d, i) => `${toX(i)},${toY(d.prix_moyen)}`).join(' L ')}`);
        linePath.setAttribute('stroke', '#3b82f6');
        linePath.setAttribute('stroke-width', '2');
        linePath.setAttribute('fill', 'none');
        svg.appendChild(linePath);

        // Points
        donnees.forEach((d, i) => {
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', toX(i));
            circle.setAttribute('cy', toY(d.prix_moyen));
            circle.setAttribute('r',  '3');
            circle.setAttribute('fill', '#2563eb');
            svg.appendChild(circle);
        });

        // Étiquettes axe X (max 6)
        const step = Math.max(1, Math.floor(n / 6));
        donnees.forEach((d, i) => {
            if (i % step !== 0 && i !== n - 1) return;
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', toX(i));
            text.setAttribute('y', H - 5);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('font-size', '9');
            text.setAttribute('fill', '#6b7280');
            text.textContent = d.date.slice(5);
            svg.appendChild(text);
        });

        // Étiquettes Y
        [[Math.round(maxPrix), pad.top + 4], [Math.round(minPrix), H - pad.bottom]].forEach(([val, y]) => {
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', pad.left - 4);
            text.setAttribute('y', y);
            text.setAttribute('text-anchor', 'end');
            text.setAttribute('font-size', '9');
            text.setAttribute('fill', '#6b7280');
            text.textContent = val;
            svg.appendChild(text);
        });

        const div = document.createElement('div');
        div.className = 'rounded-lg border border-gray-100 bg-gray-50 p-2';
        div.appendChild(svg);
        return div;
    }

    // ── SITUATION PLUVIOMÉTRIQUE ────────────────────────────────────────────
    function renderPluviometrie() {
        const zones = data?.zones || [];

        const wrap = document.createElement('div');
        wrap.className = 'space-y-4';

        const note = document.createElement('div');
        note.className = 'bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-700';
        note.innerHTML = `
            ⚠️ <strong>Note :</strong> Les données pluviométriques réelles ne sont pas encore intégrées.
            Les indices affichés sont calculés comme proxy à partir de l'activité des marchés et des alertes.
        `;
        wrap.appendChild(note);

        if (!zones.length) {
            wrap.innerHTML += `<div class="bg-white rounded-lg shadow p-12 text-center text-gray-500"><p>Aucune donnée disponible.</p></div>`;
            return wrap;
        }

        const section = document.createElement('div');
        section.className = 'bg-white rounded-lg shadow overflow-hidden';
        section.innerHTML = `
            <div class="px-6 py-4 border-b border-gray-200">
                <h3 class="text-lg font-semibold text-gray-800">🌧️ Indices par département</h3>
                <p class="text-xs text-gray-400 mt-1">Classés par score de stress décroissant</p>
            </div>
        `;

        const tableWrap = document.createElement('div');
        tableWrap.className = 'overflow-x-auto';

        const table = document.createElement('table');
        table.className = 'min-w-full divide-y divide-gray-200 text-sm';
        table.innerHTML = `
            <thead class="bg-gray-50">
                <tr>
                    <th class="px-4 py-3 text-left   text-xs font-medium text-gray-500 uppercase">Département</th>
                    <th class="px-4 py-3 text-right  text-xs font-medium text-gray-500 uppercase">Score stress</th>
                    <th class="px-4 py-3 text-right  text-xs font-medium text-gray-500 uppercase">SPI (proxy)</th>
                    <th class="px-4 py-3 text-right  text-xs font-medium text-gray-500 uppercase">Jours sans activité</th>
                    <th class="px-4 py-3 text-right  text-xs font-medium text-gray-500 uppercase">Alertes actives</th>
                    <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Statut</th>
                </tr>
            </thead>
        `;

        const tbody = document.createElement('tbody');
        tbody.className = 'bg-white divide-y divide-gray-200';

        zones.forEach(zone => {
            const cfg      = COULEURS[zone.statut] || COULEURS.normal;
            const barColor = zone.score_stress >= 50 ? '#ef4444'
                           : zone.score_stress >= 30 ? '#f97316'
                           : zone.score_stress >= 15 ? '#eab308'
                           : '#22c55e';

            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50';
            tr.innerHTML = `
                <td class="px-4 py-3 font-medium text-gray-900">${sanitize(zone.departement)}</td>
                <td class="px-4 py-3 text-right">
                    <div class="flex items-center justify-end gap-2">
                        <div class="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div class="h-2 rounded-full" style="width:${zone.score_stress}%; background:${barColor};"></div>
                        </div>
                        <span class="font-bold text-sm" style="color:${barColor};">${zone.score_stress}%</span>
                    </div>
                </td>
                <td class="px-4 py-3 text-right font-mono text-gray-700">${zone.spi}</td>
                <td class="px-4 py-3 text-right text-gray-600">${zone.jours_sans_activite} j</td>
                <td class="px-4 py-3 text-right text-gray-700">${zone.nb_alertes}</td>
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
        tableWrap.appendChild(table);
        section.appendChild(tableWrap);
        wrap.appendChild(section);

        return wrap;
    }

    // ── HISTORIQUE DES ALERTES ─────────────────────────────────────────────
    function renderHistorique() {
        const events = data?.events       || [];
        const stats  = data?.statistiques || {};

        const wrap = document.createElement('div');
        wrap.className = 'space-y-6';

        // Cartes de statistiques
        if (stats.total) {
            const statsBar = document.createElement('div');
            statsBar.className = 'grid grid-cols-2 md:grid-cols-4 gap-4';

            const parNiveau = stats.par_niveau || {};
            [
                { label: 'Total alertes', value: stats.total,             color: 'blue'   },
                { label: 'Urgence',        value: parNiveau.urgence || 0,  color: 'red'    },
                { label: 'Alerte',         value: parNiveau.alerte  || 0,  color: 'orange' },
                { label: 'Surveillance',   value: parNiveau.surveillance || 0, color: 'yellow' }
            ].forEach(it => {
                const card = document.createElement('div');
                card.className = `bg-white rounded-lg shadow border-l-4 border-${it.color}-500 p-4`;
                card.innerHTML = `
                    <p class="text-xs text-gray-500 uppercase font-medium">${it.label}</p>
                    <p class="text-2xl font-bold text-${it.color}-600">${it.value}</p>
                `;
                statsBar.appendChild(card);
            });
            wrap.appendChild(statsBar);
        }

        if (!events.length) {
            const empty = document.createElement('div');
            empty.className = 'bg-white rounded-lg shadow p-12 text-center text-gray-500';
            empty.innerHTML = `<div class="text-4xl mb-3">📋</div><p>Aucun événement sur la période sélectionnée.</p>`;
            wrap.appendChild(empty);
            return wrap;
        }

        // Timeline
        const timelineSection = document.createElement('div');
        timelineSection.className = 'bg-white rounded-lg shadow p-6';
        timelineSection.innerHTML = `
            <div class="flex items-center justify-between mb-6">
                <h3 class="text-lg font-semibold text-gray-800">📅 Timeline des alertes</h3>
                <span class="text-sm text-gray-400">${events.length} événement(s)</span>
            </div>
        `;

        const tl = document.createElement('div');
        tl.className = 'relative border-l-2 border-gray-200 pl-6 space-y-6 max-h-[600px] overflow-y-auto';

        events.slice(0, 50).forEach(event => {
            const cfg  = COULEURS[event.niveau] || COULEURS.normal;
            const item = document.createElement('div');
            item.className = 'relative group';
            item.innerHTML = `
                <div class="absolute -left-8 top-1 w-4 h-4 rounded-full border-2 border-white transition-transform group-hover:scale-125"
                     style="background:${cfg.hex};"></div>
                <div class="bg-gray-50 rounded-lg p-4 border border-gray-100 hover:border-gray-300 transition-colors">
                    <div class="flex flex-wrap items-start justify-between gap-2">
                        <div class="flex-1 min-w-0">
                            <p class="font-semibold text-gray-900">
                                ${sanitize(event.produit)}
                                <span class="text-gray-400 font-normal"> – </span>
                                ${sanitize(event.marche)}
                            </p>
                            <p class="text-xs text-gray-500 mt-0.5">
                                ${event.commune    ? sanitize(event.commune) + ' · ' : ''}
                                ${event.departement ? sanitize(event.departement)    : ''}
                            </p>
                        </div>
                        <div class="flex items-center gap-2 shrink-0">
                            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                                  style="background:${cfg.hex}22; color:${cfg.hex}; border:1px solid ${cfg.hex}55;">
                                ${cfg.icon} ${cfg.label}
                            </span>
                            <span class="text-xs px-2 py-0.5 rounded-full ${
                                event.statut === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                            }">
                                ${event.statut === 'active' ? '● Active' : '✓ Résolue'}
                            </span>
                        </div>
                    </div>
                    <div class="mt-2 flex flex-wrap gap-4 text-xs text-gray-600">
                        <span>📅 ${new Date(event.date).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        <span class="font-semibold text-red-600">+${event.variation}%</span>
                        <span>${event.prix_actuel} HTG</span>
                        <span class="text-gray-400">(réf. ${event.prix_reference} HTG)</span>
                        ${event.resolved_at ? `<span class="text-green-600">Résolu le ${new Date(event.resolved_at).toLocaleDateString('fr-FR')}</span>` : ''}
                    </div>
                </div>
            `;
            tl.appendChild(item);
        });

        timelineSection.appendChild(tl);

        if (events.length > 50) {
            const more = document.createElement('p');
            more.className = 'text-center text-sm text-gray-400 mt-4';
            more.textContent = `… et ${events.length - 50} événements supplémentaires. Réduisez la période pour affiner.`;
            timelineSection.appendChild(more);
        }

        wrap.appendChild(timelineSection);
        return wrap;
    }

    // ── Actions globales (barre en bas de page) ─────────────────────────────
    function renderActionsGlobales() {
        const section = document.createElement('div');
        section.className = 'bg-white rounded-lg shadow p-6';
        section.innerHTML = `<h3 class="text-lg font-semibold text-gray-800 mb-4">⚡ Actions globales</h3>`;

        const grid = document.createElement('div');
        grid.className = 'grid grid-cols-1 md:grid-cols-3 gap-4';

        const actions = [
            {
                icon: '📥',
                titre: 'Exporter le tableau de bord',
                desc: 'Télécharger en format Excel (.xlsx) avec toutes les données et visualisations.',
                color: 'blue',
                onClick: exporterExcel
            },
            {
                icon: '📤',
                titre: 'Partager',
                desc: 'Envoyer le lien par courriel ou copier l\'URL directe.',
                color: 'green',
                onClick: () => showShareModal()
            },
            {
                icon: '⚙️',
                titre: 'Configurer',
                desc: 'Paramétrer l\'auto-refresh, les widgets affichés et les filtres par défaut.',
                color: 'purple',
                onClick: () => showConfigModal(prefs => {
                    selectedPeriode = prefs.filtresDefaut.periode;
                    activeType      = prefs.filtresDefaut.type;
                    showToast({ message: 'Préférences sauvegardées et appliquées', type: 'success' });
                    loadData();
                })
            }
        ];

        actions.forEach(action => {
            const card = document.createElement('button');
            card.className = `text-left p-4 border border-${action.color}-200 rounded-lg hover:border-${action.color}-400 hover:bg-${action.color}-50 transition-colors group`;
            card.innerHTML = `
                <div class="flex items-start gap-3">
                    <span class="text-2xl">${action.icon}</span>
                    <div>
                        <div class="font-semibold text-gray-900 group-hover:text-${action.color}-700">${action.titre}</div>
                        <div class="text-sm text-gray-500 mt-1">${action.desc}</div>
                    </div>
                </div>
            `;
            card.onclick = action.onClick;
            grid.appendChild(card);
        });

        section.appendChild(grid);
        return section;
    }

    // ── Contenu selon le type actif ─────────────────────────────────────────
    function renderContenu() {
        if (isLoading) {
            const loader = document.createElement('div');
            loader.className = 'flex justify-center items-center py-16';
            loader.appendChild(Spinner({ size: 'lg' }));
            const txt = document.createElement('p');
            txt.className = 'ml-4 text-gray-600';
            txt.textContent = 'Chargement des indicateurs…';
            loader.appendChild(txt);
            return loader;
        }

        if (!data) {
            const err = document.createElement('div');
            err.className = 'bg-red-50 border border-red-200 rounded-lg p-6 text-center';
            err.innerHTML = `
                <div class="text-4xl mb-3">⚠️</div>
                <p class="text-red-600 mb-4">Impossible de charger les indicateurs.</p>
            `;
            err.appendChild(Button({ text: '🔄 Réessayer', variant: 'danger', onClick: loadData }));
            return err;
        }

        switch (activeType) {
            case 'top10':        return renderTop10();
            case 'prix':         return renderPrix();
            case 'pluviometrie': return renderPluviometrie();
            case 'historique':   return renderHistorique();
            default:             return document.createElement('div');
        }
    }

    // ── Rendu principal ─────────────────────────────────────────────────────
    function render() {
        container.innerHTML = '';
        container.appendChild(renderHeader());
        container.appendChild(renderTabs());

        if (['prix', 'historique', 'top10'].includes(activeType)) {
            const periodeRow = document.createElement('div');
            periodeRow.className = 'flex justify-end';
            periodeRow.appendChild(renderPeriodeSelector());
            container.appendChild(periodeRow);
        }

        container.appendChild(renderContenu());

        // Actions globales affichées seulement quand les données sont chargées
        if (!isLoading && data) {
            container.appendChild(renderActionsGlobales());
        }
    }

    // Init
    loadData();
    render();

    return container;
}
