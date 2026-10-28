const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const path=require('node:path');
test('worker precaches complete release, waits for open clients, and isolates cache cleanup',async()=>{
 const listeners={},deleted=[],cached=[];let forced=false;
 const ctx=vm.createContext({URL,Response,fetch:async()=>{throw Error('offline')},caches:{open:async()=>({addAll:async urls=>{for(const url of urls){const name=url==='./'?'index.html':url.slice(2).split('?')[0];assert.ok(fs.existsSync(path.join(__dirname,'..',name)));cached.push(url)}},match:async()=>new Response('offline release')}),keys:async()=>['other-app-cache','masterledger-offline-old','masterledger-offline-v2-7-8-security'],delete:async key=>deleted.push(key)},self:{location:{origin:'https://example.test'},registration:{scope:'https://example.test/ledger/'},clients:{claim:async()=>{}},skipWaiting:()=>{forced=true},addEventListener:(type,fn)=>listeners[type]=fn}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'..','sw.js'),'utf8'),ctx);
 let pending;listeners.install({waitUntil:p=>pending=p});await pending;assert.equal(forced,false);assert.ok(cached.includes('./vendor/xlsx-0.20.3.full.min.js'));
 listeners.activate({waitUntil:p=>pending=p});await pending;assert.deepEqual(deleted,['masterledger-offline-old']);
 let response;listeners.fetch({request:{method:'GET',url:'https://example.test/other/',mode:'navigate'},respondWith:p=>response=p});assert.equal(response,undefined);
 listeners.fetch({request:{method:'GET',url:'https://example.test/ledger/',mode:'navigate'},respondWith:p=>response=p});assert.equal(await (await response).text(),'offline release');
});
