// Fichier : public/src/js/missions.js
// Ce fichier gère l'affichage et l'interaction de la page "Missions".

// La fonction d'initialisation de la page Missions est exportée
export async function initMissionsPage() {
    console.log("Initialisation de la page Missions...");
    const missionsGrid = document.querySelector('.mission-grid');
    const missionDetailsModal = document.getElementById('mission-details');

    if (!missionsGrid) {
        console.error("Le conteneur de missions est introuvable.");
        return;
    }

    try {
        const response = await fetch('/api/missions');
        if (!response.ok) {
            throw new Error(`Erreur de chargement des missions : ${response.statusText}`);
        }
        const missions = await response.json();
        
        missionsGrid.innerHTML = '';
        if (missions.length === 0) {
            missionsGrid.innerHTML = '<p>Aucune mission disponible pour le moment.</p>';
            return;
        }
        
        missions.forEach(mission => {
            const card = document.createElement('div');
            card.className = 'card mission-card';
            card.innerHTML = `
                <h3>${mission.title}</h3>
                <p>${mission.description}</p>
                <p><strong>Statut :</strong> ${mission.status}</p>
                <button class="details-button" data-mission-id="${mission.id}">Détails</button>
            `;
            missionsGrid.appendChild(card);
        });

        document.querySelectorAll('.details-button').forEach(button => {
            button.addEventListener('click', (event) => {
                const missionId = event.target.dataset.missionId;
                showMissionDetails(missionId);
            });
        });
    } catch (error) {
        console.error('Erreur lors de l\'initialisation de la page Missions:', error);
        missionsGrid.innerHTML = `<p>Impossible de charger les missions : ${error.message}</p>`;
    }
    
    if (missionDetailsModal) {
        const closeBtn = missionDetailsModal.querySelector('.close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                missionDetailsModal.style.display = 'none';
            });
        }
        window.addEventListener('click', (event) => {
            if (event.target === missionDetailsModal) {
                missionDetailsModal.style.display = 'none';
            }
        });
    }
}

function showMissionDetails(missionId) {
    const missionDetailsModal = document.getElementById('mission-details');
    // Simulation des données pour la modale
    const missions = [
        { id: '1', title: 'Collecte de données sur le terrain', description: 'Description complète de la mission A.', status: 'En cours' },
        { id: '2', title: 'Analyse des articles de loi', description: 'Description complète de la mission B.', status: 'Terminée' }
    ];
    const mission = missions.find(m => m.id === missionId);

    if (mission) {
        document.getElementById('mission-title').textContent = mission.title;
        document.getElementById('mission-description').textContent = mission.description;
        document.getElementById('mission-status').textContent = `Statut : ${mission.status}`;
        missionDetailsModal.style.display = 'block';
    }
}