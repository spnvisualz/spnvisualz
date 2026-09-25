(() => {
  const buttons = [...document.querySelectorAll('[data-billing]')];
  const plans = [...document.querySelectorAll('[data-plan]')];

  const setBilling = (mode) => {
    const yearly = mode === 'yearly';
    document.body.dataset.billing = mode;
    buttons.forEach((button) => {
      const active = button.dataset.billing === mode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    plans.forEach((plan) => {
      const price = plan.querySelector('.price-wrap strong');
      const label = plan.querySelector('.price-wrap span');
      const note = plan.querySelector('.price-wrap small');
      if (price) price.textContent = yearly ? plan.dataset.yearly : plan.dataset.monthly;
      if (label) label.textContent = yearly ? '/ year' : '/ month';
      if (note) note.textContent = yearly ? 'One yearly payment' : '12 monthly payments';

      // The toggle is the whole difference between €45 a month and €449 a
      // year, and the brief the button opens had no way to say which the
      // visitor was looking at. Carry it across. Written into the href
      // rather than handled on click, so the link still works — just
      // without the billing mode — if this script never runs.
      // Edited as a string rather than through URLSearchParams, which
      // re-encodes the space in "Website Basic" as + and leaves the href
      // spelled differently from the one written in the HTML.
      const order = plan.querySelector('a[data-order-button][href*="?order="]');
      if (order) {
        const href = order.getAttribute('href').replace(/&billing=[^&]*/, '');
        order.setAttribute('href', `${href}&billing=${mode}`);

        // Monthly and yearly are two different things to buy, so the
        // button's SKU moves with the toggle. No rebinding needed —
        // spn-checkout.js reads data-buy when the click happens.
        const sku = yearly ? plan.dataset.skuYearly : plan.dataset.skuMonthly;
        if (sku) order.dataset.buy = sku;
      }
    });
  };

  const selectPlan = (key) => {
    plans.forEach((plan) => plan.classList.toggle('selected', plan.dataset.plan === key));
  };

  buttons.forEach((button) => button.addEventListener('click', () => setBilling(button.dataset.billing)));
  plans.forEach((plan) => plan.addEventListener('mouseenter', () => selectPlan(plan.dataset.plan)));

  document.querySelectorAll('[data-plan-target]').forEach((button) => {
    button.addEventListener('click', () => {
      selectPlan(button.dataset.planTarget);
      document.querySelector('#packages')?.scrollIntoView({ behavior: 'smooth' });
    });
  });

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const target = document.querySelector(link.getAttribute('href'));
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    });
  });

  setBilling('monthly');
})();
