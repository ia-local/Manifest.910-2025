document.addEventListener('DOMContentLoaded', () => {

    const menuLinks = document.querySelectorAll('.left-menu nav ul li a');
    const contentSections = document.querySelectorAll('.main-container .content-section');

    // Algorithme de pagination pour cacher/afficher les sections
    const showSection = (sectionId) => {
        contentSections.forEach(section => {
            if (section.id === sectionId) {
                section.classList.remove('hidden');
            } else {
                section.classList.add('hidden');
            }
        });
        menuLinks.forEach(link => {
            if (link.dataset.section === sectionId) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    };

    menuLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionId = e.target.dataset.section;
            showSection(sectionId);
            
            // Appeler la fonction de chargement de données appropriée
            switch(sectionId) {
                case 'dashboard':
                    loadDashboardData();
                    break;
                case 'financial-flows':
                    loadFinancialFlowsData();
                    break;
                case 'affaires':
                    loadAffairesData();
                    break;
                case 'petitions':
                    loadPetitionsData();
                    break;
                case 'entities':
                    loadEntitiesData();
                    break;
                case 'taxes':
                    loadTaxesData();
                    break;
                case 'boycotts':
                    loadBoycottsData();
                    break;
            }
        });
    });

    // Fonctions de chargement des données depuis l'API
    async function fetchData(endpoint) {
        try {
            const response = await fetch(`/api/${endpoint}`);
            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`Erreur lors de la récupération des données de ${endpoint}:`, error);
            return null;
        }
    }

    async function loadDashboardData() {
        const data = await fetchData('dashboard/summary');
        const contentDiv = document.getElementById('dashboard-content');
        if (data) {
            contentDiv.innerHTML = `
                <p>Transactions totales : ${data.totalTransactions}</p>
                <p>Alertes actives : ${data.activeAlerts}</p>
                <p>Entités à risque : ${data.riskyEntities}</p>
            `;
        } else {
            contentDiv.innerHTML = '<p>Impossible de charger les données du tableau de bord.</p>';
        }
    }

    async function loadFinancialFlowsData() {
        const data = await fetchData('financial-flows');
        const contentDiv = document.getElementById('financial-flows-content');
        if (data) {
            contentDiv.innerHTML = '<h3>Liste des flux financiers</h3>' + JSON.stringify(data, null, 2);
        } else {
            contentDiv.innerHTML = '<p>Impossible de charger les flux financiers.</p>';
        }
    }
    
    // Ajoutez des fonctions similaires pour les autres sections (affaires, petitions, etc.)
    async function loadAffairesData() {
        const data = await fetchData('affaires');
        const contentDiv = document.getElementById('affaires-content');
        if (data) {
            contentDiv.innerHTML = '<h3>Chronologie des affaires</h3>' + JSON.stringify(data, null, 2);
        } else {
            contentDiv.innerHTML = '<p>Impossible de charger les données des affaires.</p>';
        }
    }
    
    async function loadPetitionsData() {
        const data = await fetchData('petitions');
        const contentDiv = document.getElementById('petitions-content');
        if (data) {
            contentDiv.innerHTML = '<h3>Liste des pétitions</h3>' + JSON.stringify(data, null, 2);
        } else {
            contentDiv.innerHTML = '<p>Impossible de charger les pétitions.</p>';
        }
    }

    async function loadEntitiesData() {
        const data = await fetchData('entities');
        const contentDiv = document.getElementById('entities-content');
        if (data) {
            contentDiv.innerHTML = '<h3>Liste des entités</h3>' + JSON.stringify(data, null, 2);
        } else {
            contentDiv.innerHTML = '<p>Impossible de charger les entités.</p>';
        }
    }

    async function loadTaxesData() {
        const data = await fetchData('taxes');
        const contentDiv = document.getElementById('taxes-content');
        if (data) {
            contentDiv.innerHTML = '<h3>Règles de taxes et caisse</h3>' + JSON.stringify(data, null, 2);
        } else {
            contentDiv.innerHTML = '<p>Impossible de charger les données des taxes.</p>';
        }
    }

    async function loadBoycottsData() {
        const data = await fetchData('boycotts');
        const contentDiv = document.getElementById('boycotts-content');
        if (data) {
            contentDiv.innerHTML = '<h3>Liste des boycotts</h3>' + JSON.stringify(data, null, 2);
        } else {
            contentDiv.innerHTML = '<p>Impossible de charger les boycotts.</p>';
        }
    }

    // Affiche la section du tableau de bord par défaut au chargement
    showSection('dashboard');
    loadDashboardData();
});