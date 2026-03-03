/**
 * Page Import — Hub d'importation de données
 * - Sans ?entity : grille de tuiles (hub)
 * - Avec ?entity=xxx : page dédiée à l'import de l'entité
 */

import auth from '../modules/auth.js';
import { showToast } from '../modules/ui.js';

const API_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:8000'
    : 'https://sap-backend-tsjq.onrender.com';

// ─── Configuration des entités ────────────────────────────────────────────────

const ENTITIES = [
    {
        key: 'collectes',
        label: 'Collectes de prix',
        emoji: '📊',
        description: 'Prix relevés sur les marchés',
        templateUrl: `${API_URL}/api/collectes/import/template`,
        importUrl: `${API_URL}/api/collectes/import`,
        columns: ['marche_nom', 'produit_nom', 'unite_nom', 'quantite', 'prix', 'date', 'periode', 'commentaire'],
        required: ['marche_nom', 'produit_nom', 'unite_nom', 'quantite', 'prix', 'date', 'periode'],
        examples: [['Croix-des-Bossales', 'Riz blanc local', 'kilogramme', '1', '75', '2026-03-01', 'matin1', '']],
    },
    {
        key: 'produits',
        label: 'Produits',
        emoji: '🛒',
        description: 'Référentiel des produits alimentaires',
        templateUrl: `${API_URL}/api/import/produits/template`,
        importUrl: `${API_URL}/api/import/produits`,
        columns: ['nom', 'code', 'nom_categorie', 'nom_unite', 'nom_creole', 'description'],
        required: ['nom', 'code', 'nom_categorie', 'nom_unite'],
        examples: [['Riz blanc local', 'PROD-RIZ-BL', 'Céréales', 'kilogramme', 'Diri blan', '']],
    },
    {
        key: 'categories',
        label: 'Catégories',
        emoji: '📂',
        description: 'Catégories de produits alimentaires',
        templateUrl: `${API_URL}/api/import/categories/template`,
        importUrl: `${API_URL}/api/import/categories`,
        columns: ['nom', 'nom_creole', 'description'],
        required: ['nom'],
        examples: [['Céréales', 'Grenn', 'Riz, maïs, sorgho...']],
    },
    {
        key: 'unites',
        label: 'Unités de mesure',
        emoji: '📏',
        description: 'Unités utilisées pour les collectes',
        templateUrl: `${API_URL}/api/import/unites/template`,
        importUrl: `${API_URL}/api/import/unites`,
        columns: ['unite', 'symbole'],
        required: ['unite', 'symbole'],
        examples: [['kilogramme', 'kg'], ['litre', 'L']],
    },
    {
        key: 'marches',
        label: 'Marchés',
        emoji: '🏪',
        description: 'Marchés locaux de collecte',
        templateUrl: `${API_URL}/api/import/marches/template`,
        importUrl: `${API_URL}/api/import/marches`,
        columns: ['nom', 'nom_commune', 'type_marche', 'nom_creole', 'code', 'latitude', 'longitude', 'jours_ouverture', 'telephone', 'email'],
        required: ['nom', 'nom_commune'],
        examples: [['Croix-des-Bossales', 'Port-au-Prince', 'quotidien', 'Kwadèbosal', '', '18.5432', '-72.3388', 'lundi;mardi;mercredi', '', '']],
    },
    {
        key: 'communes',
        label: 'Communes',
        emoji: '🏘️',
        description: 'Communes et zones géographiques',
        templateUrl: `${API_URL}/api/import/communes/template`,
        importUrl: `${API_URL}/api/import/communes`,
        columns: ['code', 'nom', 'nom_departement', 'type_zone', 'nom_creole', 'population'],
        required: ['code', 'nom', 'nom_departement'],
        examples: [['HT-OU-001', 'Port-au-Prince', 'Ouest', 'urbaine', 'Pòtoprens', '987310']],
    },
    {
        key: 'departements',
        label: 'Départements',
        emoji: '🗺️',
        description: 'Départements administratifs',
        templateUrl: `${API_URL}/api/import/departements/template`,
        importUrl: `${API_URL}/api/import/departements`,
        columns: ['code', 'nom', 'nom_creole'],
        required: ['code', 'nom'],
        examples: [['HT-OU', 'Ouest', 'Lwès'], ['HT-ND', 'Nord', 'Nò']],
    },
    {
        key: 'utilisateurs',
        label: 'Utilisateurs',
        emoji: '👥',
        description: 'Comptes utilisateurs du système',
        templateUrl: `${API_URL}/api/import/utilisateurs/template`,
        importUrl: `${API_URL}/api/import/utilisateurs`,
        columns: ['email', 'password', 'noms_roles', 'nom', 'prenom', 'nom_departement', 'telephone', 'actif'],
        required: ['email', 'password'],
        examples: [['agent2@sap.ht', 'Agent456!', 'Agent', 'Pierre', 'Marie', 'Ouest', '', 'true']],
    },
    {
        key: 'roles',
        label: 'Rôles',
        emoji: '🎭',
        description: 'Rôles et groupes de permissions',
        templateUrl: `${API_URL}/api/import/roles/template`,
        importUrl: `${API_URL}/api/import/roles`,
        columns: ['nom', 'noms_permissions', 'description'],
        required: ['nom'],
        examples: [['Superviseur', 'admin:produits:read;admin:marches:read', 'Superviseur régional']],
    },
    {
        key: 'permissions',
        label: 'Permissions',
        emoji: '🔑',
        description: 'Permissions granulaires du RBAC',
        templateUrl: `${API_URL}/api/import/permissions/template`,
        importUrl: `${API_URL}/api/import/permissions`,
        columns: ['nom', 'action', 'description'],
        required: ['nom', 'action'],
        examples: [['admin:produits:create', 'create', 'Créer des produits']],
    },
];

// ─── Point d'entrée ───────────────────────────────────────────────────────────

export default function AdminImportPage() {
    const container = document.createElement('div');
    container.className = 'space-y-6 max-w-6xl mx-auto';

    if (!auth.hasRole('bailleur')) {
        container.innerHTML = `
            <div class="text-center py-12">
                <div class="text-6xl mb-4">🔒</div>
                <h2 class="text-2xl font-bold text-red-600 mb-2">Accès non autorisé</h2>
                <p class="text-gray-600">Cette page est réservée aux administrateurs (bailleurs).</p>
                <a href="#/dashboard" class="mt-4 inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                    Retour au tableau de bord
                </a>
            </div>`;
        return container;
    }

    // Lire l'entité depuis le query param ?entity=xxx
    const hash = window.location.hash;
    const queryString = hash.split('?')[1] || '';
    const params = new URLSearchParams(queryString);
    const entityKey = params.get('entity');
    const entity = entityKey ? ENTITIES.find(e => e.key === entityKey) : null;

    if (entity) {
        return renderEntityPage(entity);
    }

    return renderHubPage();
}

// ─── Page Hub : grille des entités ───────────────────────────────────────────

function renderHubPage() {
    const container = document.createElement('div');
    container.className = 'space-y-6 max-w-6xl mx-auto';

    // En-tête
    container.innerHTML = `
        <div class="flex items-center justify-between">
            <div>
                <h1 class="text-3xl font-bold text-gray-900">📤 Import de données</h1>
                <p class="text-gray-600 mt-1">Sélectionnez le type de données à importer</p>
            </div>
            <a href="#/dashboard" class="text-blue-600 hover:text-blue-800 text-sm">← Tableau de bord</a>
        </div>`;

    // Grille des tuiles
    const card = document.createElement('div');
    card.className = 'bg-white rounded-xl shadow p-8';

    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4';

    ENTITIES.forEach(entity => {
        const tile = document.createElement('a');
        tile.href = `#/admin/import?entity=${entity.key}`;
        tile.className = [
            'flex flex-col items-center justify-center gap-2 p-5 rounded-xl border-2',
            'border-gray-200 bg-gray-50 text-gray-700',
            'hover:border-blue-400 hover:bg-blue-50 hover:shadow-md',
            'transition-all duration-150 cursor-pointer group',
        ].join(' ');
        tile.innerHTML = `
            <span class="text-4xl group-hover:scale-110 transition-transform">${entity.emoji}</span>
            <span class="text-xs font-semibold text-center leading-tight">${entity.label}</span>
            <span class="text-xs text-gray-400 text-center leading-tight">${entity.description}</span>`;
        grid.appendChild(tile);
    });

    card.appendChild(grid);
    container.appendChild(card);
    return container;
}

// ─── Page dédiée à une entité ─────────────────────────────────────────────────

function renderEntityPage(entity) {
    const container = document.createElement('div');
    container.className = 'space-y-6 max-w-4xl mx-auto';

    // État local
    let fileObj = null;
    let fileName = '';
    let previewData = null;
    let importResult = null;
    let isImporting = false;

    function render() {
        container.innerHTML = '';

        // ── En-tête avec lien retour ──
        const header = document.createElement('div');
        header.className = 'flex items-center justify-between';
        header.innerHTML = `
            <div class="flex items-center gap-3">
                <span class="text-3xl">${entity.emoji}</span>
                <div>
                    <h1 class="text-2xl font-bold text-gray-900">Import : ${entity.label}</h1>
                    <p class="text-gray-500 text-sm">${entity.description}</p>
                </div>
            </div>
            <a href="#/admin/import"
               class="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors">
                ← Import de données
            </a>`;
        container.appendChild(header);

        // ── Étape 1 : Templates ──
        const step1 = document.createElement('div');
        step1.className = 'bg-white rounded-xl shadow p-6 space-y-4';
        step1.innerHTML = `
            <h2 class="font-semibold text-gray-800 flex items-center gap-2">
                <span class="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">1</span>
                Télécharger un template
            </h2>
            <div class="flex gap-3 flex-wrap">
                <button id="dl-csv"
                    class="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-medium">
                    📄 Template CSV
                </button>
                <button id="dl-excel"
                    class="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
                    📊 Template Excel
                </button>
            </div>
            <div class="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 space-y-1">
                <div>
                    <span class="font-semibold text-gray-700">Colonnes obligatoires :</span>
                    ${entity.required.map(c => `<code class="bg-red-50 text-red-700 px-1.5 py-0.5 rounded ml-1">${c}</code>`).join('')}
                </div>
                ${entity.columns.filter(c => !entity.required.includes(c)).length > 0 ? `
                <div>
                    <span class="font-semibold text-gray-700">Colonnes optionnelles :</span>
                    ${entity.columns.filter(c => !entity.required.includes(c)).map(c => `<code class="bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded ml-1">${c}</code>`).join('')}
                </div>` : ''}
            </div>`;
        container.appendChild(step1);

        // ── Étape 2 : Upload ──
        const step2 = document.createElement('div');
        step2.className = 'bg-white rounded-xl shadow p-6 space-y-4';
        step2.innerHTML = `
            <h2 class="font-semibold text-gray-800 flex items-center gap-2">
                <span class="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">2</span>
                Sélectionner le fichier
            </h2>
            <div id="drop-zone"
                class="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                <div class="text-5xl mb-3">📁</div>
                <p class="text-gray-600 font-medium mb-1">Glissez-déposez votre fichier ici</p>
                <p class="text-gray-400 text-sm mb-4">ou</p>
                <label class="bg-blue-600 text-white px-5 py-2 rounded-lg cursor-pointer hover:bg-blue-700 text-sm font-medium">
                    Choisir un fichier
                    <input type="file" id="file-input" accept=".csv,.xlsx,.xls" class="hidden">
                </label>
                <p class="text-gray-400 text-xs mt-4">Formats acceptés : CSV, Excel (.xlsx, .xls)</p>
                ${fileName ? `<p class="mt-3 text-green-600 font-medium text-sm">✅ ${fileName}</p>` : ''}
            </div>`;
        container.appendChild(step2);

        // ── Étape 3 : Aperçu ──
        if (previewData) {
            const step3 = document.createElement('div');
            step3.className = 'bg-white rounded-xl shadow p-6 space-y-3';
            step3.innerHTML = `
                <h2 class="font-semibold text-gray-800 flex items-center gap-2">
                    <span class="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">3</span>
                    Aperçu — ${previewData.rows.length > 0 ? `${Math.min(20, previewData.rows.length)} / ${previewData.total} ligne(s)` : `Colonnes du fichier Excel`}
                </h2>`;

            if (previewData.rows.length > 0) {
                const cols = previewData.headers || entity.columns;
                const rows = previewData.rows.slice(0, 20);
                const tableWrap = document.createElement('div');
                tableWrap.className = 'overflow-x-auto rounded-lg border border-gray-200';
                tableWrap.innerHTML = `
                    <table class="w-full text-xs border-collapse">
                        <thead>
                            <tr class="bg-gray-100">
                                <th class="border-b border-gray-200 px-3 py-2 text-left text-gray-500 font-medium">#</th>
                                ${cols.map(c => `<th class="border-b border-gray-200 px-3 py-2 text-left font-medium text-gray-700">${c}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${rows.map((row, i) => `
                                <tr class="${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
                                    <td class="border-b border-gray-100 px-3 py-1.5 text-gray-400">${i + 1}</td>
                                    ${cols.map(c => `<td class="border-b border-gray-100 px-3 py-1.5 text-gray-700">${row[c] ?? ''}</td>`).join('')}
                                </tr>`).join('')}
                        </tbody>
                    </table>`;
                step3.appendChild(tableWrap);
            } else {
                // Excel : afficher juste les colonnes détectées
                const colsDiv = document.createElement('div');
                colsDiv.className = 'flex flex-wrap gap-2';
                previewData.headers.forEach(c => {
                    const chip = document.createElement('span');
                    chip.className = 'bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-medium';
                    chip.textContent = c;
                    colsDiv.appendChild(chip);
                });
                step3.appendChild(colsDiv);
            }

            container.appendChild(step3);
        }

        // ── Barre d'action ──
        if (previewData && !importResult) {
            const actionBar = document.createElement('div');
            actionBar.className = 'flex items-center justify-between bg-white rounded-xl shadow px-6 py-4';
            actionBar.innerHTML = `
                <p class="text-sm text-gray-600">
                    <span class="font-semibold">${previewData.total}</span> ligne(s) prête(s) à importer
                </p>
                <div class="flex gap-3">
                    <button id="cancel-btn"
                        class="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 text-sm font-medium">
                        ✕ Annuler
                    </button>
                    <button id="import-btn"
                        class="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 font-semibold text-sm${isImporting ? ' opacity-60 cursor-not-allowed' : ''}"
                        ${isImporting ? 'disabled' : ''}>
                        ${isImporting ? '⏳ Import en cours...' : '⬆️ Lancer l\'import'}
                    </button>
                </div>`;
            container.appendChild(actionBar);
        }

        // ── Résultats ──
        if (importResult) {
            const hasErrors = importResult.erreurs && importResult.erreurs.length > 0;
            const resultDiv = document.createElement('div');
            resultDiv.className = `bg-white rounded-xl shadow p-6 space-y-4`;
            resultDiv.innerHTML = `
                <div class="flex items-center gap-2">
                    <span class="text-2xl">${hasErrors ? '⚠️' : '✅'}</span>
                    <h2 class="font-semibold text-gray-800 text-lg">${importResult.message}</h2>
                </div>
                <div class="flex gap-6">
                    <div class="bg-green-50 rounded-lg px-4 py-3 text-center">
                        <div class="text-2xl font-bold text-green-700">${importResult.crees}</div>
                        <div class="text-xs text-green-600">créé(s)</div>
                    </div>
                    ${hasErrors ? `
                    <div class="bg-red-50 rounded-lg px-4 py-3 text-center">
                        <div class="text-2xl font-bold text-red-600">${importResult.erreurs.length}</div>
                        <div class="text-xs text-red-500">erreur(s)</div>
                    </div>` : ''}
                    <div class="bg-gray-50 rounded-lg px-4 py-3 text-center">
                        <div class="text-2xl font-bold text-gray-600">${importResult.total_lignes}</div>
                        <div class="text-xs text-gray-500">total ligne(s)</div>
                    </div>
                </div>
                ${hasErrors ? `
                <div>
                    <p class="text-sm font-medium text-red-700 mb-2">Détail des erreurs :</p>
                    <ul class="space-y-1.5 max-h-60 overflow-y-auto">
                        ${importResult.erreurs.map(e =>
                            `<li class="text-xs text-red-600 bg-red-50 border border-red-100 rounded px-3 py-1.5">
                                <span class="font-semibold">Ligne ${e.ligne} :</span> ${e.message}
                            </li>`
                        ).join('')}
                    </ul>
                </div>` : ''}
                <div class="flex gap-3 pt-2">
                    <button id="new-import-btn"
                        class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
                        Nouvel import
                    </button>
                    <a href="#/admin/import"
                        class="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 text-sm font-medium inline-flex items-center">
                        ← Retour au hub
                    </a>
                </div>`;
            container.appendChild(resultDiv);
        }

        bindEvents();
    }

    function bindEvents() {
        // Templates
        document.getElementById('dl-csv')?.addEventListener('click', () => downloadTemplate('csv'));
        document.getElementById('dl-excel')?.addEventListener('click', () => downloadTemplate('excel'));

        // Drag & drop
        const dropZone = document.getElementById('drop-zone');
        if (dropZone) {
            dropZone.addEventListener('dragover', e => {
                e.preventDefault();
                dropZone.classList.add('border-blue-400', 'bg-blue-50');
            });
            dropZone.addEventListener('dragleave', () => {
                dropZone.classList.remove('border-blue-400', 'bg-blue-50');
            });
            dropZone.addEventListener('drop', e => {
                e.preventDefault();
                dropZone.classList.remove('border-blue-400', 'bg-blue-50');
                const file = e.dataTransfer.files[0];
                if (file) handleFile(file);
            });
        }

        // Input fichier
        document.getElementById('file-input')?.addEventListener('change', e => {
            const file = e.target.files[0];
            if (file) handleFile(file);
        });

        // Annuler
        document.getElementById('cancel-btn')?.addEventListener('click', () => {
            fileObj = null;
            fileName = '';
            previewData = null;
            importResult = null;
            render();
        });

        // Lancer l'import
        document.getElementById('import-btn')?.addEventListener('click', doImport);

        // Nouvel import
        document.getElementById('new-import-btn')?.addEventListener('click', () => {
            fileObj = null;
            fileName = '';
            previewData = null;
            importResult = null;
            render();
        });
    }

    async function downloadTemplate(format) {
        try {
            const response = await fetch(`${entity.templateUrl}?format=${format}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
            });
            if (!response.ok) throw new Error('Erreur téléchargement template');
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = format === 'csv' ? `template_${entity.key}.csv` : `template_${entity.key}.xlsx`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            showToast({ message: `Erreur téléchargement : ${err.message}`, type: 'error' });
        }
    }

    function handleFile(file) {
        const ext = '.' + file.name.split('.').pop().toLowerCase();
        if (!['.csv', '.xlsx', '.xls'].includes(ext)) {
            showToast({ message: 'Format non supporté. Utilisez CSV ou Excel (.xlsx, .xls)', type: 'error' });
            return;
        }

        fileName = file.name;
        fileObj = file;
        importResult = null;

        if (ext === '.csv') {
            const reader = new FileReader();
            reader.onload = e => {
                const lines = e.target.result.split('\n').filter(l => l.trim());
                if (lines.length < 2) {
                    showToast({ message: 'Fichier vide ou sans données', type: 'error' });
                    return;
                }
                const headers = parseCsvLine(lines[0]);
                const rows = lines.slice(1).map(line => {
                    const vals = parseCsvLine(line);
                    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']));
                });
                previewData = { headers, rows, total: rows.length };
                render();
            };
            reader.readAsText(file, 'utf-8');
        } else {
            // Excel : aperçu colonnes seulement
            previewData = { headers: entity.columns, rows: [], total: '?' };
            showToast({ message: `Fichier Excel sélectionné : ${file.name}`, type: 'info' });
            render();
        }
    }

    function parseCsvLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                inQuotes = !inQuotes;
            } else if (ch === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += ch;
            }
        }
        result.push(current.trim());
        return result;
    }

    async function doImport() {
        if (!fileObj) return;

        isImporting = true;
        render();

        try {
            const formData = new FormData();
            formData.append('file', fileObj);

            const response = await fetch(entity.importUrl, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` },
                body: formData
            });

            const result = await response.json();

            if (!response.ok) {
                const detail = result.detail;
                if (typeof detail === 'object' && detail.errors) {
                    throw new Error(detail.message + '\n' + detail.errors.join('\n'));
                }
                throw new Error(typeof detail === 'string' ? detail : 'Erreur lors de l\'import');
            }

            // Normaliser la réponse collectes (format différent)
            if (entity.key === 'collectes') {
                importResult = {
                    message: result.message || 'Import réussi',
                    total_lignes: result.total_lignes || 0,
                    crees: result.collectes_creees || 0,
                    erreurs: [],
                };
            } else {
                importResult = result;
            }

            const toastType = (importResult.erreurs && importResult.erreurs.length > 0) ? 'warning' : 'success';
            showToast({ message: importResult.message, type: toastType });

        } catch (err) {
            showToast({ message: `Erreur : ${err.message}`, type: 'error' });
            importResult = null;
        }

        isImporting = false;
        render();
    }

    render();
    return container;
}
