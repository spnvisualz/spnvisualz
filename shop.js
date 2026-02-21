/* shop.js: handle cart functionality for packages and cart pages */

(function () {
  function getCart() {
    try {
      const data = localStorage.getItem('cartItems');
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.warn('Could not parse cart data', e);
      return [];
    }
  }
  function saveCart(cart) {
    localStorage.setItem('cartItems', JSON.stringify(cart));
  }
  function updateCartCount() {
    const cart = getCart();
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    const badge = document.getElementById('cart-count');
    if (badge) {
      badge.textContent = count;
    }
  }
  function addToCart(button) {
    const id = button.dataset.id;
    const name = button.dataset.name;
    const price = parseFloat(button.dataset.price);
    const image = button.dataset.image;
    let cart = getCart();
    const existing = cart.find((item) => item.id === id);
    if (existing) {
      existing.quantity += 1;
    } else {
      cart.push({ id, name, price, image, quantity: 1 });
    }
    saveCart(cart);
    updateCartCount();
    button.textContent = 'Added';
    button.disabled = true;
    setTimeout(() => {
      button.textContent = 'Add to cart';
      button.disabled = false;
    }, 800);
  }
  function renderCartPage() {
    const container = document.getElementById('cart-container');
    if (!container) return;
    const cart = getCart();
    container.innerHTML = '';
    if (cart.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'section-intro';
      empty.textContent = 'Your cart is empty. Explore our packages to find what suits you best.';
      container.appendChild(empty);
      return;
    }
    let total = 0;
    cart.forEach((item) => {
      total += item.price * item.quantity;
      const row = document.createElement('div');
      row.className = 'cart-item';
      const img = document.createElement('img');
      img.src = item.image;
      img.alt = item.name;
      const details = document.createElement('div');
      details.className = 'cart-item-details';
      const nameEl = document.createElement('div');
      nameEl.className = 'cart-item-name';
      nameEl.textContent = item.name;
      const qtyEl = document.createElement('div');
      qtyEl.className = 'cart-item-quantity';
      qtyEl.textContent = 'Quantity: ' + item.quantity;
      const priceEl = document.createElement('div');
      priceEl.className = 'cart-item-price';
      priceEl.textContent = '€' + (item.price * item.quantity).toFixed(2);
      details.appendChild(nameEl);
      details.appendChild(qtyEl);
      details.appendChild(priceEl);
      const removeBtn = document.createElement('button');
      removeBtn.className = 'cart-item-remove';
      removeBtn.textContent = 'Remove';
      removeBtn.addEventListener('click', () => removeFromCart(item.id));
      row.appendChild(img);
      row.appendChild(details);
      row.appendChild(removeBtn);
      container.appendChild(row);
    });
    const totalEl = document.createElement('p');
    totalEl.className = 'cart-item-price';
    totalEl.style.textAlign = 'right';
    totalEl.style.marginTop = '1rem';
    totalEl.textContent = 'Total: €' + total.toFixed(2);
    container.appendChild(totalEl);
  }
  function removeFromCart(id) {
    let cart = getCart();
    const index = cart.findIndex((item) => item.id === id);
    if (index !== -1) {
      if (cart[index].quantity > 1) {
        cart[index].quantity -= 1;
      } else {
        cart.splice(index, 1);
      }
      saveCart(cart);
      updateCartCount();
      renderCartPage();
    }
  }
  function init() {
    updateCartCount();
    document.querySelectorAll('.add-to-cart').forEach((button) => {
      button.addEventListener('click', () => addToCart(button));
    });
    renderCartPage();
    const checkoutBtn = document.getElementById('checkout-btn');
    if (checkoutBtn) {
      checkoutBtn.addEventListener('click', () => {
        const cart = getCart();
        if (cart.length === 0) {
          alert('Your cart is empty!');
          return;
        }
        alert('Thank you for choosing SPN Visualz! We will contact you to finalize your package.');
        localStorage.removeItem('cartItems');
        updateCartCount();
        renderCartPage();
      });
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
