// Fichier : public/src/js/app.js
// Ce fichier gère la navigation et l'initialisation des différentes pages de l'application.

import { initMap } from './map.js';
import { initBlogPage } from './blog.js';
import { initMissionsPage } from './missions.js';
import { initRicPage } from './rics.js';
import { initDashboard } from './dashboard.js';
import { initLegalPage } from './legal.js';
import { initCvnuPage } from './cvnu.js';
import { initSmartContractPage } from './smartContract.js';
import { initCvnuModal } from './modalCvnu.js';
import { initOrganisationPage } from './timeline.js';
import { initPlaygroundPage } from './playground.js';
import { initMapModal } from './modalMap.js';

/**
 * Fonction principale d'initialisation de l'application au chargement de la page.
 */
function initializeApp() {
    loadAsideMenu();
    attachNavigationEvents();
    loadPage('home');
    initCvnuModal();
    initMapModal();

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
                <li><a href="#" data-page="affaires">Affaires</a></li>
                <li><a href="#" data-page="missions">Missions</a></li>
                <li><a href="#" data-page="playground">playground</a></li>
                <li><a href="#" data-page="ric">RIC</a></li>
                <li><a href="#" data-page="smartContract">Smart Contract</a></li>
                <li><a href="#" data-page="blog">Blog</a></li>
                <li><a href="#" data-page="map">Carte</a></li>
                <li><a href="#" data-page="cvnu">CV Numérique</a></li>
                <li><a href="#" data-page="contacts">Contacts</a></li>
                <li><a href="#" data-page="organisation">Organisation</a></li>
            </ul>
        `;
    }
}

/**
 * Attache les écouteurs d'événements de clic aux liens de navigation.
 */
function attachNavigationEvents() {
    const allLinks = document.querySelectorAll('.main-aside a, .app-footer a');
    allLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const pageName = e.target.dataset.page;
            if (pageName) {
                if (pageName === 'map' && e.target.closest('.app-footer')) {
                    initMapModal();
                } else if (pageName === 'map') {
                    loadPage('map');
                } else {
                    loadPage(pageName);
                }
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
            case 'playground':
                initPlaygroundPage();
                break;
            case 'ric':
                initRicPage();
                break;
            case 'map':
                const data = await fetchAllData();
                initMap(data); 
                break;
            case 'cvnu':
                initCvnuPage();
                break;
            case 'blog':
                initBlogPage();
                break;
            case 'missions':
                initMissionsPage();
                break;
            case 'smartContract':
                initSmartContractPage();
                break;
            case 'legal':
                initLegalPage();
                break;
            case 'organisation':
                initOrganisationPage();
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
        const response = await fetch('/database.json');
        if (!response.ok) {
            throw new Error(`Erreur de chargement de la base de données : ${response.statusText}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Erreur lors de la récupération des données:', error);
        return {};
    }
}

document.addEventListener('DOMContentLoaded', initializeApp);

window.loadPage = loadPage;
window.initRicPage = initRicPage;
window.initMap = initMap;
window.initBlogPage = initBlogPage;
window.initMissionsPage = initMissionsPage;
window.initSmartContractPage = initSmartContractPage;
window.initCvnuPage = initCvnuPage;
window.initPlaygroundPage = initPlaygroundPage;
window.initLegalPage = initLegalPage;
window.initOrganisationPage = initOrganisationPage;
window.initMapModal = initMapModal;