const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');
const {JSDOM,ResourceLoader,VirtualConsole}=require('jsdom');
const {IDBFactory}=require('fake-indexeddb');
const root=path.resolve(__dirname,'..');
const accounts=[{id:'cash',name:'現金・預金',category:'asset',subs:[]},{id:'food',name:'食費',category:'expense',subs:[{id:'sub',name:'通常'}]}];
const entries=[{id:123,date:'2026-10-01',amount:100,debitAccount:'food',creditAccount:'cash',debitSub:'sub',creditSub:'',memo:'既存データ'}];
class Local extends ResourceLoader{fetch(url){const name=new URL(url).pathname.replace(/^\//,'');return Promise.resolve(fs.readFileSync(path.join(root,name)));}}
async function dbWrite(db,key,value){await new Promise((resolve,reject)=>{const req=db.open('MasterLedgerPrivate',1);req.onupgradeneeded=()=>req.result.createObjectStore('ledger');req.onsuccess=()=>{const conn=req.result,tx=conn.transaction('ledger','readwrite');tx.objectStore('ledger').put(value,key);tx.oncomplete=()=>{conn.close();resolve()};tx.onerror=()=>reject(tx.error)};});}
async function boot({local=true,recovery,partial=false,localEntries=entries,localAccounts=accounts}={}){
 const db=new IDBFactory();if(recovery)await dbWrite(db,'ledger',recovery);
 const errors=[],alerts=[];
 const vc=new VirtualConsole();vc.on('jsdomError',e=>{if(!e.message.includes('canvas'))errors.push(e.message)});
 const dom=new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'),{url:'https://ledger.test/',runScripts:'dangerously',resources:new Local(),pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
 w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;w.indexedDB=db;w.structuredClone=structuredClone;w.alert=m=>alerts.push(m);w.confirm=()=>true;w.CSS={escape:v=>v};
 if(local){w.localStorage.setItem('ml_v02_accounts',JSON.stringify(localAccounts));if(!partial)w.localStorage.setItem('ml_v02_entries',JSON.stringify(localEntries));}
 }});
 const w=dom.window;
 await new Promise(resolve=>w.addEventListener('load',resolve,{once:true}));
 for(let i=0;i<100&&!w.eval('storageReady')&&!alerts.length;i++)await new Promise(r=>setTimeout(r,10));
 return {w,dom,errors,alerts};
}
async function importRows(w,rows){const wb=w.XLSX.utils.book_new();w.XLSX.utils.book_append_sheet(wb,w.XLSX.utils.aoa_to_sheet([['日付','金額','借方・勘定科目','貸方・勘定科目','借方・補助科目','メモ'],...rows]));const data=w.XLSX.write(wb,{type:'array',bookType:'xlsx'});return w.importLedgerFile({size:data.byteLength,arrayBuffer:async()=>data});}
test('existing storage remains byte-identical and recovery snapshot is kept',async()=>{const {w,dom,errors}=await boot();try{assert.equal(w.localStorage.getItem('ml_v02_entries'),JSON.stringify(entries));assert.equal(w.localStorage.getItem('ml_v02_accounts'),JSON.stringify(accounts));assert.equal((await w.idbGet('before-v2.7.8')).entries[0].memo,'既存データ');assert.equal(w.XLSX.version,'0.20.3');assert.deepEqual(errors,[]);}finally{dom.window.close()}});
test('IDB-only data restores without startup overwrite',async()=>{const {w,dom}=await boot({local:false,recovery:{accounts,entries}});try{assert.equal(JSON.parse(w.localStorage.getItem('ml_v02_entries'))[0].id,123);assert.equal((await w.idbGet('ledger')).entries.length,1);}finally{dom.window.close()}});
test('partial local data fails closed and preserves recovery',async()=>{const {w,dom,alerts}=await boot({partial:true,recovery:{accounts,entries}});try{assert.equal(w.eval('storageReady'),false);assert.equal(w.localStorage.getItem('ml_v02_entries'),null);await w.openMLDB();assert.equal((await w.idbGet('ledger')).entries.length,1);assert.ok(alerts.length);}finally{dom.window.close()}});
test('untrusted workbook fields stay literal across list, accounts and reports',async()=>{const {w,dom}=await boot();try{const payload='<img src=x onerror="window.pwned=1">';await importRows(w,[['2026-10-01',5,payload,'現金・預金',payload,payload]]);w.document.getElementById('from').value='2026-10-01';w.document.getElementById('to').value='2026-10-31';w.renderAll();w.openCategory('expense');const acc=w.eval('accounts').find(a=>a.name===payload);w.openSubModal(acc.id);w.showAccountReport(acc.id,'pl');assert.equal(w.document.querySelectorAll('#entries img,#accountList img,#subModalList img,#accountSubDetail img').length,0);assert.ok(w.document.getElementById('entries').textContent.includes(payload));assert.equal(w.pwned,undefined);assert.equal(JSON.parse(w.localStorage.getItem('ml_v02_entries')).length,2);assert.ok(w.document.querySelector('#about h3').textContent.includes('2.7.8'));}finally{dom.window.close()}});
test('invalid import is atomic and limits reject before parse',async()=>{const {w,dom}=await boot();try{for(const amount of ['Infinity',-1,0,1.5,9007199254740992]){await assert.rejects(importRows(w,[['2026-10-01',5,'新規','現金・預金','','ok'],['2026-10-01',amount,'食費','現金・預金','','bad']]));assert.equal(w.eval('entries.length'),1);assert.equal(w.eval('accounts.length'),2);}await assert.rejects(importRows(w,[['2026-02-30',5,'食費','現金・預金','','bad']]));await assert.rejects(w.importLedgerFile({size:11*1024*1024}));assert.equal(w.localStorage.getItem('ml_v02_entries'),JSON.stringify(entries));}finally{dom.window.close()}});
test('CSV neutralizes formulas; Excel preserves original strings and entries',async()=>{const {w,dom}=await boot();try{w.eval('entries[0].memo="=1+1"');let file;w.File=class extends File{constructor(bits,name,options){super(bits.map(b=>b instanceof w.ArrayBuffer?new Uint8Array(b):b),name,options)}};w.offerFile=async f=>{file=f};await w.exportCSV();assert.ok((await file.text()).includes('"\'=1+1"'));await w.exportExcel();const wb=w.XLSX.read(new w.Uint8Array(await file.arrayBuffer()),{type:'array'});const row=w.XLSX.utils.sheet_to_json(wb.Sheets['仕訳帳'])[0];assert.equal(row['メモ'],'=1+1');assert.equal(wb.Sheets['仕訳帳'].G2.t,'s');assert.equal(row['金額'],100);}finally{dom.window.close()}});

test('reopening preserves existing untrusted strings as text without rewriting storage',async()=>{
 const unsafe=structuredClone(entries);unsafe[0].memo='<svg onload="window.pwned=1">';
 const {w,dom}=await boot({localEntries:unsafe});try{
 w.document.getElementById('from').value='2026-10-01';w.document.getElementById('to').value='2026-10-31';w.renderAll();
 assert.equal(w.document.querySelectorAll('#entries svg').length,0);assert.equal(w.localStorage.getItem('ml_v02_entries'),JSON.stringify(unsafe));assert.equal(w.pwned,undefined);
 }finally{dom.window.close()}
});
