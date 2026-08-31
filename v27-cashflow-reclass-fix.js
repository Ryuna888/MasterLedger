(()=>{
"use strict";

const money=v=>"¥"+Number(v||0).toLocaleString("ja-JP");
const isCash=a=>!!a&&a.category==="asset"&&a.assetTag==="cash";

function adjustedCashFlow(rows){
  const r={inflow:0,outflow:0,net:0,assetAcquisition:0,assetSale:0,incomeReceipts:0,expensePayments:0,otherIn:0,otherOut:0};
  const paidByExpense={};
  const reclassifiedByExpense={};

  rows.forEach(e=>{
    const d=accountById(e.debitAccount),c=accountById(e.creditAccount);
    const dc=isCash(d),cc=isCash(c);
    if(dc&&cc)return;

    if(dc){
      r.inflow+=e.amount;
      if(["sales","specialGain"].includes(c?.category))r.incomeReceipts+=e.amount;
      else if(c?.category==="asset")r.assetSale+=e.amount;
      else r.otherIn+=e.amount;
    }
    if(cc){
      r.outflow+=e.amount;
      if(["expense","specialLoss"].includes(d?.category)){
        r.expensePayments+=e.amount;
        paidByExpense[d.id]=(paidByExpense[d.id]||0)+e.amount;
      }else if(d?.category==="asset")r.assetAcquisition+=e.amount;
      else r.otherOut+=e.amount;
    }
  });

  // 費用として支払った後に「借：資産 / 貸：費用」で資産計上した取引は、
  // 現金支出そのものを増やさず、支出分類だけを費用→資産取得へ振り替える。
  rows.forEach(e=>{
    const d=accountById(e.debitAccount),c=accountById(e.creditAccount);
    if(!d||!c||isCash(d)||isCash(c))return;
    if(d.category!=="asset"||!["expense","specialLoss"].includes(c.category))return;

    const paid=paidByExpense[c.id]||0;
    const used=reclassifiedByExpense[c.id]||0;
    const shift=Math.max(0,Math.min(Number(e.amount||0),paid-used));
    if(!shift)return;

    reclassifiedByExpense[c.id]=used+shift;
    r.expensePayments-=shift;
    r.assetAcquisition+=shift;
  });

  r.net=r.inflow-r.outflow;
  return r;
}

function updateCurrentPL(){
  const range=readDateRange("plFrom","plTo");
  const cf=range&&range.from<=range.to?adjustedCashFlow(periodEntries(range.from,range.to)):adjustedCashFlow([]);
  const card=document.getElementById("simpleCashFlowCard");
  if(!card)return;

  const grid=card.querySelectorAll(".cashflow-grid b");
  if(grid[0])grid[0].textContent=money(cf.inflow);
  if(grid[1])grid[1].textContent=money(cf.outflow);
  if(grid[2]){
    grid[2].textContent=money(cf.net);
    grid[2].className=cf.net>0?"cashflow-positive":cf.net<0?"cashflow-negative":"";
  }
  const rows=card.querySelectorAll(":scope > .row b");
  if(rows[0])rows[0].textContent=money(cf.incomeReceipts);
  if(rows[1])rows[1].textContent=money(cf.expensePayments);
  if(rows[2])rows[2].textContent=money(cf.assetAcquisition);
  if(rows[3])rows[3].textContent=money(cf.assetSale);

  const note=card.querySelector(".cashflow-note");
  if(note)note.textContent="「現金性資産」タグを付けた科目の増減から集計します。費用として支払った後に資産へ振り替えた取引は、出金総額を変えず『生活費・費用』から『資産取得』へ付け替えます。";
}

function updateAnnual(){
  const y=Number(document.getElementById("annualYear")?.value)||new Date().getFullYear();
  const annual=adjustedCashFlow(periodEntries(`${y}-01-01`,`${y}-12-31`));
  const sum=document.querySelector("#annualCapture .annual-cashflow-summary");
  if(sum){
    const rows=sum.querySelectorAll(".row b");
    if(rows[0])rows[0].textContent=money(annual.inflow);
    if(rows[1])rows[1].textContent=money(annual.outflow);
    if(rows[2])rows[2].textContent=money(annual.net);
    if(rows[3])rows[3].textContent=money(annual.assetAcquisition);
    if(rows[4])rows[4].textContent=money(annual.assetSale);
  }

  document.querySelectorAll("#annualCapture .annual-month").forEach((page,i)=>{
    const m=i+1,from=`${y}-${String(m).padStart(2,"0")}-01`,to=annualMonthEnd(y,m);
    const cf=adjustedCashFlow(periodEntries(from,to));
    const rows=page.querySelectorAll(".annual-cashflow .annual-minirow b");
    if(rows[0])rows[0].textContent=money(cf.inflow);
    if(rows[1])rows[1].textContent=money(cf.outflow);
    if(rows[2])rows[2].textContent=money(cf.net);
  });
}

const previousRenderReports=renderReports;
renderReports=function(){previousRenderReports();updateCurrentPL();};

const previousRenderAnnualReport=renderAnnualReport;
renderAnnualReport=function(){previousRenderAnnualReport();updateAnnual();};

updateCurrentPL();
})();
