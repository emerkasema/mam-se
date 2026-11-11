// =====================================================================
// SERVICE WORKER – díky němu aplikace funguje i bez internetu.
// Uloží si soubory aplikace (ne Tvoje data – ta jsou v IndexedDB).
//
// DŮLEŽITÉ: Po každé změně souborů aplikace zvyš číslo VERZE níže.
// Telefony tak poznají, že si mají stáhnout novou verzi.
// =====================================================================

const VERZE = 'mamse-v0.10.0';

const SOUBORY = [
  './',
  'index.html',
  'styl.css',
  'manifest.webmanifest',
  'js/app.js',
  'js/slovniky.js',
  'js/uloziste.js',
  'js/oslava.js',
  'fonty/Inter-Regular.woff',
  'fonty/Inter-Medium.woff',
  'fonty/Inter-SemiBold.woff',
  'fonty/Fraunces-Medium.woff',
  'fonty/Fraunces-SemiBold.woff',
  'ikony/logo.svg',
  'ikony/ikona-192.png',
  'ikony/ikona-512.png'
];

// Instalace: uložit soubory aplikace.
self.addEventListener('install', (ev) => {
  ev.waitUntil(caches.open(VERZE).then((c) => c.addAll(SOUBORY)));
  self.skipWaiting();
});

// Aktivace: smazat staré verze.
self.addEventListener('activate', (ev) => {
  ev.waitUntil(
    caches.keys().then((klice) => Promise.all(klice.filter((k) => k !== VERZE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// Načítání: nejdřív zkusit internet (aby byla vždy nejnovější verze),
// bez internetu použít uloženou kopii.
self.addEventListener('fetch', (ev) => {
  if (ev.request.method !== 'GET') return;
  ev.respondWith(
    fetch(ev.request)
      .then((odpoved) => {
        // Uložíme si jen vlastní soubory aplikace.
        if (odpoved.ok && new URL(ev.request.url).origin === location.origin) {
          const kopie = odpoved.clone();
          caches.open(VERZE).then((c) => c.put(ev.request, kopie));
        }
        return odpoved;
      })
      .catch(() => caches.match(ev.request).then((ulozene) => ulozene || caches.match('index.html')))
  );
});
