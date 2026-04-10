
async function loadData(){ const manifest=await fetch('data/manifest.json').then(r=>r.json()); const parts=await Promise.all(manifest.parts.map(async meta=>({...await fetch(meta.file).then(r=>r.json()), meta}))); return {manifest,parts}; }
function esc(str){return (str||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function row(r){ return `<div class="row ${r.type||''}"><div>${r.html}</div></div>`; }
function ruleHtml(rule){ return `<section class="rule"><div class="rule-head">${esc(rule.title)}</div>${(rule.rows||[]).map(row).join('')}${(rule.children||[]).map(c=>`<section class="child"><div class="child-head">${esc(c.title)}</div>${(c.rows||[]).map(row).join('')}</section>`).join('')}</section>`; }
async function boot(){ const APP=await loadData(); document.getElementById('printRoot').innerHTML = APP.parts.map(part=>`<section class="part"><div class="part-head"><div class="part-kicker">${esc(part.kicker)}</div><div class="part-title">${esc(part.title)}</div></div>${(part.introRows||[]).length?`<section class="intro">${part.introRows.map(row).join('')}</section>`:''}${part.rules.map(ruleHtml).join('')}</section>`).join(''); }
boot();
