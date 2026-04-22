const CACHE_NAME = 'pdfly-v1.0.0';
const OFFLINE_URL = '/offline.html';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdn.jsdelivr.net/npm/sortablejs@1.15.2/Sortable.min.js',
  'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=Inter:wght@300;400;500;600;700&display=swap'
];

self.addEventListener('install', event => {
  console.log('[SW] Installing Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', event => {
  console.log('[SW] Activating Service Worker...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

function isHtmlRequest(request) {
  return request.headers.get('accept')?.includes('text/html') ||
         request.url === self.location.origin + '/' ||
         !request.url.match(/\.(js|css|png|jpg|jpeg|gif|svg|webp|ico|json|woff2?|ttf|eot)$/i);
}

async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }
  } catch (error) {
    console.log('[SW] Network request failed, falling back to cache');
  }
  
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  if (isHtmlRequest(request)) {
    return caches.match(OFFLINE_URL);
  }
  
  return new Response('Offline content not available', {
    status: 404,
    statusText: 'Not Found'
  });
}

async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }
  } catch (error) {}
  
  return new Response('Asset not found', { status: 404 });
}

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  if (url.origin !== self.location.origin && 
      !url.hostname.includes('cdnjs') && 
      !url.hostname.includes('fonts') &&
      !url.hostname.includes('gstatic')) {
    return;
  }
  
  if (url.pathname.match(/\.(js|css|json)$/i) || 
      url.pathname === '/' || 
      url.pathname === '/index.html' ||
      url.pathname === '/offline.html') {
    event.respondWith(cacheFirst(event.request));
    return;
  }
  
  event.respondWith(networkFirst(event.request));
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});