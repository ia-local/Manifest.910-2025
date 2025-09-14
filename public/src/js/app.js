// Fichier : public/src/js/app.js
// Ce fichier gère la navigation et l'initialisation des différentes pages de l'application.

import { initMap } from './map.js';
import { initBlogPage } from './blog.js';
import { initMissionsPage } from './missions.js';
import { initRicPage } from './rics.js'; 
import { initDashboard } from './dashboard.js'; // Importe la nouvelle fonction initDashboard

// Les fonctions d'initialisation ne sont plus ajoutées à l'objet 'window'
// car elles sont gérées par le système de modules.

/**
 * Fonction principale d'initialisation de l'application au chargement de la page.
 */
function initializeApp() {
    loadAsideMenu();
    loadPage('home');

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
                <li><a href="#" onclick="loadPage('home')" data-page="home">Accueil</a></li>
                <li><a href="#" onclick="loadPage('dashboard')" data-page="dashboard">Tableau de bord</a></li>
                <li><a href="#" onclick="loadPage('ric')" data-page="ric">RIC</a></li>
                <li><a href="#" onclick="loadPage('map')" data-page="map">map</a></li>
                <li><a href="#" onclick="loadPage('blog')" data-page="blog">Blog</a></li>
                <li><a href="#" onclick="loadPage('missions')" data-page="missions">Missions</a></li> 
                <li><a href="#" onclick="loadPage('organisation')" data-page="organisation">Organisation</a></li>
                <li><a href="#" onclick="loadPage('contacts')" data-page="contacts">Contacts</a></li>
                <li><a href="#" onclick="loadPage('affaires')" data-page="affaires">Affaires</a></li>
            </ul>
        `;
    }
}

/**
 * Charge une page HTML de manière dynamique dans le contenu principal.
 * @param {string} pageName - Le nom de la page à charger (ex: 'home', 'map').
 */
async function loadPage(pageName) {
    const mainContent = document.getElementById('main-content');
    const asideLinks = document.querySelectorAll('.main-aside a');

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
        
        // Initialise la page une fois que son HTML est chargé
        switch (pageName) {
            case 'dashboard':
                initDashboard(); // Appelle la fonction importée
                break;
            case 'ric':
                initRicPage();
                break;
            case 'map':
                initmapPage();
                break;
            case 'blog':
                initBlogPage();
                break;
            case 'missions':
                initMissionsPage();
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

// ... (début du code)

async function fetchAllData() {
    try {
        const databaseResponse = await fetch('/database.json');
        if (!databaseResponse.ok) {
            throw new Error(`Erreur de chargement de la base de données : ${databaseResponse.statusText}`);
        }
        const data = await databaseResponse.json();

        const cameraResponse = await fetch('/api/public-cameras');
        const cameraPoints = cameraResponse.ok ? await cameraResponse.json() : [];
        
        return {
            boycotts: data.boycotts || [],
            prefectures: data.prefectures || [],
            telegramGroups: data.telegram_groups || [],
            manifestationPoints: data.manifestation_points || [],
            strategicLocations: data.strategic_locations || [],
            roundaboutPoints: data.roundabout_points || [],
            portePoints: data.porte_points || [],
            elyseePoint: data.elysee_point,
            cameraPoints: cameraPoints,
            mairies: data.mairies || []
        };
    } catch (error) {
        console.error('Erreur lors de la récupération des données:', error);
        return { boycotts: [], prefectures: [], telegramGroups: [], manifestationPoints: [], strategicLocations: [], roundaboutPoints: [], portePoints: [], elyseePoint: null, cameraPoints: [], mairies: [] };
    }
}

async function initmapPage() {
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
                    alert('Erreur lors de l ajout de lenseigne.');
                }
            });
        }
    } catch (error) {
        console.error('Erreur:', error);
    }
}

// Déclencher l'initialisation de l'application quand le DOM est prêt
document.addEventListener('DOMContentLoaded', initializeApp);

// Rendre loadPage globale pour les appels onclick dans le HTML
window.loadPage = loadPage;
window.initRicPage = initRicPage;
window.initmapPage = initmapPage;
window.initBlogPage = initBlogPage;
window.initMissionsPage = initMissionsPage;