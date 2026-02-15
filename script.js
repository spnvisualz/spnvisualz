function toggleCard(card) {

    const allCards = document.querySelectorAll('.card');

    allCards.forEach(c => {
        if (c !== card) {
            c.classList.remove('active');
        }
    });

    card.classList.toggle('active');
}
