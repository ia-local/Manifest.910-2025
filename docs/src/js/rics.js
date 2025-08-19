// Fichier : public/src/js/rics.js
// Ce fichier gère la logique de la page des Référendums d'Initiative Citoyenne (RIC).

let ricMap;
let activeRicsData = [];
let ricMarkersLayer = L.layerGroup(); // Couche pour les marqueurs de RIC

// Définition des icônes personnalisées pour la carte (si nécessaire)
const ricIcon = L.icon({
    iconUrl: 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34]
});

/**
 * Fonction d'initialisation de la page RIC.
 * Appeler cette fonction depuis app.js après le chargement du HTML.
 */
function initRicPage() {
    console.log("Initialisation de la page RIC...");

    // Appelle setupModal pour s'assurer que les écouteurs d'événements de la modale sont prêts
    // Cette fonction est définie dans modal-ric.js
    if (typeof setupModal === 'function') {
        setupModal();
    }
    
    // Récupération des données depuis le fichier JSON externe
    fetch('src/json/rics.json')
        .then(response => {
            if (!response.ok) {
                throw new Error('Erreur de chargement des données des référendums.');
            }
            return response.json();
        })
        .then(data => {
            activeRicsData = data;
            loadRics();
            setupRicFormModal();
            setupFilters();
            setupRicMapModal(); // Nouvelle fonction pour gérer la modale de la carte
        })
        .catch(error => {
            console.error("Erreur lors de l'initialisation de la page RIC:", error);
            const ricListContainer = document.getElementById('ric-list');
            if (ricListContainer) {
                ricListContainer.innerHTML = `<p class="error-message">Erreur : Impossible de charger les propositions de référendum.</p>`;
            }
        });
}

/**
 * Configure la modale de la carte et ses événements.
 */
function setupRicMapModal() {
    const viewMapBtn = document.getElementById('view-map-btn');
    if (viewMapBtn) {
        viewMapBtn.addEventListener('click', () => {
            const mapTemplate = document.getElementById('ric-map-modal-template');
            if (mapTemplate) {
                const mapContent = mapTemplate.content.cloneNode(true);
                showModal('Localisation des RIC', mapContent);
                // Initialise la carte dans la modale une fois qu'elle est affichée
                setTimeout(() => {
                    initRicMapInModal(activeRicsData);
                    setupMapFilters();
                }, 100);
            }
        });
    }
}

/**
 * Configure les écouteurs d'événements pour les filtres de la modale de la carte.
 */
function setupMapFilters() {
    const levelFilter = document.getElementById('level-filter-modal');
    const sortFilter = document.getElementById('sort-filter-modal');
    const filterBtn = document.getElementById('filter-map-btn');

    if (filterBtn) {
        filterBtn.addEventListener('click', () => {
            const level = levelFilter.value;
            const sortBy = sortFilter.value;
            filterAndDisplayMap(level, sortBy);
        });
    }
}

/**
 * Filtre et affiche les RIC sur la carte.
 * @param {string} level Le niveau de scrutin à filtrer.
 * @param {string} sortBy Le critère de tri.
 */
function filterAndDisplayMap(level, sortBy) {
    let filteredData = activeRicsData;

    // Filtrage par niveau
    if (level !== 'all') {
        filteredData = filteredData.filter(ric => ric.level === level);
    }
    
    // Tri par nombre de votants
    if (sortBy === 'voters') {
        filteredData.sort((a, b) => (b.votes_for + b.votes_against) - (a.votes_for + a.votes_against));
    }

    // Efface les anciens marqueurs et en ajoute de nouveaux
    ricMarkersLayer.clearLayers();
    renderMapMarkers(filteredData);
}

/**
 * Initialise la carte dans la modale.
 * @param {Array} data Les données de RIC à afficher.
 */
function initRicMapInModal(data) {
    const mapContainer = document.getElementById('ric-map-modal');
    if (!mapContainer) return;

    // Assure que la carte n'est pas déjà initialisée sur cet élément
    if (ricMap) {
        ricMap.remove();
    }

    ricMap = L.map('ric-map-modal').setView([46.603354, 1.888334], 6);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
    }).addTo(ricMap);
    
    // Ajoute la couche de marqueurs à la carte
    ricMarkersLayer.addTo(ricMap);
    
    // Affiche les marqueurs initiaux
    renderMapMarkers(data);
}

/**
 * Affiche les marqueurs sur la carte en fonction des données fournies.
 * @param {Array} data Les données de RIC à afficher.
 */
function renderMapMarkers(data) {
    data.forEach(ric => {
        if (ric.locations) {
            ric.locations.forEach(location => {
                const marker = L.circleMarker([location.lat, location.lon], {
                    radius: Math.sqrt(location.count) / 10,
                    fillColor: "#007bff",
                    color: "#000",
                    weight: 1,
                    opacity: 1,
                    fillOpacity: 0.8
                }).bindPopup(`<b>${ric.question}</b><br>Votes : ${location.count.toLocaleString()}<br>Niveau : ${ric.level}`);
                
                ricMarkersLayer.addLayer(marker);
            });
        }
    });
}

/**
 * Configure le formulaire de soumission de RIC dans une modale.
 */
function setupRicFormModal() {
    const addRicBtn = document.getElementById('add-ric-btn');
    if (addRicBtn) {
        addRicBtn.addEventListener('click', () => {
            const formTemplate = document.getElementById('ric-form-template');
            if (formTemplate) {
                const formContent = formTemplate.content.cloneNode(true);
                showModal('Proposer un nouveau RIC', formContent);
                setupRicFormSubmission();
            }
        });
    }
}

/**
 * Gère la soumission du formulaire de RIC.
 */
function setupRicFormSubmission() {
    const form = document.getElementById('ric-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            alert('Proposition soumise (action simulée) !');
            hideModal();
            initRicPage();
        });
    }
}

/**
 * Configure les écouteurs d'événements pour les filtres de la page principale.
 */
function setupFilters() {
    const levelFilter = document.getElementById('level-filter');
    const sortFilter = document.getElementById('sort-filter');
    
    if (levelFilter) {
        levelFilter.addEventListener('change', filterRics);
    }
    if (sortFilter) {
        sortFilter.addEventListener('change', filterRics);
    }
}

/**
 * Filtre et trie les propositions de RIC.
 */
function filterRics() {
    const levelFilterValue = document.getElementById('level-filter').value;
    const sortFilterValue = document.getElementById('sort-filter').value;
    
    let filteredData = activeRicsData;
    
    // Filtrage par niveau de scrutin
    if (levelFilterValue !== 'all') {
        filteredData = filteredData.filter(ric => ric.level === levelFilterValue);
    }
    
    // Tri par nombre de votants
    if (sortFilterValue === 'voters') {
        filteredData.sort((a, b) => (b.votes_for + b.votes_against) - (a.votes_for + a.votes_against));
    }
    
    // Affiche les données filtrées et triées
    loadRics(filteredData);
}

/**
 * Récupère les propositions de RIC depuis le fichier JSON et les affiche.
 * @param {Array} data Les données à afficher (optionnel, utilise activeRicsData par défaut).
 */
function loadRics(data = activeRicsData) {
    const ricListContainer = document.getElementById('ric-list');
    if (!ricListContainer) return;

    ricListContainer.innerHTML = '';

    const dataToDisplay = data;

    if (dataToDisplay.length === 0) {
        ricListContainer.innerHTML = `<p>Aucune proposition de RIC active pour le moment.</p>`;
        return;
    }

    dataToDisplay.forEach(ric => {
        const card = document.createElement('div');
        card.className = 'card ric-card';
        card.innerHTML = `
            <h3>${ric.question}</h3>
            <div class="card-footer">
                <span>Pour : ${ric.votes_for.toLocaleString()}</span>
                <span>Contre : ${ric.votes_against.toLocaleString()}</span>
                <button class="btn btn-secondary vote-btn" data-id="${ric.id}">Voter</button>
            </div>
        `;
        ricListContainer.appendChild(card);
        
        // Ajout correct de l'écouteur d'événement pour le bouton "Voter"
        card.querySelector('.vote-btn').addEventListener('click', () => showVoteModal(ric.id));
    });
}

/**
 * Affiche la modale pour voter sur un RIC.
 * @param {string} ricId - L'ID du référendum.
 */
function showVoteModal(ricId) {
    const ric = activeRicsData.find(r => r.id === ricId);
    if (!ric) {
        console.error("Référendum non trouvé avec l'ID :", ricId);
        return;
    }

    const voteTemplate = document.getElementById('ric-vote-template');
    if (!voteTemplate) {
        console.error("Template 'ric-vote-template' non trouvé.");
        return;
    }
    const modalContent = voteTemplate.content.cloneNode(true);

    modalContent.querySelector('#ric-vote-question').textContent = ric.question;
    modalContent.querySelector('#ric-vote-description').textContent = ric.description;
    
    const voteYesBtn = modalContent.querySelector('#vote-yes-btn');
    const voteNoBtn = modalContent.querySelector('#vote-no-btn');
    
    if (voteYesBtn) {
        voteYesBtn.addEventListener('click', () => {
            alert(`Vote "OUI" enregistré pour le référendum "${ric.question}" !`);
            ric.votes_for++;
            hideModal();
            loadRics();
        });
    }

    if (voteNoBtn) {
        voteNoBtn.addEventListener('click', () => {
            alert(`Vote "NON" enregistré pour le référendum "${ric.question}" !`);
            ric.votes_against++;
            hideModal();
            loadRics();
        });
    }
    
    showModal(`Voter sur le RIC : "${ric.question}"`, modalContent);
}

// L'ancienne fonction initRicMap a été remplacée par la logique de la modale.
// J'ai gardé le même nom pour la lisibilité, mais elle ne fait plus rien.
function initRicMap() {}
