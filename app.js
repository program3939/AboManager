const STORAGE_KEY = 'aboradar1209.subscriptions.v1';
const SETTINGS_KEY = 'aboradar1209.settings.v1';
const form = document.getElementById('subscriptionForm');
const list = document.getElementById('subscriptionList');
const categoryList = document.getElementById('categoryList');
const filterCategory = document.getElementById('filterCategory');
const searchInput = document.getElementById('searchInput');
const filterStatus = document.getElementById('filterStatus');
const sortBy = document.getElementById('sortBy');
const featuresList = document.getElementById('featuresList');
const upcomingList = document.getElementById('upcomingList');
const themeSelect = document.getElementById('themeSelect');
const installBtn = document.getElementById('installBtn');
let deferredPrompt = null;

const FEATURES = [
  'Abo anlegen', 'Abo bearbeiten', 'Abo löschen', 'Archivieren', 'Wiederherstellen',
  'Status wechseln', 'Duplizieren', 'Fristen prüfen', 'Tage verbleibend anzeigen', 'Kosten monatlich berechnen',
  'Kosten jährlich berechnen', 'Kategorien verwalten', 'Tags verwalten', 'Notizen speichern', 'Anbieter-Link öffnen',
  'Suche', 'Statusfilter', 'Kategoriefilter', 'Sortierung', 'Dark/Light/System-Theme',
  'Demo-Daten', 'JSON Export', 'CSV Export', 'JSON/CSV Import', 'Lokales Backup',
  'Installierbare PWA', 'Offline-Fähigkeit', 'Benachrichtigungs-Freigabe', 'Erinnerungslogik 7/3/2/1 Tage', 'Dashboard mit Chart'
];

const currencyMap = { EUR: '€', USD: '$', GBP: '£', TRY: '₺' };

const demoSubscriptions = [
  { name: 'Netflix', category: 'Streaming', price: 13.99, currency: 'EUR', billingCycle: 'monthly', customDays: '', nextBillingDate: plusDays(6), deadlineDate: plusDays(5), website: 'https://www.netflix.com', tags: 'video,familie', graceDays: 0, status: 'active', autoRenew: true, notifyEnabled: true, isTrial: false, notes: 'Familienabo prüfen', archived: false },
  { name: 'Adobe Creative Cloud', category: 'Software', price: 61.49, currency: 'EUR', billingCycle: 'monthly', customDays: '', nextBillingDate: plusDays(12), deadlineDate: plusDays(9), website: 'https://www.adobe.com', tags: 'design,arbeit', graceDays: 2, status: 'active', autoRenew: true, notifyEnabled: true, isTrial: false, notes: 'Jährlichen Rabatt beobachten', archived: false },
  { name: 'Gym', category: 'Fitness', price: 24.99, currency: 'EUR', billingCycle: 'monthly', customDays: '', nextBillingDate: plusDays(28), deadlineDate: plusDays(21), website: '', tags: 'gesundheit', graceDays: 0, status: 'paused', autoRenew: false, notifyEnabled: true, isTrial: false, notes: 'Kündigung vor Monatsende', archived: false }
].map(enrichSubscription);

function plusDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function enrichSubscription(sub) {
  return {
    id: sub.id || uid(),
    archived: Boolean(sub.archived),
    createdAt: sub.createdAt || new Date().toISOString(),
    reminderHistory: sub.reminderHistory || {},
    ...sub
  };
}

function loadSubscriptions() {
  try {
    return (JSON.parse(localStorage.getItem(STORAGE_KEY)) || []).map(enrichSubscription);
  } catch {
    return [];
  }
}

function saveSubscriptions(subscriptions) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(subscriptions));
}

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || { theme: 'system' };
  } catch {
    return { theme: 'system' };
  }
}

function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

let subscriptions = loadSubscriptions();
const settings = loadSettings();
applyTheme(settings.theme || 'system');

themeSelect.value = settings.theme || 'system';
featuresList.innerHTML = FEATURES.map(item => `<li>${item}</li>`).join('');

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = getFormData();
  const existingIndex = subscriptions.findIndex(s => s.id === data.id);
  if (existingIndex >= 0) subscriptions[existingIndex] = { ...subscriptions[existingIndex], ...data };
  else subscriptions.unshift(enrichSubscription(data));
  persistAndRender('Abo gespeichert. Endlich mal Ordnung in dieses kleine Finanzchaos.');
  form.reset();
  document.getElementById('subscriptionId').value = '';
  document.getElementById('autoRenew').checked = true;
  document.getElementById('notifyEnabled').checked = true;
  document.getElementById('graceDays').value = 0;
  document.getElementById('status').value = 'active';
});

function getFormData() {
  return {
    id: document.getElementById('subscriptionId').value || uid(),
    name: document.getElementById('name').value.trim(),
    category: document.getElementById('category').value.trim() || 'Unkategorisiert',
    price: Number(document.getElementById('price').value || 0),
    currency: document.getElementById('currency').value,
    billingCycle: document.getElementById('billingCycle').value,
    customDays: document.getElementById('customDays').value,
    nextBillingDate: document.getElementById('nextBillingDate').value,
    deadlineDate: document.getElementById('deadlineDate').value,
    website: document.getElementById('website').value.trim(),
    tags: document.getElementById('tags').value.trim(),
    graceDays: Number(document.getElementById('graceDays').value || 0),
    status: document.getElementById('status').value,
    autoRenew: document.getElementById('autoRenew').checked,
    notifyEnabled: document.getElementById('notifyEnabled').checked,
    isTrial: document.getElementById('isTrial').checked,
    notes: document.getElementById('notes').value.trim(),
    archived: false
  };
}

function persistAndRender(message) {
  saveSubscriptions(subscriptions);
  renderAll();
  if (message) toast(message);
}

function renderAll() {
  renderFilters();
  renderStats();
  renderList();
  renderUpcoming();
  renderChart();
  runReminderEngine();
}

function renderFilters() {
  const categories = [...new Set(subscriptions.map(s => s.category).filter(Boolean))].sort((a,b) => a.localeCompare(b, 'de'));
  categoryList.innerHTML = categories.map(c => `<option value="${escapeHtml(c)}"></option>`).join('');
  const current = filterCategory.value || 'all';
  filterCategory.innerHTML = '<option value="all">Alle Kategorien</option>' + categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  filterCategory.value = categories.includes(current) ? current : 'all';
}

function renderStats() {
  const activeSubs = subscriptions.filter(s => !s.archived && s.status !== 'cancelled');
  const monthly = activeSubs.reduce((sum, s) => sum + monthlyCost(s), 0);
  const yearly = monthly * 12;
  const urgent = activeSubs.filter(s => daysUntil(s.deadlineDate) <= 7).length;
  document.getElementById('monthlyTotal').textContent = euro(monthly);
  document.getElementById('yearlyTotal').textContent = euro(yearly);
  document.getElementById('urgentCount').textContent = urgent;
  const total = subscriptions.length;
  const archived = subscriptions.filter(s => s.archived).length;
  const trials = subscriptions.filter(s => s.isTrial && !s.archived).length;
  document.getElementById('quickStats').innerHTML = [
    `Gesamt: <strong>${total}</strong>`,
    `Aktiv: <strong>${activeSubs.length}</strong>`,
    `Testphasen: <strong>${trials}</strong>`,
    `Archiv: <strong>${archived}</strong>`
  ].map(html => `<div class="info-chip">${html}</div>`).join('');
}

function monthlyCost(sub) {
  const p = Number(sub.price || 0);
  switch (sub.billingCycle) {
    case 'yearly': return p / 12;
    case 'weekly': return p * 52 / 12;
    case 'quarterly': return p / 3;
    case 'custom': return sub.customDays ? p * (30 / Number(sub.customDays)) : p;
    default: return p;
  }
}

function renderList() {
  const template = document.getElementById('subscriptionCardTemplate');
  const query = searchInput.value.trim().toLowerCase();
  let filtered = subscriptions.filter(s => {
    const hay = [s.name, s.category, s.tags, s.notes].join(' ').toLowerCase();
    const matchesQuery = !query || hay.includes(query);
    const statusValue = s.archived ? 'archived' : s.status;
    const matchesStatus = filterStatus.value === 'all' || statusValue === filterStatus.value;
    const matchesCategory = filterCategory.value === 'all' || s.category === filterCategory.value;
    return matchesQuery && matchesStatus && matchesCategory;
  });

  filtered.sort(sorter(sortBy.value));
  list.innerHTML = '';
  if (!filtered.length) {
    list.innerHTML = '<div class="sub-card"><strong>Keine Treffer.</strong><div class="sub-notes">Dein Filter war wohl mal wieder ambitionierter als die Realität.</div></div>';
    return;
  }

  filtered.forEach(sub => {
    const clone = template.content.cloneNode(true);
    const card = clone.querySelector('.sub-card');
    const days = daysUntil(sub.deadlineDate);
    card.dataset.id = sub.id;
    card.classList.add(days <= 7 ? 'urgent-card' : days <= 14 ? 'warning-card' : 'safe-card');
    clone.querySelector('.sub-name').textContent = sub.name;
    clone.querySelector('.sub-meta').innerHTML = `${badgeForStatus(sub)} • ${escapeHtml(sub.category)} • ${cycleLabel(sub)}<br>Nächste Abbuchung: <strong>${formatDate(sub.nextBillingDate)}</strong> • Frist: <strong>${formatDate(sub.deadlineDate)}</strong> • Rest: <strong>${days}</strong> Tage`;
    clone.querySelector('.sub-price').textContent = `${formatMoney(sub.price, sub.currency)} / ${cycleUnit(sub)}`;
    clone.querySelector('.sub-timeline').innerHTML = `<span class="deadline-chip ${days <= 7 ? 'urgent' : days <= 14 ? 'warning' : 'safe'}">${deadlineText(days, sub)}</span>`;
    clone.querySelector('.sub-notes').textContent = sub.notes || 'Keine Notizen';
    clone.querySelector('.sub-tags').innerHTML = tagHtml(sub.tags);

    clone.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => handleAction(btn.dataset.action, sub.id));
    });
    list.appendChild(clone);
  });
}

function badgeForStatus(sub) {
  if (sub.archived) return 'Archiviert';
  const labels = { active: 'Aktiv', trial: 'Testphase', paused: 'Pausiert', cancelled: 'Gekündigt' };
  return labels[sub.status] || sub.status;
}

function tagHtml(raw) {
  return (raw || '').split(',').map(t => t.trim()).filter(Boolean).map(t => `<span class="tag">#${escapeHtml(t)}</span>`).join('') || '<span class="tag">#ohne-tag</span>';
}

function renderUpcoming() {
  const items = subscriptions
    .filter(s => !s.archived)
    .sort((a,b) => daysUntil(a.deadlineDate) - daysUntil(b.deadlineDate))
    .slice(0, 6);
  upcomingList.innerHTML = items.map(s => {
    const d = daysUntil(s.deadlineDate);
    return `<div class="info-chip"> <strong>${escapeHtml(s.name)}</strong><br><span class="${d <= 7 ? 'urgent' : d <= 14 ? 'warning' : 'safe'}">${d} Tage bis Frist</span> • ${formatDate(s.deadlineDate)}</div>`;
  }).join('') || '<div class="info-chip">Noch nichts da. Trag erst mal ein paar Abos ein.</div>';
}

function renderChart() {
  const ctx = document.getElementById('categoryChart').getContext('2d');
  const data = {};
  subscriptions.filter(s => !s.archived && s.status !== 'cancelled').forEach(s => {
    data[s.category] = (data[s.category] || 0) + monthlyCost(s);
  });
  const entries = Object.entries(data).sort((a,b) => b[1]-a[1]).slice(0, 6);
  const w = 420, h = 240, pad = 24;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text');
  ctx.font = '14px sans-serif';
  if (!entries.length) {
    ctx.fillText('Noch keine Daten für das Chart.', 24, 40);
    return;
  }
  const max = Math.max(...entries.map(([,v]) => v));
  const barWidth = 42;
  entries.forEach(([label, value], i) => {
    const x = pad + i * 64;
    const bh = (value / max) * 140;
    const y = h - pad - bh;
    ctx.fillStyle = i % 2 ? 'rgba(99,230,255,0.75)' : 'rgba(138,125,255,0.75)';
    ctx.fillRect(x, y, barWidth, bh);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text');
    ctx.fillText(label.slice(0, 8), x, h - 8);
    ctx.fillText(value.toFixed(0) + '€', x, y - 6);
  });
}

function handleAction(action, id) {
  const sub = subscriptions.find(s => s.id === id);
  if (!sub) return;
  if (action === 'openLink') {
    if (sub.website) window.open(sub.website, '_blank', 'noopener');
    else toast('Kein Link gespeichert. Mysteriös effizient.');
  }
  if (action === 'edit') fillForm(sub);
  if (action === 'renew') {
    sub.nextBillingDate = addCycle(sub.nextBillingDate, sub.billingCycle, sub.customDays);
    sub.deadlineDate = addCycle(sub.deadlineDate, sub.billingCycle, sub.customDays);
    persistAndRender('Abo verlängert. Der Zahlungsdrache schläft weiter.');
  }
  if (action === 'archive') {
    sub.archived = !sub.archived;
    persistAndRender(sub.archived ? 'Ins Archiv verschoben.' : 'Aus dem Archiv zurückgeholt.');
  }
  if (action === 'toggleStatus') {
    const order = ['active', 'paused', 'trial', 'cancelled'];
    sub.status = order[(order.indexOf(sub.status) + 1) % order.length];
    persistAndRender('Status geändert. Menschen lieben Dropdown-Zirkus.');
  }
  if (action === 'delete') {
    subscriptions = subscriptions.filter(s => s.id !== id);
    persistAndRender('Abo gelöscht. Radikal, aber sauber.');
  }
}

function fillForm(sub) {
  for (const key of ['id','name','category','price','currency','billingCycle','customDays','nextBillingDate','deadlineDate','website','tags','graceDays','status','notes']) {
    const el = document.getElementById(key === 'id' ? 'subscriptionId' : key);
    if (el) el.value = sub[key] ?? '';
  }
  document.getElementById('autoRenew').checked = !!sub.autoRenew;
  document.getElementById('notifyEnabled').checked = !!sub.notifyEnabled;
  document.getElementById('isTrial').checked = !!sub.isTrial;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function addCycle(dateStr, cycle, customDays) {
  const d = new Date(dateStr + 'T00:00:00');
  if (cycle === 'yearly') d.setFullYear(d.getFullYear() + 1);
  else if (cycle === 'weekly') d.setDate(d.getDate() + 7);
  else if (cycle === 'quarterly') d.setMonth(d.getMonth() + 3);
  else if (cycle === 'custom') d.setDate(d.getDate() + Number(customDays || 30));
  else d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0,10);
}

function cycleLabel(sub) {
  return ({ monthly: 'Monatlich', yearly: 'Jährlich', weekly: 'Wöchentlich', quarterly: 'Quartalsweise', custom: `Alle ${sub.customDays || '?'} Tage` })[sub.billingCycle];
}
function cycleUnit(sub) { return ({ monthly: 'Monat', yearly: 'Jahr', weekly: 'Woche', quarterly: 'Quartal', custom: `${sub.customDays || '?'} Tage` })[sub.billingCycle]; }
function formatDate(date) { return new Date(date + 'T00:00:00').toLocaleDateString('de-DE'); }
function daysUntil(date) {
  const one = new Date(); one.setHours(0,0,0,0);
  const two = new Date(date + 'T00:00:00');
  return Math.ceil((two - one) / 86400000);
}
function deadlineText(days, sub) {
  const suffix = sub.autoRenew ? 'Auto-Renew an' : 'Auto-Renew aus';
  if (days < 0) return `${Math.abs(days)} Tage überzogen • ${suffix}`;
  if (days === 0) return `Heute letzte Frist • ${suffix}`;
  return `${days} Tage bis zur Kündigungsfrist • ${suffix}`;
}
function euro(v){ return `${v.toFixed(2).replace('.', ',')} €`; }
function formatMoney(v, currency='EUR'){ return `${Number(v).toFixed(2).replace('.', ',')} ${currencyMap[currency] || currency}`; }
function sorter(type) {
  return {
    deadlineAsc: (a,b) => daysUntil(a.deadlineDate) - daysUntil(b.deadlineDate),
    costDesc: (a,b) => b.price - a.price,
    nameAsc: (a,b) => a.name.localeCompare(b.name, 'de'),
    billingAsc: (a,b) => daysUntil(a.nextBillingDate) - daysUntil(b.nextBillingDate)
  }[type] || (() => 0);
}
function escapeHtml(text='') { return text.replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

searchInput.addEventListener('input', renderList);
filterStatus.addEventListener('change', renderList);
filterCategory.addEventListener('change', renderList);
sortBy.addEventListener('change', renderList);

document.getElementById('resetFormBtn').addEventListener('click', () => {
  form.reset();
  document.getElementById('subscriptionId').value = '';
});

document.getElementById('duplicateBtn').addEventListener('click', () => {
  const data = getFormData();
  data.id = uid();
  data.name = data.name ? `${data.name} Kopie` : 'Kopie';
  subscriptions.unshift(enrichSubscription(data));
  persistAndRender('Duplikat erstellt. Copy-Paste, die ehrlichste Form von Produktivität.');
});

document.getElementById('demoBtn').addEventListener('click', () => {
  subscriptions = demoSubscriptions.map(s => ({ ...s, id: uid() }));
  persistAndRender('Demo-Daten geladen. Damit die App nicht leer dasteht wie ein schlechtes Versprechen.');
});

document.getElementById('backupBtn').addEventListener('click', () => downloadFile(JSON.stringify({ subscriptions, exportedAt: new Date().toISOString() }, null, 2), 'aboradar1209-backup.json', 'application/json'));

document.getElementById('exportJsonBtn').addEventListener('click', () => downloadFile(JSON.stringify(subscriptions, null, 2), 'aboradar1209-export.json', 'application/json'));

document.getElementById('exportCsvBtn').addEventListener('click', () => {
  const headers = ['id','name','category','price','currency','billingCycle','customDays','nextBillingDate','deadlineDate','website','tags','graceDays','status','autoRenew','notifyEnabled','isTrial','notes','archived'];
  const rows = [headers.join(',')].concat(subscriptions.map(s => headers.map(h => csvEscape(String(s[h] ?? ''))).join(',')));
  downloadFile(rows.join('\n'), 'aboradar1209-export.csv', 'text/csv');
});

document.getElementById('importFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  try {
    if (file.name.endsWith('.json')) {
      const data = JSON.parse(text);
      const array = Array.isArray(data) ? data : data.subscriptions;
      subscriptions = array.map(enrichSubscription);
    } else {
      subscriptions = parseCsv(text).map(enrichSubscription);
    }
    persistAndRender('Import abgeschlossen. Wenigstens kann Software manchmal gehorchen.');
  } catch (err) {
    toast('Import fehlgeschlagen. Datei prüfen.');
  }
  e.target.value = '';
});

function csvEscape(v) { return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = splitCsvLine(lines.shift());
  return lines.map(line => {
    const values = splitCsvLine(line);
    const obj = {};
    headers.forEach((h, i) => obj[h] = values[i] ?? '');
    obj.price = Number(obj.price || 0);
    obj.graceDays = Number(obj.graceDays || 0);
    obj.autoRenew = obj.autoRenew === 'true';
    obj.notifyEnabled = obj.notifyEnabled !== 'false';
    obj.isTrial = obj.isTrial === 'true';
    obj.archived = obj.archived === 'true';
    return obj;
  });
}
function splitCsvLine(line) {
  const res = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (q && line[i+1] === '"') { cur += '"'; i++; }
      else q = !q;
    } else if (ch === ',' && !q) { res.push(cur); cur = ''; }
    else cur += ch;
  }
  res.push(cur); return res;
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  URL.revokeObjectURL(a.href);
}

function applyTheme(theme) {
  document.documentElement.classList.remove('light');
  if (theme === 'light') document.documentElement.classList.add('light');
  if (theme === 'system' && window.matchMedia('(prefers-color-scheme: light)').matches) document.documentElement.classList.add('light');
}

themeSelect.addEventListener('change', () => {
  settings.theme = themeSelect.value; saveSettings(settings); applyTheme(settings.theme); renderChart();
});

function toast(message) {
  const el = document.createElement('div');
  el.className = 'toast'; el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

async function enableNotifications() {
  if (!('Notification' in window)) return toast('Benachrichtigungen werden hier nicht unterstützt. Klassischer Browser-Moment.');
  const result = await Notification.requestPermission();
  toast(result === 'granted' ? 'Benachrichtigungen aktiviert.' : 'Benachrichtigungen nicht erlaubt.');
  if ('serviceWorker' in navigator) {
    const reg = await navigator.serviceWorker.ready;
    reg.active?.postMessage({ type: 'CHECK_NOW' });
  }
}

document.getElementById('notifyBtn').addEventListener('click', enableNotifications);

function runReminderEngine() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const today = new Date().toISOString().slice(0, 10);
  let changed = false;
  subscriptions.forEach(sub => {
    if (sub.archived || !sub.notifyEnabled || sub.status === 'cancelled') return;
    const days = daysUntil(sub.deadlineDate);
    const shouldNotify = [7,3,2,1].includes(days);
    if (!shouldNotify) return;
    const key = `${today}-${days}`;
    if (sub.reminderHistory?.[key]) return;
    const body = days === 7
      ? `${sub.name}: Noch 7 Tage bis zur Kündigungsfrist am ${formatDate(sub.deadlineDate)}.`
      : `${sub.name}: Noch ${days} Tage bis zur Kündigungsfrist. Nicht wieder unnötig zahlen.`;
    new Notification('AboRadar 1209 Erinnerung', { body, icon: '1209.png', badge: '1209.png' });
    sub.reminderHistory = { ...(sub.reminderHistory || {}), [key]: true };
    changed = true;
  });
  if (changed) saveSubscriptions(subscriptions);
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      await navigator.serviceWorker.register('sw.js');
    } catch {}
  });
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.classList.remove('hidden');
});
installBtn.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installBtn.classList.add('hidden');
});

setInterval(runReminderEngine, 60 * 60 * 1000);
renderAll();
