// Fichier : public/src/js/app.js
// Ce fichier gère la navigation et l'initialisation des différentes pages de l'application.

import { initMap } from './map.js';
import { initBlogPage } from './blog.js';
import { initMissionsPage } from './missions.js';
import { initRicPage } from './rics.js'; 
import { initDashboard } from './dashboard.js'; 
import { initLegalPage } from './legal.js'; // NOUVEAU: Importe la fonction pour la page légale
import { initCvnuPage } from './cvnu.js';
import { initCvnuModal } from './modalCvnu.js';
/**
 * Fonction principale d'initialisation de l'application au chargement de la page.
 */
function initializeApp() {
    loadAsideMenu();
    attachNavigationEvents(); // NOUVEAU: Appelle la fonction d'attachement d'événements
    loadPage('home');
    initCvnuModal(); // NOUVEAU: Initialise le comportement du modal CVNU

    const loadingScreen = document.querySelector('.loading-screen');
    if (loadingScreen) {
        loadingScreen.style.display = 'none';
    }
}

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
                <li><a href="#" data-page="home">Accueil</a></li>
                <li><a href="#" data-page="dashboard">Tableau de bord</a></li>
                <li><a href="#" data-page="cvnu">cvnu</a></li>
                <li><a href="#" data-page="ric">RIC</a></li>
                <li><a href="#" data-page="map">Carte</a></li>
                <li><a href="#" data-page="blog">Blog</a></li>
                <li><a href="#" data-page="missions">Missions</a></li> 
                <li><a href="#" data-page="organisation">Organisation</a></li>
                <li><a href="#" data-page="contacts">Contacts</a></li>
                <li><a href="#" data-page="affaires">Affaires</a></li>
            </ul>
        `;
    }
}

/**
 * Attache les écouteurs d'événements de clic aux liens de navigation.
 */
function attachNavigationEvents() {
    // Sélectionne tous les liens de l'aside et du footer
    const allLinks = document.querySelectorAll('.main-aside a, .app-footer a');
    allLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const pageName = e.target.dataset.page;
            if (pageName) {
                loadPage(pageName);
            }
        });
    });
}

/**
 * Charge une page HTML de manière dynamique dans le contenu principal.
 * @param {string} pageName - Le nom de la page à charger (ex: 'home', 'map').
 */
async function loadPage(pageName) {
    const mainContent = document.getElementById('main-content');
    const asideLinks = document.querySelectorAll('.main-aside a');
    const footerLinks = document.querySelectorAll('.app-footer a');

    // Mise à jour de la classe 'active' pour les liens de l'aside
    asideLinks.forEach(link => {
        link.classList.toggle('active', link.dataset.page === pageName);
    });

    try {
        const response = await fetch(`src/pages/${pageName}.html`);
        if (!response.ok) {
            throw new Error(`Erreur de chargement de la page ${pageName}: ${response.statusText}`);
        }
        const html = await response.text();
        mainContent.innerHTML = html;
        
        switch (pageName) {
            case 'dashboard':
                initDashboard();
                break;
            case 'cvnu': // NOUVEAU: Cas pour la page CVNU
                initCvnuPage();
                break;
            case 'ric':
                initRicPage();
                break;
            case 'map':
                initMapPage();
                break;
        case 'blog':
            initBlogPage(); // L'appel est déjà en place
            break;
            case 'missions':
                initMissionsPage();
                break;
            case 'legal':
                initLegalPage(); // NOUVEAU: Appel à la fonction d'initialisation de la page légale
                break;
            default:
                console.log(`Page ${pageName} chargée, pas de fonction d'initialisation spécifique.`);
                break;
        }

    } catch (error) {
        console.error('Erreur lors du chargement de la page:', error);
        mainContent.innerHTML = `<div class="error-message"><h2>Erreur</h2><p>${error.message}</p></div>`;
    }
}

async function fetchAllData() {
    try {
        const [
            databaseResponse,
            cameraResponse,
            ricsResponse,
            boycottsResponse
        ] = await Promise.all([
            fetch('/database.json'),
            fetch('/api/public-cameras'),
            fetch('/api/rics'),
            fetch('/api/boycotts')
        ]);
        
        const data = databaseResponse.ok ? await databaseResponse.json() : {};
        const cameraPoints = cameraResponse.ok ? await cameraResponse.json() : [];
        const ricsData = ricsResponse.ok ? await ricsResponse.json() : [];
        const boycottsData = boycottsResponse.ok ? await boycottsResponse.json() : [];
        
        return {
            boycotts: boycottsData || data.boycotts || [],
            prefectures: data.prefectures || [],
            telegramGroups: data.telegram_groups || [],
            manifestationPoints: data.manifestation_points || [],
            strategicLocations: data.strategic_locations || [],
            roundaboutPoints: data.roundabout_points || [],
            portePoints: data.porte_points || [],
            elyseePoint: data.elysee_point,
            cameraPoints: cameraPoints,
            mairies: data.mairies || [],
            rics: ricsData || []
        };
    } catch (error) {
        console.error('Erreur lors de la récupération des données:', error);
        return { boycotts: [], prefectures: [], telegramGroups: [], manifestationPoints: [], strategicLocations: [], roundaboutPoints: [], portePoints: [], elyseePoint: null, cameraPoints: [], mairies: [], rics: [] };
    }
}

// Renommage de la fonction d'initialisation de la carte pour la cohérence
async function initMapPage() {
    console.log("Initialisation de la page map...");
    try {
        const data = await fetchAllData();
        const mapContainer = document.getElementById('map');
        if (mapContainer && typeof initMap === 'function') {
            initMap(data.boycotts, data.prefectures, data.telegramGroups, data.manifestationPoints, data.strategicLocations, data.roundaboutPoints, data.portePoints, data.elyseePoint, data.cameraPoints, data.mairies);
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
                    locations: [{ lat: parseFloat(newData.lat), lon: parseFloat(newData.lon) }]
                };

                const response = await fetch('/api/boycotts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newEntity)
                });

                if (response.ok) {
                    alert('Enseigne ajoutée avec succès !');
                    loadPage('map');
                } else {
                    alert('Erreur lors de l’ajout de l’enseigne.');
                }
            });
        }
    } catch (error) {
        console.error('Erreur:', error);
    }
}

document.addEventListener('DOMContentLoaded', initializeApp);

// Les fonctions globales sont déconseillées mais sont nécessaires pour les appels onclick dans le HTML existant
// La bonne pratique est d'utiliser des écouteurs d'événements comme dans attachNavigationEvents()
window.loadPage = loadPage;
window.initRicPage = initRicPage;
window.initmapPage = initMapPage;
window.initBlogPage = initBlogPage;
window.initMissionsPage = initMissionsPage;
window.initCvnuPage = initCvnuPage; // Rendre initCvnuPage globale pour le modal