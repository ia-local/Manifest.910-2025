// Fichier : public/src/js/app.js
// Ce fichier gère la navigation et l'initialisation des différentes pages de l'application.

// --- Lancement de l'application ---
document.addEventListener('DOMContentLoaded', () => {
    loadAsideMenu();
    loadPage('home');
});

// --- Fonctions de navigation ---

/**
 * Charge le menu latéral de l'application.
 */
function loadAsideMenu() {
    const mainNavigation = document.getElementById('main-navigation');
    if (mainNavigation) {
        mainNavigation.innerHTML = `
            <div class="logo">
                <h3>Plateforme Citoyenne</h3>
            </div>
            <ul>
                <li><a href="#" onclick="loadPage('home')" data-page="home">Accueil</a></li>
                <li><a href="#" onclick="loadPage('dashboard')" data-page="dashboard">Tableau de bord</a></li>
                <li><a href="#" onclick="loadPage('ric')" data-page="ric">RIC</a></li>
                <li><a href="#" onclick="loadPage('boycottage')" data-page="boycottage">Boycottage</a></li>
                <li><a href="#" onclick="loadPage('organisation')" data-page="organisation">Organisation</a></li>
                <li><a href="#" onclick="loadPage('contacts')" data-page="contacts">Contacts</a></li>
                <li><a href="#" onclick="loadPage('affaires')" data-page="affaires">Affaires</a></li>
            </ul>
        `;
    }
}

/**
 * Charge une page HTML de manière dynamique dans le contenu principal.
 * @param {string} pageName - Le nom de la page à charger (ex: 'home', 'boycottage').
 */
function loadPage(pageName) {
    const mainContent = document.getElementById('main-content');
    const asideLinks = document.querySelectorAll('.main-aside a');

    asideLinks.forEach(link => {
        if (link.dataset.page === pageName) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });

    fetch(`src/pages/${pageName}.html`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Erreur de chargement de la page ${pageName}: ${response.statusText}`);
            }
            return response.text();
        })
        .then(html => {
            mainContent.innerHTML = html;
            switch (pageName) {
                case 'dashboard':
                    initDashboard();
                    break;
                case 'ric':
                    initRicPage();
                    break;
                case 'boycottage':
                    initBoycottagePage();
                    break;
                default:
                    console.log(`Page ${pageName} chargée, pas de fonction d'initialisation.`);
                    break;
            }
        })
        .catch(error => {
            console.error('Erreur lors du chargement de la page:', error);
            mainContent.innerHTML = `<div class="error-message"><h2>Erreur</h2><p>${error.message}</p></div>`;
        });
}

// --- Fonctions d'initialisation des pages ---

/**
 * Initialise la page du tableau de bord et affiche les listes d'entités.
 */
function initDashboard() {
    console.log("Initialisation du tableau de bord...");

    const targetDate = new Date('2025-09-10T00:00:00');
    const countdownElement = document.getElementById('countdown');
    if (countdownElement) {
        setInterval(() => {
            const now = new Date();
            const diff = targetDate - now;
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            countdownElement.textContent = `J-${days} avant le 10 septembre`;
        }, 1000);
    }

    fetch('/api/dashboard/summary')
        .then(response => {
            if (!response.ok) throw new Error('Erreur de chargement des données du tableau de bord.');
            return response.json();
        })
        .then(data => {
            document.getElementById('caisse-solde').textContent = `Solde : ${data.caisseSolde} €`;
            document.getElementById('boycott-count').textContent = `${data.boycottCount} enseignes listées`;
            document.getElementById('ric-count').textContent = `${data.ricCount} propositions actives`;
        })
        .catch(error => console.error('Erreur:', error));

    // Appel de la nouvelle fonction pour afficher les listes d'entités
    displayEntityLists();
}

/**
 * Affiche les listes des préfectures et des groupes Telegram.
 */
async function displayEntityLists() {
    try {
        const response = await fetch('/database.json');
        if (!response.ok) {
            throw new Error(`Erreur de chargement de la base de données : ${response.statusText}`);
        }
        const data = await response.json();

        const prefecturesList = document.getElementById('prefectures-list');
        const telegramList = document.getElementById('telegram-list');

        if (prefecturesList) {
            prefecturesList.innerHTML = data.prefectures.map(p => `<li>${p.city} (${p.department})</li>`).join('');
        }

        if (telegramList) {
            telegramList.innerHTML = data.telegram_groups.map(g => `<li><a href="${g.link}" target="_blank">${g.name} - ${g.city}</a></li>`).join('');
        }

    } catch (error) {
        console.error('Erreur lors de l\'affichage des listes d\'entités:', error);
    }
}


/**
 * Initialise la page du Référendum d'Initiative Citoyenne (RIC).
 */
function initRicPage() {
    console.log("Initialisation de la page RIC...");
    fetch('/api/rics')
        .then(response => response.json())
        .then(rics => {
            const ricList = document.getElementById('ric-list');
            if (ricList) {
                ricList.innerHTML = rics.map(ric => `
                    <div class="card ric-card">
                        <h3>${ric.title}</h3>
                        <p>${ric.description}</p>
                        <p>Statut : ${ric.status} | Signatures : ${ric.signatures}</p>
                    </div>
                `).join('');
            }
        })
        .catch(error => console.error('Erreur de chargement des RIC:', error));
}


async function fetchAllData() {
    try {
        const databaseResponse = await fetch('/database.json');
        const data = await databaseResponse.json();
        
        return {
            boycotts: data.boycotts,
            prefectures: data.prefectures,
            telegramGroups: data.telegram_groups,
            manifestationPoints: data.manifestation_points,
            strategicLocations: data.strategic_locations
        };
    } catch (error) {
        console.error('Erreur lors de la récupération des données:', error);
        return { boycotts: [], prefectures: [], telegramGroups: [], manifestationPoints: [], strategicLocations: [] };
    }
}


/**
 * Initialise la page de Boycottage en chargeant les données nécessaires pour la carte.
 */
async function initBoycottagePage() {
    console.log("Initialisation de la page Boycottage...");

    try {
        const data = await fetchAllData();

        const mapContainer = document.getElementById('map');
        if (mapContainer && typeof initMap === 'function') {
            initMap(data.boycotts, data.prefectures, data.telegramGroups, data.manifestationPoints, data.strategicLocations);
        } else {
            console.error('Erreur: Le conteneur de carte ou la fonction initMap est manquant.');
        }

        const form = document.getElementById('new-boycott-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(form);
                const newData = Object.fromEntries(formData.entries());

                const newEntity = {
                    name: newData.name,
                    type: newData.type,
                    description: newData.description,
                    locations: [
                        { lat: parseFloat(newData.lat), lon: parseFloat(newData.lon) }
                    ]
                };

                const response = await fetch('/api/boycotts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newEntity)
                });

                if (response.ok) {
                    alert('Enseigne ajoutée avec succès !');
                    loadPage('boycottage');
                } else {
                    alert('Erreur lors de l ajout de lenseigne.');
                }
            });
        }
    } catch (error) {
        console.error('Erreur:', error);
    }
}