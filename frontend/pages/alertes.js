/**
 * Page de consultation et résolution des alertes
 * Affichage des alertes avec filtres, carte interactive et actions
 */

import auth from '../modules/auth.js';
import api from '../modules/api.js';
import { Card, Button, Modal, showToast, Spinner, Badge } from '../modules/ui.js';

export default function AlertesPage() {
    const container = document.createElement('div');
    container.className = 'space-y-6';

    const user = auth.getCurrentUser();
    const isDecideur = auth.hasRole('décideur');

    // État
    let isLoading = true;
    let alertes = [];
    let filteredAlertes = [];
    let departements = [];
    let marches = [];
    let produits = [];

    // Filtres
    let searchTerm = '';
    let selectedNiveau = '';
    let selectedStatut = '';
    let selectedDepartement = '';
    let selectedMarche = '';
    let selectedProduit = '';

    // Lire les paramètres d'URL pour pré-sélectionner les filtres
    function initFiltersFromURL() {
        const hash = window.location.hash;
        const queryString = hash.includes('?') ? hash.split('?')[1] : '';

        if (queryString) {
            const params = new URLSearchParams(queryString);

            if (params.has('niveau')) {
                selectedNiveau = params.get('niveau');
            }
            if (params.has('statut')) {
                selectedStatut = params.get('statut');
            }
            if (params.has('departement')) {
                selectedDepartement = params.get('departement');
            }
            if (params.has('marche')) {
                selectedMarche = params.get('marche');
            }
            if (params.has('produit')) {
                selectedProduit = params.get('produit');
            }
        }
    }

    // Pagination
    let currentPage = 1;
    let itemsPerPage = 10;
    let totalPages = 1;

    // Modal détails
    let showDetailsModal = false;
    let selectedAlerte = null;

    // Carte Leaflet
    let map = null;
    let markers = [];

    // Header
    function renderHeader() {
        const header = document.createElement('div');
        header.className = 'flex justify-between items-center mb-6';

        const titleDiv = document.createElement('div');
        const title = document.createElement('h1');
        title.className = 'text-3xl font-bold text-gray-900';
        title.textContent = 'Alertes';

        const subtitle = document.createElement('p');
        subtitle.className = 'text-gray-600 mt-1';
        subtitle.textContent = 'Système d\'alerte précoce sur les prix';

        titleDiv.appendChild(title);
        titleDiv.appendChild(subtitle);

        header.appendChild(titleDiv);

        return header;
    }

    // Statistiques résumées
    function renderStats() {
        const stats = document.createElement('div');
        stats.className = 'grid grid-cols-1 md:grid-cols-4 gap-4 mb-6';

        const totalActives = alertes.filter(a => a.statut === 'active').length;
        const surveillance = alertes.filter(a => a.niveau === 'surveillance' && a.statut === 'active').length;
        const alerte = alertes.filter(a => a.niveau === 'alerte' && a.statut === 'active').length;
        const urgence = alertes.filter(a => a.niveau === 'urgence' && a.statut === 'active').length;

        const statsData = [
            { label: 'Alertes actives', value: totalActives, color: 'blue' },
            { label: 'Surveillance', value: surveillance, color: 'yellow' },
            { label: 'Alerte', value: alerte, color: 'orange' },
            { label: 'Urgence', value: urgence, color: 'red' }
        ];

        statsData.forEach(stat => {
            const statCard = document.createElement('div');
            statCard.className = `bg-white p-4 rounded-lg shadow border-l-4 border-${stat.color}-500`;
            statCard.innerHTML = `
                <p class="text-sm text-gray-600">${stat.label}</p>
                <p class="text-2xl font-bold text-gray-900">${stat.value}</p>
            `;
            stats.appendChild(statCard);
        });

        return stats;
    }

    // Filtres
    function renderFilters() {
        const filters = document.createElement('div');
        filters.className = 'bg-white p-4 rounded-lg shadow mb-6';

        const title = document.createElement('h3');
        title.className = 'text-lg font-semibold mb-4';
        title.textContent = 'Filtres';

        const grid = document.createElement('div');
        grid.className = 'grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4';

        // Recherche
        const searchDiv = document.createElement('div');
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'Rechercher...';
        searchInput.className = 'w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500';
        searchInput.value = searchTerm;
        searchInput.addEventListener('input', (e) => {
            searchTerm = e.target.value;
            filterAlertes();
            updateTableAndStats();
        });
        searchDiv.appendChild(searchInput);

        // Niveau
        const niveauDiv = document.createElement('div');
        const niveauSelect = document.createElement('select');
        niveauSelect.className = 'w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500';
        niveauSelect.innerHTML = `
            <option value="">Tous les niveaux</option>
            <option value="surveillance">Surveillance</option>
            <option value="alerte">Alerte</option>
            <option value="urgence">Urgence</option>
        `;
        niveauSelect.value = selectedNiveau;
        niveauSelect.addEventListener('change', (e) => {
            selectedNiveau = e.target.value;
            filterAlertes();
            updateTableAndStats();
        });
        niveauDiv.appendChild(niveauSelect);

        // Statut
        const statutDiv = document.createElement('div');
        const statutSelect = document.createElement('select');
        statutSelect.className = 'w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500';
        statutSelect.innerHTML = `
            <option value="">Tous les statuts</option>
            <option value="active">Active</option>
            <option value="resolue">Résolue</option>
        `;
        statutSelect.value = selectedStatut;
        statutSelect.addEventListener('change', (e) => {
            selectedStatut = e.target.value;
            filterAlertes();
            updateTableAndStats();
        });
        statutDiv.appendChild(statutSelect);

        // Département
        const deptDiv = document.createElement('div');
        const deptSelect = document.createElement('select');
        deptSelect.className = 'w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500';
        deptSelect.innerHTML = '<option value="">Tous les départements</option>';
        departements.forEach(dept => {
            const option = document.createElement('option');
            option.value = dept.id;
            option.textContent = dept.nom;
            deptSelect.appendChild(option);
        });
        deptSelect.value = selectedDepartement;
        deptSelect.addEventListener('change', (e) => {
            selectedDepartement = e.target.value;
            filterAlertes();
            updateTableAndStats();
        });
        deptDiv.appendChild(deptSelect);

        // Marché
        const marcheDiv = document.createElement('div');
        const marcheSelect = document.createElement('select');
        marcheSelect.className = 'w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500';
        marcheSelect.innerHTML = '<option value="">Tous les marchés</option>';
        marches.forEach(marche => {
            const option = document.createElement('option');
            option.value = marche.id;
            option.textContent = marche.nom;
            marcheSelect.appendChild(option);
        });
        marcheSelect.value = selectedMarche;
        marcheSelect.addEventListener('change', (e) => {
            selectedMarche = e.target.value;
            filterAlertes();
            updateTableAndStats();
        });
        marcheDiv.appendChild(marcheSelect);

        // Produit
        const produitDiv = document.createElement('div');
        const produitSelect = document.createElement('select');
        produitSelect.className = 'w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500';
        produitSelect.innerHTML = '<option value="">Tous les produits</option>';
        produits.forEach(produit => {
            const option = document.createElement('option');
            option.value = produit.id;
            option.textContent = produit.nom;
            produitSelect.appendChild(option);
        });
        produitSelect.value = selectedProduit;
        produitSelect.addEventListener('change', (e) => {
            selectedProduit = e.target.value;
            filterAlertes();
            updateTableAndStats();
        });
        produitDiv.appendChild(produitSelect);

        grid.appendChild(searchDiv);
        grid.appendChild(niveauDiv);
        grid.appendChild(statutDiv);
        grid.appendChild(deptDiv);
        grid.appendChild(marcheDiv);
        grid.appendChild(produitDiv);

        filters.appendChild(title);
        filters.appendChild(grid);

        return filters;
    }

    // Carte interactive
    function renderMap() {
        const mapContainer = document.createElement('div');
        mapContainer.className = 'bg-white p-4 rounded-lg shadow mb-6';

        const title = document.createElement('h3');
        title.className = 'text-lg font-semibold mb-4';
        title.textContent = 'Carte des alertes';

        const mapDiv = document.createElement('div');
        mapDiv.id = 'alertes-map';
        mapDiv.style.height = '400px';
        mapDiv.className = 'rounded-lg';

        mapContainer.appendChild(title);
        mapContainer.appendChild(mapDiv);

        // Initialiser la carte après le rendu
        setTimeout(() => initMap(), 100);

        return mapContainer;
    }

    function initMap() {
        if (typeof L === 'undefined') {
            console.warn('Leaflet not loaded');
            return;
        }

        // Supprimer ancienne carte si existe
        if (map) {
            map.remove();
            map = null;
        }

        // Créer nouvelle carte centrée sur Haïti
        map = L.map('alertes-map').setView([18.9712, -72.2852], 8);

        // Ajouter tuiles OpenStreetMap
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        // Grouper les alertes par marché
        const alertesParMarche = {};
        filteredAlertes.forEach(alerte => {
            if (alerte.marche_gps && alerte.marche_gps.latitude && alerte.marche_gps.longitude) {
                if (!alertesParMarche[alerte.marche_id]) {
                    alertesParMarche[alerte.marche_id] = {
                        marche_nom: alerte.marche_nom,
                        lat: alerte.marche_gps.latitude,
                        lon: alerte.marche_gps.longitude,
                        alertes: []
                    };
                }
                alertesParMarche[alerte.marche_id].alertes.push(alerte);
            }
        });

        // Fonction pour déterminer le niveau le plus élevé
        function getNiveauMax(alertes) {
            if (alertes.some(a => a.niveau === 'urgence')) return 'urgence';
            if (alertes.some(a => a.niveau === 'alerte')) return 'alerte';
            return 'surveillance';
        }

        // Fonction pour obtenir la couleur et le style selon le niveau
        function getColorStyle(niveau) {
            switch(niveau) {
                case 'urgence':
                    return { color: 'red', bg: '#fee', textColor: '#b91c1c' };
                case 'alerte':
                    return { color: 'orange', bg: '#ffedd5', textColor: '#c2410c' };
                case 'surveillance':
                    return { color: 'yellow', bg: '#fef9c3', textColor: '#a16207' };
                default:
                    return { color: 'gray', bg: '#f3f4f6', textColor: '#4b5563' };
            }
        }

        // Ajouter un marqueur par marché
        markers = [];
        Object.values(alertesParMarche).forEach(marcheData => {
            const niveauMax = getNiveauMax(marcheData.alertes);
            const style = getColorStyle(niveauMax);

            const marker = L.circleMarker([marcheData.lat, marcheData.lon], {
                radius: 10,
                fillColor: style.color,
                color: '#fff',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.8
            }).addTo(map);

            // Popup avec toutes les alertes du marché
            let popupContent = `
                <div style="min-width: 200px;">
                    <strong style="font-size: 14px;">${marcheData.marche_nom}</strong>
                    <div style="margin-top: 8px;">
                        <span style="font-size: 12px; color: #666;">${marcheData.alertes.length} alerte(s)</span>
                    </div>
                    <div style="margin-top: 8px; border-top: 1px solid #e5e7eb; padding-top: 8px;">
            `;

            marcheData.alertes.forEach(alerte => {
                const alerteStyle = getColorStyle(alerte.niveau);
                popupContent += `
                    <div style="margin-bottom: 8px; padding: 6px; background: ${alerteStyle.bg}; border-radius: 4px;">
                        <strong style="color: #1f2937;">${alerte.produit_nom}</strong><br>
                        <span style="background: ${alerteStyle.textColor}; color: white; padding: 2px 6px; border-radius: 3px; font-size: 11px; font-weight: bold;">
                            ${alerte.niveau.toUpperCase()}
                        </span>
                        <span style="color: #4b5563; font-size: 12px;"> +${alerte.ecart_pourcentage.toFixed(1)}%</span><br>
                        <span style="color: #6b7280; font-size: 12px;">Prix: ${alerte.prix_actuel.toFixed(2)} HTG</span>
                    </div>
                `;
            });

            popupContent += `
                    </div>
                </div>
            `;

            marker.bindPopup(popupContent);
            markers.push(marker);
        });
    }

    // Badge niveau
    function renderNiveauBadge(niveau) {
        let colorClass = '';
        let icon = '';

        switch(niveau) {
            case 'surveillance':
                colorClass = 'bg-yellow-100 text-yellow-800';
                icon = '👁️';
                break;
            case 'alerte':
                colorClass = 'bg-orange-100 text-orange-800';
                icon = '⚠️';
                break;
            case 'urgence':
                colorClass = 'bg-red-100 text-red-800';
                icon = '🚨';
                break;
            default:
                colorClass = 'bg-gray-100 text-gray-800';
        }

        const badge = document.createElement('span');
        badge.className = `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`;
        badge.textContent = `${icon} ${niveau.charAt(0).toUpperCase() + niveau.slice(1)}`;

        return badge;
    }

    // Badge statut
    function renderStatutBadge(statut) {
        const colorClass = statut === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800';

        const badge = document.createElement('span');
        badge.className = `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`;
        badge.textContent = statut === 'active' ? 'Active' : 'Résolue';

        return badge;
    }

    // Table
    function renderTable() {
        const card = Card({
            title: `${filteredAlertes.length} alerte(s)`,
            children: renderTableContent()
        });

        return card;
    }

    function renderTableContent() {
        const div = document.createElement('div');
        div.className = 'p-4';

        // Conteneur avec scroll horizontal pour les grandes tables
        const tableWrapper = document.createElement('div');
        tableWrapper.className = 'overflow-x-auto';

        if (isLoading) {
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'flex justify-center py-8';
            loadingDiv.appendChild(Spinner());
            div.appendChild(loadingDiv);
            return div;
        }

        if (filteredAlertes.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'text-center text-gray-500 py-8';
            empty.textContent = 'Aucune alerte trouvée';
            div.appendChild(empty);
            return div;
        }

        // Table
        const table = document.createElement('table');
        table.className = 'min-w-full divide-y divide-gray-200';

        // En-tête
        const thead = document.createElement('thead');
        thead.className = 'bg-gray-50';
        thead.innerHTML = `
            <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produit</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Marché</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Niveau</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Variation</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prix</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
        `;
        table.appendChild(thead);

        // Corps
        const tbody = document.createElement('tbody');
        tbody.className = 'bg-white divide-y divide-gray-200';

        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const paginatedAlertes = filteredAlertes.slice(startIndex, endIndex);

        paginatedAlertes.forEach(alerte => {
            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-50';

            // Date
            const dateCell = document.createElement('td');
            dateCell.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-900';
            const date = new Date(alerte.created_at);
            dateCell.textContent = date.toLocaleDateString('fr-FR');
            row.appendChild(dateCell);

            // Produit
            const produitCell = document.createElement('td');
            produitCell.className = 'px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900';
            produitCell.textContent = alerte.produit_nom || '-';
            row.appendChild(produitCell);

            // Marché
            const marcheCell = document.createElement('td');
            marcheCell.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-900';
            marcheCell.textContent = alerte.marche_nom || '-';
            row.appendChild(marcheCell);

            // Niveau
            const niveauCell = document.createElement('td');
            niveauCell.className = 'px-6 py-4 whitespace-nowrap';
            niveauCell.appendChild(renderNiveauBadge(alerte.niveau));
            row.appendChild(niveauCell);

            // Variation
            const variationCell = document.createElement('td');
            variationCell.className = 'px-6 py-4 whitespace-nowrap text-sm font-semibold text-red-600';
            variationCell.textContent = `+${alerte.ecart_pourcentage.toFixed(1)}%`;
            row.appendChild(variationCell);

            // Prix
            const prixCell = document.createElement('td');
            prixCell.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-900';
            prixCell.textContent = `${alerte.prix_actuel} HTG`;
            row.appendChild(prixCell);

            // Actions
            const actionsCell = document.createElement('td');
            actionsCell.className = 'px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2';

            // Détails
            const detailsBtn = Button({
                text: 'Détails',
                variant: 'secondary',
                size: 'sm',
                onClick: () => {
                    selectedAlerte = alerte;
                    showDetailsModal = true;
                    render();
                }
            });
            actionsCell.appendChild(detailsBtn);

            // Résoudre (décideurs seulement, si active)
            if (isDecideur && alerte.statut === 'active') {
                const resoudreBtn = Button({
                    text: '✓ Résoudre',
                    variant: 'primary',
                    size: 'sm',
                    onClick: () => resoudreAlerte(alerte.id)
                });
                actionsCell.appendChild(resoudreBtn);
            }

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
        paginationDiv.className = 'flex items-center justify-between px-4 py-3 border-t border-gray-200';

        // Info
        const info = document.createElement('div');
        info.className = 'text-sm text-gray-700';
        const startIndex = (currentPage - 1) * itemsPerPage + 1;
        const endIndex = Math.min(currentPage * itemsPerPage, filteredAlertes.length);
        info.textContent = `Affichage ${startIndex} à ${endIndex} sur ${filteredAlertes.length} résultat(s)`;

        // Contrôles
        const controls = document.createElement('div');
        controls.className = 'flex items-center space-x-2';

        // Items par page
        const perPageLabel = document.createElement('label');
        perPageLabel.className = 'text-sm text-gray-700 mr-2';
        perPageLabel.textContent = 'Par page:';

        const perPageSelect = document.createElement('select');
        perPageSelect.className = 'border border-gray-300 rounded-md px-2 py-1 text-sm';
        perPageSelect.innerHTML = `
            <option value="5">5</option>
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
        `;
        perPageSelect.value = itemsPerPage.toString();
        perPageSelect.addEventListener('change', (e) => {
            itemsPerPage = parseInt(e.target.value);
            currentPage = 1;
            render();
        });

        // Boutons navigation
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

        controls.appendChild(perPageLabel);
        controls.appendChild(perPageSelect);
        controls.appendChild(prevBtn);
        controls.appendChild(nextBtn);

        paginationDiv.appendChild(info);
        paginationDiv.appendChild(controls);

        return paginationDiv;
    }

    // Modal détails
    function renderDetailsModal() {
        if (!showDetailsModal || !selectedAlerte) {
            return document.createElement('div');
        }

        const content = document.createElement('div');
        content.className = 'space-y-4';

        // Informations générales
        const infoSection = document.createElement('div');
        infoSection.innerHTML = `
            <h3 class="text-lg font-semibold mb-3">Informations générales</h3>
            <div class="grid grid-cols-2 gap-4 text-sm">
                <div>
                    <span class="font-medium">Produit:</span> ${selectedAlerte.produit_nom}
                </div>
                <div>
                    <span class="font-medium">Marché:</span> ${selectedAlerte.marche_nom}
                </div>
                <div>
                    <span class="font-medium">Commune:</span> ${selectedAlerte.commune_nom}
                </div>
                <div>
                    <span class="font-medium">Département:</span> ${selectedAlerte.departement_nom}
                </div>
                <div>
                    <span class="font-medium">Date:</span> ${new Date(selectedAlerte.created_at).toLocaleString('fr-FR')}
                </div>
                <div>
                    <span class="font-medium">Statut:</span> ${selectedAlerte.statut}
                </div>
            </div>
        `;
        content.appendChild(infoSection);

        // Prix et variation
        const prixSection = document.createElement('div');
        prixSection.innerHTML = `
            <h3 class="text-lg font-semibold mb-3">Prix et variation</h3>
            <div class="grid grid-cols-3 gap-4 text-sm">
                <div class="bg-blue-50 p-3 rounded">
                    <p class="text-xs text-gray-600">Prix de référence</p>
                    <p class="text-lg font-bold">${selectedAlerte.prix_reference.toFixed(2)} HTG</p>
                </div>
                <div class="bg-red-50 p-3 rounded">
                    <p class="text-xs text-gray-600">Prix actuel</p>
                    <p class="text-lg font-bold">${selectedAlerte.prix_actuel.toFixed(2)} HTG</p>
                </div>
                <div class="bg-orange-50 p-3 rounded">
                    <p class="text-xs text-gray-600">Variation</p>
                    <p class="text-lg font-bold text-red-600">+${selectedAlerte.ecart_pourcentage.toFixed(1)}%</p>
                </div>
            </div>
        `;
        content.appendChild(prixSection);

        // Niveau
        const niveauSection = document.createElement('div');
        niveauSection.className = 'flex items-center space-x-2';
        const niveauLabel = document.createElement('span');
        niveauLabel.className = 'font-medium';
        niveauLabel.textContent = 'Niveau d\'alerte:';
        niveauSection.appendChild(niveauLabel);
        niveauSection.appendChild(renderNiveauBadge(selectedAlerte.niveau));
        content.appendChild(niveauSection);

        return Modal({
            isOpen: showDetailsModal,
            title: 'Détails de l\'alerte',
            content: content,
            onClose: () => {
                showDetailsModal = false;
                selectedAlerte = null;
                render();
            }
        });
    }

    // Filtrage
    function filterAlertes() {
        filteredAlertes = alertes.filter(alerte => {
            // Recherche
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                const matchProduit = alerte.produit_nom?.toLowerCase().includes(term);
                const matchMarche = alerte.marche_nom?.toLowerCase().includes(term);
                const matchCommune = alerte.commune_nom?.toLowerCase().includes(term);
                if (!matchProduit && !matchMarche && !matchCommune) {
                    return false;
                }
            }

            // Niveau
            if (selectedNiveau && alerte.niveau !== selectedNiveau) {
                return false;
            }

            // Statut
            if (selectedStatut && alerte.statut !== selectedStatut) {
                return false;
            }

            // Département
            if (selectedDepartement && alerte.departement_id !== selectedDepartement) {
                return false;
            }

            // Marché
            if (selectedMarche && alerte.marche_id !== selectedMarche) {
                return false;
            }

            // Produit
            if (selectedProduit && alerte.produit_id !== selectedProduit) {
                return false;
            }

            return true;
        });

        totalPages = Math.ceil(filteredAlertes.length / itemsPerPage);
    }

    // Actions
    async function resoudreAlerte(alerteId) {
        if (!confirm('Voulez-vous vraiment résoudre cette alerte ?')) {
            return;
        }

        try {
            await api.post(`/api/alertes/${alerteId}/resoudre`);
            showToast('Alerte résolue avec succès', 'success');
            await loadAlertes();
        } catch (error) {
            showToast(error.message || 'Erreur lors de la résolution', 'error');
        }
    }

    // Chargement données
    async function loadAll() {
        // Initialiser les filtres depuis l'URL AVANT de charger les données
        initFiltersFromURL();

        await Promise.all([
            loadAlertes(),
            loadDepartements(),
            loadMarches(),
            loadProduits()
        ]);
    }

    async function loadAlertes() {
        isLoading = true;
        render();

        try {
            alertes = await api.get('/api/alertes');
            filterAlertes();
        } catch (error) {
            showToast(error.message || 'Erreur lors du chargement des alertes', 'error');
            alertes = [];
            filteredAlertes = [];
        } finally {
            isLoading = false;
            render();
        }
    }

    async function loadDepartements() {
        try {
            departements = await api.get('/api/departements');
        } catch (error) {
            console.error('Erreur chargement départements:', error);
            departements = [];
        }
    }

    async function loadMarches() {
        try {
            marches = await api.get('/api/marches');
        } catch (error) {
            console.error('Erreur chargement marchés:', error);
            marches = [];
        }
    }

    async function loadProduits() {
        try {
            produits = await api.get('/api/produits');
        } catch (error) {
            console.error('Erreur chargement produits:', error);
            produits = [];
        }
    }

    // Rendu principal
    // Conteneurs pour mise à jour partielle
    let tableContainer = null;
    let statsContainer = null;

    function render() {
        container.innerHTML = '';
        container.appendChild(renderHeader());

        if (!isLoading) {
            statsContainer = renderStats();
            container.appendChild(statsContainer);
            container.appendChild(renderFilters());
            container.appendChild(renderMap());
        }

        tableContainer = renderTable();
        container.appendChild(tableContainer);
        container.appendChild(renderDetailsModal());
    }

    // Mise à jour uniquement de la table et des stats (sans perdre le focus)
    function updateTableAndStats() {
        if (tableContainer && tableContainer.parentNode) {
            const newTable = renderTable();
            tableContainer.parentNode.replaceChild(newTable, tableContainer);
            tableContainer = newTable;
        }

        if (statsContainer && statsContainer.parentNode) {
            const newStats = renderStats();
            statsContainer.parentNode.replaceChild(newStats, statsContainer);
            statsContainer = newStats;
        }
    }

    // Initialisation
    loadAll();

    return container;
}
