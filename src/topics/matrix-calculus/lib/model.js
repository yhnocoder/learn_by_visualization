// 本文使用的模型的计算图：完整模型（N 层 Decoder 合并成一个方框，右侧展开一层内部）、
// SwiGLU FFN 与 GQA attention 的内部计算、模型最后一段在一个位置上的计算，以及反向传播的逐步高亮。
// 依赖浏览器端 MathJax，调用前先 await mathReady()。
import { el, label, addMarkers } from '../../../lib/svg.js';
import { drawChain, drawGraph } from '../../../lib/graph.js';

const NORM=(g,mark)=>({op:'$\\mathrm{RMSNorm}$',w:`$\\gamma_{${g}}$：$d$`,fp:true,mark});
const ATTN={op:'$\\mathrm{Attention}_{\\mathrm{GQA}}$',w:'$W_Q$：$d \\times n_h d_h$　$W_K, W_V$：$d \\times n_{kv} d_h$　$W_O$：$n_h d_h \\times d$',bf:true};
const FFN={op:'$\\mathrm{FFN}_{\\mathrm{SwiGLU}}$',w:'$W_{gate}, W_{up}$：$d \\times d_{ff}$　$W_{down}$：$d_{ff} \\times d$',bf:true};
const HEAD=[
  NORM('final','normF'),
  {act:'$\\hat{X}_N \\in \\mathbb{R}^{T \\times d}$',dt:'BF16',mark:'XhN'},
  {op:'$\\mathrm{LMHead}$',w:'$W_{out}$：$d \\times V$',bf:true,mark:'head'},
  {act:'logits$\\;\\in \\mathbb{R}^{T \\times V}$',dt:'BF16',mark:'logits'},
  {op:'$\\mathrm{softmax}(\\mathrm{dim}=-1)$',fp:true,mark:'softmax'},
  {act:'$P \\in \\mathbb{R}^{T \\times V}$',dt:'FP32',mark:'P'},
  {op:'$\\mathrm{CrossEntropy}$',w:'$L = -\\tfrac{1}{T}\\sum_t \\ln P[t,\\,y_t]$',side:'target_ids$\\;y \\in \\mathbb{Z}^{T}$',fp:true,mark:'ce'},
  {act:'Loss$\\;L \\in \\mathbb{R}$',dt:'FP32',mark:'loss'},
];

/** 完整模型：主线把 N 层合并成一个 Decoder 方框，右侧展开一层内部。返回各节点的位置，键是 mark 名，右侧的节点带 d: 前缀。 */
export function buildModelCollapsed(svg){
  const svgId=svg.id; addMarkers(svg,svgId);
  const main=[
    {act:'token_ids$\\;\\in \\mathbb{Z}^{T}$',dt:'int',mark:'tok'},
    {op:'$\\mathrm{Embedding}$',w:'$E$：$V \\times d$',bf:true,mark:'emb'},
    {act:'$X_0 \\in \\mathbb{R}^{T \\times d}$',dt:'BF16',mark:'X0'},
    {op:'$\\mathrm{Decoder}_i$',w:'$i = 1, \\ldots, N$，每层结构相同，权重各自独立',stack:true,mark:'dec'},
    {act:'$X_N \\in \\mathbb{R}^{T \\times d}$',dt:'BF16',mark:'XL'},
    ...HEAD,
  ];
  const detail=[
    {act:'$X_{i-1} \\in \\mathbb{R}^{T \\times d}$',dt:'BF16',mark:'Xin'},
    {...NORM('attn','normA'),res:true},{act:'$\\hat{X} \\in \\mathbb{R}^{T \\times d}$',dt:'BF16',mark:'Xh'},
    {...ATTN,mark:'attn'},{act:'$A \\in \\mathbb{R}^{T \\times d}$',dt:'BF16',mark:'A'},{plus:true,mark:'plus1'},{act:'$Y_i \\in \\mathbb{R}^{T \\times d}$',dt:'BF16',mark:'Y'},
    {...NORM('ffn','normB'),res:true},{act:'$\\hat{Y} \\in \\mathbb{R}^{T \\times d}$',dt:'BF16',mark:'Yh'},
    {...FFN,mark:'ffn'},{act:'$H \\in \\mathbb{R}^{T \\times d}$',dt:'BF16',mark:'H'},{plus:true,mark:'plus2'},{act:'$X_i \\in \\mathbb{R}^{T \\times d}$',dt:'BF16',mark:'Xout'},
  ];
  const L=drawChain(svg,svgId,main,{CX:180,BW:250,PW:210,acts:true});
  const R=drawChain(svg,svgId,detail,{CX:545,acts:true,y0:34,gap:22});
  const dec=L.marks.dec;
  svg.prepend(el('rect',{x:395,y:8,width:357,height:R.y+2,class:'block'}));
  label(svg,404,24,'$\\mathrm{Decoder}_i$ 的内部',11,'start','','var(--ink-3)');
  // 从 Decoder 方框的右上、右下角各引一条虚线到展开框的左上、左下角，表示放大
  const bx=180+125+8, panelBot=8+R.y+2;
  svg.appendChild(el('path',{d:`M${bx},${dec.top} L395,8`,class:'zoom'}));
  svg.appendChild(el('path',{d:`M${bx},${dec.bot} L395,${panelBot}`,class:'zoom'}));
  const H=Math.max(L.y,R.y);
  label(svg,752,H+6,'$\\mathrm{Attention}_{\\mathrm{GQA}}\\;$和$\\;\\mathrm{FFN}_{\\mathrm{SwiGLU}}\\;$的内部计算见下方折叠块',11,'end','','var(--ink-3)');
  svg.setAttribute('viewBox',`0 0 760 ${H+12}`);
  const marks={...L.marks}; for(const k in R.marks)marks['d:'+k]=R.marks[k];
  return marks;
}

/** SwiGLU FFN 的内部计算。 */
export function buildFfn(svg){
  const LIN='$\\mathrm{Linear}$';
  drawGraph(svg.id,{
    x:{t:'act',x:198,y:8,W:130,l:'$\\mathbf{x} \\in \\mathbb{R}^{d}$'},
    lg:{t:'op',x:93,y:70,l:LIN,w:'$W_{gate}$：$d \\times d_{ff}$'},
    lu:{t:'op',x:303,y:70,l:LIN,w:'$W_{up}$：$d \\times d_{ff}$'},
    a:{t:'act',x:93,y:146,l:'$\\mathbf{a} \\in \\mathbb{R}^{d_{ff}}$'},
    b:{t:'act',x:303,y:146,l:'$\\mathbf{b} \\in \\mathbb{R}^{d_{ff}}$'},
    sw:{t:'op',x:93,y:206,l:'$\\mathrm{Swish}$'},
    mul:{t:'mul',x:198,y:276},
    u:{t:'act',x:198,y:324,l:'$\\mathbf{u} \\in \\mathbb{R}^{d_{ff}}$'},
    ld:{t:'op',x:198,y:380,l:LIN,w:'$W_{down}$：$d_{ff} \\times d$'},
    h:{t:'act',x:198,y:452,W:130,l:'$\\mathbf{h} \\in \\mathbb{R}^{d}$'},
  },[['x','lg'],['x','lu'],['lg','a'],['lu','b'],['a','sw'],['sw','mul'],['b','mul'],['mul','u'],['u','ld'],['ld','h']]);
}

/** GQA attention 一个 head 的内部计算。 */
export function buildAttn(svg){
  const LIN='$\\mathrm{Linear}$', NRM='$\\mathrm{RMSNorm}$', ROPE='$\\mathrm{RoPE}$';
  drawGraph(svg.id,{
    X:{t:'act',x:273,y:8,l:'$X \\in \\mathbb{R}^{T \\times d}$'},
    lq:{t:'op',x:93,y:70,l:LIN,w:'$W_Q^{(i)}$：$d \\times d_h$'},
    lk:{t:'op',x:273,y:70,l:LIN,w:'$W_K^{(j)}$：$d \\times d_h$'},
    lv:{t:'op',x:453,y:70,l:LIN,w:'$W_V^{(j)}$：$d \\times d_h$'},
    q:{t:'act',x:93,y:146,l:'$Q_i \\in \\mathbb{R}^{T \\times d_h}$'},
    k:{t:'act',x:273,y:146,l:'$K_j \\in \\mathbb{R}^{T \\times d_h}$'},
    v:{t:'act',x:453,y:146,l:'$V_j \\in \\mathbb{R}^{T \\times d_h}$'},
    nq:{t:'op',x:93,y:206,l:NRM,w:'$\\gamma_q$：$d_h$'},
    nk:{t:'op',x:273,y:206,l:NRM,w:'$\\gamma_k$：$d_h$'},
    rq:{t:'op',x:93,y:282,l:ROPE},
    rk:{t:'op',x:273,y:282,l:ROPE},
    tq:{t:'act',x:93,y:358,l:'$\\tilde{Q}_i \\in \\mathbb{R}^{T \\times d_h}$'},
    tk:{t:'act',x:273,y:358,l:'$\\tilde{K}_j \\in \\mathbb{R}^{T \\times d_h}$'},
    sc:{t:'op',x:183,y:432,W:220,l:'$\\tilde{Q}_i\\tilde{K}_j^{T} / \\sqrt{d_h} + M$'},
    S:{t:'act',x:183,y:508,l:'$S_i \\in \\mathbb{R}^{T \\times T}$'},
    sm:{t:'op',x:183,y:568,W:200,l:'$\\mathrm{softmax}(\\mathrm{dim}=-1)$'},
    P:{t:'act',x:183,y:644,l:'$P_i \\in \\mathbb{R}^{T \\times T}$'},
    pv:{t:'op',x:303,y:718,l:'$P_iV_j$'},
    Ai:{t:'act',x:303,y:794,l:'$A_i \\in \\mathbb{R}^{T \\times d_h}$'},
    cat:{t:'op',x:303,y:854,W:220,l:'$\\mathrm{Concat}$',w:'$[A_1 \\cdots A_{n_h}] \\in \\mathbb{R}^{T \\times n_h d_h}$'},
    lo:{t:'op',x:303,y:930,l:LIN,w:'$W_O$：$n_h d_h \\times d$'},
    A:{t:'act',x:303,y:1006,l:'$A \\in \\mathbb{R}^{T \\times d}$'},
  },[['X','lq'],['X','lk'],['X','lv'],['lq','q'],['lk','k'],['lv','v'],['q','nq'],['k','nk'],['nq','rq'],['nk','rk'],['rq','tq'],['rk','tk'],
     ['tq','sc',-50],['tk','sc',50],['sc','S'],['S','sm'],['sm','P'],['P','pv',-50],['v','pv',50],['pv','Ai'],['Ai','cat'],['cat','lo'],['lo','A']]);
}

/** 模型最后一段在一个位置上的计算，from 到 to 之间的节点加高亮框。brace 给出时在左侧画大括号和标签。 */
export function buildTail(svg,from,to,brace){
  const svgId=svg.id; addMarkers(svg,svgId);
  const {marks}=drawChain(svg,svgId,[
    {act:'$\\mathbf{x} \\in \\mathbb{R}^{d}$',mark:'x'},
    {op:'$\\mathrm{LMHead}$',w:'$W_{out}$：$d \\times V$',mark:'head'},
    {act:'logits$\\;\\mathbf{z} \\in \\mathbb{R}^{V}$',mark:'z'},
    {op:'$\\mathrm{softmax}$',mark:'softmax'},
    {act:'$\\mathbf{p} \\in \\mathbb{R}^{V}$',mark:'p'},
    {op:'$\\mathrm{CrossEntropy}$',w:'$\\ell = -\\ln p_y$',side:'目标 token$\\;y$',mark:'ce'},
    {act:'Loss$\\;\\ell \\in \\mathbb{R}$',mark:'loss'},
  ],{CX:150,BW:230,PW:195,gap:18,sideLen:30});
  const keys=Object.keys(marks), ms=keys.slice(keys.indexOf(from),keys.indexOf(to)+1).map(k=>marks[k]);
  const x0=Math.min(...ms.map(m=>m.x)), x1=Math.max(...ms.map(m=>m.x+m.w));
  svg.appendChild(el('rect',{x:x0-6,y:marks[from].top-6,width:x1-x0+12,height:marks[to].bot-marks[from].top+12,rx:9,class:'hlrect',style:'fill:none'}));
  if(brace){ // 左侧大括号，开口朝右，从 brace.from 的上边缘到 brace.to 的下边缘
    const y1=marks[brace.from].top, y2=marks[brace.to].bot, ym=(y1+y2)/2, w=7;
    const x=Math.min(...keys.map(k=>marks[k].x))-8;
    svg.appendChild(el('path',{d:`M${x},${y1} q${-w},0 ${-w},${w} L${x-w},${ym-w} q0,${w} ${-w},${w} q${w},0 ${w},${w} L${x-w},${y2-w} q0,${w} ${w},${w}`,class:'brace'}));
    label(svg,x-2*w-6,ym+5,brace.label,12.5,'end');
  }
  const bb=svg.getBBox();
  svg.setAttribute('viewBox',`${bb.x-4} ${bb.y-4} ${bb.width+8} ${bb.height+8}`);
}

/** 反向传播的逐步说明：fig 里有完整模型的 svg、上一步与下一步按钮、计数和各步的说明（.step，data-marks 是要高亮的节点）。 */
export function initBackprop(fig){
  const svg=fig.querySelector('svg');
  const marks=buildModelCollapsed(svg);
  const hl=el('g',{}); svg.appendChild(hl);
  const steps=[...fig.querySelectorAll('.step')];
  const prev=fig.querySelector('[data-bp="prev"]'), next=fig.querySelector('[data-bp="next"]'), cnt=fig.querySelector('[data-bp="count"]');
  let i=0;
  function show(){
    steps.forEach((d,k)=>d.hidden=k!==i);
    hl.innerHTML='';
    (steps[i].dataset.marks||'').split(' ').filter(Boolean).forEach(name=>{const m=marks[name];if(m)hl.appendChild(el('rect',{x:m.x-5,y:m.top-5,width:m.w+10,height:m.bot-m.top+10,rx:9,class:'hlrect'}));});
    cnt.textContent=`第 ${i+1} / ${steps.length} 步`;
    prev.disabled=i===0; next.disabled=i===steps.length-1;
  }
  prev.addEventListener('click',()=>{if(i>0){i--;show();}});
  next.addEventListener('click',()=>{if(i<steps.length-1){i++;show();}});
  show();
}
