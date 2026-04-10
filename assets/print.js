
async function loadManifest(){
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
  return {manifest, parts};
}
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
function formatRuleHtml(rawHtml){
  const normalized = normalizeInlineSpacing(rawHtml || '');
  const marked = normalized.replace(/<div class="inline-subhead">([\s\S]*?)<\/div>/gi, '<h4 class="inline-subhead">$1</h4>');
  const wrapper = document.createElement('div');
  wrapper.innerHTML = marked;
  wrapper.querySelectorAll('.kw-link').forEach(el=>{ el.classList.remove('kw-link'); el.classList.add('kw'); });
  wrapper.querySelectorAll('.ref-link').forEach(el=>{ el.classList.remove('ref-link'); el.classList.add('ref'); });
  wrapper.querySelectorAll('[onclick]').forEach(el=>el.removeAttribute('onclick'));
  wrapper.querySelectorAll('button').forEach(el=>el.replaceWith(...el.childNodes));
  return wrapper.innerHTML;
}
function renderPrint(parts){
  const mount = document.getElementById('printParts');
  mount.innerHTML = parts.map(part => `
    <section class="part" style="--accent:${part.color};--part-bar:${part.color}">
      <div class="part-bar"><span>${part.kicker} • ${part.title}</span></div>
      <div class="part-intro">${formatRuleHtml(part.intro)}</div>
      ${(part.rules || []).map(rule => `
        <div class="rule">
          <div class="rule-title">${rule.title}</div>
          <div class="rule-prose">${formatRuleHtml(rule.html)}</div>
          ${(rule.children || []).map(sub => `
            <div class="sub-rule">
              <div class="sub-title">${sub.title}</div>
              <div class="rule-prose">${formatRuleHtml(sub.html)}</div>
            </div>
          `).join('')}
        </div>
      `).join('')}
    </section>
  `).join('');
}
(async function boot(){
  const status = document.getElementById('printStatus');
  try{
    const {parts} = await loadManifest();
    renderPrint(parts);
    if(status) status.remove();
  }catch(err){
    console.error(err);
    if(status) status.textContent = `Failed to load printable rules: ${err.message || String(err)}`;
  }
})();
