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
