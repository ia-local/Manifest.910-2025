// Fichier : public/src/js/rics.js
// Ce fichier gère la logique de la page des Référendums d'Initiative Citoyenne (RIC).

let ricMap;
let activeRicsData = [];

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
            initRicMap();
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
 * Récupère les propositions de RIC depuis le fichier JSON et les affiche.
 */
function loadRics() {
    const ricListContainer = document.getElementById('ric-list');
    if (!ricListContainer) return;

    ricListContainer.innerHTML = '';

    if (activeRicsData.length === 0) {
        ricListContainer.innerHTML = `<p>Aucune proposition de RIC active pour le moment.</p>`;
        return;
    }

    activeRicsData.forEach(ric => {
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

/**
 * Initialise la carte pour afficher les résultats du scrutin.
 */
function initRicMap() {
    const mapContainer = document.getElementById('ric-map');
    if (!mapContainer) return;

    if (ricMap) {
        ricMap.remove();
    }

    ricMap = L.map('ric-map').setView([46.603354, 1.888334], 6);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
    }).addTo(ricMap);

    activeRicsData.forEach(ric => {
        if (ric.locations) {
            ric.locations.forEach(location => {
                L.circleMarker([location.lat, location.lon], {
                    radius: Math.sqrt(location.count) / 10,
                    fillColor: "#007bff",
                    color: "#000",
                    weight: 1,
                    opacity: 1,
                    fillOpacity: 0.8
                }).bindPopup(`<b>${ric.question}</b><br>Votes : ${location.count.toLocaleString()}`).addTo(ricMap);
            });
        }
    });
}
