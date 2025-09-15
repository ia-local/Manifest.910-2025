// Fichier : public/src/js/map.js
// Ce fichier gère l'initialisation et l'affichage de la carte Leaflet.
import { openIpCamModal } from './ipCam.js';

let map;
let markerLayers = {};
let mapInitialized = false;
let allData = {};

// --- Définition des icônes personnalisées ---
const manifestationIcon = L.icon({ iconUrl: 'src/img/manifestation-icon.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] });
const mairieIcon = L.icon({ iconUrl: 'src/img/mairie-icon.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] });
const prefectureIcon = L.icon({ iconUrl: 'src/img/pref.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] });
const telegramIcon = L.icon({ iconUrl: 'src/img/telegram.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] });
const universityIcon = L.icon({ iconUrl: 'src/img/university.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] });
const hospitalIcon = L.icon({ iconUrl: 'src/img/hospital.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] });
const roundaboutIcon = L.icon({ iconUrl: 'src/img/roundabout-icon.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] });
const porteIcon = L.icon({ iconUrl: 'src/img/porte-icon.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] });
const elyseeIcon = L.icon({ iconUrl: 'src/img/boutique.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] });
const banqueDeFranceIcon = L.icon({ iconUrl: 'src/img/banque_de_france.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] });
const cameraIcon = L.icon({ iconUrl: 'src/img/camera-icon.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] });
const fixedCameraIcon = L.icon({ iconUrl: 'src/img/fixed-camera.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] });
const panoramicCameraIcon = L.icon({ iconUrl: 'src/img/panoramic-camera.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] });
const domeCameraIcon = L.icon({ iconUrl: 'src/img/dome-camera.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] });
const guardIcon = L.icon({ iconUrl: 'src/img/guard-icon.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] });
const alprIcon = L.icon({ iconUrl: 'src/img/alpr-icon.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] });
const boycottIcon = L.icon({ iconUrl: 'src/img/boycott-icon.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] });
const transportIcon = L.icon({ iconUrl: 'src/img/transport-icon.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] });
const artisanatIcon = L.icon({ iconUrl: 'src/img/artisanat-icon.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] });
const tourismeIcon = L.icon({ iconUrl: 'src/img/tourisme-icon.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] });
const industrieIcon = L.icon({ iconUrl: 'src/img/industry.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] });
const agricoleIcon = L.icon({ iconUrl: 'src/img/agricole-icon.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] });
const economieIcon = L.icon({ iconUrl: 'src/img/banque_de_france.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] });
const satelliteIcon = L.icon({ iconUrl: 'src/img/satellite.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] });

const entityIcons = {
    'Leclerc': L.icon({ iconUrl: 'src/img/Leclerc.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] }),
    'Carrefour': L.icon({ iconUrl: 'src/img/Carrefour.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] }),
    'Amazon': L.icon({ iconUrl: 'src/img/Amazon-icon.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] }),
    'Intermarché': L.icon({ iconUrl: 'src/img/Intermarche.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] }),
    'Super U': L.icon({ iconUrl: 'src/img/U.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] }),
    'Auchan': L.icon({ iconUrl: 'src/img/Auchan.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] }),
    'Lidl': L.icon({ iconUrl: 'src/img/Lidl.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] }),
    'Aldi': L.icon({ iconUrl: 'src/img/Aldi.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] }),
    'Monoprix': L.icon({ iconUrl: 'src/img/Monoprix.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] }),
    'Proxy/Cocci-MARKET': L.icon({ iconUrl: 'src/img/Proxy_Cocci-MARKET.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] }),
    'Total': L.icon({ iconUrl: 'src/img/total.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] }),
    'HSBC': L.icon({ iconUrl: 'src/img/HSBC.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] }),
    'Société Générale': L.icon({ iconUrl: 'src/img/SocieteGenerale.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] }),
    'Crédit Coopératif': L.icon({ iconUrl: 'src/img/CreditCooperatif.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] }),
    'Crédit Agricole': L.icon({ iconUrl: 'src/img/CreditAgricole.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] }),
    'La Poste': L.icon({ iconUrl: 'src/img/LaPoste.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] }),
    'Crédit Lyonnais': L.icon({ iconUrl: 'src/img/CreditLyonnais.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] }),
    'Crédit Mutuel': L.icon({ iconUrl: 'src/img/CreditMutuel.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] }),
    'CIC': L.icon({ iconUrl: 'src/img/CIC.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] }),
    'EUROPAFI': L.icon({ iconUrl: 'src/img/EUROPAFI.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] }),
    'Banque de France': banqueDeFranceIcon,
    'Camera Point': cameraIcon,
    'McDonald\'s': L.icon({ iconUrl: 'src/img/McDonalds.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] })
};

function getIconForCameraPoint(cameraType) {
    switch (cameraType) {
        case 'fixed': return fixedCameraIcon;
        case 'panning': return panoramicCameraIcon;
        case 'dome': return domeCameraIcon;
        case 'guard': return guardIcon;
        case 'ALPR': return alprIcon;
        default: return cameraIcon;
    }
}

function getIconForCategory(categoryName) {
    switch (categoryName) {
        case 'Commerce': return L.icon({ iconUrl: 'src/img/boycott-icon.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] });
        case 'Économie': return L.icon({ iconUrl: 'src/img/banque_de_france.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] });
        case 'Caméras': return L.icon({ iconUrl: 'src/img/camera-icon.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] });
        case 'Éducation': return L.icon({ iconUrl: 'src/img/university.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] });
        case 'Santé': return L.icon({ iconUrl: 'src/img/hospital.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] });
        case 'Gouvernement': return L.icon({ iconUrl: 'src/img/mairie-icon.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] });
        case 'Manifestation': return L.icon({ iconUrl: 'src/img/manifestation-icon.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] });
        case 'Points Stratégiques': return L.icon({ iconUrl: 'src/img/roundabout-icon.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] });
        case 'Réseaux Sociaux': return L.icon({ iconUrl: 'src/img/telegram.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] });
        case 'Industrie': return L.icon({ iconUrl: 'src/img/industrie-icon.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] });
        case 'Transport': return L.icon({ iconUrl: 'src/img/transport-icon.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] });
        case 'Artisanat': return L.icon({ iconUrl: 'src/img/artisanat-icon.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] });
        case 'Tourisme': return L.icon({ iconUrl: 'src/img/tourisme-icon.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] });
        case 'Satellites': return L.icon({ iconUrl: 'src/img/satellites.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] });
        default: return L.icon({ iconUrl: 'src/img/default-icon.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] });
    }
}

/**
 * Fonction utilitaire pour obtenir l'icône appropriée pour un élément
 */
function getIconForItem(item) {
    if (item.name && entityIcons[item.name]) {
        return entityIcons[item.name];
    }
    if (item.type && (item.type === 'fixed' || item.type === 'panning' || item.type === 'dome' || item.type === 'guard' || item.type === 'ALPR')) {
        return getIconForCameraPoint(item.type);
    }
    if (item.type) {
        if (item.type.toLowerCase().includes('préfecture')) return prefectureIcon;
        if (item.type.toLowerCase().includes('mairie')) return mairieIcon;
        if (item.type.toLowerCase().includes('université')) return universityIcon;
        if (item.type.toLowerCase().includes('hôpital')) return hospitalIcon;
        if (item.type.toLowerCase().includes('banque') || item.type.toLowerCase().includes('crédit') || item.type.toLowerCase().includes('financière')) return banqueDeFranceIcon;
        if (item.type.toLowerCase().includes('telegram')) return telegramIcon;
        if (item.type.toLowerCase().includes('rond-point')) return roundaboutIcon;
        if (item.type.toLowerCase().includes('porte')) return porteIcon;
    }
    return getIconForCategory(item.category);
}


/**
 * Catégorise et enrichit les données de la carte.
 * @param {Object} allData - L'objet contenant toutes les données de la base de données.
 */
function categorizeData(allData) {
    const categories = {
        'Commerce': { icon: getIconForCategory('Commerce'), items: [] },
        'Économie': { icon: getIconForCategory('Économie'), items: [] },
        'Caméras': { icon: getIconForCategory('Caméras'), items: [] },
        'Éducation': { icon: getIconForCategory('Éducation'), items: [] },
        'Santé': { icon: getIconForCategory('Santé'), items: [] },
        'Gouvernement': { icon: getIconForCategory('Gouvernement'), items: [] },
        'Manifestation': { icon: getIconForCategory('Manifestation'), items: [] },
        'Points Stratégiques': { icon: getIconForCategory('Points Stratégiques'), items: [] },
        'Réseaux Sociaux': { icon: getIconForCategory('Réseaux Sociaux'), items: [] },
        'Industrie': { icon: getIconForCategory('Industrie'), items: [] }
    };

    if (allData.boycotts) {
        allData.boycotts.forEach(entity => {
            if (entity.locations) {
                entity.locations.forEach(location => {
                    if (location.lat && location.lon) {
                        const item = { ...entity, ...location };
                        if (item.type.toLowerCase().includes('banque') || item.type.toLowerCase().includes('crédit') || item.name.toLowerCase().includes('europafi')) {
                            item.category = 'Économie';
                            categories['Économie'].items.push(item);
                        } else if (item.type.toLowerCase().includes('industrie') || item.name.toLowerCase().includes('total')) {
                            item.category = 'Industrie';
                            categories['Industrie'].items.push(item);
                        } else {
                            item.category = 'Commerce';
                            categories['Commerce'].items.push(item);
                        }
                    }
                });
            }
        });
    }

    if (allData.cameras_points) {
        allData.cameras_points.forEach(point => {
            if (point.lat && point.lon) {
                point.category = 'Caméras';
                categories['Caméras'].items.push(point);
            }
        });
    }

    if (allData.strategic_locations) {
        allData.strategic_locations.forEach(location => {
            if (location.lat && location.lon) {
                if (location.type === 'Université') {
                    location.category = 'Éducation';
                    categories['Éducation'].items.push(location);
                } else if (location.type === 'Hôpital') {
                    location.category = 'Santé';
                    categories['Santé'].items.push(location);
                }
            }
        });
    }

    if (allData.mairies) {
        allData.mairies.forEach(mairie => {
            if (mairie.lat && mairie.lon) {
                mairie.category = 'Gouvernement';
                categories['Gouvernement'].items.push(mairie);
            }
        });
    }
    if (allData.prefectures) {
        allData.prefectures.forEach(pref => {
            if (pref.lat && pref.lon) {
                pref.category = 'Gouvernement';
                categories['Gouvernement'].items.push(pref);
            }
        });
    }
    if (allData.elysee_point && allData.elysee_point.lat && allData.elysee_point.lon) {
        allData.elysee_point.category = 'Gouvernement';
        categories['Gouvernement'].items.push(allData.elysee_point);
    }

    if (allData.manifestation_points) {
        allData.manifestation_points.forEach(point => {
            if (point.lat && point.lon) {
                point.category = 'Manifestation';
                categories['Manifestation'].items.push(point);
            }
        });
    }
    if (allData.roundabout_points) {
        allData.roundabout_points.forEach(point => {
            if (point.lat && point.lon) {
                point.category = 'Points Stratégiques';
                categories['Points Stratégiques'].items.push(point);
            }
        });
    }
    if (allData.porte_points) {
        allData.porte_points.forEach(point => {
            if (point.lat && point.lon) {
                point.category = 'Points Stratégiques';
                categories['Points Stratégiques'].items.push(point);
            }
        });
    }
    
    if (allData.telegram_groups) {
        allData.telegram_groups.forEach(group => {
            if (group.lat && group.lon) {
                group.category = 'Réseaux Sociaux';
                categories['Réseaux Sociaux'].items.push(group);
            }
        });
    }
    
    return categories;
}

/**
 * Affiche la liste des sous-éléments d'une catégorie
 */
function renderSublist(categoryName) {
    const legendList = document.getElementById('legend-list');
    legendList.innerHTML = '';
    
    const backBtn = document.createElement('li');
    backBtn.className = 'legend-back-btn';
    backBtn.innerHTML = `<span class="legend-icon" style="background-image: url('${getIconForCategory(categoryName).options.iconUrl}')"></span> Retour`;
    backBtn.addEventListener('click', renderCategories);
    legendList.appendChild(backBtn);

    const category = categorizeData(allData)[categoryName];

    if (category && category.items.length > 0) {
        const showAllBtn = document.createElement('li');
        showAllBtn.className = 'legend-item show-all-btn';
        showAllBtn.setAttribute('data-category', categoryName);
        showAllBtn.innerHTML = `<span class="legend-icon" style="background-image: url('src/img/map.png')"></span>Afficher tout (${category.items.length})`;
        
        showAllBtn.addEventListener('click', () => {
            const layer = markerLayers[categoryName];
            const isVisible = map.hasLayer(layer);
            if (isVisible) {
                map.removeLayer(layer);
                showAllBtn.classList.remove('active');
            } else {
                map.addLayer(layer);
                showAllBtn.classList.add('active');
            }
        });
        legendList.appendChild(showAllBtn);
    }
    
    if (category && category.items.length > 0) {
        const ulSublist = document.createElement('ul');
        ulSublist.className = 'sub-list-items';

        category.items.forEach(item => {
            if (item.lat && item.lon) {
                const liItem = document.createElement('li');
                liItem.className = 'legend-item';
                liItem.setAttribute('data-lat', item.lat);
                liItem.setAttribute('data-lon', item.lon);
                liItem.setAttribute('data-category', categoryName);
                
                const icon = getIconForItem(item);
                liItem.innerHTML = `<span class="legend-icon" style="background-image: url('${icon.options.iconUrl}')"></span>${item.name || item.city}`;
                
                liItem.addEventListener('click', () => {
                    const lat = parseFloat(liItem.getAttribute('data-lat'));
                    const lon = parseFloat(liItem.getAttribute('data-lon'));
                    const marker = findMarkerInLayer(markerLayers[categoryName], lat, lon);
                    
                    if (marker) {
                        const isVisible = map.hasLayer(marker);
                        if (isVisible) {
                            map.removeLayer(marker);
                            liItem.classList.remove('active');
                        } else {
                            map.addLayer(marker);
                            liItem.classList.add('active');
                            map.panTo([lat, lon]);
                            marker.openPopup();
                        }
                    }
                });
                ulSublist.appendChild(liItem);
            }
        });
        legendList.appendChild(ulSublist);
    }
}

/**
 * Affiche la liste des catégories principales
 */
function renderCategories() {
    const legendList = document.getElementById('legend-list');
    legendList.innerHTML = '';
    
    const categories = categorizeData(allData);

    for (const categoryName in categories) {
        const category = categories[categoryName];
        if (category && category.items.length > 0) {
            const liCategory = document.createElement('li');
            liCategory.className = 'legend-category';
            liCategory.setAttribute('data-category', categoryName);
            const iconUrl = getIconForCategory(categoryName).options.iconUrl;
            liCategory.innerHTML = `<span class="legend-icon" style="background-image: url('${iconUrl}')"></span>${categoryName}`;
            
            liCategory.addEventListener('click', () => {
                renderSublist(categoryName);
            });
            legendList.appendChild(liCategory);
        }
    }
    
    const showAllBtn = document.createElement('li');
    showAllBtn.className = 'legend-category';
    showAllBtn.innerHTML = `<span class="legend-icon" style="background-image: url('src/img/map.png')"></span>Tout afficher`;
    showAllBtn.addEventListener('click', () => {
        const allCategories = document.querySelectorAll('.legend-category');
        const allActive = Array.from(allCategories).every(cat => cat.classList.contains('active'));
        
        if (allActive) {
            for (const name in markerLayers) {
                map.removeLayer(markerLayers[name]);
            }
            allCategories.forEach(cat => cat.classList.remove('active'));
            showAllBtn.classList.remove('active');
        } else {
            for (const name in markerLayers) {
                map.addLayer(markerLayers[name]);
            }
            allCategories.forEach(cat => cat.classList.add('active'));
            showAllBtn.classList.add('active');
        }
    });
    legendList.appendChild(showAllBtn);
}

/**
 * Fonction utilitaire pour trouver un marqueur dans une couche
 */
function findMarkerInLayer(layer, lat, lon) {
    let foundMarker = null;
    layer.eachLayer(marker => {
        if (marker.getLatLng().lat === lat && marker.getLatLng().lng === lon) {
            foundMarker = marker;
        }
    });
    return foundMarker;
}

/**
 * Initialise la carte Leaflet et ajoute les marqueurs.
 * @param {Object} allDataPassed - L'objet contenant toutes les données de la base de données.
 */
export function initMap(allDataPassed) {
    if (mapInitialized) return;

    allData = allDataPassed;

    map = L.map('map').setView([46.603354, 1.888334], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    mapInitialized = true;
    
    const categorizedData = categorizeData(allData);

    for (const categoryName in categorizedData) {
        if (categorizedData.hasOwnProperty(categoryName)) {
            const category = categorizedData[categoryName];
            if (category.items.length > 0) {
                const markersInLayer = [];
                category.items.forEach(item => {
                    const icon = getIconForItem(item);
                    if (item.lat && item.lon) {
                        const marker = L.marker([item.lat, item.lon], { icon: icon });

                        let popupContent = `<b>${item.name || item.city}</b>`;
                        if (item.type) popupContent += `<br>Type: ${item.type}`;
                        if (item.description) popupContent += `<br>Description: ${item.description}`;
                        if (item.city) popupContent += `<br>Ville: ${item.city}`;
                        if (item.link) popupContent += `<br><a href="${item.link}" target="_blank">Rejoindre</a>`;
                        if (item.video_link) {
                            popupContent += `<br><a href="#" onclick="event.preventDefault(); window.openIpCamModal('${item.video_link}', 'Flux Vidéo - ${item.name || item.city}');">Voir le flux</a>`;
                        }
                        marker.bindPopup(popupContent);
                        markersInLayer.push(marker);
                    }
                });
                markerLayers[categoryName] = L.layerGroup(markersInLayer);
            }
        }
    }

    renderCategories();
}