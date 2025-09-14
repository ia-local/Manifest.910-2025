// Fichier : public/src/js/map.js
// Ce fichier gère l'initialisation et l'affichage de la carte Leaflet.
import { openIpCamModal } from './ipCam.js';

let map;
let markerLayers = {}; // Utilise un objet pour stocker les couches de marqueurs
let mapInitialized = false;

// Définition des icônes personnalisées
const manifestationIcon = L.icon({
    iconUrl: 'src/img/manifestation-icon.png',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
});
const mairieIcon = L.icon({
    iconUrl: 'src/img/mairie-icon.png',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
});
const prefectureIcon = L.icon({
    iconUrl: 'src/img/pref.png',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
});

const telegramIcon = L.icon({
    iconUrl: 'src/img/telegram.png',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
});

// Nouvelles icônes pour les lieux stratégiques
const universityIcon = L.icon({
    iconUrl: 'src/img/university.png',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
});

const hospitalIcon = L.icon({
    iconUrl: 'src/img/hospital.png',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
});

// Nouvelle icône pour les ronds-points de blocage
const roundaboutIcon = L.icon({
    iconUrl: 'src/img/roundabout-icon.png',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
});

// Nouvelle icône pour les Portes de Paris
const porteIcon = L.icon({
    iconUrl: 'src/img/porte-icon.png',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
});

// Nouvelle icône pour le Palais de l'Élysée
const elyseeIcon = L.icon({
    iconUrl: 'src/img/boutique.png',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
});

// Icône de la Banque de France
const banqueDeFranceIcon = L.icon({
    iconUrl: 'src/img/banque_de_france.png',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
});

// Icône de la caméra
const cameraIcon = L.icon({
    iconUrl: 'src/img/camera-icon.png',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
});

// Nouvelles icônes spécifiques pour les caméras
const fixedCameraIcon = L.icon({
    iconUrl: 'src/img/fixed-camera.png', // Assurez-vous d'avoir cette image
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
});
const panoramicCameraIcon = L.icon({
    iconUrl: 'src/img/panoramic-camera.png', // Assurez-vous d'avoir cette image
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
});
const domeCameraIcon = L.icon({
    iconUrl: 'src/img/dome-camera.png', // Assurez-vous d'avoir cette image
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
});
const guardIcon = L.icon({
    iconUrl: 'src/img/guard-icon.png', // Assurez-vous d'avoir cette image
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
});

// Nouvelles icônes pour LAPI
const alprIcon = L.icon({
    iconUrl: 'src/img/alpr-icon.png', // Assurez-vous d'avoir cette image
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
});

// Objet pour mapper les noms d'entités à leurs icônes
const entityIcons = {
    'Leclerc': L.icon({
        iconUrl: 'src/img/Leclerc.png',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    }),
    'Carrefour': L.icon({
        iconUrl: 'src/img/Carrefour.png',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    }),
    'Amazon': L.icon({
        iconUrl: 'src/img/Amazon-icon.png',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    }),
    'Intermarché': L.icon({
        iconUrl: 'src/img/Intermarche.png',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    }),
    'Super U': L.icon({
        iconUrl: 'src/img/U.png',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    }),
    'Auchan': L.icon({
        iconUrl: 'src/img/Auchan.png',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    }),
    'Lidl': L.icon({
        iconUrl: 'src/img/Lidl.png',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    }),
    'Aldi': L.icon({
        iconUrl: 'src/img/Aldi.png',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    }),
    'Monoprix': L.icon({
        iconUrl: 'src/img/Monoprix.png',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    }),
    'Proxy/Cocci-MARKET': L.icon({
        iconUrl: 'src/img/Proxy_Cocci-MARKET.png',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    }),
    'Total': L.icon({
        iconUrl: 'src/img/total.png',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    }),
    'HSBC': L.icon({
        iconUrl: 'src/img/HSBC.png',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    }),
    'Société Générale': L.icon({
        iconUrl: 'src/img/SocieteGenerale.png',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    }),
    'Crédit Coopératif': L.icon({
        iconUrl: 'src/img/CreditCooperatif.png',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    }),
    'Crédit Agricole': L.icon({
        iconUrl: 'src/img/CreditAgricole.png',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    }),
    'La Poste': L.icon({
        iconUrl: 'src/img/LaPoste.png',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    }),
    'Crédit Lyonnais': L.icon({
        iconUrl: 'src/img/CreditLyonnais.png',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    }),
    'Crédit Mutuel': L.icon({
        iconUrl: 'src/img/CreditMutuel.png',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    }),
    'CIC': L.icon({
        iconUrl: 'src/img/CIC.png',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    }),
    'EUROPAFI': L.icon({
        iconUrl: 'src/img/EUROPAFI.png',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    }),
    'Banque de France': banqueDeFranceIcon,
    'Camera Point': cameraIcon,
    'McDonald\'s': L.icon({
        iconUrl: 'src/img/McDonalds.png',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    })
};

/**
 * Récupère l'icône appropriée en fonction du nom de l'entité.
 * @param {string} entityName - Nom de l'entité.
 * @returns {L.Icon} L'objet icône.
 */
function getIconForEntity(entityName) {
    if (entityIcons[entityName]) {
        return entityIcons[entityName];
    }
    if (entityName.includes('Banque') || entityName.includes('Crédit')) {
        return banqueDeFranceIcon;
    }
    return manifestationIcon;
}

/**
 * Récupère l'icône appropriée pour un point de caméra en fonction de son type.
 * @param {string} cameraType - Le type de la caméra ('fixed', 'panning', 'dome', 'guard', 'ALPR').
 * @returns {L.Icon} L'objet icône.
 */
function getIconForCameraPoint(cameraType) {
    switch (cameraType) {
        case 'fixed':
            return fixedCameraIcon;
        case 'panning':
            return panoramicCameraIcon;
        case 'dome':
            return domeCameraIcon;
        case 'guard':
            return guardIcon;
        case 'ALPR':
            return alprIcon;
        default:
            return cameraIcon;
    }
}

/**
 * Initialise la carte Leaflet et ajoute les marqueurs.
 * @param {Array} dataBoycotts - Données des entreprises à boycotter.
 * @param {Array} dataPrefectures - Données des préfectures.
 * @param {Array} dataTelegramGroups - Données des groupes Telegram.
 * @param {Array} dataManifestationPoints - Données des points de manifestation.
 * @param {Array} dataStrategicLocations - Données des lieux stratégiques (universités, hôpitaux).
 * @param {Array} dataRoundaboutPoints - Données des ronds-points de blocage.
 * @param {Array} dataPortePoints - Données des portes de Paris.
 * @param {Object} elyseePoint - Données du Palais de l'Élysée.
 * @param {Array} dataCameraPoints - Points de caméra pour l'analyse.
 * @param {Array} dataMairies - Données des mairies.
 */
export function initMap(dataBoycotts, dataPrefectures, dataTelegramGroups, dataManifestationPoints, dataStrategicLocations, dataRoundaboutPoints, dataPortePoints, elyseePoint, dataCameraPoints, dataMairies) {
    if (mapInitialized) return;

    map = L.map('map').setView([46.603354, 1.888334], 6);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    mapInitialized = true;

    const legendList = document.getElementById('legend-list');
    if (!legendList) {
        console.error('Erreur: L\'élément de légende est manquant.');
        return;
    }

    legendList.innerHTML = '';

    // Création des couches de marqueurs pour chaque entité
    const uniqueBoycottNames = [...new Set(dataBoycotts.map(item => item.name))];
    uniqueBoycottNames.forEach(name => {
        markerLayers[name] = L.layerGroup();
        const entities = dataBoycotts.filter(item => item.name === name);
        entities.forEach(entity => {
            if (entity.locations) {
                entity.locations.forEach(location => {
                    const icon = getIconForEntity(entity.name);
                    L.marker([location.lat, location.lon], { icon: icon })
                        .bindPopup(`<b>${entity.name}</b><br>Type: ${entity.type}<br>Description: ${entity.description}<br>Ville: ${location.city}`)
                        .addTo(markerLayers[name]);
                });
            }
        });

        const li = document.createElement('li');
        li.setAttribute('data-id', name);
        li.innerHTML = `<span class="legend-icon" style="background-image: url('${getIconForEntity(name).options.iconUrl}')"></span>${name}`;
        legendList.appendChild(li);
    });

    // Création de la couche pour les préfectures
    markerLayers['Prefecture'] = L.layerGroup();
    if (dataPrefectures && dataPrefectures.length > 0) {
        dataPrefectures.forEach(prefecture => {
            L.marker([prefecture.lat, prefecture.lon], { icon: prefectureIcon })
                .bindPopup(`<b>${prefecture.city}</b><br>Département : ${prefecture.department}`)
                .addTo(markerLayers['Prefecture']);
        });

        const liPrefecture = document.createElement('li');
        liPrefecture.setAttribute('data-id', 'Prefecture');
        liPrefecture.innerHTML = `<span class="legend-icon" style="background-image: url('${prefectureIcon.options.iconUrl}')"></span>Préfectures`;
        legendList.appendChild(liPrefecture);
    }
    // Ajout des mairies
    if (dataMairies && dataMairies.length > 0) {
        markerLayers['Mairies'] = L.layerGroup();
        dataMairies.forEach(mairie => {
            L.marker([mairie.lat, mairie.lon], { icon: mairieIcon })
                .bindPopup(`<b>Mairie de ${mairie.city}</b><br>Nom: ${mairie.name}<br>Source: <a href="https://portail-municipal.fr/" target="_blank">Portail Municipal</a>`)
                .addTo(markerLayers['Mairies']);
        });

        const liMairie = document.createElement('li');
        liMairie.setAttribute('data-id', 'Mairies');
        liMairie.innerHTML = `<span class="legend-icon" style="background-image: url('${mairieIcon.options.iconUrl}')"></span>Mairies`;
        legendList.appendChild(liMairie);
    }

    // Création de la couche pour les groupes Telegram
    markerLayers['Telegram'] = L.layerGroup();
    if (dataTelegramGroups && dataTelegramGroups.length > 0) {
        dataTelegramGroups.forEach(site => {
            L.marker([site.lat, site.lon], { icon: telegramIcon })
                .bindPopup(`<b>${site.name}</b><br>Département/Région : ${site.department}<br>Ville : ${site.city}<br><a href="${site.link}" target="_blank">Rejoindre</a>`)
                .addTo(markerLayers['Telegram']);
        });

        const liTelegram = document.createElement('li');
        liTelegram.setAttribute('data-id', 'Telegram');
        liTelegram.innerHTML = `<span class="legend-icon" style="background-image: url('${telegramIcon.options.iconUrl}')"></span>Groupes Telegram`;
        legendList.appendChild(liTelegram);
    }

    // Décomposition des points de caméra par type
    const cameraTypes = {};
    if (dataCameraPoints && dataCameraPoints.length > 0) {
        dataCameraPoints.forEach(point => {
            if (!cameraTypes[point.type]) {
                cameraTypes[point.type] = [];
            }
            cameraTypes[point.type].push(point);
        });
    }

    // Ajout des points de caméra par type de couche
    for (const type in cameraTypes) {
        if (cameraTypes.hasOwnProperty(type)) {
            const layerName = `Caméras ${type.charAt(0).toUpperCase() + type.slice(1)}`;
            markerLayers[layerName] = L.layerGroup();

            cameraTypes[type].forEach(point => {
                const iconToUse = getIconForCameraPoint(point.type);
                const marker = L.marker([point.lat, point.lon], { icon: iconToUse })
                    .bindPopup(`<b>Point d'Analyse</b><br>Nom: ${point.name}<br>Ville: ${point.city}<br>Type: ${point.type}<br>Timestamp: ${point.timestamp}`);
                
                // Ajoute un écouteur d'événement au clic pour ouvrir la modale
                marker.on('click', () => {
                    if (point.video_link) {
                        openIpCamModal(point.video_link, `Flux Vidéo - ${point.name}`);
                    }
                });
                marker.addTo(markerLayers[layerName]);
            });

            // Ajout de l'icône à la légende
            const li = document.createElement('li');
            li.setAttribute('data-id', layerName);
            const iconUrl = getIconForCameraPoint(type).options.iconUrl;
            li.innerHTML = `<span class="legend-icon" style="background-image: url('${iconUrl}')"></span>${layerName}`;
            legendList.appendChild(li);
        }
    }

    // Ajout des points de manifestation
    if (dataManifestationPoints && dataManifestationPoints.length > 0) {
        markerLayers['Manifestation Points'] = L.layerGroup();
        dataManifestationPoints.forEach(point => {
            let popupContent = `<b>Manifestation</b><br>Ville: ${point.city}<br>Estimation: ${point.count} personnes`;
            if (point.video_link) {
                popupContent += `<br><a href="${point.video_link}" target="_blank">Voir la vidéo</a>`;
            }
            L.marker([point.lat, point.lon], { icon: manifestationIcon })
                .bindPopup(popupContent)
                .addTo(markerLayers['Manifestation Points']);
        });

        const liManifestation = document.createElement('li');
        liManifestation.setAttribute('data-id', 'Manifestation Points');
        liManifestation.innerHTML = `<span class="legend-icon" style="background-image: url('${manifestationIcon.options.iconUrl}')"></span>Points de Manifestation`;
        legendList.appendChild(liManifestation);
    }
    
    // Ajout des lieux stratégiques (universités et hôpitaux)
    if (dataStrategicLocations && dataStrategicLocations.length > 0) {
        markerLayers['Lieux Stratégiques'] = L.layerGroup();
        dataStrategicLocations.forEach(location => {
            let iconToUse = null;
            if (location.type === 'Université') {
                iconToUse = universityIcon;
            } else if (location.type === 'Hôpital') {
                iconToUse = hospitalIcon;
            }

            if (iconToUse) {
                L.marker([location.lat, location.lon], { icon: iconToUse })
                    .bindPopup(`<b>${location.name}</b><br>Type: ${location.type}<br>Ville: ${location.city}`)
                    .addTo(markerLayers['Lieux Stratégiques']);
            }
        });

        const liStrategic = document.createElement('li');
        liStrategic.setAttribute('data-id', 'Lieux Stratégiques');
        liStrategic.innerHTML = `<span class="legend-icon" style="background-image: url('${universityIcon.options.iconUrl}')"></span>Universités/Hôpitaux`;
        legendList.appendChild(liStrategic);
    }

    // Ajout de l'Élysée
    if (elyseePoint && elyseePoint.name) {
        markerLayers['Palais de l\'Élysée'] = L.layerGroup();
        L.marker([elyseePoint.lat, elyseePoint.lon], { icon: elyseeIcon })
            .bindPopup(`<b>${elyseePoint.name}</b><br>Ville: ${elyseePoint.city}<br>Source: <a href="https://${elyseePoint.source}" target="_blank">${elyseePoint.source}</a>`)
            .addTo(markerLayers['Palais de l\'Élysée']);
        
        const liElysee = document.createElement('li');
        liElysee.setAttribute('data-id', 'Palais de l\'Élysée');
        liElysee.innerHTML = `<span class="legend-icon" style="background-image: url('${elyseeIcon.options.iconUrl}')"></span>Palais de l'Élysée`;
        legendList.appendChild(liElysee);
    }
    
    // Ajout des ronds-points de blocage
    if (dataRoundaboutPoints && dataRoundaboutPoints.length > 0) {
        markerLayers['Ronds-points de Blocage'] = L.layerGroup();
        dataRoundaboutPoints.forEach(roundabout => {
            L.marker([roundabout.lat, roundabout.lon], { icon: roundaboutIcon })
                .bindPopup(`<b>Rond-point de Blocage</b><br>Nom: ${roundabout.name}<br>Ville: ${roundabout.city}`)
                .addTo(markerLayers['Ronds-points de Blocage']);
        });

        const liRoundabout = document.createElement('li');
        liRoundabout.setAttribute('data-id', 'Ronds-points de Blocage');
        liRoundabout.innerHTML = `<span class="legend-icon" style="background-image: url('${roundaboutIcon.options.iconUrl}')"></span>Ronds-points de Blocage`;
        legendList.appendChild(liRoundabout);
    }

    // Ajout des portes de Paris
    if (dataPortePoints && dataPortePoints.length > 0) {
        markerLayers['Portes de Paris'] = L.layerGroup();
        dataPortePoints.forEach(porte => {
            L.marker([porte.lat, porte.lon], { icon: porteIcon })
                .bindPopup(`<b>Porte de Paris</b><br>Nom: ${porte.name}<br>Ville: ${porte.city}`)
                .addTo(markerLayers['Portes de Paris']);
        });

        const liPorte = document.createElement('li');
        liPorte.setAttribute('data-id', 'Portes de Paris');
        liPorte.innerHTML = `<span class="legend-icon" style="background-image: url('${porteIcon.options.iconUrl}')"></span>Portes de Paris`;
        legendList.appendChild(liPorte);
    }

    // Écouteurs d'événements pour basculer les couches
    document.querySelectorAll('#legend-list li').forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const entityId = item.getAttribute('data-id');
            const layer = markerLayers[entityId];
            if (layer) {
                if (map.hasLayer(layer)) {
                    map.removeLayer(layer);
                    item.classList.remove('selected');
                } else {
                    map.addLayer(layer);
                    item.classList.add('selected');
                }
            }
        });
    });
}