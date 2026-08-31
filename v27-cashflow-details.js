(()=>{
"use strict";

const cfMoney=v=>"¥"+Number(v||0).toLocaleString("ja-JP");
const cfIsCash=a=>!!a&&a.category==="asset"&&a.assetTag==="cash";
const cfLine=(e,d,c,amount,kind)=>({
  id:e.id,date:e.date,amount:Number(amount||0),kind,
  debit:d?.name||"不明",credit:c?.name||"不明",memo:e.memo||""
});

function explainableCashFlow(rows){
  const out={
    inflow:0,outflow:0,net:0,
    incomeReceipts:0,receivableRecovery:0,assetSale:0,liabilityIn:0,otherIn:0,
    expensePayments:0,assetAcquisition:0,receivableAdvance:0,liabilityRepayment:0,otherOut:0,
    details:{incomeReceipts:[],receivableRecovery:[],assetSale:[],liabilityIn:[],otherIn:[],expensePayments:[],assetAcquisition:[],receivableAdvance:[],liabilityRepayment:[],otherOut:[]}
  };
  const paidByExpense={};
  const reclassifiedByExpense={};

  rows.forEach(e=>{
    const d=accountById(e.debitAccount),c=accountById(e.creditAccount);
    const dc=cfIsCash(d),cc=cfIsCash(c);
    if(dc&&cc)return;

    if(dc){
      out.inflow+=e.amount;
      if(["sales","specialGain"].includes(c?.category)){
        out.incomeReceipts+=e.amount;out.details.incomeReceipts.push(cfLine(e,d,c,e.amount,"収入の受取"));
      }else if(c?.category==="asset"&&c?.assetTag==="receivable"){
        out.receivableRecovery+=e.amount;out.details.receivableRecovery.push(cfLine(e,d,c,e.amount,"未収入金回収"));
      }else if(c?.category==="asset"){
        out.assetSale+=e.amount;out.details.assetSale.push(cfLine(e,d,c,e.amount,"資産売却等"));
      }else if(c?.category==="liability"){
        out.liabilityIn+=e.amount;out.details.liabilityIn.push(cfLine(e,d,c,e.amount,"借入・負債増加"));
      }else{
        out.otherIn+=e.amount;out.details.otherIn.push(cfLine(e,d,c,e.amount,"その他入金"));
      }
    }

    if(cc){
      out.outflow+=e.amount;
      if(["expense","specialLoss"].includes(d?.category)){
        out.expensePayments+=e.amount;
        paidByExpense[d.id]=(paidByExpense[d.id]||0)+e.amount;
        out.details.expensePayments.push(cfLine(e,d,c,e.amount,"生活費・費用"));
      }else if(d?.category==="asset"&&d?.assetTag==="receivable"){
        out.receivableAdvance+=e.amount;out.details.receivableAdvance.push(cfLine(e,d,c,e.amount,"未収入金・立替増加"));
      }else if(d?.category==="asset"){
        out.assetAcquisition+=e.amount;out.details.assetAcquisition.push(cfLine(e,d,c,e.amount,"資産取得"));
      }else if(d?.category==="liability"){
        out.liabilityRepayment+=e.amount;out.details.liabilityRepayment.push(cfLine(e,d,c,e.amount,"借入・負債返済"));
      }else{
        out.otherOut+=e.amount;out.details.otherOut.push(cfLine(e,d,c,e.amount,"その他出金"));
      }
    }
  });

  // 費用として現金支払した後、「借：資産 / 貸：費用」で資産化した分は
  // 総出金を変えず、費用支払から資産取得へ分類だけ振り替える。
  rows.forEach(e=>{
    const d=accountById(e.debitAccount),c=accountById(e.creditAccount);
    if(!d||!c||cfIsCash(d)||cfIsCash(c))return;
    if(d.category!=="asset"||!["expense","specialLoss"].includes(c.category))return;
    const paid=paidByExpense[c.id]||0;
    const used=reclassifiedByExpense[c.id]||0;
    const shift=Math.max(0,Math.min(Number(e.amount||0),paid-used));
    if(!shift)return;

    reclassifiedByExpense[c.id]=used+shift;
    out.expensePayments-=shift;
    out.assetAcquisition+=shift;
    out.details.expensePayments.push({...cfLine(e,d,c,-shift,"資産化振替"),amount:-shift});
    out.details.assetAcquisition.push(cfLine(e,d,c,shift,"費用から資産へ振替"));
  });

  out.net=out.inflow-out.outflow;
  return out;
}

function cfDetailHTML(items){
  if(!items?.length)return '<div class="cf-empty">該当なし</div>';
  return items.map(x=>`<div class="cf-detail-line"><div><b>${escapeHTML(x.date)}</b> ${escapeHTML(x.debit)} ← ${escapeHTML(x.credit)}${x.memo?`<div class="cf-detail-memo">${escapeHTML(x.memo)}</div>`:""}</div><strong class="${x.amount<0?"cf-minus":""}">${cfMoney(x.amount)}</strong></div>`).join("");
}
function cfDetailsRow(label,key,cf){
  return `<details class="cf-breakdown"><summary><span>${label}</span><b>${cfMoney(cf[key])}</b></summary><div class="cf-detail-box">${cfDetailHTML(cf.details[key])}</div></details>`;
}

function injectCFDetailStyles(){
  if(document.getElementById("mlCFDetailStyle"))return;
  const s=document.createElement("style");s.id="mlCFDetailStyle";
  s.textContent=`
    .cf-section-title{margin:12px 0 5px;font-size:12px;font-weight:800;color:var(--muted)}
    .cf-breakdown{border-bottom:1px solid var(--line)}
    .cf-breakdown summary{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:9px 0;cursor:pointer;list-style:none;font-weight:700}
    .cf-breakdown summary::-webkit-details-marker{display:none}.cf-breakdown summary span:after{content:"  ›";color:var(--muted);font-weight:400}.cf-breakdown[open] summary span:after{content:"  ⌄"}
    .cf-detail-box{padding:0 0 8px 10px}.cf-detail-line{display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-top:1px dashed var(--line);font-size:11px;line-height:1.35}.cf-detail-line strong{white-space:nowrap}.cf-detail-memo{color:var(--muted);margin-top:2px}.cf-empty{padding:5px 0;color:var(--muted);font-size:11px}.cf-minus{color:#c62828}
    .cf-reconcile{margin-top:10px;padding:8px 10px;border-radius:9px;background:var(--soft);font-size:11px;line-height:1.55;color:var(--muted)}
    .annual-cf-compact{margin-top:3mm}.annual-cf-grid{display:grid;grid-template-columns:1fr 1fr;gap:2px 10px}.annual-cf-cell{display:flex;justify-content:space-between;gap:7px;border-bottom:1px solid var(--line);padding:3px 0;font-size:10px}.annual-cf-cell b{white-space:nowrap}
    @media print{
      .annual-cf-compact{margin-top:1.2mm!important}
      .annual-cf-compact h3{font-size:7.4pt!important;margin:1mm 0 .4mm!important}
      .annual-cf-grid{grid-template-columns:1fr 1fr!important;gap:.25mm 3mm!important}
      .annual-cf-cell{font-size:5.6pt!important;line-height:1!important;padding:.35mm 0!important;border-bottom:.3pt solid #bbb!important}
      .annual-cf-cell b{font-size:5.6pt!important}
      .annual-month .annual-cashflow{display:none!important}
    }
  `;document.head.appendChild(s);
}

function renderExplainablePL(){
  const card=document.getElementById("simpleCashFlowCard");if(!card)return;
  const range=readDateRange("plFrom","plTo");
  const cf=range&&range.from<=range.to?explainableCashFlow(periodEntries(range.from,range.to)):explainableCashFlow([]);
  const inBreak=cf.incomeReceipts+cf.receivableRecovery+cf.assetSale+cf.liabilityIn+cf.otherIn;
  const outBreak=cf.expensePayments+cf.assetAcquisition+cf.receivableAdvance+cf.liabilityRepayment+cf.otherOut;
  card.innerHTML=`<h3>簡易キャッシュフロー</h3>
    <div class="cashflow-grid"><div>入金<b>${cfMoney(cf.inflow)}</b></div><div>出金<b>${cfMoney(cf.outflow)}</b></div><div>現金増減<b class="${cf.net>0?"cashflow-positive":cf.net<0?"cashflow-negative":""}">${cfMoney(cf.net)}</b></div></div>
    <div class="cf-section-title">入金の内訳</div>
    ${cfDetailsRow("収入の受取","incomeReceipts",cf)}
    ${cfDetailsRow("未収入金回収","receivableRecovery",cf)}
    ${cfDetailsRow("資産売却等","assetSale",cf)}
    ${cfDetailsRow("借入・負債増加","liabilityIn",cf)}
    ${cfDetailsRow("その他入金","otherIn",cf)}
    <div class="cf-section-title">出金の内訳</div>
    ${cfDetailsRow("生活費・費用の支払","expensePayments",cf)}
    ${cfDetailsRow("資産取得による支出","assetAcquisition",cf)}
    ${cfDetailsRow("未収入金・立替の増加","receivableAdvance",cf)}
    ${cfDetailsRow("借入・負債返済","liabilityRepayment",cf)}
    ${cfDetailsRow("その他出金","otherOut",cf)}
    <div class="cf-reconcile">検算：入金内訳 ${cfMoney(inBreak)} ＝ 入金 ${cfMoney(cf.inflow)} ／ 出金内訳 ${cfMoney(outBreak)} ＝ 出金 ${cfMoney(cf.outflow)} ／ 入金－出金 ＝ ${cfMoney(cf.net)}</div>`;
}

function annualCFCells(cf){
  const cells=[
    ["入金",cf.inflow],["出金",cf.outflow],
    ["収入受取",cf.incomeReceipts],["未収金回収",cf.receivableRecovery],
    ["資産売却等",cf.assetSale],["借入・負債増",cf.liabilityIn],
    ["その他入金",cf.otherIn],["生活費・費用",cf.expensePayments],
    ["資産取得",cf.assetAcquisition],["未収金・立替増",cf.receivableAdvance],
    ["負債返済",cf.liabilityRepayment],["その他出金",cf.otherOut],
    ["現金増減",cf.net]
  ];
  return cells.map(([l,v])=>`<div class="annual-cf-cell"><span>${l}</span><b>${cfMoney(v)}</b></div>`).join("");
}

function renderExplainableAnnual(){
  const y=Number(document.getElementById("annualYear")?.value)||new Date().getFullYear();
  const yearCF=explainableCashFlow(periodEntries(`${y}-01-01`,`${y}-12-31`));
  const summary=document.querySelector("#annualCapture .annual-summary-page");
  if(summary){
    summary.querySelector(".annual-cashflow-summary")?.remove();
    let box=summary.querySelector(".annual-cf-summary-detail");
    if(!box){box=document.createElement("div");box.className="report-card annual-cf-summary-detail";summary.appendChild(box);}
    box.innerHTML=`<h3>年間 簡易キャッシュフロー</h3><div class="annual-cf-grid">${annualCFCells(yearCF)}</div>`;
  }
  document.querySelectorAll("#annualCapture .annual-month").forEach((page,i)=>{
    const m=i+1,from=`${y}-${String(m).padStart(2,"0")}-01`,to=annualMonthEnd(y,m);
    const cf=explainableCashFlow(periodEntries(from,to));
    const box=page.querySelector(".annual-box:first-child");if(!box)return;
    let compact=box.querySelector(".annual-cf-compact");
    if(!compact){compact=document.createElement("div");compact.className="annual-cf-compact";box.appendChild(compact);}
    compact.innerHTML=`<h3>簡易キャッシュフロー</h3><div class="annual-cf-grid">${annualCFCells(cf)}</div>`;
  });
}

injectCFDetailStyles();
const cfPrevRenderReports=renderReports;
renderReports=function(){cfPrevRenderReports();renderExplainablePL();};
const cfPrevRenderAnnualReport=renderAnnualReport;
renderAnnualReport=function(){cfPrevRenderAnnualReport();renderExplainableAnnual();};

renderExplainablePL();
})();
