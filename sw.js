const CACHE="masterledger-offline-v2-7-asset-cashflow";
const LOCAL_SHELL=[
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon.png",
  "./apple-touch-icon.png",
  "./v27-asset-cashflow.js"
];
const EXTERNAL_LIBS=[
  "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
  "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"
];

async function withV27(res){
  if(!res)return res;
  const type=res.headers.get("content-type")||"";
  if(!type.includes("text/html"))return res;
  try{
    let html=await res.clone().text();
    if(!html.includes("v27-asset-cashflow.js")){
      html=html.replace("</body>",'<script src="./v27-asset-cashflow.js"></script>\n</body>');
    }
    const headers=new Headers(res.headers);
    headers.delete("content-length");
    return new Response(html,{status:res.status,statusText:res.statusText,headers});
  }catch(_){return res;}
}

self.addEventListener("install",event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await cache.addAll(LOCAL_SHELL);
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

  if(isNavigation){
    event.respondWith((async()=>{
      try{
        const res=await fetch(event.request,{cache:"no-store"});
        if(res.ok){
          const cache=await caches.open(CACHE);
          await cache.put("./index.html",res.clone());
        }
        return await withV27(res);
      }catch(_){
        const cached=(await caches.match("./index.html")) || (await caches.match("./"));
        return await withV27(cached);
      }
    })());
    return;
  }

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
