
let APP_DATA = null;

async function loadAppData(){
  const manifest = await fetch('data/manifest.json').then(r => {
    if(!r.ok) throw new Error('Failed to load manifest.json');
    return r.json();
  });
  const parts = await Promise.all(manifest.parts.map(async meta => {
    const part = await fetch(meta.file).then(r => {
      if(!r.ok) throw new Error(`Failed to load ${meta.file}`);
      return r.json();
    });
    return part;
  }));
  APP_DATA = {
    parts,
    quickPart: manifest.quickPart || 'part-12',
    searchIndex: buildSearchIndex(parts)
  };
}

function buildSearchIndex(parts){
  const rows = [];
  for(const part of parts){
    rows.push({
      type: 'part',
      part: part.num,
      title: `${part.kicker} ${part.title}`,
      id: part.id,
      plain: stripHtml(part.intro || '')
    });
    for(const rule of part.rules || []){
      rows.push({
        type: 'rule',
        part: part.num,
        title: rule.title,
        id: `${part.id}::${rule.id}`,
        plain: [stripHtml(rule.html || ''), ...(rule.children || []).map(s => `${s.title} ${stripHtml(s.html || '')}`)].join(' ')
      });
      for(const sub of rule.children || []){
        rows.push({
          type: 'sub',
          part: part.num,
          title: sub.title,
          id: `${part.id}::${rule.id}::${sub.id}`,
          plain: stripHtml(sub.html || '')
        });
      }
    }
  }
  return rows;
}

const state ={
  view: 'home',
  density: localStorage.getItem('sc_rules_density') || 'comfortable',
  bookmarks: JSON.parse(localStorage.getItem('sc_rules_bookmarks') || '[]'),
  recents: JSON.parse(localStorage.getItem('sc_rules_recents') || '[]'),
  openParts: JSON.parse(localStorage.getItem('sc_rules_open_parts') || '{}'),
  openRules: JSON.parse(localStorage.getItem('sc_rules_open_rules') || '{}'),
  openSubs: JSON.parse(localStorage.getItem('sc_rules_open_subs') || '{}'),
  partFilter: 'all',
};
const app = document.getElementById('app');
app.setAttribute('data-density', state.density);
const views = [...document.querySelectorAll('.view')];
const navBtns = [...document.querySelectorAll('.nav-btn')];
const browseSearch = document.getElementById('browseSearch');
const globalSearch = document.getElementById('globalSearch');
const savedSet = () => new Set(state.bookmarks);

function saveState(){
  localStorage.setItem('sc_rules_density', state.density);
  localStorage.setItem('sc_rules_bookmarks', JSON.stringify(state.bookmarks));
  localStorage.setItem('sc_rules_recents', JSON.stringify(state.recents.slice(0,20)));
  localStorage.setItem('sc_rules_open_parts', JSON.stringify(state.openParts));
  localStorage.setItem('sc_rules_open_rules', JSON.stringify(state.openRules));
  localStorage.setItem('sc_rules_open_subs', JSON.stringify(state.openSubs));
}
function setView(view){
  state.view = view;
  views.forEach(v=>v.classList.toggle('active', v.id === 'view-' + view));
  navBtns.forEach(b=>b.classList.toggle('active', b.dataset.view === view));
  saveState();
  window.scrollTo({top:0,behavior:'smooth'});
  if(view==='search') globalSearch.focus();
}
navBtns.forEach(btn=>btn.addEventListener('click',()=>setView(btn.dataset.view)));
document.querySelectorAll('[data-go]').forEach(btn=>btn.addEventListener('click',()=>setView(btn.dataset.go)));

function escapeHtml(str){ return (str||'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function sanitizeRuleHtml(html){
  if(!html) return '';
  let out = html;
  out = out.replace(/&lt;&lt;[\s\S]*?&gt;&gt;/gi, '');
  out = out.replace(/<a5[^>]*><\/a5>/gi, '');
  out = out.replace(/<a5[^>]*>/gi, '');
  out = out.replace(/<\/?font[^>]*>/gi, '');
  out = out.replace(/<br\s*\/?>\s*&lt;&gt;\s*(?:<br\s*\/?>)?/gi, '<br/>');
  out = out.replace(/&lt;&gt;/g, '');
  out = out.replace(/<span>\s*((?:\d+\.){2,}\d+\s*[^<]*)<\/span>/g, '<div class="inline-subhead">$1</div>');
  out = out.replace(/<strong>\s*((?:\d+\.){2,}\d+\s*[^<]*)<\/strong>/g, '<div class="inline-subhead">$1</div>');
  return out;
}
function normalizeInlineSpacing(html){
  if(!html) return '';
  let out = sanitizeRuleHtml(html);
  out = out.replace(/>([A-Za-z0-9(])/g, '> $1');
  out = out.replace(/([A-Za-z0-9,.;:!?)])</g, '$1 <');
  out = out.replace(/\s+(<\/(?:span|strong|em|b|i)>)/g, '$1');
  out = out.replace(/(<(?:span|strong|em|b|i)[^>]*>)\s+/g, '$1');
  out = out.replace(/\s{2,}/g, ' ');
  out = out.replace(/>\s+</g, '><');
  return out.trim();
}
function stripHtml(html){ const div=document.createElement('div'); div.innerHTML=html; return div.textContent || div.innerText || ''; }
function highlightText(text,q){ if(!q) return escapeHtml(text); const safe = q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); const re = new RegExp('(' + safe + ')','ig'); return escapeHtml(text).replace(re,'<mark>$1</mark>'); }
function getPartById(id){ return APP_DATA.parts.find(p=>p.id===id); }
function toggleBookmark(id){
  const idx = state.bookmarks.indexOf(id);
  if(idx>=0) state.bookmarks.splice(idx,1); else state.bookmarks.unshift(id);
  saveState(); renderRules(); renderSaved(); renderHome(); renderSearch();
}
function addRecent(item){
  state.recents = [item, ...state.recents.filter(x=>x.id!==item.id)].slice(0,10);
  localStorage.setItem('sc_rules_last', JSON.stringify(item));
  saveState();
  renderHome(); renderSaved();
}
function jumpTo(targetId, open=true){
  const [partId, ruleId, subId] = targetId.split('::');
  if(partId) state.openParts[partId]=true;
  if(ruleId) state.openRules[partId+'::'+ruleId]=true;
  if(subId) state.openSubs[partId+'::'+ruleId+'::'+subId]=true;
  saveState();
  setView('rules');
  renderRules();
  requestAnimationFrame(()=>{
    const el = document.querySelector(`[data-target="${CSS.escape(targetId)}"]`);
    if(el) el.scrollIntoView({behavior:'smooth', block:'start'});
  });
}

function partChip(part){ return `<span class="ref-pill">Part ${part.num}</span>`; }

function renderHome(){
  const homeParts = document.getElementById('homeParts');
  homeParts.innerHTML = APP_DATA.parts.map(p=>`<button class="tile" style="--accent:${p.color}" onclick="jumpTo('${p.id}')"><div class="tile-top"><div><div class="tile-kicker">${p.kicker}</div><div class="tile-title">${p.title}</div><div class="tile-meta">${p.rules.length} rule blocks</div></div><div class="tile-tail">›</div></div></button>`).join('');
  const last = JSON.parse(localStorage.getItem('sc_rules_last') || 'null');
  document.getElementById('lastReadNote').textContent = last ? last.title : 'No recent section yet';
  const continueBtn = document.getElementById('continueBtn');
  continueBtn.disabled = !last;
  continueBtn.textContent = last ? 'Continue: ' + (last.title.length>24 ? last.title.slice(0,24)+'…' : last.title) : 'Continue Reading';
  continueBtn.onclick = ()=> last && jumpTo(last.id);

  const recentWrap = document.getElementById('recentList');
  recentWrap.innerHTML = state.recents.length ? state.recents.map(r=>`<button class="mini-card" onclick="jumpTo('${r.id}')"><div class="mini-card-title"><span>${escapeHtml(r.title)}</span><span class="ref-pill">${r.partLabel}</span></div><div class="mini-card-sub">${escapeHtml(r.parent || 'Recently opened')}</div></button>`).join('') : `<div class="saved-empty">Your recent sections will appear here as you use the rulebook.</div>`;

  const savedPreview = document.getElementById('savedPreview');
  const saved = state.bookmarks.slice(0,4).map(id=>resolveItem(id)).filter(Boolean);
  savedPreview.innerHTML = saved.length ? saved.map(r=>`<button class="mini-card" onclick="jumpTo('${r.id}')"><div class="mini-card-title"><span>${escapeHtml(r.title)}</span><span>★</span></div><div class="mini-card-sub">${r.partLabel}</div></button>`).join('') : `<div class="saved-empty">Bookmark a rule to pin it for fast lookup mid-game.</div>`;
}

function renderTOC(){
  document.getElementById('tocList').innerHTML = APP_DATA.parts.map(p=>`<button class="toc-item" style="--accent:${p.color}" onclick="closeSheet();jumpTo('${p.id}')"><span class="toc-strip"></span><span class="toc-text"><div class="toc-kicker">${p.kicker}</div><div class="toc-title">${p.title}</div></span><span class="toc-arrow">›</span></button>`).join('');
}


function formatRuleSegments(sourceHtml){
  const source = normalizeInlineSpacing(sourceHtml).replace(/<br\s*\/?>\s*<br\s*\/?>/gi,'[[RULE_BREAK]]');
  const temp = document.createElement('div');
  temp.innerHTML = source;
  const parts = temp.innerHTML.split('[[RULE_BREAK]]').map(s=>s.trim()).filter(Boolean);
  const out = [];
  let bullets = [];
  const flushBullets = () => {
    if(!bullets.length) return;
    out.push(`<div class="rule-bullets">${bullets.map(item=>`<div class="rule-bullet">${item.replace(/^•\s*/, '')}</div>`).join('')}</div>`);
    bullets = [];
  };
  for(const part of parts){
    const plain = stripHtml(part).replace(/\s+/g,' ').trim();
    const isBullet = /^•\s*/.test(plain);
    const isEmbed = /<(table|img|figure|blockquote|ul|ol|div class=\"stack-table\")\b/i.test(part);
    if(isBullet){
      bullets.push(part);
      continue;
    }
    flushBullets();
    out.push(`<div class="${isEmbed ? 'rule-embed' : 'rule-block'}">${part}</div>`);
  }
  flushBullets();
  return out.join('');
}
function formatRuleHtml(raw){
  const source = normalizeInlineSpacing(raw);
  const marked = source.replace(/<div class="inline-subhead">([\s\S]*?)<\/div>/gi, '[[SUBHEAD::$1]]');
  const tokens = marked.split(/(\[\[SUBHEAD::[\s\S]*?\]\])/g).filter(Boolean);
  const sections = [];
  let currentTitle = '';
  let currentHtml = '';
  for(const token of tokens){
    const m = token.match(/^\[\[SUBHEAD::([\s\S]*?)\]\]$/);
    if(m){
      if(currentTitle || currentHtml.trim()) sections.push({title: currentTitle, html: currentHtml});
      currentTitle = stripHtml(m[1]).trim();
      currentHtml = '';
    } else {
      currentHtml += token;
    }
  }
  if(currentTitle || currentHtml.trim()) sections.push({title: currentTitle, html: currentHtml});
  if(sections.some(s => s.title)){
    return `<div class="rule-structured">${sections.map(sec => sec.title ? `<section class="inline-section"><div class="inline-section-title">${escapeHtml(sec.title)}</div>${formatRuleSegments(sec.html)}</section>` : formatRuleSegments(sec.html)).join('')}</div>`;
  }
  return `<div class="rule-structured">${formatRuleSegments(source)}</div>`;
}

function ruleBodyHtml(rule, part){
  const key = part.id + '::' + rule.id;
  const open = !!state.openRules[key];
  const starred = state.bookmarks.includes(key);
  return `
  <div class="rule-card ${open?'open':''}" data-target="${key}">
    <div class="rule-head" onclick="toggleRule('${part.id}','${rule.id}')">
      <div class="rule-title">${escapeHtml(rule.title)}</div>
      <div class="rule-tools">
        <span class="ref-pill">${part.num}</span>
        <button class="mini-btn ${starred?'active':''}" onclick="event.stopPropagation();toggleBookmark('${key}')" aria-label="Bookmark">★</button>
        <span class="chev">›</span>
      </div>
    </div>
    <div class="rule-body">
      <div class="rule-copyline"><small>${escapeHtml(part.kicker + ' / ' + part.title)}</small><button class="cta" style="min-height:36px;padding:6px 10px" onclick="copyLink('${key}','${escapeHtml(rule.title)}')">Copy ref</button></div>
      <div class="rule-prose">${formatRuleHtml(rule.html)}</div>
      ${rule.children.map(sub=>subBodyHtml(sub, part, rule)).join('')}
    </div>
  </div>`;
}
function subBodyHtml(sub, part, rule){
  const key = part.id + '::' + rule.id + '::' + sub.id;
  const open = !!state.openSubs[key];
  const starred = state.bookmarks.includes(key);
  return `
    <div class="sub-card ${open?'open':''}" data-target="${key}">
      <div class="sub-head" onclick="toggleSub('${part.id}','${rule.id}','${sub.id}')">
        <div class="sub-title">${escapeHtml(sub.title)}</div>
        <div class="rule-tools"><button class="mini-btn ${starred?'active':''}" onclick="event.stopPropagation();toggleBookmark('${key}')">★</button><span class="chev">›</span></div>
      </div>
      <div class="sub-body">
        <div class="sub-prose">${formatRuleHtml(sub.html)}</div>
      </div>
    </div>`;
}
function resolveItem(id){
  const parts = APP_DATA.parts;
  const segs = id.split('::');
  const part = parts.find(p=>p.id===segs[0]);
  if(!part) return null;
  if(segs.length===1) return {id, title: part.title, partLabel: part.kicker, parent: 'Part'};
  const rule = part.rules.find(r=>r.id===segs[1]);
  if(!rule) return null;
  if(segs.length===2) return {id, title: rule.title, partLabel: part.kicker, parent: part.title};
  const sub = rule.children.find(s=>s.id===segs[2]);
  if(!sub) return null;
  return {id, title: sub.title, partLabel: part.kicker, parent: rule.title};
}
function renderRules(){
  const q = browseSearch.value.trim().toLowerCase();
  const partsWrap = document.getElementById('rulesParts');
  partsWrap.innerHTML = APP_DATA.parts.map(part=>{
    const pOpen = !!state.openParts[part.id];
    let rules = part.rules;
    if(q) rules = rules.filter(r => (r.title + ' ' + stripHtml(r.html) + ' ' + r.children.map(s=>s.title+' '+stripHtml(s.html)).join(' ')).toLowerCase().includes(q));
    if(q && !rules.length && !(part.title + ' ' + stripHtml(part.intro)).toLowerCase().includes(q)) return '';
    return `
      <div class="part-card ${pOpen?'open':''}" style="--accent:${part.color}">
        <div class="part-head" data-target="${part.id}" onclick="togglePart('${part.id}')">
          <span class="part-strip"></span>
          <div class="part-head-main">
            <div><div class="part-kicker">${part.kicker}</div><div class="part-name">${part.title}</div><div class="part-stats">${part.rules.length} sections</div></div>
          </div>
          <span class="chev">›</span>
        </div>
        <div class="part-body">
          <div class="part-intro">${normalizeInlineSpacing(part.intro)}</div>
          ${rules.map(rule=>ruleBodyHtml(rule,part)).join('')}
        </div>
      </div>`;
  }).join('');
}
function renderSearch(){
  const q = globalSearch.value.trim();
  const activePart = state.partFilter;
  const filters = ['all', ...APP_DATA.parts.map(p=>p.num)];
  document.getElementById('searchFilters').innerHTML = filters.map(f=>`<button class="filter ${f===activePart?'active':''}" onclick="setFilter('${f}')">${f==='all'?'All parts':'Part ' + f}</button>`).join('');
  const wrap = document.getElementById('searchResults');
  if(!q){
    wrap.innerHTML = `<div class="saved-empty">Search the full rules by term, phase, keyword, or section reference.</div>`;
    return;
  }
  const needle = q.toLowerCase();
  const rows = APP_DATA.searchIndex.filter(row => (activePart==='all' || row.part===activePart) && (row.title + ' ' + row.plain).toLowerCase().includes(needle)).slice(0,120);
  wrap.innerHTML = rows.length ? rows.map(row=>{
    const item = resolveItem(row.id) || {title:row.title, partLabel:'Part ' + row.part, parent:''};
    const snippetSource = row.plain || '';
    const idx = snippetSource.toLowerCase().indexOf(needle);
    const snippet = idx >=0 ? snippetSource.slice(Math.max(0, idx-60), idx+160) : snippetSource.slice(0,180);
    return `<button class="result" onclick="jumpTo('${row.id}'); addRecent({id:'${row.id}', title:'${escapeJs(item.title)}', partLabel:'${escapeJs(item.partLabel)}', parent:'${escapeJs(item.parent||'')}'})"><div class="result-top"><div class="result-title">${highlightText(item.title, q)}</div><div class="result-meta">${item.partLabel}</div></div><div class="result-snippet">${highlightText(snippet, q)}</div></button>`;
  }).join('') : `<div class="saved-empty">No results for “${escapeHtml(q)}”.</div>`;
}
function escapeJs(s){ return (s||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }
function renderQuick(){
  const quick = APP_DATA.parts.find(p=>p.num==='12') || APP_DATA.parts[APP_DATA.parts.length-1];
  document.getElementById('quickCards').innerHTML = quick.rules.map(rule=>`<div class="quick-card"><div class="quick-head">${escapeHtml(rule.title)}</div><div class="quick-body">${formatRuleHtml(rule.html)} ${rule.children.map(sub=>`<div style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--line-2)"><strong>${escapeHtml(sub.title)}</strong><div class="sub-prose" style="margin-top:4px">${formatRuleHtml(sub.html)}</div></div>`).join('')}</div></div>`).join('');
}
function renderSaved(){
  const list = document.getElementById('savedList');
  const items = state.bookmarks.map(resolveItem).filter(Boolean);
  list.innerHTML = items.length ? items.map(item=>`<button class="mini-card" style="display:block;width:100%;text-align:left;margin-bottom:8px" onclick="jumpTo('${item.id}')"><div class="mini-card-title"><span>${escapeHtml(item.title)}</span><span>★</span></div><div class="mini-card-sub">${item.partLabel} ${item.parent ? '• ' + escapeHtml(item.parent) : ''}</div></button>`).join('') : `<div class="saved-empty">No bookmarks yet. Tap ★ on any rule to save it here.</div>`;
  const history = document.getElementById('historyList');
  history.innerHTML = state.recents.length ? state.recents.map(item=>`<button class="mini-card" style="display:block;width:100%;text-align:left;margin-bottom:8px" onclick="jumpTo('${item.id}')"><div class="mini-card-title"><span>${escapeHtml(item.title)}</span><span class="ref-pill">${item.partLabel}</span></div><div class="mini-card-sub">${escapeHtml(item.parent||'Recent')}</div></button>`).join('') : `<div class="saved-empty">Recently opened rules will appear here.</div>`;
}
function togglePart(id){ state.openParts[id] = !state.openParts[id]; saveState(); renderRules(); }
function toggleRule(partId, ruleId){ const key = partId+'::'+ruleId; state.openRules[key] = !state.openRules[key]; if(state.openRules[key]) addRecent({id:key,title:resolveItem(key).title,partLabel:resolveItem(key).partLabel,parent:resolveItem(key).parent}); saveState(); renderRules(); }
function toggleSub(partId, ruleId, subId){ const key = partId+'::'+ruleId+'::'+subId; state.openSubs[key] = !state.openSubs[key]; if(state.openSubs[key]) addRecent({id:key,title:resolveItem(key).title,partLabel:resolveItem(key).partLabel,parent:resolveItem(key).parent}); saveState(); renderRules(); }
function setFilter(part){ state.partFilter = part; renderSearch(); }
function copyLink(id,title){
  const url = new URL(window.location.href); url.hash = id;
  navigator.clipboard?.writeText(url.toString());
  addRecent({id,title,partLabel:(resolveItem(id)||{partLabel:''}).partLabel,parent:(resolveItem(id)||{parent:''}).parent});
}
function openSheet(){ document.getElementById('sheetScrim').classList.add('open'); document.getElementById('tocSheet').classList.add('open'); }
function closeSheet(){ document.getElementById('sheetScrim').classList.remove('open'); document.getElementById('tocSheet').classList.remove('open'); }
document.getElementById('tocBtn').addEventListener('click', openSheet);
document.getElementById('closeSheetBtn').addEventListener('click', closeSheet);
document.getElementById('sheetScrim').addEventListener('click', closeSheet);
document.getElementById('densityBtn').addEventListener('click', ()=>{ state.density = state.density === 'comfortable' ? 'compact' : 'comfortable'; app.setAttribute('data-density', state.density); saveState(); });
document.getElementById('printBtn').addEventListener('click', ()=> window.open('print.html','_blank'));

browseSearch.addEventListener('input', renderRules);
globalSearch.addEventListener('input', renderSearch);
document.getElementById('clearBrowseSearch').addEventListener('click', ()=>{ browseSearch.value=''; renderRules(); });
document.getElementById('clearGlobalSearch').addEventListener('click', ()=>{ globalSearch.value=''; renderSearch(); });

window.addEventListener('scroll', ()=>{
  const y = window.scrollY; const h = document.documentElement.scrollHeight - window.innerHeight; const pct = h>0 ? (y/h)*100 : 0;
  document.getElementById('scrollProgress').style.width = pct + '%';
  document.getElementById('jumpTop').style.display = y > 500 ? 'block' : 'none';
});
document.querySelector('#jumpTop button').addEventListener('click', ()=>window.scrollTo({top:0,behavior:'smooth'}));
window.addEventListener('hashchange', ()=>{ if(location.hash.slice(1)) jumpTo(location.hash.slice(1)); });


function initHash(){ const hash = location.hash.slice(1); if(hash) jumpTo(hash); }
function init(){ renderTOC(); renderHome(); renderRules(); renderSearch(); renderQuick(); renderSaved(); initHash(); }

async function boot(){
  try{
    await loadAppData();
    init();
  }catch(err){
    console.error(err);
    const main = document.querySelector('.main');
    if(main){
      main.innerHTML = `<div class="loading-note"><strong>App failed to load.</strong><br>${escapeHtml(err.message || String(err))}</div>`;
    }
  }
}
boot();
