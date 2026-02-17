const track = document.querySelector(".horizontal-track");
const section = document.querySelector(".horizontal-section");

let current = 0;
let target = 0;
let ease = 0.08;
let isDesktop = window.innerWidth >= 900;

function smoothScroll(){
  if(isDesktop){
    current += (target - current) * ease;
    track.style.transform = `translateX(-${current}px)`;
  }
  requestAnimationFrame(smoothScroll);
}

function updateScroll(){
  if(!isDesktop) return;

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

window.addEventListener("resize", () => {
  isDesktop = window.innerWidth >= 900;

  if(!isDesktop){
    track.style.transform = "none";
    current = 0;
    target = 0;
  }
});

window.addEventListener("scroll", updateScroll);
window.addEventListener("load", () => {
  isDesktop = window.innerWidth >= 900;
  updateScroll();
});

smoothScroll();
