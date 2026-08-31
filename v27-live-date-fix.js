(()=>{
"use strict";

const originalReadDateRange = typeof readDateRange === "function" ? readDateRange : null;

if(originalReadDateRange){
  readDateRange=function(fromId,toId){
    if(fromId==="plFrom"&&toId==="plTo"){
      return {
        from:document.getElementById("plFrom")?.value||"",
        to:document.getElementById("plTo")?.value||""
      };
    }
    return originalReadDateRange(fromId,toId);
  };
}

function forcePLRefresh(){
  if(typeof renderReports==="function") renderReports();
}

["plFrom","plTo"].forEach(id=>{
  const el=document.getElementById(id);
  if(!el||el.dataset.v27DirectCfBound)return;
  const refresh=()=>requestAnimationFrame(forcePLRefresh);
  el.addEventListener("input",refresh);
  el.addEventListener("change",refresh);
  el.dataset.v27DirectCfBound="1";
});
})();
