/**
 * Page d'administration des rôles
 * CRUD complet avec gestion des permissions associées
 */

import auth from '../modules/auth.js';
import api from '../modules/api.js';
import { Card, Button, Modal, showToast, Spinner, Badge } from '../modules/ui.js';

export default function AdminRolesPage() {
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
    let roles = [];
    let permissions = [];
    let filteredRoles = [];
    let searchTerm = '';
    let editingRole = null;
    let showModal = false;

    // Tri
    let sortColumn = 'nom';
    let sortDirection = 'asc';

    // Pagination
    let currentPage = 1;
    let itemsPerPage = 10;
    let totalPages = 1;

    // Sélection (suppression en lot)
    let selectedIds = new Set();

    // Panneau Détail d'un rôle
    let showDetailModal = false;
    let detailRole = null;
    let activeTab = 'users';       // 'users' | 'permissions'
    let detailUsers = [];
    let isLoadingDetail = false;
    let selectedDetailUserIds = new Set();
    let selectedDetailPermIds = new Set();
    let detailUserPage = 1;
    const detailUserPerPage = 10;

    // Formulaire
    let formData = {
        nom: '',
        description: '',
        id_permissions: []
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
        title.textContent = 'Rôles';

        const subtitle = document.createElement('p');
        subtitle.className = 'text-gray-600 mt-1';
        subtitle.textContent = `${filteredRoles.length} rôle(s)`;

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
            text: '+ Ajouter un rôle',
            variant: 'primary',
            onClick: () => {
                editingRole = null;
                formData = {
                    nom: '',
                    description: '',
                    id_permissions: []
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
            filterRoles();
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

        filtersDiv.appendChild(searchInput);

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
        [5, 10, 20, 50].forEach(size => {
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
        const end = Math.min(currentPage * itemsPerPage, filteredRoles.length);
        infoDiv.textContent = `${start}-${end} sur ${filteredRoles.length}`;

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
        totalPages = Math.max(1, Math.ceil(filteredRoles.length / itemsPerPage));
        if (currentPage > totalPages) currentPage = totalPages;

        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const paginatedRoles = filteredRoles.slice(startIndex, endIndex);

        const card = Card({
            children: [
                (() => {
                    const wrapper = document.createElement('div');
                    wrapper.className = 'overflow-x-auto';

                    if (paginatedRoles.length === 0) {
                        const empty = document.createElement('div');
                        empty.className = 'text-center py-12';
                        empty.innerHTML = `
                            <p class="text-gray-500">
                                ${searchTerm ? 'Aucun rôle trouvé' : 'Aucun rôle'}
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
                    const pageIds = paginatedRoles.map(r => r.id);
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
                    headerRow.appendChild(createSortableHeader('Description', 'description'));
                    headerRow.appendChild(createSortableHeader('Permissions', 'permissions'));

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

                    paginatedRoles.forEach(role => {
                        const row = document.createElement('tr');
                        row.className = selectedIds.has(role.id)
                            ? 'bg-blue-50'
                            : 'hover:bg-gray-50';

                        // Checkbox de sélection
                        const checkCell = document.createElement('td');
                        checkCell.className = 'px-4 py-4 w-10';
                        const checkbox = document.createElement('input');
                        checkbox.type = 'checkbox';
                        checkbox.className = 'w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer';
                        checkbox.checked = selectedIds.has(role.id);
                        checkbox.addEventListener('change', () => {
                            if (checkbox.checked) {
                                selectedIds.add(role.id);
                            } else {
                                selectedIds.delete(role.id);
                            }
                            render();
                        });
                        checkCell.appendChild(checkbox);
                        row.appendChild(checkCell);

                        // Nom
                        const nomCell = document.createElement('td');
                        nomCell.className = 'px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900';
                        nomCell.textContent = role.nom;
                        row.appendChild(nomCell);

                        // Description
                        const descCell = document.createElement('td');
                        descCell.className = 'px-6 py-4 text-sm text-gray-900';
                        descCell.textContent = role.description || '-';
                        row.appendChild(descCell);

                        // Permissions (count)
                        const permsCell = document.createElement('td');
                        permsCell.className = 'px-6 py-4 whitespace-nowrap';
                        const permCount = role.permissions ? role.permissions.length : 0;
                        const permBadge = Badge({
                            text: `${permCount} permission(s)`,
                            variant: permCount > 0 ? 'info' : 'default'
                        });
                        permsCell.appendChild(permBadge);
                        row.appendChild(permsCell);

                        // Actions
                        const actionsCell = document.createElement('td');
                        actionsCell.className = 'px-6 py-4 whitespace-nowrap text-right text-sm font-medium';

                        const actionsContainer = document.createElement('div');
                        actionsContainer.className = 'flex justify-end gap-2';

                        const detailBtn = Button({
                            text: 'Détail',
                            variant: 'secondary',
                            size: 'sm',
                            onClick: () => openDetail(role)
                        });

                        const editBtn = Button({
                            text: 'Modifier',
                            variant: 'secondary',
                            size: 'sm',
                            onClick: () => handleEdit(role)
                        });

                        const deleteBtn = Button({
                            text: 'Supprimer',
                            variant: 'danger',
                            size: 'sm',
                            onClick: () => handleDelete(role)
                        });

                        actionsContainer.appendChild(detailBtn);
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
        title.textContent = editingRole ? 'Modifier le rôle' : 'Ajouter un rôle';
        modalContent.appendChild(title);

        // Nom
        const nomGroup = document.createElement('div');
        const nomLabel = document.createElement('label');
        nomLabel.className = 'block text-sm font-medium text-gray-700 mb-1';
        nomLabel.innerHTML = '<span class="text-red-500">*</span> Nom du rôle';
        const nomInput = document.createElement('input');
        nomInput.type = 'text';
        nomInput.required = true;
        nomInput.placeholder = 'agent';
        nomInput.className = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
        nomInput.value = formData.nom;
        nomInput.addEventListener('input', (e) => { formData.nom = e.target.value; });
        nomGroup.appendChild(nomLabel);
        nomGroup.appendChild(nomInput);
        modalContent.appendChild(nomGroup);

        // Description
        const descGroup = document.createElement('div');
        const descLabel = document.createElement('label');
        descLabel.className = 'block text-sm font-medium text-gray-700 mb-1';
        descLabel.textContent = 'Description';
        const descTextarea = document.createElement('textarea');
        descTextarea.rows = 3;
        descTextarea.placeholder = 'Description du rôle...';
        descTextarea.className = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
        descTextarea.value = formData.description;
        descTextarea.addEventListener('input', (e) => { formData.description = e.target.value; });
        descGroup.appendChild(descLabel);
        descGroup.appendChild(descTextarea);
        modalContent.appendChild(descGroup);

        // Permissions (checkboxes multiples)
        const permsGroup = document.createElement('div');
        const permsLabel = document.createElement('label');
        permsLabel.className = 'block text-sm font-medium text-gray-700 mb-2';
        permsLabel.textContent = 'Permissions';
        permsGroup.appendChild(permsLabel);

        const permsContainer = document.createElement('div');
        permsContainer.className = 'max-h-64 overflow-y-auto border border-gray-300 rounded-lg p-4 space-y-2';

        permissions.forEach(permission => {
            const checkboxDiv = document.createElement('div');
            checkboxDiv.className = 'flex items-start';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `perm-${permission.id}`;
            checkbox.className = 'h-4 w-4 mt-0.5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded';
            checkbox.checked = formData.id_permissions.includes(permission.id);
            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    if (!formData.id_permissions.includes(permission.id)) {
                        formData.id_permissions.push(permission.id);
                    }
                } else {
                    formData.id_permissions = formData.id_permissions.filter(p => p !== permission.id);
                }
            });

            const checkboxLabel = document.createElement('label');
            checkboxLabel.htmlFor = `perm-${permission.id}`;
            checkboxLabel.className = 'ml-2 block text-sm';

            const labelName = document.createElement('div');
            labelName.className = 'font-medium text-gray-900';
            labelName.textContent = permission.nom;

            const labelDesc = document.createElement('div');
            labelDesc.className = 'text-xs text-gray-500';
            labelDesc.textContent = permission.description || '';

            checkboxLabel.appendChild(labelName);
            if (permission.description) {
                checkboxLabel.appendChild(labelDesc);
            }

            checkboxDiv.appendChild(checkbox);
            checkboxDiv.appendChild(checkboxLabel);
            permsContainer.appendChild(checkboxDiv);
        });

        permsGroup.appendChild(permsContainer);
        modalContent.appendChild(permsGroup);

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
            text: editingRole ? 'Modifier' : 'Créer',
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
    function handleEdit(role) {
        editingRole = role;
        formData = {
            nom: role.nom,
            description: role.description || '',
            id_permissions: role.id_permissions || []
        };
        showModal = true;
        render();
    }

    async function handleBulkDelete() {
        const count = selectedIds.size;
        if (!confirm(`Êtes-vous sûr de vouloir supprimer ${count} rôle(s) sélectionné(s) ?\n\nLes rôles utilisés par des utilisateurs seront ignorés.`)) {
            return;
        }

        try {
            const result = await api.delete('/api/roles', { ids: Array.from(selectedIds) });
            const msg = result.message || `${result.deleted_count} rôle(s) supprimé(s)`;
            showToast({ message: msg, type: result.deleted_count > 0 ? 'success' : 'warning' });
            if (result.skipped_users && result.skipped_users.length > 0) {
                showToast({
                    message: `Ignorés (utilisés par des utilisateurs) : ${result.skipped_users.join(', ')}`,
                    type: 'warning'
                });
            }
            selectedIds.clear();
            await loadRoles();
        } catch (error) {
            showToast({
                message: error.message || 'Erreur lors de la suppression en lot',
                type: 'error'
            });
        }
    }

    async function handleDelete(role) {
        if (!confirm(`Êtes-vous sûr de vouloir supprimer le rôle "${role.nom}" ?\n\nCette action sera impossible si des utilisateurs utilisent ce rôle.`)) {
            return;
        }

        try {
            const result = await api.delete(`/api/roles/${role.id}`);
            showToast({
                message: result.message || 'Rôle supprimé avec succès',
                type: 'success'
            });
            await loadRoles();
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
            showToast({ message: 'Le nom du rôle est obligatoire', type: 'error' });
            return;
        }

        try {
            const saveData = {
                nom: formData.nom.trim(),
                description: formData.description.trim() || null,
                id_permissions: formData.id_permissions
            };

            if (editingRole) {
                await api.put(`/api/roles/${editingRole.id}`, saveData);
                showToast({ message: 'Rôle modifié avec succès', type: 'success' });
            } else {
                await api.post('/api/roles', saveData);
                showToast({ message: 'Rôle créé avec succès', type: 'success' });
            }

            showModal = false;
            await loadRoles();
        } catch (error) {
            showToast({
                message: error.message || 'Erreur lors de l\'enregistrement',
                type: 'error'
            });
        }
    }

    // ========================================================================
    // Panneau Détail — ouverture et chargement
    // ========================================================================
    async function openDetail(role) {
        detailRole = role;
        activeTab = 'users';
        selectedDetailUserIds = new Set();
        selectedDetailPermIds = new Set();
        detailUserPage = 1;
        detailUsers = [];
        showDetailModal = true;
        isLoadingDetail = true;
        render();

        try {
            detailUsers = await api.get(`/api/roles/${role.id}/members`);
        } catch (e) {
            showToast({ message: e.message || 'Erreur lors du chargement des membres', type: 'error' });
            detailUsers = [];
        }
        isLoadingDetail = false;
        render();
    }

    async function handleRemoveMember(userId) {
        try {
            const r = await api.delete(`/api/roles/${detailRole.id}/members`, { user_ids: [userId] });
            showToast({ message: r.message, type: 'success' });
            detailUsers = detailUsers.filter(u => u.id !== userId);
            selectedDetailUserIds.delete(userId);
            roles = roles.map(ro => ro.id === detailRole.id
                ? { ...ro }
                : ro
            );
            await loadRoles();
            // Remettre à jour detailRole depuis la liste rechargée
            detailRole = roles.find(r => r.id === detailRole.id) || detailRole;
            render();
        } catch (e) {
            showToast({ message: e.message || 'Erreur lors du retrait', type: 'error' });
        }
    }

    async function handleBulkRemoveMembers() {
        if (selectedDetailUserIds.size === 0) return;
        if (!confirm(`Retirer ${selectedDetailUserIds.size} utilisateur(s) de ce rôle ?`)) return;
        try {
            const r = await api.delete(`/api/roles/${detailRole.id}/members`, { user_ids: Array.from(selectedDetailUserIds) });
            showToast({ message: r.message, type: 'success' });
            const removed = new Set(selectedDetailUserIds);
            detailUsers = detailUsers.filter(u => !removed.has(u.id));
            selectedDetailUserIds.clear();
            await loadRoles();
            detailRole = roles.find(r => r.id === detailRole.id) || detailRole;
            render();
        } catch (e) {
            showToast({ message: e.message || 'Erreur lors du retrait groupé', type: 'error' });
        }
    }

    async function handleRemovePermission(permId) {
        try {
            const r = await api.delete(`/api/roles/${detailRole.id}/permissions`, { permission_ids: [permId] });
            showToast({ message: r.message, type: 'success' });
            detailRole = {
                ...detailRole,
                permissions: (detailRole.permissions || []).filter(p => p.id !== permId),
                id_permissions: (detailRole.id_permissions || []).filter(id => id !== permId)
            };
            selectedDetailPermIds.delete(permId);
            await loadRoles();
            render();
        } catch (e) {
            showToast({ message: e.message || 'Erreur lors du retrait', type: 'error' });
        }
    }

    async function handleBulkRemovePermissions() {
        if (selectedDetailPermIds.size === 0) return;
        if (!confirm(`Retirer ${selectedDetailPermIds.size} permission(s) de ce rôle ?`)) return;
        try {
            const r = await api.delete(`/api/roles/${detailRole.id}/permissions`, { permission_ids: Array.from(selectedDetailPermIds) });
            showToast({ message: r.message, type: 'success' });
            const removed = new Set(selectedDetailPermIds);
            detailRole = {
                ...detailRole,
                permissions: (detailRole.permissions || []).filter(p => !removed.has(p.id)),
                id_permissions: (detailRole.id_permissions || []).filter(id => !removed.has(id))
            };
            selectedDetailPermIds.clear();
            await loadRoles();
            render();
        } catch (e) {
            showToast({ message: e.message || 'Erreur lors du retrait groupé', type: 'error' });
        }
    }

    // ========================================================================
    // Panneau Détail — rendu modal avec onglets
    // ========================================================================
    function renderDetailModal() {
        if (!showDetailModal || !detailRole) return document.createElement('div');

        // Overlay
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                showDetailModal = false;
                render();
            }
        });

        // Panneau principal
        const panel = document.createElement('div');
        panel.className = 'bg-white rounded-xl shadow-2xl w-full max-w-3xl flex flex-col overflow-hidden';
        panel.style.maxHeight = '90vh';
        overlay.appendChild(panel);

        // ── En-tête ──────────────────────────────────────────────────────────
        const panelHeader = document.createElement('div');
        panelHeader.className = 'flex items-center justify-between px-6 py-4 border-b border-gray-200';

        const panelTitle = document.createElement('div');
        const titleEl = document.createElement('h2');
        titleEl.className = 'text-xl font-bold text-gray-900';
        titleEl.textContent = `Rôle : ${detailRole.nom}`;
        const subtitleEl = document.createElement('p');
        subtitleEl.className = 'text-sm text-gray-500 mt-0.5';
        subtitleEl.textContent = detailRole.description || '';
        panelTitle.appendChild(titleEl);
        if (detailRole.description) panelTitle.appendChild(subtitleEl);

        const closeBtn = document.createElement('button');
        closeBtn.className = 'text-gray-400 hover:text-gray-600 text-2xl leading-none font-bold p-1';
        closeBtn.textContent = '×';
        closeBtn.addEventListener('click', () => { showDetailModal = false; render(); });

        panelHeader.appendChild(panelTitle);
        panelHeader.appendChild(closeBtn);
        panel.appendChild(panelHeader);

        // ── Onglets ──────────────────────────────────────────────────────────
        const tabsBar = document.createElement('div');
        tabsBar.className = 'flex border-b border-gray-200 px-6';

        const userCount = detailUsers.length;
        const permCount = (detailRole.permissions || []).length;

        const tabsConfig = [
            { key: 'users', label: `👥 Utilisateurs (${isLoadingDetail ? '…' : userCount})` },
            { key: 'permissions', label: `🔑 Permissions (${permCount})` }
        ];

        tabsConfig.forEach(({ key, label }) => {
            const tab = document.createElement('button');
            tab.className = activeTab === key
                ? 'px-4 py-3 text-sm font-medium text-blue-600 border-b-2 border-blue-600 -mb-px'
                : 'px-4 py-3 text-sm font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent -mb-px';
            tab.textContent = label;
            tab.addEventListener('click', () => {
                activeTab = key;
                selectedDetailUserIds = new Set();
                selectedDetailPermIds = new Set();
                render();
            });
            tabsBar.appendChild(tab);
        });
        panel.appendChild(tabsBar);

        // ── Corps scrollable ─────────────────────────────────────────────────
        const body = document.createElement('div');
        body.className = 'flex-1 overflow-y-auto p-6 min-h-0';

        if (activeTab === 'users') {
            // ---- Onglet Utilisateurs ----------------------------------------
            if (isLoadingDetail) {
                const spinnerWrap = document.createElement('div');
                spinnerWrap.className = 'flex justify-center py-10';
                spinnerWrap.appendChild(Spinner({ size: 'lg' }));
                body.appendChild(spinnerWrap);
            } else if (detailUsers.length === 0) {
                const empty = document.createElement('p');
                empty.className = 'text-center text-gray-500 py-10';
                empty.textContent = 'Aucun utilisateur n\'a ce rôle.';
                body.appendChild(empty);
            } else {
                // Bouton retrait groupé
                if (selectedDetailUserIds.size > 0) {
                    const bulkBtn = Button({
                        text: `Retirer la sélection (${selectedDetailUserIds.size})`,
                        variant: 'danger',
                        onClick: handleBulkRemoveMembers
                    });
                    bulkBtn.className += ' mb-4';
                    body.appendChild(bulkBtn);
                }

                // Pagination locale
                const totalUserPages = Math.max(1, Math.ceil(detailUsers.length / detailUserPerPage));
                if (detailUserPage > totalUserPages) detailUserPage = totalUserPages;
                const pageUsers = detailUsers.slice((detailUserPage - 1) * detailUserPerPage, detailUserPage * detailUserPerPage);

                // Tableau
                const table = document.createElement('table');
                table.className = 'min-w-full divide-y divide-gray-200 text-sm';

                const thead = document.createElement('thead');
                thead.className = 'bg-gray-50';
                const headerRow = document.createElement('tr');

                // Select-all
                const checkAllTh = document.createElement('th');
                checkAllTh.className = 'px-3 py-2 w-8';
                const checkAll = document.createElement('input');
                checkAll.type = 'checkbox';
                checkAll.className = 'rounded border-gray-300';
                const pageUserIds = pageUsers.map(u => u.id);
                checkAll.checked = pageUserIds.length > 0 && pageUserIds.every(id => selectedDetailUserIds.has(id));
                checkAll.indeterminate = pageUserIds.some(id => selectedDetailUserIds.has(id)) && !checkAll.checked;
                checkAll.addEventListener('change', () => {
                    if (checkAll.checked) pageUserIds.forEach(id => selectedDetailUserIds.add(id));
                    else pageUserIds.forEach(id => selectedDetailUserIds.delete(id));
                    render();
                });
                checkAllTh.appendChild(checkAll);
                headerRow.appendChild(checkAllTh);

                ['Email', 'Nom Prénom', 'Statut', ''].forEach(text => {
                    const th = document.createElement('th');
                    th.className = 'px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase';
                    th.textContent = text;
                    headerRow.appendChild(th);
                });
                thead.appendChild(headerRow);
                table.appendChild(thead);

                const tbody = document.createElement('tbody');
                tbody.className = 'bg-white divide-y divide-gray-100';

                pageUsers.forEach(user => {
                    const row = document.createElement('tr');
                    row.className = selectedDetailUserIds.has(user.id) ? 'bg-blue-50' : 'hover:bg-gray-50';

                    const checkTd = document.createElement('td');
                    checkTd.className = 'px-3 py-3';
                    const cb = document.createElement('input');
                    cb.type = 'checkbox';
                    cb.className = 'rounded border-gray-300';
                    cb.checked = selectedDetailUserIds.has(user.id);
                    cb.addEventListener('change', () => {
                        if (cb.checked) selectedDetailUserIds.add(user.id);
                        else selectedDetailUserIds.delete(user.id);
                        render();
                    });
                    checkTd.appendChild(cb);
                    row.appendChild(checkTd);

                    const emailTd = document.createElement('td');
                    emailTd.className = 'px-4 py-3 text-gray-900';
                    emailTd.textContent = user.email;
                    row.appendChild(emailTd);

                    const nameTd = document.createElement('td');
                    nameTd.className = 'px-4 py-3 text-gray-600';
                    nameTd.textContent = [user.prenom, user.nom].filter(Boolean).join(' ') || '-';
                    row.appendChild(nameTd);

                    const statusTd = document.createElement('td');
                    statusTd.className = 'px-4 py-3';
                    const statusBadge = Badge({
                        text: user.actif ? 'Actif' : 'Inactif',
                        variant: user.actif ? 'success' : 'default'
                    });
                    statusTd.appendChild(statusBadge);
                    row.appendChild(statusTd);

                    const actionTd = document.createElement('td');
                    actionTd.className = 'px-4 py-3 text-right';
                    const removeBtn = document.createElement('button');
                    removeBtn.className = 'text-red-500 hover:text-red-700 font-bold text-lg px-2';
                    removeBtn.title = 'Retirer de ce rôle';
                    removeBtn.textContent = '×';
                    removeBtn.addEventListener('click', () => handleRemoveMember(user.id));
                    actionTd.appendChild(removeBtn);
                    row.appendChild(actionTd);

                    tbody.appendChild(row);
                });
                table.appendChild(tbody);
                body.appendChild(table);

                // Pagination utilisateurs
                if (totalUserPages > 1) {
                    const pagDiv = document.createElement('div');
                    pagDiv.className = 'flex items-center justify-between mt-4 text-sm text-gray-600';

                    const info = document.createElement('span');
                    const start = (detailUserPage - 1) * detailUserPerPage + 1;
                    const end = Math.min(detailUserPage * detailUserPerPage, detailUsers.length);
                    info.textContent = `${start}-${end} sur ${detailUsers.length}`;

                    const nav = document.createElement('div');
                    nav.className = 'flex gap-2';

                    const prevBtn = Button({
                        text: '←',
                        variant: 'secondary',
                        disabled: detailUserPage === 1,
                        onClick: () => { detailUserPage--; render(); }
                    });
                    const nextBtn = Button({
                        text: '→',
                        variant: 'secondary',
                        disabled: detailUserPage === totalUserPages,
                        onClick: () => { detailUserPage++; render(); }
                    });

                    nav.appendChild(prevBtn);
                    nav.appendChild(nextBtn);
                    pagDiv.appendChild(info);
                    pagDiv.appendChild(nav);
                    body.appendChild(pagDiv);
                }
            }

        } else {
            // ---- Onglet Permissions -----------------------------------------
            const perms = detailRole.permissions || [];

            if (perms.length === 0) {
                const empty = document.createElement('p');
                empty.className = 'text-center text-gray-500 py-10';
                empty.textContent = 'Aucune permission assignée à ce rôle.';
                body.appendChild(empty);
            } else {
                // Bouton retrait groupé
                if (selectedDetailPermIds.size > 0) {
                    const bulkBtn = Button({
                        text: `Retirer la sélection (${selectedDetailPermIds.size})`,
                        variant: 'danger',
                        onClick: handleBulkRemovePermissions
                    });
                    bulkBtn.className += ' mb-4';
                    body.appendChild(bulkBtn);
                }

                const table = document.createElement('table');
                table.className = 'min-w-full divide-y divide-gray-200 text-sm';

                const thead = document.createElement('thead');
                thead.className = 'bg-gray-50';
                const headerRow = document.createElement('tr');

                // Select-all
                const checkAllTh = document.createElement('th');
                checkAllTh.className = 'px-3 py-2 w-8';
                const checkAll = document.createElement('input');
                checkAll.type = 'checkbox';
                checkAll.className = 'rounded border-gray-300';
                const allPermIds = perms.map(p => p.id);
                checkAll.checked = allPermIds.length > 0 && allPermIds.every(id => selectedDetailPermIds.has(id));
                checkAll.indeterminate = allPermIds.some(id => selectedDetailPermIds.has(id)) && !checkAll.checked;
                checkAll.addEventListener('change', () => {
                    if (checkAll.checked) allPermIds.forEach(id => selectedDetailPermIds.add(id));
                    else allPermIds.forEach(id => selectedDetailPermIds.delete(id));
                    render();
                });
                checkAllTh.appendChild(checkAll);
                headerRow.appendChild(checkAllTh);

                ['Nom', 'Action', 'Description', ''].forEach(text => {
                    const th = document.createElement('th');
                    th.className = 'px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase';
                    th.textContent = text;
                    headerRow.appendChild(th);
                });
                thead.appendChild(headerRow);
                table.appendChild(thead);

                const tbody = document.createElement('tbody');
                tbody.className = 'bg-white divide-y divide-gray-100';

                perms.forEach(perm => {
                    const row = document.createElement('tr');
                    row.className = selectedDetailPermIds.has(perm.id) ? 'bg-blue-50' : 'hover:bg-gray-50';

                    const checkTd = document.createElement('td');
                    checkTd.className = 'px-3 py-3';
                    const cb = document.createElement('input');
                    cb.type = 'checkbox';
                    cb.className = 'rounded border-gray-300';
                    cb.checked = selectedDetailPermIds.has(perm.id);
                    cb.addEventListener('change', () => {
                        if (cb.checked) selectedDetailPermIds.add(perm.id);
                        else selectedDetailPermIds.delete(perm.id);
                        render();
                    });
                    checkTd.appendChild(cb);
                    row.appendChild(checkTd);

                    const nomTd = document.createElement('td');
                    nomTd.className = 'px-4 py-3 font-medium text-gray-900';
                    nomTd.textContent = perm.nom;
                    row.appendChild(nomTd);

                    const actionTdBadge = document.createElement('td');
                    actionTdBadge.className = 'px-4 py-3';
                    actionTdBadge.appendChild(Badge({ text: perm.action, variant: 'info' }));
                    row.appendChild(actionTdBadge);

                    const descTd = document.createElement('td');
                    descTd.className = 'px-4 py-3 text-gray-500 text-xs max-w-xs truncate';
                    descTd.textContent = perm.description || '-';
                    row.appendChild(descTd);

                    const actionTd = document.createElement('td');
                    actionTd.className = 'px-4 py-3 text-right';
                    const removeBtn = document.createElement('button');
                    removeBtn.className = 'text-red-500 hover:text-red-700 font-bold text-lg px-2';
                    removeBtn.title = 'Retirer de ce rôle';
                    removeBtn.textContent = '×';
                    removeBtn.addEventListener('click', () => handleRemovePermission(perm.id));
                    actionTd.appendChild(removeBtn);
                    row.appendChild(actionTd);

                    tbody.appendChild(row);
                });
                table.appendChild(tbody);
                body.appendChild(table);
            }
        }

        panel.appendChild(body);
        return overlay;
    }

    // ========================================================================
    // Filtrage, tri et chargement
    // ========================================================================
    function filterRoles() {
        let filtered = [...roles];

        // Filtre par recherche (nom)
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(r =>
                (r.nom && r.nom.toLowerCase().includes(term)) ||
                (r.description && r.description.toLowerCase().includes(term))
            );
        }

        // Tri dynamique
        filtered.sort((a, b) => {
            let aVal, bVal;

            switch(sortColumn) {
                case 'nom':
                    aVal = a.nom || '';
                    bVal = b.nom || '';
                    break;
                case 'description':
                    aVal = a.description || '';
                    bVal = b.description || '';
                    break;
                case 'permissions':
                    aVal = a.permissions ? a.permissions.length : 0;
                    bVal = b.permissions ? b.permissions.length : 0;
                    break;
                default:
                    aVal = a.nom || '';
                    bVal = b.nom || '';
            }

            const comparison = aVal.toString().localeCompare(bVal.toString());
            return sortDirection === 'asc' ? comparison : -comparison;
        });

        filteredRoles = filtered;
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
        filterRoles();
        render();
    }

    async function loadRoles() {
        try {
            isLoading = true;
            render();

            const [rolesData, permissionsData] = await Promise.all([
                api.get('/api/roles'),
                api.get('/api/permissions')
            ]);

            roles = rolesData;
            permissions = permissionsData;
            filterRoles();
            isLoading = false;
            render();
        } catch (error) {
            showToast({
                message: error.message || 'Erreur lors du chargement des rôles',
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
            if (filteredRoles.length > 0) {
                container.appendChild(renderPagination());
            }
        }

        if (showModal) container.appendChild(renderModal());
        if (showDetailModal) container.appendChild(renderDetailModal());
    }

    // ========================================================================
    // Initialisation
    // ========================================================================
    loadRoles();
    return container;
}
