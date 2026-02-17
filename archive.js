const track = document.querySelector(".horizontal-track");
const section = document.querySelector(".horizontal-section");

function updateScroll() {
  const scrollTop = window.scrollY;
  const sectionTop = section.offsetTop;
  const sectionHeight = section.offsetHeight;
  const viewportHeight = window.innerHeight;

  if (scrollTop >= sectionTop && scrollTop <= sectionTop + sectionHeight - viewportHeight) {
    const progress = (scrollTop - sectionTop) / (sectionHeight - viewportHeight);
    const maxMove = track.scrollWidth - window.innerWidth;
    track.style.transform = `translateX(-${progress * maxMove}px)`;
  }
}

window.addEventListener("scroll", updateScroll);
window.addEventListener("load", updateScroll);
window.addEventListener("resize", updateScroll);
