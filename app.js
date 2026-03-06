const STORAGE_KEY = 'abomanager_subscriptions_v2';
const NOTIFY_KEY = 'abomanager_notifications_log_v2';

const el = (id) => document.getElementById(id);
const form = el('subscriptionForm');
const listEl = el('subscriptionList');
const template = el('subscriptionTemplate');

let subscriptions = [];
let deferredPrompt = null;

function loadSubscriptions() {
  try {
    subscriptions = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    subscriptions = [];
  }
}

function saveSubscriptions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(subscriptions));
}

function getNotificationLog() {
  try {
    return JSON.parse(localStorage.getItem(NOTIFY_KEY)) || {};
  } catch {
    return {};
  }
}

function saveNotificationLog(log) {
  localStorage.setItem(NOTIFY_KEY, JSON.stringify(log));
}

function normalizeDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  date.setHours(0, 0, 0, 0);
  return date;
}

function daysUntil(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = normalizeDate(dateStr);
  return Math.ceil((target - today) / 86400000);
}

function formatDate(dateStr) {
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' }).format(normalizeDate(dateStr));
}

function formatPrice(price, currency, cycle) {
  const symbolMap = { EUR: '€', USD: '$', TRY: '₺', GBP: '£' };
  const suffixMap = { monthly: '/Monat', yearly: '/Jahr', weekly: '/Woche' };
  return `${Number(price).toFixed(2)} ${symbolMap[currency] || currency} ${suffixMap[cycle] || ''}`;
}

function toMonthly(price, cycle) {
  const numeric = Number(price) || 0;
  if (cycle === 'yearly') return numeric / 12;
  if (cycle === 'weekly') return numeric * 4.345;
  return numeric;
}

function generateId() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
}

function resetForm() {
  form.reset();
  el('subId').value = '';
  el('formTitle').textContent = 'Neues Abonnement';
  el('submitBtn').textContent = 'Speichern';
  el('resetFormBtn').classList.add('hidden');
  const today = new Date().toISOString().slice(0, 10);
  if (!el('startDate').value) el('startDate').value = today;
  if (!el('nextChargeDate').value) el('nextChargeDate').value = today;
  if (!el('deadlineDate').value) el('deadlineDate').value = today;
}

function getFormData() {
  return {
    id: el('subId').value || generateId(),
    name: el('name').value.trim(),
    category: el('category').value,
    price: Number(el('price').value),
    currency: el('currency').value,
    billingCycle: el('billingCycle').value,
    startDate: el('startDate').value,
    nextChargeDate: el('nextChargeDate').value,
    deadlineDate: el('deadlineDate').value,
    status: el('status').value,
    cancelUrl: el('cancelUrl').value.trim(),
    notes: el('notes').value.trim()
  };
}

function populateForm(sub) {
  el('subId').value = sub.id;
  el('name').value = sub.name;
  el('category').value = sub.category;
  el('price').value = sub.price;
  el('currency').value = sub.currency;
  el('billingCycle').value = sub.billingCycle;
  el('startDate').value = sub.startDate;
  el('nextChargeDate').value = sub.nextChargeDate;
  el('deadlineDate').value = sub.deadlineDate;
  el('status').value = sub.status;
  el('cancelUrl').value = sub.cancelUrl || '';
  el('notes').value = sub.notes || '';
  el('formTitle').textContent = 'Abonnement bearbeiten';
  el('submitBtn').textContent = 'Änderungen speichern';
  el('resetFormBtn').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function getFilteredSubscriptions() {
  const search = el('searchInput').value.trim().toLowerCase();
  const filterStatus = el('filterStatus').value;
  const sortBy = el('sortBy').value;

  let result = subscriptions.filter((sub) => {
    const matchesSearch = !search || [sub.name, sub.category, sub.notes].join(' ').toLowerCase().includes(search);
    const matchesStatus = filterStatus === 'all' || sub.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  result.sort((a, b) => {
    switch (sortBy) {
      case 'price-desc': return b.price - a.price;
      case 'price-asc': return a.price - b.price;
      case 'name-asc': return a.name.localeCompare(b.name, 'de');
      default: return daysUntil(a.deadlineDate) - daysUntil(b.deadlineDate);
    }
  });

  return result;
}

function renderStats() {
  const active = subscriptions.filter((s) => s.status === 'active');
  const monthly = active.reduce((sum, sub) => sum + toMonthly(sub.price, sub.billingCycle), 0);
  const nextDeadlineSub = active
    .filter((s) => daysUntil(s.deadlineDate) >= 0)
    .sort((a, b) => daysUntil(a.deadlineDate) - daysUntil(b.deadlineDate))[0];

  el('statActive').textContent = String(active.length);
  el('statMonthly').textContent = `${monthly.toFixed(2)} €`;
  el('statNextDeadline').textContent = nextDeadlineSub
    ? `${nextDeadlineSub.name} · ${Math.max(daysUntil(nextDeadlineSub.deadlineDate), 0)} Tage`
    : '-';

  const urgent = active
    .filter((s) => {
      const d = daysUntil(s.deadlineDate);
      return d >= 0 && d <= 7;
    })
    .sort((a, b) => daysUntil(a.deadlineDate) - daysUntil(b.deadlineDate));

  const banner = el('upcomingBanner');
  if (urgent.length) {
    const first = urgent[0];
    banner.textContent = `Nächste kritische Frist: ${first.name} endet am ${formatDate(first.deadlineDate)}. Du hast noch ${daysUntil(first.deadlineDate)} Tage.`;
    banner.classList.remove('hidden');
  } else {
    banner.classList.add('hidden');
  }
}

function renderList() {
  const result = getFilteredSubscriptions();
  listEl.innerHTML = '';

  if (!result.length) {
    listEl.innerHTML = '<div class="empty-state">Keine Einträge gefunden. Trag ein Abo ein oder lade Beispieldaten. Faszinierend effizient, für menschliche Verhältnisse.</div>';
    return;
  }

  result.forEach((sub) => {
    const node = template.content.firstElementChild.cloneNode(true);
    const remaining = daysUntil(sub.deadlineDate);
    const statusEl = node.querySelector('.sub-status');
    statusEl.textContent = sub.status === 'active' ? 'Aktiv' : sub.status === 'paused' ? 'Pausiert' : 'Gekündigt';
    statusEl.classList.add(sub.status);
    if (sub.status === 'active' && remaining <= 7) {
      statusEl.classList.add('due-soon');
      statusEl.textContent = remaining < 0 ? 'Abgelaufen' : `Frist bald`; 
    }

    node.querySelector('.sub-name').textContent = sub.name;
    node.querySelector('.sub-meta').textContent = `${sub.category} · Seit ${formatDate(sub.startDate)}`;
    node.querySelector('.sub-price').textContent = formatPrice(sub.price, sub.currency, sub.billingCycle);
    node.querySelector('.sub-charge').textContent = formatDate(sub.nextChargeDate);
    node.querySelector('.sub-deadline').textContent = formatDate(sub.deadlineDate);
    node.querySelector('.sub-days-left').textContent = remaining < 0 ? `Seit ${Math.abs(remaining)} Tagen vorbei` : `${remaining} Tage`;

    const notesEl = node.querySelector('.sub-notes');
    if (sub.notes) {
      notesEl.textContent = sub.notes;
      notesEl.classList.remove('hidden');
    }

    const linkEl = node.querySelector('.sub-link');
    if (sub.cancelUrl) {
      linkEl.href = sub.cancelUrl;
      linkEl.classList.remove('hidden');
    }

    node.querySelector('.sub-edit').addEventListener('click', () => populateForm(sub));
    node.querySelector('.sub-delete').addEventListener('click', () => deleteSubscription(sub.id));
    listEl.appendChild(node);
  });
}

function render() {
  renderStats();
  renderList();
  maybeSendNotifications();
}

function deleteSubscription(id) {
  subscriptions = subscriptions.filter((sub) => sub.id !== id);
  saveSubscriptions();
  render();
}

function maybeSendNotifications() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const todayKey = new Date().toISOString().slice(0, 10);
  const log = getNotificationLog();

  subscriptions.forEach((sub) => {
    if (sub.status !== 'active') return;
    const days = daysUntil(sub.deadlineDate);
    const shouldNotify = days === 7 || days === 3 || days === 2 || days === 1;
    if (!shouldNotify) return;

    const logKey = `${sub.id}_${todayKey}`;
    if (log[logKey]) return;

    const title = days === 7
      ? `Abo-Frist in 7 Tagen: ${sub.name}`
      : `Abo-Frist läuft bald ab: ${sub.name}`;
    const body = days === 1
      ? 'Morgen endet die Kündigungsfrist.'
      : `Noch ${days} Tage bis zum Fristende.`;

    new Notification(title, {
      body,
      icon: './1209.png',
      badge: './1209.png',
      tag: `deadline-${sub.id}-${todayKey}`
    });

    log[logKey] = true;
  });

  saveNotificationLog(log);
}

async function requestNotifications() {
  if (!('Notification' in window)) {
    alert('Dieser Browser unterstützt keine Benachrichtigungen. Technik bleibt konsequent anstrengend.');
    return;
  }
  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    maybeSendNotifications();
    alert('Benachrichtigungen aktiviert. Erinnerungen erscheinen bei Nutzung der App zuverlässig.');
  }
}

function exportJson() {
  const blob = new Blob([JSON.stringify(subscriptions, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'abomanager-export.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importJson(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!Array.isArray(parsed)) throw new Error();
      subscriptions = parsed;
      saveSubscriptions();
      render();
      resetForm();
    } catch {
      alert('Import fehlgeschlagen. Die Datei ist kein gültiger JSON-Export.');
    }
  };
  reader.readAsText(file);
}

function loadSampleData() {
  const today = new Date();
  const plus = (days) => {
    const d = new Date(today);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };

  subscriptions = [
    {
      id: generateId(),
      name: 'Netflix',
      category: 'Streaming',
      price: 13.99,
      currency: 'EUR',
      billingCycle: 'monthly',
      startDate: plus(-220),
      nextChargeDate: plus(4),
      deadlineDate: plus(7),
      status: 'active',
      cancelUrl: 'https://www.netflix.com/cancelplan',
      notes: 'Familienkonto'
    },
    {
      id: generateId(),
      name: 'Spotify',
      category: 'Musik',
      price: 10.99,
      currency: 'EUR',
      billingCycle: 'monthly',
      startDate: plus(-420),
      nextChargeDate: plus(11),
      deadlineDate: plus(18),
      status: 'active',
      cancelUrl: 'https://www.spotify.com/account',
      notes: ''
    },
    {
      id: generateId(),
      name: 'Adobe Creative Cloud',
      category: 'Software',
      price: 66.45,
      currency: 'EUR',
      billingCycle: 'monthly',
      startDate: plus(-90),
      nextChargeDate: plus(2),
      deadlineDate: plus(3),
      status: 'active',
      cancelUrl: 'https://account.adobe.com',
      notes: 'Teuer, aber leider nützlich.'
    }
  ];
  saveSubscriptions();
  render();
}

function setupPWAInstall() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    el('installBtn').classList.remove('hidden');
  });

  el('installBtn').addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    el('installBtn').classList.add('hidden');
  });
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(console.error);
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const data = getFormData();

  if (!data.name || !data.startDate || !data.nextChargeDate || !data.deadlineDate) return;

  const index = subscriptions.findIndex((sub) => sub.id === data.id);
  if (index >= 0) subscriptions[index] = data;
  else subscriptions.unshift(data);

  saveSubscriptions();
  render();
  resetForm();
});

el('resetFormBtn').addEventListener('click', resetForm);
el('notifyBtn').addEventListener('click', requestNotifications);
el('sampleBtn').addEventListener('click', loadSampleData);
el('exportBtn').addEventListener('click', exportJson);
el('importInput').addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (file) importJson(file);
  e.target.value = '';
});
el('clearBtn').addEventListener('click', () => {
  if (!confirm('Wirklich alle Abos löschen?')) return;
  subscriptions = [];
  saveSubscriptions();
  render();
  resetForm();
});
['searchInput', 'filterStatus', 'sortBy'].forEach((id) => el(id).addEventListener('input', renderList));

loadSubscriptions();
resetForm();
render();
setupPWAInstall();
registerServiceWorker();
