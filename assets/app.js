
let APP = null;
const state = {
  view: localStorage.getItem('sc_comp_view') || 'home',
  bookmarks: JSON.parse(localStorage.getItem('sc_comp_bookmarks') || '[]'),
  recents: JSON.parse(localStorage.getItem('sc_comp_recents') || '[]'),
  openParts: JSON.parse(localStorage.getItem('sc_comp_open_parts') || '{}'),
  openRules: JSON.parse(localStorage.getItem('sc_comp_open_rules') || '{}'),
  systemFilter: localStorage.getItem('sc_comp_system_filter') || 'all'
};
const HOME = document.getElementById('view-home');
const PLAY = document.getElementById('view-play');
const SYSTEMS = document.getElementById('view-systems');
const REFERENCE = document.getElementById('view-reference');
const SEARCH = document.getElementById('view-search');
const searchInput = document.getElementById('globalSearch');
const searchResults = document.getElementById('searchResults');
const searchCount = document.getElementById('searchResultCount');
const jumpTop = document.getElementById('jumpTop');
function esc(str){return (str||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function save(){localStorage.setItem('sc_comp_view', state.view);localStorage.setItem('sc_comp_bookmarks', JSON.stringify(state.bookmarks));localStorage.setItem('sc_comp_recents', JSON.stringify(state.recents.slice(0,20)));localStorage.setItem('sc_comp_open_parts', JSON.stringify(state.openParts));localStorage.setItem('sc_comp_open_rules', JSON.stringify(state.openRules));localStorage.setItem('sc_comp_system_filter', state.systemFilter||'all');}
function setView(view){state.view=view;document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active', v.id===`view-${view}`));document.querySelectorAll('.nav-btn').forEach(btn=>btn.classList.toggle('active', btn.dataset.view===view));save();window.scrollTo({top:0,behavior:'smooth'});}
function byId(id){ return document.getElementById(id); }
function findPart(id){ return APP.parts.find(p=>p.id===id); }
function getBookmarkIndex(target){ return state.bookmarks.findIndex(b=>b.target===target); }
function isBookmarked(target){ return getBookmarkIndex(target)!==-1; }
function toggleBookmark(target,label,view='rules'){ const i=getBookmarkIndex(target); if(i>-1) state.bookmarks.splice(i,1); else state.bookmarks.unshift({target,label,view}); save(); renderAll(); }
function pushRecent(target,label,view='rules'){ state.recents=state.recents.filter(r=>r.target!==target); state.recents.unshift({target,label,view}); save(); }
function viewForPart(part){ if(part.group==='play') return 'play'; if(part.group==='reference') return 'reference'; if(part.group==='prepare') return 'home'; return 'systems'; }
function labelForTarget(target){
  const [partId, ruleId, childId] = target.split('::');
  const part = findPart(partId);
  if(!part) return target;
  if(!ruleId) return `${part.kicker} — ${part.title}`;
  const rule = part.rules.find(r=>r.id===ruleId);
  if(!rule) return `${part.kicker} — ${part.title}`;
  if(!childId) return rule.title;
  const child = (rule.children||[]).find(c=>c.id===childId);
  return child ? `${rule.title} — ${child.title}` : rule.title;
}
function openTarget(target, forceView){
  const [partId, ruleId, childId] = target.split('::');
  const part = findPart(partId);
  if(!part) return;
  const view = forceView || viewForPart(part);
  setView(view);
  state.openParts[partId] = true;
  if(ruleId) state.openRules[`${partId}::${ruleId}`] = true;
  pushRecent(target, labelForTarget(target), view);
  save();
  renderAll();
  byId('tocSheet').classList.add('hidden');
  requestAnimationFrame(()=>{
    const selector = `[data-target="${CSS.escape(target)}"]`;
    let el = document.querySelector(selector);
    if(!el && childId) el = document.querySelector(`[data-target="${CSS.escape(partId+'::'+ruleId)}"]`);
    if(el){
      el.scrollIntoView({behavior:'smooth', block:'start'});
      el.classList.add('flash');
      setTimeout(()=>el.classList.remove('flash'), 1200);
    }
  });
}
function plainRows(rows){ return (rows||[]).map(r=>r.plain||'').join(' '); }
function buildSearchIndex(parts){
  const out = [];
  for(const part of parts){
    out.push({target:part.id,title:`${part.kicker} ${part.title}`,meta:part.kicker,text:plainRows(part.introRows),view:viewForPart(part)});
    for(const rule of part.rules){
      out.push({target:`${part.id}::${rule.id}`,title:rule.title,meta:`${part.kicker} ${part.title}`,text:plainRows(rule.rows)+' '+(rule.children||[]).map(c=>`${c.title} ${plainRows(c.rows)}`).join(' '),view:viewForPart(part)});
      for(const child of rule.children||[]){
        out.push({target:`${part.id}::${rule.id}::${child.id}`,title:`${rule.title} — ${child.title}`,meta:`${part.kicker} ${part.title}`,text:plainRows(child.rows),view:viewForPart(part)});
      }
    }
  }
  return out;
}
async function loadData(){
  const manifest = await fetch('data/manifest.json').then(r=>r.json());
  const parts = await Promise.all(manifest.parts.map(async meta=>({ ...await fetch(meta.file).then(r=>r.json()), meta })));
  const playGuide = await fetch('data/play-guide.json').then(r=>r.json());
  APP = { manifest, parts, playGuide, searchIndex: buildSearchIndex(parts) };
}
function renderRow(row, idx){ const extra=row.type&&row.type!=='text'?` ${row.type}`:''; return `<div class="row-band${extra} band-${(idx%2)+1}"><div class="rule-html">${row.html}</div></div>`; }
function renderRule(rule, part){
  const target = `${part.id}::${rule.id}`;
  const open = !!state.openRules[target];
  const bm = isBookmarked(target);
  return `<article class="rule-entry ${open?'open':''}" data-target="${target}"><div class="rule-head" data-rule-toggle="${target}"><div class="rule-title">${esc(rule.title)}</div><div class="head-tags"><button class="star-btn ${bm?'active':''}" data-bookmark="${target}" data-label="${esc(rule.title)}" aria-label="Bookmark">★</button></div></div><div class="rule-body">${(rule.rows||[]).map((r,i)=>renderRow(r,i)).join('')}${(rule.children||[]).length?`<div class="child-stack">${rule.children.map(c=>`<div class="child-entry" data-target="${part.id}::${rule.id}::${c.id}"><div class="child-head">${esc(c.title)}</div>${c.rows.map((r,i)=>renderRow(r,i)).join('')}</div>`).join('')}</div>`:''}</div></article>`;
}
function renderPart(part){
  const open = !!state.openParts[part.id];
  const target = part.id;
  const bm = isBookmarked(target);
  return `<section class="part-card ${open?'open':''}" style="--accent:${part.color}" data-target="${target}"><div class="part-head" data-part-toggle="${part.id}"><div><div class="part-meta">${esc(part.kicker)}</div><div class="part-title">${esc(part.title)}</div><div class="sheet-sub">${part.rules.length} section${part.rules.length===1?'':'s'}</div></div><div class="part-tools"><button class="star-btn ${bm?'active':''}" data-bookmark="${target}" data-label="${esc(part.kicker+' — '+part.title)}" aria-label="Bookmark Part">★</button><button class="chev-btn" aria-label="Toggle part">${open?'−':'+'}</button></div></div><div class="part-body">${(part.introRows||[]).length?`<div class="part-intro sheet-card flat" style="--accent:${part.color}">${part.introRows.map((r,i)=>renderRow(r,i)).join('')}</div>`:''}${part.rules.map(rule=>renderRule(rule,part)).join('')}</div></section>`;
}
function renderProcedureCard(proc, phaseClass){
  const openBtn = proc.target ? `<button class="link-btn proc-open" data-open-target="${proc.target}">Open ${esc(proc.ref || 'rule')}</button>` : '';
  return `<article class="proc-card ${phaseClass}">
    <div class="proc-head"><div><div class="proc-kicker">${esc(proc.ref || 'Procedure')}</div><div class="proc-title">${esc(proc.title)}</div></div>${proc.target?`<span class="tag ${phaseClass}">${esc(proc.ref || '')}</span>`:''}</div>
    <div class="proc-body">
      ${proc.what?`<div class="proc-row"><div class="proc-label">What it is</div><div class="proc-copy">${esc(proc.what)}</div></div>`:''}
      ${proc.when?`<div class="proc-row"><div class="proc-label">When</div><div class="proc-copy">${esc(proc.when)}</div></div>`:''}
      ${(proc.how||[]).length?`<div class="proc-row"><div class="proc-label">How</div><div class="proc-list">${proc.how.map(x=>`<div class="proc-item">× ${esc(x)}</div>`).join('')}</div></div>`:''}
      ${(proc.cannot||[]).length?`<div class="proc-row"><div class="proc-label">Cannot</div><div class="proc-list">${proc.cannot.map(x=>`<div class="proc-item">× ${esc(x)}</div>`).join('')}</div></div>`:''}
      ${proc.ifFails?`<div class="proc-row emphasis"><div class="proc-label">If it fails</div><div class="proc-copy">${esc(proc.ifFails)}</div></div>`:''}
      ${(proc.see||[]).length?`<div class="proc-row"><div class="proc-label">See also</div><div class="proc-see">${proc.see.map(x=>`<span>${esc(x)}</span>`).join('')}</div></div>`:''}
      ${openBtn?`<div class="proc-actions">${openBtn}</div>`:''}
    </div>
  </article>`;
}
function renderManualFoundation(card){
  return `<section class="sheet-card manual-foundation" style="--accent:#9baec0"><div class="sheet-head compact"><div><div class="section-kicker">${esc(card.ref)}</div><div class="sheet-title" style="font-size:16px">${esc(card.title)}</div><div class="sheet-sub">${esc(card.summary)}</div></div><div class="head-tags"><button class="link-btn" data-open-target="${card.target}" style="min-height:34px;padding:6px 8px">Open</button></div></div><div class="manual-bands">${(card.bullets||[]).map((b,i)=>`<div class="manual-band band-${(i%2)+1}">× ${esc(b)}</div>`).join('')}</div></section>`;
}
function renderPhaseManual(phase){
  return `<section class="sheet-card manual-phase ${phase.phaseClass}" style="--accent:var(--${phase.phaseClass==='phase1'?'movement':phase.phaseClass==='phase2'?'assault':phase.phaseClass==='phase3'?'combat':'scoring'})"><div class="sheet-head"><div><div class="section-kicker">${esc(phase.ref)}</div><div class="sheet-title">${esc(phase.title)}</div><div class="sheet-sub">${esc(phase.purpose)}</div></div><div class="head-tags"><button class="link-btn" data-open-target="${phase.target}" style="min-height:34px;padding:6px 8px">Open Phase</button></div></div><div class="phase-summary"><div class="phase-action-row">${(phase.actions||[]).map(a=>`<span class="tag ${phase.phaseClass}">${esc(a)}</span>`).join('')}</div>${(phase.notes||[]).length?`<div class="manual-bands compact">${phase.notes.map((n,i)=>`<div class="manual-band band-${(i%2)+1}">× ${esc(n)}</div>`).join('')}</div>`:''}</div><div class="proc-stack">${(phase.procedures||[]).map(proc=>renderProcedureCard(proc, phase.phaseClass)).join('')}</div></section>`;
}
function renderCollection(container, parts, options={}){ const phaseHtml=options.phaseGuide?`<div class="sheet-card" style="--accent:#9d96c5"><div class="sheet-head compact"><div><div class="section-kicker">Play a round</div><div class="sheet-title" style="font-size:16px">Phase Spine</div></div><div class="head-tags"><span class="tag soft">Part VIII</span></div></div><div class="phase-strip"><button class="phase-card phase1" data-jump="part-8::8-1-rounds-and-phases"><strong>Round Structure</strong><span>8.1 • phases and order</span></button><button class="phase-card phase1" data-jump="part-8::8-2-the-activation-system"><strong>Activation</strong><span>8.2 • alternating activations</span></button><button class="phase-card phase1" data-jump="part-8::8-4-phase-1-the-movement-phase"><strong>Phase 1</strong><span>Movement</span></button><button class="phase-card phase2" data-jump="part-8::8-6-phase-2-the-assault-phase"><strong>Phase 2</strong><span>Assault</span></button><button class="phase-card phase3" data-jump="part-8::8-8-phase-3-the-combat-phase"><strong>Phase 3</strong><span>Combat</span></button><button class="phase-card phase4" data-jump="part-8::8-9-phase-4-the-scoring-cleanup-phase"><strong>Phase 4</strong><span>Scoring & Cleanup</span></button></div></div>`:''; const filters=options.filters?`<div class="view-section"><div class="part-filter">${options.filters.map(f=>`<button class="${f.active?'active':''}" data-filter="${f.key}" data-filter-view="${options.filterView}">${f.label}</button>`).join('')}</div></div>`:''; container.innerHTML=`<div class="section-head"><div class="section-kicker">${esc(options.label||'')}</div>${options.subtitle?`<div class="small-note">${esc(options.subtitle)}</div>`:''}</div>${filters}${phaseHtml}<div class="part-stack">${parts.map(renderPart).join('')}</div>`; }
function renderHome(){ HOME.innerHTML=`<section class="sheet-card" style="--accent:#97aebe"><div class="sheet-head"><div><div class="section-kicker">Field manual</div><div class="sheet-title">Use the rules like a rulebook.</div><div class="sheet-sub">Learn the round first. Resolve actions second. Use systems and reference to answer edge cases fast.</div></div></div><div class="phase-strip"><button class="phase-card phase1" data-jump="part-8::8-1-rounds-and-phases"><strong>Start Here</strong><span>Round structure</span></button><button class="phase-card phase1" data-jump="part-8::8-4-phase-1-the-movement-phase"><strong>Phase 1</strong><span>Movement</span></button><button class="phase-card phase2" data-jump="part-8::8-6-phase-2-the-assault-phase"><strong>Phase 2</strong><span>Assault</span></button><button class="phase-card phase3" data-jump="part-8::8-8-phase-3-the-combat-phase"><strong>Phase 3</strong><span>Combat</span></button><button class="phase-card phase4" data-jump="part-8::8-9-phase-4-the-scoring-cleanup-phase"><strong>Phase 4</strong><span>Cleanup</span></button><button class="phase-card" data-view-go="reference"><strong>Quick Ref</strong><span>Fast lookup</span></button></div></section><div class="home-grid"><section class="sheet-card" style="--accent:#9d96c5"><div class="sheet-head compact"><div><div class="section-kicker">Play a Round</div><div class="sheet-title" style="font-size:16px">Phase-led rules</div></div></div><div class="phase-strip"><button class="phase-card phase1" data-view-go="play"><strong>Open</strong><span>Phase-led rules view</span></button><button class="phase-card phase1" data-jump="part-8::8-2-the-activation-system"><strong>Activation</strong><span>How turns alternate</span></button><button class="phase-card phase1" data-jump="part-8::8-5-movement-phase-actions"><strong>Movement Actions</strong><span>Deploy, Move, Disengage</span></button><button class="phase-card phase2" data-jump="part-8::8-7-assault-phase-actions"><strong>Assault Actions</strong><span>Charge, Ranged Attack</span></button></div></section><section class="sheet-card" style="--accent:#93aac7"><div class="sheet-head compact"><div><div class="section-kicker">Rules Systems</div><div class="sheet-title" style="font-size:16px">Underlying logic</div></div></div><div class="link-grid one"><button class="link-btn" data-view-go="systems">Open systems view</button><button class="link-btn" data-jump="part-4::4-4-unit-coherency">Coherency</button><button class="link-btn" data-jump="part-7::7-1-line-of-sight">Line of Sight</button><button class="link-btn" data-jump="part-6::6-2-how-supply-is-used">Supply</button></div></section><section class="sheet-card" style="--accent:#b38fa5"><div class="sheet-head compact"><div><div class="section-kicker">Prepare for Battle</div><div class="sheet-title" style="font-size:16px">Army, mission, setup</div></div></div><div class="link-grid one"><button class="link-btn" data-jump="part-9::9-1-army-building">Army building</button><button class="link-btn" data-jump="part-9::9-2-mission-selection-and-the-draft">Mission and draft</button><button class="link-btn" data-jump="part-9::9-3-battlefield-setup">Battlefield setup</button></div></section><section class="sheet-card" style="--accent:#96a6b8"><div class="sheet-head compact"><div><div class="section-kicker">Reference Tools</div><div class="sheet-title" style="font-size:16px">Quick answers</div></div></div><div class="link-grid one"><button class="link-btn" data-view-go="reference">Open reference view</button><button class="link-btn" data-jump="part-11">Keyword glossary</button><button class="link-btn" data-jump="part-12">Quick reference</button><button class="link-btn" id="homePrintBtn">Printable version</button></div></section></div><section class="sheet-card" style="--accent:#a6b7c4"><div class="sheet-head compact"><div><div class="section-kicker">Recent and Saved</div><div class="sheet-title" style="font-size:16px">Return to where you left off</div></div></div><div class="saved-list">${(state.bookmarks.length?state.bookmarks.slice(0,6).map(b=>`<div class="mini-row"><div class="mini-main"><div class="mini-title">${esc(b.label)}</div><div class="mini-sub">Saved</div></div><button class="link-btn" data-open-target="${b.target}" style="min-height:34px;padding:6px 8px">Open</button></div>`).join(''):'<div class="mini-row"><div class="mini-main"><div class="mini-title">No saved rules yet</div><div class="mini-sub">Use ★ on any Part or rule.</div></div></div>')}${(state.recents.length?state.recents.slice(0,6).map(r=>`<div class="mini-row"><div class="mini-main"><div class="mini-title">${esc(r.label)}</div><div class="mini-sub">Recent</div></div><button class="link-btn" data-open-target="${r.target}" style="min-height:34px;padding:6px 8px">Open</button></div>`).join(''):'')}</div></section><section class="sheet-card" style="--accent:#9ca7b1"><div class="sheet-head compact"><div><div class="section-kicker">Complete Rulebook</div><div class="sheet-title" style="font-size:16px">All Parts</div></div></div><div class="home-list">${APP.parts.map(p=>`<div class="mini-row"><div class="mini-main"><div class="mini-title">${esc(p.kicker)} — ${esc(p.title)}</div><div class="mini-sub">${p.rules.length} section${p.rules.length===1?'':'s'}</div></div><button class="link-btn" data-open-target="${p.id}" style="min-height:34px;padding:6px 8px">Open</button></div>`).join('')}</div></section>`; }
function renderPlay(){
  const part8 = findPart('part-8');
  const guide = APP.playGuide;
  PLAY.innerHTML = `
    <section class="sheet-card" style="--accent:#9d96c5">
      <div class="sheet-head">
        <div>
          <div class="section-kicker">Play a round</div>
          <div class="sheet-title">Part VIII, rebuilt for table use</div>
          <div class="sheet-sub">${esc(guide.intro.subtitle)}</div>
        </div>
      </div>
      <div class="phase-strip phase-spine-manual">
        <button class="phase-card phase1" data-open-target="part-8::8-1-rounds-and-phases"><strong>Round Structure</strong><span>8.1 • learn the loop</span></button>
        <button class="phase-card phase1" data-open-target="part-8::8-2-the-activation-system"><strong>Activation</strong><span>8.2 • who acts and when</span></button>
        <button class="phase-card phase1" data-open-target="part-8::8-4-phase-1-the-movement-phase"><strong>Phase 1</strong><span>Movement</span></button>
        <button class="phase-card phase2" data-open-target="part-8::8-6-phase-2-the-assault-phase"><strong>Phase 2</strong><span>Assault</span></button>
        <button class="phase-card phase3" data-open-target="part-8::8-8-phase-3-the-combat-phase"><strong>Phase 3</strong><span>Combat</span></button>
        <button class="phase-card phase4" data-open-target="part-8::8-9-phase-4-the-scoring-cleanup-phase"><strong>Phase 4</strong><span>Scoring & Cleanup</span></button>
      </div>
    </section>
    <div class="manual-stack">
      ${guide.foundations.map(renderManualFoundation).join('')}
      ${guide.phases.map(renderPhaseManual).join('')}
    </div>
    <section class="sheet-card" style="--accent:#96a6b8">
      <div class="sheet-head compact">
        <div>
          <div class="section-kicker">Full compendium text</div>
          <div class="sheet-title" style="font-size:16px">Exact Part VIII rules</div>
          <div class="sheet-sub">Use the procedure cards above to operate the phase. Open the full entries below when you need exact wording, timing, or edge-case detail.</div>
        </div>
      </div>
    </section>
    <div class="part-stack">${part8 ? renderPart(part8) : ''}</div>`;
}
function renderSystems(){ const filters=[{key:'all',label:'All Systems',active:state.systemFilter==='all'},{key:'core',label:'Core',active:state.systemFilter==='core'},{key:'battle',label:'Battlefield',active:state.systemFilter==='battle'},{key:'advanced',label:'Advanced',active:state.systemFilter==='advanced'}]; let parts=APP.parts.filter(p=>p.group==='systems'); if(state.systemFilter==='core') parts=parts.filter(p=>['part-2','part-3','part-4','part-5','part-6'].includes(p.id)); if(state.systemFilter==='battle') parts=parts.filter(p=>['part-7'].includes(p.id)); if(state.systemFilter==='advanced') parts=parts.filter(p=>['part-10'].includes(p.id)); renderCollection(SYSTEMS, parts, {label:'Rules Systems', subtitle:'Definitions, measurements, terrain, abilities, and governing logic', filters, filterView:'systems'}); }
function renderReference(){ REFERENCE.innerHTML=`<section class="sheet-card" style="--accent:#96a6b8"><div class="sheet-head"><div><div class="section-kicker">Reference</div><div class="sheet-title">Fast answers during play</div><div class="sheet-sub">Use quick reference for operating flow, keywords for exact terms, and bookmarks for repeated table rulings.</div></div></div><div class="link-grid"><button class="link-btn" data-jump="part-12">Quick reference</button><button class="link-btn" data-jump="part-11">Keyword glossary</button><button class="link-btn" data-jump="part-12::12-2-round-sequence">Round sequence</button><button class="link-btn" data-jump="part-12::12-4-phase-2-assault">Assault reference</button></div></section><section class="sheet-card" style="--accent:#b4889b"><div class="sheet-head compact"><div><div class="section-kicker">Bookmarks</div><div class="sheet-title" style="font-size:16px">Saved rulings</div></div></div><div class="saved-list">${state.bookmarks.length?state.bookmarks.map(b=>`<div class="mini-row"><div class="mini-main"><div class="mini-title">${esc(b.label)}</div><div class="mini-sub">Saved for reuse</div></div><div class="head-tags"><button class="link-btn" data-open-target="${b.target}" style="min-height:34px;padding:6px 8px">Open</button><button class="link-btn" data-remove-bookmark="${b.target}" style="min-height:34px;padding:6px 8px">Remove</button></div></div>`).join(''):'<div class="mini-row"><div class="mini-main"><div class="mini-title">No bookmarks yet</div><div class="mini-sub">Save a Part or specific rule with ★.</div></div></div>'}</div></section><section class="sheet-card" style="--accent:#96a6b8"><div class="sheet-head compact"><div><div class="section-kicker">Printable</div><div class="sheet-title" style="font-size:16px">Print field manual</div></div></div><div class="link-grid one"><button class="link-btn" id="referencePrintBtn">Open printable version</button></div></section><div class="part-stack">${APP.parts.filter(p=>p.group==='reference').map(renderPart).join('')}</div>`; }
function renderSearch(){ const q=(searchInput.value||'').trim().toLowerCase(); const hits=q.length<2?[]:APP.searchIndex.filter(row=>(row.title+' '+row.text+' '+row.meta).toLowerCase().includes(q)).slice(0,120); searchCount.textContent=q.length<2?'Type at least 2 characters.':`${hits.length} result${hits.length===1?'':'s'}`; searchResults.innerHTML=hits.map(h=>`<div class="result-card"><div class="result-meta">${esc(h.meta)}</div><div class="result-title">${esc(h.title)}</div><div class="result-snippet">${esc(h.text.slice(0,180))}${h.text.length>180?'…':''}</div><div class="head-tags" style="margin-top:8px;justify-content:flex-start"><button class="link-btn" data-open-target="${h.target}" style="min-height:34px;padding:6px 8px">Open</button></div></div>`).join(''); }
function renderToc(){ byId('tocList').innerHTML=APP.parts.map(p=>`<div class="toc-row" data-open-target="${p.id}"><div><div class="toc-row-title">${esc(p.kicker)} — ${esc(p.title)}</div><div class="toc-row-sub">${p.rules.length} section${p.rules.length===1?'':'s'}</div></div><span class="tag soft">${p.group}</span></div>`).join(''); }
function bindDynamic(){ document.querySelectorAll('[data-part-toggle]').forEach(btn=>btn.onclick=()=>{ const id=btn.dataset.partToggle; state.openParts[id]=!state.openParts[id]; save(); renderAll(); }); document.querySelectorAll('[data-rule-toggle]').forEach(btn=>btn.onclick=()=>{ const id=btn.dataset.ruleToggle; state.openRules[id]=!state.openRules[id]; save(); renderAll(); }); document.querySelectorAll('[data-bookmark]').forEach(btn=>btn.onclick=(e)=>{ e.stopPropagation(); toggleBookmark(btn.dataset.bookmark, btn.dataset.label, state.view); }); document.querySelectorAll('[data-open-target],[data-jump]').forEach(btn=>btn.onclick=()=>openTarget(btn.dataset.openTarget||btn.dataset.jump)); document.querySelectorAll('[data-view-go]').forEach(btn=>btn.onclick=()=>setView(btn.dataset.viewGo)); document.querySelectorAll('[data-remove-bookmark]').forEach(btn=>btn.onclick=()=>{ const t=btn.dataset.removeBookmark; const i=getBookmarkIndex(t); if(i>-1){state.bookmarks.splice(i,1); save(); renderAll();} }); document.querySelectorAll('[data-filter-view="systems"]').forEach(btn=>btn.onclick=()=>{ state.systemFilter=btn.dataset.filter; save(); renderSystems(); bindDynamic(); }); const hp=byId('homePrintBtn'); if(hp) hp.onclick=()=>window.open('print.html','_blank'); const rp=byId('referencePrintBtn'); if(rp) rp.onclick=()=>window.open('print.html','_blank'); }
function renderAll(){ renderHome(); renderPlay(); renderSystems(); renderReference(); renderSearch(); renderToc(); bindDynamic(); setView(state.view||'home'); }
function initStatic(){ document.querySelectorAll('.nav-btn').forEach(btn=>btn.onclick=()=>setView(btn.dataset.view)); byId('tocBtn').onclick=()=>byId('tocSheet').classList.remove('hidden'); byId('tocClose').onclick=()=>byId('tocSheet').classList.add('hidden'); byId('tocCloseBtn').onclick=()=>byId('tocSheet').classList.add('hidden'); byId('searchBtn').onclick=()=>{ setView('search'); searchInput.focus(); }; byId('printBtn').onclick=()=>window.open('print.html','_blank'); byId('clearGlobalSearch').onclick=()=>{ searchInput.value=''; renderSearch(); }; searchInput.addEventListener('input', renderSearch); window.addEventListener('scroll', ()=>jumpTop.classList.toggle('hidden', window.scrollY<500)); jumpTop.onclick=()=>window.scrollTo({top:0, behavior:'smooth'}); }
async function boot(){ await loadData(); initStatic(); renderAll(); }
boot();
