/**
 * Page d'administration des unités de mesure
 * CRUD complet réservé aux décideurs
 */

import auth from '../modules/auth.js';
import api from '../modules/api.js';
import { Card, Button, Input, Modal, showToast, Spinner, Badge } from '../modules/ui.js';

export default function AdminUnitesPage() {
    const container = document.createElement('div');
    container.className = 'space-y-6';

    const user = auth.getCurrentUser();
    const isBailleur = auth.hasRole('bailleur');

    // Vérifier les permissions
    if (!isBailleur) {
        const unauthorized = document.createElement('div');
        unauthorized.className = 'text-center py-12';
        unauthorized.innerHTML = `
            <h2 class="text-2xl font-bold text-red-600 mb-2">Accès non autorisé</h2>
            <p class="text-gray-600">Cette page est réservée aux administrateurs.</p>
        `;
        container.appendChild(unauthorized);
        return container;
    }

    // État
    let isLoading = true;
    let unites = [];
    let filteredUnites = [];
    let searchTerm = '';
    let editingUnite = null;
    let showModal = false;

    // Pagination
    let currentPage = 1;
    let itemsPerPage = 10;
    let totalPages = 1;

    // Formulaire
    let formData = {
        unite: '',
        symbole: ''
    };

    // Header
    function renderHeader() {
        const header = document.createElement('div');
        header.className = 'flex justify-between items-center mb-6';

        const titleDiv = document.createElement('div');
        const title = document.createElement('h1');
        title.className = 'text-3xl font-bold text-gray-900';
        title.textContent = 'Unités de Mesure';

        const subtitle = document.createElement('p');
        subtitle.className = 'text-gray-600 mt-1';
        subtitle.textContent = 'Gestion des unités de mesure pour les produits';

        titleDiv.appendChild(title);
        titleDiv.appendChild(subtitle);

        const addButton = Button({
            text: '+ Ajouter une unité',
            variant: 'primary',
            onClick: () => {
                editingUnite = null;
                formData = { unite: '', symbole: '' };
                showModal = true;
                render();
            }
        });

        header.appendChild(titleDiv);
        header.appendChild(addButton);

        return header;
    }

    // Barre de recherche
    function renderSearchBar() {
        const searchBar = document.createElement('div');
        searchBar.className = 'mb-6';

        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'Rechercher une unité...';
        searchInput.className = 'w-full md:w-96 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
        searchInput.value = searchTerm;
        searchInput.addEventListener('input', (e) => {
            searchTerm = e.target.value;
            currentPage = 1; // Reset to first page
            filterUnites();
            render();
        });

        searchBar.appendChild(searchInput);
        return searchBar;
    }

    // Contrôles de pagination
    function renderPagination() {
        if (filteredUnites.length === 0) {
            return document.createElement('div'); // Retourner un div vide
        }

        const paginationDiv = document.createElement('div');
        paginationDiv.className = 'mt-6 flex items-center justify-between border-t border-gray-200 pt-4';

        // Info et sélecteur de taille de page
        const leftDiv = document.createElement('div');
        leftDiv.className = 'flex items-center space-x-4';

        const info = document.createElement('p');
        info.className = 'text-sm text-gray-700';
        const startIndex = (currentPage - 1) * itemsPerPage + 1;
        const endIndex = Math.min(currentPage * itemsPerPage, filteredUnites.length);
        info.textContent = `${startIndex}-${endIndex} sur ${filteredUnites.length}`;

        const sizeSelector = document.createElement('div');
        sizeSelector.className = 'flex items-center space-x-2';

        const sizeLabel = document.createElement('span');
        sizeLabel.className = 'text-sm text-gray-700';
        sizeLabel.textContent = 'Éléments par page:';

        const sizeSelect = document.createElement('select');
        sizeSelect.className = 'px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
        [5, 10, 20, 50, 100].forEach(size => {
            const option = document.createElement('option');
            option.value = size;
            option.textContent = size;
            option.selected = itemsPerPage === size;
            sizeSelect.appendChild(option);
        });
        sizeSelect.addEventListener('change', (e) => {
            itemsPerPage = parseInt(e.target.value);
            currentPage = 1;
            filterUnites();
            render();
        });

        sizeSelector.appendChild(sizeLabel);
        sizeSelector.appendChild(sizeSelect);

        leftDiv.appendChild(info);
        leftDiv.appendChild(sizeSelector);

        // Boutons de navigation
        const navDiv = document.createElement('div');
        navDiv.className = 'flex space-x-2';

        const prevBtn = Button({
            text: '← Précédent',
            variant: 'secondary',
            className: 'text-sm',
            disabled: currentPage === 1,
            onClick: () => {
                if (currentPage > 1) {
                    currentPage--;
                    render();
                }
            }
        });

        const pageInfo = document.createElement('span');
        pageInfo.className = 'px-4 py-2 text-sm text-gray-700';
        pageInfo.textContent = `Page ${currentPage} sur ${totalPages}`;

        const nextBtn = Button({
            text: 'Suivant →',
            variant: 'secondary',
            className: 'text-sm',
            disabled: currentPage === totalPages,
            onClick: () => {
                if (currentPage < totalPages) {
                    currentPage++;
                    render();
                }
            }
        });

        navDiv.appendChild(prevBtn);
        navDiv.appendChild(pageInfo);
        navDiv.appendChild(nextBtn);

        paginationDiv.appendChild(leftDiv);
        paginationDiv.appendChild(navDiv);

        return paginationDiv;
    }

    // Tableau des unités
    function renderTable() {
        const card = Card({
            children: [
                (() => {
                    const wrapper = document.createElement('div');
                    wrapper.className = 'overflow-x-auto';

                    if (filteredUnites.length === 0) {
                        const empty = document.createElement('div');
                        empty.className = 'text-center py-12';
                        empty.innerHTML = `
                            <p class="text-gray-500">
                                ${searchTerm ? 'Aucune unité trouvée' : 'Aucune unité de mesure'}
                            </p>
                        `;
                        wrapper.appendChild(empty);
                        return wrapper;
                    }

                    const table = document.createElement('table');
                    table.className = 'min-w-full divide-y divide-gray-200';

                    // Header
                    const thead = document.createElement('thead');
                    thead.className = 'bg-gray-50';
                    thead.innerHTML = `
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unité</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Symbole</th>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    `;
                    table.appendChild(thead);

                    // Body
                    const tbody = document.createElement('tbody');
                    tbody.className = 'bg-white divide-y divide-gray-200';

                    // Calculer les items de la page courante
                    const startIndex = (currentPage - 1) * itemsPerPage;
                    const endIndex = startIndex + itemsPerPage;
                    const pageItems = filteredUnites.slice(startIndex, endIndex);

                    pageItems.forEach(unite => {
                        const row = document.createElement('tr');
                        row.className = 'hover:bg-gray-50';

                        // Unité
                        const uniteCell = document.createElement('td');
                        uniteCell.className = 'px-6 py-4 whitespace-nowrap';
                        const uniteBadge = Badge({
                            text: unite.unite,
                            variant: 'primary'
                        });
                        uniteCell.appendChild(uniteBadge);
                        row.appendChild(uniteCell);

                        // Symbole
                        const symboleCell = document.createElement('td');
                        symboleCell.className = 'px-6 py-4 text-sm text-gray-900';
                        symboleCell.textContent = unite.symbole;
                        row.appendChild(symboleCell);

                        // Actions
                        const actionsCell = document.createElement('td');
                        actionsCell.className = 'px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2';

                        const editBtn = Button({
                            text: 'Modifier',
                            variant: 'secondary',
                            className: 'text-sm',
                            onClick: () => handleEdit(unite)
                        });

                        const deleteBtn = Button({
                            text: 'Supprimer',
                            variant: 'danger',
                            className: 'text-sm',
                            onClick: () => handleDelete(unite)
                        });

                        actionsCell.appendChild(editBtn);
                        actionsCell.appendChild(deleteBtn);
                        row.appendChild(actionsCell);

                        tbody.appendChild(row);
                    });

                    table.appendChild(tbody);
                    wrapper.appendChild(table);

                    return wrapper;
                })()
            ]
        });

        return card;
    }

    // Modal de création/édition
    function renderModal() {
        if (!showModal) return document.createElement('div'); // Retourner un div vide

        const modalContent = document.createElement('div');
        modalContent.className = 'space-y-4';

        const title = document.createElement('h2');
        title.className = 'text-xl font-bold text-gray-900 mb-4';
        title.textContent = editingUnite ? 'Modifier l\'unité' : 'Ajouter une unité';
        modalContent.appendChild(title);

        // Champ Unité
        const uniteGroup = document.createElement('div');
        const uniteLabel = document.createElement('label');
        uniteLabel.className = 'block text-sm font-medium text-gray-700 mb-1';
        uniteLabel.innerHTML = '<span class="text-red-500">*</span> Nom de l\'unité';

        const uniteInput = document.createElement('input');
        uniteInput.type = 'text';
        uniteInput.required = true;
        uniteInput.placeholder = 'kilogramme, litre, gramme...';
        uniteInput.className = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
        uniteInput.value = formData.unite;
        uniteInput.addEventListener('input', (e) => {
            formData.unite = e.target.value;
        });

        uniteGroup.appendChild(uniteLabel);
        uniteGroup.appendChild(uniteInput);
        modalContent.appendChild(uniteGroup);

        // Champ Symbole
        const symboleGroup = document.createElement('div');
        const symboleLabel = document.createElement('label');
        symboleLabel.className = 'block text-sm font-medium text-gray-700 mb-1';
        symboleLabel.textContent = 'Symbole *';

        const symboleInput = document.createElement('input');
        symboleInput.type = 'text';
        symboleInput.placeholder = 'kg, L, g...';
        symboleInput.className = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
        symboleInput.value = formData.symbole;
        symboleInput.addEventListener('input', (e) => {
            formData.symbole = e.target.value;
        });

        symboleGroup.appendChild(symboleLabel);
        symboleGroup.appendChild(symboleInput);
        modalContent.appendChild(symboleGroup);

        // Boutons
        const buttonsDiv = document.createElement('div');
        buttonsDiv.className = 'flex justify-end space-x-3 mt-6';

        const cancelBtn = Button({
            text: 'Annuler',
            variant: 'secondary',
            onClick: () => {
                showModal = false;
                render();
            }
        });

        const saveBtn = Button({
            text: editingUnite ? 'Enregistrer' : 'Créer',
            variant: 'primary',
            onClick: handleSave
        });

        buttonsDiv.appendChild(cancelBtn);
        buttonsDiv.appendChild(saveBtn);
        modalContent.appendChild(buttonsDiv);

        return Modal({
            isOpen: showModal,
            onClose: () => {
                showModal = false;
                render();
            },
            children: [modalContent]
        });
    }

    // Handlers
    function handleEdit(unite) {
        editingUnite = unite;
        formData = {
            unite: unite.unite,
            symbole: unite.symbole || ''
        };
        showModal = true;
        render();
    }

    async function handleDelete(unite) {
        if (!confirm(`Êtes-vous sûr de vouloir supprimer l'unité "${unite.unite}" ?`)) {
            return;
        }

        try {
            await api.delete(`/api/unites-mesure/${unite.id}`);
            showToast({
                message: 'Unité supprimée avec succès',
                type: 'success'
            });
            await loadUnites();
        } catch (error) {
            showToast({
                message: error.message || 'Erreur lors de la suppression',
                type: 'error'
            });
        }
    }

    async function handleSave() {
        // Validation
        if (!formData.unite.trim()) {
            showToast({
                message: 'Le nom de l\'unité est obligatoire',
                type: 'error'
            });
            return;
        }

        if (!formData.symbole.trim()) {
            showToast({
                message: 'Le symbole est obligatoire',
                type: 'error'
            });
            return;
        }

        try {
            if (editingUnite) {
                // Mise à jour
                await api.put(`/api/unites-mesure/${editingUnite.id}`, formData);
                showToast({
                    message: 'Unité modifiée avec succès',
                    type: 'success'
                });
            } else {
                // Création
                await api.post('/api/unites-mesure', formData);
                showToast({
                    message: 'Unité créée avec succès',
                    type: 'success'
                });
            }

            showModal = false;
            await loadUnites();
        } catch (error) {
            showToast({
                message: error.message || 'Erreur lors de l\'enregistrement',
                type: 'error'
            });
        }
    }

    function filterUnites() {
        let filtered;
        if (!searchTerm.trim()) {
            filtered = [...unites];
        } else {
            const term = searchTerm.toLowerCase();
            filtered = unites.filter(unite =>
                unite.unite.toLowerCase().includes(term) ||
                (unite.symbole && unite.symbole.toLowerCase().includes(term))
            );
        }

        // Tri alphabétique par nom d'unité
        filtered.sort((a, b) => a.unite.localeCompare(b.unite));

        filteredUnites = filtered;

        // Calculer le nombre de pages
        totalPages = Math.max(1, Math.ceil(filteredUnites.length / itemsPerPage));

        // Ajuster la page courante si nécessaire
        if (currentPage > totalPages) {
            currentPage = totalPages;
        }
    }

    // Chargement des données
    async function loadUnites() {
        try {
            isLoading = true;
            render();

            unites = await api.get('/api/unites-mesure');
            filterUnites();
            isLoading = false;
            render();
        } catch (error) {
            console.error('Erreur lors du chargement:', error);
            showToast({
                message: 'Erreur lors du chargement des unités',
                type: 'error'
            });
            isLoading = false;
            render();
        }
    }

    // Rendu
    function render() {
        container.innerHTML = '';
        container.appendChild(renderHeader());
        container.appendChild(renderSearchBar());

        if (isLoading) {
            const loader = document.createElement('div');
            loader.className = 'flex justify-center py-12';
            loader.appendChild(Spinner({ size: 'lg' }));
            container.appendChild(loader);
        } else {
            const tableCard = renderTable();
            container.appendChild(tableCard);
            if (filteredUnites.length > 0) {
                container.appendChild(renderPagination());
            }
        }

        if (showModal) {
            container.appendChild(renderModal());
        }
    }

    // Initialisation
    loadUnites();
    render();

    return container;
}
