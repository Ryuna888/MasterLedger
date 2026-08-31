(()=>{
"use strict";

const ASSET_TAGS=[
  ["cash","現金性資産"],
  ["financial","金融資産"],
  ["living","生活資産"],
  ["investment","投資資産"],
  ["receivable","債権資産"],
  ["restricted","拘束資産"],
  ["other","その他資産"]
];
const tagName=id=>ASSET_TAGS.find(x=>x[0]===id)?.[1]||"未分類";
const guessAssetTag=name=>{
  if(["現金・預金","電子マネー"].includes(name))return "cash";
  if(["株式・国債等","保険積立金"].includes(name))return "financial";
  if(["家電・家具","趣味用品","服飾"].includes(name))return "living";
  if(["人脈投資","教養・保健金","教養投資","子供投資"].includes(name))return "investment";
  if(["未収入金"].includes(name))return "receivable";
  if(/敷金|保証金|預け金/.test(name))return "restricted";
  return "other";
};
const money=v=>"¥"+Number(v||0).toLocaleString("ja-JP");

function normalizeAssetTags(){
  let changed=false;
  accounts.forEach(a=>{
    if(a.category==="asset"&&!a.assetTag){a.assetTag=guessAssetTag(a.name);changed=true;}
    if(a.category!=="asset"&&a.assetTag){delete a.assetTag;changed=true;}
  });
  if(changed)persist();
}

function injectStyles(){
  if(document.getElementById("mlV27Style"))return;
  const s=document.createElement("style");
  s.id="mlV27Style";
  s.textContent=`
    .asset-tag{display:inline-block;margin-top:4px;padding:2px 7px;border:1px solid var(--line);border-radius:999px;background:var(--soft);color:var(--muted);font-size:10px;font-weight:700}
    .cashflow-card .cashflow-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:8px}
    .cashflow-card .cashflow-grid>div{padding:9px 5px;border-radius:9px;background:var(--soft);text-align:center;font-size:11px}
    .cashflow-card .cashflow-grid b{display:block;margin-top:4px;font-size:15px}
    .cashflow-positive{color:#0a67d1}.cashflow-negative{color:#c62828}
    .cashflow-note{margin-top:8px;color:var(--muted);font-size:11px;line-height:1.5}
    body.theme-graphite .asset-tag,body.theme-graphite .cashflow-card .cashflow-grid>div{background:#3a3d44;color:#f5f5f7;border-color:#555861}
    @media print{.annual-cashflow .annual-minirow{font-size:6.3pt!important;padding:.5mm 0!important}.annual-cashflow h3{font-size:8.2pt!important;margin:1.5mm 0 .5mm!important}}
  `;
  document.head.appendChild(s);
}

function injectAssetTagFields(){
  const renameCard=document.querySelector("#renameAccountModal .compact-card");
  if(renameCard&&!document.getElementById("renameAssetTagRow")){
    const row=document.createElement("div");
    row.className="form-row hidden";row.id="renameAssetTagRow";
    row.innerHTML='<label>資産タグ</label><select id="renameAssetTag"></select>';
    renameCard.appendChild(row);
  }
  const addCard=document.querySelector("#addAccountModal .compact-card");
  if(addCard&&!document.getElementById("addAssetTagRow")){
    const row=document.createElement("div");
    row.className="form-row hidden";row.id="addAssetTagRow";
    row.innerHTML='<label>資産タグ</label><select id="addAssetTag"></select>';
    addCard.appendChild(row);
  }
  ["renameAssetTag","addAssetTag"].forEach(id=>{
    const el=document.getElementById(id);if(el&&!el.options.length)el.innerHTML=ASSET_TAGS.map(([v,n])=>`<option value="${v}">${n}</option>`).join("");
  });
}

function updateAssetTagVisibility(){
  const rr=document.getElementById("renameAssetTagRow");
  if(rr)rr.classList.toggle("hidden",document.getElementById("renameAccountCategory")?.value!=="asset");
  const ar=document.getElementById("addAssetTagRow");
  if(ar)ar.classList.toggle("hidden",selectedAccountCategory!=="asset");
}

function isCashAccount(a){return !!a&&a.category==="asset"&&a.assetTag==="cash";}
function cashFlowFor(rows){
  const r={inflow:0,outflow:0,net:0,assetAcquisition:0,assetSale:0,incomeReceipts:0,expensePayments:0,otherIn:0,otherOut:0};
  rows.forEach(e=>{
    const d=accountById(e.debitAccount),c=accountById(e.creditAccount);
    const dc=isCashAccount(d),cc=isCashAccount(c);
    if(dc&&cc)return;
    if(dc){
      r.inflow+=e.amount;
      if(["sales","specialGain"].includes(c?.category))r.incomeReceipts+=e.amount;
      else if(c?.category==="asset")r.assetSale+=e.amount;
      else r.otherIn+=e.amount;
    }
    if(cc){
      r.outflow+=e.amount;
      if(["expense","specialLoss"].includes(d?.category))r.expensePayments+=e.amount;
      else if(d?.category==="asset")r.assetAcquisition+=e.amount;
      else r.otherOut+=e.amount;
    }
  });
  r.net=r.inflow-r.outflow;
  return r;
}

function ensureCashFlowCard(){
  const cap=document.getElementById("plCapture");if(!cap)return null;
  let card=document.getElementById("simpleCashFlowCard");
  if(!card){
    card=document.createElement("div");card.id="simpleCashFlowCard";card.className="report-card cashflow-card";
    cap.appendChild(card);
  }
  return card;
}
function renderCashFlowCard(){
  const card=ensureCashFlowCard();if(!card)return;
  const range=readDateRange("plFrom","plTo");
  const cf=range&&range.from<=range.to?cashFlowFor(periodEntries(range.from,range.to)):cashFlowFor([]);
  const cls=cf.net>0?"cashflow-positive":cf.net<0?"cashflow-negative":"";
  card.innerHTML=`<h3>簡易キャッシュフロー</h3>
    <div class="cashflow-grid"><div>入金<b>${money(cf.inflow)}</b></div><div>出金<b>${money(cf.outflow)}</b></div><div>現金増減<b class="${cls}">${money(cf.net)}</b></div></div>
    <div class="row"><span>収入の受取</span><b>${money(cf.incomeReceipts)}</b></div>
    <div class="row"><span>生活費・費用の支払</span><b>${money(cf.expensePayments)}</b></div>
    <div class="row"><span>資産取得による支出</span><b>${money(cf.assetAcquisition)}</b></div>
    <div class="row"><span>資産売却・回収による入金</span><b>${money(cf.assetSale)}</b></div>
    <div class="cashflow-note">「現金性資産」タグを付けた科目の増減から集計します。現金・預金⇄電子マネーなど、現金性資産どうしの振替は相殺して除外します。</div>`;
}

function augmentAnnualReport(){
  const y=Number(document.getElementById("annualYear")?.value)||new Date().getFullYear();
  const yearFrom=`${y}-01-01`,yearTo=`${y}-12-31`;
  const annualCf=cashFlowFor(periodEntries(yearFrom,yearTo));
  const summary=document.querySelector("#annualCapture .annual-summary-page");
  if(summary){
    const old=summary.querySelector(".annual-cashflow-summary");if(old)old.remove();
    const card=document.createElement("div");card.className="report-card annual-cashflow-summary";
    card.innerHTML=`<h3>年間 簡易キャッシュフロー</h3>
      <div class="row"><span>入金</span><b>${money(annualCf.inflow)}</b></div>
      <div class="row"><span>出金</span><b>${money(annualCf.outflow)}</b></div>
      <div class="row total-row"><span>現金増減</span><b>${money(annualCf.net)}</b></div>
      <div class="row"><span>資産取得</span><b>${money(annualCf.assetAcquisition)}</b></div>
      <div class="row"><span>資産売却・回収</span><b>${money(annualCf.assetSale)}</b></div>`;
    summary.appendChild(card);
  }
  document.querySelectorAll("#annualCapture .annual-month").forEach((page,i)=>{
    const box=page.querySelector(".annual-box:first-child");if(!box)return;
    box.querySelector(".annual-cashflow")?.remove();
    const m=i+1,from=`${y}-${String(m).padStart(2,"0")}-01`,to=annualMonthEnd(y,m),cf=cashFlowFor(periodEntries(from,to));
    const wrap=document.createElement("div");wrap.className="annual-table annual-cashflow";
    wrap.innerHTML=`<h3>簡易キャッシュフロー</h3>
      <div class="annual-minirow"><span>入金</span><b>${money(cf.inflow)}</b></div>
      <div class="annual-minirow"><span>出金</span><b>${money(cf.outflow)}</b></div>
      <div class="annual-minirow total"><span>現金増減</span><b>${money(cf.net)}</b></div>`;
    box.appendChild(wrap);
  });
}

injectStyles();
injectAssetTagFields();
normalizeAssetTags();

const oldUpdateLiabilityMemoVisibility=updateLiabilityMemoVisibility;
updateLiabilityMemoVisibility=function(){oldUpdateLiabilityMemoVisibility();updateAssetTagVisibility();};
document.getElementById("renameAccountCategory")?.addEventListener("change",updateAssetTagVisibility);

const oldOpenAccountRename=openAccountRename;
openAccountRename=function(id){
  oldOpenAccountRename(id);injectAssetTagFields();
  const a=accountById(id);if(a?.category==="asset")document.getElementById("renameAssetTag").value=a.assetTag||guessAssetTag(a.name);
  updateAssetTagVisibility();
};
const oldSaveAccountRename=saveAccountRename;
saveAccountRename=function(){
  const a=accountById(renamingAccountId);
  if(a&&document.getElementById("renameAccountCategory")?.value==="asset")a.assetTag=document.getElementById("renameAssetTag")?.value||"other";
  else if(a)delete a.assetTag;
  oldSaveAccountRename();
};
const oldOpenAddAccount=openAddAccount;
openAddAccount=function(){oldOpenAddAccount();injectAssetTagFields();if(selectedAccountCategory==="asset")document.getElementById("addAssetTag").value="other";updateAssetTagVisibility();};
const oldSaveNewAccount=saveNewAccount;
saveNewAccount=function(){
  const before=new Set(accounts.map(a=>a.id));
  oldSaveNewAccount();
  if(selectedAccountCategory==="asset"){
    const a=accounts.find(x=>!before.has(x.id));
    if(a){a.assetTag=document.getElementById("addAssetTag")?.value||guessAssetTag(a.name);persist();renderAll();}
  }
};

const oldRenderAccountList=renderAccountList;
renderAccountList=function(){
  oldRenderAccountList();
  accounts.filter(a=>a.category==="asset").forEach(a=>{
    const main=document.querySelector(`#accountList .swipe-wrap[data-id="${CSS.escape(a.id)}"] .account-main`);
    if(main&&!main.querySelector(".asset-tag")){
      const tag=document.createElement("span");tag.className="asset-tag";tag.textContent=tagName(a.assetTag);main.appendChild(tag);
    }
  });
};

const oldRenderReports=renderReports;
renderReports=function(){oldRenderReports();renderCashFlowCard();};
const oldRenderAnnualReport=renderAnnualReport;
renderAnnualReport=function(){oldRenderAnnualReport();augmentAnnualReport();};

normalizeAssetTags();
renderAll();
})();
