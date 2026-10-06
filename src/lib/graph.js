// 计算图：drawChain 沿竖直方向画一串节点，drawGraph 按给定坐标画有分支的图。
// 依赖浏览器端 MathJax（节点标签里的公式），样式在 src/styles/graph.css，容器需要带 model-wrap 类。
import { el, label, addMarkers } from './svg.js';
import '../styles/graph.css';

// 沿竖直方向依次画一串节点：方框是运算，圆角框是数据，plus 是残差相加
export function drawChain(svg,svgId,items,o){
  const CX=o.CX, BW=o.BW||270, BH=46, PW=o.PW||230, PH=30, RX=CX+160, GAP=o.gap||30;
  const lb=(x,y,t,fs,align,cls,color)=>label(svg,x,y,t,fs,align,cls,color);
  let y=o.y0||8, res=null, lastPill=null;
  const late=[], marks={}; // 残差线最后画，避免压住节点
  function tag(x,y,text,kind){ // kind: 'bf' | 'fp' | 'int'
    const w=text.length>4?42:36;
    svg.appendChild(el('rect',{x:x-w,y,width:w,height:14,class:'tagbox '+kind}));
    lb(x-w/2,y+10.5,text,9.5,'middle','tag '+kind);
  }
  function arrow(y1,y2){svg.appendChild(el('path',{d:`M${CX},${y1} L${CX},${y2-2}`,class:'e',style:`marker-end:url(#arr-${svgId})`}));}
  items.forEach((it,idx)=>{
    const top=idx?y+GAP:y; if(idx)arrow(y,it.plus?y+GAP:top);
    if(it.plus){
      const cy=y+GAP+10;
      svg.appendChild(el('circle',{cx:CX,cy,r:10,class:'plus'})); lb(CX,cy+5,'+',14,'middle','plus');
      const from=res; late.push(()=>svg.appendChild(el('path',{d:`M${from.x},${from.y} L${RX},${from.y} L${RX},${cy} L${CX+13},${cy}`,class:'r',style:`marker-end:url(#arrb-${svgId})`})));
      if(it.mark)marks[it.mark]={top:cy-10,bot:cy+10,x:CX-10,w:20};
      y=cy+10; return;
    }
    if(it.act){
      svg.appendChild(el('rect',{x:CX-PW/2,y:top,width:PW,height:PH,class:'pill'}));
      lb(CX-(it.dt?16:0),top+PH/2+4.5,it.act,12.5,'middle');
      if(it.dt)tag(CX+PW/2-6,top+8,it.dt,it.dt==='BF16'?'bf':(it.dt==='FP32'?'fp':'int'));
      lastPill={x:CX+PW/2,y:top+PH/2};
      if(it.mark)marks[it.mark]={top,bot:top+PH,x:CX-PW/2,w:PW};
      y=top+PH; return;
    }
    if(it.res)res=lastPill;
    if(it.stack){svg.appendChild(el('rect',{x:CX-BW/2+8,y:top+8,width:BW,height:BH,class:'box'}));svg.appendChild(el('rect',{x:CX-BW/2+4,y:top+4,width:BW,height:BH,class:'box'}));}
    svg.appendChild(el('rect',{x:CX-BW/2,y:top,width:BW,height:BH,class:'box'}));
    if(it.w){lb(CX,top+18,it.op,12.5,'middle');lb(CX,top+37,it.w,10.5,'middle','','var(--ink-2)');}
    else lb(CX,top+BH/2+4.5,it.op,12.5,'middle');
    if(it.bf)tag(CX+BW/2-6,top+5,'BF16','bf'); if(it.fp)tag(CX+BW/2-6,top+5,'FP32','fp');
    if(it.side){const cy=top+BH/2,SL=o.sideLen||160;svg.appendChild(el('path',{d:`M${CX+BW/2+SL},${cy} L${CX+BW/2+2},${cy}`,class:'e',style:`marker-end:url(#arr-${svgId})`}));lb(CX+BW/2+SL+8,cy+4,it.side,11.5,'start','','var(--ink-2)');}
    if(it.mark)marks[it.mark]={top,bot:top+BH+(it.stack?8:0),x:CX-BW/2,w:BW+(it.stack?8:0)};
    y=top+BH+(it.stack?8:0);
  });
  late.forEach(f=>f());
  return {y,marks};
}
// 按给定坐标画有分支的计算图。节点类型：op 是运算方框，act 是数据圆角框，mul 是逐元素乘；x 是中心横坐标，y 是上边缘，W 是宽度
// 边 [起点, 终点, 横向偏移]：从起点下边缘竖直向下，在终点上方 14px 处折向终点；终点是 mul 时从侧面进入
export function drawGraph(svgId,nodes,edges,root=document){
  const svg=root.getElementById?root.getElementById(svgId):root.querySelector('#'+CSS.escape(svgId)); addMarkers(svg,svgId);
  const BH=46, PH=30, R=11;
  const bot=n=>n.y+(n.t==='op'?BH:n.t==='act'?PH:2*R);
  for(const [a,b,dx=0] of edges){
    const p=nodes[a], q=nodes[b], x=q.x+dx; let d;
    if(q.t==='mul'&&p.x!==q.x){const cy=q.y+R; d=`M${p.x},${bot(p)} L${p.x},${cy} L${q.x+(p.x<q.x?-R-2:R+2)},${cy}`;}
    else if(p.x===x)d=`M${p.x},${bot(p)} L${x},${q.y-2}`;
    else{const my=q.y-14; d=`M${p.x},${bot(p)} L${p.x},${my} L${x},${my} L${x},${q.y-2}`;}
    svg.appendChild(el('path',{d,class:'e',style:`marker-end:url(#arr-${svgId})`}));
  }
  let H=0;
  for(const n of Object.values(nodes)){
    if(n.t==='mul'){svg.appendChild(el('circle',{cx:n.x,cy:n.y+R,r:R,class:'op'}));label(svg,n.x,n.y+R+4.5,'$\\otimes$',13,'middle');}
    else if(n.t==='act'){const W=n.W||150;svg.appendChild(el('rect',{x:n.x-W/2,y:n.y,width:W,height:PH,class:'pill'}));label(svg,n.x,n.y+PH/2+4.5,n.l,12.5,'middle');}
    else{
      const W=n.W||170;svg.appendChild(el('rect',{x:n.x-W/2,y:n.y,width:W,height:BH,class:'box'}));
      if(n.w){label(svg,n.x,n.y+18,n.l,12.5,'middle');label(svg,n.x,n.y+37,n.w,10.5,'middle','','var(--ink-2)');}
      else label(svg,n.x,n.y+BH/2+4.5,n.l,12.5,'middle');
    }
    H=Math.max(H,bot(n));
  }
  svg.setAttribute('viewBox',`0 0 ${svg.viewBox.baseVal.width} ${H+8}`);
}
