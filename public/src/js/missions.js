// Fichier : public/src/js/missions.js

export async function initMissionsPage() {
    console.log("Initialisation de la page Missions...");
    const missionsGrid = document.querySelector('.mission-grid');
    const missionDetailsModal = document.getElementById('mission-details');
    const addMissionFormContainer = document.getElementById('add-mission-form-container');
    const showAddMissionBtn = document.getElementById('show-add-mission-btn');
    const addMissionForm = document.getElementById('add-mission-form');
    const generateMissionAiBtn = document.getElementById('generate-mission-ai-btn');

    if (!missionsGrid) {
        console.error("Le conteneur de missions est introuvable.");
        return;
    }

    const fetchMissions = async () => {
        missionsGrid.innerHTML = '<div class="loading-spinner"><p>Chargement des missions...</p></div>';
        try {
            const response = await fetch('/missions/api/missions'); // Updated API path
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
                    const mission = missions.find(m => m.id === missionId);
                    if (mission) {
                        document.getElementById('modal-mission-title').textContent = mission.title;
                        document.getElementById('modal-mission-description').textContent = mission.full_description;
                        document.getElementById('modal-mission-status').textContent = mission.status;
                        document.getElementById('modal-mission-rewards').textContent = mission.rewards;
                        missionDetailsModal.style.display = 'block';
                    }
                });
            });
        } catch (error) {
            console.error('Erreur lors de l\'initialisation de la page Missions:', error);
            missionsGrid.innerHTML = `<p>Impossible de charger les missions : ${error.message}</p>`;
        }
    };

    showAddMissionBtn.addEventListener('click', () => {
        addMissionFormContainer.style.display = 'block';
    });

    addMissionForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(addMissionForm);
        const newMission = Object.fromEntries(formData.entries());

        try {
            const response = await fetch('/missions/api/missions', { // Updated API path
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newMission)
            });

            if (!response.ok) {
                throw new Error('Erreur lors de l\'ajout de la mission.');
            }

            alert('Mission ajoutée avec succès!');
            addMissionFormContainer.style.display = 'none';
            addMissionForm.reset();
            fetchMissions(); // Refresh the list of missions
        } catch (error) {
            console.error('Erreur:', error);
            alert('Erreur lors de l\'ajout de la mission: ' + error.message);
        }
    });

    generateMissionAiBtn.addEventListener('click', async () => {
        const topic = document.getElementById('mission-title-input').value;
        if (!topic) {
            alert('Veuillez entrer un titre pour la mission.');
            return;
        }

        generateMissionAiBtn.textContent = 'Génération en cours...';
        generateMissionAiBtn.disabled = true;

        try {
            const response = await fetch('/missions/api/missions/generate', { // Updated API path
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic })
            });

            if (!response.ok) {
                throw new Error('Erreur de génération de la mission.');
            }

            const generatedMission = await response.json();
            document.getElementById('mission-title-input').value = generatedMission.title;
            document.getElementById('mission-description-input').value = generatedMission.description;
            document.getElementById('mission-full-description-input').value = generatedMission.full_description;
        } catch (error) {
            console.error('Erreur lors de la génération avec l\'IA:', error);
            alert('Échec de la génération avec l\'IA.');
        } finally {
            generateMissionAiBtn.textContent = 'Générer avec l\'IA';
            generateMissionAiBtn.disabled = false;
        }
    });
    
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

    fetchMissions();
}