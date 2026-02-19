const track = document.querySelector(".horizontal-track");
const section = document.querySelector(".horizontal-section");

if (!track || !section) return;

let current = 0;
let target = 0;
let ease = 0.08;

function smoothScroll(){
  current += (target - current) * ease;
  track.style.transform = `translateX(-${current}px)`;
  requestAnimationFrame(smoothScroll);
}

function updateScroll(){
  if (window.innerWidth <= 900) {
    track.style.transform = "none";
    return;
  }

  const scrollTop = window.scrollY;
  const sectionTop = section.offsetTop;
  const sectionHeight = section.offsetHeight;
  const viewportHeight = window.innerHeight;

  if(scrollTop >= sectionTop && scrollTop <= sectionTop + sectionHeight - viewportHeight){
    const progress = (scrollTop - sectionTop) / (sectionHeight - viewportHeight);
    const maxMove = track.scrollWidth - window.innerWidth;
    target = progress * maxMove;
  }
}

window.addEventListener("scroll", updateScroll);
window.addEventListener("resize", updateScroll);
window.addEventListener("load", updateScroll);

smoothScroll();
