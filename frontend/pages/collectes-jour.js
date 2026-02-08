/**
 * Page Collectes du Jour
 * Affiche uniquement les collectes du jour avec tableau paginé et recherche
 */

import auth from '../modules/auth.js';
import api from '../modules/api.js';
import { showToast } from '../modules/ui.js';

export default function CollectesJourPage() {
    const container = document.createElement('div');
    container.className = 'space-y-6';

    // État
    let collectes = [];
    let marches = [];
    let produits = [];
    let isLoading = true;
    let currentPage = 1;
    let itemsPerPage = 10;
    let searchFilters = {
        marche: '',
        produit: ''
    };

    // Header
    function renderHeader() {
        const header = document.createElement('div');
        header.className = 'bg-gradient-to-r from-green-600 to-green-800 rounded-lg shadow-lg p-6 mb-6';

        const title = document.createElement('h1');
        title.className = 'text-3xl font-bold text-white mb-2';
        title.textContent = 'Collectes du Jour';

        const subtitle = document.createElement('p');
        subtitle.className = 'text-green-100';
        const today = new Date().toLocaleDateString('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
        subtitle.textContent = `${today}`;

        header.appendChild(title);
        header.appendChild(subtitle);

        return header;
    }

    // Filtres de recherche
    function renderFilters() {
        const section = document.createElement('div');
        section.className = 'bg-white rounded-lg shadow p-6 mb-6';

        const title = document.createElement('h2');
        title.className = 'text-lg font-semibold text-gray-900 mb-4';
        title.textContent = 'Filtrer';

        const grid = document.createElement('div');
        grid.className = 'grid grid-cols-1 md:grid-cols-3 gap-4';

        // Filtre Marché
        const marcheDiv = document.createElement('div');
        const marcheLabel = document.createElement('label');
        marcheLabel.className = 'block text-sm font-medium text-gray-700 mb-1';
        marcheLabel.textContent = 'Marché';

        const marcheSelect = document.createElement('select');
        marcheSelect.className = 'w-full rounded-lg border-gray-300 p-2 border focus:ring-2 focus:ring-green-500';
        marcheSelect.innerHTML = '<option value="">Tous les marchés</option>';
        marches.forEach(m => {
            const option = document.createElement('option');
            option.value = m.id;
            option.textContent = m.nom;
            marcheSelect.appendChild(option);
        });
        marcheSelect.value = searchFilters.marche;
        marcheSelect.addEventListener('change', (e) => {
            searchFilters.marche = e.target.value;
            currentPage = 1;
            render();
        });

        marcheDiv.appendChild(marcheLabel);
        marcheDiv.appendChild(marcheSelect);

        // Filtre Produit
        const produitDiv = document.createElement('div');
        const produitLabel = document.createElement('label');
        produitLabel.className = 'block text-sm font-medium text-gray-700 mb-1';
        produitLabel.textContent = 'Produit';

        const produitSelect = document.createElement('select');
        produitSelect.className = 'w-full rounded-lg border-gray-300 p-2 border focus:ring-2 focus:ring-green-500';
        produitSelect.innerHTML = '<option value="">Tous les produits</option>';
        produits.forEach(p => {
            const option = document.createElement('option');
            option.value = p.id;
            option.textContent = p.nom;
            produitSelect.appendChild(option);
        });
        produitSelect.value = searchFilters.produit;
        produitSelect.addEventListener('change', (e) => {
            searchFilters.produit = e.target.value;
            currentPage = 1;
            render();
        });

        produitDiv.appendChild(produitLabel);
        produitDiv.appendChild(produitSelect);

        // Bouton Reset
        const resetDiv = document.createElement('div');
        resetDiv.className = 'flex items-end';

        const resetBtn = document.createElement('button');
        resetBtn.className = 'w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition';
        resetBtn.textContent = 'Réinitialiser';
        resetBtn.addEventListener('click', () => {
            searchFilters = { marche: '', produit: '' };
            currentPage = 1;
            render();
        });

        resetDiv.appendChild(resetBtn);

        grid.appendChild(marcheDiv);
        grid.appendChild(produitDiv);
        grid.appendChild(resetDiv);

        section.appendChild(title);
        section.appendChild(grid);

        return section;
    }

    // Tableau des collectes
    function renderTable() {
        const section = document.createElement('div');
        section.className = 'bg-white rounded-lg shadow overflow-hidden';

        // Filtrer les collectes du jour
        const today = new Date().toISOString().split('T')[0];
        let filteredCollectes = collectes.filter(c => {
            const collecteDate = new Date(c.date).toISOString().split('T')[0];
            return collecteDate === today;
        });

        if (searchFilters.marche) {
            filteredCollectes = filteredCollectes.filter(c => c.marche_id === searchFilters.marche);
        }

        if (searchFilters.produit) {
            filteredCollectes = filteredCollectes.filter(c => c.produit_id === searchFilters.produit);
        }

        // Grouper les collectes par marché, produit
        const groupedCollectes = {};
        filteredCollectes.forEach(c => {
            const key = `${c.marche_id}_${c.produit_id}`;
            if (!groupedCollectes[key]) {
                groupedCollectes[key] = {
                    marche_id: c.marche_id,
                    marche_nom: c.marche_nom,
                    produit_id: c.produit_id,
                    produit_nom: c.produit_nom,
                    date: c.date,
                    matin1: null,
                    matin2: null,
                    soir1: null,
                    soir2: null
                };
            }

            if (c.periode) {
                groupedCollectes[key][c.periode] = c.prix;
            }
        });

        const groupedArray = Object.values(groupedCollectes);

        // Pagination
        const totalItems = groupedArray.length;
        const totalPages = Math.ceil(totalItems / itemsPerPage);
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const paginatedItems = groupedArray.slice(startIndex, endIndex);

        // Header du tableau
        const header = document.createElement('div');
        header.className = 'bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center';

        const headerTitle = document.createElement('h2');
        headerTitle.className = 'text-lg font-semibold text-gray-900';
        headerTitle.textContent = `Total: ${totalItems} collecte(s) aujourd'hui`;

        // Sélecteur items par page
        const itemsPerPageDiv = document.createElement('div');
        itemsPerPageDiv.className = 'flex items-center gap-2';

        const itemsLabel = document.createElement('span');
        itemsLabel.className = 'text-sm text-gray-600';
        itemsLabel.textContent = 'Afficher:';

        const itemsSelect = document.createElement('select');
        itemsSelect.className = 'rounded border-gray-300 text-sm p-1';
        [10, 25, 50, 100].forEach(num => {
            const option = document.createElement('option');
            option.value = num;
            option.textContent = num;
            option.selected = itemsPerPage === num;
            itemsSelect.appendChild(option);
        });
        itemsSelect.addEventListener('change', (e) => {
            itemsPerPage = parseInt(e.target.value);
            currentPage = 1;
            render();
        });

        itemsPerPageDiv.appendChild(itemsLabel);
        itemsPerPageDiv.appendChild(itemsSelect);

        header.appendChild(headerTitle);
        header.appendChild(itemsPerPageDiv);

        section.appendChild(header);

        // Table
        const tableWrapper = document.createElement('div');
        tableWrapper.className = 'overflow-x-auto';

        const table = document.createElement('table');
        table.className = 'w-full';

        // Table Header
        const thead = document.createElement('thead');
        thead.className = 'bg-gray-100 border-b border-gray-200';
        thead.innerHTML = `
            <tr>
                <th class="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Marché</th>
                <th class="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Produit</th>
                <th class="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Matin 1</th>
                <th class="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Matin 2</th>
                <th class="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Soir 1</th>
                <th class="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Soir 2</th>
                <th class="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Date</th>
            </tr>
        `;

        // Table Body
        const tbody = document.createElement('tbody');
        tbody.className = 'bg-white divide-y divide-gray-200';

        if (paginatedItems.length === 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = '<td colspan="7" class="px-6 py-8 text-center text-gray-500">Aucune collecte aujourd\'hui</td>';
            tbody.appendChild(tr);
        } else {
            paginatedItems.forEach(item => {
                const tr = document.createElement('tr');
                tr.className = 'hover:bg-gray-50';

                const formatPrice = (price) => price !== null ? `${price} HTG` : '-';

                tr.innerHTML = `
                    <td class="px-6 py-4 text-sm text-gray-900">${item.marche_nom}</td>
                    <td class="px-6 py-4 text-sm text-gray-900">${item.produit_nom}</td>
                    <td class="px-6 py-4 text-sm text-center text-gray-900">${formatPrice(item.matin1)}</td>
                    <td class="px-6 py-4 text-sm text-center text-gray-900">${formatPrice(item.matin2)}</td>
                    <td class="px-6 py-4 text-sm text-center text-gray-900">${formatPrice(item.soir1)}</td>
                    <td class="px-6 py-4 text-sm text-center text-gray-900">${formatPrice(item.soir2)}</td>
                    <td class="px-6 py-4 text-sm text-gray-900">${formatDate(item.date)}</td>
                `;

                tbody.appendChild(tr);
            });
        }

        table.appendChild(thead);
        table.appendChild(tbody);
        tableWrapper.appendChild(table);
        section.appendChild(tableWrapper);

        // Pagination
        if (totalPages > 1) {
            const pagination = document.createElement('div');
            pagination.className = 'bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-between items-center';

            const info = document.createElement('div');
            info.className = 'text-sm text-gray-600';
            info.textContent = `Page ${currentPage} sur ${totalPages}`;

            const buttons = document.createElement('div');
            buttons.className = 'flex gap-2';

            // Bouton Précédent
            const prevBtn = document.createElement('button');
            prevBtn.className = `px-4 py-2 text-sm rounded ${currentPage === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`;
            prevBtn.textContent = '← Précédent';
            prevBtn.disabled = currentPage === 1;
            prevBtn.addEventListener('click', () => {
                if (currentPage > 1) {
                    currentPage--;
                    render();
                }
            });

            // Bouton Suivant
            const nextBtn = document.createElement('button');
            nextBtn.className = `px-4 py-2 text-sm rounded ${currentPage === totalPages ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`;
            nextBtn.textContent = 'Suivant →';
            nextBtn.disabled = currentPage === totalPages;
            nextBtn.addEventListener('click', () => {
                if (currentPage < totalPages) {
                    currentPage++;
                    render();
                }
            });

            buttons.appendChild(prevBtn);
            buttons.appendChild(nextBtn);

            pagination.appendChild(info);
            pagination.appendChild(buttons);

            section.appendChild(pagination);
        }

        return section;
    }

    // Format date
    function formatDate(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }

    // Charger les données
    async function loadData() {
        try {
            isLoading = true;
            render();

            const [collectesData, marchesData, produitsData] = await Promise.all([
                api.get('/api/collectes'),
                api.get('/api/marches'),
                api.get('/api/produits')
            ]);

            collectes = collectesData;
            marches = marchesData;
            produits = produitsData;

            isLoading = false;
            render();
        } catch (error) {
            console.error('Erreur lors du chargement:', error);
            showToast({
                message: 'Erreur lors du chargement des données',
                type: 'error'
            });
            isLoading = false;
            render();
        }
    }

    // Rendu principal
    function render() {
        container.innerHTML = '';

        container.appendChild(renderHeader());

        if (isLoading) {
            const loading = document.createElement('div');
            loading.className = 'text-center py-12';
            loading.innerHTML = '<div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div><p class="mt-4 text-gray-600">Chargement...</p>';
            container.appendChild(loading);
            return;
        }

        container.appendChild(renderFilters());
        container.appendChild(renderTable());
    }

    // Initialisation
    loadData();
    render();

    return container;
}
