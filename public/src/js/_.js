// Fichier : public/src/js/map.js
// Ce fichier gère l'initialisation et l'affichage de la carte Leaflet.

let map;
let markerLayers = {}; // Utilise un objet pour stocker les couches de marqueurs
let mapInitialized = false;

// Définition des icônes personnalisées
const manifestationIcon = L.icon({
    iconUrl: 'src/assets/icons/manifestation-icon.png',
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
    return manifestationIcon;
}

/**
 * Initialise la carte Leaflet et ajoute les marqueurs.
 * @param {Array} dataBoycotts - Données des entreprises à boycotter.
 * @param {Array} dataPrefectures - Données des préfectures.
 * @param {Array} dataTelegramGroups - Données des groupes Telegram.
 */
function initMap(dataBoycotts, dataPrefectures, dataTelegramGroups) {
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

        // Création de l'élément de légende pour chaque entité de boycott
        const li = document.createElement('li');
        li.setAttribute('data-id', name);
        li.innerHTML = `<span class="legend-icon" style="background-image: url('${getIconForEntity(name).options.iconUrl}')"></span>${name}`;
        legendList.appendChild(li);
    });

    // Création de la couche pour les préfectures
    markerLayers['Prefecture'] = L.layerGroup();
    dataPrefectures.forEach(prefecture => {
        L.marker([prefecture.lat, prefecture.lon], { icon: prefectureIcon })
            .bindPopup(`<b>${prefecture.city}</b><br>Département : ${prefecture.department}`)
            .addTo(markerLayers['Prefecture']);
    });

    // Création de l'élément de légende pour les préfectures
    const liPrefecture = document.createElement('li');
    liPrefecture.setAttribute('data-id', 'Prefecture');
    liPrefecture.innerHTML = `<span class="legend-icon" style="background-image: url('${prefectureIcon.options.iconUrl}')"></span>Préfectures`;
    legendList.appendChild(liPrefecture);


    // Création de la couche pour les groupes Telegram
    markerLayers['Telegram'] = L.layerGroup();
    dataTelegramGroups.forEach(site => {
        L.marker([site.lat, site.lon], { icon: telegramIcon })
            .bindPopup(`<b>${site.name}</b><br>Département/Région : ${site.department}<br>Ville : ${site.city}<br><a href="${site.link}" target="_blank">Rejoindre</a>`)
            .addTo(markerLayers['Telegram']);
    });

    // Création de l'élément de légende pour les groupes Telegram
    const liTelegram = document.createElement('li');
    liTelegram.setAttribute('data-id', 'Telegram');
    liTelegram.innerHTML = `<span class="legend-icon" style="background-image: url('${telegramIcon.options.iconUrl}')"></span>Groupes Telegram`;
    legendList.appendChild(liTelegram);

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