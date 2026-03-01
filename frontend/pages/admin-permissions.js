/**
 * Page d'administration des permissions
 * CRUD complet pour gérer les permissions du système
 */

import auth from '../modules/auth.js';
import api from '../modules/api.js';
import { Card, Button, Modal, showToast, Spinner, Badge } from '../modules/ui.js';

export default function AdminPermissionsPage() {
    const container = document.createElement('div');
    container.className = 'space-y-6';

    // RBAC Check - Réservé aux bailleurs uniquement
    const isBailleur = auth.hasRole('bailleur');

    if (!isBailleur) {
        const unauthorized = document.createElement('div');
        unauthorized.className = 'text-center py-12';
        unauthorized.innerHTML = `
            <h2 class="text-2xl font-bold text-red-600 mb-2">Accès non autorisé</h2>
            <p class="text-gray-600">Cette page est réservée aux administrateurs (bailleurs).</p>
        `;
        container.appendChild(unauthorized);
        return container;
    }

    // État
    let isLoading = true;
    let permissions = [];
    let filteredPermissions = [];
    let searchTerm = '';
    let filterAction = '';
    let editingPermission = null;
    let showModal = false;

    // Tri
    let sortColumn = 'nom';
    let sortDirection = 'asc';

    // Pagination
    let currentPage = 1;
    let itemsPerPage = 20;
    let totalPages = 1;

    // Sélection (suppression en lot)
    let selectedIds = new Set();

    // Formulaire
    let formData = {
        nom: '',
        action: '',
        description: ''
    };

    // ========================================================================
    // Header
    // ========================================================================
    function renderHeader() {
        const header = document.createElement('div');
        header.className = 'flex justify-between items-center mb-6';

        const titleDiv = document.createElement('div');
        const title = document.createElement('h1');
        title.className = 'text-3xl font-bold text-gray-900';
        title.textContent = 'Permissions';

        const subtitle = document.createElement('p');
        subtitle.className = 'text-gray-600 mt-1';
        subtitle.textContent = `${filteredPermissions.length} permission(s)`;

        titleDiv.appendChild(title);
        titleDiv.appendChild(subtitle);

        const buttonsDiv = document.createElement('div');
        buttonsDiv.className = 'flex items-center gap-3';

        if (selectedIds.size > 0) {
            const bulkDeleteBtn = Button({
                text: `Supprimer la sélection (${selectedIds.size})`,
                variant: 'danger',
                onClick: handleBulkDelete
            });
            buttonsDiv.appendChild(bulkDeleteBtn);
        }

        const addButton = Button({
            text: '+ Ajouter une permission',
            variant: 'primary',
            onClick: () => {
                editingPermission = null;
                formData = {
                    nom: '',
                    action: '',
                    description: ''
                };
                showModal = true;
                render();
            }
        });

        buttonsDiv.appendChild(addButton);
        header.appendChild(titleDiv);
        header.appendChild(buttonsDiv);

        return header;
    }

    // ========================================================================
    // Filtres et recherche
    // ========================================================================
    function renderFilters() {
        const filtersDiv = document.createElement('div');
        filtersDiv.className = 'mb-6 flex flex-wrap gap-4';

        // Recherche par nom
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'Rechercher par nom...';
        searchInput.className = 'flex-1 min-w-64 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
        searchInput.value = searchTerm;
        searchInput.addEventListener('input', (e) => {
            const inputElement = e.target;
            const cursorPosition = inputElement.selectionStart;
            searchTerm = inputElement.value;
            currentPage = 1;
            filterPermissions();
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

        // Filtre par action
        const actionSelect = document.createElement('select');
        actionSelect.className = 'px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
        actionSelect.innerHTML = `
            <option value="">Toutes les actions</option>
            <option value="read" ${filterAction === 'read' ? 'selected' : ''}>Read</option>
            <option value="create" ${filterAction === 'create' ? 'selected' : ''}>Create</option>
            <option value="update" ${filterAction === 'update' ? 'selected' : ''}>Update</option>
            <option value="delete" ${filterAction === 'delete' ? 'selected' : ''}>Delete</option>
            <option value="manage" ${filterAction === 'manage' ? 'selected' : ''}>Manage</option>
        `;
        actionSelect.addEventListener('change', (e) => {
            filterAction = e.target.value;
            currentPage = 1;
            filterPermissions();
            render();
        });

        filtersDiv.appendChild(searchInput);
        filtersDiv.appendChild(actionSelect);

        return filtersDiv;
    }

    // ========================================================================
    // Pagination
    // ========================================================================
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
        [10, 20, 50, 100].forEach(size => {
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
        const end = Math.min(currentPage * itemsPerPage, filteredPermissions.length);
        infoDiv.textContent = `${start}-${end} sur ${filteredPermissions.length}`;

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

    // ========================================================================
    // Tableau
    // ========================================================================
    function renderTable() {
        // Calculer pagination
        totalPages = Math.max(1, Math.ceil(filteredPermissions.length / itemsPerPage));
        if (currentPage > totalPages) currentPage = totalPages;

        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const paginatedPermissions = filteredPermissions.slice(startIndex, endIndex);

        const card = Card({
            children: [
                (() => {
                    const wrapper = document.createElement('div');
                    wrapper.className = 'overflow-x-auto';

                    if (paginatedPermissions.length === 0) {
                        const empty = document.createElement('div');
                        empty.className = 'text-center py-12';
                        empty.innerHTML = `
                            <p class="text-gray-500">
                                ${searchTerm || filterAction ? 'Aucune permission trouvée' : 'Aucune permission'}
                            </p>
                        `;
                        wrapper.appendChild(empty);
                        return wrapper;
                    }

                    const table = document.createElement('table');
                    table.className = 'min-w-full divide-y divide-gray-200';

                    // Header avec tri
                    const thead = document.createElement('thead');
                    thead.className = 'bg-gray-50';
                    const headerRow = document.createElement('tr');

                    // Fonction helper pour créer un en-tête triable
                    const createSortableHeader = (text, column) => {
                        const th = document.createElement('th');
                        th.className = 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none';
                        th.onclick = () => handleSort(column);

                        const content = document.createElement('div');
                        content.className = 'flex items-center gap-1';

                        const textSpan = document.createElement('span');
                        textSpan.textContent = text;
                        content.appendChild(textSpan);

                        // Indicateur de tri
                        if (sortColumn === column) {
                            const arrow = document.createElement('span');
                            arrow.textContent = sortDirection === 'asc' ? '↑' : '↓';
                            arrow.className = 'text-blue-600 font-bold';
                            content.appendChild(arrow);
                        }

                        th.appendChild(content);
                        return th;
                    };

                    // Checkbox "tout sélectionner"
                    const checkAllTh = document.createElement('th');
                    checkAllTh.className = 'px-4 py-3 w-10';
                    const checkAll = document.createElement('input');
                    checkAll.type = 'checkbox';
                    checkAll.className = 'w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer';
                    const pageIds = paginatedPermissions.map(p => p.id);
                    checkAll.checked = pageIds.length > 0 && pageIds.every(id => selectedIds.has(id));
                    checkAll.indeterminate = pageIds.some(id => selectedIds.has(id)) && !checkAll.checked;
                    checkAll.addEventListener('change', () => {
                        if (checkAll.checked) {
                            pageIds.forEach(id => selectedIds.add(id));
                        } else {
                            pageIds.forEach(id => selectedIds.delete(id));
                        }
                        render();
                    });
                    checkAllTh.appendChild(checkAll);
                    headerRow.appendChild(checkAllTh);

                    // En-têtes triables
                    headerRow.appendChild(createSortableHeader('Nom', 'nom'));
                    headerRow.appendChild(createSortableHeader('Action', 'action'));
                    headerRow.appendChild(createSortableHeader('Description', 'description'));

                    // Actions (non triable)
                    const actionsTh = document.createElement('th');
                    actionsTh.className = 'px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider';
                    actionsTh.textContent = 'Actions';
                    headerRow.appendChild(actionsTh);

                    thead.appendChild(headerRow);
                    table.appendChild(thead);

                    // Body
                    const tbody = document.createElement('tbody');
                    tbody.className = 'bg-white divide-y divide-gray-200';

                    paginatedPermissions.forEach(permission => {
                        const row = document.createElement('tr');
                        row.className = selectedIds.has(permission.id)
                            ? 'bg-blue-50'
                            : 'hover:bg-gray-50';

                        // Checkbox de sélection
                        const checkCell = document.createElement('td');
                        checkCell.className = 'px-4 py-4 w-10';
                        const checkbox = document.createElement('input');
                        checkbox.type = 'checkbox';
                        checkbox.className = 'w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer';
                        checkbox.checked = selectedIds.has(permission.id);
                        checkbox.addEventListener('change', () => {
                            if (checkbox.checked) {
                                selectedIds.add(permission.id);
                            } else {
                                selectedIds.delete(permission.id);
                            }
                            render();
                        });
                        checkCell.appendChild(checkbox);
                        row.appendChild(checkCell);

                        // Nom
                        const nomCell = document.createElement('td');
                        nomCell.className = 'px-6 py-4 whitespace-nowrap text-sm font-mono font-medium text-gray-900';
                        nomCell.textContent = permission.nom;
                        row.appendChild(nomCell);

                        // Action
                        const actionCell = document.createElement('td');
                        actionCell.className = 'px-6 py-4 whitespace-nowrap';
                        const actionBadge = Badge({
                            text: permission.action,
                            variant: permission.action === 'read' ? 'info' :
                                   permission.action === 'create' ? 'success' :
                                   permission.action === 'update' ? 'warning' :
                                   permission.action === 'delete' ? 'danger' :
                                   'default'
                        });
                        actionCell.appendChild(actionBadge);
                        row.appendChild(actionCell);

                        // Description
                        const descCell = document.createElement('td');
                        descCell.className = 'px-6 py-4 text-sm text-gray-900';
                        descCell.textContent = permission.description || '-';
                        row.appendChild(descCell);

                        // Actions
                        const actionsCell = document.createElement('td');
                        actionsCell.className = 'px-6 py-4 whitespace-nowrap text-right text-sm font-medium';

                        const actionsContainer = document.createElement('div');
                        actionsContainer.className = 'flex justify-end gap-2';

                        const editBtn = Button({
                            text: 'Modifier',
                            variant: 'secondary',
                            size: 'sm',
                            onClick: () => handleEdit(permission)
                        });

                        const deleteBtn = Button({
                            text: 'Supprimer',
                            variant: 'danger',
                            size: 'sm',
                            onClick: () => handleDelete(permission)
                        });

                        actionsContainer.appendChild(editBtn);
                        actionsContainer.appendChild(deleteBtn);

                        actionsCell.appendChild(actionsContainer);
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

    // ========================================================================
    // Modal Create/Edit
    // ========================================================================
    function renderModal() {
        if (!showModal) return document.createElement('div');

        const modalContent = document.createElement('div');
        modalContent.className = 'space-y-4';

        const title = document.createElement('h2');
        title.className = 'text-xl font-bold text-gray-900 mb-4';
        title.textContent = editingPermission ? 'Modifier la permission' : 'Ajouter une permission';
        modalContent.appendChild(title);

        // Nom
        const nomGroup = document.createElement('div');
        const nomLabel = document.createElement('label');
        nomLabel.className = 'block text-sm font-medium text-gray-700 mb-1';
        nomLabel.innerHTML = '<span class="text-red-500">*</span> Nom (format: ressource:action)';
        const nomInput = document.createElement('input');
        nomInput.type = 'text';
        nomInput.required = true;
        nomInput.placeholder = 'collectes:read';
        nomInput.className = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono';
        nomInput.value = formData.nom;
        nomInput.addEventListener('input', (e) => { formData.nom = e.target.value; });
        nomGroup.appendChild(nomLabel);
        nomGroup.appendChild(nomInput);
        modalContent.appendChild(nomGroup);

        // Action
        const actionGroup = document.createElement('div');
        const actionLabel = document.createElement('label');
        actionLabel.className = 'block text-sm font-medium text-gray-700 mb-1';
        actionLabel.innerHTML = '<span class="text-red-500">*</span> Action';
        const actionSelect = document.createElement('select');
        actionSelect.required = true;
        actionSelect.className = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
        actionSelect.innerHTML = `
            <option value="">-- Sélectionner --</option>
            <option value="read" ${formData.action === 'read' ? 'selected' : ''}>read</option>
            <option value="create" ${formData.action === 'create' ? 'selected' : ''}>create</option>
            <option value="update" ${formData.action === 'update' ? 'selected' : ''}>update</option>
            <option value="delete" ${formData.action === 'delete' ? 'selected' : ''}>delete</option>
            <option value="manage" ${formData.action === 'manage' ? 'selected' : ''}>manage</option>
        `;
        actionSelect.addEventListener('change', (e) => { formData.action = e.target.value; });
        actionGroup.appendChild(actionLabel);
        actionGroup.appendChild(actionSelect);
        modalContent.appendChild(actionGroup);

        // Description
        const descGroup = document.createElement('div');
        const descLabel = document.createElement('label');
        descLabel.className = 'block text-sm font-medium text-gray-700 mb-1';
        descLabel.textContent = 'Description';
        const descTextarea = document.createElement('textarea');
        descTextarea.rows = 3;
        descTextarea.placeholder = 'Description de la permission...';
        descTextarea.className = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
        descTextarea.value = formData.description;
        descTextarea.addEventListener('input', (e) => { formData.description = e.target.value; });
        descGroup.appendChild(descLabel);
        descGroup.appendChild(descTextarea);
        modalContent.appendChild(descGroup);

        // Boutons de sauvegarde et annulation
        const buttonsDiv = document.createElement('div');
        buttonsDiv.className = 'flex justify-end gap-3 mt-6 pt-4 border-t';

        const cancelBtn = Button({
            text: 'Annuler',
            variant: 'secondary',
            onClick: () => {
                showModal = false;
                render();
            }
        });

        const saveBtn = Button({
            text: editingPermission ? 'Modifier' : 'Créer',
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

    // ========================================================================
    // Handlers
    // ========================================================================
    function handleEdit(permission) {
        editingPermission = permission;
        formData = {
            nom: permission.nom,
            action: permission.action,
            description: permission.description || ''
        };
        showModal = true;
        render();
    }

    async function handleDelete(permission) {
        if (!confirm(`Êtes-vous sûr de vouloir supprimer la permission "${permission.nom}" ?\n\nCette action sera impossible si des rôles utilisent cette permission.`)) {
            return;
        }

        try {
            const result = await api.delete(`/api/permissions/${permission.id}`);
            showToast({
                message: result.message || 'Permission supprimée avec succès',
                type: 'success'
            });
            await loadPermissions();
        } catch (error) {
            showToast({
                message: error.message || 'Erreur lors de la suppression',
                type: 'error'
            });
        }
    }

    async function handleBulkDelete() {
        const count = selectedIds.size;
        if (!confirm(`Êtes-vous sûr de vouloir supprimer ${count} permission(s) sélectionnée(s) ?\n\nLes permissions utilisées par des rôles seront automatiquement détachées puis supprimées.`)) {
            return;
        }

        try {
            const result = await api.delete('/api/permissions', { ids: Array.from(selectedIds) });
            const msg = result.message || `${result.deleted_count} permission(s) supprimée(s)`;
            showToast({ message: msg, type: result.deleted_count > 0 ? 'success' : 'warning' });
            selectedIds.clear();
            await loadPermissions();
        } catch (error) {
            showToast({
                message: error.message || 'Erreur lors de la suppression en lot',
                type: 'error'
            });
        }
    }

    async function handleSave() {
        // Validation
        if (!formData.nom.trim()) {
            showToast({ message: 'Le nom de la permission est obligatoire', type: 'error' });
            return;
        }

        if (!formData.action.trim()) {
            showToast({ message: 'L\'action est obligatoire', type: 'error' });
            return;
        }

        try {
            const saveData = {
                nom: formData.nom.trim(),
                action: formData.action.trim(),
                description: formData.description.trim() || null
            };

            if (editingPermission) {
                await api.put(`/api/permissions/${editingPermission.id}`, saveData);
                showToast({ message: 'Permission modifiée avec succès', type: 'success' });
            } else {
                await api.post('/api/permissions', saveData);
                showToast({ message: 'Permission créée avec succès', type: 'success' });
            }

            showModal = false;
            await loadPermissions();
        } catch (error) {
            showToast({
                message: error.message || 'Erreur lors de l\'enregistrement',
                type: 'error'
            });
        }
    }

    // ========================================================================
    // Filtrage, tri et chargement
    // ========================================================================
    function filterPermissions() {
        let filtered = [...permissions];

        // Filtre par recherche (nom)
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(p =>
                (p.nom && p.nom.toLowerCase().includes(term)) ||
                (p.description && p.description.toLowerCase().includes(term))
            );
        }

        // Filtre par action
        if (filterAction) {
            filtered = filtered.filter(p => p.action === filterAction);
        }

        // Tri dynamique
        filtered.sort((a, b) => {
            let aVal, bVal;

            switch(sortColumn) {
                case 'nom':
                    aVal = a.nom || '';
                    bVal = b.nom || '';
                    break;
                case 'action':
                    aVal = a.action || '';
                    bVal = b.action || '';
                    break;
                case 'description':
                    aVal = a.description || '';
                    bVal = b.description || '';
                    break;
                default:
                    aVal = a.nom || '';
                    bVal = b.nom || '';
            }

            const comparison = aVal.toString().localeCompare(bVal.toString());
            return sortDirection === 'asc' ? comparison : -comparison;
        });

        filteredPermissions = filtered;
    }

    function handleSort(column) {
        if (sortColumn === column) {
            // Inverser la direction si même colonne
            sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            // Nouvelle colonne, tri croissant par défaut
            sortColumn = column;
            sortDirection = 'asc';
        }
        filterPermissions();
        render();
    }

    async function loadPermissions() {
        try {
            isLoading = true;
            render();

            const data = await api.get('/api/permissions');
            permissions = data;
            filterPermissions();
            isLoading = false;
            render();
        } catch (error) {
            showToast({
                message: error.message || 'Erreur lors du chargement des permissions',
                type: 'error'
            });
            isLoading = false;
            render();
        }
    }

    // ========================================================================
    // Rendu principal
    // ========================================================================
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
            if (filteredPermissions.length > 0) {
                container.appendChild(renderPagination());
            }
        }

        if (showModal) container.appendChild(renderModal());
    }

    // ========================================================================
    // Initialisation
    // ========================================================================
    loadPermissions();
    return container;
}
