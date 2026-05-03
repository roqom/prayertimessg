const API_URL = 'https://api.prayertimes.sg/api/v1/prayer-times/today';

const PRAYER_ORDER = [
  { key: 'subuh', name: 'Subuh' },
  { key: 'syuruk', name: 'Syuruk' },
  { key: 'zohor', name: 'Zohor' },
  { key: 'asar', name: 'Asar' },
  { key: 'maghrib', name: 'Maghrib' },
  { key: 'isyak', name: 'Isyak' },
];

function localYYYYMMDD() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

async function fetchPrayerTimes(forceRefresh = false) {
  // Normal load: use cache for fast repeat visits throughout the day
  // Date-change refresh: add date parameter to bypass Firefox cache at midnight
  // Uses daily cache-bust (same URL all day) instead of timestamp for better caching
  const url = forceRefresh ? `${API_URL}?d=${localYYYYMMDD()}` : API_URL;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function renderDates(data) {
  const hijriEl = document.getElementById('hijri-date');
  const gregorianEl = document.getElementById('gregorian-date');
  if (hijriEl) hijriEl.textContent = data.hijri_date;
  if (gregorianEl) gregorianEl.textContent = data.friendly_date;
}

function renderPrayerTimes(data) {
  const list = document.getElementById('prayer-times');
  if (!list) return;

  const times = data.times_ampm || data.times;
  list.innerHTML = PRAYER_ORDER.map(({ key, name }) => {
    const time = times[key];
    if (!time) return '';

    const [, timeValue, period] = time.match(/^(\d{1,2}:\d{2})\s+(AM|PM)$/i) || [null, time, ''];
    const timeHtml = period
      ? `<span class="prayer-time-value">${timeValue}</span><span class="prayer-time-period">${period}</span>`
      : `<span class="prayer-time-value">${time}</span>`;

    return `<li class="prayer-item"><span class="prayer-time">${timeHtml}</span><span class="prayer-name">${name}</span></li>`;
  }).join('');
}

function showLoading() {
  const hijriEl = document.getElementById('hijri-date');
  const gregorianEl = document.getElementById('gregorian-date');
  const list = document.getElementById('prayer-times');
  if (hijriEl) hijriEl.textContent = 'Loading...';
  if (gregorianEl) gregorianEl.textContent = '';
  if (list) list.innerHTML = '<li class="prayer-item" style="opacity: 0.5;">Loading prayer times...</li>';
}

function showError(message) {
  const hijriEl = document.getElementById('hijri-date');
  const gregorianEl = document.getElementById('gregorian-date');
  const list = document.getElementById('prayer-times');
  if (hijriEl) hijriEl.textContent = 'Unable to load';
  if (gregorianEl) gregorianEl.textContent = message;
  if (list) list.innerHTML = '';
}

let lastKnownDate = new Date().toDateString();

function hasDateChanged() {
  const currentDate = new Date().toDateString();
  if (currentDate !== lastKnownDate) {
    lastKnownDate = currentDate;
    return true;
  }
  return false;
}

function getMillisecondsUntilMidnight() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight - now;
}

function scheduleMidnightRefresh() {
  const msUntilMidnight = getMillisecondsUntilMidnight();
  setTimeout(() => {
    init(true); // Force refresh at midnight (cache-busting for Firefox)
    scheduleMidnightRefresh(); // Schedule next refresh
  }, msUntilMidnight);
}

// Periodic date check - works even in background tabs
function startDateCheckInterval() {
  setInterval(() => {
    if (hasDateChanged()) {
      init(true); // Force refresh when date changed (cache-busting for Firefox)
    }
  }, 60000); // Check every minute
}

async function init(forceRefresh = false) {
  showLoading();
  try {
    const data = await fetchPrayerTimes(forceRefresh);
    renderDates(data);
    renderPrayerTimes(data);
    lastKnownDate = new Date().toDateString(); // Update last known date
  } catch {
    const msg = window.location.protocol === 'file:'
      ? 'Open via a local server (see below), not as a file.'
      : 'Check your connection and refresh.';
    showError(msg);
    
    const card = document.querySelector('.card');
    if (card && !card.querySelector('.server-hint')) {
      const hint = document.createElement('p');
      hint.className = 'server-hint';
      hint.innerHTML = 'Run <code>python3 -m http.server 3000</code> or <code>npx serve</code> in this folder, then open <code>http://localhost:3000</code>';
      card.appendChild(hint);
    }
  }
}

// Initial load
init();

// Schedule midnight refresh (for active tabs)
scheduleMidnightRefresh();

// Periodic date check (works even in background tabs)
startDateCheckInterval();

// Track last time tab was visible (for detecting long absences)
let lastVisibleTime = Date.now();

// Refresh when page becomes visible (more aggressive for mobile reliability)
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    const timeSinceLastVisible = Date.now() - lastVisibleTime;
    
    // Refresh if: away for more than 5 minutes OR date changed
    // This catches mobile tab restore and bfcache edge cases
    if (timeSinceLastVisible > 300000 || hasDateChanged()) {
      init(true); // Force refresh with cache-busting
    }
    
    lastVisibleTime = Date.now();
  }
});