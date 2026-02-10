/**
 * Page d'administration des communes
 * CRUD complet réservé aux décideurs
 * Relation: Une commune appartient à un département
 */

import auth from '../modules/auth.js';
import api from '../modules/api.js';
import { Card, Button, Input, Modal, showToast, Spinner, Badge } from '../modules/ui.js';

export default function AdminCommunesPage() {
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
    let communes = [];
    let departements = [];
    let filteredCommunes = [];
    let searchTerm = '';
    let selectedDepartement = '';
    let editingCommune = null;
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
        nom_creole: '',
        departement_id: '',
        type_zone: 'urbaine',
        population: ''
    };

    // Header
    function renderHeader() {
        const header = document.createElement('div');
        header.className = 'flex justify-between items-center mb-6';

        const titleDiv = document.createElement('div');
        const title = document.createElement('h1');
        title.className = 'text-3xl font-bold text-gray-900';
        title.textContent = 'Communes';

        const subtitle = document.createElement('p');
        subtitle.className = 'text-gray-600 mt-1';
        subtitle.textContent = 'Gestion des communes d\'Haïti';

        titleDiv.appendChild(title);
        titleDiv.appendChild(subtitle);

        const addButton = Button({
            text: '+ Ajouter une commune',
            variant: 'primary',
            onClick: () => {
                editingCommune = null;
                formData = {
                    code: '',
                    nom: '',
                    nom_creole: '',
                    departement_id: '',
                    type_zone: 'urbaine',
                    population: ''
                };
                showModal = true;
                render();
            }
        });

        header.appendChild(titleDiv);
        header.appendChild(addButton);

        return header;
    }

    // Barre de recherche et filtres
    function renderSearchAndFilters() {
        const div = document.createElement('div');
        div.className = 'mb-6 flex flex-col md:flex-row gap-4';

        // Recherche
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'Rechercher une commune par nom ou code...';
        searchInput.className = 'flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
        searchInput.value = searchTerm;
        searchInput.addEventListener('input', (e) => {
            const inputElement = e.target;
            const cursorPosition = inputElement.selectionStart;
            searchTerm = inputElement.value;
            currentPage = 1;
            filterCommunes();
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

        // Filtre département
        const departementSelect = document.createElement('select');
        departementSelect.className = 'px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
        departementSelect.innerHTML = '<option value="">Tous les départements</option>';

        departements.forEach(dept => {
            const option = document.createElement('option');
            option.value = dept.id;
            option.textContent = dept.nom;
            if (dept.id === selectedDepartement) {
                option.selected = true;
            }
            departementSelect.appendChild(option);
        });

        departementSelect.addEventListener('change', (e) => {
            selectedDepartement = e.target.value;
            currentPage = 1;
            filterCommunes();
            render();
        });

        div.appendChild(searchInput);
        div.appendChild(departementSelect);

        return div;
    }

    // Filtrer les communes
    function filterCommunes() {
        let filtered = communes;

        // Filtre par département
        if (selectedDepartement) {
            filtered = filtered.filter(c => c.departement_id === selectedDepartement);
        }

        // Filtre par recherche
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(c =>
                c.nom.toLowerCase().includes(term) ||
                c.code.toLowerCase().includes(term) ||
                (c.nom_creole && c.nom_creole.toLowerCase().includes(term)) ||
                (c.departement_nom && c.departement_nom.toLowerCase().includes(term))
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
                case 'departement':
                    aVal = a.departement_nom || '';
                    bVal = b.departement_nom || '';
                    break;
                case 'population':
                    aVal = a.population || 0;
                    bVal = b.population || 0;
                    return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
                case 'marches':
                    aVal = a.nombre_marches || 0;
                    bVal = b.nombre_marches || 0;
                    return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
                default:
                    aVal = a.nom || '';
                    bVal = b.nom || '';
            }

            const comparison = aVal.toString().localeCompare(bVal.toString());
            return sortDirection === 'asc' ? comparison : -comparison;
        });

        filteredCommunes = filtered;
        totalPages = Math.ceil(filteredCommunes.length / itemsPerPage);
    }

    function handleSort(column) {
        if (sortColumn === column) {
            sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            sortColumn = column;
            sortDirection = 'asc';
        }
        filterCommunes();
        render();
    }

    // Liste des communes
    function renderTable() {
        const card = Card({
            title: `${filteredCommunes.length} commune(s)`,
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

        if (filteredCommunes.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'text-center text-gray-500 py-8';
            empty.textContent = searchTerm || selectedDepartement
                ? 'Aucune commune trouvée pour cette recherche.'
                : 'Aucune commune disponible.';
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

        headerRow.appendChild(createSortableHeader('Département', 'departement'));

        const typeTh = document.createElement('th');
        typeTh.className = 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider';
        typeTh.textContent = 'Type Zone';
        headerRow.appendChild(typeTh);

        headerRow.appendChild(createSortableHeader('Population', 'population'));
        headerRow.appendChild(createSortableHeader('Marchés', 'marches'));

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
        const paginatedCommunes = filteredCommunes.slice(startIndex, endIndex);

        paginatedCommunes.forEach(commune => {
            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-50';

            // Code
            const codeCell = document.createElement('td');
            codeCell.className = 'px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900';
            codeCell.textContent = commune.code;
            row.appendChild(codeCell);

            // Nom
            const nomCell = document.createElement('td');
            nomCell.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-900';
            nomCell.textContent = commune.nom;
            row.appendChild(nomCell);

            // Nom Créole
            const nomCreoleCell = document.createElement('td');
            nomCreoleCell.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-600';
            nomCreoleCell.textContent = commune.nom_creole || '-';
            row.appendChild(nomCreoleCell);

            // Département
            const deptCell = document.createElement('td');
            deptCell.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-900';
            deptCell.textContent = commune.departement_nom || '-';
            row.appendChild(deptCell);

            // Type Zone
            const typeCell = document.createElement('td');
            typeCell.className = 'px-6 py-4 whitespace-nowrap text-sm';
            const typeBadge = Badge({
                text: commune.type_zone,
                variant: commune.type_zone === 'urbaine' ? 'primary' : 'secondary'
            });
            typeCell.appendChild(typeBadge);
            row.appendChild(typeCell);

            // Population
            const popCell = document.createElement('td');
            popCell.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-600';
            popCell.textContent = commune.population
                ? commune.population.toLocaleString('fr-FR')
                : '-';
            row.appendChild(popCell);

            // Marchés
            const marchesCell = document.createElement('td');
            marchesCell.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-600';
            const marchesBadge = Badge({
                text: `${commune.nombre_marches || 0}`,
                variant: commune.nombre_marches > 0 ? 'success' : 'gray'
            });
            marchesCell.appendChild(marchesBadge);
            row.appendChild(marchesCell);

            // Actions
            const actionsCell = document.createElement('td');
            actionsCell.className = 'px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2';

            const editBtn = Button({
                text: 'Modifier',
                variant: 'secondary',
                size: 'sm',
                onClick: () => handleEdit(commune)
            });

            const deleteBtn = Button({
                text: 'Supprimer',
                variant: 'danger',
                size: 'sm',
                onClick: () => handleDelete(commune)
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
        const endIndex = Math.min(currentPage * itemsPerPage, filteredCommunes.length);
        info.textContent = `Affichage ${startIndex} à ${endIndex} sur ${filteredCommunes.length} résultat(s)`;

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
            filterCommunes();
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
            placeholder: 'Ex: HT-OU-PO',
            value: formData.code,
            required: true,
            onChange: (value) => { formData.code = value; }
        });

        // Nom
        const nomInput = Input({
            label: 'Nom',
            placeholder: 'Ex: Port-au-Prince',
            value: formData.nom,
            required: true,
            onChange: (value) => { formData.nom = value; }
        });

        // Nom Créole
        const nomCreoleInput = Input({
            label: 'Nom Créole',
            placeholder: 'Ex: Pòtoprens',
            value: formData.nom_creole || '',
            onChange: (value) => { formData.nom_creole = value; }
        });

        // Département (dropdown)
        const deptDiv = document.createElement('div');
        const deptLabel = document.createElement('label');
        deptLabel.className = 'block text-sm font-medium text-gray-700 mb-1';
        deptLabel.innerHTML = 'Département <span class="text-red-500">*</span>';

        const deptSelect = document.createElement('select');
        deptSelect.className = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
        deptSelect.innerHTML = '<option value="">Sélectionner un département</option>';

        departements.forEach(dept => {
            const option = document.createElement('option');
            option.value = dept.id;
            option.textContent = dept.nom;
            if (dept.id === formData.departement_id) {
                option.selected = true;
            }
            deptSelect.appendChild(option);
        });

        deptSelect.addEventListener('change', (e) => {
            formData.departement_id = e.target.value;
        });

        deptDiv.appendChild(deptLabel);
        deptDiv.appendChild(deptSelect);

        // Type Zone
        const typeDiv = document.createElement('div');
        const typeLabel = document.createElement('label');
        typeLabel.className = 'block text-sm font-medium text-gray-700 mb-1';
        typeLabel.innerHTML = 'Type de Zone <span class="text-red-500">*</span>';

        const typeSelect = document.createElement('select');
        typeSelect.className = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
        typeSelect.innerHTML = `
            <option value="urbaine" ${formData.type_zone === 'urbaine' ? 'selected' : ''}>Urbaine</option>
            <option value="rurale" ${formData.type_zone === 'rurale' ? 'selected' : ''}>Rurale</option>
        `;
        typeSelect.addEventListener('change', (e) => {
            formData.type_zone = e.target.value;
        });

        typeDiv.appendChild(typeLabel);
        typeDiv.appendChild(typeSelect);

        // Population
        const populationInput = Input({
            label: 'Population',
            type: 'number',
            placeholder: 'Ex: 987310',
            value: formData.population || '',
            onChange: (value) => { formData.population = value ? parseInt(value) : null; }
        });

        modalContent.appendChild(codeInput);
        modalContent.appendChild(nomInput);
        modalContent.appendChild(nomCreoleInput);
        modalContent.appendChild(deptDiv);
        modalContent.appendChild(typeDiv);
        modalContent.appendChild(populationInput);

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
            text: editingCommune ? 'Mettre à jour' : 'Créer',
            variant: 'primary',
            onClick: handleSave
        });

        actionsDiv.appendChild(cancelBtn);
        actionsDiv.appendChild(saveBtn);
        modalContent.appendChild(actionsDiv);

        return Modal({
            title: editingCommune ? 'Modifier la commune' : 'Nouvelle commune',
            isOpen: true,
            onClose: () => {
                showModal = false;
                render();
            },
            children: modalContent
        });
    }

    // Gestion événements
    async function handleEdit(commune) {
        editingCommune = commune;
        formData = {
            code: commune.code,
            nom: commune.nom,
            nom_creole: commune.nom_creole || '',
            departement_id: commune.departement_id,
            type_zone: commune.type_zone,
            population: commune.population || ''
        };
        showModal = true;
        render();
    }

    async function handleDelete(commune) {
        if (commune.nombre_marches > 0) {
            showToast(
                `Impossible de supprimer : ${commune.nombre_marches} marché(s) sont liés à cette commune`,
                'error'
            );
            return;
        }

        if (!confirm(`Êtes-vous sûr de vouloir supprimer la commune "${commune.nom}" ?`)) {
            return;
        }

        try {
            await api.delete(`/api/communes/${commune.id}`);
            showToast('Commune supprimée avec succès', 'success');
            await loadCommunes();
        } catch (error) {
            showToast(error.message || 'Erreur lors de la suppression', 'error');
        }
    }

    async function handleSave() {
        // Validation
        if (!formData.code || !formData.nom || !formData.departement_id || !formData.type_zone) {
            showToast('Veuillez remplir tous les champs obligatoires', 'error');
            return;
        }

        try {
            // Préparer les données
            const dataToSend = {
                code: formData.code,
                nom: formData.nom,
                nom_creole: formData.nom_creole || null,
                departement_id: formData.departement_id,
                type_zone: formData.type_zone,
                population: formData.population ? parseInt(formData.population) : null
            };

            if (editingCommune) {
                // Mise à jour
                await api.put(`/api/communes/${editingCommune.id}`, dataToSend);
                showToast('Commune mise à jour avec succès', 'success');
            } else {
                // Création
                await api.post('/api/communes', dataToSend);
                showToast('Commune créée avec succès', 'success');
            }

            showModal = false;
            await loadCommunes();
        } catch (error) {
            showToast(error.message || 'Erreur lors de la sauvegarde', 'error');
        }
    }

    // Chargement des données
    async function loadDepartements() {
        try {
            departements = await api.get('/api/departements');
        } catch (error) {
            console.error('Erreur chargement départements:', error);
            departements = [];
        }
    }

    async function loadCommunes() {
        isLoading = true;
        render();

        try {
            const response = await api.get('/api/communes');
            communes = response;
            filterCommunes();
        } catch (error) {
            showToast(error.message || 'Erreur lors du chargement des communes', 'error');
            communes = [];
            filteredCommunes = [];
        } finally {
            isLoading = false;
            render();
        }
    }

    async function loadAll() {
        await loadDepartements();
        await loadCommunes();
    }

    // Rendu principal
    function render() {
        container.innerHTML = '';
        container.appendChild(renderHeader());
        container.appendChild(renderSearchAndFilters());
        container.appendChild(renderTable());
        container.appendChild(renderModal());
    }

    // Initialisation
    loadAll();

    return container;
}
