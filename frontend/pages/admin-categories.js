/**
 * Page d'administration des catégories de produits
 * CRUD complet réservé aux décideurs
 */

import auth from '../modules/auth.js';
import api from '../modules/api.js';
import { Card, Button, Input, Modal, showToast, Spinner, Badge } from '../modules/ui.js';

export default function AdminCategoriesPage() {
    const container = document.createElement('div');
    container.className = 'space-y-6';

    const user = auth.getCurrentUser();
    const isDecideur = auth.hasRole('décideur');

    // Vérifier les permissions
    if (!isDecideur) {
        const unauthorized = document.createElement('div');
        unauthorized.className = 'text-center py-12';
        unauthorized.innerHTML = `
            <h2 class="text-2xl font-bold text-red-600 mb-2">Accès non autorisé</h2>
            <p class="text-gray-600">Cette page est réservée aux décideurs.</p>
        `;
        container.appendChild(unauthorized);
        return container;
    }

    // État
    let isLoading = true;
    let categories = [];
    let filteredCategories = [];
    let searchTerm = '';
    let editingCategorie = null;
    let showModal = false;

    // Pagination
    let currentPage = 1;
    let itemsPerPage = 10;
    let totalPages = 1;

    // Formulaire
    let formData = {
        nom: '',
        nom_creole: '',
        description: ''
    };

    // Header
    function renderHeader() {
        const header = document.createElement('div');
        header.className = 'flex justify-between items-center mb-6';

        const titleDiv = document.createElement('div');
        const title = document.createElement('h1');
        title.className = 'text-3xl font-bold text-gray-900';
        title.textContent = 'Catégories de Produits';

        const subtitle = document.createElement('p');
        subtitle.className = 'text-gray-600 mt-1';
        subtitle.textContent = 'Gestion des catégories de produits';

        titleDiv.appendChild(title);
        titleDiv.appendChild(subtitle);

        const addButton = Button({
            text: '+ Ajouter une catégorie',
            variant: 'primary',
            onClick: () => {
                editingCategorie = null;
                formData = { nom: '', nom_creole: '', description: '' };
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
        searchInput.placeholder = 'Rechercher une catégorie...';
        searchInput.className = 'w-full md:w-96 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
        searchInput.value = searchTerm;
        searchInput.addEventListener('input', (e) => {
            searchTerm = e.target.value;
            currentPage = 1; // Reset to first page
            filterCategories();
            render();
        });

        searchBar.appendChild(searchInput);
        return searchBar;
    }

    // Tableau des catégories
    function renderTable() {
        const card = Card({
            children: [
                (() => {
                    const wrapper = document.createElement('div');
                    wrapper.className = 'overflow-x-auto';

                    if (filteredCategories.length === 0) {
                        const empty = document.createElement('div');
                        empty.className = 'text-center py-12';
                        empty.innerHTML = `
                            <p class="text-gray-500">
                                ${searchTerm ? 'Aucune catégorie trouvée' : 'Aucune catégorie de produit'}
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
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom Créole</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
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
                    const pageItems = filteredCategories.slice(startIndex, endIndex);

                    pageItems.forEach(categorie => {
                        const row = document.createElement('tr');
                        row.className = 'hover:bg-gray-50';

                        // Nom
                        const nomCell = document.createElement('td');
                        nomCell.className = 'px-6 py-4 whitespace-nowrap';
                        const nomBadge = Badge({
                            text: categorie.nom,
                            variant: 'primary'
                        });
                        nomCell.appendChild(nomBadge);
                        row.appendChild(nomCell);

                        // Nom Créole
                        const creoleCell = document.createElement('td');
                        creoleCell.className = 'px-6 py-4 text-sm text-gray-900';
                        creoleCell.textContent = categorie.nom_creole || '-';
                        row.appendChild(creoleCell);

                        // Description
                        const descCell = document.createElement('td');
                        descCell.className = 'px-6 py-4 text-sm text-gray-900';
                        descCell.textContent = categorie.description || '-';
                        row.appendChild(descCell);

                        // Actions
                        const actionsCell = document.createElement('td');
                        actionsCell.className = 'px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2';

                        const editBtn = Button({
                            text: 'Modifier',
                            variant: 'secondary',
                            className: 'text-sm',
                            onClick: () => handleEdit(categorie)
                        });

                        const deleteBtn = Button({
                            text: 'Supprimer',
                            variant: 'danger',
                            className: 'text-sm',
                            onClick: () => handleDelete(categorie)
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

    // Contrôles de pagination
    function renderPagination() {
        if (filteredCategories.length === 0) {
            return document.createElement('div');
        }

        const paginationDiv = document.createElement('div');
        paginationDiv.className = 'mt-6 flex items-center justify-between border-t border-gray-200 pt-4';

        // Info et sélecteur de taille de page
        const leftDiv = document.createElement('div');
        leftDiv.className = 'flex items-center space-x-4';

        const info = document.createElement('p');
        info.className = 'text-sm text-gray-700';
        const startIndex = (currentPage - 1) * itemsPerPage + 1;
        const endIndex = Math.min(currentPage * itemsPerPage, filteredCategories.length);
        info.textContent = `${startIndex}-${endIndex} sur ${filteredCategories.length}`;

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
            filterCategories();
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

    // Modal de création/édition
    function renderModal() {
        if (!showModal) return document.createElement('div');

        const modalContent = document.createElement('div');
        modalContent.className = 'space-y-4';

        const title = document.createElement('h2');
        title.className = 'text-xl font-bold text-gray-900 mb-4';
        title.textContent = editingCategorie ? 'Modifier la catégorie' : 'Ajouter une catégorie';
        modalContent.appendChild(title);

        // Champ Nom
        const nomGroup = document.createElement('div');
        const nomLabel = document.createElement('label');
        nomLabel.className = 'block text-sm font-medium text-gray-700 mb-1';
        nomLabel.innerHTML = '<span class="text-red-500">*</span> Nom de la catégorie';

        const nomInput = document.createElement('input');
        nomInput.type = 'text';
        nomInput.required = true;
        nomInput.placeholder = 'Céréales, Légumes, Fruits...';
        nomInput.className = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
        nomInput.value = formData.nom;
        nomInput.addEventListener('input', (e) => {
            formData.nom = e.target.value;
        });

        nomGroup.appendChild(nomLabel);
        nomGroup.appendChild(nomInput);
        modalContent.appendChild(nomGroup);

        // Champ Nom Créole
        const creoleGroup = document.createElement('div');
        const creoleLabel = document.createElement('label');
        creoleLabel.className = 'block text-sm font-medium text-gray-700 mb-1';
        creoleLabel.textContent = 'Nom en créole (optionnel)';

        const creoleInput = document.createElement('input');
        creoleInput.type = 'text';
        creoleInput.placeholder = 'Nom en créole haïtien...';
        creoleInput.className = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
        creoleInput.value = formData.nom_creole;
        creoleInput.addEventListener('input', (e) => {
            formData.nom_creole = e.target.value;
        });

        creoleGroup.appendChild(creoleLabel);
        creoleGroup.appendChild(creoleInput);
        modalContent.appendChild(creoleGroup);

        // Champ Description
        const descGroup = document.createElement('div');
        const descLabel = document.createElement('label');
        descLabel.className = 'block text-sm font-medium text-gray-700 mb-1';
        descLabel.textContent = 'Description (optionnel)';

        const descInput = document.createElement('textarea');
        descInput.rows = 3;
        descInput.placeholder = 'Description de la catégorie...';
        descInput.className = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
        descInput.value = formData.description;
        descInput.addEventListener('input', (e) => {
            formData.description = e.target.value;
        });

        descGroup.appendChild(descLabel);
        descGroup.appendChild(descInput);
        modalContent.appendChild(descGroup);

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
            text: editingCategorie ? 'Enregistrer' : 'Créer',
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
    function handleEdit(categorie) {
        editingCategorie = categorie;
        formData = {
            nom: categorie.nom,
            nom_creole: categorie.nom_creole || '',
            description: categorie.description || ''
        };
        showModal = true;
        render();
    }

    async function handleDelete(categorie) {
        if (!confirm(`Êtes-vous sûr de vouloir supprimer la catégorie "${categorie.nom}" ?`)) {
            return;
        }

        try {
            await api.delete(`/api/categories-produit/${categorie.id}`);
            showToast({
                message: 'Catégorie supprimée avec succès',
                type: 'success'
            });
            await loadCategories();
        } catch (error) {
            showToast({
                message: error.message || 'Erreur lors de la suppression',
                type: 'error'
            });
        }
    }

    async function handleSave() {
        // Validation
        if (!formData.nom.trim()) {
            showToast({
                message: 'Le nom de la catégorie est obligatoire',
                type: 'error'
            });
            return;
        }

        try {
            if (editingCategorie) {
                // Mise à jour
                await api.put(`/api/categories-produit/${editingCategorie.id}`, formData);
                showToast({
                    message: 'Catégorie modifiée avec succès',
                    type: 'success'
                });
            } else {
                // Création
                await api.post('/api/categories-produit', formData);
                showToast({
                    message: 'Catégorie créée avec succès',
                    type: 'success'
                });
            }

            showModal = false;
            await loadCategories();
        } catch (error) {
            showToast({
                message: error.message || 'Erreur lors de l\'enregistrement',
                type: 'error'
            });
        }
    }

    function filterCategories() {
        if (!searchTerm.trim()) {
            filteredCategories = [...categories];
        } else {
            const term = searchTerm.toLowerCase();
            filteredCategories = categories.filter(cat =>
                cat.nom.toLowerCase().includes(term) ||
                (cat.nom_creole && cat.nom_creole.toLowerCase().includes(term)) ||
                (cat.description && cat.description.toLowerCase().includes(term))
            );
        }

        // Calculer le nombre de pages
        totalPages = Math.max(1, Math.ceil(filteredCategories.length / itemsPerPage));

        // Ajuster la page courante si nécessaire
        if (currentPage > totalPages) {
            currentPage = totalPages;
        }
    }

    // Chargement des données
    async function loadCategories() {
        try {
            isLoading = true;
            render();

            categories = await api.get('/api/categories-produit');
            filterCategories();
            isLoading = false;
            render();
        } catch (error) {
            console.error('Erreur lors du chargement:', error);
            showToast({
                message: 'Erreur lors du chargement des catégories',
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
            if (filteredCategories.length > 0) {
                container.appendChild(renderPagination());
            }
        }

        if (showModal) {
            container.appendChild(renderModal());
        }
    }

    // Initialisation
    loadCategories();
    render();

    return container;
}
