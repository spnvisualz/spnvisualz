const track = document.querySelector(".horizontal-track");
const section = document.querySelector(".horizontal-section");

if (!track || !section) return;

let current = 0;
let target = 0;
let ease = 0.08;

function smoothScroll(){
  current += (target - current) * ease;
  track.style.transform = `translate3d(-${current}px, 0, 0)`;
  requestAnimationFrame(smoothScroll);
}

function setSectionHeight(){
  if (window.innerWidth <= 900) return;

  const scrollWidth = track.scrollWidth;
  const extraScroll = scrollWidth - window.innerWidth;

  section.style.height = `${window.innerHeight + extraScroll}px`;
}

function updateScroll(){
  if (window.innerWidth <= 900) {
    track.style.transform = "none";
    return;
  }

  const scrollTop = window.scrollY;
  const sectionTop = section.offsetTop;
  const maxScroll = section.offsetHeight - window.innerHeight;

  if (scrollTop >= sectionTop && scrollTop <= sectionTop + maxScroll){
    const progress = (scrollTop - sectionTop) / maxScroll;
    const maxMove = track.scrollWidth - window.innerWidth;
    target = progress * maxMove;
  }
}

window.addEventListener("scroll", updateScroll);
window.addEventListener("resize", () => {
  setSectionHeight();
  updateScroll();
});
window.addEventListener("load", () => {
  setSectionHeight();
  updateScroll();
});

smoothScroll();

// Case study overlay logic moved into work.html
