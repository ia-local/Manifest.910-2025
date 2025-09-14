export function initCvnuPage() {
    console.log("Initialisation de la page CVNU...");

    const inputArea = document.getElementById('cv-content-input');
    const generateBtn = document.getElementById('generate-cv-button');
    const outputArea = document.getElementById('cvnu-output-area');
    const renderHtmlBtn = document.getElementById('render-html-button');
    const copyHtmlBtn = document.getElementById('copy-html-button');

    let structuredCvData = null; // Stocke les données structurées du CV

    generateBtn.addEventListener('click', async () => {
        const cvContent = inputArea.value;
        if (cvContent.trim() === '') {
            alert("Veuillez coller le contenu de votre CV.");
            return;
        }

        outputArea.innerHTML = '<div class="loading-spinner"><p>Analyse en cours...</p></div>';
        renderHtmlBtn.style.display = 'none';
        copyHtmlBtn.style.display = 'none';

        try {
            const response = await fetch('/cvnu/api/cv/parse-and-structure', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cvContent })
            });

            if (!response.ok) {
                throw new Error('Erreur lors de la structuration du CV.');
            }

            structuredCvData = await response.json();
            outputArea.innerHTML = `<pre>${JSON.stringify(structuredCvData, null, 2)}</pre>`;
            renderHtmlBtn.style.display = 'block';

        } catch (error) {
            console.error('Erreur:', error);
            outputArea.innerHTML = `<div class="error-message"><p>Une erreur est survenue: ${error.message}</p></div>`;
        }
    });

    renderHtmlBtn.addEventListener('click', async () => {
        if (!structuredCvData) {
            alert("Veuillez d'abord générer un CV structuré.");
            return;
        }

        outputArea.innerHTML = '<div class="loading-spinner"><p>Rendu HTML en cours...</p></div>';

        try {
            const response = await fetch('/cvnu/api/cv/render-html', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cvData: structuredCvData })
            });

            if (!response.ok) {
                throw new Error('Erreur lors du rendu HTML.');
            }

            const htmlContent = await response.text();
            outputArea.innerHTML = htmlContent;
            copyHtmlBtn.style.display = 'block';

        } catch (error) {
            console.error('Erreur:', error);
            outputArea.innerHTML = `<div class="error-message"><p>Une erreur est survenue: ${error.message}</p></div>`;
        }
    });

    copyHtmlBtn.addEventListener('click', () => {
        const htmlContent = outputArea.innerHTML;
        navigator.clipboard.writeText(htmlContent).then(() => {
            alert('Contenu HTML copié dans le presse-papiers!');
        }).catch(err => {
            console.error('Erreur lors de la copie:', err);
            alert('Échec de la copie.');
        });
    });
}