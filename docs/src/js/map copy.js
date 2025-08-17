// Fichier : public/src/js/map.js
// Ce fichier gère l'initialisation et l'affichage de la carte Leaflet.

let map;
let markerLayers = {};
let dataBoycotts, dataManifestations, dataTelegramSites;
let mapInitialized = false;

// Définition des icônes personnalisées
const manifestationIcon = L.icon({
    iconUrl: 'src/assets/icons/manifestation-icon.png',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
});

const prefectureIcon = L.icon({
    iconUrl: 'src/assets/icons/prefecture-icon.png',
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
    'Intermarché': L.icon({
        iconUrl: 'src/img/intermarche.png',
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
        iconUrl: 'src/img/Cocci.png',
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
        iconUrl: 'src/img/SG.png',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    }),
    'Crédit Coopératif': L.icon({
        iconUrl: 'src/img/CC.png',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    }),
    'Crédit Agricole': L.icon({
        iconUrl: 'src/img/CA.png',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    }),
    'La Poste': L.icon({
        iconUrl: 'src/img/Lapost.png',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    }),
    'Crédit Lyonnais': L.icon({
        iconUrl: 'src/img/LCL.png',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    }),
    'Crédit Mutuel': L.icon({
        iconUrl: 'src/img/CM.png',
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
        iconUrl: 'src/assets/icons/europafi-icon.png',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    }),
    'Préfecture': prefectureIcon,
    'McDonald\'s': L.icon({
        iconUrl: 'src/img/Mcdonalds.png',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    }),
    'telegram': L.icon({
        iconUrl: 'src/img/telegram.png',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    }),
    'default': L.icon({
        iconUrl: 'src/assets/icons/boycott-icon.png',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    })
};

/**
 * Retourne l'icône Leaflet appropriée pour une entité donnée.
 * @param {string} entityName - Le nom de l'entité.
 * @returns {L.Icon} L'icône Leaflet.
 */
function getIconForEntity(entityName) {
    return entityIcons[entityName] || entityIcons['default'];
}

/**
 * Initialise la carte Leaflet et ajoute les marqueurs pour les boycotts, les manifestations et les groupes Telegram.
 * @param {Array<Object>} boycotts - Les données des entités de boycottage.
 * @param {Array<Object>} manifestation_sites - Les données des sites de manifestation.
 * @param {Array<Object>} telegram_sites - Les données des groupes Telegram.
 */
function initMap(boycotts, manifestation_sites, telegram_sites) {
    // Si la carte est déjà initialisée, on supprime les couches existantes pour la rafraîchir
    if (mapInitialized) {
        map.eachLayer(layer => {
            if (layer instanceof L.Marker || layer instanceof L.TileLayer) {
                map.removeLayer(layer);
            }
        });
    }

    // Initialisation de la carte avec une vue centrée sur la France
    map = L.map('map').setView([46.603354, 1.888334], 6);
    mapInitialized = true;

    // Ajout de la couche de tuiles OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Stockage des données
    dataBoycotts = boycotts;
    dataManifestations = manifestation_sites;
    dataTelegramSites = telegram_sites;

    // Réinitialisation des couches de marqueurs
    markerLayers = {};
    const legendList = document.getElementById('legend-list');
    legendList.innerHTML = '';

    // --- Gestion des marqueurs de Boycottage ---
    if (dataBoycotts && dataBoycotts.length > 0) {
        dataBoycotts.forEach(entity => {
            const li = document.createElement('li');
            li.setAttribute('data-id', entity.id);
            const icon = getIconForEntity(entity.name);
            li.innerHTML = `<span class="legend-icon" style="background-image: url('${icon.options.iconUrl}')"></span>${entity.name}`;
            legendList.appendChild(li);

            if (entity.locations && entity.locations.length > 0) {
                const entityLayer = L.layerGroup();
                entity.locations.forEach(location => {
                    L.marker([location.lat, location.lon], { icon: icon })
                        .bindPopup(`<b>${entity.name}</b><br>${location.city || ''}`)
                        .addTo(entityLayer);
                });
                markerLayers[entity.id] = entityLayer;
            } else {
                markerLayers[entity.id] = L.layerGroup();
            }
        });
    }

    // --- Gestion des marqueurs Telegram ---
    if (dataTelegramSites && dataTelegramSites.length > 0) {
        const telegramLayer = L.layerGroup();
        dataTelegramSites.forEach(site => {
            const icon = getIconForEntity('telegram');
            L.marker([site.lat, site.lon], { icon: icon })
                .bindPopup(`<b>${site.name}</b><br>Département/Région : ${site.department}<br>Ville : ${site.city}<br><a href="${site.link}" target="_blank">Rejoindre</a>`)
                .addTo(telegramLayer);
        });
        markerLayers['telegram'] = telegramLayer;
    }

    // --- Ajout de l'élément de légende pour Telegram ---
    const liTelegram = document.createElement('li');
    liTelegram.setAttribute('data-id', 'telegram');
    liTelegram.innerHTML = `<span class="legend-icon" style="background-image: url('${getIconForEntity('telegram').options.iconUrl}')"></span>Groupes Telegram`;
    legendList.appendChild(liTelegram);




    // --- Configuration des écouteurs d'événements pour la légende ---
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
