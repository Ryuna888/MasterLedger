(()=>{
"use strict";

function updateAboutV27(){
  const about=document.getElementById("about");
  if(!about)return;

  const title=about.querySelector(".privacy-card h3");
  if(title)title.textContent="MasterLedger v2.7.8 Security Maintenance";

  const cards=[...about.querySelectorAll(".report-card.guide-copy")];
  const updateCard=cards.find(card=>card.querySelector("h3")?.textContent.trim()==="今回の更新");
  if(updateCard){
    const p=updateCard.querySelector("p");
    if(p)p.textContent="v2.7.8（2026年10月29日）：取り込み・表示の安全性、CSV出力、入力検証、更新時のデータ保護を改善。Excelライブラリ更新・同梱。既存データの保存キーと形式は引き継ぎます。";
  }

  const featureList=cards.find(card=>card.querySelector("h3")?.textContent.trim()==="主な機能")?.querySelector("ul");
  if(featureList&&!featureList.dataset.v27Enhanced){
    const add=["資産タグによる資産分類","簡易キャッシュフローと入出金内訳"];
    add.forEach(text=>{
      if(![...featureList.querySelectorAll("li")].some(li=>li.textContent.trim()===text)){
        const li=document.createElement("li");li.textContent=text;featureList.appendChild(li);
      }
    });
    featureList.dataset.v27Enhanced="1";
  }
}

function refreshCashFlowNow(){
  if(typeof renderReports==="function")renderReports();
}

function bindLiveCashFlow(){
  ["plFrom","plTo"].forEach(id=>{
    const el=document.getElementById(id);
    if(!el||el.dataset.cfLiveBoundV2)return;
    let raf=0;
    const refresh=()=>{
      cancelAnimationFrame(raf);
      raf=requestAnimationFrame(refreshCashFlowNow);
    };
    el.addEventListener("input",refresh);
    el.addEventListener("change",refresh);
    el.dataset.cfLiveBoundV2="1";
  });
}

function initV27Polish(){
  updateAboutV27();
  bindLiveCashFlow();
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initV27Polish,{once:true});
else initV27Polish();
})();
