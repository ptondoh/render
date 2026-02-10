/**
 * Page d'administration des départements
 * CRUD complet réservé aux décideurs
 */

import auth from '../modules/auth.js';
import api from '../modules/api.js';
import { Card, Button, Input, Modal, showToast, Spinner, Badge } from '../modules/ui.js';

export default function AdminDepartementsPage() {
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
    let departements = [];
    let filteredDepartements = [];
    let searchTerm = '';
    let editingDepartement = null;
    let showModal = false;

    // Tri
    let sortColumn = 'nom';
    let sortDirection = 'asc';

    // Pagination
    let currentPage = 1;
    let itemsPerPage = 10;
    let totalPages = 1;

    // Formulaire
    let formData = {
        code: '',
        nom: '',
        nom_creole: ''
    };

    // Header
    function renderHeader() {
        const header = document.createElement('div');
        header.className = 'flex justify-between items-center mb-6';

        const titleDiv = document.createElement('div');
        const title = document.createElement('h1');
        title.className = 'text-3xl font-bold text-gray-900';
        title.textContent = 'Départements';

        const subtitle = document.createElement('p');
        subtitle.className = 'text-gray-600 mt-1';
        subtitle.textContent = 'Gestion des départements d\'Haïti';

        titleDiv.appendChild(title);
        titleDiv.appendChild(subtitle);

        const addButton = Button({
            text: '+ Ajouter un département',
            variant: 'primary',
            onClick: () => {
                editingDepartement = null;
                formData = { code: '', nom: '', nom_creole: '' };
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
        searchInput.placeholder = 'Rechercher un département par nom ou code...';
        searchInput.className = 'w-full md:w-96 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
        searchInput.value = searchTerm;
        searchInput.addEventListener('input', (e) => {
            const inputElement = e.target;
            const cursorPosition = inputElement.selectionStart;
            searchTerm = inputElement.value;
            currentPage = 1;
            filterDepartements();
            render();

            // Restaurer le focus et la position du curseur
            requestAnimationFrame(() => {
                const newSearchInput = container.querySelector('input[type="text"][placeholder*="Rechercher"]');
                if (newSearchInput) {
                    newSearchInput.focus();
                    newSearchInput.setSelectionRange(cursorPosition, cursorPosition);
                }
            });
        });

        searchBar.appendChild(searchInput);
        return searchBar;
    }

    // Filtrer les départements
    function filterDepartements() {
        let filtered;
        if (!searchTerm) {
            filtered = departements;
        } else {
            const term = searchTerm.toLowerCase();
            filtered = departements.filter(dept =>
                dept.nom.toLowerCase().includes(term) ||
                dept.code.toLowerCase().includes(term) ||
                (dept.nom_creole && dept.nom_creole.toLowerCase().includes(term))
            );
        }

        // Tri dynamique
        filtered.sort((a, b) => {
            let aVal, bVal;

            switch(sortColumn) {
                case 'code':
                    aVal = a.code || '';
                    bVal = b.code || '';
                    break;
                case 'nom':
                    aVal = a.nom || '';
                    bVal = b.nom || '';
                    break;
                case 'communes':
                    aVal = a.nombre_communes || 0;
                    bVal = b.nombre_communes || 0;
                    return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
                default:
                    aVal = a.nom || '';
                    bVal = b.nom || '';
            }

            const comparison = aVal.toString().localeCompare(bVal.toString());
            return sortDirection === 'asc' ? comparison : -comparison;
        });

        filteredDepartements = filtered;
        totalPages = Math.ceil(filteredDepartements.length / itemsPerPage);
    }

    function handleSort(column) {
        if (sortColumn === column) {
            sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            sortColumn = column;
            sortDirection = 'asc';
        }
        filterDepartements();
        render();
    }

    // Liste des départements
    function renderTable() {
        const card = Card({
            title: `${filteredDepartements.length} département(s)`,
            children: renderTableContent()
        });
        return card;
    }

    function renderTableContent() {
        const div = document.createElement('div');

        if (isLoading) {
            div.appendChild(Spinner());
            return div;
        }

        if (filteredDepartements.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'text-center text-gray-500 py-8';
            empty.textContent = searchTerm
                ? 'Aucun département trouvé pour cette recherche.'
                : 'Aucun département disponible.';
            div.appendChild(empty);
            return div;
        }

        // Table
        const tableWrapper = document.createElement('div');
        tableWrapper.className = 'overflow-x-auto';

        const table = document.createElement('table');
        table.className = 'min-w-full divide-y divide-gray-200';

        // En-tête avec tri
        const thead = document.createElement('thead');
        thead.className = 'bg-gray-50';
        const headerRow = document.createElement('tr');

        const createSortableHeader = (text, column) => {
            const th = document.createElement('th');
            th.className = 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none';
            th.onclick = () => handleSort(column);
            const content = document.createElement('div');
            content.className = 'flex items-center gap-1';
            const textSpan = document.createElement('span');
            textSpan.textContent = text;
            content.appendChild(textSpan);
            if (sortColumn === column) {
                const arrow = document.createElement('span');
                arrow.textContent = sortDirection === 'asc' ? '↑' : '↓';
                arrow.className = 'text-blue-600 font-bold';
                content.appendChild(arrow);
            }
            th.appendChild(content);
            return th;
        };

        headerRow.appendChild(createSortableHeader('Code', 'code'));
        headerRow.appendChild(createSortableHeader('Nom', 'nom'));

        const nomCreoleTh = document.createElement('th');
        nomCreoleTh.className = 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider';
        nomCreoleTh.textContent = 'Nom Créole';
        headerRow.appendChild(nomCreoleTh);

        headerRow.appendChild(createSortableHeader('Communes', 'communes'));

        const actionsTh = document.createElement('th');
        actionsTh.className = 'px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider';
        actionsTh.textContent = 'Actions';
        headerRow.appendChild(actionsTh);

        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Corps
        const tbody = document.createElement('tbody');
        tbody.className = 'bg-white divide-y divide-gray-200';

        // Pagination
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const paginatedDepartements = filteredDepartements.slice(startIndex, endIndex);

        paginatedDepartements.forEach(dept => {
            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-50';

            // Code
            const codeCell = document.createElement('td');
            codeCell.className = 'px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900';
            codeCell.textContent = dept.code;
            row.appendChild(codeCell);

            // Nom
            const nomCell = document.createElement('td');
            nomCell.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-900';
            nomCell.textContent = dept.nom;
            row.appendChild(nomCell);

            // Nom Créole
            const nomCreoleCell = document.createElement('td');
            nomCreoleCell.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-600';
            nomCreoleCell.textContent = dept.nom_creole || '-';
            row.appendChild(nomCreoleCell);

            // Communes
            const communesCell = document.createElement('td');
            communesCell.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-600';
            const badge = Badge({
                text: `${dept.nombre_communes || 0} commune(s)`,
                variant: dept.nombre_communes > 0 ? 'primary' : 'gray'
            });
            communesCell.appendChild(badge);
            row.appendChild(communesCell);

            // Actions
            const actionsCell = document.createElement('td');
            actionsCell.className = 'px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2';

            const editBtn = Button({
                text: 'Modifier',
                variant: 'secondary',
                size: 'sm',
                onClick: () => handleEdit(dept)
            });

            const deleteBtn = Button({
                text: 'Supprimer',
                variant: 'danger',
                size: 'sm',
                onClick: () => handleDelete(dept)
            });

            actionsCell.appendChild(editBtn);
            actionsCell.appendChild(deleteBtn);
            row.appendChild(actionsCell);

            tbody.appendChild(row);
        });

        table.appendChild(tbody);
        tableWrapper.appendChild(table);
        div.appendChild(tableWrapper);

        // Pagination
        div.appendChild(renderPagination());

        return div;
    }

    // Pagination
    function renderPagination() {
        const paginationDiv = document.createElement('div');
        paginationDiv.className = 'mt-4 flex items-center justify-between border-t border-gray-200 pt-4';

        // Info
        const info = document.createElement('div');
        info.className = 'text-sm text-gray-700';
        const startIndex = (currentPage - 1) * itemsPerPage + 1;
        const endIndex = Math.min(currentPage * itemsPerPage, filteredDepartements.length);
        info.textContent = `Affichage ${startIndex} à ${endIndex} sur ${filteredDepartements.length} résultat(s)`;

        // Contrôles
        const controls = document.createElement('div');
        controls.className = 'flex items-center space-x-4';

        // Items per page
        const perPageDiv = document.createElement('div');
        perPageDiv.className = 'flex items-center space-x-2';

        const perPageLabel = document.createElement('label');
        perPageLabel.className = 'text-sm text-gray-700';
        perPageLabel.textContent = 'Par page:';

        const perPageSelect = document.createElement('select');
        perPageSelect.className = 'border border-gray-300 rounded px-2 py-1 text-sm';
        perPageSelect.innerHTML = `
            <option value="5">5</option>
            <option value="10" selected>10</option>
            <option value="20">20</option>
            <option value="50">50</option>
        `;
        perPageSelect.value = itemsPerPage;
        perPageSelect.addEventListener('change', (e) => {
            itemsPerPage = parseInt(e.target.value);
            currentPage = 1;
            filterDepartements();
            render();
        });

        perPageDiv.appendChild(perPageLabel);
        perPageDiv.appendChild(perPageSelect);

        // Boutons
        const buttonsDiv = document.createElement('div');
        buttonsDiv.className = 'flex space-x-2';

        const prevBtn = Button({
            text: '← Précédent',
            variant: 'secondary',
            size: 'sm',
            disabled: currentPage === 1,
            onClick: () => {
                currentPage--;
                render();
            }
        });

        const nextBtn = Button({
            text: 'Suivant →',
            variant: 'secondary',
            size: 'sm',
            disabled: currentPage >= totalPages,
            onClick: () => {
                currentPage++;
                render();
            }
        });

        buttonsDiv.appendChild(prevBtn);
        buttonsDiv.appendChild(nextBtn);

        controls.appendChild(perPageDiv);
        controls.appendChild(buttonsDiv);

        paginationDiv.appendChild(info);
        paginationDiv.appendChild(controls);

        return paginationDiv;
    }

    // Modal de formulaire
    function renderModal() {
        if (!showModal) return document.createElement('div');

        const modalContent = document.createElement('div');
        modalContent.className = 'space-y-4';

        // Code
        const codeInput = Input({
            label: 'Code',
            placeholder: 'Ex: HT-OU',
            value: formData.code,
            required: true,
            onChange: (value) => { formData.code = value; }
        });

        // Nom
        const nomInput = Input({
            label: 'Nom',
            placeholder: 'Ex: Ouest',
            value: formData.nom,
            required: true,
            onChange: (value) => { formData.nom = value; }
        });

        // Nom Créole
        const nomCreoleInput = Input({
            label: 'Nom Créole',
            placeholder: 'Ex: Lwès',
            value: formData.nom_creole || '',
            onChange: (value) => { formData.nom_creole = value; }
        });

        modalContent.appendChild(codeInput);
        modalContent.appendChild(nomInput);
        modalContent.appendChild(nomCreoleInput);

        // Actions
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'flex justify-end space-x-3 mt-6';

        const cancelBtn = Button({
            text: 'Annuler',
            variant: 'secondary',
            onClick: () => {
                showModal = false;
                render();
            }
        });

        const saveBtn = Button({
            text: editingDepartement ? 'Mettre à jour' : 'Créer',
            variant: 'primary',
            onClick: handleSave
        });

        actionsDiv.appendChild(cancelBtn);
        actionsDiv.appendChild(saveBtn);
        modalContent.appendChild(actionsDiv);

        return Modal({
            title: editingDepartement ? 'Modifier le département' : 'Nouveau département',
            isOpen: true,
            onClose: () => {
                showModal = false;
                render();
            },
            children: modalContent
        });
    }

    // Gestion événements
    async function handleEdit(dept) {
        editingDepartement = dept;
        formData = {
            code: dept.code,
            nom: dept.nom,
            nom_creole: dept.nom_creole || ''
        };
        showModal = true;
        render();
    }

    async function handleDelete(dept) {
        if (dept.nombre_communes > 0) {
            showToast(
                `Impossible de supprimer : ${dept.nombre_communes} commune(s) sont liées à ce département`,
                'error'
            );
            return;
        }

        if (!confirm(`Êtes-vous sûr de vouloir supprimer le département "${dept.nom}" ?`)) {
            return;
        }

        try {
            await api.delete(`/api/departements/${dept.id}`);
            showToast('Département supprimé avec succès', 'success');
            await loadDepartements();
        } catch (error) {
            showToast(error.message || 'Erreur lors de la suppression', 'error');
        }
    }

    async function handleSave() {
        // Validation
        if (!formData.code || !formData.nom) {
            showToast('Veuillez remplir tous les champs obligatoires', 'error');
            return;
        }

        try {
            if (editingDepartement) {
                // Mise à jour
                await api.put(`/api/departements/${editingDepartement.id}`, formData);
                showToast('Département mis à jour avec succès', 'success');
            } else {
                // Création
                await api.post('/api/departements', formData);
                showToast('Département créé avec succès', 'success');
            }

            showModal = false;
            await loadDepartements();
        } catch (error) {
            showToast(error.message || 'Erreur lors de la sauvegarde', 'error');
        }
    }

    // Chargement des données
    async function loadDepartements() {
        isLoading = true;
        render();

        try {
            const response = await api.get('/api/departements');
            departements = response;
            filterDepartements();
        } catch (error) {
            showToast(error.message || 'Erreur lors du chargement des départements', 'error');
            departements = [];
            filteredDepartements = [];
        } finally {
            isLoading = false;
            render();
        }
    }

    // Rendu principal
    function render() {
        container.innerHTML = '';
        container.appendChild(renderHeader());
        container.appendChild(renderSearchBar());
        container.appendChild(renderTable());
        container.appendChild(renderModal());
    }

    // Initialisation
    loadDepartements();

    return container;
}
