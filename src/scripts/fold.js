// Fold 组件（<details class="fold">）展开和收起时的高度动画。
function slide(box,open,done){
  box.style.overflow='hidden';
  const h=box.scrollHeight;
  const a=box.animate(open?[{height:'0px',opacity:0},{height:h+'px',opacity:1}]:[{height:h+'px',opacity:1},{height:'0px',opacity:0}],{duration:240,easing:'ease'});
  a.onfinish=()=>{box.style.overflow='';if(done)done();};
}
document.querySelectorAll('details.fold').forEach(d=>{
  const sum=d.querySelector('summary'), body=d.querySelector('.body');
  sum.addEventListener('click',e=>{
    e.preventDefault();
    if(d.open)slide(body,false,()=>{d.open=false;});
    else{d.open=true;slide(body,true);}
  });
});

