const V = 'classpilot-v3';
const SHELL = ['./', 'index.html', 'firebase-config.js', 'manifest.json', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(V)
      .then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== V).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const timed = req => new Promise((res, rej) => {
  const t = setTimeout(rej, 4000);
  fetch(req).then(r => { clearTimeout(t); res(r); }, err => { clearTimeout(t); rej(err); });
});

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);

  // Never touch live Firebase data/auth calls
  if (u.hostname.endsWith('googleapis.com') && u.hostname !== 'fonts.googleapis.com') return;
  if (u.hostname.endsWith('firebaseio.com') || u.hostname.endsWith('firebaseapp.com')) return;

  // Your own files: network first, cached copy when offline
  if (u.origin === self.location.origin) {
    e.respondWith(
      timed(r)
        .then(res => {
          if (res.ok) { const copy = res.clone(); caches.open(V).then(c => c.put(r, copy)); }
          return res;
        })
        .catch(() =>
          caches.match(r, { ignoreSearch: true }).then(m =>
            m || (r.mode === 'navigate' ? caches.match('index.html') : Response.error())
          )
        )
    );
    return;
  }

  // Fonts and Firebase scripts: cached copy first, refreshed in the background
  e.respondWith(
    caches.open(V).then(async c => {
      const m = await c.match(r);
      const f = fetch(r)
        .then(res => { if (res.ok || res.type === 'opaque') c.put(r, res.clone()); return res; })
        .catch(() => m);
      return m || f;
    })
  );
});