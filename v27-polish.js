(()=>{
"use strict";

function updateAboutV27(){
  const about=document.getElementById("about");
  if(!about)return;

  const title=about.querySelector(".privacy-card h3");
  if(title)title.textContent="MasterLedger v2.7 Cash Flow & Asset Tags";

  const cards=[...about.querySelectorAll(".report-card.guide-copy")];
  const updateCard=cards.find(card=>card.querySelector("h3")?.textContent.trim()==="今回の更新");
  if(updateCard){
    const p=updateCard.querySelector("p");
    if(p)p.textContent="v2.7では、資産科目のタグ分類、簡易キャッシュフロー、未収入金回収などの入出金分類、年間決算書のキャッシュフロー表示を追加・改善しました。P/Lでは入金・出金の内訳と検算が確認でき、年間決算書は月ごとの印刷可読性を保つよう調整しています。仕訳の保存キーと既存データ形式は変更していません。";
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
  if(typeof renderSimplePL==="function"){
    renderSimplePL();
    return;
  }
  if(typeof renderExplainablePL==="function"){
    renderExplainablePL();
  }
}

function bindLiveCashFlow(){
  ["plFrom","plTo"].forEach(id=>{
    const el=document.getElementById(id);
    if(!el||el.dataset.cfLiveBound)return;
    const refresh=()=>requestAnimationFrame(refreshCashFlowNow);
    el.addEventListener("input",refresh);
    el.addEventListener("change",refresh);
    el.dataset.cfLiveBound="1";
  });
}

function initV27Polish(){
  updateAboutV27();
  bindLiveCashFlow();
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initV27Polish,{once:true});
else initV27Polish();
})();
