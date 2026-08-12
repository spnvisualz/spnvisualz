(() => {
  const $ = (selector, context = document) => context.querySelector(selector);
  const $$ = (selector, context = document) => [...context.querySelectorAll(selector)];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(pointer:fine)').matches;
  const depthField = $('#depthField');
  const hero = $('.hero');
  const heroCosmos = $('.hero-cosmos');
  const heroArchitecture = $('#heroArchitecture');
  const depthLayers = $$('[data-depth]').map(element => ({
    element,
    scene: element.closest('.depth-scene') || element.parentElement,
    distance: Number(element.dataset.depthDistance || 120),
    rotate: Number(element.dataset.depthRotate || 0),
    top: 0,
    height: 1
  }));

  const cacheDepthMetrics = () => {
    depthLayers.forEach(item => {
      const rect = item.scene.getBoundingClientRect();
      item.top = scrollY + rect.top;
      item.height = Math.max(1, rect.height);
    });
  };

  function updateDepthLayers() {
    if (reduceMotion || !depthLayers.length) return;
    const motionScale = innerWidth <= 720 ? .28 : innerWidth <= 1050 ? .62 : 1;
    depthLayers.forEach(item => {
      const raw = (latestScroll + innerHeight - item.top) / (item.height + innerHeight);
      const progress = Math.min(1, Math.max(0, raw));
      const centered = progress - .5;
      const depthCurve = Math.sin(progress * Math.PI);
      item.element.style.setProperty('--depth-y', `${(centered * item.distance * motionScale).toFixed(2)}px`);
      item.element.style.setProperty('--depth-rotate', `${(centered * item.rotate * motionScale).toFixed(2)}deg`);
      item.element.style.setProperty('--depth-z', `${(depthCurve * 55 * motionScale).toFixed(2)}px`);
    });
  }

  const bootIntro = $('#bootIntro');
  const bootPercent = $('#bootPercent');
  const bootStatus = $('#bootStatus');
  let bootFinished = false;
  let bootFrame = 0;
  let bootFailsafe = 0;

  const finishBoot = () => {
    if (bootFinished) return;
    bootFinished = true;
    if (bootFrame) cancelAnimationFrame(bootFrame);
    clearTimeout(bootFailsafe);
    bootIntro?.classList.add('is-complete');
    setTimeout(() => bootIntro?.remove(), 420);
  };

  if (bootIntro) {
    const compactBoot = innerWidth <= 720;
    if (reduceMotion || compactBoot) {
      bootFinished = true;
      bootIntro.remove();
    } else {
      const bootStarted = performance.now();
      const updateBoot = (now) => {
        const elapsed = now - bootStarted;
        const linear = Math.min(1, elapsed / 980);
        const eased = 1 - Math.pow(1 - linear, 3);
        const value = Math.min(100, Math.floor(eased * 100));
        if (bootPercent) bootPercent.textContent = String(value).padStart(2, '0');
        if (bootStatus) {
          bootStatus.textContent = linear < .28 ? 'INITIALIZING' : linear < .62 ? 'CALIBRATING MOTION' : linear < .9 ? 'BUILDING THE WORLD' : 'READY';
        }
        if (linear < 1) bootFrame = requestAnimationFrame(updateBoot);
        else finishBoot();
      };
      bootFrame = requestAnimationFrame(updateBoot);
      bootFailsafe = setTimeout(finishBoot, 1600);
    }
  }

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
        const mobileScale = innerWidth <= 720 ? .55 : 1;
        object.style.setProperty('--scrollY', `${p * 105 * mobileScale}px`);
        object.style.setProperty('--heroScale', `${1 - p * .16}`);
        object.style.setProperty('--hero-object-z', `${p * -210 * mobileScale}px`);
        hero?.style.setProperty('--hero-copy-y', `${p * -72 * mobileScale}px`);
        hero?.style.setProperty('--hero-architecture-y', `${p * 128 * mobileScale}px`);
        heroCosmos?.style.setProperty('--hero-cosmos-scroll-y', `${p * 68 * mobileScale}px`);
        heroCosmos?.style.setProperty('--hero-cosmos-scale', `${1.08 + p * .075}`);
      }
      depthField?.style.setProperty('--depth-page-y', `${pageP * -130}px`);
      depthField?.style.setProperty('--depth-page-y-near', `${pageP * -260}px`);
    }
    updateDepthLayers();
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
        object.style.setProperty('--ry', `${heroPointerX * 8}deg`);
        object.style.setProperty('--rx', `${-heroPointerY * 6}deg`);
        object.style.setProperty('--hero-object-x', `${heroPointerX * 28}px`);
        hero?.style.setProperty('--depth-pointer-x', `${heroPointerX * 26}px`);
        hero?.style.setProperty('--depth-pointer-y', `${heroPointerY * 18}px`);
        heroCosmos?.style.setProperty('--hero-cosmos-x', `${heroPointerX * -18}px`);
        heroCosmos?.style.setProperty('--hero-cosmos-y', `${heroPointerY * -11}px`);
        depthField?.style.setProperty('--depth-pointer-x', `${heroPointerX * 17}px`);
        depthField?.style.setProperty('--depth-pointer-y', `${heroPointerY * 11}px`);
        depthField?.style.setProperty('--depth-pointer-x-inverse', `${heroPointerX * -17}px`);
        depthField?.style.setProperty('--depth-pointer-y-inverse', `${heroPointerY * -11}px`);
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
          card.style.setProperty('--tilt-light-x', `${(tiltX + .5) * 100}%`);
          card.style.setProperty('--tilt-light-y', `${(tiltY + .5) * 100}%`);
          tiltFrame = 0;
        });
      }, { passive: true });
      card.addEventListener('pointerleave', () => {
        if (tiltFrame) cancelAnimationFrame(tiltFrame);
        tiltFrame = 0;
        tiltBounds = null;
        card.style.removeProperty('--tilt-light-x');
        card.style.removeProperty('--tilt-light-y');
      });
    });
  }

  const menuToggle = $('#menuToggle');
  const mobileMenu = $('#mobileMenu');
  let menuReturnFocus = null;
  const setMenu = (open, restoreFocus = true) => {
    if (!menuToggle || !mobileMenu) return;
    if (open) menuReturnFocus = document.activeElement;
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.querySelector('span').textContent = open ? 'Close' : 'Menu';
    mobileMenu.classList.toggle('is-open', open);
    mobileMenu.setAttribute('aria-hidden', String(!open));
    document.body.classList.toggle('menu-open', open);
    if (open) {
      requestAnimationFrame(() => $('[data-menu-link]', mobileMenu)?.focus());
    } else if (restoreFocus && menuReturnFocus instanceof HTMLElement) {
      menuReturnFocus.focus();
    }
  };
  menuToggle?.addEventListener('click', () => setMenu(menuToggle.getAttribute('aria-expanded') !== 'true'));
  $$('[data-menu-link]').forEach(link => link.addEventListener('click', () => setMenu(false, false)));
  $$('[data-menu-project]').forEach(button => button.addEventListener('click', () => setMenu(false, false)));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menuToggle?.getAttribute('aria-expanded') === 'true') setMenu(false);
  });

  document.addEventListener('click', (event) => {
    const anchor = event.target.closest('a[href^="#"]');
    if (!anchor) return;
    const id = anchor.getAttribute('href');
    const target = id && id !== '#' ? $(id) : null;
    if (!target) return;
    event.preventDefault();
    if (reduceMotion) {
      const root = document.documentElement;
      const previousBehavior = root.style.scrollBehavior;
      root.style.scrollBehavior = 'auto';
      target.scrollIntoView({ behavior: 'auto', block: 'start' });
      requestAnimationFrame(() => { root.style.scrollBehavior = previousBehavior; });
      return;
    }
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
  }, { threshold: .01, rootMargin: '-20% 0px -52% 0px' });
  $$('[data-section]').forEach(section => sectionObserver.observe(section));

  const workRail = $('#work');
  const workStage = $('#workStage');
  const workPanels = $$('.work-panel');
  const workCurrent = $('#workCurrent');
  const workProgress = $('#workProgress');
  const workSignal = $('#workSignal');
  const worldIndexItems = $$('.world-index span');
  let activeWork = 0;
  let workRailTop = 0;
  let workRailDistance = 1;
  let workInView = false;
  let videoTimer = 0;
  let metricFrame = 0;
  let workFxTimer = 0;

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
    cacheDepthMetrics();
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
    activeWork = index;
    clearTimeout(videoTimer);
    videoTimer = 0;
    workPanels.forEach((panel, panelIndex) => {
      panel.classList.remove('is-active', 'is-leaving');
      const video = $('video', panel);
      if (panelIndex === index) {
        panel.classList.add('is-active');
      } else {
        if (video) video.pause();
      }
    });
    const worldNumber = String(index + 1).padStart(2, '0');
    if (workCurrent) workCurrent.textContent = worldNumber;
    if (workSignal) workSignal.textContent = worldNumber;
    worldIndexItems.forEach((item, itemIndex) => item.classList.toggle('is-active', itemIndex === index));
    if (workStage && !reduceMotion) {
      workStage.classList.remove('is-switching');
      void workStage.offsetWidth;
      workStage.classList.add('is-switching');
      clearTimeout(workFxTimer);
      workFxTimer = setTimeout(() => workStage.classList.remove('is-switching'), 760);
    }
    scheduleActiveVideo();
  };

  function updateWork() {
    if (!workRail || !workPanels.length) return;
    const raw = (latestScroll - workRailTop) / workRailDistance;
    const value = Math.min(1, Math.max(0, raw));
    if (workProgress) workProgress.style.transform = `scaleX(${value})`;
    const segment = value * workPanels.length;
    const index = Math.min(workPanels.length - 1, Math.floor(segment));
    const phase = index === workPanels.length - 1 && value === 1 ? 1 : segment - Math.floor(segment);
    const centered = phase - .5;
    const curve = Math.sin(phase * Math.PI);
    const motionScale = reduceMotion ? 0 : innerWidth <= 720 ? .38 : innerWidth <= 1050 ? .7 : 1;
    if (workStage) {
      workStage.style.setProperty('--world-phase', phase.toFixed(4));
      workStage.style.setProperty('--world-rail-x', `${(phase * 1.5 * motionScale).toFixed(2)}deg`);
      workStage.style.setProperty('--world-rail-y', `${(centered * -4 * motionScale).toFixed(2)}deg`);
      workStage.style.setProperty('--world-drift-y', `${(centered * -10 * motionScale).toFixed(2)}px`);
      workStage.style.setProperty('--world-scale', `${(1 - Math.abs(centered) * .018 * motionScale).toFixed(4)}`);
      workStage.style.setProperty('--world-ghost-y', `${(centered * 16 * motionScale).toFixed(2)}px`);
      workStage.style.setProperty('--world-ghost-scale', `${(.98 + curve * .02 * motionScale).toFixed(4)}`);
    }
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
  const serviceVideo = $('#serviceVideo');
  const serviceVideoSource = $('#serviceVideoSource');
  const servicePreview = $('.service-preview');
  const servicePreviewLabel = $('#servicePreviewLabel');
  const serviceDialog = $('#serviceDialog');
  const closeServiceDialog = $('#closeServiceDialog');
  const serviceDialogImage = $('#serviceDialogImage');
  const serviceDialogVideo = $('#serviceDialogVideo');
  const serviceDialogVideoSource = $('#serviceDialogVideoSource');
  const serviceDialogCaption = $('#serviceDialogCaption');
  const serviceDialogNumber = $('#serviceDialogNumber');
  const serviceDialogTitle = $('#serviceDialogTitle');
  const serviceDialogDescription = $('#serviceDialogDescription');
  const serviceDialogIncludes = $('#serviceDialogIncludes');
  const serviceDialogPrice = $('#serviceDialogPrice');
  const serviceOrderButton = $('#serviceOrderButton');
  let selectedService = '';
  let serviceLastFocus = null;
  let serviceImageTimer = 0;
  let serviceMediaLocked = false;

  const stopServiceVideo = (video, source) => {
    if (!video) return;
    video.pause();
    video.hidden = true;
    if (source?.hasAttribute('src')) {
      source.removeAttribute('src');
      video.load();
    }
  };

  const setServiceMedia = (image, video, source, row, autoplay = false) => {
    const videoPath = row.dataset.video || '';
    const useVideo = Boolean(videoPath) && !reduceMotion && video && source;
    if (useVideo) {
      if (image) image.hidden = true;
      video.hidden = false;
      if (source.getAttribute('src') !== videoPath) {
        source.setAttribute('src', videoPath);
        video.load();
      }
      if (autoplay) video.play().catch(() => {});
      return;
    }
    video?.pause();
    if (video) video.hidden = true;
    if (image) {
      image.hidden = false;
      if (image.getAttribute('src') !== row.dataset.image) image.src = row.dataset.image || '';
    }
  };

  const activateService = (row) => {
    if (serviceMediaLocked) return;
    $$('.service-row').forEach(item => item.classList.toggle('is-active', item === row));
    if (servicePreviewLabel) servicePreviewLabel.textContent = row.dataset.label || '';
    const wantsVideo = Boolean(row.dataset.video) && !reduceMotion;
    const videoIsCurrent = wantsVideo && serviceVideo && !serviceVideo.hidden && serviceVideoSource?.getAttribute('src') === row.dataset.video;
    const imageIsCurrent = !wantsVideo && serviceImage && !serviceImage.hidden && serviceImage.getAttribute('src') === row.dataset.image;
    if (videoIsCurrent || imageIsCurrent) return;
    clearTimeout(serviceImageTimer);
    servicePreview?.classList.add('is-changing');
    serviceImageTimer = setTimeout(() => {
      setServiceMedia(serviceImage, serviceVideo, serviceVideoSource, row, true);
      servicePreview?.classList.remove('is-changing');
    }, reduceMotion ? 0 : 170);
  };

  const openServiceDetails = (row) => {
    if (!serviceDialog) return;
    serviceMediaLocked = true;
    clearTimeout(serviceImageTimer);
    servicePreview?.classList.remove('is-changing');
    stopServiceVideo(serviceVideo, serviceVideoSource);
    if (serviceImage) {
      serviceImage.hidden = false;
      serviceImage.src = row.dataset.image || '';
    }
    serviceLastFocus = document.activeElement;
    selectedService = row.dataset.product || 'Custom Project';
    setServiceMedia(serviceDialogImage, serviceDialogVideo, serviceDialogVideoSource, row, true);
    if (serviceDialogCaption) serviceDialogCaption.textContent = row.dataset.label || selectedService;
    if (serviceDialogNumber) serviceDialogNumber.textContent = row.dataset.number || '';
    if (serviceDialogTitle) serviceDialogTitle.textContent = $('strong', row)?.textContent || selectedService;
    if (serviceDialogDescription) serviceDialogDescription.textContent = row.dataset.description || '';
    if (serviceDialogPrice) serviceDialogPrice.textContent = row.dataset.price || '';
    if (serviceDialogIncludes) {
      const items = (row.dataset.includes || '').split('|').filter(Boolean);
      serviceDialogIncludes.replaceChildren(...items.map(item => {
        const entry = document.createElement('li');
        entry.textContent = item;
        return entry;
      }));
    }
    serviceDialog.showModal();
    setTimeout(() => closeServiceDialog?.focus(), 50);
  };

  const closeServiceDetails = () => {
    if (!serviceDialog?.open) return;
    stopServiceVideo(serviceDialogVideo, serviceDialogVideoSource);
    serviceDialog.close();
    if (serviceLastFocus instanceof HTMLElement) serviceLastFocus.focus();
    setTimeout(() => { serviceMediaLocked = false; }, 0);
  };

  $$('.service-row').forEach(row => {
    row.addEventListener('mouseenter', () => activateService(row));
    row.addEventListener('focus', () => activateService(row));
    row.addEventListener('click', () => {
      activateService(row);
      openServiceDetails(row);
    });
  });
  closeServiceDialog?.addEventListener('click', closeServiceDetails);
  serviceDialog?.addEventListener('click', event => {
    const rect = $('.service-dialog-shell', serviceDialog)?.getBoundingClientRect();
    if (rect && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) closeServiceDetails();
  });
  serviceDialog?.addEventListener('close', () => {
    stopServiceVideo(serviceDialogVideo, serviceDialogVideoSource);
    if (serviceLastFocus instanceof HTMLElement && !dialog?.open) serviceLastFocus.focus();
    setTimeout(() => { serviceMediaLocked = false; }, 0);
  });
  serviceOrderButton?.addEventListener('click', () => {
    const product = selectedService;
    const returnFocus = serviceLastFocus;
    stopServiceVideo(serviceVideo, serviceVideoSource);
    stopServiceVideo(serviceDialogVideo, serviceDialogVideoSource);
    serviceDialog?.close();
    setTimeout(() => {
      serviceMediaLocked = true;
      openOrder(product);
      if (returnFocus instanceof HTMLElement) lastFocus = returnFocus;
      serviceMediaLocked = false;
    }, 0);
  });

  const tabs = $$('.price-tabs [role="tab"]');
  const activatePriceTab = (tab, moveFocus = false) => {
    tabs.forEach(item => {
      const active = item === tab;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-selected', String(active));
      item.tabIndex = active ? 0 : -1;
      const panel = $(`#${item.getAttribute('aria-controls')}`);
      if (panel) {
        panel.hidden = !active;
        panel.classList.toggle('is-active', active);
      }
    });
    if (moveFocus) tab.focus();
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activatePriceTab(tab));
    tab.addEventListener('keydown', event => {
      let nextIndex = null;
      if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
      if (event.key === 'Home') nextIndex = 0;
      if (event.key === 'End') nextIndex = tabs.length - 1;
      if (nextIndex === null) return;
      event.preventDefault();
      activatePriceTab(tabs[nextIndex], true);
    });
  });
  const selectedPriceTab = tabs.find(tab => tab.getAttribute('aria-selected') === 'true') || tabs[0];
  if (selectedPriceTab) activatePriceTab(selectedPriceTab);

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

  const cleanOrderState = () => {
    const url = new URL(location.href);
    if (url.searchParams.has('order')) {
      url.searchParams.delete('order');
      history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    }
    if (lastFocus instanceof HTMLElement) lastFocus.focus();
  };

  const closeOrder = () => {
    if (dialog?.open) dialog.close();
  };

  $$('[data-order]').forEach(button => button.addEventListener('click', () => openOrder(button.dataset.product || '')));
  closeDialog?.addEventListener('click', closeOrder);
  dialog?.addEventListener('close', cleanOrderState);
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


  // Deep-link editorial readers into the relevant service preview.
  const queryParams = new URLSearchParams(location.search);
  const requestedService = queryParams.get('service');
  const requestedOrder = queryParams.get('order');
  if (requestedService && !requestedOrder) {
    const revealRequestedService = () => {
      if (!bootFinished) {
        setTimeout(revealRequestedService, 120);
        return;
      }
      const wanted = requestedService.trim().toLowerCase();
      const row = $$('.service-row').find(item => {
        const product = (item.dataset.product || '').trim().toLowerCase();
        const title = ($('strong', item)?.textContent || '').trim().toLowerCase();
        return product === wanted || title === wanted;
      });
      if (!row) return;
      $('#services')?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      setTimeout(() => {
        activateService(row);
        openServiceDetails(row);
        window.SPNAnalytics?.track('service_preview_opened', {
          service_name: row.dataset.product || requestedService,
          entry_method: 'visual_lab_cta'
        });
      }, reduceMotion ? 0 : 420);
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', revealRequestedService, { once: true });
    } else {
      revealRequestedService();
    }
  }

  if (requestedOrder) {
    const revealRequestedOrder = () => {
      if (!bootFinished) {
        setTimeout(revealRequestedOrder, 80);
        return;
      }
      openOrder(requestedOrder.trim() || 'Custom Project');
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', revealRequestedOrder, { once: true });
    } else {
      revealRequestedOrder();
    }
  }

  addEventListener('pageshow', event => {
    if (event.persisted) finishBoot();
    document.body.classList.remove('is-loading');
    latestScroll = scrollY;
    scheduleMetricRefresh();
    requestAnimationFrame(() => {
      $$('.reveal').forEach(element => {
        const rect = element.getBoundingClientRect();
        if (rect.bottom > 0 && rect.top < innerHeight) element.classList.add('is-visible');
      });
    });
  });

  cachePageMetrics();
  latestScroll = scrollY;
  renderScroll();
})();
