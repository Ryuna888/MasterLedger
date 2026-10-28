const CACHE="masterledger-offline-v2-7-8-security";
const LOCAL_SHELL=["./","./index.html","./manifest.webmanifest","./icon.png","./apple-touch-icon.png",
  "./vendor/html2canvas-1.4.1.min.js","./vendor/jspdf-4.2.1.umd.min.js","./vendor/xlsx-0.20.3.full.min.js",
  "./v27-asset-cashflow.js?v=2.7.8","./v27-cashflow-reclass-fix.js?v=2.7.8","./v27-cashflow-details.js?v=2.7.8",
  "./v27-polish.js?v=2.7.8","./v27-live-date-fix.js?v=2.7.8"];
self.addEventListener("install",event=>{
  event.waitUntil((async()=>{const cache=await caches.open(CACHE);await cache.addAll(LOCAL_SHELL);})());
  // Do not replace a worker while users still have an older app open.
});
self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k.startsWith("masterledger-offline-")&&k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope))return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    if(event.request.mode==="navigate"){
      try{
        const res=await fetch(event.request,{cache:"no-store"});
        if(res.ok)await cache.put("./index.html",res.clone());
        return res;
      }catch(_){return (await cache.match("./index.html"))||new Response("Offline",{status:503});}
    }
    const cached=await cache.match(event.request);
    if(cached)return cached;
    return fetch(event.request);
  })());
});
