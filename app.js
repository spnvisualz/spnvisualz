(() => {
  const $ = (selector, context = document) => context.querySelector(selector);
  const $$ = (selector, context = document) => [...context.querySelectorAll(selector)];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  addEventListener('DOMContentLoaded', () => {
    requestAnimationFrame(() => document.body.classList.remove('is-loading'));
    const year = $('#year');
    if (year) year.textContent = new Date().getFullYear();
  });

  const header = $('#siteHeader');
  const progress = $('#pageProgress');
  let latestScroll = 0;
  let ticking = false;

  const renderScroll = () => {
    const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    const pageP = latestScroll / max;
    if (progress) progress.style.width = `${Math.min(100, pageP * 100)}%`;
    header?.classList.toggle('is-scrolled', latestScroll > 24);

    if (!reduceMotion) {
      const object = $('#heroObject');
      if (object && latestScroll < innerHeight * 1.25) {
        const p = Math.min(1, latestScroll / innerHeight);
        object.style.setProperty('--scrollY', `${p * 70}px`);
        object.style.setProperty('--heroScale', `${1 - p * .12}`);
      }
    }
    updateWork();
    ticking = false;
  };

  addEventListener('scroll', () => {
    latestScroll = scrollY;
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(renderScroll);
    }
  }, { passive: true });

  if (!reduceMotion && matchMedia('(pointer:fine)').matches) {
    const object = $('#heroObject');
    addEventListener('pointermove', (event) => {
      if (!object || scrollY > innerHeight) return;
      const x = event.clientX / innerWidth - .5;
      const y = event.clientY / innerHeight - .5;
      object.style.setProperty('--ry', `${x * 6}deg`);
      object.style.setProperty('--rx', `${-y * 5}deg`);
    }, { passive: true });

    $$('[data-tilt]').forEach(card => {
      card.addEventListener('pointermove', event => {
        const bounds = card.getBoundingClientRect();
        const x = (event.clientX - bounds.left) / bounds.width - .5;
        const y = (event.clientY - bounds.top) / bounds.height - .5;
        card.style.transform = `rotateX(${-y * 4}deg) rotateY(${x * 5}deg) translateY(-3px)`;
      });
      card.addEventListener('pointerleave', () => {
        card.style.transform = '';
      });
    });
  }

  const menuToggle = $('#menuToggle');
  const mobileMenu = $('#mobileMenu');
  const setMenu = (open) => {
    if (!menuToggle || !mobileMenu) return;
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.querySelector('span').textContent = open ? 'Close' : 'Menu';
    mobileMenu.classList.toggle('is-open', open);
    mobileMenu.setAttribute('aria-hidden', String(!open));
    document.body.classList.toggle('menu-open', open);
  };
  menuToggle?.addEventListener('click', () => setMenu(menuToggle.getAttribute('aria-expanded') !== 'true'));
  $$('[data-menu-link]').forEach(link => link.addEventListener('click', () => setMenu(false)));

  document.addEventListener('click', (event) => {
    const anchor = event.target.closest('a[href^="#"]');
    if (!anchor) return;
    const id = anchor.getAttribute('href');
    const target = id && id !== '#' ? $(id) : null;
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  });

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: .12, rootMargin: '0px 0px -6% 0px' });
  $$('.reveal').forEach((element, index) => {
    element.style.transitionDelay = `${Math.min((index % 4) * 55, 165)}ms`;
    revealObserver.observe(element);
  });

  const navLinks = $$('.desktop-nav a');
  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const target = entry.target.id;
      navLinks.forEach(link => link.classList.toggle('is-active', Boolean(target) && link.getAttribute('href') === `#${target}`));
    });
  }, { threshold: .22, rootMargin: '-20% 0px -52% 0px' });
  $$('[data-section]').forEach(section => sectionObserver.observe(section));

  const workRail = $('#work');
  const workPanels = $$('.work-panel');
  const workCurrent = $('#workCurrent');
  const workProgress = $('#workProgress');
  let activeWork = 0;
  let previousWork = 0;

  const activateWork = (index) => {
    if (index === activeWork || index < 0 || index >= workPanels.length) return;
    previousWork = activeWork;
    activeWork = index;
    workPanels.forEach((panel, panelIndex) => {
      panel.classList.remove('is-active', 'is-leaving');
      const video = $('video', panel);
      if (panelIndex === index) {
        panel.classList.add('is-active');
        if (video) video.play().catch(() => {});
      } else {
        if (panelIndex === previousWork) panel.classList.add('is-leaving');
        if (video) video.pause();
      }
    });
    if (workCurrent) workCurrent.textContent = String(index + 1).padStart(2, '0');
  };

  function updateWork() {
    if (!workRail || !workPanels.length) return;
    const railTop = workRail.offsetTop;
    const distance = Math.max(1, workRail.offsetHeight - innerHeight);
    const raw = (latestScroll - railTop) / distance;
    const value = Math.min(1, Math.max(0, raw));
    if (workProgress) workProgress.style.width = `${value * 100}%`;
    const index = Math.min(workPanels.length - 1, Math.floor(value * workPanels.length));
    activateWork(index);
    const local = (value * workPanels.length) % 1;
    const activePanel = workPanels[index];
    if (activePanel && !reduceMotion) activePanel.style.setProperty('--sceneRotate', `${(local - .5) * 2.2}deg`);
  }

  const firstVideo = workPanels[0]?.querySelector('video');
  const workVisibility = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) workPanels[activeWork]?.querySelector('video')?.play().catch(() => {});
      else workPanels.forEach(panel => panel.querySelector('video')?.pause());
    });
  }, { threshold: .08 });
  if (workRail) workVisibility.observe(workRail);
  firstVideo?.pause();

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) $$('video').forEach(video => video.pause());
    else if (workRail?.getBoundingClientRect().top < innerHeight && workRail?.getBoundingClientRect().bottom > 0) workPanels[activeWork]?.querySelector('video')?.play().catch(() => {});
  });

  const serviceImage = $('#serviceImage');
  const servicePreview = $('.service-preview');
  $$('.service-row').forEach(row => {
    const activate = () => {
      $$('.service-row').forEach(item => item.classList.toggle('is-active', item === row));
      if (!serviceImage || serviceImage.getAttribute('src') === row.dataset.image) return;
      servicePreview?.classList.add('is-changing');
      setTimeout(() => {
        serviceImage.src = row.dataset.image;
        servicePreview?.classList.remove('is-changing');
      }, 170);
    };
    row.addEventListener('mouseenter', activate);
    row.addEventListener('focus', activate);
    row.addEventListener('click', () => openOrder(row.dataset.product || ''));
  });

  const tabs = $$('.price-tabs [role="tab"]');
  tabs.forEach(tab => tab.addEventListener('click', () => {
    tabs.forEach(item => {
      const active = item === tab;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-selected', String(active));
      const panel = $(`#${item.getAttribute('aria-controls')}`);
      if (panel) {
        panel.hidden = !active;
        panel.classList.toggle('is-active', active);
      }
    });
  }));

  const dialog = $('#orderDialog');
  const closeDialog = $('#closeDialog');
  const serviceSelect = $('#serviceSelect');
  const orderForm = $('#orderForm');
  let lastFocus = null;

  function openOrder(product = '') {
    if (!dialog) return;
    lastFocus = document.activeElement;
    if (serviceSelect && product) serviceSelect.value = [...serviceSelect.options].some(option => option.value === product) ? product : 'Custom Project';
    dialog.showModal();
    setTimeout(() => dialog.querySelector('input')?.focus(), 60);
  }

  const closeOrder = () => {
    if (!dialog?.open) return;
    dialog.close();
    if (lastFocus instanceof HTMLElement) lastFocus.focus();
  };

  $$('[data-order]').forEach(button => button.addEventListener('click', () => openOrder(button.dataset.product || '')));
  closeDialog?.addEventListener('click', closeOrder);
  dialog?.addEventListener('click', event => {
    const rect = $('.dialog-shell', dialog)?.getBoundingClientRect();
    if (rect && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) closeOrder();
  });

  orderForm?.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(orderForm);
    const service = String(data.get('service') || 'Custom Project');
    const subject = `New SPNVISUALZ project — ${service}`;
    const body = [
      'Hi SPNVISUALZ,',
      '',
      `My name: ${data.get('name') || ''}`,
      `Contact me via: ${data.get('contact') || ''}`,
      `Service: ${service}`,
      '',
      'Project idea:',
      String(data.get('brief') || ''),
      '',
      'Sent from spnvisualz.com'
    ].join('\n');
    location.href = `mailto:spnvisualz@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });

  renderScroll();
})();
