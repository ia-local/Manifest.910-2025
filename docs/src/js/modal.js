// Fichier : public/src/js/modal.js

function showModal(content) {
    const modalContainer = document.getElementById('modal-container');
    const modalBody = document.getElementById('modal-body');
    if (modalContainer && modalBody) {
        modalBody.innerHTML = content;
        modalContainer.classList.remove('hidden');
    }
}

function closeModal() {
    const modalContainer = document.getElementById('modal-container');
    if (modalContainer) {
        modalContainer.classList.add('hidden');
    }
}