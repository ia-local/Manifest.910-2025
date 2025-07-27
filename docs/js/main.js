// public/js/main.js

const API_BASE_URL = 'http://localhost:5007/api'; // Assurez-vous que c'est le bon port

/**
 * Fonction générique pour récupérer des données depuis l'API.
 * @param {string} url L'URL de l'endpoint API.
 * @returns {Promise<Object>} Les données JSON.
 */
async function fetchData(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Erreur lors de la récupération des données:', error);
        return null; // Retourne null en cas d'erreur pour une gestion facile
    }
}

/**
 * Fonction générique pour poster des données vers l'API.
 * @param {string} url L'URL de l'endpoint API.
 * @param {Object} data Les données à envoyer (objet JS).
 * @returns {Promise<Object>} La réponse JSON du serveur.
 */
async function postData(url, data) {
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Erreur lors de l\'envoi des données:', error);
        return null;
    }
}

// --- Fonctions spécifiques pour chaque page ---

async function loadRicPage() {
    const petitionDetailsDiv = document.getElementById('petition-details');
    const ricPetitionForm = document.getElementById('ric-petition-form');
    const messageDiv = document.getElementById('message');

    if (!petitionDetailsDiv || !ricPetitionForm) return;

    try {
        // Supposons qu'il y a une pétition spécifique pour le RIC avec un ID connu ou la première
        const petitions = await fetchData(`${API_BASE_URL}/petitions`);
        if (!petitions || petitions.length === 0) {
            petitionDetailsDiv.innerHTML = '<p>Aucune pétition pour le RIC disponible pour le moment.</p>';
            return;
        }

        // Utilisons la première pétition trouvée ou une pétition avec un titre spécifique pour le RIC
        const ricPetition = petitions.find(p => p.title.includes('RIC')) || petitions[0];

        if (ricPetition) {
            petitionDetailsDiv.innerHTML = `
                <h3>${ricPetition.title}</h3>
                <p>${ricPetition.description}</p>
                <p><strong>Signatures actuelles :</strong> <span id="signature-count">${ricPetition.signatures}</span></p>
                <h4>Commentaires :</h4>
                <ul id="comments-list">
                    ${ricPetition.comments.map(c => `<li>(${new Date(c.timestamp).toLocaleDateString()}) ${c.comment}</li>`).join('') || '<li>Aucun commentaire pour le moment.</li>'}
                </ul>
            `;

            ricPetitionForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                messageDiv.innerHTML = '';
                messageDiv.className = 'message';

                const comment = document.getElementById('comment').value;
                const voteData = {
                    petitionId: ricPetition.id,
                    comment: comment
                };

                const result = await postData(`${API_BASE_URL}/petition/vote`, voteData);

                if (result) {
                    messageDiv.classList.add('success');
                    messageDiv.textContent = 'Votre soutien a bien été enregistré !';
                    // Mettre à jour le nombre de signatures dynamiquement
                    const updatedPetition = await fetchData(`${API_BASE_URL}/petition/results/${ricPetition.id}`);
                    if (updatedPetition) {
                        document.getElementById('signature-count').textContent = updatedPetition.signatures;
                        const commentsList = document.getElementById('comments-list');
                        commentsList.innerHTML = updatedPetition.comments.map(c => `<li>(${new Date(c.timestamp).toLocaleDateString()}) ${c.comment}</li>`).join('') || '<li>Aucun commentaire pour le moment.</li>';
                    }
                    ricPetitionForm.reset();
                } else {
                    messageDiv.classList.add('error');
                    messageDiv.textContent = 'Erreur lors de l\'enregistrement de votre soutien. Veuillez réessayer.';
                }
            });
        } else {
            petitionDetailsDiv.innerHTML = '<p>Pétition pour le RIC non trouvée.</p>';
        }

    } catch (error) {
        console.error('Erreur lors du chargement de la page RIC:', error);
        petitionDetailsDiv.innerHTML = '<p class="error">Impossible de charger les détails de la pétition pour le moment.</p>';
    }
}

async function loadDestitutionPage() {
    const article68ContentDiv = document.getElementById('article68-content');
    const affairesList = document.getElementById('affaires-list');
    const defaillancesList = document.getElementById('defaillances-list');
    const reportsChroniclesList = document.getElementById('reports-chronicles-list');
    const chronologicalEventsList = document.getElementById('chronological-events-list');
    const destitutionVoteForm = document.getElementById('destitution-vote-form');
    const destitutionMessageDiv = document.getElementById('destitution-message');

    if (!article68ContentDiv || !affairesList || !defaillancesList || !reportsChroniclesList || !chronologicalEventsList || !destitutionVoteForm) return;

    // Charger l'Article 68
    const article68 = await fetchData(`${API_BASE_URL}/constitution/68`);
    if (article68) {
        article68ContentDiv.innerHTML = `
            <h3>${article68.title || 'Article 68'}</h3>
            <p><strong>Référence :</strong> ${article68.ref || 'N/A'}</p>
            <p>${article68.definition || 'Définition non disponible.'}</p>
            <p><strong>Commentaire :</strong> ${article68.comment || 'Aucun commentaire.'}</p>
            ${article68.extraInfo ? `<p><em>Informations complémentaires :</em> ${article68.extraInfo}</p>` : ''}
        `;
    } else {
        article68ContentDiv.innerHTML = '<p class="error">Impossible de charger l\'Article 68 pour le moment.</p>';
    }

    // Charger et afficher les affaires
    const affairesData = await fetchData(`${API_BASE_URL}/affaires`);
    if (affairesData && affairesData.affaires && affairesData.affaires.length > 0) {
        affairesList.innerHTML = affairesData.affaires.map(affaire => `
            <li>
                <strong>${affaire.title}</strong><br>
                ${affaire.description.substring(0, 100)}... <a href="#">Voir détails</a>
            </li>
        `).join('');
    } else {
        affairesList.innerHTML = '<li>Aucune affaire documentée pour le moment.</li>';
    }

    // Charger et afficher les défaillances (simplifié pour un affichage général)
    const defaillancesData = await fetchData(`${API_BASE_URL}/defaillances`);
    if (defaillancesData) {
        let htmlContent = '';
        for (const sector in defaillancesData) {
            htmlContent += `<li><strong>${defaillancesData[sector].titre}</strong>: ${defaillancesData[sector].details[0] || 'Pas de détails.'}...</li>`;
        }
        defaillancesList.innerHTML = htmlContent || '<li>Aucune défaillance documentée pour le moment.</li>';
    } else {
        defaillancesList.innerHTML = '<li>Impossible de charger les défaillances.</li>';
    }

    // Charger et afficher les rapports/chroniques
    const journalistArticles = await fetchData(`${API_BASE_URL}/journalist/articles`);
    const investigatorReports = await fetchData(`${API_BASE_URL}/investigator/reports`);
    const whistleblowerChronicles = await fetchData(`${API_BASE_URL}/whistleblower/chronicles`);

    let combinedReports = [];
    if (journalistArticles) combinedReports = combinedReports.concat(journalistArticles.map(a => ({ title: a.title, type: 'Article Journaliste', id: a.id })));
    if (investigatorReports) combinedReports = combinedReports.concat(investigatorReports.map(r => ({ title: r.title, type: 'Rapport Enquêteur', id: r.id })));
    if (whistleblowerChronicles) combinedReports = combinedReports.concat(whistleblowerChronicles.map(c => ({ title: c.title, type: 'Chronique Lanceur d\'alerte', id: c.id })));

    if (combinedReports.length > 0) {
        reportsChroniclesList.innerHTML = combinedReports.map(item => `
            <li><strong>${item.title}</strong> (${item.type}) <a href="#">Voir détails</a></li>
        `).join('');
    } else {
        reportsChroniclesList.innerHTML = '<li>Aucun rapport ou chronique disponible.</li>';
    }

    // Charger et afficher les événements chronologiques
    const chronologicalEvents = await fetchData(`${API_BASE_URL}/events/chronological`);
    if (chronologicalEvents && chronologicalEvents.length > 0) {
        chronologicalEventsList.innerHTML = chronologicalEvents.map(event => `
            <li><strong>${event.title}</strong> (${event.date}) : ${event.description.substring(0, 100)}...</li>
        `).join('');
    } else {
        chronologicalEventsList.innerHTML = '<li>Aucun événement chronologique majeur documenté.</li>';
    }

    // Gérer le formulaire de vote par Jugement Majoritaire pour la destitution
    destitutionVoteForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        destitutionMessageDiv.innerHTML = '';
        destitutionMessageDiv.className = 'message';

        const selectedMention = document.querySelector('input[name="mention"]:checked');
        const comment = document.getElementById('destitution-comment').value;

        if (!selectedMention) {
            destitutionMessageDiv.classList.add('error');
            destitutionMessageDiv.textContent = 'Veuillez sélectionner une mention pour voter.';
            return;
        }

        // Pour la destitution, nous allons "voter" sur une pétition spécifique ou créer une entrée générique
        // Ici, nous simulons l'ajout à la pétition RIC ou une pétition "destitution" si elle existe.
        // En production, il faudrait avoir une pétition ID dédiée à la destitution.
        const petitions = await fetchData(`${API_BASE_URL}/petitions`);
        const destitutionPetition = petitions.find(p => p.title.includes('Destitution')) || petitions[0]; // Ou un ID fixe

        if (!destitutionPetition) {
            destitutionMessageDiv.classList.add('error');
            destitutionMessageDiv.textContent = 'Pétition de destitution non trouvée pour l\'enregistrement du vote.';
            return;
        }

        const voteData = {
            petitionId: destitutionPetition.id, // ID de la pétition pour la destitution
            comment: `Mention: ${selectedMention.value}. ${comment}`, // Intégrer la mention dans le commentaire
            // Vous pourriez ajouter un champ 'mention' au schéma PetitionVote dans Swagger si nécessaire
            // mention: selectedMention.value
        };

        const result = await postData(`${API_BASE_URL}/petition/vote`, voteData);

        if (result) {
            destitutionMessageDiv.classList.add('success');
            destitutionMessageDiv.textContent = `Votre jugement "${selectedMention.value}" a été enregistré avec succès !`;
            destitutionVoteForm.reset();
            // Idéalement, ici, vous mettriez à jour l'affichage des résultats du jugement majoritaire
        } else {
            destitutionMessageDiv.classList.add('error');
            destitutionMessageDiv.textContent = 'Erreur lors de l\'enregistrement de votre jugement. Veuillez réessayer.';
        }
    });
}

// La page jugement-majoritaire.html est principalement informative et n'a pas besoin de JS dynamique complexe.
// La page composition-penale.html est également principalement informative.

// --- Routeur de page simplifié ---
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;

    if (path.includes('ric.html')) {
        loadRicPage();
    } else if (path.includes('destitution-article68.html')) {
        loadDestitutionPage();
    }
    // Pas de fonctions de chargement spécifiques requises pour jugement-majoritaire.html et composition-penale.html
    // car leur contenu est majoritairement statique ou des simulations clients.
});