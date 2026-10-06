// BPE 演示的页面脚本：训练阶段反复合并最高频的相邻符号对，推理阶段按学到的合并顺序切分新词。
// 页面结构见 src/pages/topics/bpe/index.astro。

const EOW = '</w>';
const $ = id => document.getElementById(id);

// ---------- 低饱和色块，按符号哈希分配 ----------
// 八组底色与文字色定义在 bpe.css 的 --bpe-chip-<序号>-bg 和 --bpe-chip-<序号>-fg 里
const PALETTE_SIZE = 8;
function colorOf(sym){
  let h=0; for(const c of sym) h=(h*31+c.charCodeAt(0))>>>0;
  return h%PALETTE_SIZE;
}
function chip(sym, cls){
  const k=colorOf(sym);
  return `<span class="sym${cls?' '+cls:''}" style="background:var(--bpe-chip-${k}-bg);color:var(--bpe-chip-${k}-fg)">${esc(sym)}</span>`;
}
function esc(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}

// ---------- 训练状态 ----------
let words = [];   // [{orig, syms:[...], freq}]
let merges = [];  // [[a,b], ...]
let lastMerged = null;
let autoTimer = null;
let snapshots = []; // 每次合并前的 syms 快照

function parseCorpus(text){
  const counts = new Map();
  for(const raw of text.split('\n')){
    const line = raw.trim(); if(!line) continue;
    const parts = line.split(/\s+/);
    const last = parts[parts.length-1];
    if(parts.length>=2 && /^\d+$/.test(last)){
      const w = parts.slice(0,-1).join('');
      counts.set(w,(counts.get(w)||0)+parseInt(last,10));
    }else{
      for(const w of parts) counts.set(w,(counts.get(w)||0)+1);
    }
  }
  return [...counts].map(([w,f])=>({orig:w, syms:[...Array.from(w), EOW], freq:f}));
}

function pairStats(){
  const stats = new Map(); // key "a\u0000b" -> {a,b,n}
  for(const w of words){
    for(let i=0;i<w.syms.length-1;i++){
      const k = w.syms[i]+'\u0000'+w.syms[i+1];
      const e = stats.get(k);
      if(e) e.n += w.freq; else stats.set(k,{a:w.syms[i],b:w.syms[i+1],n:w.freq});
    }
  }
  // 稳定排序：频次相同保持首次出现顺序（和论文实现里 max(...) 的行为一致）
  return [...stats.values()].sort((x,y)=>y.n-x.n);
}

function applyMerge(syms, a, b){
  const out=[]; const hits=[];
  for(let i=0;i<syms.length;i++){
    if(i<syms.length-1 && syms[i]===a && syms[i+1]===b){ hits.push(out.length); out.push(a+b); i++; }
    else out.push(syms[i]);
  }
  return {out, hits};
}

function currentVocab(){
  const s=new Set(); for(const w of words) for(const x of w.syms) s.add(x); return [...s];
}

// ---------- 训练渲染 ----------
function renderTrain(){
  const stats = pairStats();
  const top = stats[0];
  const max = parseInt($('maxMerges').value,10)||10;

  $('wordTable').innerHTML = words.map(w=>{
    const html = w.syms.map((s,i)=>{
      let cls='';
      if(lastMerged && (lastMerged.get(w.orig)||[]).includes(i)) cls='new';
      else if(top && i<w.syms.length-1 && s===top.a && w.syms[i+1]===top.b) cls='hit';
      else if(top && i>0 && s===top.b && w.syms[i-1]===top.a) cls='hit';
      return chip(s,cls);
    }).join('');
    return `<tr><td class="w">${esc(w.orig)}</td><td>${html}</td><td class="num">${w.freq}</td></tr>`;
  }).join('');

  $('pairs').innerHTML = stats.length
    ? stats.map((p,i)=>`<span class="pair${i===0?' top':''}"><b>${esc(p.a)}</b> <b>${esc(p.b)}</b><span class="n">×${p.n}</span></span>`).join('')
    : '<span class="empty">没有可合并的相邻对了。</span>';

  renderMergeList('mergeList','mergeEmpty',-1);
  const v = currentVocab();
  $('vocab').innerHTML = $('vocab2').innerHTML = v.map(s=>chip(s)).join('');
  $('vocabCount').textContent = $('vocabCount2').textContent = `${v.length} 个符号`;

  const done = !top || merges.length>=max;
  $('btnStep').disabled = done;
  $('btnTrainAll').disabled = done;
  $('btnBack').disabled = !snapshots.length;
  $('btnAuto').disabled = done && !autoTimer;
  $('trainStatus').textContent = top
    ? (merges.length>=max ? `已完成 ${merges.length} 次合并，可以调大目标次数继续。` : `第 ${merges.length+1} 次：将合并 ${top.a} + ${top.b}（频次 ${top.n}）`)
    : '每个词都只剩一个符号了。';
  renderMergeList('mergeList2','mergeEmpty2', -1);
}

function renderMergeList(listId, emptyId, curIdx){
  $(listId).innerHTML = merges.map(([a,b],i)=>{
    let cls = i<curIdx?'done': i===curIdx?'cur':'';
    return `<li class="${cls}">${esc(a)} ${esc(b)}<span class="arrow">→</span>${esc(a+b)}</li>`;
  }).join('');
  $(emptyId).style.display = merges.length?'none':'';
}

function stepTrain(){
  const stats = pairStats(); const top = stats[0];
  const max = parseInt($('maxMerges').value,10)||10;
  if(!top || merges.length>=max) return false;
  snapshots.push(words.map(w=>w.syms.slice()));
  merges.push([top.a,top.b]);
  lastMerged = new Map(); // word -> 合并后的新符号位置
  for(const w of words){
    const {out,hits}=applyMerge(w.syms, top.a, top.b);
    w.syms=out;
    if(hits.length) lastMerged.set(w.orig,hits);
  }
  resetInfer();
  renderTrain();
  return true;
}

function resetTrain(){
  stopAuto();
  words = parseCorpus($('corpus').value);
  merges = []; lastMerged=null; snapshots=[];
  resetInfer();
  renderTrain();
}

function stopAuto(){ if(autoTimer){clearInterval(autoTimer);autoTimer=null;$('btnAuto').textContent='自动播放';} }
$('btnAuto').addEventListener('click',()=>{
  if(autoTimer){ stopAuto(); renderTrain(); return; }
  $('btnAuto').textContent='暂停';
  autoTimer=setInterval(()=>{ if(!stepTrain()) stopAuto(); },900);
});
$('btnStep').addEventListener('click',()=>{ stopAuto(); stepTrain(); });
$('btnBack').addEventListener('click',()=>{
  stopAuto();
  if(!snapshots.length) return;
  const snap=snapshots.pop();
  words.forEach((w,i)=>{ w.syms=snap[i]; });
  merges.pop(); lastMerged=null;
  resetInfer(); renderTrain();
});
$('btnTrainAll').addEventListener('click',()=>{ stopAuto(); while(stepTrain()){} lastMerged=null; renderTrain(); });
$('btnReset').addEventListener('click',resetTrain);
$('corpus').addEventListener('input',resetTrain);
$('maxMerges').addEventListener('input',renderTrain);

// ---------- 推理 ----------
let inferState = null; // {syms, idx, log:[{i,a,b,hits,syms}], mode, done}
const mode = ()=>document.querySelector('input[name=mode]:checked').value;
function rankOf(a,b){ for(let i=0;i<merges.length;i++) if(merges[i][0]===a&&merges[i][1]===b) return i; return -1; }

function resetInfer(){
  inferState=null;
  $('steps').innerHTML=''; $('stepsEmpty').style.display='';
  $('stepsEmpty').textContent = merges.length ? '点“开始切分”。' : '先训练几步，再回来切分。';
  $('result').hidden=true;
  $('inferPairs').innerHTML='<span class="empty">还没开始。</span>';
  $('btnNext').disabled=true; $('btnInferAll').disabled=true;
  $('inferStatus').textContent='';
}

function startInfer(){
  const w = $('word').value.trim();
  if(!w){ $('inferStatus').textContent='请输入一个词。'; return; }
  inferState = {syms:[...Array.from(w), EOW], idx:0, log:[], mode:mode(), done:false};
  renderInfer();
}

function stepInfer(){
  const st=inferState; if(!st||st.done) return false;
  if(st.mode==='scan'){
    if(st.idx>=merges.length){ st.done=true; renderInfer(); return false; }
    const [a,b]=merges[st.idx];
    const {out,hits}=applyMerge(st.syms,a,b);
    st.log.push({i:st.idx,a,b,hits,syms:out});
    st.syms=out; st.idx++;
    if(st.idx>=merges.length) st.done=true;
  }else{
    let best=-1;
    for(let i=0;i<st.syms.length-1;i++){
      const r=rankOf(st.syms[i],st.syms[i+1]);
      if(r>=0 && (best<0||r<best)) best=r;
    }
    if(best<0){ st.done=true; renderInfer(); return false; }
    const [a,b]=merges[best];
    const {out,hits}=applyMerge(st.syms,a,b);
    st.log.push({i:best,a,b,hits,syms:out});
    st.syms=out; st.idx=best;
    // 预判：还有没有可用的对
    let any=false;
    for(let i=0;i<st.syms.length-1;i++) if(rankOf(st.syms[i],st.syms[i+1])>=0){any=true;break;}
    if(!any) st.done=true;
  }
  renderInfer();
  return true;
}

function renderInfer(){
  const st=inferState;
  $('stepsEmpty').style.display='none';
  let html = `<li><span class="k">起点</span><div><div class="rule">拆成字符 + ${esc(EOW)}</div>${
    [...Array.from($('word').value.trim()), EOW].map(s=>chip(s)).join('')}</div></li>`;
  html += st.log.map(e=>{
    const cls = e.hits.length?'apply':'skip';
    const syms = e.syms.map((s,i)=>chip(s, e.hits.includes(i)?'new':'')).join('');
    return `<li class="${cls}"><span class="k">规则 ${e.i+1}</span><div><div class="rule">${esc(e.a)} ${esc(e.b)} → ${esc(e.a+e.b)}</div>${syms}</div></li>`;
  }).join('');
  $('steps').innerHTML=html;
  const finished = st.done;
  $('btnNext').disabled=finished; $('btnInferAll').disabled=finished;
  $('result').hidden=!finished;
  if(finished) $('resultSyms').innerHTML = st.syms.map(s=>chip(s)).join('');
  if(finished){
    $('inferStatus').textContent = `没有规则可用了，得到 ${st.syms.length} 个 token，共应用 ${st.log.filter(e=>e.hits.length).length} 条。`;
  }else if(st.mode==='scan'){
    $('inferStatus').textContent = `已扫描 ${st.idx} / ${merges.length} 条规则，下一条：${merges[st.idx][0]} + ${merges[st.idx][1]}`;
  }else{
    let best=-1;
    for(let i=0;i<st.syms.length-1;i++){ const r=rankOf(st.syms[i],st.syms[i+1]); if(r>=0&&(best<0||r<best)) best=r; }
    $('inferStatus').textContent = `当前序列里排名最靠前的对是规则 ${best+1}：${merges[best][0]} + ${merges[best][1]}`;
  }
  // 相邻对面板
  {
    const seen=new Map();
    for(let i=0;i<st.syms.length-1;i++){
      const a=st.syms[i],b=st.syms[i+1],k=a+'\u0000'+b;
      if(!seen.has(k)) seen.set(k,{a,b,r:rankOf(a,b)});
    }
    const list=[...seen.values()];
    let next=-1;
    if(!finished){
      if(st.mode==='scan'){ const [a,b]=merges[st.idx]; next=list.findIndex(p=>p.a===a&&p.b===b); }
      else { let best=-1; list.forEach((p,i)=>{ if(p.r>=0&&(best<0||p.r<list[best].r)) best=i; }); next=best; }
    }
    $('inferPairs').innerHTML = list.length
      ? list.map((p,i)=>`<span class="pair${i===next?' top':''}${p.r<0?' unk':''}"><b>${esc(p.a)}</b> <b>${esc(p.b)}</b><span class="n">${p.r<0?'未见过':'规则 '+(p.r+1)}</span></span>`).join('')
      : '<span class="empty">只剩一个符号。</span>';
  }
  const cur = finished ? merges.length : (st.mode==='scan' ? st.idx : (()=>{let b=-1;for(let i=0;i<st.syms.length-1;i++){const r=rankOf(st.syms[i],st.syms[i+1]);if(r>=0&&(b<0||r<b))b=r;}return b;})());
  renderMergeList('mergeList2','mergeEmpty2', cur);
  const last=$('steps').lastElementChild; if(last) last.scrollIntoView({block:'nearest'});
}

$('btnTok').addEventListener('click',startInfer);
$('btnNext').addEventListener('click',stepInfer);
$('btnInferAll').addEventListener('click',()=>{ while(stepInfer()){} });
$('word').addEventListener('keydown',e=>{ if(e.key==='Enter') startInfer(); });
$('word').addEventListener('input',()=>{ if(inferState) resetInfer(); });
document.querySelectorAll('input[name=mode]').forEach(r=>r.addEventListener('change',()=>{ if(inferState) resetInfer(); }));

// ---------- tabs ----------
document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>{
  document.querySelectorAll('.tab').forEach(x=>x.setAttribute('aria-selected',x===t));
  document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('on',p.id===t.dataset.tab));
  if(t.dataset.tab==='infer'){ stopAuto(); if(!inferState) resetInfer(); else renderInfer(); }
}));

resetTrain();
