// Fichier : public/src/js/blog.js
// Ce fichier gère l'affichage des articles de blog.

export async function initBlogPage() {
    const container = document.getElementById('blog-posts-container');
    const modal = document.getElementById('article-modal');
    const closeBtn = document.querySelector('.close-btn');

    // Vérifier si les éléments existent avant de continuer
    if (!container) {
        console.error("Le conteneur 'blog-posts-container' est introuvable.");
        return;
    }

    try {
        // Mettre à jour la bonne route API pour charger les articles
        const response = await fetch('/api/blog/posts');
        if (!response.ok) {
            throw new Error('Erreur de chargement des articles.');
        }
        const posts = await response.json();

        container.innerHTML = ''; // Efface le message de chargement

        if (posts.length === 0) {
            container.innerHTML = '<p>Aucun article n\'a encore été enregistré.</p>';
            return;
        }

        posts.forEach(post => {
            const card = document.createElement('article');
            card.className = 'blog-card';

            const title = document.createElement('h3');
            title.textContent = post.title;

            const image = document.createElement('img');
            image.alt = post.title;
            // Utiliser la propriété "media" renvoyée par l'API
            image.src = post.media;

            card.appendChild(title);
            card.appendChild(image);

            // Gérer l'ouverture de la modale au clic
            card.addEventListener('click', () => {
                const modalImage = document.getElementById('modal-image');
                const modalTitle = document.getElementById('modal-title');
                const modalContent = document.getElementById('modal-article-content');

                if (modalImage && modalTitle && modalContent && modal) {
                    modalImage.src = post.media;
                    modalTitle.textContent = post.title;
                    // Utiliser la propriété "article" renvoyée par l'API
                    modalContent.innerHTML = post.article;
                    modal.style.display = 'block';
                }
            });

            container.appendChild(card);
        });

    } catch (error) {
        console.error('Erreur :', error);
        container.innerHTML = `<p>Impossible de charger les articles : ${error.message}</p>`;
    }
    
    // Gérer la fermeture de la modale
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }
    
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
}
