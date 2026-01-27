/**
 * Page de collecte des prix - Système 4 périodes
 * L'utilisateur sélectionne un marché et voit tous les produits
 * avec 4 colonnes de saisie: Matin 1, Matin 2, Soir 1, Soir 2
 * Pré-remplissage automatique des périodes précédentes
 */

import auth from '../modules/auth.js';
import api from '../modules/api.js';
import { Card, Button, Spinner, showToast } from '../modules/ui.js';

export default function CollectesPage() {
    const container = document.createElement('div');
    container.className = 'max-w-7xl mx-auto space-y-6';

    const user = auth.getCurrentUser();
    const isAgent = auth.hasRole('agent');

    // État
    let isLoading = true;
    let marches = [];
    let produits = [];
    let unites = []; // Unités de mesure
    let existingCollectes = {}; // Collectes existantes par produit et période
    let userPosition = null;
    let isSubmitting = false;
    let isFetchingPosition = false;

    // État de pagination
    let currentPage = 1;
    let itemsPerPage = 10;
    let showAddProductForm = false;
    let newProductData = { produit_id: '', unite_id: '' }; // Données du nouveau produit

    // État du formulaire
    let formData = {
        marche_id: '',
        date: new Date().toISOString().split('T')[0],
        commentaire: '',
        prix: {}, // Format: { produit_id: { matin1: '', matin2: '', soir1: '', soir2: '' } }
        photos: {} // Format: { 'produit_id_periode': 'data:image/jpeg;base64,...' }
    };

    // Header
    function renderHeader() {
        const header = document.createElement('div');
        header.className = 'bg-indigo-700 p-6 text-white text-center shadow-md rounded-xl mb-6';

        const title = document.createElement('h1');
        title.className = 'text-2xl font-bold tracking-wide';
        title.textContent = 'Collecte des Prix';

        const subtitle = document.createElement('p');
        subtitle.className = 'text-indigo-200 text-sm mt-1';
        subtitle.textContent = 'SAP-SAN Haïti';

        header.appendChild(title);
        header.appendChild(subtitle);

        return header;
    }

    // Variables globales pour la carte
    let map = null;
    let userMarker = null;
    let marcheMarker = null;

    // Section GPS et sélection marché (Tableau 2 colonnes)
    function renderLocationSection() {
        const section = document.createElement('div');
        section.className = 'bg-white rounded-xl shadow-xl p-6';

        // Tableau 2 colonnes : 1 = Carte, 2 = Contrôles (empilés verticalement)
        const table = document.createElement('div');
        table.className = 'grid grid-cols-1 md:grid-cols-2 gap-6';

        // ===== COLONNE 1 : CARTE GPS =====
        const mapColumn = document.createElement('div');
        mapColumn.className = 'space-y-3';

        // Header carte
        const mapHeader = document.createElement('div');
        mapHeader.className = 'flex justify-between items-center mb-3';

        const mapLabel = document.createElement('label');
        mapLabel.className = 'font-bold text-gray-700 text-sm flex items-center';
        const badge = document.createElement('span');
        badge.className = 'bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs mr-2';
        badge.textContent = '📍';
        mapLabel.appendChild(badge);
        mapLabel.appendChild(document.createTextNode('Carte GPS'));

        const gpsStatus = document.createElement('span');
        gpsStatus.className = 'text-xs font-bold';

        if (isFetchingPosition) {
            gpsStatus.className += ' text-orange-500 animate-pulse';
            gpsStatus.textContent = 'Recherche GPS...';
        } else if (userPosition) {
            gpsStatus.className += ' text-green-600';
            gpsStatus.textContent = '✓ GPS Obtenu';
        } else {
            gpsStatus.className += ' text-gray-400';
            gpsStatus.textContent = 'GPS indisponible';
        }

        mapHeader.appendChild(mapLabel);
        mapHeader.appendChild(gpsStatus);
        mapColumn.appendChild(mapHeader);

        // Container pour la carte (forcer la hauteur en inline style)
        const mapContainer = document.createElement('div');
        mapContainer.id = 'map-container';
        mapContainer.className = 'w-full rounded-lg border-2 border-gray-300 bg-gray-100';
        mapContainer.style.height = '400px';  // Forcer la hauteur
        mapContainer.style.minHeight = '400px';
        mapColumn.appendChild(mapContainer);

        // Initialiser ou mettre à jour la carte (délai pour que le container soit dans le DOM)
        setTimeout(() => {
            // Vérifier si le container existe
            const container = document.getElementById('map-container');
            if (!container) {
                console.error('Container map-container non trouvé');
                return;
            }

            // Si la carte existe déjà, la supprimer pour recréer
            if (map) {
                map.remove();
                map = null;
                userMarker = null;
                marcheMarker = null;
            }

            // Créer la carte centrée sur Haïti
            const center = userPosition
                ? [userPosition.latitude, userPosition.longitude]
                : [18.5944, -72.3074]; // Port-au-Prince par défaut

            map = L.map('map-container').setView(center, userPosition ? 13 : 10);

            // Ajouter la couche de tuiles
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
                maxZoom: 19
            }).addTo(map);

            // Ajouter/Mettre à jour le marqueur de l'utilisateur
            if (userPosition) {
                if (!userMarker) {
                    userMarker = L.marker([userPosition.latitude, userPosition.longitude], {
                        icon: L.icon({
                            iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
                            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
                            iconSize: [25, 41],
                            iconAnchor: [12, 41],
                            popupAnchor: [1, -34],
                            shadowSize: [41, 41]
                        })
                    })
                    .addTo(map)
                    .bindPopup('📍 Votre position');
                } else {
                    userMarker.setLatLng([userPosition.latitude, userPosition.longitude]);
                }
            }

            // Nettoyer l'ancien marqueur du marché
            if (marcheMarker) {
                map.removeLayer(marcheMarker);
                marcheMarker = null;
            }

            // Ajouter le nouveau marqueur du marché sélectionné
            if (formData.marche_id) {
                const marche = marches.find(m => m.id === formData.marche_id);
                if (marche && marche.latitude && marche.longitude) {
                    marcheMarker = L.marker([marche.latitude, marche.longitude], {
                        icon: L.icon({
                            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
                            iconSize: [25, 41],
                            iconAnchor: [12, 41],
                            popupAnchor: [1, -34],
                            shadowSize: [41, 41]
                        })
                    })
                    .addTo(map)
                    .bindPopup(`<b>🏪 ${marche.nom}</b><br>${marche.commune_nom}`)
                    .openPopup();

                    // Centrer sur le marché avec zoom approprié
                    map.setView([marche.latitude, marche.longitude], 14);
                } else if (userPosition) {
                    // Si pas de marché sélectionné, centrer sur l'utilisateur
                    map.setView([userPosition.latitude, userPosition.longitude], 13);
                }
            } else if (userPosition) {
                // Pas de marché, centrer sur l'utilisateur
                map.setView([userPosition.latitude, userPosition.longitude], 13);
            }
        }, 300);  // Augmenté à 300ms pour laisser le temps au container d'être dans le DOM

        table.appendChild(mapColumn);

        // ===== COLONNE 2 : CONTRÔLES (2 lignes verticales) =====
        const controlsColumn = document.createElement('div');
        controlsColumn.className = 'flex flex-col justify-start gap-6';
        controlsColumn.style.display = 'flex';
        controlsColumn.style.flexDirection = 'column';
        controlsColumn.style.gap = '24px';

        // LIGNE 1 (en haut) : Sélection du marché
        const marcheDiv2 = document.createElement('div');
        marcheDiv2.className = 'space-y-3 w-full';
        marcheDiv2.style.width = '100%';

        const marcheLabel2 = document.createElement('label');
        marcheLabel2.className = 'block text-sm font-bold text-gray-700';
        marcheLabel2.innerHTML = '<span class="text-red-500">*</span> Sélectionner le Marché';

        const marcheSelect = document.createElement('select');
        marcheSelect.className = 'w-full rounded-lg border-gray-300 p-3 border focus:ring-2 focus:ring-blue-500 bg-white shadow-sm disabled:bg-gray-100 transition';
        marcheSelect.required = true;

        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = userPosition
            ? '-- Sélectionnez un marché --'
            : '-- En attente du GPS --';
        marcheSelect.appendChild(defaultOption);

        // Trier les marchés par distance si GPS disponible
        let sortedMarches = [...marches];
        if (userPosition) {
            sortedMarches = sortedMarches.map(marche => {
                if (marche.latitude && marche.longitude) {
                    const distance = calculateDistance(
                        userPosition.latitude,
                        userPosition.longitude,
                        marche.latitude,
                        marche.longitude
                    );
                    return { ...marche, distance };
                }
                return { ...marche, distance: Infinity };
            }).sort((a, b) => a.distance - b.distance);
        }

        sortedMarches.forEach(marche => {
            const option = document.createElement('option');
            option.value = marche.id;
            let text = `${marche.nom} (${marche.commune_nom})`;
            if (marche.distance !== undefined && marche.distance !== Infinity) {
                text += ` - ${marche.distance.toFixed(1)} km`;
            }
            option.textContent = text;
            marcheSelect.appendChild(option);
        });

        marcheSelect.value = formData.marche_id;
        marcheSelect.disabled = !userPosition;
        marcheSelect.addEventListener('change', async (e) => {
            formData.marche_id = e.target.value;
            currentPage = 1; // Réinitialiser la pagination
            showAddProductForm = false; // Fermer le formulaire d'ajout
            if (e.target.value) {
                await loadExistingCollectes();
            }
            render();
        });

        const marcheHint = document.createElement('p');
        marcheHint.className = 'text-xs text-gray-500 italic';
        marcheHint.textContent = userPosition
            ? 'Les marchés les plus proches s\'affichent en premier.'
            : 'Veuillez obtenir votre position GPS pour activer la sélection.';

        marcheDiv2.appendChild(marcheLabel2);
        marcheDiv2.appendChild(marcheSelect);
        marcheDiv2.appendChild(marcheHint);
        controlsColumn.appendChild(marcheDiv2);

        // LIGNE 2 (en bas) : Date de collecte
        const dateDiv = document.createElement('div');
        dateDiv.className = 'space-y-3 w-full';
        dateDiv.style.width = '100%';

        const dateLabel = document.createElement('label');
        dateLabel.className = 'block text-sm font-bold text-gray-700';
        dateLabel.innerHTML = '<span class="text-red-500">*</span> Date de collecte';

        const dateInput = document.createElement('input');
        dateInput.type = 'date';
        dateInput.className = 'w-full rounded-lg border-gray-300 p-3 border shadow-sm focus:ring-2 focus:ring-blue-500';
        dateInput.required = true;
        dateInput.value = formData.date;
        dateInput.addEventListener('change', async (e) => {
            formData.date = e.target.value;
            if (formData.marche_id) {
                await loadExistingCollectes();
                render();
            }
        });

        dateDiv.appendChild(dateLabel);
        dateDiv.appendChild(dateInput);
        controlsColumn.appendChild(dateDiv);

        // Ajouter la colonne contrôles au tableau
        table.appendChild(controlsColumn);

        // Ajouter le tableau à la section
        section.appendChild(table);

        return section;
    }

    // Section tableau des produits
    function renderProduitsSection() {
        if (!formData.marche_id) {
            return document.createTextNode('');
        }

        const selectedMarche = marches.find(m => m.id === formData.marche_id);
        if (!selectedMarche || !selectedMarche.produits || selectedMarche.produits.length === 0) {
            const notice = document.createElement('div');
            notice.className = 'bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center';
            notice.innerHTML = `
                <p class="text-yellow-800 font-semibold">⚠️ Aucun produit associé à ce marché</p>
                <p class="text-yellow-600 text-sm mt-2">Veuillez contacter l'administrateur pour configurer les produits de ce marché.</p>
            `;
            return notice;
        }

        const section = document.createElement('div');
        section.className = 'bg-white rounded-xl shadow-xl p-6';

        // Header
        const header = document.createElement('h2');
        header.className = 'text-lg font-bold text-gray-800 mb-4 flex items-center';
        const badge = document.createElement('span');
        badge.className = 'bg-indigo-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs mr-2';
        badge.textContent = '2';
        header.appendChild(badge);
        header.appendChild(document.createTextNode('Produits suivis dans ce marché'));
        section.appendChild(header);

        // Table container
        const tableWrapper = document.createElement('div');
        tableWrapper.className = 'overflow-x-auto bg-white border border-gray-200 rounded-lg shadow-sm';

        const tableContainer = document.createElement('div');
        // Pas de min-width pour s'adapter à tous les écrans
        tableContainer.className = '';

        // Table header avec 7 colonnes (ajout de la colonne Actions)
        const table = document.createElement('table');
        table.className = 'w-full border-collapse';

        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        headerRow.className = 'bg-indigo-600 text-white';

        const headers = ['Produit', 'Unité', 'Matin 1', 'Matin 2', 'Soir 1', 'Soir 2', 'Actions'];
        // Largeurs : Produit et Unité normales, périodes réduites car inputs de 5 chiffres
        const widths = ['w-1/5', 'w-1/12', 'w-20', 'w-20', 'w-20', 'w-20', 'w-16'];

        headers.forEach((headerText, index) => {
            const th = document.createElement('th');
            th.className = `${widths[index]} p-2 text-xs font-bold uppercase tracking-wide border border-indigo-700 ${index === 0 ? 'text-left' : 'text-center'}`;
            th.textContent = headerText;
            headerRow.appendChild(th);
        });

        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Filtrer les produits du marché
        const produitsDuMarche = produits.filter(p =>
            selectedMarche.produits.some(mp => mp.id_produit === p.id)
        );

        // Pagination
        const totalItems = produitsDuMarche.length;
        const totalPages = Math.ceil(totalItems / itemsPerPage);
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
        const paginatedProduits = produitsDuMarche.slice(startIndex, endIndex);

        const tbody = document.createElement('tbody');

        if (produitsDuMarche.length === 0) {
            const emptyRow = document.createElement('tr');
            const emptyCell = document.createElement('td');
            emptyCell.colSpan = 6;
            emptyCell.className = 'p-8 text-center text-gray-400 italic';
            emptyCell.textContent = 'Aucun produit trouvé pour ce marché.';
            emptyRow.appendChild(emptyCell);
            tbody.appendChild(emptyRow);
        } else {
            // Ligne d'ajout de produit EN PREMIER (si activé)
            if (showAddProductForm) {
                const addRow = renderAddProductRow();
                tbody.appendChild(addRow);
            }

            // Afficher les produits de la page actuelle
            paginatedProduits.forEach(produit => {
                const row = renderProductRow(produit);
                tbody.appendChild(row);
            });
        }

        table.appendChild(tbody);
        tableContainer.appendChild(table);

        if (produitsDuMarche.length > 0) {
            // Ajouter les contrôles de pagination et d'ajout de produit

            // Info et contrôles en bas du tableau
            const footerDiv = document.createElement('div');
            footerDiv.className = 'bg-gray-50 p-4 border-t flex items-center justify-between flex-wrap gap-3';

            // Gauche: Info + sélecteur d'items par page
            const leftDiv = document.createElement('div');
            leftDiv.className = 'flex items-center gap-4';

            // Info sur les items
            const infoDiv = document.createElement('div');
            infoDiv.className = 'text-sm text-gray-600';
            infoDiv.innerHTML = `Affichage de <span class="font-semibold">${startIndex + 1}-${endIndex}</span> sur <span class="font-semibold">${totalItems}</span> produit(s)`;
            leftDiv.appendChild(infoDiv);

            // Sélecteur d'items par page
            const perPageDiv = document.createElement('div');
            perPageDiv.className = 'flex items-center gap-2';

            const perPageLabel = document.createElement('label');
            perPageLabel.className = 'text-sm text-gray-600';
            perPageLabel.textContent = 'Afficher:';
            perPageDiv.appendChild(perPageLabel);

            const perPageSelect = document.createElement('select');
            perPageSelect.className = 'text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-indigo-500';
            [5, 10, 20, 50].forEach(num => {
                const option = document.createElement('option');
                option.value = num;
                option.textContent = num;
                option.selected = itemsPerPage === num;
                perPageSelect.appendChild(option);
            });
            perPageSelect.addEventListener('change', (e) => {
                itemsPerPage = parseInt(e.target.value);
                currentPage = 1; // Retour à la première page
                render();
            });
            perPageDiv.appendChild(perPageSelect);

            leftDiv.appendChild(perPageDiv);
            footerDiv.appendChild(leftDiv);

            // Contrôles de pagination
            if (totalPages > 1) {
                const paginationDiv = document.createElement('div');
                paginationDiv.className = 'flex gap-2';

                // Bouton Précédent
                const prevButton = document.createElement('button');
                prevButton.className = `px-3 py-1 text-sm border rounded ${currentPage === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-indigo-600 hover:bg-indigo-50 border-indigo-300'}`;
                prevButton.textContent = '← Précédent';
                prevButton.disabled = currentPage === 1;
                prevButton.addEventListener('click', () => {
                    if (currentPage > 1) {
                        currentPage--;
                        render();
                    }
                });
                paginationDiv.appendChild(prevButton);

                // Numéros de page
                const pageInfo = document.createElement('span');
                pageInfo.className = 'px-3 py-1 text-sm font-semibold text-gray-700';
                pageInfo.textContent = `Page ${currentPage} / ${totalPages}`;
                paginationDiv.appendChild(pageInfo);

                // Bouton Suivant
                const nextButton = document.createElement('button');
                nextButton.className = `px-3 py-1 text-sm border rounded ${currentPage === totalPages ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-indigo-600 hover:bg-indigo-50 border-indigo-300'}`;
                nextButton.textContent = 'Suivant →';
                nextButton.disabled = currentPage === totalPages;
                nextButton.addEventListener('click', () => {
                    if (currentPage < totalPages) {
                        currentPage++;
                        render();
                    }
                });
                paginationDiv.appendChild(nextButton);

                footerDiv.appendChild(paginationDiv);
            }

            tableContainer.appendChild(footerDiv);

            // Bouton pour ajouter un produit hors liste
            const addProductDiv = document.createElement('div');
            addProductDiv.className = 'mt-4';

            if (!showAddProductForm) {
                // Bouton d'ajout
                const addButton = document.createElement('button');
                addButton.className = 'w-full py-3 px-4 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition flex items-center justify-center gap-2';
                addButton.innerHTML = '<span>+</span> Ajouter un produit hors liste du marché';
                addButton.addEventListener('click', () => {
                    showAddProductForm = true;
                    newProductData = { produit_id: '', unite_id: '' };
                    formData.prix.new_product = { matin1: '', matin2: '', soir1: '', soir2: '' };
                    render();
                });
                addProductDiv.appendChild(addButton);
            } else {
                // Boutons de contrôle (Annuler / Valider)
                const controlDiv = document.createElement('div');
                controlDiv.className = 'flex gap-3 justify-end p-3 bg-yellow-50 border-2 border-yellow-400 rounded-lg';

                const cancelButton = document.createElement('button');
                cancelButton.type = 'button';
                cancelButton.className = 'px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600';
                cancelButton.textContent = 'Annuler';
                cancelButton.addEventListener('click', () => {
                    showAddProductForm = false;
                    newProductData = { produit_id: '', unite_id: '' };
                    formData.prix.new_product = { matin1: '', matin2: '', soir1: '', soir2: '' };
                    render();
                });
                controlDiv.appendChild(cancelButton);

                const validateButton = document.createElement('button');
                validateButton.type = 'button';
                validateButton.className = 'px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-semibold';
                validateButton.textContent = '✓ Valider l\'ajout';
                validateButton.addEventListener('click', () => {
                    // Validation
                    if (!newProductData.produit_id) {
                        showToast({ message: 'Veuillez sélectionner un produit', type: 'warning' });
                        return;
                    }
                    if (!newProductData.unite_id) {
                        showToast({ message: 'Veuillez sélectionner une unité', type: 'warning' });
                        return;
                    }

                    const hasPrix = Object.values(formData.prix.new_product).some(v => v && v !== '');
                    if (!hasPrix) {
                        showToast({ message: 'Veuillez entrer au moins un prix', type: 'warning' });
                        return;
                    }

                    // Ajouter le produit au marché temporairement
                    const produit = produits.find(p => p.id === newProductData.produit_id);
                    if (produit) {
                        // Copier les prix vers le produit
                        formData.prix[produit.id] = { ...formData.prix.new_product };

                        // Ajouter le produit à la liste du marché
                        const selectedMarche = marches.find(m => m.id === formData.marche_id);
                        if (selectedMarche && !selectedMarche.produits.some(p => p.id_produit === produit.id)) {
                            selectedMarche.produits.push({ id_produit: produit.id });
                        }

                        showToast({ message: `Produit "${produit.nom}" ajouté avec succès`, type: 'success' });
                        showAddProductForm = false;
                        newProductData = { produit_id: '', unite_id: '' };
                        formData.prix.new_product = { matin1: '', matin2: '', soir1: '', soir2: '' };
                        render();
                    }
                });
                controlDiv.appendChild(validateButton);

                addProductDiv.appendChild(controlDiv);
            }

            section.appendChild(addProductDiv);
        }

        tableWrapper.appendChild(tableContainer);
        section.appendChild(tableWrapper);

        return section;
    }

    // Fonction pour capturer une photo ou choisir une image
    function capturePhoto(produitId, periode) {
        return new Promise((resolve, reject) => {
            // Créer un input file invisible
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            // Sans l'attribut capture, le navigateur propose automatiquement :
            // - Prendre une photo (caméra)
            // - Choisir depuis la galerie/fichiers

            input.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) {
                    resolve(null);
                    return;
                }

                // Vérifier la taille (max 2MB)
                if (file.size > 2 * 1024 * 1024) {
                    showToast({
                        message: 'Image trop grande (max 2MB)',
                        type: 'warning'
                    });
                    resolve(null);
                    return;
                }

                // Convertir en base64
                const reader = new FileReader();
                reader.onload = () => {
                    const photoKey = `${produitId}_${periode}`;
                    formData.photos[photoKey] = reader.result;

                    showToast({
                        message: '📷 Photo capturée',
                        type: 'success'
                    });

                    render(); // Rafraîchir pour afficher l'icône
                    resolve(reader.result);
                };
                reader.onerror = () => reject(reader.error);
                reader.readAsDataURL(file);
            });

            // Déclencher le sélecteur de fichier
            input.click();
        });
    }

    // Ligne de produit avec 6 colonnes (tr avec td)
    function renderProductRow(produit) {
        const row = document.createElement('tr');
        row.className = 'hover:bg-blue-50 transition';

        // Initialize prix object for this product if not exists
        if (!formData.prix[produit.id]) {
            formData.prix[produit.id] = {
                matin1: '',
                matin2: '',
                soir1: '',
                soir2: ''
            };
        }

        // Colonne 1: Nom du produit
        const nameCell = document.createElement('td');
        nameCell.className = 'p-3 pl-4 border border-gray-300 text-left bg-white';

        const namePara = document.createElement('p');
        namePara.className = 'font-semibold text-gray-800 text-sm';
        namePara.textContent = produit.nom;

        nameCell.appendChild(namePara);
        row.appendChild(nameCell);

        // Colonne 2: Unité de mesure
        const uniteCell = document.createElement('td');
        uniteCell.className = 'p-2 border border-gray-300 text-center bg-white';

        const unitePara = document.createElement('p');
        unitePara.className = 'text-xs font-medium text-indigo-700 bg-indigo-50 px-2 py-1 rounded inline-block';
        unitePara.textContent = produit.unite_nom || produit.unite_symbole || 'N/A';

        uniteCell.appendChild(unitePara);
        row.appendChild(uniteCell);

        // Colonnes 3-6: Input fields pour chaque période
        const periodes = [
            { key: 'matin1', placeholder: 'Matin 1' },
            { key: 'matin2', placeholder: 'Matin 2' },
            { key: 'soir1', placeholder: 'Soir 1' },
            { key: 'soir2', placeholder: 'Soir 2' }
        ];

        // Vérifier si au moins une collecte existe pour ce produit
        const hasAnyCollecte = periodes.some(p => existingCollectes[`${produit.id}_${p.key}`]);

        periodes.forEach(periode => {
            const inputCell = document.createElement('td');
            inputCell.className = 'p-1 border border-gray-300 bg-white';

            // Conteneur flex pour input + boutons (plus compact)
            const container = document.createElement('div');
            container.className = 'flex items-center gap-0.5';

            const input = document.createElement('input');
            input.type = 'number';
            input.step = '0.01';
            input.min = '0';
            input.maxLength = 5; // Limiter à 5 chiffres
            input.placeholder = '';
            input.className = 'w-12 rounded border-gray-300 p-1 border text-center text-xs focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500';
            input.setAttribute('data-periode', periode.key);
            input.setAttribute('data-produit-id', produit.id);

            // Pre-fill from existing collectes
            const existing = existingCollectes[`${produit.id}_${periode.key}`];
            if (existing) {
                input.value = existing.prix;
                input.className = 'w-12 rounded p-1 border text-center text-xs bg-green-50 border-green-400 focus:ring-1 focus:ring-green-500';
                input.setAttribute('data-existing', 'true');
                input.setAttribute('data-collecte-id', existing.id);
                input.disabled = true; // Désactiver si déjà enregistré
            } else {
                input.value = formData.prix[produit.id][periode.key] || '';
            }

            input.addEventListener('input', (e) => {
                formData.prix[produit.id][periode.key] = e.target.value;
            });

            container.appendChild(input);

            // Boutons si pas encore de collecte pour cette période
            if (!existing) {
                // Bouton photo 📷
                const photoKey = `${produit.id}_${periode.key}`;
                const hasPhoto = formData.photos[photoKey];

                const photoButton = document.createElement('button');
                photoButton.type = 'button';
                photoButton.className = hasPhoto
                    ? 'px-3 py-1.5 bg-blue-600 text-white text-base rounded hover:bg-blue-700 transition shadow-sm'
                    : 'px-3 py-1.5 bg-gray-400 text-white text-base rounded hover:bg-gray-500 transition shadow-sm';
                photoButton.innerHTML = '📷';
                photoButton.title = hasPhoto ? 'Photo capturée - Cliquer pour changer' : 'Prendre photo ou choisir image';

                photoButton.addEventListener('click', async () => {
                    await capturePhoto(produit.id, periode.key);
                });

                container.appendChild(photoButton);

                // Bouton ajouter "+"
                const addButton = document.createElement('button');
                addButton.type = 'button';
                addButton.className = 'px-3 py-1.5 bg-green-600 text-white text-base rounded hover:bg-green-700 transition font-bold shadow-sm';
                addButton.innerHTML = '+';
                addButton.title = `Enregistrer ${periode.placeholder}`;

                addButton.addEventListener('click', async () => {
                    await saveSingleCollecte(produit, periode.key);
                });

                container.appendChild(addButton);
            }

            inputCell.appendChild(container);
            row.appendChild(inputCell);
        });

        // Colonne 7: Actions (bouton Modifier si au moins une collecte existe)
        const actionsCell = document.createElement('td');
        actionsCell.className = 'p-1 border border-gray-300 bg-white text-center';

        if (hasAnyCollecte) {
            const modifyButton = document.createElement('button');
            modifyButton.type = 'button';
            modifyButton.className = 'px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition';
            modifyButton.textContent = '✏️';
            modifyButton.title = 'Modifier les collectes de ce produit';

            modifyButton.addEventListener('click', () => {
                enableRowEditing(produit.id);
            });

            actionsCell.appendChild(modifyButton);
        }

        row.appendChild(actionsCell);

        return row;
    }

    // Ligne d'ajout de produit hors liste (dans le tableau)
    function renderAddProductRow() {
        const row = document.createElement('tr');
        row.className = 'bg-yellow-50 border-2 border-yellow-400';

        // Colonne 1: Select de produit
        const produitCell = document.createElement('td');
        produitCell.className = 'p-2 border border-gray-300';

        const produitSelect = document.createElement('select');
        produitSelect.className = 'w-full p-2 border border-yellow-500 rounded text-sm focus:ring-2 focus:ring-yellow-600';

        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = '-- Choisir un produit --';
        produitSelect.appendChild(defaultOption);

        // Filtrer les produits hors liste
        const selectedMarche = marches.find(m => m.id === formData.marche_id);
        const produitsMarche = selectedMarche ? selectedMarche.produits.map(p => p.id_produit) : [];
        const produitsDisponibles = produits.filter(p => !produitsMarche.includes(p.id));

        produitsDisponibles.forEach(produit => {
            const option = document.createElement('option');
            option.value = produit.id;
            option.textContent = produit.nom;
            option.selected = produit.id === newProductData.produit_id;
            produitSelect.appendChild(option);
        });

        produitSelect.addEventListener('change', (e) => {
            newProductData.produit_id = e.target.value;
            // Pré-remplir l'unité si le produit a une unité par défaut
            const selectedProduit = produits.find(p => p.id === e.target.value);
            if (selectedProduit) {
                newProductData.unite_id = selectedProduit.id_unite_mesure;
            }
            render();
        });

        produitCell.appendChild(produitSelect);
        row.appendChild(produitCell);

        // Colonne 2: Select d'unité
        const uniteCell = document.createElement('td');
        uniteCell.className = 'p-2 border border-gray-300 text-center';

        const uniteSelect = document.createElement('select');
        uniteSelect.className = 'w-full p-2 border border-yellow-500 rounded text-sm focus:ring-2 focus:ring-yellow-600';

        const defaultUniteOption = document.createElement('option');
        defaultUniteOption.value = '';
        defaultUniteOption.textContent = '-- Unité --';
        uniteSelect.appendChild(defaultUniteOption);

        unites.forEach(unite => {
            const option = document.createElement('option');
            option.value = unite.id;
            option.textContent = `${unite.symbole}`;
            option.selected = unite.id === newProductData.unite_id;
            uniteSelect.appendChild(option);
        });

        uniteSelect.addEventListener('change', (e) => {
            newProductData.unite_id = e.target.value;
        });

        uniteCell.appendChild(uniteSelect);
        row.appendChild(uniteCell);

        // Colonnes 3-6: Inputs pour les 4 périodes
        const periodes = [
            { key: 'matin1', placeholder: 'Matin 1' },
            { key: 'matin2', placeholder: 'Matin 2' },
            { key: 'soir1', placeholder: 'Soir 1' },
            { key: 'soir2', placeholder: 'Soir 2' }
        ];

        if (!formData.prix.new_product) {
            formData.prix.new_product = { matin1: '', matin2: '', soir1: '', soir2: '' };
        }

        periodes.forEach(periode => {
            const inputCell = document.createElement('td');
            inputCell.className = 'p-2 border border-gray-300';

            const input = document.createElement('input');
            input.type = 'number';
            input.step = '0.01';
            input.min = '0';
            input.placeholder = periode.placeholder;
            input.className = 'w-full rounded border-yellow-500 p-2 border text-center text-sm focus:ring-2 focus:ring-yellow-600 bg-white';
            input.value = formData.prix.new_product[periode.key] || '';

            input.addEventListener('input', (e) => {
                formData.prix.new_product[periode.key] = e.target.value;
            });

            inputCell.appendChild(input);
            row.appendChild(inputCell);
        });

        // Colonne 7: Actions (vide pour la ligne d'ajout)
        const actionsCell = document.createElement('td');
        actionsCell.className = 'p-2 border border-gray-300 bg-yellow-50';
        row.appendChild(actionsCell);

        return row;
    }

    // Formulaire d'ajout de produit hors liste (ANCIEN - à supprimer si plus utilisé)
    function renderAddProductForm() {
        const formDiv = document.createElement('div');
        formDiv.className = 'mt-4 p-4 bg-white border border-blue-300 rounded-lg';

        const title = document.createElement('h3');
        title.className = 'text-lg font-semibold text-gray-800 mb-4';
        title.textContent = 'Ajouter un produit hors liste du marché';
        formDiv.appendChild(title);

        // Select pour choisir un produit
        const selectDiv = document.createElement('div');
        selectDiv.className = 'mb-4';

        const label = document.createElement('label');
        label.className = 'block text-sm font-medium text-gray-700 mb-2';
        label.textContent = 'Sélectionner un produit';
        selectDiv.appendChild(label);

        const select = document.createElement('select');
        select.className = 'w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500';

        // Option par défaut
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = '-- Choisir un produit --';
        select.appendChild(defaultOption);

        // Filtrer les produits qui ne sont pas déjà dans le marché
        const selectedMarche = marches.find(m => m.id === formData.marche_id);
        const produitsMarche = selectedMarche ? selectedMarche.produits.map(p => p.id_produit) : [];
        const produitsDisponibles = produits.filter(p => !produitsMarche.includes(p.id));

        produitsDisponibles.forEach(produit => {
            const option = document.createElement('option');
            option.value = produit.id;
            option.textContent = `${produit.nom} (${produit.unite_nom || produit.unite_symbole || 'N/A'})`;
            select.appendChild(option);
        });

        selectDiv.appendChild(select);
        formDiv.appendChild(selectDiv);

        // Grille pour les 4 périodes
        const periodesDiv = document.createElement('div');
        periodesDiv.className = 'grid grid-cols-4 gap-3 mb-4';

        const periodes = [
            { key: 'matin1', label: 'Matin 1' },
            { key: 'matin2', label: 'Matin 2' },
            { key: 'soir1', label: 'Soir 1' },
            { key: 'soir2', label: 'Soir 2' }
        ];

        const periodeValues = {};

        periodes.forEach(periode => {
            const div = document.createElement('div');

            const periodLabel = document.createElement('label');
            periodLabel.className = 'block text-xs font-medium text-gray-700 mb-1';
            periodLabel.textContent = periode.label;
            div.appendChild(periodLabel);

            const input = document.createElement('input');
            input.type = 'number';
            input.step = '0.01';
            input.min = '0';
            input.placeholder = periode.label;  // Utiliser "Matin 1", "Matin 2", etc. comme placeholder
            input.className = 'w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500';
            input.dataset.periode = periode.key;

            input.addEventListener('input', (e) => {
                periodeValues[periode.key] = e.target.value;
            });

            div.appendChild(input);
            periodesDiv.appendChild(div);
        });

        formDiv.appendChild(periodesDiv);

        // Boutons
        const buttonsDiv = document.createElement('div');
        buttonsDiv.className = 'flex gap-3 justify-end';

        const cancelButton = document.createElement('button');
        cancelButton.type = 'button';
        cancelButton.className = 'px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300';
        cancelButton.textContent = 'Annuler';
        cancelButton.addEventListener('click', () => {
            showAddProductForm = false;
            render();
        });
        buttonsDiv.appendChild(cancelButton);

        const addButton = document.createElement('button');
        addButton.type = 'button';
        addButton.className = 'px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700';
        addButton.textContent = 'Ajouter';
        addButton.addEventListener('click', () => {
            const produitId = select.value;
            if (!produitId) {
                showToast({
                    message: 'Veuillez sélectionner un produit',
                    type: 'warning'
                });
                return;
            }

            // Vérifier qu'au moins un prix est entré
            const hasPrix = Object.values(periodeValues).some(v => v && v !== '');
            if (!hasPrix) {
                showToast({
                    message: 'Veuillez entrer au moins un prix',
                    type: 'warning'
                });
                return;
            }

            // Ajouter le produit au formulaire
            const produit = produits.find(p => p.id === produitId);
            if (produit) {
                if (!formData.prix[produitId]) {
                    formData.prix[produitId] = { matin1: '', matin2: '', soir1: '', soir2: '' };
                }

                // Copier les prix
                Object.keys(periodeValues).forEach(periode => {
                    if (periodeValues[periode]) {
                        formData.prix[produitId][periode] = periodeValues[periode];
                    }
                });

                // Ajouter temporairement le produit à la liste du marché pour l'affichage
                const selectedMarche = marches.find(m => m.id === formData.marche_id);
                if (selectedMarche && !selectedMarche.produits.some(p => p.id_produit === produitId)) {
                    selectedMarche.produits.push({ id_produit: produitId });
                }

                showToast({
                    message: `Produit "${produit.nom}" ajouté avec succès`,
                    type: 'success'
                });

                showAddProductForm = false;
                render();
            }
        });
        buttonsDiv.appendChild(addButton);

        formDiv.appendChild(buttonsDiv);

        return formDiv;
    }

    // Section commentaires
    function renderCommentaireSection() {
        if (!formData.marche_id) {
            return document.createTextNode('');
        }

        const section = document.createElement('div');
        section.className = 'bg-white p-4 rounded-xl border border-gray-300 shadow-sm';

        const label = document.createElement('label');
        label.className = 'block text-sm font-bold text-gray-700 mb-2 flex items-center';
        const badge = document.createElement('span');
        badge.className = 'bg-gray-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs mr-2';
        badge.textContent = '3';
        label.appendChild(badge);
        label.appendChild(document.createTextNode('Commentaires'));

        const textarea = document.createElement('textarea');
        textarea.id = 'globalComment';
        textarea.rows = 2;
        textarea.className = 'w-full rounded-lg border-gray-300 shadow-inner p-3 border focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50';
        textarea.placeholder = 'Observations...';
        textarea.value = formData.commentaire;
        textarea.addEventListener('input', (e) => {
            formData.commentaire = e.target.value;
        });

        section.appendChild(label);
        section.appendChild(textarea);

        return section;
    }

    // Section submit
    function renderSubmitSection() {
        if (!formData.marche_id) {
            return document.createTextNode('');
        }

        const section = document.createElement('div');

        const button = Button({
            text: isSubmitting ? 'Enregistrement en cours...' : 'Enregistrer la collecte',
            variant: 'primary',
            disabled: isSubmitting,
            className: 'w-full py-4 text-lg uppercase tracking-wide font-bold',
            onClick: handleSubmit
        });

        if (isSubmitting) {
            const spinner = Spinner({ size: 'sm', className: 'inline-block mr-2' });
            button.insertBefore(spinner, button.firstChild);
        }

        section.appendChild(button);

        return section;
    }

    // Handlers
    function handleGetLocation() {
        if (!navigator.geolocation) {
            showToast({
                message: 'Géolocalisation non supportée par votre navigateur',
                type: 'error'
            });
            return;
        }

        isFetchingPosition = true;
        render();

        navigator.geolocation.getCurrentPosition(
            (position) => {
                userPosition = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                };
                isFetchingPosition = false;
                showToast({
                    message: 'Position GPS capturée avec succès',
                    type: 'success'
                });
                render();
            },
            (error) => {
                isFetchingPosition = false;
                showToast({
                    message: 'Impossible d\'obtenir la position GPS: ' + error.message,
                    type: 'error'
                });
                render();
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    }

    // Enregistrer une seule collecte (une période pour un produit)
    async function saveSingleCollecte(produit, periode) {
        // Validation
        if (!formData.marche_id) {
            showToast({
                message: 'Veuillez sélectionner un marché',
                type: 'error'
            });
            return;
        }

        const prix = formData.prix[produit.id][periode];
        if (!prix || prix === '') {
            showToast({
                message: 'Veuillez entrer un prix',
                type: 'warning'
            });
            return;
        }

        const collecteData = {
            marche_id: formData.marche_id,
            produit_id: produit.id,
            unite_id: produit.id_unite_mesure,
            quantite: 1,
            prix: parseFloat(prix),
            date: formData.date,
            periode: periode,
            commentaire: formData.commentaire || null
        };

        // Ajouter GPS si disponible
        if (userPosition) {
            collecteData.latitude = userPosition.latitude;
            collecteData.longitude = userPosition.longitude;
        }

        // Ajouter la photo si disponible
        const photoKey = `${produit.id}_${periode}`;
        if (formData.photos[photoKey]) {
            collecteData.image = formData.photos[photoKey];
        }

        try {
            await api.post('/api/collectes', collecteData);

            // Supprimer la photo de la mémoire après enregistrement réussi
            const photoKey = `${produit.id}_${periode}`;
            if (formData.photos[photoKey]) {
                delete formData.photos[photoKey];
            }

            showToast({
                message: `Prix ${periode} enregistré pour ${produit.nom}`,
                type: 'success'
            });

            // Recharger les collectes existantes
            await loadExistingCollectes();
            render();

        } catch (error) {
            console.error('Erreur lors de l\'enregistrement:', error);
            showToast({
                message: error.message || 'Erreur lors de l\'enregistrement',
                type: 'error'
            });
        }
    }

    // Activer le mode édition pour une ligne
    function enableRowEditing(produitId) {
        // Débloquer tous les inputs de cette ligne
        const inputs = document.querySelectorAll(`input[data-produit-id="${produitId}"]`);
        inputs.forEach(input => {
            if (input.getAttribute('data-existing') === 'true') {
                input.disabled = false;
                input.className = 'flex-1 rounded p-2 border text-center text-sm bg-yellow-50 border-yellow-400 focus:ring-2 focus:ring-yellow-500';
            }
        });

        // Afficher un message
        showToast({
            message: 'Mode édition activé. Modifiez les prix et cliquez sur "Sauvegarder" en bas.',
            type: 'info'
        });

        // Scroll vers le bouton de soumission
        const submitButton = document.querySelector('button:has-text("Enregistrer")');
        if (submitButton) {
            submitButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    async function handleSubmit() {
        // Validation
        if (!formData.marche_id) {
            showToast({
                message: 'Veuillez sélectionner un marché',
                type: 'error'
            });
            return;
        }

        if (!formData.date) {
            showToast({
                message: 'Veuillez sélectionner une date',
                type: 'error'
            });
            return;
        }

        // Collecter tous les prix entrés
        const collectesToCreate = [];
        const collectesToUpdate = [];

        Object.keys(formData.prix).forEach(produitId => {
            const periodes = formData.prix[produitId];

            Object.keys(periodes).forEach(periode => {
                const prix = periodes[periode];

                if (prix && prix !== '') {
                    const produit = produits.find(p => p.id === produitId);
                    if (!produit) return;

                    const existingKey = `${produitId}_${periode}`;
                    const existing = existingCollectes[existingKey];

                    const collecteData = {
                        marche_id: formData.marche_id,
                        produit_id: produitId,
                        unite_id: produit.id_unite_mesure,
                        quantite: 1, // Quantité par défaut
                        prix: parseFloat(prix),
                        date: formData.date,
                        periode: periode,
                        commentaire: formData.commentaire || null
                    };

                    // Ajouter GPS si disponible
                    if (userPosition) {
                        collecteData.latitude = userPosition.latitude;
                        collecteData.longitude = userPosition.longitude;
                    }

                    if (existing && parseFloat(existing.prix) !== parseFloat(prix)) {
                        // Update existing
                        collectesToUpdate.push({
                            id: existing.id,
                            data: collecteData
                        });
                    } else if (!existing) {
                        // Create new
                        collectesToCreate.push(collecteData);
                    }
                }
            });
        });

        if (collectesToCreate.length === 0 && collectesToUpdate.length === 0) {
            showToast({
                message: 'Veuillez entrer au moins un prix',
                type: 'warning'
            });
            return;
        }

        isSubmitting = true;
        render();

        try {
            const promises = [];

            // Create new collectes
            if (collectesToCreate.length > 0) {
                promises.push(
                    api.post('/api/collectes/batch', { collectes: collectesToCreate })
                );
            }

            // Update existing collectes
            collectesToUpdate.forEach(({ id, data }) => {
                promises.push(api.put(`/api/collectes/${id}`, data));
            });

            await Promise.all(promises);

            const totalOperations = collectesToCreate.length + collectesToUpdate.length;
            showToast({
                message: `${totalOperations} prix enregistré(s) avec succès`,
                type: 'success'
            });

            // Reset form
            formData.commentaire = '';
            formData.prix = {};

            // Reload existing collectes
            await loadExistingCollectes();
            render();

        } catch (error) {
            console.error('Erreur lors de l\'enregistrement:', error);
            showToast({
                message: error.message || 'Erreur lors de l\'enregistrement',
                type: 'error'
            });
        } finally {
            isSubmitting = false;
            render();
        }
    }

    // Chargement des collectes existantes
    async function loadExistingCollectes() {
        if (!formData.marche_id || !formData.date) {
            existingCollectes = {};
            return;
        }

        try {
            const params = new URLSearchParams({
                marche_id: formData.marche_id,
                date: formData.date
            });

            const collectes = await api.get(`/api/collectes?${params.toString()}`);

            // Indexer par produit_id et periode
            existingCollectes = {};
            collectes.forEach(c => {
                if (c.periode) {
                    const key = `${c.produit_id}_${c.periode}`;
                    existingCollectes[key] = c;
                }
            });

        } catch (error) {
            console.error('Erreur lors du chargement des collectes existantes:', error);
        }
    }

    // Chargement des données
    async function loadMarches() {
        try {
            marches = await api.get('/api/marches');
        } catch (error) {
            console.error('Erreur lors du chargement des marchés:', error);
            showToast({
                message: 'Erreur lors du chargement des marchés',
                type: 'error'
            });
        }
    }

    async function loadProduits() {
        try {
            const [produitsData, unitesData] = await Promise.all([
                api.get('/api/produits'),
                api.get('/api/unites-mesure')
            ]);

            // Stocker les unités globalement
            unites = unitesData;

            // Enrichir les produits avec les noms d'unités
            produits = produitsData.map(p => {
                const unite = unites.find(u => u.id === p.id_unite_mesure);
                return {
                    ...p,
                    unite_nom: unite ? `${unite.unite} (${unite.symbole})` : '',
                    unite_symbole: unite ? unite.symbole : ''
                };
            });

        } catch (error) {
            console.error('Erreur lors du chargement des produits:', error);
            showToast({
                message: 'Erreur lors du chargement des produits',
                type: 'error'
            });
        }
    }

    async function loadData() {
        try {
            await Promise.all([
                loadMarches(),
                loadProduits()
            ]);

            isLoading = false;
            render();

        } catch (error) {
            console.error('Erreur lors du chargement initial:', error);
            showToast({
                message: 'Erreur lors du chargement des données',
                type: 'error'
            });
            isLoading = false;
            render();
        }
    }

    // Helpers
    function calculateDistance(lat1, lon1, lat2, lon2) {
        // Haversine formula
        const R = 6371; // Earth radius in km
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    function toRad(degrees) {
        return degrees * (Math.PI / 180);
    }

    // Rendu du loader
    function renderLoader() {
        const loader = document.createElement('div');
        loader.className = 'flex items-center justify-center py-12';

        const content = document.createElement('div');
        content.className = 'text-center';

        content.appendChild(Spinner({ size: 'lg' }));

        const text = document.createElement('p');
        text.className = 'mt-4 text-gray-600';
        text.textContent = 'Chargement...';

        content.appendChild(text);
        loader.appendChild(content);

        return loader;
    }

    // Fonction de rendu
    function render() {
        container.innerHTML = '';

        if (isLoading) {
            container.appendChild(renderLoader());
        } else {
            container.appendChild(renderHeader());
            container.appendChild(renderLocationSection());
            container.appendChild(renderProduitsSection());
            container.appendChild(renderCommentaireSection());
            container.appendChild(renderSubmitSection());
        }
    }

    // Charger les données au montage
    loadData();

    // Obtenir automatiquement la position GPS au chargement
    setTimeout(() => {
        if (!userPosition && !isFetchingPosition) {
            handleGetLocation();
        }
    }, 500);

    // Rendu initial
    render();

    return container;
}
