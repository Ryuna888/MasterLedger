const CACHE="masterledger-offline-v2-3";
const LOCAL_SHELL=[
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon.png",
  "./apple-touch-icon.png"
];
const EXTERNAL_LIBS=[
  "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
  "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"
];

self.addEventListener("install",event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await cache.addAll(LOCAL_SHELL);
    // CDN取得に失敗してもアプリ本体のインストールは失敗させない。
    await Promise.allSettled(EXTERNAL_LIBS.map(async url=>{
      const res=await fetch(url,{mode:"cors"});
      if(res.ok) await cache.put(url,res.clone());
    }));
  })());
  self.skipWaiting();
});

self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET") return;
  const url=new URL(event.request.url);
  const sameOrigin=url.origin===self.location.origin;
  const isNavigation=event.request.mode==="navigate";
  const isExternalLib=EXTERNAL_LIBS.includes(event.request.url);

  // ライブラリは端末キャッシュ優先。初回取得後はオフラインで利用可能。
  if(isExternalLib){
    event.respondWith((async()=>{
      const cached=await caches.match(event.request);
      if(cached) return cached;
      try{
        const res=await fetch(event.request);
        if(res && (res.ok || res.type==="opaque")){
          const cache=await caches.open(CACHE);
          await cache.put(event.request,res.clone());
        }
        return res;
      }catch(_){
        return new Response("",{status:503,statusText:"Offline library unavailable"});
      }
    })());
    return;
  }

  // HTML起動はオンライン時に最新版確認、オフライン時は保存版。
  if(isNavigation){
    event.respondWith((async()=>{
      try{
        const res=await fetch(event.request,{cache:"no-store"});
        if(res.ok){
          const cache=await caches.open(CACHE);
          await cache.put("./index.html",res.clone());
        }
        return res;
      }catch(_){
        return (await caches.match("./index.html")) || (await caches.match("./"));
      }
    })());
    return;
  }

  // 自サイトの静的資産はキャッシュ優先。
  if(sameOrigin){
    event.respondWith((async()=>{
      const cached=await caches.match(event.request);
      if(cached) return cached;
      const res=await fetch(event.request);
      if(res.ok){
        const cache=await caches.open(CACHE);
        await cache.put(event.request,res.clone());
      }
      return res;
    })());
  }
});
