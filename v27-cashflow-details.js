(()=>{
"use strict";

const cfMoney=v=>"¥"+Number(v||0).toLocaleString("ja-JP");
const cfIsCash=a=>!!a&&a.category==="asset"&&a.assetTag==="cash";

function summarizeCashFlow(rows){
  const out={
    inflow:0,outflow:0,net:0,
    incomeReceipts:0,receivableRecovery:0,assetSale:0,liabilityIn:0,otherIn:0,
    expensePayments:0,assetAcquisition:0,receivableAdvance:0,liabilityRepayment:0,otherOut:0
  };
  const paidByExpense={};
  const reclassifiedByExpense={};

  rows.forEach(e=>{
    const d=accountById(e.debitAccount),c=accountById(e.creditAccount);
    const dc=cfIsCash(d),cc=cfIsCash(c);
    if(dc&&cc)return;

    if(dc){
      out.inflow+=e.amount;
      if(["sales","specialGain"].includes(c?.category))out.incomeReceipts+=e.amount;
      else if(c?.category==="asset"&&c?.assetTag==="receivable")out.receivableRecovery+=e.amount;
      else if(c?.category==="asset")out.assetSale+=e.amount;
      else if(c?.category==="liability")out.liabilityIn+=e.amount;
      else out.otherIn+=e.amount;
    }

    if(cc){
      out.outflow+=e.amount;
      if(["expense","specialLoss"].includes(d?.category)){
        out.expensePayments+=e.amount;
        paidByExpense[d.id]=(paidByExpense[d.id]||0)+e.amount;
      }else if(d?.category==="asset"&&d?.assetTag==="receivable")out.receivableAdvance+=e.amount;
      else if(d?.category==="asset")out.assetAcquisition+=e.amount;
      else if(d?.category==="liability")out.liabilityRepayment+=e.amount;
      else out.otherOut+=e.amount;
    }
  });

  // 費用として支払った後、「借：資産 / 貸：費用」で資産化した分は
  // 出金総額を変えず、生活費・費用→資産取得へ分類だけ振り替える。
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
  });

  out.net=out.inflow-out.outflow;
  return out;
}

function injectSimpleCFStyles(){
  if(document.getElementById("mlCFSimpleStyle"))return;
  document.getElementById("mlCFDetailStyle")?.remove();
  const s=document.createElement("style");
  s.id="mlCFSimpleStyle";
  s.textContent=`
    .cf-section-title{margin:12px 0 5px;font-size:12px;font-weight:800;color:var(--muted)}
    .cf-summary-row{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:8px 0;border-bottom:1px solid var(--line);font-size:13px;font-weight:700}
    .cf-summary-row b{white-space:nowrap}.cf-summary-row.total{border-top:1px solid var(--line);font-weight:800}
    .cf-reconcile{margin-top:10px;padding:8px 10px;border-radius:9px;background:var(--soft);font-size:11px;line-height:1.55;color:var(--muted)}
    .annual-cf-compact{margin-top:8px;border-top:1px solid var(--line);padding-top:6px}
    .annual-cf-columns{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .annual-cf-col{min-width:0}.annual-cf-col h4{margin:0 0 4px;font-size:10px;color:var(--muted)}
    .annual-cf-row{display:flex;justify-content:space-between;gap:8px;padding:3px 0;border-bottom:1px solid var(--line);font-size:10px;line-height:1.2}
    .annual-cf-row b{white-space:nowrap}.annual-cf-row.total{font-weight:800;border-top:1px solid var(--line)}
    .annual-cf-net{display:flex;justify-content:space-between;gap:8px;margin-top:5px;padding-top:4px;border-top:1.5px solid var(--text);font-size:11px;font-weight:900}
    @media print{
      .annual-month .annual-cashflow{display:none!important}
      .annual-month .annual-cols{height:151mm!important}
      .annual-cf-compact{margin:1.3mm 0 0!important;padding-top:.8mm!important;border-top:.7pt solid #222!important;break-inside:avoid!important;page-break-inside:avoid!important}
      .annual-cf-compact h3{font-size:7pt!important;margin:0 0 .7mm!important}
      .annual-cf-columns{grid-template-columns:1fr 1fr!important;gap:4mm!important}
      .annual-cf-col h4{font-size:5.9pt!important;margin:0 0 .35mm!important;color:#444!important}
      .annual-cf-row{font-size:5.5pt!important;line-height:1!important;padding:.35mm 0!important;border-bottom:.3pt solid #bbb!important}
      .annual-cf-row b{font-size:5.5pt!important}
      .annual-cf-net{font-size:5.9pt!important;line-height:1!important;margin-top:.55mm!important;padding-top:.5mm!important;border-top:.7pt solid #222!important}
    }
  `;
  document.head.appendChild(s);
}

function cfRow(label,value,cls=""){
  return `<div class="cf-summary-row ${cls}"><span>${label}</span><b>${cfMoney(value)}</b></div>`;
}

function renderSimplePL(){
  const card=document.getElementById("simpleCashFlowCard");if(!card)return;
  const range=readDateRange("plFrom","plTo");
  const cf=range&&range.from<=range.to?summarizeCashFlow(periodEntries(range.from,range.to)):summarizeCashFlow([]);
  const inBreak=cf.incomeReceipts+cf.receivableRecovery+cf.assetSale+cf.liabilityIn+cf.otherIn;
  const outBreak=cf.expensePayments+cf.assetAcquisition+cf.receivableAdvance+cf.liabilityRepayment+cf.otherOut;

  card.innerHTML=`<h3>簡易キャッシュフロー</h3>
    <div class="cashflow-grid"><div>入金<b>${cfMoney(cf.inflow)}</b></div><div>出金<b>${cfMoney(cf.outflow)}</b></div><div>現金増減<b class="${cf.net>0?"cashflow-positive":cf.net<0?"cashflow-negative":""}">${cfMoney(cf.net)}</b></div></div>
    <div class="cf-section-title">入金の内訳</div>
    ${cfRow("収入の受取",cf.incomeReceipts)}
    ${cfRow("未収入金回収",cf.receivableRecovery)}
    ${cfRow("資産売却等",cf.assetSale)}
    ${cfRow("借入・負債増加",cf.liabilityIn)}
    ${cfRow("その他入金",cf.otherIn)}
    ${cfRow("入金内訳合計",inBreak,"total")}
    <div class="cf-section-title">出金の内訳</div>
    ${cfRow("生活費・費用の支払",cf.expensePayments)}
    ${cfRow("資産取得による支出",cf.assetAcquisition)}
    ${cfRow("未収入金・立替の増加",cf.receivableAdvance)}
    ${cfRow("借入・負債返済",cf.liabilityRepayment)}
    ${cfRow("その他出金",cf.otherOut)}
    ${cfRow("出金内訳合計",outBreak,"total")}
    <div class="cf-reconcile">検算：入金内訳 ${cfMoney(inBreak)} ＝ 入金 ${cfMoney(cf.inflow)} ／ 出金内訳 ${cfMoney(outBreak)} ＝ 出金 ${cfMoney(cf.outflow)} ／ 入金－出金 ＝ ${cfMoney(cf.net)}</div>`;
}

function annualCFRow(label,value,hideZero=true){
  if(hideZero&&Number(value||0)===0)return "";
  return `<div class="annual-cf-row"><span>${label}</span><b>${cfMoney(value)}</b></div>`;
}

function annualCFHTML(cf,hideZero=true){
  return `<div class="annual-cf-columns">
    <div class="annual-cf-col"><h4>入金の部</h4>
      ${annualCFRow("収入の受取",cf.incomeReceipts,hideZero)}
      ${annualCFRow("未収入金回収",cf.receivableRecovery,hideZero)}
      ${annualCFRow("資産売却等",cf.assetSale,hideZero)}
      ${annualCFRow("借入・負債増加",cf.liabilityIn,hideZero)}
      ${annualCFRow("その他入金",cf.otherIn,hideZero)}
      <div class="annual-cf-row total"><span>入金合計</span><b>${cfMoney(cf.inflow)}</b></div>
    </div>
    <div class="annual-cf-col"><h4>出金の部</h4>
      ${annualCFRow("生活費・費用",cf.expensePayments,hideZero)}
      ${annualCFRow("資産取得",cf.assetAcquisition,hideZero)}
      ${annualCFRow("未収入金・立替増",cf.receivableAdvance,hideZero)}
      ${annualCFRow("負債返済",cf.liabilityRepayment,hideZero)}
      ${annualCFRow("その他出金",cf.otherOut,hideZero)}
      <div class="annual-cf-row total"><span>出金合計</span><b>${cfMoney(cf.outflow)}</b></div>
    </div>
  </div><div class="annual-cf-net"><span>現金増減</span><b>${cfMoney(cf.net)}</b></div>`;
}

function renderSimpleAnnual(){
  const y=Number(document.getElementById("annualYear")?.value)||new Date().getFullYear();
  const yearCF=summarizeCashFlow(periodEntries(`${y}-01-01`,`${y}-12-31`));
  const summary=document.querySelector("#annualCapture .annual-summary-page");
  if(summary){
    summary.querySelector(".annual-cashflow-summary")?.remove();
    let box=summary.querySelector(".annual-cf-summary-detail");
    if(!box){box=document.createElement("div");box.className="report-card annual-cf-summary-detail";summary.appendChild(box);}
    box.innerHTML=`<h3>年間 簡易キャッシュフロー</h3>${annualCFHTML(yearCF,false)}`;
  }

  document.querySelectorAll("#annualCapture .annual-month").forEach((page,i)=>{
    const m=i+1,from=`${y}-${String(m).padStart(2,"0")}-01`,to=annualMonthEnd(y,m);
    const cf=summarizeCashFlow(periodEntries(from,to));
    page.querySelector(".annual-cashflow")?.remove();
    let compact=page.querySelector(":scope > .annual-cf-compact");
    if(!compact){compact=document.createElement("div");compact.className="annual-cf-compact";page.appendChild(compact);}
    compact.innerHTML=`<h3>簡易キャッシュフロー</h3>${annualCFHTML(cf,true)}`;
  });
}

injectSimpleCFStyles();
const cfPrevRenderReports=renderReports;
renderReports=function(){cfPrevRenderReports();renderSimplePL();};
const cfPrevRenderAnnualReport=renderAnnualReport;
renderAnnualReport=function(){cfPrevRenderAnnualReport();renderSimpleAnnual();};
renderSimplePL();
})();
