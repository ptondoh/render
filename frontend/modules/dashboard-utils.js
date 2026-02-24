/**
 * Utilitaires partagés – Module 6 : Tableau de bord pour décideurs
 * Export Excel, Partage par lien/courriel, Configuration des préférences.
 *
 * Dépendances globales : SheetJS (window.XLSX) chargé dans index.html
 */

// ─────────────────────────────────────────────────────────────────────────────
// Préférences utilisateur (localStorage)
// ─────────────────────────────────────────────────────────────────────────────

const PREFS_KEY = 'sap_dashboard_prefs_v1';

const DEFAULT_PREFS = {
    autoRefresh: false,
    refreshIntervalMin: 5,
    widgets: {
        carte: true,
        kpis: true,
        prixCles: true,
        liensRapides: true
    },
    filtresDefaut: {
        type: 'top10',
        periode: 'mois'
    }
};

/** Charge les préférences depuis localStorage (merge avec les defaults). */
export function loadPreferences() {
    try {
        const raw = localStorage.getItem(PREFS_KEY);
        if (!raw) return structuredClone(DEFAULT_PREFS);
        const saved = JSON.parse(raw);
        return {
            ...DEFAULT_PREFS,
            ...saved,
            widgets: { ...DEFAULT_PREFS.widgets, ...(saved.widgets || {}) },
            filtresDefaut: { ...DEFAULT_PREFS.filtresDefaut, ...(saved.filtresDefaut || {}) }
        };
    } catch {
        return structuredClone(DEFAULT_PREFS);
    }
}

/** Sauvegarde les préférences dans localStorage. */
export function savePreferences(prefs) {
    try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch (e) {
        console.error('[dashboard-utils] Erreur sauvegarde préférences:', e);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Export Excel (SheetJS / XLSX)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Génère et télécharge un fichier Excel.
 *
 * @param {Array<{name: string, headers: string[], rows: any[][]}>} sheets
 *   Tableau de feuilles à inclure.
 * @param {string} filename  Nom de base du fichier (sans extension ni date).
 * @returns {boolean} true si succès, false si XLSX n'est pas disponible.
 */
export function exportToExcel(sheets, filename) {
    const XLSX = window.XLSX;
    if (!XLSX) {
        alert('Export Excel non disponible. Veuillez actualiser la page.');
        return false;
    }

    const wb = XLSX.utils.book_new();

    sheets.forEach(({ name, headers, rows }) => {
        const wsData = [headers, ...rows];
        const ws = XLSX.utils.aoa_to_sheet(wsData);

        // Largeurs de colonnes adaptatives
        ws['!cols'] = headers.map((h, i) => ({
            wch: Math.max(
                String(h).length + 2,
                ...rows.map(r => String(r[i] ?? '').length),
                10
            )
        }));

        // Nom de feuille limité à 31 caractères (contrainte Excel)
        XLSX.utils.book_append_sheet(wb, ws, name.substring(0, 31));
    });

    const safeFilename = filename
        .replace(/[<>:"/\\|?*]/g, '_')
        .substring(0, 60);

    XLSX.writeFile(wb, `${safeFilename}_${_today()}.xlsx`);
    return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers d'export par type d'indicateur
// ─────────────────────────────────────────────────────────────────────────────

/** Construit les feuilles Excel pour le type top10. */
export function buildTop10Sheets(data) {
    const top10 = data?.top10_zones || [];
    const timeline = data?.timeline || [];

    return [
        {
            name: 'Top 10 zones à risque',
            headers: ['Rang', 'Marché', 'Commune', 'Département', 'Score max (%)', 'Niveau', 'Nb alertes'],
            rows: top10.map(z => [
                z.rang,
                z.marche_nom,
                z.commune,
                z.departement,
                z.score_max,
                z.niveau_max,
                z.nb_alertes
            ])
        },
        {
            name: 'Timeline alertes',
            headers: ['Date', 'Produit', 'Marché', 'Niveau', 'Variation (%)', 'Statut'],
            rows: timeline.map(e => [
                e.date ? new Date(e.date).toLocaleDateString('fr-FR') : '',
                e.produit,
                e.marche,
                e.niveau,
                e.variation,
                e.statut
            ])
        }
    ];
}

/** Construit les feuilles Excel pour le type prix. */
export function buildPrixSheets(data) {
    const series = data?.series || [];
    const sheets = [];

    series.forEach(serie => {
        const name = `${serie.produit} – ${serie.marche}`.substring(0, 31);
        sheets.push({
            name,
            headers: ['Date', 'Prix min (HTG)', 'Prix moyen (HTG)', 'Prix max (HTG)', 'Nb collectes'],
            rows: (serie.donnees || []).map(d => [
                d.date,
                d.prix_min,
                d.prix_moyen,
                d.prix_max,
                d.nb_collectes
            ])
        });
    });

    if (!sheets.length) {
        sheets.push({
            name: 'Évolution prix',
            headers: ['Info'],
            rows: [['Aucune donnée sur la période sélectionnée']]
        });
    }

    return sheets;
}

/** Construit les feuilles Excel pour la pluviométrie. */
export function buildPluviometrieSheets(data) {
    const zones = data?.zones || [];
    return [{
        name: 'Situation pluviométrique',
        headers: ['Département', 'Score stress (%)', 'SPI (proxy)', 'Jours sans activité', 'Nb alertes', 'Statut'],
        rows: zones.map(z => [
            z.departement,
            z.score_stress,
            z.spi,
            z.jours_sans_activite,
            z.nb_alertes,
            z.statut
        ])
    }];
}

/** Construit les feuilles Excel pour l'historique des alertes. */
export function buildHistoriqueSheets(data) {
    const events = data?.events || [];
    const stats = data?.statistiques || {};

    return [
        {
            name: 'Historique alertes',
            headers: [
                'Date', 'Produit', 'Marché', 'Commune', 'Département',
                'Niveau', 'Statut', 'Variation (%)', 'Prix actuel (HTG)', 'Prix référence (HTG)'
            ],
            rows: events.map(e => [
                e.date ? new Date(e.date).toLocaleString('fr-FR') : '',
                e.produit,
                e.marche,
                e.commune || '',
                e.departement || '',
                e.niveau,
                e.statut,
                e.variation,
                e.prix_actuel,
                e.prix_reference
            ])
        },
        {
            name: 'Statistiques',
            headers: ['Indicateur', 'Valeur'],
            rows: [
                ['Total alertes', stats.total || 0],
                ['Urgences', stats.par_niveau?.urgence || 0],
                ['Alertes', stats.par_niveau?.alerte || 0],
                ['Surveillance', stats.par_niveau?.surveillance || 0],
                ['Normal', stats.par_niveau?.normal || 0],
                ['Actives', stats.par_statut?.active || 0],
                ['Résolues', stats.par_statut?.resolue || 0]
            ]
        }
    ];
}

/** Construit les feuilles Excel pour un profil de commune (drilldown). */
export function buildProfilCommuneSheets(profil) {
    const sheets = [];

    // Fiche de synthèse
    sheets.push({
        name: 'Synthèse',
        headers: ['Champ', 'Valeur'],
        rows: [
            ['Commune', profil.localisation?.commune || ''],
            ['Département', profil.localisation?.departement || ''],
            ['Population', profil.demographie?.population || 0],
            ['Ménages', profil.demographie?.nb_menages || 0],
            ['Densité (hab/km²)', profil.demographie?.densite || ''],
            ['Niveau sécurité alimentaire', profil.situation_securite_alimentaire?.niveau_global || ''],
            ['Nb alertes actives', profil.situation_securite_alimentaire?.nb_alertes_actives || 0],
            ['Nb marchés', profil.situation_securite_alimentaire?.nb_marches || 0]
        ]
    });

    // Alertes actives
    const alertes = profil.situation_securite_alimentaire?.alertes_actives || [];
    sheets.push({
        name: 'Alertes actives',
        headers: ['Produit', 'Marché', 'Niveau', 'Variation (%)', 'Prix actuel (HTG)', 'Prix réf. (HTG)', 'Date'],
        rows: alertes.map(a => [
            a.produit, a.marche, a.niveau, a.variation,
            a.prix_actuel, a.prix_reference,
            a.date ? new Date(a.date).toLocaleString('fr-FR') : ''
        ])
    });

    // Historique
    const historique = profil.historique_alertes || [];
    if (historique.length) {
        sheets.push({
            name: 'Historique 30 jours',
            headers: ['Date', 'Produit', 'Niveau', 'Variation (%)', 'Statut'],
            rows: historique.map(h => [
                h.date ? new Date(h.date).toLocaleDateString('fr-FR') : '',
                h.produit, h.niveau, h.variation, h.statut
            ])
        });
    }

    // Interventions
    const interventions = profil.interventions_actives || [];
    if (interventions.length) {
        sheets.push({
            name: 'Activités récentes',
            headers: ['Date', 'Produit', 'Marché', 'Statut'],
            rows: interventions.map(i => [
                i.date ? new Date(i.date).toLocaleString('fr-FR') : '',
                i.produit, i.marche, i.statut
            ])
        });
    }

    return sheets;
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal de partage
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Affiche une modale de partage avec copie du lien et envoi par courriel.
 */
export function showShareModal() {
    const url = window.location.href;
    _removeOverlay('sap-share-modal');

    const overlay = document.createElement('div');
    overlay.id = 'sap-share-modal';
    overlay.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4';
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

    overlay.innerHTML = `
        <div class="bg-white rounded-xl shadow-2xl max-w-md w-full" role="dialog" aria-modal="true" aria-label="Partager">
            <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <h3 class="text-lg font-bold text-gray-900">📤 Partager ce tableau de bord</h3>
                <button data-close aria-label="Fermer"
                        class="text-gray-400 hover:text-gray-600 text-2xl leading-none transition-colors">&times;</button>
            </div>

            <div class="px-6 py-5 space-y-5">
                <!-- Lien direct -->
                <div>
                    <p class="text-sm font-medium text-gray-700 mb-2">Lien direct</p>
                    <div class="flex gap-2">
                        <input type="text" data-url-input value="${_escAttr(url)}" readonly
                               class="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50 text-gray-600 focus:outline-none cursor-default">
                        <button data-copy-link
                                class="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap">
                            📋 Copier
                        </button>
                    </div>
                </div>

                <!-- Courriel -->
                <div>
                    <p class="text-sm font-medium text-gray-700 mb-2">Envoyer par courriel</p>
                    <div class="flex gap-2">
                        <input type="email" data-email-input placeholder="destinataire@exemple.com"
                               class="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <button data-send-email
                                class="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors whitespace-nowrap">
                            ✉️ Envoyer
                        </button>
                    </div>
                </div>

                <p class="text-xs text-gray-400 pt-2 border-t border-gray-100">
                    Le destinataire doit disposer d'un compte SAP pour accéder aux données sécurisées.
                </p>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    overlay.querySelectorAll('[data-close]').forEach(b => b.onclick = () => overlay.remove());

    // Copier le lien
    overlay.querySelector('[data-copy-link]').addEventListener('click', function () {
        const input = overlay.querySelector('[data-url-input]');
        navigator.clipboard.writeText(url).then(() => {
            _flashButton(this, '✅ Copié !', 'bg-green-600 hover:bg-green-700', 'bg-blue-600 hover:bg-blue-700', '📋 Copier');
        }).catch(() => {
            // Fallback pour les navigateurs sans Clipboard API
            input.select();
            document.execCommand('copy');
            _flashButton(this, '✅ Copié !', 'bg-green-600 hover:bg-green-700', 'bg-blue-600 hover:bg-blue-700', '📋 Copier');
        });
    });

    // Envoyer par courriel (ouvre le client mail)
    overlay.querySelector('[data-send-email]').addEventListener('click', () => {
        const email = overlay.querySelector('[data-email-input]').value.trim();
        if (!email) { overlay.querySelector('[data-email-input]').focus(); return; }

        const subject = encodeURIComponent('Tableau de bord SAP – Sécurité alimentaire Haïti');
        const body = encodeURIComponent(
            `Bonjour,\n\nVeuillez consulter ce tableau de bord du Système d'Alerte Précoce :\n${url}\n\nCordialement`
        );
        window.open(`mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}`, '_blank');
        overlay.remove();
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal de configuration / préférences
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Affiche la modale de configuration du tableau de bord.
 * @param {function} onSave  Callback appelé avec les nouvelles préférences.
 */
export function showConfigModal(onSave) {
    _removeOverlay('sap-config-modal');

    const prefs = loadPreferences();
    const overlay = document.createElement('div');
    overlay.id = 'sap-config-modal';
    overlay.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4';
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

    const widgetOptions = [
        { id: 'carte',        label: '🗺️ Carte nationale' },
        { id: 'kpis',         label: '📊 Indicateurs KPI' },
        { id: 'prixCles',     label: '📈 Prix clés' },
        { id: 'liensRapides', label: '🔗 Liens rapides' }
    ];

    overlay.innerHTML = `
        <div class="bg-white rounded-xl shadow-2xl max-w-md w-full" role="dialog" aria-modal="true" aria-label="Configuration">
            <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <h3 class="text-lg font-bold text-gray-900">⚙️ Paramètres du tableau de bord</h3>
                <button data-close aria-label="Fermer"
                        class="text-gray-400 hover:text-gray-600 text-2xl leading-none transition-colors">&times;</button>
            </div>

            <div class="px-6 py-5 space-y-6 max-h-[70vh] overflow-y-auto">

                <!-- Auto-refresh -->
                <section>
                    <h4 class="text-sm font-semibold text-gray-800 mb-3">Rafraîchissement automatique</h4>
                    <label class="flex items-center gap-3 cursor-pointer select-none">
                        <div class="relative shrink-0">
                            <input type="checkbox" id="cfg-auto-refresh" class="sr-only peer"
                                   ${prefs.autoRefresh ? 'checked' : ''}>
                            <div class="w-11 h-6 bg-gray-200 rounded-full peer-checked:bg-blue-600 transition-colors"></div>
                            <div class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow
                                        transition-transform peer-checked:translate-x-5 pointer-events-none"></div>
                        </div>
                        <span class="text-sm text-gray-700">Mise à jour automatique des données</span>
                    </label>
                    <div class="mt-3 pl-14 flex items-center gap-2">
                        <span class="text-sm text-gray-500">Toutes les</span>
                        <select id="cfg-interval"
                                class="px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="5"  ${prefs.refreshIntervalMin === 5  ? 'selected' : ''}>5 min</option>
                            <option value="15" ${prefs.refreshIntervalMin === 15 ? 'selected' : ''}>15 min</option>
                            <option value="30" ${prefs.refreshIntervalMin === 30 ? 'selected' : ''}>30 min</option>
                            <option value="60" ${prefs.refreshIntervalMin === 60 ? 'selected' : ''}>1 heure</option>
                        </select>
                    </div>
                </section>

                <hr class="border-gray-100">

                <!-- Widgets affichés -->
                <section>
                    <h4 class="text-sm font-semibold text-gray-800 mb-3">Widgets affichés</h4>
                    <div class="grid grid-cols-2 gap-2">
                        ${widgetOptions.map(w => `
                            <label class="flex items-center gap-2 cursor-pointer select-none">
                                <input type="checkbox" id="cfg-widget-${w.id}"
                                       class="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                       ${prefs.widgets[w.id] !== false ? 'checked' : ''}>
                                <span class="text-sm text-gray-700">${w.label}</span>
                            </label>
                        `).join('')}
                    </div>
                </section>

                <hr class="border-gray-100">

                <!-- Filtres par défaut -->
                <section>
                    <h4 class="text-sm font-semibold text-gray-800 mb-3">Filtres par défaut (Indicateurs détaillés)</h4>
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="block text-xs text-gray-500 mb-1" for="cfg-type">Type d'indicateur</label>
                            <select id="cfg-type"
                                    class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                                <option value="top10"        ${prefs.filtresDefaut.type === 'top10'        ? 'selected' : ''}>Top 10 zones</option>
                                <option value="prix"         ${prefs.filtresDefaut.type === 'prix'         ? 'selected' : ''}>Évolution prix</option>
                                <option value="pluviometrie" ${prefs.filtresDefaut.type === 'pluviometrie' ? 'selected' : ''}>Pluviométrie</option>
                                <option value="historique"   ${prefs.filtresDefaut.type === 'historique'   ? 'selected' : ''}>Historique alertes</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs text-gray-500 mb-1" for="cfg-periode">Période</label>
                            <select id="cfg-periode"
                                    class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                                <option value="semaine"   ${prefs.filtresDefaut.periode === 'semaine'   ? 'selected' : ''}>7 jours</option>
                                <option value="mois"      ${prefs.filtresDefaut.periode === 'mois'      ? 'selected' : ''}>30 jours</option>
                                <option value="trimestre" ${prefs.filtresDefaut.periode === 'trimestre' ? 'selected' : ''}>3 mois</option>
                                <option value="annee"     ${prefs.filtresDefaut.periode === 'annee'     ? 'selected' : ''}>12 mois</option>
                            </select>
                        </div>
                    </div>
                </section>
            </div>

            <div class="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
                <button data-close
                        class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                    Annuler
                </button>
                <button id="cfg-save"
                        class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
                    💾 Sauvegarder
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    overlay.querySelectorAll('[data-close]').forEach(b => b.onclick = () => overlay.remove());

    overlay.querySelector('#cfg-save').addEventListener('click', () => {
        const newPrefs = {
            autoRefresh: overlay.querySelector('#cfg-auto-refresh').checked,
            refreshIntervalMin: parseInt(overlay.querySelector('#cfg-interval').value, 10),
            widgets: Object.fromEntries(
                widgetOptions.map(w => [w.id, overlay.querySelector(`#cfg-widget-${w.id}`).checked])
            ),
            filtresDefaut: {
                type:    overlay.querySelector('#cfg-type').value,
                periode: overlay.querySelector('#cfg-periode').value
            }
        };
        savePreferences(newPrefs);
        overlay.remove();
        if (typeof onSave === 'function') onSave(newPrefs);
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilitaires internes
// ─────────────────────────────────────────────────────────────────────────────

function _removeOverlay(id) {
    document.getElementById(id)?.remove();
}

function _today() {
    return new Date().toISOString().split('T')[0];
}

function _escAttr(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function _flashButton(btn, newText, addCls, removeCls, originalText) {
    btn.textContent = newText;
    removeCls.split(' ').forEach(c => btn.classList.remove(c));
    addCls.split(' ').forEach(c => btn.classList.add(c));
    setTimeout(() => {
        btn.textContent = originalText;
        addCls.split(' ').forEach(c => btn.classList.remove(c));
        removeCls.split(' ').forEach(c => btn.classList.add(c));
    }, 2500);
}
