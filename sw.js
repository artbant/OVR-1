const CACHE = 'ovr-sea-v1';
const STATIC = [
  './',
  './ovr.html',
  'https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
];

// Install — cache static assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => {
      return Promise.allSettled(
        STATIC.map(url => cache.add(url).catch(() => {}))
      );
    })
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch strategy:
// - API calls (weather/marine/nominatim): network first, fall back to cache
// - Static assets: cache first
self.addEventListener('fetch', e => {
  const url = e.request.url;

  const isAPI =
    url.includes('open-meteo.com') ||
    url.includes('marine-api.open-meteo.com') ||
    url.includes('swpc.noaa.gov') ||
    url.includes('nominatim.openstreetmap.org') ||
    url.includes('opensky-network.org') ||
    url.includes('overpass-api.de');

  if (isAPI) {
    // Network first, cache fallback
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(cache => cache.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Static: cache first
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

// Receive message from page to store last-known data snapshot
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SAVE_SNAPSHOT') {
    caches.open(CACHE).then(cache => {
      const blob = new Blob([JSON.stringify(e.data.payload)], {type: 'application/json'});
      const res = new Response(blob, {headers: {'Content-Type': 'application/json'}});
      cache.put('__snapshot__', res);
    });
  }
});
