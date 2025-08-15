// Fichier : public/src/js/map.js

let map;
let markerLayers = {};
let dataBoycotts, dataManifestations;
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
    'default': L.icon({
        iconUrl: 'src/assets/icons/boycott-icon.png',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    })
};

function getIconForEntity(entityName) {
    return entityIcons[entityName] || entityIcons['default'];
}

function initMap(boycotts, manifestations) {
    if (mapInitialized) {
        map.eachLayer(layer => {
            if (layer instanceof L.Marker || layer instanceof L.TileLayer) {
                map.removeLayer(layer);
            }
        });
    }

    map = L.map('map').setView([46.603354, 1.888334], 6);
    mapInitialized = true;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    dataBoycotts = boycotts;
    dataManifestations = manifestations;

    markerLayers = {};

    const legendList = document.getElementById('legend-list');
    legendList.innerHTML = '';
    
    // Gérer les couches de marqueurs de boycottage (initialement cachées)
    dataBoycotts.forEach(entity => {
        // Crée toujours un élément de légende pour chaque entité
        const li = document.createElement('li');
        li.setAttribute('data-id', entity.id);
        const icon = getIconForEntity(entity.name);
        li.innerHTML = `<span class="legend-icon" style="background-image: url('${icon.options.iconUrl}')"></span>${entity.name}`;
        legendList.appendChild(li);

        // Crée la couche de marqueurs uniquement si des emplacements existent
        if (entity.locations && entity.locations.length > 0) {
            const entityLayer = L.layerGroup();
            entity.locations.forEach(location => {
                L.marker([location.lat, location.lon], { icon: icon })
                    .bindPopup(`<b>${entity.name}</b><br>${location.city || ''}`)
                    .addTo(entityLayer);
            });
            markerLayers[entity.id] = entityLayer;
        } else {
            // Créer une couche vide pour les entités sans emplacement, pour que l'événement de clic fonctionne sans erreur
            markerLayers[entity.id] = L.layerGroup();
        }
    });

    // Créer une liste de tous les types de manifestations uniques
    const manifestationTypes = [...new Set(dataManifestations.map(item => item.type))];

    // Gérer les couches des lieux de manifestation par type
    manifestationTypes.forEach(type => {
        const typeLayer = L.layerGroup();
        dataManifestations.filter(site => site.type === type).forEach(site => {
            const icon = getIconForEntity(type);
            L.marker([site.lat, site.lon], { icon: icon })
                .bindPopup(`<b>${site.type} de ${site.city}</b><br>Département : ${site.department}`)
                .addTo(typeLayer);
        });
        markerLayers[type] = typeLayer;

        const li = document.createElement('li');
        li.setAttribute('data-id', type);
        li.innerHTML = `<span class="legend-icon" style="background-image: url('${getIconForEntity(type).options.iconUrl}')"></span>${type}`;
        legendList.appendChild(li);
    });

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