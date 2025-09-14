// Fichier : public/src/js/dashboard.js

/**
 * Initialise le tableau de bord en récupérant les données et en mettant à jour le DOM.
 */
export async function initDashboard() {
    console.log("Initialisation du tableau de bord...");
    
    // Définition de la date cible pour le compte à rebours
    const targetDate = new Date('2025-09-10T00:00:00');
    const countdownElement = document.getElementById('dashboard-countdown');
    
    if (countdownElement) {
        setInterval(() => {
            const now = new Date();
            const diff = targetDate - now;
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);
            
            countdownElement.textContent = `J-${days} H-${hours} M-${minutes} S-${seconds}`;
        }, 1000);
    }
    
    try {
        const response = await fetch('/api/dashboard/summary');
        if (!response.ok) throw new Error('Erreur de chargement des données du tableau de bord.');
        const data = await response.json();
        
        document.getElementById('caisse-solde').textContent = `Solde : ${data.caisseSolde} €`;
        document.getElementById('boycott-count').textContent = `${data.boycottCount} enseignes listées`;
        document.getElementById('ric-count').textContent = `${data.ricCount} propositions actives`;
        document.getElementById('beneficiary-count').textContent = `${data.beneficiaryCount}`;
        document.getElementById('monthly-allocation').textContent = `${data.monthlyAllocation.toFixed(2)} €`;
        
        document.getElementById('prefecture-count').textContent = `${data.prefectureCount} préfectures suivies`;
        document.getElementById('telegram-group-count').textContent = `${data.telegramGroupCount} groupes de mobilisation`;
        document.getElementById('manifestant-count').textContent = `${data.estimatedManifestantCount} manifestants estimés`;

        // Mise à jour des nouvelles cartes
        document.getElementById('mairies-count').textContent = `${data.mairiesCount} mairies répertoriées`;
        document.getElementById('roundabout-count').textContent = `${data.roundaboutCount} ronds-points`;
        document.getElementById('university-count').textContent = `${data.universityCount} universités`;
        document.getElementById('carrefour-count').textContent = `${data.carrefourCount} points Carrefour`;
        document.getElementById('bank-count').textContent = `${data.bankCount} points de banque`;
        // Ajout de l'affichage de la nouvelle statistique
        document.getElementById('tva-commerce-count').textContent = `${data.tvaCommerceCount} commerces assujettis à la TVA`;


        await displayEntityLists();

    } catch (error) {
        console.error('Erreur lors de l\'initialisation du tableau de bord:', error);
    }
}

/**
 * Affiche la liste des préfectures et des groupes Telegram.
 */
async function displayEntityLists() {
    try {
        const prefecturesResponse = await fetch('/api/prefectures');
        if (!prefecturesResponse.ok) throw new Error('Erreur de chargement des préfectures.');
        const prefecturesData = await prefecturesResponse.json();

        const telegramResponse = await fetch('/api/telegram-sites');
        if (!telegramResponse.ok) throw new Error('Erreur de chargement des groupes Telegram.');
        const telegramData = await telegramResponse.json();

        const prefecturesList = document.getElementById('prefectures-list');
        const telegramList = document.getElementById('telegram-list');

        if (prefecturesList) {
            prefecturesList.innerHTML = prefecturesData.map(p => `<li>${p.city} (${p.department})</li>`).join('');
        }
        if (telegramList) {
            telegramList.innerHTML = telegramData.map(g => `<li><a href="${g.link}" target="_blank">${g.name} - ${g.city}</a></li>`).join('');
        }
    } catch (error) {
        console.error('Erreur lors de l\'affichage des listes:', error);
    }
}