/**
 * Page d'administration des produits - Version améliorée
 * CRUD complet avec pagination et recherche avancée
 */

import auth from '../modules/auth.js';
import api from '../modules/api.js';
import { Card, Button, Modal, showToast, Spinner, Badge } from '../modules/ui.js';

export default function AdminProduitsPage() {
    const container = document.createElement('div');
    container.className = 'space-y-6';

    const isBailleur = auth.hasRole('bailleur');

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
    let produits = [];
    let categories = [];
    let unites = [];
    let filteredProduits = [];
    let searchTerm = '';
    let selectedCategorie = '';
    let editingProduit = null;
    let showModal = false;

    // Pagination
    let currentPage = 1;
    let itemsPerPage = 10;
    let totalPages = 1;

    // Formulaire
    let formData = {
        nom: '',
        nom_creole: '',
        code: '',
        id_categorie: '',
        id_unite_mesure: '',
        description: ''
    };

    // Header
    function renderHeader() {
        const header = document.createElement('div');
        header.className = 'flex justify-between items-center mb-6';

        const titleDiv = document.createElement('div');
        const title = document.createElement('h1');
        title.className = 'text-3xl font-bold text-gray-900';
        title.textContent = 'Produits';

        const subtitle = document.createElement('p');
        subtitle.className = 'text-gray-600 mt-1';
        subtitle.textContent = `${filteredProduits.length} produit(s)`;

        titleDiv.appendChild(title);
        titleDiv.appendChild(subtitle);

        const addButton = Button({
            text: '+ Ajouter un produit',
            variant: 'primary',
            onClick: () => {
                editingProduit = null;
                formData = {
                    nom: '',
                    nom_creole: '',
                    code: '',
                    id_categorie: '',
                    id_unite_mesure: '',
                    description: ''
                };
                showModal = true;
                render();
            }
        });

        header.appendChild(titleDiv);
        header.appendChild(addButton);

        return header;
    }

    // Filtres et recherche
    function renderFilters() {
        const filtersDiv = document.createElement('div');
        filtersDiv.className = 'mb-6 flex flex-wrap gap-4';

        // Recherche par nom
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'Rechercher par nom ou code...';
        searchInput.className = 'flex-1 min-w-64 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
        searchInput.value = searchTerm;
        searchInput.addEventListener('input', (e) => {
            searchTerm = e.target.value;
            currentPage = 1;
            filterProduits();
            render();
        });

        // Filtre par catégorie
        const catSelect = document.createElement('select');
        catSelect.className = 'px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
        catSelect.innerHTML = '<option value="">Toutes les catégories</option>';
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = cat.nom;
            option.selected = selectedCategorie === cat.id;
            catSelect.appendChild(option);
        });
        catSelect.addEventListener('change', (e) => {
            selectedCategorie = e.target.value;
            currentPage = 1;
            filterProduits();
            render();
        });

        filtersDiv.appendChild(searchInput);
        filtersDiv.appendChild(catSelect);

        return filtersDiv;
    }

    // Pagination
    function renderPagination() {
        const paginationDiv = document.createElement('div');
        paginationDiv.className = 'flex items-center justify-between mt-4';

        // Sélecteur de taille de page
        const sizeDiv = document.createElement('div');
        sizeDiv.className = 'flex items-center gap-2';

        const sizeLabel = document.createElement('span');
        sizeLabel.className = 'text-sm text-gray-700';
        sizeLabel.textContent = 'Éléments par page:';

        const sizeSelect = document.createElement('select');
        sizeSelect.className = 'px-3 py-1 border border-gray-300 rounded-lg text-sm';
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
            render();
        });

        sizeDiv.appendChild(sizeLabel);
        sizeDiv.appendChild(sizeSelect);

        // Info pagination
        const infoDiv = document.createElement('div');
        infoDiv.className = 'text-sm text-gray-700';
        const start = (currentPage - 1) * itemsPerPage + 1;
        const end = Math.min(currentPage * itemsPerPage, filteredProduits.length);
        infoDiv.textContent = `${start}-${end} sur ${filteredProduits.length}`;

        // Boutons de navigation
        const buttonsDiv = document.createElement('div');
        buttonsDiv.className = 'flex gap-2';

        const prevBtn = Button({
            text: '← Précédent',
            variant: 'secondary',
            size: 'sm',
            disabled: currentPage === 1,
            onClick: () => {
                if (currentPage > 1) {
                    currentPage--;
                    render();
                }
            }
        });

        const nextBtn = Button({
            text: 'Suivant →',
            variant: 'secondary',
            size: 'sm',
            disabled: currentPage === totalPages,
            onClick: () => {
                if (currentPage < totalPages) {
                    currentPage++;
                    render();
                }
            }
        });

        buttonsDiv.appendChild(prevBtn);
        buttonsDiv.appendChild(nextBtn);

        paginationDiv.appendChild(sizeDiv);
        paginationDiv.appendChild(infoDiv);
        paginationDiv.appendChild(buttonsDiv);

        return paginationDiv;
    }

    // Tableau
    function renderTable() {
        // Calculer pagination
        totalPages = Math.ceil(filteredProduits.length / itemsPerPage);
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const paginatedProduits = filteredProduits.slice(startIndex, endIndex);

        const card = Card({
            children: [
                (() => {
                    const wrapper = document.createElement('div');
                    wrapper.className = 'overflow-x-auto';

                    if (paginatedProduits.length === 0) {
                        const empty = document.createElement('div');
                        empty.className = 'text-center py-12';
                        empty.innerHTML = `
                            <p class="text-gray-500">
                                ${searchTerm || selectedCategorie ? 'Aucun produit trouvé' : 'Aucun produit'}
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
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Catégorie</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unité</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    `;
                    table.appendChild(thead);

                    // Body
                    const tbody = document.createElement('tbody');
                    tbody.className = 'bg-white divide-y divide-gray-200';

                    paginatedProduits.forEach(produit => {
                        const row = document.createElement('tr');
                        row.className = 'hover:bg-gray-50';

                        // Code
                        const codeCell = document.createElement('td');
                        codeCell.className = 'px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900';
                        codeCell.textContent = produit.code;
                        row.appendChild(codeCell);

                        // Nom
                        const nomCell = document.createElement('td');
                        nomCell.className = 'px-6 py-4';
                        const nomDiv = document.createElement('div');
                        const nomText = document.createElement('div');
                        nomText.className = 'text-sm font-medium text-gray-900';
                        nomText.textContent = produit.nom;
                        nomDiv.appendChild(nomText);
                        if (produit.nom_creole) {
                            const creoleText = document.createElement('div');
                            creoleText.className = 'text-sm text-gray-500';
                            creoleText.textContent = produit.nom_creole;
                            nomDiv.appendChild(creoleText);
                        }
                        nomCell.appendChild(nomDiv);
                        row.appendChild(nomCell);

                        // Catégorie
                        const catCell = document.createElement('td');
                        catCell.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-900';
                        catCell.textContent = produit.categorie_nom || '-';
                        row.appendChild(catCell);

                        // Unité
                        const uniteCell = document.createElement('td');
                        uniteCell.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-900';
                        uniteCell.textContent = produit.unite_nom || '-';
                        row.appendChild(uniteCell);

                        // Statut
                        const statutCell = document.createElement('td');
                        statutCell.className = 'px-6 py-4 whitespace-nowrap';
                        const statutBadge = Badge({
                            text: produit.actif ? 'Actif' : 'Inactif',
                            variant: produit.actif ? 'success' : 'default'
                        });
                        statutCell.appendChild(statutBadge);
                        row.appendChild(statutCell);

                        // Actions
                        const actionsCell = document.createElement('td');
                        actionsCell.className = 'px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2';

                        const editBtn = Button({
                            text: 'Modifier',
                            variant: 'secondary',
                            className: 'text-sm',
                            onClick: () => handleEdit(produit)
                        });

                        const deleteBtn = Button({
                            text: 'Supprimer',
                            variant: 'danger',
                            className: 'text-sm',
                            onClick: () => handleDelete(produit)
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

    // Modal (identique à la version précédente mais avec meilleure gestion d'erreurs)
    function renderModal() {
        if (!showModal) return document.createElement('div');

        const modalContent = document.createElement('div');
        modalContent.className = 'space-y-4';

        const title = document.createElement('h2');
        title.className = 'text-xl font-bold text-gray-900 mb-4';
        title.textContent = editingProduit ? 'Modifier le produit' : 'Ajouter un produit';
        modalContent.appendChild(title);

        // Première ligne: Code et Nom
        const firstRow = document.createElement('div');
        firstRow.className = 'grid grid-cols-2 gap-4';

        // Code
        const codeGroup = document.createElement('div');
        const codeLabel = document.createElement('label');
        codeLabel.className = 'block text-sm font-medium text-gray-700 mb-1';
        codeLabel.innerHTML = '<span class="text-red-500">*</span> Code produit';
        const codeInput = document.createElement('input');
        codeInput.type = 'text';
        codeInput.required = true;
        codeInput.placeholder = 'PROD-RIZ';
        codeInput.className = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
        codeInput.value = formData.code;
        codeInput.addEventListener('input', (e) => { formData.code = e.target.value; });
        codeGroup.appendChild(codeLabel);
        codeGroup.appendChild(codeInput);

        // Nom
        const nomGroup = document.createElement('div');
        const nomLabel = document.createElement('label');
        nomLabel.className = 'block text-sm font-medium text-gray-700 mb-1';
        nomLabel.innerHTML = '<span class="text-red-500">*</span> Nom du produit';
        const nomInput = document.createElement('input');
        nomInput.type = 'text';
        nomInput.required = true;
        nomInput.placeholder = 'Riz local';
        nomInput.className = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
        nomInput.value = formData.nom;
        nomInput.addEventListener('input', (e) => { formData.nom = e.target.value; });
        nomGroup.appendChild(nomLabel);
        nomGroup.appendChild(nomInput);

        firstRow.appendChild(codeGroup);
        firstRow.appendChild(nomGroup);
        modalContent.appendChild(firstRow);

        // Nom Créole
        const creoleGroup = document.createElement('div');
        const creoleLabel = document.createElement('label');
        creoleLabel.className = 'block text-sm font-medium text-gray-700 mb-1';
        creoleLabel.textContent = 'Nom en créole (optionnel)';
        const creoleInput = document.createElement('input');
        creoleInput.type = 'text';
        creoleInput.placeholder = 'Nom en créole...';
        creoleInput.className = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
        creoleInput.value = formData.nom_creole;
        creoleInput.addEventListener('input', (e) => { formData.nom_creole = e.target.value; });
        creoleGroup.appendChild(creoleLabel);
        creoleGroup.appendChild(creoleInput);
        modalContent.appendChild(creoleGroup);

        // Deuxième ligne: Catégorie et Unité
        const secondRow = document.createElement('div');
        secondRow.className = 'grid grid-cols-2 gap-4';

        // Catégorie
        const catGroup = document.createElement('div');
        const catLabel = document.createElement('label');
        catLabel.className = 'block text-sm font-medium text-gray-700 mb-1';
        catLabel.innerHTML = '<span class="text-red-500">*</span> Catégorie';
        const catSelect = document.createElement('select');
        catSelect.required = true;
        catSelect.className = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
        catSelect.innerHTML = '<option value="">Sélectionner...</option>';
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = cat.nom;
            option.selected = formData.id_categorie === cat.id;
            catSelect.appendChild(option);
        });
        catSelect.addEventListener('change', (e) => { formData.id_categorie = e.target.value; });
        catGroup.appendChild(catLabel);
        catGroup.appendChild(catSelect);

        // Unité
        const uniteGroup = document.createElement('div');
        const uniteLabel = document.createElement('label');
        uniteLabel.className = 'block text-sm font-medium text-gray-700 mb-1';
        uniteLabel.innerHTML = '<span class="text-red-500">*</span> Unité de mesure';
        const uniteSelect = document.createElement('select');
        uniteSelect.required = true;
        uniteSelect.className = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
        uniteSelect.innerHTML = '<option value="">Sélectionner...</option>';
        unites.forEach(unite => {
            const option = document.createElement('option');
            option.value = unite.id;
            option.textContent = `${unite.unite}${unite.description ? ' (' + unite.description + ')' : ''}`;
            option.selected = formData.id_unite_mesure === unite.id;
            uniteSelect.appendChild(option);
        });
        uniteSelect.addEventListener('change', (e) => { formData.id_unite_mesure = e.target.value; });
        uniteGroup.appendChild(uniteLabel);
        uniteGroup.appendChild(uniteSelect);

        secondRow.appendChild(catGroup);
        secondRow.appendChild(uniteGroup);
        modalContent.appendChild(secondRow);

        // Description
        const descGroup = document.createElement('div');
        const descLabel = document.createElement('label');
        descLabel.className = 'block text-sm font-medium text-gray-700 mb-1';
        descLabel.textContent = 'Description (optionnel)';
        const descInput = document.createElement('textarea');
        descInput.rows = 3;
        descInput.placeholder = 'Description...';
        descInput.className = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
        descInput.value = formData.description;
        descInput.addEventListener('input', (e) => { formData.description = e.target.value; });
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
            text: editingProduit ? 'Enregistrer' : 'Créer',
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
    function handleEdit(produit) {
        editingProduit = produit;
        formData = {
            nom: produit.nom,
            nom_creole: produit.nom_creole || '',
            code: produit.code,
            id_categorie: produit.id_categorie,
            id_unite_mesure: produit.id_unite_mesure,
            description: produit.description || ''
        };
        showModal = true;
        render();
    }

    async function handleDelete(produit) {
        if (!confirm(`Êtes-vous sûr de vouloir supprimer le produit "${produit.nom}" ?`)) {
            return;
        }

        try {
            const result = await api.delete(`/api/produits/${produit.id}`);
            showToast({
                message: result.message || 'Produit supprimé avec succès',
                type: 'success'
            });
            await loadProduits();
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
            showToast({ message: 'Le nom du produit est obligatoire', type: 'error' });
            return;
        }
        if (!formData.code.trim()) {
            showToast({ message: 'Le code du produit est obligatoire', type: 'error' });
            return;
        }
        if (!formData.id_categorie) {
            showToast({ message: 'La catégorie est obligatoire', type: 'error' });
            return;
        }
        if (!formData.id_unite_mesure) {
            showToast({ message: 'L\'unité de mesure est obligatoire', type: 'error' });
            return;
        }

        try {
            if (editingProduit) {
                await api.put(`/api/produits/${editingProduit.id}`, formData);
                showToast({ message: 'Produit modifié avec succès', type: 'success' });
            } else {
                await api.post('/api/produits', formData);
                showToast({ message: 'Produit créé avec succès', type: 'success' });
            }

            showModal = false;
            await loadProduits();
        } catch (error) {
            showToast({
                message: error.message || 'Erreur lors de l\'enregistrement',
                type: 'error'
            });
        }
    }

    function filterProduits() {
        let filtered = [...produits];

        // Filtre par catégorie
        if (selectedCategorie) {
            filtered = filtered.filter(p => p.id_categorie === selectedCategorie);
        }

        // Filtre par recherche
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(p =>
                p.nom.toLowerCase().includes(term) ||
                p.code.toLowerCase().includes(term) ||
                (p.nom_creole && p.nom_creole.toLowerCase().includes(term)) ||
                (p.categorie_nom && p.categorie_nom.toLowerCase().includes(term))
            );
        }

        // Tri alphabétique par nom
        filtered.sort((a, b) => a.nom.localeCompare(b.nom));

        filteredProduits = filtered;
    }

    async function loadProduits() {
        try {
            isLoading = true;
            render();

            const [produitsData, categoriesData, unitesData] = await Promise.all([
                api.get('/api/produits?actif=true'),
                api.get('/api/categories-produit'),
                api.get('/api/unites-mesure')
            ]);

            categories = categoriesData;
            unites = unitesData;

            // Enrichir les produits avec les noms de catégories et unités
            produits = produitsData.map(p => {
                const categorie = categories.find(c => c.id === p.id_categorie);
                const unite = unites.find(u => u.id === p.id_unite_mesure);
                return {
                    ...p,
                    categorie_nom: categorie ? categorie.nom : null,
                    unite_nom: unite ? unite.unite : null
                };
            });

            filterProduits();
            isLoading = false;
            render();
        } catch (error) {
            console.error('Erreur:', error);
            showToast({ message: 'Erreur lors du chargement', type: 'error' });
            isLoading = false;
            render();
        }
    }

    function render() {
        container.innerHTML = '';
        container.appendChild(renderHeader());
        container.appendChild(renderFilters());

        if (isLoading) {
            const loader = document.createElement('div');
            loader.className = 'flex justify-center py-12';
            loader.appendChild(Spinner({ size: 'lg' }));
            container.appendChild(loader);
        } else {
            container.appendChild(renderTable());
            if (filteredProduits.length > 0) {
                container.appendChild(renderPagination());
            }
        }

        if (showModal) {
            container.appendChild(renderModal());
        }
    }

    loadProduits();
    render();

    return container;
}
