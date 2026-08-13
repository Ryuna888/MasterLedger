const CACHE="masterledger-homescreen-v1";
const APP_SHELL=["./","./index.html","./manifest.webmanifest","./icon.svg"];

self.addEventListener("install",event=>{
  event.waitUntil(
    caches.open(CACHE).then(cache=>cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET") return;
  const url=new URL(event.request.url);

  // App files: cache-first for fast home-screen launch.
  if(url.origin===location.origin){
    event.respondWith(
      caches.match(event.request).then(cached=>{
        return cached || fetch(event.request).then(response=>{
          const copy=response.clone();
          caches.open(CACHE).then(cache=>cache.put(event.request,copy));
          return response;
        });
      })
    );
    return;
  }

  // Existing Excel/image libraries may be CDN-hosted.
  // They are never sent ledger data; they are loaded as code only.
  event.respondWith(fetch(event.request));
});
