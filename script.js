// header scroll effect
window.addEventListener('scroll', () => {
  document.getElementById('site-header').classList.toggle('scrolled', window.scrollY > 40);
});

function smoothTo(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}

document.querySelectorAll('.event-img').forEach(img => {
  img.addEventListener('click', () => {
    document.getElementById('lightbox-img').src = img.src;
    document.getElementById('lightbox').classList.add('open');
  });
});

function closeLightbox() {
  document.getElementById('lightbox').classList.remove('open');
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeLightbox();
});

function showStore(storeId) {
  document.querySelectorAll('.pricing-table').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('store-' + storeId).classList.add('active');
  event.target.classList.add('active');
}

function toggleFaq(btn) {
  btn.classList.toggle('open');
  const answer = btn.nextElementSibling;
  answer.classList.toggle('open');
}
