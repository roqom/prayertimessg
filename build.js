const https = require('https');
const fs = require('fs');

const API_URL = 'https://api.prayertimes.sg/api/v1/prayer-times/today';

const PRAYER_ORDER = [
  { key: 'subuh',   name: 'Subuh'   },
  { key: 'syuruk',  name: 'Syuruk'  },
  { key: 'zohor',   name: 'Zohor'   },
  { key: 'asar',    name: 'Asar'    },
  { key: 'maghrib', name: 'Maghrib' },
  { key: 'isyak',   name: 'Isyak'   },
];

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
        } else {
          resolve(JSON.parse(body));
        }
      });
    }).on('error', reject);
  });
}

function buildMetaDescription(data) {
  const times = data.times_ampm || data.times;

  // Derive short day name in SGT from the API's gregorian date string
  // friendly_date is e.g. "25 May 2026"
  const date = new Date(data.friendly_date);
  const dayName = date.toLocaleDateString('en-SG', { weekday: 'short', timeZone: 'Asia/Singapore' });

  const timeParts = PRAYER_ORDER.map(({ key, name }) => `${name}. ${times[key]}`).join(' ; ');
  return `${dayName}, ${data.friendly_date} - ${data.hijri_date} ; ${timeParts}.`;
}

function buildFallbackItems(data) {
  const times = data.times_ampm || data.times;
  return PRAYER_ORDER.map(({ key, name }) => `        <li class="prayer-item">
          <span class="prayer-time">${times[key]}</span>
          <span class="prayer-name">${name}</span>
        </li>`).join('\n');
}

async function main() {
  console.log('Fetching today\'s prayer times...');
  const data = await fetchJSON(API_URL);
  console.log(`Got data for: ${data.friendly_date}`);

  let html = fs.readFileSync('index.html', 'utf8');

  // Patch meta description
  const metaDesc = buildMetaDescription(data);
  html = html.replace(
    /<meta name="description" content="[^"]*">/,
    `<meta name="description" content="${metaDesc}">`
  );

  // Patch Hijri date fallback
  html = html.replace(
    /(<p id="hijri-date" class="date-line">)[^<]*(<\/p>)/,
    `$1${data.hijri_date}$2`
  );

  // Patch Gregorian date fallback
  const times = data.times_ampm || data.times;
  const date = new Date(data.friendly_date);
  const dayName = date.toLocaleDateString('en-SG', { weekday: 'short', timeZone: 'Asia/Singapore' });
  html = html.replace(
    /(<p id="gregorian-date" class="date-line">)[^<]*(<\/p>)/,
    `$1${dayName}, ${data.friendly_date}$2`
  );

  // Patch prayer time list items
  const newItems = buildFallbackItems(data);
  html = html.replace(
    /(<ul id="prayer-times"[^>]*>)([\s\S]*?)(<\/ul>)/,
    `$1\n${newItems}\n      $3`
  );

  fs.writeFileSync('index.html', html, 'utf8');
  console.log('index.html patched successfully.');
  console.log(`Meta: ${metaDesc}`);
}

main().catch(err => {
  console.error('Build failed:', err.message);
  process.exit(1);
});
