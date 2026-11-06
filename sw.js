const CACHE_NAME = 'abu-kahlan-shell-v6';
const RUNTIME = 'abu-kahlan-cdn-v1';
const APP_SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
const CDN_HOSTS = ['cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'www.gstatic.com', 'tessdata.projectnaptha.com'];
const CDN_PRELOAD = ['https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js', 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => Promise.all(APP_SHELL.map(u => cache.add(u).catch(() => null)))));
  // تحميل مكتبات القراءة مسبقاً عند توفر الإنترنت لتعمل لاحقاً دون اتصال
  event.waitUntil(caches.open(RUNTIME).then(c => Promise.all(CDN_PRELOAD.map(u => fetch(u, {mode: 'no-cors'}).then(r => c.put(u, r)).catch(() => null)))).catch(() => null));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE_NAME && key !== RUNTIME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET') return;
  if (url.origin !== self.location.origin) {
    // مكتبات خارجية (OCR وPDF وFirebase): نسخة محفوظة للعمل دون إنترنت + تحديث بالخلفية
    if (!CDN_HOSTS.includes(url.hostname)) return;
    event.respondWith(caches.open(RUNTIME).then(async cache => {
      const cached = await cache.match(req);
      const net = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()); return res; }).catch(() => cached);
      return cached || net;
    }));
    return;
  }
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put('./index.html', copy));
      return response;
    }).catch(() => caches.match('./index.html')));
    return;
  }
  event.respondWith(caches.match(req).then(cached => cached || fetch(req)));
});
