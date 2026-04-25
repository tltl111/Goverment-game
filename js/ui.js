// ============================================================
// UI — tab switching, notifications, and game boot
// ============================================================

function showPolicyTab(tab, btn) {
  G.currentPolicyTab = tab;
  document.querySelectorAll('#policy-tabs .tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderPolicies();
}

function showDashboardTab(tab, btn) {
  G.currentDashboardTab = tab;
  document.querySelectorAll('#dashboard-tabs .tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  document.querySelectorAll('.dashboard-tab').forEach(el => el.classList.add('hidden'));
  document.getElementById('tab-' + tab).classList.remove('hidden');

  renderDashboard();
}

function showNotification(message, type) {
  const container = document.getElementById('notification-container');
  const notif = document.createElement('div');
  notif.className = 'notification ' + (type || 'info');
  notif.textContent = message;
  container.appendChild(notif);
  setTimeout(() => {
    notif.style.transition = 'opacity 0.4s';
    notif.style.opacity = '0';
    setTimeout(() => notif.remove(), 400);
  }, 2800);
}

function startGame() {
  const name = (document.getElementById('empire-input').value || '').trim();
  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('app').classList.remove('hidden');
  initGame(name || 'New Empire');
}

document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('empire-input');
  if (input) {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') startGame();
    });
    input.focus();
  }
});
