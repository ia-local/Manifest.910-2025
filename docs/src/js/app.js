// Fichier : public/src/js/app.js
// Lancement de l'application au chargement complet de la page
document.addEventListener('DOMContentLoaded', () => {
    loadAsideMenu();
    loadPage('home');
});

// Fonction pour charger le menu latéral
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

// Fonction pour charger dynamiquement une page HTML
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
            // Gestion des initialisations spécifiques aux pages
            switch (pageName) {
                case 'home':
                    // initHomePage(); // Pour l'instant, la page home n'a pas de logique JS
                    break;
                case 'dashboard':
                    initDashboard();
                    break;
                case 'ric':
                    initRicPage();
                    break;
                case 'boycottage':
                    initBoycottagePage();
                    break;
                case 'organisation':
                    // initOrganisationPage();
                    break;
                case 'contacts':
                    // initContactsPage();
                    break;
                case 'affaires':
                    // initAffairesPage();
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

// Fonction d'initialisation du tableau de bord (dashboard.html)
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
}

// Fonction d'initialisation de la page RIC
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

// Fonction d'initialisation de la page Boycottage
// Fonction d'initialisation de la page Boycottage
async function initBoycottagePage() {
    console.log("Initialisation de la page Boycottage...");

    try {
        const [boycottsResponse, manifestationsResponse] = await Promise.all([
            fetch('/api/boycotts'),
            fetch('/api/manifestation-sites')
        ]);
        
        if (!boycottsResponse.ok || !manifestationsResponse.ok) {
            throw new Error('Erreur de chargement des données de la carte.');
        }

        const boycotts = await boycottsResponse.json();
        const manifestations = await manifestationsResponse.json();

        // Remplir la liste des entités
        const entitiesList = document.getElementById('entities-list');
        if (entitiesList) {
            entitiesList.innerHTML = boycotts.map(entity => `
                <div class="card boycott-card">
                    <h3>${entity.name}</h3>
                    <p>Type : ${entity.type}</p>
                    <p>${entity.description}</p>
                </div>
            `).join('');
        }
        
        // Initialiser la carte avec les données
        const mapContainer = document.getElementById('map');
        if (mapContainer) {
            initMap(boycotts, manifestations);
        }

        // Gérer l'ajout d'une nouvelle entité
        const form = document.getElementById('new-boycott-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(form);
                const data = Object.fromEntries(formData.entries());
                
                // Formater les données pour inclure les coordonnées
                const newEntity = {
                    name: data.name,
                    type: data.type,
                    description: data.description,
                    locations: [
                        { lat: parseFloat(data.lat), lon: parseFloat(data.lon) }
                    ]
                };

                const response = await fetch('/api/boycotts', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(newEntity)
                });

                if (response.ok) {
                    alert('Enseigne ajoutée avec succès !');
                    // Recharger la page pour mettre à jour la carte et la liste
                    loadPage('boycottage');
                } else {
                    alert('Erreur lors de l\'ajout de l\'enseigne.');
                }
            });
        }
    } catch (error) {
        console.error('Erreur:', error);
    }
}
// Lancement de l'application au chargement complet de la page
document.addEventListener('DOMContentLoaded', () => {
    loadAsideMenu();
    loadPage('home');
});