/**
 * Page d'administration des utilisateurs
 * CRUD complet avec filtres, tri, pagination et gestion des mots de passe
 */

import auth from '../modules/auth.js';
import api from '../modules/api.js';
import { Card, Button, Modal, showToast, Spinner, Badge } from '../modules/ui.js';

export default function AdminUtilisateursPage() {
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
    let users = [];
    let departements = [];
    let rolesFromDB = [];  // Rôles chargés depuis la BDD
    let filteredUsers = [];
    let searchTerm = '';
    let filterRole = '';
    let filterDepartement = '';
    let filterStatus = 'all'; // 'all', 'active', 'inactive'
    let editingUser = null;
    let showModal = false;
    let showPasswordModal = false;
    let temporaryPassword = '';

    // Tri
    let sortColumn = 'email';
    let sortDirection = 'asc';

    // Pagination
    let currentPage = 1;
    let itemsPerPage = 10;
    let totalPages = 1;

    // Sélection (suppression en lot)
    let selectedIds = new Set();

    // Formulaire
    let formData = {
        email: '',
        password: '',
        roles: [],
        nom: '',
        prenom: '',
        departement_id: '',
        telephone: '',
        actif: true
    };

    // Récupérer l'utilisateur actuel pour prévenir auto-modification
    const currentUser = auth.getCurrentUser();
    const currentUserId = currentUser ? currentUser.id : null;

    // ========================================================================
    // Header
    // ========================================================================
    function renderHeader() {
        const header = document.createElement('div');
        header.className = 'flex justify-between items-center mb-6';

        const titleDiv = document.createElement('div');
        const title = document.createElement('h1');
        title.className = 'text-3xl font-bold text-gray-900';
        title.textContent = 'Utilisateurs';

        const subtitle = document.createElement('p');
        subtitle.className = 'text-gray-600 mt-1';
        subtitle.textContent = `${filteredUsers.length} utilisateur(s)`;

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
            text: '+ Ajouter un utilisateur',
            variant: 'primary',
            onClick: () => {
                editingUser = null;
                formData = {
                    email: '',
                    password: '',
                    roles: [],
                    nom: '',
                    prenom: '',
                    departement_id: '',
                    telephone: '',
                    actif: true
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

        // Recherche par email/nom/prénom
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'Rechercher par email, nom ou prénom...';
        searchInput.className = 'flex-1 min-w-64 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
        searchInput.value = searchTerm;
        searchInput.addEventListener('input', (e) => {
            const inputElement = e.target;
            const cursorPosition = inputElement.selectionStart;
            searchTerm = inputElement.value;
            currentPage = 1;
            filterUsers();
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

        // Filtre par rôle (chargé depuis BDD)
        const roleSelect = document.createElement('select');
        roleSelect.className = 'px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
        roleSelect.innerHTML = '<option value="">Tous les rôles</option>';
        rolesFromDB.forEach(role => {
            const option = document.createElement('option');
            option.value = role.id;
            option.textContent = role.nom;
            option.selected = filterRole === role.id;
            roleSelect.appendChild(option);
        });
        roleSelect.addEventListener('change', (e) => {
            filterRole = e.target.value;
            currentPage = 1;
            filterUsers();
            render();
        });

        // Filtre par département
        const deptSelect = document.createElement('select');
        deptSelect.className = 'px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
        deptSelect.innerHTML = '<option value="">Tous les départements</option>';
        departements.forEach(dept => {
            const option = document.createElement('option');
            option.value = dept.id;
            option.textContent = dept.nom;
            option.selected = filterDepartement === dept.id;
            deptSelect.appendChild(option);
        });
        deptSelect.addEventListener('change', (e) => {
            filterDepartement = e.target.value;
            currentPage = 1;
            filterUsers();
            render();
        });

        // Filtre par statut
        const statusSelect = document.createElement('select');
        statusSelect.className = 'px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
        statusSelect.innerHTML = `
            <option value="all" ${filterStatus === 'all' ? 'selected' : ''}>Tous les statuts</option>
            <option value="active" ${filterStatus === 'active' ? 'selected' : ''}>Actifs</option>
            <option value="inactive" ${filterStatus === 'inactive' ? 'selected' : ''}>Inactifs</option>
        `;
        statusSelect.addEventListener('change', (e) => {
            filterStatus = e.target.value;
            currentPage = 1;
            filterUsers();
            render();
        });

        filtersDiv.appendChild(searchInput);
        filtersDiv.appendChild(roleSelect);
        filtersDiv.appendChild(deptSelect);
        filtersDiv.appendChild(statusSelect);

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
        const end = Math.min(currentPage * itemsPerPage, filteredUsers.length);
        infoDiv.textContent = `${start}-${end} sur ${filteredUsers.length}`;

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
        totalPages = Math.max(1, Math.ceil(filteredUsers.length / itemsPerPage));
        if (currentPage > totalPages) currentPage = totalPages;

        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

        const card = Card({
            children: [
                (() => {
                    const wrapper = document.createElement('div');
                    wrapper.className = 'overflow-x-auto';

                    if (paginatedUsers.length === 0) {
                        const empty = document.createElement('div');
                        empty.className = 'text-center py-12';
                        empty.innerHTML = `
                            <p class="text-gray-500">
                                ${searchTerm || filterRole || filterDepartement || filterStatus !== 'all' ? 'Aucun utilisateur trouvé' : 'Aucun utilisateur'}
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
                    const pageIds = paginatedUsers.map(u => u.id);
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
                    headerRow.appendChild(createSortableHeader('Email', 'email'));
                    headerRow.appendChild(createSortableHeader('Nom', 'nom'));
                    headerRow.appendChild(createSortableHeader('Rôles', 'roles'));
                    headerRow.appendChild(createSortableHeader('Département', 'departement'));

                    // Téléphone (non triable)
                    const telephoneTh = document.createElement('th');
                    telephoneTh.className = 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider';
                    telephoneTh.textContent = 'Téléphone';
                    headerRow.appendChild(telephoneTh);

                    headerRow.appendChild(createSortableHeader('Statut', 'statut'));

                    // MFA (non triable)
                    const mfaTh = document.createElement('th');
                    mfaTh.className = 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider';
                    mfaTh.textContent = 'MFA';
                    headerRow.appendChild(mfaTh);

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

                    paginatedUsers.forEach(user => {
                        const row = document.createElement('tr');
                        row.className = selectedIds.has(user.id)
                            ? 'bg-blue-50'
                            : 'hover:bg-gray-50';

                        // Checkbox de sélection
                        const checkCell = document.createElement('td');
                        checkCell.className = 'px-4 py-4 w-10';
                        const checkbox = document.createElement('input');
                        checkbox.type = 'checkbox';
                        checkbox.className = 'w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer';
                        checkbox.checked = selectedIds.has(user.id);
                        checkbox.addEventListener('change', () => {
                            if (checkbox.checked) {
                                selectedIds.add(user.id);
                            } else {
                                selectedIds.delete(user.id);
                            }
                            render();
                        });
                        checkCell.appendChild(checkbox);
                        row.appendChild(checkCell);

                        // Email
                        const emailCell = document.createElement('td');
                        emailCell.className = 'px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900';
                        emailCell.textContent = user.email;
                        row.appendChild(emailCell);

                        // Nom / Prénom
                        const nomCell = document.createElement('td');
                        nomCell.className = 'px-6 py-4 whitespace-nowrap';
                        const nomDiv = document.createElement('div');
                        const nomText = document.createElement('div');
                        nomText.className = 'text-sm font-medium text-gray-900';
                        nomText.textContent = user.nom && user.prenom
                            ? `${user.nom} ${user.prenom}`
                            : user.nom || user.prenom || '-';
                        nomDiv.appendChild(nomText);
                        nomCell.appendChild(nomDiv);
                        row.appendChild(nomCell);

                        // Rôles (badges colorés - lookup depuis BDD)
                        const rolesCell = document.createElement('td');
                        rolesCell.className = 'px-6 py-4 whitespace-nowrap';
                        const rolesDiv = document.createElement('div');
                        rolesDiv.className = 'flex flex-wrap gap-1';

                        if (user.roles && user.roles.length > 0) {
                            user.roles.forEach(roleId => {
                                // Trouver le nom du rôle depuis rolesFromDB
                                const roleData = rolesFromDB.find(r => r.id === roleId);
                                const roleName = roleData ? roleData.nom : roleId;

                                const variant = roleName === 'agent' ? 'info' :
                                              roleName === 'décideur' ? 'success' :
                                              roleName === 'bailleur' ? 'warning' :
                                              'default';
                                const badge = Badge({
                                    text: roleName.charAt(0).toUpperCase() + roleName.slice(1),
                                    variant: variant
                                });
                                rolesDiv.appendChild(badge);
                            });
                        } else {
                            rolesDiv.textContent = '-';
                        }
                        rolesCell.appendChild(rolesDiv);
                        row.appendChild(rolesCell);

                        // Département
                        const deptCell = document.createElement('td');
                        deptCell.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-900';
                        deptCell.textContent = user.departement_nom || '-';
                        row.appendChild(deptCell);

                        // Téléphone
                        const telCell = document.createElement('td');
                        telCell.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-900';
                        telCell.textContent = user.telephone || '-';
                        row.appendChild(telCell);

                        // Statut
                        const statutCell = document.createElement('td');
                        statutCell.className = 'px-6 py-4 whitespace-nowrap';
                        const statutBadge = Badge({
                            text: user.actif ? 'Actif' : 'Inactif',
                            variant: user.actif ? 'success' : 'default'
                        });
                        statutCell.appendChild(statutBadge);
                        row.appendChild(statutCell);

                        // MFA
                        const mfaCell = document.createElement('td');
                        mfaCell.className = 'px-6 py-4 whitespace-nowrap';
                        const mfaBadge = Badge({
                            text: user.mfa_enabled ? 'Activé' : 'Désactivé',
                            variant: user.mfa_enabled ? 'success' : 'default'
                        });
                        mfaCell.appendChild(mfaBadge);
                        row.appendChild(mfaCell);

                        // Actions
                        const actionsCell = document.createElement('td');
                        actionsCell.className = 'px-6 py-4 whitespace-nowrap text-right text-sm font-medium';

                        const actionsContainer = document.createElement('div');
                        actionsContainer.className = 'flex justify-end gap-2';

                        const isSelf = user.id === currentUserId;

                        const editBtn = Button({
                            text: 'Modifier',
                            variant: 'secondary',
                            size: 'sm',
                            onClick: () => handleEdit(user)
                        });

                        const resetBtn = Button({
                            text: 'Reset MDP',
                            variant: 'warning',
                            size: 'sm',
                            onClick: () => handleResetPassword(user)
                        });

                        const toggleBtn = Button({
                            text: user.actif ? 'Désactiver' : 'Activer',
                            variant: user.actif ? 'warning' : 'success',
                            size: 'sm',
                            disabled: isSelf,
                            onClick: () => handleToggleStatus(user)
                        });

                        const deleteBtn = Button({
                            text: 'Supprimer',
                            variant: 'danger',
                            size: 'sm',
                            disabled: isSelf,
                            onClick: () => handleDelete(user)
                        });

                        actionsContainer.appendChild(editBtn);
                        actionsContainer.appendChild(resetBtn);
                        actionsContainer.appendChild(toggleBtn);
                        actionsContainer.appendChild(deleteBtn);

                        if (isSelf) {
                            const selfWarning = document.createElement('div');
                            selfWarning.className = 'text-xs text-gray-500 mt-1';
                            selfWarning.textContent = '(Vous)';
                            actionsCell.appendChild(selfWarning);
                        }

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
        title.textContent = editingUser ? 'Modifier l\'utilisateur' : 'Ajouter un utilisateur';
        modalContent.appendChild(title);

        // Email
        const emailGroup = document.createElement('div');
        const emailLabel = document.createElement('label');
        emailLabel.className = 'block text-sm font-medium text-gray-700 mb-1';
        emailLabel.innerHTML = '<span class="text-red-500">*</span> Email';
        const emailInput = document.createElement('input');
        emailInput.type = 'email';
        emailInput.required = true;
        emailInput.placeholder = 'agent@sap.ht';
        emailInput.className = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
        emailInput.value = formData.email;
        emailInput.disabled = !!editingUser; // Email non modifiable en édition
        emailInput.addEventListener('input', (e) => { formData.email = e.target.value; });
        emailGroup.appendChild(emailLabel);
        emailGroup.appendChild(emailInput);
        modalContent.appendChild(emailGroup);

        // Mot de passe (création uniquement)
        if (!editingUser) {
            const passwordGroup = document.createElement('div');
            const passwordLabel = document.createElement('label');
            passwordLabel.className = 'block text-sm font-medium text-gray-700 mb-1';
            passwordLabel.innerHTML = '<span class="text-red-500">*</span> Mot de passe (min. 8 caractères)';
            const passwordInput = document.createElement('input');
            passwordInput.type = 'password';
            passwordInput.required = true;
            passwordInput.placeholder = '••••••••';
            passwordInput.minLength = 8;
            passwordInput.className = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
            passwordInput.value = formData.password;
            passwordInput.addEventListener('input', (e) => { formData.password = e.target.value; });
            passwordGroup.appendChild(passwordLabel);
            passwordGroup.appendChild(passwordInput);
            modalContent.appendChild(passwordGroup);
        }

        // Nom et Prénom (sur la même ligne)
        const nameRow = document.createElement('div');
        nameRow.className = 'grid grid-cols-2 gap-4';

        const nomGroup = document.createElement('div');
        const nomLabel = document.createElement('label');
        nomLabel.className = 'block text-sm font-medium text-gray-700 mb-1';
        nomLabel.textContent = 'Nom';
        const nomInput = document.createElement('input');
        nomInput.type = 'text';
        nomInput.placeholder = 'Dupont';
        nomInput.className = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
        nomInput.value = formData.nom;
        nomInput.addEventListener('input', (e) => { formData.nom = e.target.value; });
        nomGroup.appendChild(nomLabel);
        nomGroup.appendChild(nomInput);

        const prenomGroup = document.createElement('div');
        const prenomLabel = document.createElement('label');
        prenomLabel.className = 'block text-sm font-medium text-gray-700 mb-1';
        prenomLabel.textContent = 'Prénom';
        const prenomInput = document.createElement('input');
        prenomInput.type = 'text';
        prenomInput.placeholder = 'Jean';
        prenomInput.className = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
        prenomInput.value = formData.prenom;
        prenomInput.addEventListener('input', (e) => { formData.prenom = e.target.value; });
        prenomGroup.appendChild(prenomLabel);
        prenomGroup.appendChild(prenomInput);

        nameRow.appendChild(nomGroup);
        nameRow.appendChild(prenomGroup);
        modalContent.appendChild(nameRow);

        // Département
        const deptGroup = document.createElement('div');
        const deptLabel = document.createElement('label');
        deptLabel.className = 'block text-sm font-medium text-gray-700 mb-1';
        deptLabel.textContent = 'Département';
        const deptSelect = document.createElement('select');
        deptSelect.className = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
        deptSelect.innerHTML = '<option value="">-- Sélectionner --</option>';
        departements.forEach(dept => {
            const option = document.createElement('option');
            option.value = dept.id;
            option.textContent = dept.nom;
            option.selected = formData.departement_id === dept.id;
            deptSelect.appendChild(option);
        });
        deptSelect.addEventListener('change', (e) => { formData.departement_id = e.target.value; });
        deptGroup.appendChild(deptLabel);
        deptGroup.appendChild(deptSelect);
        modalContent.appendChild(deptGroup);

        // Téléphone
        const telGroup = document.createElement('div');
        const telLabel = document.createElement('label');
        telLabel.className = 'block text-sm font-medium text-gray-700 mb-1';
        telLabel.textContent = 'Téléphone';
        const telInput = document.createElement('input');
        telInput.type = 'tel';
        telInput.placeholder = '+509 1234 5678';
        telInput.className = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
        telInput.value = formData.telephone;
        telInput.addEventListener('input', (e) => { formData.telephone = e.target.value; });
        telGroup.appendChild(telLabel);
        telGroup.appendChild(telInput);
        modalContent.appendChild(telGroup);

        // Rôles (checkboxes multiples - chargés depuis BDD)
        const rolesGroup = document.createElement('div');
        const rolesLabel = document.createElement('label');
        rolesLabel.className = 'block text-sm font-medium text-gray-700 mb-2';
        rolesLabel.innerHTML = '<span class="text-red-500">*</span> Rôles';
        rolesGroup.appendChild(rolesLabel);

        const rolesContainer = document.createElement('div');
        rolesContainer.className = 'space-y-2';

        rolesFromDB.forEach(role => {
            const checkboxDiv = document.createElement('div');
            checkboxDiv.className = 'flex items-start';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `role-${role.id}`;
            checkbox.className = 'h-4 w-4 mt-0.5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded';
            checkbox.checked = formData.roles.includes(role.id);
            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    if (!formData.roles.includes(role.id)) {
                        formData.roles.push(role.id);
                    }
                } else {
                    formData.roles = formData.roles.filter(r => r !== role.id);
                }
            });

            const checkboxLabel = document.createElement('label');
            checkboxLabel.htmlFor = `role-${role.id}`;
            checkboxLabel.className = 'ml-2 block text-sm';

            const labelName = document.createElement('div');
            labelName.className = 'font-medium text-gray-900';
            labelName.textContent = role.nom;

            const labelDesc = document.createElement('div');
            labelDesc.className = 'text-xs text-gray-500';
            const permCount = role.permissions ? role.permissions.length : 0;
            labelDesc.textContent = `${permCount} permission(s)${role.description ? ' - ' + role.description : ''}`;

            checkboxLabel.appendChild(labelName);
            checkboxLabel.appendChild(labelDesc);

            checkboxDiv.appendChild(checkbox);
            checkboxDiv.appendChild(checkboxLabel);
            rolesContainer.appendChild(checkboxDiv);
        });

        rolesGroup.appendChild(rolesContainer);
        modalContent.appendChild(rolesGroup);

        // Statut (actif/inactif)
        const actifGroup = document.createElement('div');
        const actifDiv = document.createElement('div');
        actifDiv.className = 'flex items-center';

        const actifCheckbox = document.createElement('input');
        actifCheckbox.type = 'checkbox';
        actifCheckbox.id = 'actif-checkbox';
        actifCheckbox.className = 'h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded';
        actifCheckbox.checked = formData.actif;
        actifCheckbox.addEventListener('change', (e) => { formData.actif = e.target.checked; });

        const actifLabel = document.createElement('label');
        actifLabel.htmlFor = 'actif-checkbox';
        actifLabel.className = 'ml-2 block text-sm font-medium text-gray-700';
        actifLabel.textContent = 'Compte actif';

        actifDiv.appendChild(actifCheckbox);
        actifDiv.appendChild(actifLabel);
        actifGroup.appendChild(actifDiv);
        modalContent.appendChild(actifGroup);

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
            text: editingUser ? 'Modifier' : 'Créer',
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
    // Modal Password Reset
    // ========================================================================
    function renderPasswordModal() {
        if (!showPasswordModal) return document.createElement('div');

        const modalContent = document.createElement('div');
        modalContent.className = 'space-y-4';

        const title = document.createElement('h2');
        title.className = 'text-xl font-bold text-gray-900 mb-4';
        title.textContent = 'Mot de passe temporaire';
        modalContent.appendChild(title);

        const warning = document.createElement('div');
        warning.className = 'bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4';
        warning.innerHTML = `
            <p class="text-sm text-yellow-800">
                ⚠️ <strong>Important:</strong> Ce mot de passe ne sera affiché qu'une seule fois.
                Veuillez le copier et le transmettre à l'utilisateur de manière sécurisée.
            </p>
        `;
        modalContent.appendChild(warning);

        const passwordDiv = document.createElement('div');
        passwordDiv.className = 'bg-gray-50 border border-gray-300 rounded-lg p-4';

        const passwordLabel = document.createElement('label');
        passwordLabel.className = 'block text-sm font-medium text-gray-700 mb-2';
        passwordLabel.textContent = 'Mot de passe temporaire:';

        const passwordDisplay = document.createElement('div');
        passwordDisplay.className = 'flex items-center gap-2';

        const passwordText = document.createElement('code');
        passwordText.className = 'flex-1 bg-white px-4 py-2 rounded border border-gray-300 font-mono text-lg text-gray-900';
        passwordText.textContent = temporaryPassword;

        const copyBtn = Button({
            text: '📋 Copier',
            variant: 'secondary',
            onClick: () => {
                navigator.clipboard.writeText(temporaryPassword).then(() => {
                    showToast({ message: 'Mot de passe copié', type: 'success' });
                });
            }
        });

        passwordDisplay.appendChild(passwordText);
        passwordDisplay.appendChild(copyBtn);
        passwordDiv.appendChild(passwordLabel);
        passwordDiv.appendChild(passwordDisplay);
        modalContent.appendChild(passwordDiv);

        const closeBtn = Button({
            text: 'Fermer',
            variant: 'primary',
            onClick: () => {
                showPasswordModal = false;
                temporaryPassword = '';
                render();
            }
        });

        const btnContainer = document.createElement('div');
        btnContainer.className = 'flex justify-end mt-6';
        btnContainer.appendChild(closeBtn);
        modalContent.appendChild(btnContainer);

        return Modal({
            isOpen: showPasswordModal,
            onClose: () => {
                showPasswordModal = false;
                temporaryPassword = '';
                render();
            },
            children: [modalContent]
        });
    }

    // ========================================================================
    // Handlers
    // ========================================================================
    function handleEdit(user) {
        editingUser = user;
        formData = {
            email: user.email,
            password: '', // Pas de modification password en edit
            roles: [...(user.roles || [])],
            nom: user.nom || '',
            prenom: user.prenom || '',
            departement_id: user.departement_id || '',
            telephone: user.telephone || '',
            actif: user.actif !== undefined ? user.actif : true
        };
        showModal = true;
        render();
    }

    async function handleBulkDelete() {
        const count = selectedIds.size;
        if (!confirm(`Êtes-vous sûr de vouloir désactiver ${count} utilisateur(s) sélectionné(s) ?\n\nVotre propre compte sera ignoré.`)) {
            return;
        }

        try {
            const result = await api.delete('/api/users', { ids: Array.from(selectedIds) });
            const msg = result.message || `${result.deleted_count} utilisateur(s) désactivé(s)`;
            showToast({ message: msg, type: result.deleted_count > 0 ? 'success' : 'warning' });
            selectedIds.clear();
            await loadUsers();
        } catch (error) {
            showToast({
                message: error.message || 'Erreur lors de la désactivation en lot',
                type: 'error'
            });
        }
    }

    async function handleDelete(user) {
        if (user.id === currentUserId) {
            showToast({ message: 'Vous ne pouvez pas supprimer votre propre compte', type: 'error' });
            return;
        }

        if (!confirm(`Êtes-vous sûr de vouloir supprimer l'utilisateur "${user.email}" ?\n\nCette action désactivera le compte de manière permanente.`)) {
            return;
        }

        try {
            const result = await api.delete(`/api/users/${user.id}`);
            showToast({
                message: result.message || 'Utilisateur supprimé avec succès',
                type: 'success'
            });
            await loadUsers();
        } catch (error) {
            showToast({
                message: error.message || 'Erreur lors de la suppression',
                type: 'error'
            });
        }
    }

    async function handleSave() {
        // Validation
        if (!formData.email.trim()) {
            showToast({ message: 'L\'email est obligatoire', type: 'error' });
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            showToast({ message: 'Email invalide', type: 'error' });
            return;
        }

        if (!editingUser && !formData.password.trim()) {
            showToast({ message: 'Le mot de passe est obligatoire', type: 'error' });
            return;
        }

        if (!editingUser && formData.password.length < 8) {
            showToast({ message: 'Le mot de passe doit contenir au moins 8 caractères', type: 'error' });
            return;
        }

        if (formData.roles.length === 0) {
            showToast({ message: 'Au moins un rôle doit être sélectionné', type: 'error' });
            return;
        }

        try {
            if (editingUser) {
                // Update - ne pas envoyer password
                const updateData = {
                    roles: formData.roles,
                    nom: formData.nom.trim() || null,
                    prenom: formData.prenom.trim() || null,
                    departement_id: formData.departement_id || null,
                    telephone: formData.telephone.trim() || null,
                    actif: formData.actif
                };
                await api.put(`/api/users/${editingUser.id}`, updateData);
                showToast({ message: 'Utilisateur modifié avec succès', type: 'success' });
            } else {
                // Create
                const createData = {
                    email: formData.email.trim(),
                    password: formData.password,
                    roles: formData.roles,
                    nom: formData.nom.trim() || null,
                    prenom: formData.prenom.trim() || null,
                    departement_id: formData.departement_id || null,
                    telephone: formData.telephone.trim() || null,
                    actif: formData.actif
                };
                await api.post('/api/users', createData);
                showToast({ message: 'Utilisateur créé avec succès', type: 'success' });
            }

            showModal = false;
            await loadUsers();
        } catch (error) {
            showToast({
                message: error.message || 'Erreur lors de l\'enregistrement',
                type: 'error'
            });
        }
    }

    async function handleResetPassword(user) {
        if (!confirm(`Réinitialiser le mot de passe de "${user.email}" ?\n\nCela générera un nouveau mot de passe temporaire et désactivera le MFA.`)) {
            return;
        }

        try {
            const response = await api.post(`/api/users/${user.id}/reset-password`, {});
            temporaryPassword = response.temporary_password;
            showPasswordModal = true;
            render();
            showToast({ message: 'Mot de passe réinitialisé avec succès', type: 'success' });
            await loadUsers(); // Refresh pour voir MFA désactivé
        } catch (error) {
            showToast({
                message: error.message || 'Erreur lors de la réinitialisation',
                type: 'error'
            });
        }
    }

    async function handleToggleStatus(user) {
        if (user.id === currentUserId) {
            showToast({ message: 'Vous ne pouvez pas désactiver votre propre compte', type: 'error' });
            return;
        }

        const action = user.actif ? 'désactiver' : 'activer';
        if (!confirm(`Êtes-vous sûr de vouloir ${action} l'utilisateur "${user.email}" ?`)) {
            return;
        }

        try {
            await api.patch(`/api/users/${user.id}/toggle-status`, {});
            showToast({
                message: `Utilisateur ${user.actif ? 'désactivé' : 'activé'} avec succès`,
                type: 'success'
            });
            await loadUsers();
        } catch (error) {
            showToast({
                message: error.message || 'Erreur lors du changement de statut',
                type: 'error'
            });
        }
    }

    // ========================================================================
    // Filtrage, tri et chargement
    // ========================================================================
    function filterUsers() {
        let filtered = [...users];

        // Filtre par recherche (email, nom, prénom)
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(u =>
                (u.email && u.email.toLowerCase().includes(term)) ||
                (u.nom && u.nom.toLowerCase().includes(term)) ||
                (u.prenom && u.prenom.toLowerCase().includes(term))
            );
        }

        // Filtre par rôle
        if (filterRole) {
            filtered = filtered.filter(u => u.roles && u.roles.includes(filterRole));
        }

        // Filtre par département
        if (filterDepartement) {
            filtered = filtered.filter(u => u.departement_id === filterDepartement);
        }

        // Filtre par statut
        if (filterStatus === 'active') {
            filtered = filtered.filter(u => u.actif);
        } else if (filterStatus === 'inactive') {
            filtered = filtered.filter(u => !u.actif);
        }

        // Tri dynamique
        filtered.sort((a, b) => {
            let aVal, bVal;

            switch(sortColumn) {
                case 'email':
                    aVal = a.email || '';
                    bVal = b.email || '';
                    break;
                case 'nom':
                    aVal = (a.nom || '') + ' ' + (a.prenom || '');
                    bVal = (b.nom || '') + ' ' + (b.prenom || '');
                    break;
                case 'roles':
                    aVal = (a.roles && a.roles.length > 0) ? a.roles[0] : '';
                    bVal = (b.roles && b.roles.length > 0) ? b.roles[0] : '';
                    break;
                case 'departement':
                    aVal = a.departement_nom || '';
                    bVal = b.departement_nom || '';
                    break;
                case 'statut':
                    aVal = a.actif ? 'actif' : 'inactif';
                    bVal = b.actif ? 'actif' : 'inactif';
                    break;
                default:
                    aVal = a.email || '';
                    bVal = b.email || '';
            }

            const comparison = aVal.toString().localeCompare(bVal.toString());
            return sortDirection === 'asc' ? comparison : -comparison;
        });

        filteredUsers = filtered;
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
        filterUsers();
        render();
    }

    async function loadUsers() {
        try {
            isLoading = true;
            render();

            const [usersData, departementsData, rolesData] = await Promise.all([
                api.get('/api/users'),
                api.get('/api/departements'),
                api.get('/api/roles')
            ]);

            users = usersData;
            departements = departementsData;
            rolesFromDB = rolesData;
            filterUsers();
            isLoading = false;
            render();
        } catch (error) {
            showToast({
                message: error.message || 'Erreur lors du chargement des utilisateurs',
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
            if (filteredUsers.length > 0) {
                container.appendChild(renderPagination());
            }
        }

        if (showModal) container.appendChild(renderModal());
        if (showPasswordModal) container.appendChild(renderPasswordModal());
    }

    // ========================================================================
    // Initialisation
    // ========================================================================
    loadUsers();
    return container;
}
