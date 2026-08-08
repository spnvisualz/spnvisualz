(() => {
  const buttons = [...document.querySelectorAll('[data-billing]')];
  const plans = [...document.querySelectorAll('[data-plan]')];

  const setBilling = (mode) => {
    buttons.forEach((button) => {
      const active = button.dataset.billing === mode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    plans.forEach((plan) => {
      const price = plan.querySelector('.price-wrap strong');
      const label = plan.querySelector('.price-wrap span');
      if (price) price.textContent = mode === 'monthly' ? plan.dataset.monthly : plan.dataset.once;
      if (label) label.textContent = mode === 'monthly' ? '/ month × 12' : 'one-time';
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
})();