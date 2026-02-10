/**
 * Page d'administration des marchés
 * CRUD complet réservé aux décideurs
 */

import auth from '../modules/auth.js';
import api from '../modules/api.js';
import { Card, Button, Input, Modal, showToast, Spinner, Badge } from '../modules/ui.js';

export default function AdminMarchesPage() {
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
    let marches = [];
    let communes = [];
    let filteredMarches = [];
    let searchTerm = '';
    let editingMarche = null;
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
        commune_id: '',
        type_marche: 'quotidien',
        latitude: '',
        longitude: '',
        jours_ouverture: [],
        specialites: [],
        telephone: '',
        email: ''
    };

    // Header
    function renderHeader() {
        const header = document.createElement('div');
        header.className = 'flex justify-between items-center mb-6';

        const titleDiv = document.createElement('div');
        const title = document.createElement('h1');
        title.className = 'text-3xl font-bold text-gray-900';
        title.textContent = 'Marchés';

        const subtitle = document.createElement('p');
        subtitle.className = 'text-gray-600 mt-1';
        subtitle.textContent = 'Gestion des marchés locaux';

        titleDiv.appendChild(title);
        titleDiv.appendChild(subtitle);

        const addButton = Button({
            text: '+ Ajouter un marché',
            variant: 'primary',
            onClick: () => {
                editingMarche = null;
                formData = {
                    nom: '',
                    nom_creole: '',
                    code: '',
                    commune_id: '',
                    type_marche: 'quotidien',
                    latitude: '',
                    longitude: '',
                    jours_ouverture: [],
                    specialites: [],
                    telephone: '',
                    email: ''
                };
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
        searchInput.placeholder = 'Rechercher un marché...';
        searchInput.className = 'w-full md:w-96 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
        searchInput.value = searchTerm;
        searchInput.addEventListener('input', (e) => {
            searchTerm = e.target.value;
            currentPage = 1; // Reset to first page
            filterMarches();
            render();
        });

        searchBar.appendChild(searchInput);
        return searchBar;
    }

    // Tableau des marchés
    function renderTable() {
        const card = Card({
            children: [
                (() => {
                    const wrapper = document.createElement('div');
                    wrapper.className = 'overflow-x-auto';

                    if (filteredMarches.length === 0) {
                        const empty = document.createElement('div');
                        empty.className = 'text-center py-12';
                        empty.innerHTML = `
                            <p class="text-gray-500">
                                ${searchTerm ? 'Aucun marché trouvé' : 'Aucun marché'}
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
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Commune</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">GPS</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
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
                    const pageItems = filteredMarches.slice(startIndex, endIndex);

                    pageItems.forEach(marche => {
                        const row = document.createElement('tr');
                        row.className = 'hover:bg-gray-50';

                        // Code
                        const codeCell = document.createElement('td');
                        codeCell.className = 'px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900';
                        codeCell.textContent = marche.code;
                        row.appendChild(codeCell);

                        // Nom
                        const nomCell = document.createElement('td');
                        nomCell.className = 'px-6 py-4';
                        const nomDiv = document.createElement('div');
                        const nomText = document.createElement('div');
                        nomText.className = 'text-sm font-medium text-gray-900';
                        nomText.textContent = marche.nom;
                        const creoleText = document.createElement('div');
                        creoleText.className = 'text-sm text-gray-500';
                        creoleText.textContent = marche.nom_creole || '';
                        nomDiv.appendChild(nomText);
                        if (marche.nom_creole) {
                            nomDiv.appendChild(creoleText);
                        }
                        nomCell.appendChild(nomDiv);
                        row.appendChild(nomCell);

                        // Commune
                        const communeCell = document.createElement('td');
                        communeCell.className = 'px-6 py-4';
                        const communeDiv = document.createElement('div');
                        const communeText = document.createElement('div');
                        communeText.className = 'text-sm text-gray-900';
                        communeText.textContent = marche.commune_nom || '-';
                        const deptText = document.createElement('div');
                        deptText.className = 'text-xs text-gray-500';
                        deptText.textContent = marche.departement_nom || '';
                        communeDiv.appendChild(communeText);
                        if (marche.departement_nom) {
                            communeDiv.appendChild(deptText);
                        }
                        communeCell.appendChild(communeDiv);
                        row.appendChild(communeCell);

                        // Type
                        const typeCell = document.createElement('td');
                        typeCell.className = 'px-6 py-4 whitespace-nowrap';
                        const typeBadge = Badge({
                            text: marche.type_marche,
                            variant: 'default'
                        });
                        typeCell.appendChild(typeBadge);
                        row.appendChild(typeCell);

                        // GPS (Coordonnées)
                        const gpsCell = document.createElement('td');
                        gpsCell.className = 'px-6 py-4 text-sm text-gray-900';
                        if (marche.latitude && marche.longitude) {
                            const gpsDiv = document.createElement('div');
                            const latText = document.createElement('div');
                            latText.className = 'text-xs';
                            latText.textContent = `Lat: ${marche.latitude.toFixed(6)}`;
                            const lonText = document.createElement('div');
                            lonText.className = 'text-xs';
                            lonText.textContent = `Lon: ${marche.longitude.toFixed(6)}`;
                            gpsDiv.appendChild(latText);
                            gpsDiv.appendChild(lonText);
                            gpsCell.appendChild(gpsDiv);
                        } else {
                            gpsCell.textContent = '-';
                        }
                        row.appendChild(gpsCell);

                        // Statut
                        const statutCell = document.createElement('td');
                        statutCell.className = 'px-6 py-4 whitespace-nowrap';
                        const statutBadge = Badge({
                            text: marche.actif ? 'Actif' : 'Inactif',
                            variant: marche.actif ? 'success' : 'default'
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
                            onClick: () => handleEdit(marche)
                        });

                        const deleteBtn = Button({
                            text: 'Supprimer',
                            variant: 'danger',
                            className: 'text-sm',
                            onClick: () => handleDelete(marche)
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
        if (filteredMarches.length === 0) {
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
        const endIndex = Math.min(currentPage * itemsPerPage, filteredMarches.length);
        info.textContent = `${startIndex}-${endIndex} sur ${filteredMarches.length}`;

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
            filterMarches();
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
        modalContent.className = 'space-y-4 max-h-[80vh] overflow-y-auto';

        const title = document.createElement('h2');
        title.className = 'text-xl font-bold text-gray-900 mb-4';
        title.textContent = editingMarche ? 'Modifier le marché' : 'Ajouter un marché';
        modalContent.appendChild(title);

        // Première ligne : Code et Nom
        const firstRow = document.createElement('div');
        firstRow.className = 'grid grid-cols-2 gap-4';

        // Champ Code
        const codeGroup = document.createElement('div');
        const codeLabel = document.createElement('label');
        codeLabel.className = 'block text-sm font-medium text-gray-700 mb-1';
        codeLabel.innerHTML = '<span class="text-red-500">*</span> Code marché';

        const codeInput = document.createElement('input');
        codeInput.type = 'text';
        codeInput.required = true;
        codeInput.placeholder = 'MAR-000001';
        codeInput.className = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
        codeInput.value = formData.code;
        codeInput.addEventListener('input', (e) => {
            formData.code = e.target.value;
        });

        codeGroup.appendChild(codeLabel);
        codeGroup.appendChild(codeInput);

        // Champ Nom
        const nomGroup = document.createElement('div');
        const nomLabel = document.createElement('label');
        nomLabel.className = 'block text-sm font-medium text-gray-700 mb-1';
        nomLabel.innerHTML = '<span class="text-red-500">*</span> Nom du marché';

        const nomInput = document.createElement('input');
        nomInput.type = 'text';
        nomInput.required = true;
        nomInput.placeholder = 'Marché de Pétion-Ville';
        nomInput.className = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
        nomInput.value = formData.nom;
        nomInput.addEventListener('input', (e) => {
            formData.nom = e.target.value;
        });

        nomGroup.appendChild(nomLabel);
        nomGroup.appendChild(nomInput);

        firstRow.appendChild(codeGroup);
        firstRow.appendChild(nomGroup);
        modalContent.appendChild(firstRow);

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

        // Deuxième ligne : Commune et Type
        const secondRow = document.createElement('div');
        secondRow.className = 'grid grid-cols-2 gap-4';

        // Champ Commune
        const communeGroup = document.createElement('div');
        const communeLabel = document.createElement('label');
        communeLabel.className = 'block text-sm font-medium text-gray-700 mb-1';
        communeLabel.innerHTML = '<span class="text-red-500">*</span> Commune';

        const communeSelect = document.createElement('select');
        communeSelect.required = true;
        communeSelect.className = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
        communeSelect.innerHTML = '<option value="">Sélectionner une commune</option>';
        communes.forEach(commune => {
            const option = document.createElement('option');
            option.value = commune.id;
            option.textContent = `${commune.nom}${commune.departement_nom ? ' (' + commune.departement_nom + ')' : ''}`;
            option.selected = formData.commune_id === commune.id;
            communeSelect.appendChild(option);
        });
        communeSelect.addEventListener('change', (e) => {
            formData.commune_id = e.target.value;
        });

        communeGroup.appendChild(communeLabel);
        communeGroup.appendChild(communeSelect);

        // Champ Type
        const typeGroup = document.createElement('div');
        const typeLabel = document.createElement('label');
        typeLabel.className = 'block text-sm font-medium text-gray-700 mb-1';
        typeLabel.innerHTML = '<span class="text-red-500">*</span> Type de marché';

        const typeSelect = document.createElement('select');
        typeSelect.required = true;
        typeSelect.className = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
        typeSelect.innerHTML = `
            <option value="quotidien" ${formData.type_marche === 'quotidien' ? 'selected' : ''}>Quotidien</option>
            <option value="hebdomadaire" ${formData.type_marche === 'hebdomadaire' ? 'selected' : ''}>Hebdomadaire</option>
            <option value="occasionnel" ${formData.type_marche === 'occasionnel' ? 'selected' : ''}>Occasionnel</option>
        `;
        typeSelect.addEventListener('change', (e) => {
            formData.type_marche = e.target.value;
        });

        typeGroup.appendChild(typeLabel);
        typeGroup.appendChild(typeSelect);

        secondRow.appendChild(communeGroup);
        secondRow.appendChild(typeGroup);
        modalContent.appendChild(secondRow);

        // Troisième ligne : GPS (Latitude et Longitude)
        const gpsRow = document.createElement('div');
        gpsRow.className = 'grid grid-cols-2 gap-4';

        // Champ Latitude
        const latGroup = document.createElement('div');
        const latLabel = document.createElement('label');
        latLabel.className = 'block text-sm font-medium text-gray-700 mb-1';
        latLabel.textContent = 'Latitude (optionnel)';

        const latInput = document.createElement('input');
        latInput.type = 'number';
        latInput.step = '0.000001';
        latInput.placeholder = '18.5125';
        latInput.className = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
        latInput.value = formData.latitude;
        latInput.addEventListener('input', (e) => {
            formData.latitude = e.target.value ? parseFloat(e.target.value) : null;
        });

        latGroup.appendChild(latLabel);
        latGroup.appendChild(latInput);

        // Champ Longitude
        const lonGroup = document.createElement('div');
        const lonLabel = document.createElement('label');
        lonLabel.className = 'block text-sm font-medium text-gray-700 mb-1';
        lonLabel.textContent = 'Longitude (optionnel)';

        const lonInput = document.createElement('input');
        lonInput.type = 'number';
        lonInput.step = '0.000001';
        lonInput.placeholder = '-72.2853';
        lonInput.className = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
        lonInput.value = formData.longitude;
        lonInput.addEventListener('input', (e) => {
            formData.longitude = e.target.value ? parseFloat(e.target.value) : null;
        });

        lonGroup.appendChild(lonLabel);
        lonGroup.appendChild(lonInput);

        gpsRow.appendChild(latGroup);
        gpsRow.appendChild(lonGroup);
        modalContent.appendChild(gpsRow);

        // Quatrième ligne : Téléphone et Email
        const contactRow = document.createElement('div');
        contactRow.className = 'grid grid-cols-2 gap-4';

        // Champ Téléphone
        const telGroup = document.createElement('div');
        const telLabel = document.createElement('label');
        telLabel.className = 'block text-sm font-medium text-gray-700 mb-1';
        telLabel.textContent = 'Téléphone (optionnel)';

        const telInput = document.createElement('input');
        telInput.type = 'tel';
        telInput.placeholder = '+509 1234 5678';
        telInput.className = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
        telInput.value = formData.telephone;
        telInput.addEventListener('input', (e) => {
            formData.telephone = e.target.value;
        });

        telGroup.appendChild(telLabel);
        telGroup.appendChild(telInput);

        // Champ Email
        const emailGroup = document.createElement('div');
        const emailLabel = document.createElement('label');
        emailLabel.className = 'block text-sm font-medium text-gray-700 mb-1';
        emailLabel.textContent = 'Email (optionnel)';

        const emailInput = document.createElement('input');
        emailInput.type = 'email';
        emailInput.placeholder = 'contact@marche.ht';
        emailInput.className = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
        emailInput.value = formData.email;
        emailInput.addEventListener('input', (e) => {
            formData.email = e.target.value;
        });

        emailGroup.appendChild(emailLabel);
        emailGroup.appendChild(emailInput);

        contactRow.appendChild(telGroup);
        contactRow.appendChild(emailGroup);
        modalContent.appendChild(contactRow);

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
            text: editingMarche ? 'Enregistrer' : 'Créer',
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
    function handleEdit(marche) {
        editingMarche = marche;
        formData = {
            nom: marche.nom,
            nom_creole: marche.nom_creole || '',
            code: marche.code,
            commune_id: marche.commune_id,
            type_marche: marche.type_marche,
            latitude: marche.latitude || '',
            longitude: marche.longitude || '',
            jours_ouverture: marche.jours_ouverture || [],
            specialites: marche.specialites || [],
            telephone: marche.telephone || '',
            email: marche.email || ''
        };
        showModal = true;
        render();
    }

    async function handleDelete(marche) {
        if (!confirm(`Êtes-vous sûr de vouloir supprimer le marché "${marche.nom}" ?`)) {
            return;
        }

        try {
            await api.delete(`/api/marches/${marche.id}`);
            showToast({
                message: 'Marché supprimé avec succès',
                type: 'success'
            });
            await loadMarches();
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
                message: 'Le nom du marché est obligatoire',
                type: 'error'
            });
            return;
        }
        if (!formData.code.trim()) {
            showToast({
                message: 'Le code du marché est obligatoire',
                type: 'error'
            });
            return;
        }
        if (!formData.commune_id) {
            showToast({
                message: 'La commune est obligatoire',
                type: 'error'
            });
            return;
        }

        try {
            if (editingMarche) {
                // Mise à jour
                await api.put(`/api/marches/${editingMarche.id}`, formData);
                showToast({
                    message: 'Marché modifié avec succès',
                    type: 'success'
                });
            } else {
                // Création
                await api.post('/api/marches', formData);
                showToast({
                    message: 'Marché créé avec succès',
                    type: 'success'
                });
            }

            showModal = false;
            await loadMarches();
        } catch (error) {
            showToast({
                message: error.message || 'Erreur lors de l\'enregistrement',
                type: 'error'
            });
        }
    }

    function filterMarches() {
        let filtered;
        if (!searchTerm.trim()) {
            filtered = [...marches];
        } else {
            const term = searchTerm.toLowerCase();
            filtered = marches.filter(marche =>
                marche.nom.toLowerCase().includes(term) ||
                marche.code.toLowerCase().includes(term) ||
                (marche.nom_creole && marche.nom_creole.toLowerCase().includes(term)) ||
                (marche.commune_nom && marche.commune_nom.toLowerCase().includes(term)) ||
                (marche.departement_nom && marche.departement_nom.toLowerCase().includes(term))
            );
        }

        // Tri alphabétique par nom
        filtered.sort((a, b) => a.nom.localeCompare(b.nom));

        filteredMarches = filtered;

        // Calculer le nombre de pages
        totalPages = Math.max(1, Math.ceil(filteredMarches.length / itemsPerPage));

        // Ajuster la page courante si nécessaire
        if (currentPage > totalPages) {
            currentPage = totalPages;
        }
    }

    // Chargement des données
    async function loadMarches() {
        try {
            isLoading = true;
            render();

            // Charger en parallèle
            const [marchesData, communesData] = await Promise.all([
                api.get('/api/marches?actif=true'),
                api.get('/api/communes?actif=true')
            ]);

            marches = marchesData;
            communes = communesData;

            filterMarches();
            isLoading = false;
            render();
        } catch (error) {
            console.error('Erreur lors du chargement:', error);
            showToast({
                message: 'Erreur lors du chargement des marchés',
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
            if (filteredMarches.length > 0) {
                container.appendChild(renderPagination());
            }
        }

        if (showModal) {
            container.appendChild(renderModal());
        }
    }

    // Initialisation
    loadMarches();
    render();

    return container;
}
