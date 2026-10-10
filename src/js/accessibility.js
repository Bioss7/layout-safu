// Версия для слабовидящих 
document.addEventListener("DOMContentLoaded", function () {
    const versionBtn = document.querySelector('.js');

    if (versionBtn) {
        versionBtn.addEventListener('click', (e) => {
            e.preventDefault();

            console.log('versiona');
        });
    }
});