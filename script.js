(() => {
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  window.scrollTo(0, 0);

  const cards = Array.from(document.querySelectorAll("[data-card]"));

  const closeAll = (except) => {
    cards.forEach((card) => {
      if (except && card === except) return;
      card.classList.remove("is-open");
      const btn = card.querySelector(".card-btn");
      const details = card.querySelector(".details");
      if (btn) btn.setAttribute("aria-expanded", "false");
      if (details) details.setAttribute("aria-hidden", "true");
    });
  };

  cards.forEach((card) => {
    const btn = card.querySelector(".card-btn");
    const details = card.querySelector(".details");
    if (!btn || !details) return;

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const isOpen = card.classList.contains("is-open");
      closeAll(card);
      card.classList.toggle("is-open", !isOpen);
      btn.setAttribute("aria-expanded", String(!isOpen));
      details.setAttribute("aria-hidden", String(isOpen));
    });
  });

  document.addEventListener("click", (e) => {
    const el = e.target;
    if (!(el instanceof Element)) return;
    if (!el.closest("[data-card]")) closeAll(null);
  });
})();

/* NAV SCROLL EFFECT */
const nav = document.querySelector(".nav");

window.addEventListener("scroll", () => {
  if(window.scrollY > 40){
    nav.classList.add("scrolled");
  } else {
    nav.classList.remove("scrolled");
  }
});

/* ACTIVE LINK AUTO-DETECT */
const links = document.querySelectorAll(".nav-links a");
const currentPath = window.location.pathname;

links.forEach(link => {
  if(currentPath.includes(link.getAttribute("href"))){
    link.classList.add("active");
  }
});
/* =============================
   INTRO VIDEO — STABLE VERSION
============================= */

document.addEventListener("DOMContentLoaded", () => {

  const intro = document.getElementById("intro");
  const video = document.getElementById("introVideo");

  if (!intro || !video) return;

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  // iOS must be muted BEFORE autoplay attempt
  if (isMobile) {
    video.setAttribute("muted", "true");
    video.muted = true;
  }

  let faded = false;

  const fadeOut = () => {
    if (faded) return;
    faded = true;

    intro.classList.add("fade-out");

    setTimeout(() => {
      intro.remove();
    }, 1000);
  };

  // Wait until video is ready before playing
  video.addEventListener("canplay", () => {
    video.play().catch(() => {});
  });

  // Fade exactly when finished
  video.addEventListener("ended", fadeOut);

  // Safety fallback (7 seconds)
  setTimeout(fadeOut, 7000);

});
  // Inject Packages and Cart links into nav on index page
  const navLinksContainer = document.querySelector('.nav-links');
  if (navLinksContainer) {
    if (!document.querySelector('.nav-links a[href="shop.html"]')) {
      const shopLink = document.createElement('a');
      shopLink.href = 'shop.html';
      shopLink.textContent = 'Packages';
      navLinksContainer.appendChild(shopLink);

      const cartLink = document.createElement('a');
      cartLink.href = 'cart.html';
      cartLink.innerHTML = 'Cart <span id="cart-count">0</span>';
      navLinksContainer.appendChild(cartLink);
    }
    const cartCountSpan = document.getElementById('cart-count');
    if (cartCountSpan) {
      const cart = JSON.parse(localStorage.getItem('cart') || '[]');
      const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
      cartCountSpan.textContent = totalItems;
    }
  }

