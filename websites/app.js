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
