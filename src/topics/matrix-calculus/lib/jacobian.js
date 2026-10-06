// 矩阵乘法 z = x·W 的 Jacobian：滑块改变 x，指针停在一格上时高亮相关的格子，并在说明框里写出这一格的含义。
// 说明框里的公式由浏览器端 MathJax 排版。
import { typeset } from '../../../lib/math.js';

const W=[[1,-2,0.5],[0.5,1,-1]]; // W[i-1][j-1]，x 长度 2，z 长度 3
const z=v=>[0,1,2].map(j=>v[0]*W[0][j]+v[1]*W[1][j]);
const f2=v=>(v<0?'−':'')+Math.abs(v).toFixed(2), f3=v=>(v<0?'−':'')+Math.abs(v).toFixed(3);
const X=i=>`<span style="color:var(--s3)">$x_{${i}}$</span>`, Z=j=>`<span style="color:var(--s5)">$z_{${j}}$</span>`;
const zExpr=j=>`${Z(j)} $= ${W[0][j-1]}\\,x_1 ${W[1][j-1]<0?'-':'+'} ${Math.abs(W[1][j-1])}\\,x_2$`;

export function initJacobian(fig){
  const q=s=>fig.querySelector(`[data-jac="${s}"]`), say=q('say');
  let x=[1,-0.5], prev=[1,-0.5], prevZ=null;
  // 排版按顺序进行，前一次没有完成时下一次排在它后面
  let queue=Promise.resolve();
  const retypeset=()=>{queue=queue.then(()=>typeset([say])).catch(()=>{});};
  function render(moved){
    const zz=z(x);
    [1,2].forEach(i=>{q('x'+i+'v').textContent=x[i-1].toFixed(2);q('x'+i+'c').textContent=f2(x[i-1]);});
    [1,2,3].forEach(j=>q('z'+j).textContent=f3(zz[j-1]));
    if(moved!=null&&prevZ){
      const dxi=x[moved]-prev[moved];
      if(Math.abs(dxi)>1e-9){
        const ratios=zz.map((v,j)=>f2((v-prevZ[j])/dxi));
        say.innerHTML=`${X(moved+1)} 变化 <b>${f2(dxi)}</b>，三个输出分别变化 <b>${zz.map((v,j)=>f3(v-prevZ[j])).join('　')}</b>，比值 <b>${ratios.join('　')}</b>，即 $J$ 的第 ${moved+1} 列，也就是 $W$ 的第 ${moved+1} 行。`;
        retypeset();
      }
    }
    prev=[...x]; prevZ=zz;
  }
  [1,2].forEach(i=>{const inp=q('x'+i); inp.addEventListener('input',()=>{x[i-1]=+inp.value;render(i-1);});});
  const cells=[...fig.querySelectorAll('.mat .c')];
  const clear=()=>cells.forEach(o=>o.classList.remove('on'));
  const on=sel=>fig.querySelectorAll(sel).forEach(o=>o.classList.add('on'));
  cells.forEach(c=>{
    const d=c.dataset;
    c.addEventListener('pointerenter',()=>{
      clear(); c.classList.add('on');
      if(d.x){ // 输入 x_i
        const i=+d.x; on(`.mat.w .c[data-i="${i}"]`); on('.mat.z .c');
        on(`.mat.dx .c[data-di="${i}"]`);
        say.innerHTML=`${X(i)} 变化时三个输出的变化率：${zExpr(1)}，${zExpr(2)}，${zExpr(3)}，其中 $x_{${i}}$ 的系数依次是 <b>${W[i-1].join('　')}</b>，即 $J$ 的第 ${i} 列，也就是 $W$ 的第 ${i} 行。这三个数不含 $\\mathbf{x}$，所以不随滑块变。`;
      }else if(d.i){ // 权重 W_ij
        const i=+d.i,j=+d.j; on(`.mat.x .c[data-x="${i}"]`); on(`.mat.z .c[data-z="${j}"]`);
        on(`.mat.dx .c[data-di="${i}"][data-j="${j}"]`);
        say.innerHTML=`$W_{${i}${j}}$ 是 ${zExpr(j)} 中 ${X(i)} 的系数，所以 $\\partial z_{${j}} / \\partial x_{${i}} = W_{${i}${j}}$ = <b>${W[i-1][j-1]}</b>，它位于 $J$ 的第 ${j} 行第 ${i} 列。`;
      }else if(d.z){ // 输出 z_j
        const j=+d.z, zz=z(x); on(`.mat.w .c[data-j="${j}"]`); on('.mat.x .c');
        const val=`${zExpr(j)} $= ${W[0][j-1]} \\times (${(x[0]).toFixed(2)}) ${W[1][j-1]<0?'-':'+'} ${Math.abs(W[1][j-1])} \\times (${(x[1]).toFixed(2)})$ = <b>${f3(zz[j-1])}</b>。`;
        on(`.mat.dx .c[data-j="${j}"]`);
        say.innerHTML=val+`它对 $x_1$、$x_2$ 的偏导数是 $W$ 的第 ${j} 列 <b>${W[0][j-1]}　${W[1][j-1]}</b>，也就是 $z_{${j}}$ 的梯度，即 $J$ 的第 ${j} 行。`;
      }else if(d.di){ // J 的一格
        const i=+d.di,j=+d.j; on(`.mat.w .c[data-i="${i}"][data-j="${j}"]`); on(`.mat.x .c[data-x="${i}"]`); on(`.mat.z .c[data-z="${j}"]`);
        say.innerHTML=`$\\partial z_{${j}} / \\partial x_{${i}} = W_{${i}${j}}$ = <b>${W[i-1][j-1]}</b>：${X(i)} 变化时 ${Z(j)} 的变化率是 ${W[i-1][j-1]}。`;
      }
      retypeset();
    });
  });
  fig.querySelectorAll('.mat').forEach(m=>m.addEventListener('pointerleave',clear));
  render(null);
}
