document.addEventListener('DOMContentLoaded', () => {
  const menu = document.querySelector('.menu-button');
  const nav = document.querySelector('.primary-nav');
  if (menu && nav) {
    menu.addEventListener('click', () => {
      const isOpen = nav.classList.toggle('open');
      menu.setAttribute('aria-expanded', String(isOpen));
    });
    nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
      nav.classList.remove('open');
      menu.setAttribute('aria-expanded', 'false');
    }));
  }

  document.querySelectorAll('a[href="office.html"]').forEach((link) => {
    link.href = 'index.html#office';
    if (link.closest('.primary-nav')) link.textContent = 'Office & Contact';
  });

  document.querySelectorAll('#year').forEach((year) => {
    year.textContent = new Date().getFullYear();
  });
});