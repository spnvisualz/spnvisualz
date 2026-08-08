(() => {
  const $ = (selector, context = document) => context.querySelector(selector);
  const $$ = (selector, context = document) => [...context.querySelectorAll(selector)];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(pointer:fine)').matches;

  addEventListener('DOMContentLoaded', () => {
    requestAnimationFrame(() => {
      document.body.classList.remove('is-loading');
      cachePageMetrics();
      renderScroll();
    });
    const year = $('#year');
    if (year) year.textContent = new Date().getFullYear();
  });

  const header = $('#siteHeader');
  const progress = $('#pageProgress');
  let latestScroll = scrollY;
  let pageMax = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  let ticking = false;

  const renderScroll = () => {
    const pageP = Math.min(1, Math.max(0, latestScroll / pageMax));
    if (progress) progress.style.transform = `scaleX(${pageP})`;
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
    if (videoTimer) scheduleActiveVideo(160);
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(renderScroll);
    }
  }, { passive: true });

  if (!reduceMotion && finePointer) {
    const object = $('#heroObject');
    let heroPointerFrame = 0;
    let heroPointerX = 0;
    let heroPointerY = 0;
    addEventListener('pointermove', (event) => {
      if (!object || scrollY > innerHeight) return;
      heroPointerX = event.clientX / innerWidth - .5;
      heroPointerY = event.clientY / innerHeight - .5;
      if (heroPointerFrame) return;
      heroPointerFrame = requestAnimationFrame(() => {
        object.style.setProperty('--ry', `${heroPointerX * 5}deg`);
        object.style.setProperty('--rx', `${-heroPointerY * 4}deg`);
        heroPointerFrame = 0;
      });
    }, { passive: true });

    $$('[data-tilt]').forEach(card => {
      let tiltBounds = null;
      let tiltFrame = 0;
      let tiltX = 0;
      let tiltY = 0;
      card.addEventListener('pointerenter', () => {
        tiltBounds = card.getBoundingClientRect();
      }, { passive: true });
      card.addEventListener('pointermove', event => {
        const bounds = tiltBounds || card.getBoundingClientRect();
        tiltX = (event.clientX - bounds.left) / bounds.width - .5;
        tiltY = (event.clientY - bounds.top) / bounds.height - .5;
        if (tiltFrame) return;
        tiltFrame = requestAnimationFrame(() => {
          card.style.transform = `rotateX(${-tiltY * 3}deg) rotateY(${tiltX * 4}deg) translateY(-2px)`;
          tiltFrame = 0;
        });
      }, { passive: true });
      card.addEventListener('pointerleave', () => {
        if (tiltFrame) cancelAnimationFrame(tiltFrame);
        tiltFrame = 0;
        tiltBounds = null;
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
  let workRailTop = 0;
  let workRailDistance = 1;
  let workInView = false;
  let videoTimer = 0;
  let metricFrame = 0;

  const pauseWorkVideos = () => {
    workPanels.forEach(panel => panel.querySelector('video')?.pause());
  };

  const scheduleActiveVideo = (delay = 140) => {
    clearTimeout(videoTimer);
    videoTimer = 0;
    if (!workInView || document.hidden) return;
    videoTimer = setTimeout(() => {
      videoTimer = 0;
      workPanels[activeWork]?.querySelector('video')?.play().catch(() => {});
    }, reduceMotion ? 0 : delay);
  };

  function cachePageMetrics() {
    pageMax = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    if (!workRail) return;
    const rect = workRail.getBoundingClientRect();
    workRailTop = scrollY + rect.top;
    workRailDistance = Math.max(1, workRail.offsetHeight - innerHeight);
  }

  const scheduleMetricRefresh = () => {
    if (metricFrame) return;
    metricFrame = requestAnimationFrame(() => {
      cachePageMetrics();
      latestScroll = scrollY;
      renderScroll();
      metricFrame = 0;
    });
  };

  addEventListener('resize', scheduleMetricRefresh, { passive: true });
  addEventListener('load', scheduleMetricRefresh, { once: true });
  if ('ResizeObserver' in window) new ResizeObserver(scheduleMetricRefresh).observe(document.body);

  const activateWork = (index) => {
    if (index === activeWork || index < 0 || index >= workPanels.length) return;
    previousWork = activeWork;
    activeWork = index;
    clearTimeout(videoTimer);
    videoTimer = 0;
    workPanels.forEach((panel, panelIndex) => {
      panel.classList.remove('is-active', 'is-leaving');
      const video = $('video', panel);
      if (panelIndex === index) {
        panel.classList.add('is-active');
      } else {
        if (panelIndex === previousWork) panel.classList.add('is-leaving');
        if (video) video.pause();
      }
    });
    if (workCurrent) workCurrent.textContent = String(index + 1).padStart(2, '0');
    scheduleActiveVideo();
  };

  function updateWork() {
    if (!workRail || !workPanels.length) return;
    const raw = (latestScroll - workRailTop) / workRailDistance;
    const value = Math.min(1, Math.max(0, raw));
    if (workProgress) workProgress.style.transform = `scaleX(${value})`;
    const index = Math.min(workPanels.length - 1, Math.floor(value * workPanels.length));
    activateWork(index);
  }

  const firstVideo = workPanels[0]?.querySelector('video');
  const workVisibility = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      workInView = entry.isIntersecting;
      if (workInView) scheduleActiveVideo(60);
      else {
        clearTimeout(videoTimer);
        videoTimer = 0;
        pauseWorkVideos();
      }
    });
  }, { threshold: .08 });
  if (workRail) workVisibility.observe(workRail);
  firstVideo?.pause();

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clearTimeout(videoTimer);
      videoTimer = 0;
      pauseWorkVideos();
    } else if (workInView) scheduleActiveVideo(40);
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

  cachePageMetrics();
  latestScroll = scrollY;
  renderScroll();
})();
