const CACHE="masterledger-homescreen-v1-8";
const APP_SHELL=["./manifest.webmanifest","./icon.png","./apple-touch-icon.png"];

self.addEventListener("install",event=>{
  event.waitUntil(
    caches.open(CACHE).then(cache=>cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys().then(keys=>
      Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET") return;

  const url=new URL(event.request.url);
  const sameOrigin=url.origin===location.origin;
  const isNavigation=event.request.mode==="navigate";
  const isIndex=sameOrigin && (url.pathname.endsWith("/") || url.pathname.endsWith("/index.html"));

  // HTML / app launch: network-first.
  // GitHub Pagesの最新版を優先し、失敗時だけキャッシュへフォールバック。
  if(isNavigation || isIndex){
    event.respondWith(
      fetch(event.request, {cache:"no-store"})
        .then(response=>{
          const copy=response.clone();
          caches.open(CACHE).then(cache=>cache.put("./index.html",copy));
          return response;
        })
        .catch(()=>caches.match("./index.html"))
    );
    return;
  }

  // 同一オリジンの静的ファイル: cache-first
  if(sameOrigin){
    event.respondWith(
      caches.match(event.request).then(cached=>
        cached || fetch(event.request).then(response=>{
          const copy=response.clone();
          caches.open(CACHE).then(cache=>cache.put(event.request,copy));
          return response;
        })
      )
    );
    return;
  }

  // CDNライブラリは従来どおり取得。仕訳データは送信しない。
  event.respondWith(fetch(event.request));
});
