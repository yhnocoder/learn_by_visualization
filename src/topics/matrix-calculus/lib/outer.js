// 权重梯度的两张图：一个位置的外积 x^T · ∂L/∂z，以及 T 个位置的外积之和 X^T G。
// 矩阵的格子由脚本按数据生成；指针停在一格上时高亮参与计算的格子，并在说明框里写出这一格的计算。
// 说明框里的公式由浏览器端 MathJax 排版。
import { typeset } from '../../../lib/math.js';

const fmt=v=>(v<0?'−':'')+Math.abs(v), par=v=>v<0?`(${fmt(v)})`:fmt(v);

/** fig 里的 .mat[data-m] 是要填充的矩阵：x 是输入，g 是 Loss 对输出的导数，o0、o1… 是各位置的外积，s 是外积之和。
 *  X 的第 t 行是位置 t 的输入，G 的第 t 行是 Loss 对位置 t 输出的导数。 */
export function initOuter(fig,X,G){
  const say=fig.querySelector('.say');
  const T=X.length, n=X[0].length, m=G[0].length, sum=T>1;
  const O=X.map((x,t)=>x.map(xi=>G[t].map(g=>xi*g)));   // O[t] 是位置 t 的外积
  const S=O[0].map((row,i)=>row.map((_,j)=>O.reduce((a,o)=>a+o[i][j],0)));
  const cell=(r,t,i,j,v)=>`<div class="c" data-r="${r}" data-t="${t}" data-i="${i}" data-j="${j}"><b>${fmt(v)}</b></div>`;
  const fill=(el,rows,cols,f)=>{el.style.gridTemplateColumns=`repeat(${cols},auto)`;let h='';for(let a=0;a<rows;a++)for(let b=0;b<cols;b++)h+=f(a,b);el.innerHTML=h;};
  fig.querySelectorAll('.mat').forEach(el=>{
    const k=el.dataset.m;
    if(k==='x'){ if(sum) fill(el,T,n,(t,i)=>cell('x',t,i,-1,X[t][i])); else fill(el,n,1,i=>cell('x',0,i,-1,X[0][i])); }
    else if(k==='g') fill(el,T,m,(t,j)=>cell('g',t,-1,j,G[t][j]));
    else if(k==='s') fill(el,n,m,(i,j)=>cell('s',-1,i,j,S[i][j]));
    else { const t=+k.slice(1); fill(el,n,m,(i,j)=>cell('o',t,i,j,O[t][i][j])); }
  });
  // 排版按顺序进行，前一次没有完成时下一次排在它后面
  let queue=Promise.resolve();
  const retypeset=()=>{queue=queue.then(()=>typeset([say])).catch(()=>{});};
  const cells=[...fig.querySelectorAll('.mat .c')];
  const clear=()=>cells.forEach(o=>o.classList.remove('on'));
  const on=sel=>fig.querySelectorAll(`.mat .c${sel}`).forEach(o=>o.classList.add('on'));
  const prod=(t,i,j)=>`${par(X[t][i])} × ${par(G[t][j])} = <b>${fmt(O[t][i][j])}</b>`;
  cells.forEach(el=>el.addEventListener('pointerenter',()=>{
    clear(); el.classList.add('on');
    const r=el.dataset.r, t=+el.dataset.t, i=+el.dataset.i, j=+el.dataset.j, I=i+1, J=j+1, P=t+1;
    if(r==='o'){
      on(`[data-r="x"][data-t="${t}"][data-i="${i}"]`); on(`[data-r="g"][data-t="${t}"][data-j="${j}"]`); on(`[data-r="s"][data-i="${i}"][data-j="${j}"]`);
      say.innerHTML=sum
        ? `位置 ${P} 的外积第 ${I} 行第 ${J} 列：$X_{${P}${I}}\\,G_{${P}${J}}$ = ${prod(t,i,j)}。它是 $X^{T}G$ 同一格求和中的一项。`
        : `第 ${I} 行第 ${J} 列：$x_{${I}}\\,\\partial L / \\partial z_{${J}}$ = ${prod(t,i,j)}。`;
    }else if(r==='s'){
      on(`[data-r="o"][data-i="${i}"][data-j="${j}"]`); on(`[data-r="x"][data-i="${i}"]`); on(`[data-r="g"][data-j="${j}"]`);
      say.innerHTML=`$\\partial L / \\partial W_{${I}${J}} = \\sum_t X_{t${I}}\\,G_{t${J}}$ = ${X.map((_,t)=>`${par(X[t][i])} × ${par(G[t][j])}`).join(' + ')} = <b>${fmt(S[i][j])}</b>，三项依次来自三个位置。`;
    }else if(r==='x'){
      on(`[data-r="o"][data-t="${t}"][data-i="${i}"]`); on(`[data-r="g"][data-t="${t}"]`);
      const row=`<b>${O[t][i].map(fmt).join('　')}</b>`;
      say.innerHTML=sum
        ? `$X_{${P}${I}}$ = <b>${fmt(X[t][i])}</b> 乘 $G$ 的第 ${P} 行，得到位置 ${P} 的外积的第 ${I} 行 ${row}。`
        : `$x_{${I}}$ = <b>${fmt(X[t][i])}</b> 乘 $\\partial L / \\partial \\mathbf{z}$，得到第 ${I} 行 ${row}。`;
    }else{
      on(`[data-r="o"][data-t="${t}"][data-j="${j}"]`); on(`[data-r="x"][data-t="${t}"]`);
      const col=`<b>${O[t].map(row=>fmt(row[j])).join('　')}</b>`;
      say.innerHTML=sum
        ? `$G_{${P}${J}}$ = <b>${fmt(G[t][j])}</b> 乘 $X$ 第 ${P} 行的转置，得到位置 ${P} 的外积的第 ${J} 列 ${col}。`
        : `$\\partial L / \\partial z_{${J}}$ = <b>${fmt(G[t][j])}</b> 乘 $\\mathbf{x}^{T}$，得到第 ${J} 列 ${col}。`;
    }
    retypeset();
  }));
  fig.querySelectorAll('.mat').forEach(el=>el.addEventListener('pointerleave',clear));
}
