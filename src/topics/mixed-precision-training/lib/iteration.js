// 第五节的一次迭代演示：以 Qwen3 dense 模型为例，按四种实现（torch.amp、DeepSpeed FP16_Optimizer、
// Megatron-LM 默认路径、Megatron-LM precision-aware optimizer）逐步执行同一次前向与反向，
// 给出每一步高亮的源码行、模块图状态与显存时间线，以及四种实现的对比表和每个模块的参数量、激活值、FLOPs 表。
// 页面元素由 IterationControls、IterationDemo、IterationCompare、ModuleTable 四个组件输出。
// 它们共用同一组模型配置，所以由 initIteration() 一次初始化，重复调用不做任何事。
import { num, esc, niceStep, mkPlot } from './common.js';

const $ = id => document.getElementById(id);
let started = false;

export function initIteration(){
  if(started) return;
  started = true;
  const GiB=1073741824;
  const QWEN3={
    '0.6B':{h:1024,I:3072,L:28,a:16,g:8,d:128,V:151936,tie:true},
    '1.7B':{h:2048,I:6144,L:28,a:16,g:8,d:128,V:151936,tie:true},
    '4B':{h:2560,I:9728,L:36,a:32,g:8,d:128,V:151936,tie:true},
    '8B':{h:4096,I:12288,L:36,a:32,g:8,d:128,V:151936,tie:false},
    '14B':{h:5120,I:17408,L:40,a:40,g:8,d:128,V:151936,tie:false},
    '32B':{h:5120,I:25600,L:64,a:64,g:8,d:128,V:151936,tie:false},
  };
  const PREC={gemm:{n:'GEMM：fp16 输入 · fp32 累加 · fp16 输出',c:'var(--s1)'},red:{n:'reduction：fp16 输入 · 升到 fp32 计算 · fp16 输出',c:'var(--s7)'},pw:{n:'逐元素 / 查表：fp16 输入 · fp16 输出',c:'var(--s3)'},f32:{n:'fp32 输入 · fp32 输出',c:'var(--s8)'}};
  $('it-prec-legend').innerHTML=Object.values(PREC).map(p=>`<span><i style="--c:${p.c}"></i>${p.n}</span>`).join('');
  const modelSel=$('it-model'), sSel=$('it-s'), bIn=$('it-b'), attnSel=$('it-attn'), optSel=$('it-opt');
  const fmtB=x=>x===0?'0':x<GiB/4?num(x/1048576,3)+' MiB':num(x/GiB,3)+' GiB';
  const fmtP=x=>x===0?'—':x>=1e9?num(x/1e9,3)+' B':x>=1e6?num(x/1e6,3)+' M':x>=1e3?num(x/1e3,3)+' K':String(x);
  const fmtF=x=>x===0?'0':x>=1e12?num(x/1e12,3)+' T':x>=1e9?num(x/1e9,3)+' G':num(x/1e6,3)+' M';
  const range=(a,b)=>{ const r=[]; for(let i=a;i<b;i++) r.push(i); return r; };

  function buildModules(c,s,b,flash){
    const T=s*b,A=c.a*c.d,G=c.g*c.d,h=c.h,I=c.I,V=c.V,d=c.d;
    const smx=flash?4*b*c.a*s:2*b*c.a*s*s;
    const sh=(r,cc)=>`${r}×${cc}`;
    return [
      {id:'embed',grp:'embed',prec:['pw'],name:'embed_tokens',w:sh(V,h),params:V*h,act:0,flops:0,
        fwd:`查表：input_ids [${T}] → x [${T}×${h}]，fp16。反向只需要 token id，不保留激活值。`,
        bwd:c.tie?`embedding 与 lm_head 共享权重，梯度累加到 lm_head 反向已产生的同一张张量上。`:`按 token id 把 x 的梯度散射到对应的行，得到 [${V}×${h}] 的权重梯度。`},
      {id:'in_norm',grp:'norm',prec:['red'],name:'input_layernorm',w:h,params:h,act:2*T*h,flops:0,
        fwd:`RMSNorm：x [${T}×${h}] 在 fp32 中求均方根并归一化，输出转回 fp16。保留输入 x，${fmtB(2*T*h)}。`,
        bwd:`用保留的输入重算 rstd，得到对 x 和对缩放参数的梯度。归一化的梯度在 fp32 中计算。`},
      {id:'q_proj',grp:'attn',prec:['gemm'],name:'q_proj',w:sh(h,A),params:h*A,act:2*T*h,flops:2*T*h*A,
        fwd:`GEMM：[${T}×${h}] × [${h}×${A}]，fp16 输入，Tensor Core 内 fp32 累加，输出 fp16。保留输入（与 k_proj、v_proj 共用），${fmtB(2*T*h)}。`,
        bwd:`两个 GEMM：对输入的梯度 dY × Wᵀ，对权重的梯度 Xᵀ × dY，都在 fp32 中累加。权重梯度的形状是 [${h}×${A}]。`},
      {id:'k_proj',grp:'attn',prec:['gemm'],name:'k_proj',w:sh(h,G),params:h*G,act:0,flops:2*T*h*G,
        fwd:`GEMM：[${T}×${h}] × [${h}×${G}]。GQA 只有 ${c.g} 个 kv head，输出维度 ${G} 是 q 的 ${c.a/c.g} 分之一。输入与 q_proj 共用，不重复保留。`,
        bwd:`与 q_proj 相同的两个 GEMM，权重梯度 [${h}×${G}]。`},
      {id:'v_proj',grp:'attn',prec:['gemm'],name:'v_proj',w:sh(h,G),params:h*G,act:0,flops:2*T*h*G,
        fwd:`GEMM：[${T}×${h}] × [${h}×${G}]，输入与 q_proj 共用。`,
        bwd:`权重梯度 [${h}×${G}]。`},
      {id:'qk_norm',grp:'norm',prec:['red','pw'],name:'q_norm / k_norm + RoPE',w:`${d}, ${d}`,params:2*d,act:2*T*(A+G),flops:0,
        fwd:`对每个 head 的 ${d} 维做 RMSNorm，然后施加 RoPE。保留归一化的输入 q [${T}×${A}] 与 k [${T}×${G}]，${fmtB(2*T*(A+G))}。RoPE 是固定的旋转，反向只需要 cos、sin 表。`,
        bwd:`RoPE 的反向是逆旋转；RMSNorm 的反向用保留的 q、k 重算。`},
      {id:'scores',grp:'attn',prec:['gemm','red'],name:'softmax(q kᵀ / √d)',w:'—',params:0,act:2*T*(A+G)+smx,flops:2*T*s*A,
        fwd:`repeat_kv 把 k、v 按组复制到 ${c.a} 个 head。批量 GEMM：q [${b}×${c.a}×${s}×${d}] × kᵀ → 分数 [${b}×${c.a}×${s}×${s}]，fp32 累加。softmax 是 reduction，在 fp32 中计算后转回 fp16。保留 RoPE 之后的 q、k（${fmtB(2*T*(A+G))}）；${flash?`FlashAttention 只保留每行的 logsumexp（${fmtB(smx)}），反向时重算概率矩阵`:`朴素实现保留 softmax 输出 [${b}×${c.a}×${s}×${s}]（${fmtB(smx)}）`}。`,
        bwd:`softmax 的反向 dS = P ⊙ (dP − rowsum(dP ⊙ P))，在 fp32 中做。之后两个批量 GEMM 得到 dq、dk。`},
      {id:'av',grp:'attn',prec:['gemm'],name:'p @ v',w:'—',params:0,act:2*T*G,flops:2*T*s*A,
        fwd:`批量 GEMM：概率 [${b}×${c.a}×${s}×${s}] × v → o [${T}×${A}]，fp32 累加。保留 v，${fmtB(2*T*G)}。`,
        bwd:`两个批量 GEMM 得到 dP 与 dv；GQA 把 ${c.a/c.g} 个 head 的 dk、dv 求和到同一个 kv head。`},
      {id:'o_proj',grp:'attn',prec:['gemm','pw'],name:'o_proj + 残差',w:sh(A,h),params:A*h,act:2*T*A,flops:2*T*A*h,
        fwd:`GEMM：[${T}×${A}] × [${A}×${h}]，结果加到残差 r 上。保留输入 o，${fmtB(2*T*A)}。残差相加的反向不需要保留任何东西。`,
        bwd:`残差把梯度原样传给两条支路。o_proj 的两个 GEMM 产生 [${A}×${h}] 的权重梯度。`},
      {id:'post_norm',grp:'norm',prec:['red'],name:'post_attention_layernorm',w:h,params:h,act:2*T*h,flops:0,
        fwd:`RMSNorm，保留输入 [${T}×${h}]，${fmtB(2*T*h)}。`,
        bwd:`用保留的输入重算 rstd 求梯度。`},
      {id:'gate_up',grp:'ffn',prec:['gemm'],name:'gate_proj / up_proj',w:`${sh(h,I)} ×2`,params:2*h*I,act:2*T*h,flops:4*T*h*I,
        fwd:`两个 GEMM：[${T}×${h}] × [${h}×${I}]，输出 gate 与 up 各 [${T}×${I}]。两者共用输入，保留一次，${fmtB(2*T*h)}。这是每层参数最多的模块。`,
        bwd:`四个 GEMM，产生两个 [${h}×${I}] 的权重梯度。`},
      {id:'silu',grp:'ffn',prec:['pw'],name:'silu(gate) ⊙ up',w:'—',params:0,act:4*T*I,flops:0,
        fwd:`逐元素：act = silu(gate) · up。反向需要 gate（求 silu 的导数）和 up（乘积的另一个因子），各保留 [${T}×${I}]，${fmtB(4*T*I)}。受访存带宽限制，fp16 与 fp32 计算速度相同。`,
        bwd:`d(gate) = d(act) · up · silu′(gate)，d(up) = d(act) · silu(gate)，逐元素。`},
      {id:'down',grp:'ffn',prec:['gemm','pw'],name:'down_proj + 残差',w:sh(I,h),params:I*h,act:2*T*I,flops:2*T*I*h,
        fwd:`GEMM：[${T}×${I}] × [${I}×${h}]，结果加到残差上。保留输入 act，${fmtB(2*T*I)}。至此第 1 层前向结束。`,
        bwd:`残差把梯度分到两条支路；down_proj 的两个 GEMM 产生 [${I}×${h}] 的权重梯度。`},
      {id:'f_norm',grp:'norm',prec:['red'],name:'norm',w:h,params:h,act:2*T*h,flops:0,
        fwd:`末尾的 RMSNorm，保留输入 [${T}×${h}]，${fmtB(2*T*h)}。`,bwd:`用保留的输入求梯度。`},
      {id:'lm_head',grp:'head',prec:['gemm','f32'],name:'lm_head',w:c.tie?`${sh(h,V)}（与 embedding 共享）`:sh(h,V),params:c.tie?0:h*V,act:2*T*h,flops:2*T*h*V,
        fwd:`GEMM：[${T}×${h}] × [${h}×${V}]，输出 logits [${T}×${V}] 并上转为 fp32，${fmtB(4*T*V)}。保留输入 x，${fmtB(2*T*h)}。${c.tie?'权重与 embedding 共享。':''}`,
        bwd:`d(logits) 是 fp32 的 [${T}×${V}]。两个 GEMM 得到对 x 的梯度和 [${h}×${V}] 的权重梯度${c.tie?'（累加到共享权重上）':''}。之后释放 logits。`},
    ];
  }

  /* 四种实现共用的前向代码；FWD_MAP 给出每个模块对应前向代码的第几行 */
  const FWD_MAP={embed:[1],rest:[2],in_norm:[3,4],q_proj:[5],k_proj:[6],v_proj:[7],qk_norm:[8,9],scores:[10,11,12,13],av:[14],o_proj:[15],post_norm:[16,17],gate_up:[18],silu:[19],down:[20],f_norm:[21],lm_head:[22],loss:[23]};
  function fwdLines(ind,amp,dt){
    const p=' '.repeat(ind), q=p+'    ', lp=dt||'fp16', half=dt==='bf16'?'.bfloat16()':'.half()';
    return [
      p+'T = input_ids.numel()',
      p+'x = model.embed_tokens(input_ids)'+(amp?'         # 查表不经过 autocast':'             # [T, h] '+lp),
      p+'for layer in model.layers:                    # L 层',
      q+'r = x',
      q+'x = layer.input_layernorm(x)              # fp32 计算，转回输入精度',
      q+'q = layer.q_proj(x).view(T, a, d)'+(amp?'         # autocast 把 x、权重转 fp16':'         # '+lp+' GEMM，fp32 累加'),
      q+'k = layer.k_proj(x).view(T, g, d)',
      q+'v = layer.v_proj(x).view(T, g, d)',
      q+'q, k = layer.q_norm(q), layer.k_norm(k)   # 对 head_dim 做 RMSNorm',
      q+'q, k = apply_rotary_pos_emb(q, k, cos, sin)',
      q+'k = repeat_kv(k, a // g)                  # GQA：kv head 按组复制',
      q+'v = repeat_kv(v, a // g)',
      q+'att = q @ k.transpose(-1, -2) / d ** 0.5  # fp32 累加',
      q+'p = torch.softmax(att, dim=-1, dtype=torch.float32)'+half,
      q+'o = (p @ v).reshape(T, a * d)',
      q+'x = r + layer.o_proj(o)',
      q+'r = x',
      q+'x = layer.post_attention_layernorm(x)',
      q+'gate, up = layer.gate_proj(x), layer.up_proj(x)   # [T, I]',
      q+'act = F.silu(gate) * up',
      q+'x = r + layer.down_proj(act)',
      p+'x = model.norm(x)',
      p+'logits = model.lm_head(x).float()             # [T, V] fp32',
      p+'loss = F.cross_entropy(logits, labels)',
    ];
  }
  const LOOP='for input_ids, labels in loader:';

  /* ---- 四种实现：代码、显存类别、常驻显存与每一步的说明 ---- */
  const castP=(m,c)=>(m.grp==='attn'||m.grp==='ffn')?m.params:m.id==='lm_head'?c.h*c.V:0;
  const VARIANTS={
    amp:{
      key:'amp',name:'torch.autocast + GradScaler',
      cats:[
        {k:'w32',n:'fp32 权重（AdamW 直接更新）',c:'var(--s7)'},
        {k:'w16c',n:'autocast 的 fp16 权重副本',c:'var(--s1)'},
        {k:'m',n:'AdamW m',c:'var(--s3)'},{k:'v',n:'AdamW v',c:'var(--s6)'},
        {k:'act',n:'激活值',c:'var(--s4)'},{k:'logits',n:'logits (fp32)',c:'var(--s5)'},
        {k:'g32',n:'fp32 梯度',c:'var(--s8)'},
      ],
      pro:[
        'model = Qwen3ForCausalLM(cfg).cuda()             # 权重保持 fp32，4Ψ',
        'opt = torch.optim.AdamW(model.parameters(),      # m、v 各 4Ψ',
        '                        lr=lr, weight_decay=wd)',
        'scaler = torch.amp.GradScaler("cuda")            # init_scale 2**16',
      ],
      pre:['    with torch.autocast("cuda", dtype=torch.float16):'],
      fwdInd:8, ampComments:true,
      post:[
        '    scaler.scale(loss).backward()                 # loss × S；梯度写入 fp32 .grad',
        '    scaler.unscale_(opt)                          # 原地 ÷ S，同时记录 inf/NaN',
        '    torch.nn.utils.clip_grad_norm_(model.parameters(), clip)',
        '    scaler.step(opt)                              # 无 inf/NaN 才 opt.step()',
        '    scaler.update()                               # 溢出 S×0.5；2000 步无溢出 S×2',
        '    opt.zero_grad(set_to_none=True)               # 释放 fp32 梯度',
      ],
      resident:x=>({w32:4*x.psi,w16c:0,m:x.momB*x.psi,v:x.momB*x.psi,act:0,logits:0,g32:0}),
      idle:x=>`权重以 fp32 存储，4Ψ = ${fmtB(4*x.psi)}，AdamW 直接更新它，没有单独的 master 副本。常驻显存：fp32 权重 4Ψ、AdamW 的 m 与 v 各 ${x.momB}Ψ，合计每参数 ${4+2*x.momB} 字节。前向会临时增加 fp16 权重副本，反向会增加 fp32 梯度。`,
      preSteps:(x,push,PRE)=>push({title:'进入 autocast',mode:'pre',lines:PRE(0),d:`autocast 打开后，fp16 列表里的算子（linear、matmul、bmm 等）在执行前把 fp16 以外的输入转成 fp16；对权重这类需要梯度的叶子张量，转换结果放进权重缓存，同一次前向里再次用到同一个权重时直接复用。不在列表里的算子（embedding 查表、RMSNorm 的乘法、残差相加）按输入类型执行。`,delta:{}}),
      fwdExtra:(m,x)=>{ const cp=castP(m,x.c); return cp?{delta:{w16c:2*cp},note:` autocast 把权重转成 fp16 副本，${fmtB(2*cp)}，进入缓存并被 autograd 图保存。`}:{delta:{},note:m.params?' 这个模块的权重不经过 autocast 转换。':''}; },
      fwdRest:x=>({delta:{w16c:2*(x.L-1)*x.castLayer},note:`每层的 fp16 权重副本 ${fmtB(2*x.castLayer)}，${x.L-1} 层共 ${fmtB(2*(x.L-1)*x.castLayer)}。`}),
      loss:x=>({d:`cross_entropy 在 autocast 的 fp32 列表里，在 fp32 logits 上计算，得到标量 loss。退出 with 块时 autocast 清空权重缓存，但 fp16 权重副本仍被 autograd 图引用，显存不变。scaler.scale(loss) 把 loss 乘以 S = 2¹⁶，backward 从这里开始，之后所有梯度都放大 S 倍。`,delta:{}}),
      bwdLines:P=>P(0),
      bwdExtra:(m,gp,x)=>{ const cp=castP(m,x.c); const d={}; if(gp) d.g32=4*gp; if(cp) d.w16c=-2*cp; let note=''; if(gp) note+=` 权重梯度的 GEMM 输出 fp16 张量（${fmtB(2*gp)}，临时），cast 算子的反向把它转成 fp32 累加进权重的 .grad（${fmtB(4*gp)}），临时 fp16 随即释放。`; if(cp) note+=` 这个模块的 fp16 权重副本不再被引用，释放 ${fmtB(2*cp)}。`; return {delta:d,note}; },
      bwdRest:x=>({delta:{g32:4*(x.L-1)*x.layerParams,w16c:-2*(x.L-1)*x.castLayer},note:`每层产生 ${fmtB(4*x.layerParams)} 的 fp32 梯度，释放 ${fmtB(2*x.castLayer)} 的 fp16 权重副本。`}),
      postSteps:(x,push,P)=>{
        push({title:'unscale：原地 ÷ S 并检查 inf/NaN',mode:'opt',mech:'机制二',lines:P(1),d:`scaler.unscale_ 调用 torch._amp_foreach_non_finite_check_and_unscale_，对所有 fp32 梯度原地乘以 1/S，同一个 kernel 顺带记录是否出现 inf 或 NaN。梯度本来就是 fp32，没有任何转换或拷贝。若梯度是 fp16，GradScaler 直接报错“Attempting to unscale FP16 gradients”。`,delta:{}});
        push({title:'梯度裁剪',mode:'opt',lines:P(2),d:`在 unscale 之后的 fp32 梯度上计算全局范数并裁剪，这是论文建议的 unscale 位置：在反向之后、裁剪之前，这样裁剪阈值不需要随 S 变化。`,delta:{}});
        push({title:'scaler.step：无溢出才调用 opt.step',mode:'opt',mech:'机制一',lines:P(3),d:`scaler.step 读取 unscale 时记录的 found_inf。为 0 时调用 opt.step()，AdamW 用 fp32 梯度原地更新 fp32 的权重、m、v；不为 0 时跳过 opt.step，权重不变。本演示假定没有溢出。`,delta:{}});
        push({title:'scaler.update：调整 S',mode:'opt',mech:'机制二',lines:P(4),d:`有 inf/NaN 时 S 乘 backoff_factor = 0.5 并把计数清零；否则计数加一，连续 growth_interval = 2000 步没有溢出就把 S 乘 growth_factor = 2。`,delta:{}});
        push({title:'释放 fp32 梯度',mode:'opt',lines:P(5),d:`set_to_none=True 把每个参数的 .grad 置 None，释放 4Ψ = ${fmtB(4*x.psi)}。显存回到常驻状态，下一次迭代从进入 autocast 开始。`,delta:{g32:-Infinity}});
      },
    },
    ds:{
      key:'ds',name:'DeepSpeed FP16_Optimizer',
      cats:[
        {k:'w16',n:'fp16 权重',c:'var(--s1)'},
        {k:'master',n:'fp32 master（fp32_flat）',c:'var(--s7)'},
        {k:'m',n:'AdamW m',c:'var(--s3)'},{k:'v',n:'AdamW v',c:'var(--s6)'},
        {k:'act',n:'激活值',c:'var(--s4)'},{k:'logits',n:'logits (fp32)',c:'var(--s5)'},
        {k:'g16',n:'fp16 梯度',c:'var(--s2)'},
        {k:'g32',n:'fp32 梯度（转换后）',c:'var(--s8)'},
      ],
      pro:[
        'from torch._utils import _flatten_dense_tensors as flatten',
        'from torch._utils import _unflatten_dense_tensors as unflatten',
        'model = Qwen3ForCausalLM(cfg).cuda().half()      # fp16 权重，2Ψ',
        'params = list(model.parameters())',
        'fp16_flat = flatten([p.detach() for p in params])  # 拼成连续 buffer',
        'for p, q in zip(params, unflatten(fp16_flat, params)):',
        '    p.data = q                                    # 参数改为 buffer 的切片',
        'fp32_flat = fp16_flat.clone().float()             # fp32 master，4Ψ',
        'adamw = torch.optim.AdamW([fp32_flat], lr=lr, weight_decay=wd)  # m、v 各 4Ψ',
        'cur_scale, cur_iter, last_overflow_iter = 2.0 ** 16, 0, -1',
      ],
      pre:[], fwdInd:4, ampComments:false,
      post:[
        '    (loss.float() * cur_scale).backward()         # fp16 梯度 2Ψ',
        '    grads = [p.grad for p in params]              # 以下按 step 展开',
        '    overflow = any(has_inf_or_nan(g) for g in grads)  # 查溢出',
        '    if overflow:',
        '        cur_scale = max(cur_scale / 2, 1.0)       # 跳过更新，S 减半',
        '        last_overflow_iter = cur_iter',
        '        for p in params:',
        '            p.grad = None',
        '    else:',
        '        g32 = flatten([g.float() for g in grads]) # 整份 fp32 梯度，4Ψ',
        '        fp32_flat.grad = g32',
        '        for p in params:',
        '            p.grad = None                         # 释放 fp16 梯度',
        '        norm = g32.norm() / cur_scale             # 范数按 unscale 后的值计算',
        '        g32.mul_(1.0 / (cur_scale * max(1.0, norm / clip)))  # ÷ S 并裁剪',
        '        adamw.step()                              # fp32 中更新',
        '        fp32_flat.grad = None                     # 释放 fp32 梯度',
        '        for p, q in zip(params, unflatten(fp32_flat, params)):',
        '            p.data.copy_(q)                       # fp32 → fp16 权重',
        '        stable = cur_iter - last_overflow_iter - 1',
        '        if stable > 0 and stable % 1000 == 0:     # scale_window = 1000',
        '            cur_scale *= 2',
        '    cur_iter += 1',
      ],
      resident:x=>({w16:2*x.psi,master:4*x.psi,m:x.momB*x.psi,v:x.momB*x.psi,act:0,logits:0,g16:0,g32:0}),
      idle:x=>`模型权重是 fp16，2Ψ = ${fmtB(2*x.psi)}。FP16_Optimizer 的构造函数把它们拼成一段连续 buffer（fp16_flat，参数改为切片，不增加显存），clone 成 fp32 得到 master weights（fp32_flat，4Ψ），交给 AdamW；m 与 v 各 ${x.momB}Ψ。常驻合计每参数 ${6+2*x.momB} 字节。动态 loss scale 从 2¹⁶ 开始（initial_scale_power = 16）。`,
      preSteps:()=>{},
      fwdExtra:()=>({delta:{},note:''}),
      fwdRest:()=>({delta:{},note:''}),
      loss:x=>({d:`cross_entropy 在 fp32 的 logits 上计算，得到标量 loss。FP16_Optimizer.backward 把 loss 转成 fp32、乘以 cur_scale = 2¹⁶ 后调用 backward，之后所有梯度都放大 S 倍，原本小于 2⁻²⁴ 的激活梯度进入 fp16 的可表示范围。`,delta:{}}),
      bwdLines:P=>P(0),
      bwdExtra:(m,gp)=>({delta:gp?{g16:2*gp}:{},note:gp?` 权重梯度以 fp16 存进参数的 .grad，${fmtB(2*gp)}，保留到 step。`:''}),
      bwdRest:x=>({delta:{g16:2*(x.L-1)*x.layerParams},note:`每层产生 ${fmtB(2*x.layerParams)} 的 fp16 梯度。`}),
      postSteps:(x,push,P)=>{
        push({title:'在 fp16 梯度上检查 inf/NaN',mode:'opt',mech:'机制二',lines:P(1,2,3,4,5,6,7),d:`CheckOverflow 逐个检查 fp16 梯度。任何一个含 inf 或 NaN 就把 cur_scale 减半（下限 1），记录本次迭代号，把所有 fp16 梯度置 None 并返回，不做后面的任何事。检查发生在转换之前，溢出的迭代不会付出 fp32 副本的显存。本演示假定没有溢出。`,delta:{}});
        push({title:'转为 fp32 并 flatten',mode:'opt',mech:'机制二',lines:P(8,9,10),d:`对每个 param group：把组内每个 fp16 梯度 .float()，再 flatten 成一段连续 fp32 张量，挂到 fp32_flat.grad。这一份 fp32 梯度是 4Ψ = ${fmtB(4*x.psi)}，此时 fp16 梯度还没有释放，是整个迭代的显存峰值。flatten 内部做一次 cat，逐参数的 fp32 张量在 cat 完成后释放，所以 cat 期间还会短暂多出一份。`,delta:{g32:4*x.psi}});
        push({title:'释放 fp16 梯度',mode:'opt',lines:P(11,12),d:`整组转换完成后把组内参数的 .grad 置 None，释放 2Ψ = ${fmtB(2*x.psi)}。源码里这一步在同一个 group 循环内，紧跟在转换之后。`,delta:{g16:-Infinity}});
        push({title:'unscale 与裁剪合并，原地完成',mode:'opt',mech:'机制二',lines:P(13,14),d:`先在 fp32 梯度上求范数，除以 cur_scale 得到真实范数；unscale_and_clip_grads 把 1/cur_scale 与裁剪系数合成一个标量，对 g32 原地做一次 mul_。除法只做这一次。`,delta:{}});
        push({title:'adamw.step：在 fp32 中更新 master',mode:'opt',mech:'机制一',lines:P(15),d:`torch.optim.AdamW 读取 fp32_flat.grad，原地更新 fp32_flat 与 m、v。整段 buffer 是一个参数，所以只有一次 kernel 调用序列。`,delta:{}});
        push({title:'释放 fp32 梯度',mode:'opt',lines:P(16),d:`fp32_flat.grad 置 None，释放 4Ψ = ${fmtB(4*x.psi)}。`,delta:{g32:-Infinity}});
        push({title:'fp32 master → fp16 权重',mode:'opt',mech:'机制一',lines:P(17,18),d:`把更新后的 fp32_flat 按参数切开，逐个 copy_ 进 fp16 参数。这一步在 step 末尾，因此下一次迭代的前向直接使用新的 fp16 权重，不需要在迭代开头再拷贝。`,delta:{}});
        push({title:'调整 loss scale',mode:'opt',mech:'机制二',lines:P(19,20,21,22),d:`距上次溢出满 scale_window = 1000 步且没有新的溢出，cur_scale 加倍（scale_factor = 2）。fused_optimizer.py 的这条路径没有 hysteresis：一次溢出就减半。显存回到常驻状态。`,delta:{}});
      },
    },
    mlm:{
      key:'mlm',name:'Megatron-LM Float16Optimizer',
      cats:[
        {k:'w16',n:'fp16 权重',c:'var(--s1)'},
        {k:'master',n:'fp32 master（main）',c:'var(--s7)'},
        {k:'gbuf',n:'fp32 梯度 buffer（常驻）',c:'var(--s8)'},
        {k:'m',n:'AdamW m',c:'var(--s3)'},{k:'v',n:'AdamW v',c:'var(--s6)'},
        {k:'act',n:'激活值',c:'var(--s4)'},{k:'logits',n:'logits (fp32)',c:'var(--s5)'},
      ],
      pro:[
        'model = Qwen3ForCausalLM(cfg).cuda().half()      # fp16 权重，2Ψ',
        'params = list(model.parameters())',
        'grad_buffer = torch.zeros(sum(p.numel() for p in params),',
        '                          dtype=torch.float32, device="cuda")  # 4Ψ，常驻',
        'off = 0',
        'for p in params:                                 # main_grad 是 buffer 的切片',
        '    p.main_grad = grad_buffer[off:off + p.numel()].view_as(p)',
        '    off += p.numel()',
        'main = [p.detach().clone().float() for p in params]  # fp32 master，4Ψ',
        'adam = FusedAdam(main, lr=lr, weight_decay=wd)   # 融合 Adam，m、v 各 4Ψ',
        'scaler = DynamicGradScaler(initial_scale=2 ** 32, min_scale=1.0,',
        '                           growth_factor=2.0, backoff_factor=0.5,',
        '                           growth_interval=1000, hysteresis=2)',
        '',
        'def grad_hook(p):                                # DDP 为每个参数注册的反向 hook',
        '    p.main_grad.add_(p.grad)                      # 累加进 fp32 buffer',
        '    p.grad = None                                 # 临时 fp16 梯度立即释放',
      ],
      pre:['    grad_buffer.zero_()                           # zero_grad_buffer'],
      fwdInd:4, ampComments:false,
      post:[
        '    (loss * scaler.scale).backward()              # 逐参数触发 grad_hook',
        '    for m, p in zip(main, params):  # _copy_model_grads_to_main_grads',
        '        m.grad = p.main_grad                      # 已是 fp32，.float() 不拷贝',
        '    found_inf = torch.zeros(1, device="cuda")',
        '    torch._amp_foreach_non_finite_check_and_unscale_(',
        '        [m.grad for m in main], found_inf, 1.0 / scaler.scale)  # 原地 ÷ S',
        '    scaler.update(found_inf.item() > 0)           # 调整 S（hysteresis 2）',
        '    if found_inf.item() > 0:',
        '        continue                                  # 跳过更新',
        '    clip_grad_norm_(main, clip)                   # 在 fp32 梯度上裁剪',
        '    adam.step()                                   # fp32 中更新 master、m、v',
        '    for p, m in zip(params, main):  # _copy_main_params_to_model_params',
        '        p.data.copy_(m)                           # fp32 → fp16 权重',
      ],
      resident:x=>({w16:2*x.psi,master:4*x.psi,gbuf:4*x.psi,m:x.momB*x.psi,v:x.momB*x.psi,act:0,logits:0}),
      idle:x=>`模型权重是 fp16，2Ψ = ${fmtB(2*x.psi)}。DistributedDataParallel 在初始化时分配一段 fp32 的梯度 buffer，4Ψ = ${fmtB(4*x.psi)}，整个训练过程常驻，每个参数的 main_grad 是它的切片。Float16OptimizerWithFloat16Params 把每个参数 clone 成 fp32 master（4Ψ），m 与 v 各 ${x.momB}Ψ。常驻合计每参数 ${10+2*x.momB} 字节，比 DeepSpeed 多出的 4 字节就是 fp32 梯度 buffer。动态 loss scale 从 2³² 开始，min_scale 1，growth_interval 1000，hysteresis 2。`,
      preSteps:(x,push,PRE)=>push({title:'清零梯度 buffer',mode:'pre',lines:PRE(0),d:`zero_grad_buffer 把 4Ψ 的 fp32 buffer 清零，显存不变。反向时每个参数的梯度累加进对应的切片；若一个 batch 有多个 micro-batch，累加也在这段 fp32 buffer 里完成，不经过 fp16。`,delta:{}}),
      fwdExtra:()=>({delta:{},note:''}),
      fwdRest:()=>({delta:{},note:''}),
      loss:x=>({d:`cross_entropy 在 fp32 的 logits 上计算，得到标量 loss。乘以 scaler.scale（初值 2³²）后 backward。`,delta:{}}),
      hookAtEnd:true, bwdLines:P=>P(0),
      bwdExtra:(m,gp)=>({delta:{},note:gp?` 权重梯度的 GEMM 输出 fp16 张量（${fmtB(2*gp)}），grad_hook 立即把它累加进 main_grad（fp32 buffer 的切片）并释放，同一时刻只有一个参数的临时 fp16 梯度存在。用 TransformerEngine 的 Linear 并打开 fuse_wgrad_accumulation 时，GEMM 直接以 fp32 累加进 main_grad，临时 fp16 梯度也不存在。`:''}),
      bwdRest:x=>({delta:{},note:`每层 ${fmtB(2*x.layerParams)} 的临时 fp16 梯度逐参数累加进 fp32 buffer 后释放，buffer 本身已经常驻，显存只减少激活值。`}),
      postSteps:(x,push,P)=>{
        push({title:'把 main_grad 挂到 master 的 .grad',mode:'opt',lines:P(1,2),d:`_copy_model_grads_to_main_grads 对每个参数执行 main_param.grad = model_param.main_grad.float()。main_grad 已经是 fp32，.float() 返回同一个张量，不分配显存；master 的 .grad 现在是 buffer 切片的引用。若梯度 buffer 是 fp16（fp16 训练且未加 --accumulate-allreduce-grads-in-fp32），这里才会产生一份 4Ψ 的拷贝，变成与 DeepSpeed 相同的路径。`,delta:{}});
        push({title:'unscale：原地 ÷ S 并检查 inf/NaN',mode:'opt',mech:'机制二',lines:P(3,4,5),d:`_unscale_main_grads_and_check_for_nan 收集所有 master 的 .grad，调用与 torch.amp 相同的 torch._amp_foreach_non_finite_check_and_unscale_，原地乘以 1/S 并把是否有 inf/NaN 写进 found_inf。之后在模型并行组内 all_reduce 取最大值。`,delta:{}});
        push({title:'scaler.update 与是否跳过',mode:'opt',mech:'机制二',lines:P(6,7,8),d:`DynamicGradScaler.update：有 inf/NaN 时 growth 计数清零、hysteresis 计数减一，减到 0 才把 S 乘 0.5（默认 hysteresis = 2，即连续两次溢出才减半）；没有时 growth 计数加一，到 growth_interval = 1000 就把 S 乘 2 并重置两个计数。found_inf 为真则本步到此结束，不更新权重。本演示假定没有溢出。`,delta:{}});
        push({title:'梯度裁剪',mode:'opt',lines:P(9),d:`clip_grad_norm 在 fp32 的 main grads 上计算范数并裁剪。`,delta:{}});
        push({title:'adam.step：FusedAdam 在 fp32 中更新',mode:'opt',mech:'机制一',lines:P(10),d:`Apex 或 TransformerEngine 的 FusedAdam 用 multi-tensor kernel 一次处理所有参数，读取 fp32 梯度，原地更新 fp32 的 master、m、v。梯度 buffer 在这之后保留，下一次迭代开头清零。`,delta:{}});
        push({title:'fp32 master → fp16 权重',mode:'opt',mech:'机制一',lines:P(11,12),d:`_copy_main_params_to_model_params 用 multi-tensor copy 把每个 master 写回对应的 fp16 参数。显存回到常驻状态，下一次迭代从清零梯度 buffer 开始。`,delta:{}});
      },
    },
    mlmpa:{
      key:'mlmpa',name:'Megatron-LM precision-aware + TE FusedAdam',dt:'bf16',
      cats:[
        {k:'w16',n:'bf16 权重',c:'var(--s1)'},
        {k:'rem',n:'fp32 master 的 int16 余数（FusedAdam 状态）',c:'var(--s7)'},
        {k:'gbuf',n:'fp32 梯度 buffer（常驻）',c:'var(--s8)'},
        {k:'m',n:'exp_avg',c:'var(--s3)'},{k:'v',n:'exp_avg_sq',c:'var(--s6)'},
        {k:'act',n:'激活值',c:'var(--s4)'},{k:'logits',n:'logits (fp32)',c:'var(--s5)'},
      ],
      pro:[
        'model = Qwen3ForCausalLM(cfg).cuda().bfloat16()  # bf16 权重，2Ψ',
        'params = list(model.parameters())',
        'grad_buffer = torch.zeros(sum(p.numel() for p in params),',
        '                          dtype=torch.float32, device="cuda")  # 4Ψ，常驻',
        'off = 0',
        'for p in params:                                 # main_grad 是 buffer 的切片',
        '    p.main_grad = grad_buffer[off:off + p.numel()].view_as(p)',
        '    off += p.numel()',
        'MOM = torch.float32                              # 或 bfloat16，见上方控件',
        'adam = FusedAdam(params, lr=lr, weight_decay=wd,  # 参数就是 bf16 权重',
        '                 master_weights=True, master_weight_dtype=torch.float32,',
        '                 use_decoupled_grad=True, store_param_remainders=True,',
        '                 exp_avg_dtype=MOM, exp_avg_sq_dtype=MOM)',
        '# 第一次 step 时 FusedAdam 建立状态：m、v 清零；master 只存 int16 余数，2Ψ，初值 0',
        '# bf16 训练不需要 loss scaling：grad_scaler 为 None',
        '',
        'def grad_hook(p):                                # DDP 为每个参数注册的反向 hook',
        '    p.main_grad.add_(p.grad)                      # 累加进 fp32 buffer',
        '    p.grad = None                                 # 临时 bf16 梯度立即释放',
      ],
      pre:['    grad_buffer.zero_()                           # zero_grad_buffer'],
      fwdInd:4, ampComments:false, hookAtEnd:true,
      post:[
        '    loss.backward()                               # 不乘 S；逐参数触发 grad_hook',
        '    for p in params:  # _copy_model_grads_to_main_grads',
        '        p.decoupled_grad = p.main_grad            # 挂到 bf16 参数上，不拷贝',
        '    clip_grad_norm_(params, clip)                 # 读 .decoupled_grad',
        '    adam.step()  # multi_tensor_adam_param_remainder，逐元素：',
        '    #   master = [bf16 位 | int16 余数] 拼回 fp32（余数为负则 bf16 减一，撤销舍入）',
        '    #   在 fp32 寄存器里做 AdamW 更新',
        '    #   拆成 round-to-nearest 的 bf16 与新余数，写回 p、余数、m、v',
        '    for p in params:',
        '        p.decoupled_grad = None                   # 只解除引用，buffer 本身常驻',
      ],
      resident:x=>({w16:2*x.psi,rem:2*x.psi,gbuf:4*x.psi,m:x.momB*x.psi,v:x.momB*x.psi,act:0,logits:0}),
      idle:x=>`模型权重是 bf16，2Ψ = ${fmtB(2*x.psi)}。梯度 buffer 与实现三相同，fp32 常驻 4Ψ = ${fmtB(4*x.psi)}。Megatron 不创建 master：DistributedOptimizer（数据并行度 1，本 rank 持有全部参数）把 bf16 参数直接交给 TransformerEngine 的 FusedAdam。FusedAdam 在第一次 step 时建立状态：exp_avg 与 exp_avg_sq 各 ${x.momB}Ψ（${x.momB===2?'bf16':'fp32'}），master 只存 fp32 低 16 位的 int16 余数，2Ψ = ${fmtB(2*x.psi)}，初值 0，此时“bf16 参数 + 余数”拼出的 fp32 与初始权重完全相同。常驻合计每参数 ${8+2*x.momB} 字节：比实现三少 4 字节，全部来自 master 的存储方式。`,
      preSteps:(x,push,PRE)=>push({title:'清零梯度 buffer',mode:'pre',lines:PRE(0),d:`zero_grad_buffer 把 4Ψ 的 fp32 buffer 清零，显存不变。`,delta:{}}),
      fwdExtra:()=>({delta:{},note:''}),
      fwdRest:()=>({delta:{},note:''}),
      loss:x=>({d:`cross_entropy 在 fp32 的 logits 上计算，得到标量 loss。bf16 的指数位与 fp32 相同，激活梯度不会下溢到零，不乘 scale，直接 backward。`,delta:{}}),
      bwdLines:P=>P(0),
      bwdExtra:(m,gp)=>({delta:{},note:gp?` 权重梯度的 GEMM 输出 bf16 张量（${fmtB(2*gp)}），grad_hook 立即把它累加进 main_grad（fp32 buffer 的切片）并释放；TransformerEngine 的 Linear 打开 fuse_wgrad_accumulation 时 GEMM 直接以 fp32 累加进 main_grad。`:''}),
      bwdRest:x=>({delta:{},note:`每层 ${fmtB(2*x.layerParams)} 的临时 bf16 梯度逐参数累加进 fp32 buffer 后释放，buffer 本身已经常驻，显存只减少激活值。`}),
      postSteps:(x,push,P)=>{
        push({title:'把 main_grad 挂到 bf16 参数的 .decoupled_grad',mode:'opt',lines:P(1,2),d:`_copy_model_grads_to_main_grads 在这个开关下执行 shard_main_param.decoupled_grad = shard_model_grad：梯度是 fp32 buffer 的切片，参数是 bf16，两者 dtype 不同，PyTorch 不允许挂到 .grad，所以用 .decoupled_grad 这个普通属性。没有任何拷贝。bf16 没有 grad_scaler，prepare_grads 到此结束，没有 unscale 步骤。`,delta:{}});
        push({title:'梯度裁剪',mode:'opt',lines:P(3),d:`clip_grad_norm 通过 _uses_decoupled_grad 判断后改读 .decoupled_grad，在 fp32 梯度上计算范数并裁剪。`,delta:{}});
        push({title:'adam.step：kernel 内还原 master、更新、写回',mode:'opt',mech:'机制一',lines:P(4,5,6,7),d:`FusedAdam 对 bf16 参数调用 multi_tensor_adam_param_remainder，5 组张量：g（fp32 buffer）、p（bf16）、m、v、余数（int16）。每个元素：把 bf16 的 16 位放到高位、余数放到低位得到 fp32 master（存放时 bf16 是 round-to-nearest 的结果，余数为负表示曾向上舍入，此时 bf16 减一还原）；在 fp32 寄存器里做 AdamW；把新的 master 拆成高 16 位与低 16 位，低 16 位为负则高位加一，得到 round-to-nearest 的 bf16；写回 p、余数、m、v。更新量与权重之比在 2²⁴ 以内都能保留，与 4 字节的 master 完全等价。参数已在 kernel 内写回，_copy_main_params_to_model_params 直接 return；数据并行度 1 时参数 all-gather 没有实际通信。`,delta:{}});
        push({title:'解除 .decoupled_grad 引用',mode:'opt',lines:P(8,9),d:`zero_grad(set_to_none=True) 在这个开关下把 .decoupled_grad 置 None。它只是 buffer 切片的引用，buffer 本身常驻，显存不变。下一次迭代从清零梯度 buffer 开始。`,delta:{}});
      },
    },
  };
  for(const V of Object.values(VARIANTS)){
    V.fwd=fwdLines(V.fwdInd,V.ampComments,V.dt);
    V.code=[...V.pro,'',LOOP,...V.pre,...V.fwd,...V.post];
    V.preOff=V.pro.length+2; V.fwdOff=V.preOff+V.pre.length; V.postOff=V.fwdOff+V.fwd.length;
  }

  /* ---- 由模型配置控件决定、四个演示共用的数据 ---- */
  let ctx={};
  function buildCtx(){
    const c=QWEN3[modelSel.value], s=+sSel.value, b=+bIn.value, flash=attnSel.value==='flash', momB=optSel.value==='bf16'?2:4;
    $('it-b-v').textContent=b;
    const mods=buildModules(c,s,b,flash);
    const byId=id=>mods.find(m=>m.id===id);
    const layerMods=['in_norm','q_proj','k_proj','v_proj','qk_norm','scores','av','o_proj','post_norm','gate_up','silu','down'].map(byId);
    const layerParams=layerMods.reduce((x,m)=>x+m.params,0), layerAct=layerMods.reduce((x,m)=>x+m.act,0), layerFlops=layerMods.reduce((x,m)=>x+m.flops,0);
    const castLayer=layerMods.reduce((x,m)=>x+castP(m,c),0);
    const psi=c.L*layerParams+byId('embed').params+byId('lm_head').params+byId('f_norm').params;
    const T=s*b, L=c.L, logitsB=4*T*c.V;
    ctx={c,s,b,T,L,flash,momB,psi,layerParams,layerAct,layerFlops,castLayer,logitsB,mods,byId,layerMods,modelName:modelSel.value};
  }

  function buildSteps(V){
    const x=ctx, {c,L,psi,layerParams,layerAct,logitsB,byId,layerMods}=x;
    const st=[]; const push=o=>st.push(o);
    const FL=id=>FWD_MAP[id].map(i=>V.fwdOff+i), P=(...is)=>is.map(i=>V.postOff+i), PRE=(...is)=>is.map(i=>V.preOff+i);
    const hookL=V.hookAtEnd?[V.pro.length-3,V.pro.length-2,V.pro.length-1]:[];
    push({title:'常驻状态',mode:'idle',lines:range(0,V.pro.length),d:`模型 Qwen3-${x.modelName}：L = ${L}，h = ${c.h}，a = ${c.a}，g = ${c.g}，d = ${c.d}，I = ${c.I}，V = ${c.V}，参数量 Ψ = ${fmtP(psi)}。`+V.idle(x),delta:{}});
    V.preSteps(x,push,PRE);
    const fwdMod=(m,extra)=>{ const e=V.fwdExtra(m,x); push({title:'前向：'+m.name,mode:'fwd',mod:m.id,lines:FL(m.id),d:m.fwd+e.note,delta:{act:m.act,...(extra||{}),...e.delta},mech:(m.grp==='attn'||m.grp==='ffn'||m.grp==='head')?'机制三':undefined}); };
    fwdMod(byId('embed'));
    layerMods.forEach(m=>fwdMod(m));
    { const e=V.fwdRest(x); push({title:`前向：第 2 到第 ${L} 层`,mode:'fwd',mod:'rest',lines:FL('rest'),d:`其余 ${L-1} 层重复同样的 12 个模块。每层保留 ${fmtB(layerAct)} 的激活值，${L-1} 层共 ${fmtB((L-1)*layerAct)}。这一步合并了 ${L-1} 层，显存逐层变化，时间线上每层一级台阶。`+e.note,delta:{act:(L-1)*layerAct,...e.delta},mech:'机制三'}); }
    fwdMod(byId('f_norm'));
    fwdMod(byId('lm_head'),{logits:logitsB});
    { const e=V.loss(x); push({title:'loss 与 loss scaling',mode:'fwd',mod:'loss',lines:FL('loss').concat(P(0)),mech:'机制二',d:e.d,delta:e.delta}); }
    const gpOf=m=>m.id==='lm_head'?(c.tie?c.h*c.V:m.params):m.id==='embed'?(c.tie?0:m.params):m.params;
    const bwdMod=(m,extra)=>{ const gp=gpOf(m); const e=V.bwdExtra(m,gp,x); push({title:'反向：'+m.name,mode:'bwd',mod:m.id,lines:FL(m.id).concat(V.bwdLines(P),hookL),d:m.bwd+e.note,delta:{act:-m.act,...(extra||{}),...e.delta},mech:gp>0?'机制三':undefined}); };
    bwdMod(byId('lm_head'),{logits:-logitsB});
    bwdMod(byId('f_norm'));
    { const e=V.bwdRest(x); push({title:`反向：第 ${L} 到第 2 层`,mode:'bwd',mod:'rest',lines:FL('rest').concat(V.bwdLines(P),hookL),d:`其余 ${L-1} 层按与前向相反的顺序反向，每层释放 ${fmtB(layerAct)} 激活值。这一步合并了 ${L-1} 层，显存逐层变化，时间线上每层一级台阶。`+e.note,delta:{act:-(L-1)*layerAct,...e.delta},mech:'机制三'}); }
    [...layerMods].reverse().forEach(m=>bwdMod(m));
    bwdMod(byId('embed'));
    V.postSteps(x,push,P);
    let mem=V.resident(x);
    st.forEach(o=>{ for(const k in o.delta){ if(!(k in mem)) throw new Error('unknown cat '+k); mem[k]=o.delta[k]===-Infinity?0:mem[k]+o.delta[k]; if(Math.abs(mem[k])<1) mem[k]=0; } o.mem={...mem}; });
    return st;
  }

  /* ---- 一种实现的演示：步进控件、模块图、代码高亮、步骤说明与显存时间线 ---- */
  function makeDemo(V){
    // 图的 HTML 骨架由 IterationDemo 组件输出，元素 id 是 it-{实现}-{名称}
    const id=s=>`it-${V.key}-${s}`;
    const codeEl=$(id('code')), diaHost=$(id('diagram')), stepEl=$(id('step')), tlHost=$(id('timeline'));
    $(id('legend')).innerHTML=V.cats.map(c=>`<span><i style="--c:${c.c}"></i>${c.n}</span>`).join('');
    codeEl.innerHTML=V.code.map((l,i)=>`<span class="cl" data-l="${i}"><span class="ln">${String(i+1).padStart(2,' ')}</span>${esc(l)||' '}</span>`).join('');
    let cur=0, steps=[], tl=null;

    function renderDiagramStatic(){
      const {L,mods,layerMods}=ctx, W=340, RH=26, GAP=5;
      const SHORT={qk_norm:'q/k_norm + RoPE',scores:'softmax(q kᵀ/√d)',post_norm:'post_attn_layernorm',gate_up:'gate/up_proj',o_proj:'o_proj + 残差',down:'down_proj + 残差'};
      const rows=[{id:'embed',t:'embed_tokens'},{card:'start'},{grp:'Attention (GQA)'},...layerMods.slice(0,8).map(m=>({id:m.id,t:SHORT[m.id]||m.name})),{grp:'FFN (SwiGLU)'},...layerMods.slice(8).map(m=>({id:m.id,t:SHORT[m.id]||m.name})),{card:'end'},{id:'rest',t:`第 2 到第 ${L} 层`},{id:'f_norm',t:'norm'},{id:'lm_head',t:'lm_head'},{id:'loss',t:'cross_entropy · × S'}];
      let y=18, boxes='', cards='', cardTop=0; const edges=[];
      const header=`<text class="hdr" x="28" y="11">模块</text><text class="hdr" x="${W-82}" y="11" text-anchor="end">权重形状</text><text class="hdr" x="${W-16}" y="11" text-anchor="end">保留激活值</text>`;
      for(const r of rows){
        if(r.card==='start'){ y+=6; cardTop=y; edges.push([cardTop,cardTop+38]); y+=22; continue; }
        if(r.card==='end'){ cards+=`<rect class="card" x="6" y="${cardTop}" width="${W-12}" height="${y-cardTop+4}" rx="8"/><text class="cardt" x="16" y="${cardTop+15}">Transformer layer × ${L}（展开第 1 层）</text>`; y+=12; continue; }
        if(r.grp){ boxes+=`<text class="grpt" x="18" y="${y+11}">${r.grp}</text>`; y+=16; continue; }
        const m=mods.find(x=>x.id===r.id); const inCard=layerMods.includes(m);
        const x0=inCard?18:8, x1=inCard?W-18:W-8, cy=y+RH/2;
        edges.push([y,y+RH]);
        let inner='';
        const pr=r.id==='loss'?['f32']:(m&&m.prec)||[];
        pr.forEach((k,i)=>{ inner+=`<circle cx="${x0+11+i*9}" cy="${cy}" r="3.5" style="fill:${PREC[k].c}"/>`; });
        inner+=`<text x="${x0+20+Math.max(0,pr.length-1)*9}" y="${cy+4}">${r.t}</text>`;
        if(m&&m.w!=='—') inner+=`<text class="w" x="${x1-74}" y="${cy+4}" text-anchor="end">${String(m.w).replace('（与 embedding 共享）','')}</text>`;
        if(m&&m.act>0) inner+=`<text class="a" x="${x1-8}" y="${cy+4}" text-anchor="end">${fmtB(m.act)}</text>`;
        boxes+=`<g class="mb" data-id="${r.id}"><rect x="${x0}" y="${y}" width="${x1-x0}" height="${RH}" rx="5"/>${inner}</g>`;
        y+=RH+GAP;
      }
      let spine=''; for(let i=1;i<edges.length;i++) spine+=`<line class="spine" x1="${W/2}" x2="${W/2}" y1="${edges[i-1][1]}" y2="${edges[i][0]}"/>`;
      diaHost.innerHTML=`<svg viewBox="0 0 ${W} ${y+4}" role="img" aria-label="Qwen3 模块图">${header}${cards}${spine}${boxes}</svg>`;
    }
    function renderDiagram(){
      const st=steps[cur];
      const fwdDone=new Set(), bwdDone=new Set();
      for(let i=0;i<cur;i++){ const o=steps[i]; if(o.mode==='fwd'&&o.mod) fwdDone.add(o.mod); if(o.mode==='bwd'&&o.mod) bwdDone.add(o.mod); }
      diaHost.querySelectorAll('.mb').forEach(g=>{ const id=g.dataset.id; g.classList.toggle('on-fwd',st.mode==='fwd'&&st.mod===id); g.classList.toggle('on-bwd',st.mode==='bwd'&&st.mod===id); g.classList.toggle('done',fwdDone.has(id)&&!bwdDone.has(id)); g.classList.toggle('released',bwdDone.has(id)||(id==='loss'&&(st.mode==='bwd'||st.mode==='opt'))); });
    }
    function renderStep(){
      const st=steps[cur]; const mem=st.mem; const total=Object.values(mem).reduce((a,b)=>a+b,0);
      $(id('n')).textContent=`第 ${cur+1} / ${steps.length} 步`;
      $(id('prev')).disabled=cur===0; $(id('next')).disabled=cur===steps.length-1;
      const badge={idle:'常驻',pre:'迭代开头',fwd:'前向',bwd:'反向',opt:'优化器 / scaler'}[st.mode];
      const deltas=Object.entries(st.delta).filter(([k,v])=>v!==0).map(([k,v])=>{ const cat=V.cats.find(c=>c.k===k); return `<span class="pill ${v===-Infinity||v<0?'ok':'warn'}">${cat.n} ${v===-Infinity?'释放':(v>0?'+':'−')+fmtB(Math.abs(v))}</span>`; }).join(' ');
      let bar=''; for(const c of V.cats){ const w=mem[c.k]/total*100; if(w>0) bar+=`<i style="width:${w}%;background:${c.c}" title="${c.n} ${fmtB(mem[c.k])}"></i>`; }
      const parts=V.cats.filter(c=>mem[c.k]>0).map(c=>`<span><i style="--c:${c.c}"></i>${c.n} <b>${fmtB(mem[c.k])}</b></span>`).join('');
      stepEl.innerHTML=`<div class="hd"><span class="pill mode-${st.mode}">${badge}</span>${st.mech?`<span class="pill">${st.mech}</span>`:''}<span class="t">${st.title}</span></div><p>${st.d}</p><div class="dl">${deltas||'<span class="pill">显存不变</span>'}</div><div class="membar">${bar}</div><div class="legend memparts">${parts}<span><b>合计 ${fmtB(total)}</b></span></div>`;
      codeEl.querySelectorAll('.cl').forEach(el=>el.classList.toggle('hl',st.lines.includes(+el.dataset.l)));
      renderDiagram(); renderCursor();
    }
    let xs=[];
    function renderTimelineStatic(){
      const totals=steps.map(o=>Object.values(o.mem).reduce((a,b)=>a+b,0)); const peak=Math.max(...totals); const peakI=totals.indexOf(peak);
      const yMax=peak/GiB*1.12, stepY=niceStep(yMax/5), yt=[]; for(let v=0;v<=yMax;v+=stepY) yt.push(+v.toFixed(6));
      // 横坐标：合并的“第 2 到第 L 层”一步占 12 格，与第 1 层展开的 12 个模块同宽，这样能看出逐层的台阶
      xs=[0]; steps.forEach((o,i)=>{ if(i>0) xs.push(xs[i-1]+(o.mod==='rest'?12:1)); });
      const n=xs[xs.length-1];
      let iFwdEnd=0, iBwdEnd=0, iFwd0=0; steps.forEach((o,i)=>{ if(o.mode==='fwd'){ if(!iFwd0) iFwd0=i; iFwdEnd=i; } if(o.mode==='bwd') iBwdEnd=i; });
      const lab={[xs[0]]:'常驻',[xs[iFwd0]]:'前向',[xs[iFwdEnd]]:'loss',[xs[iBwdEnd]]:'反向结束',[n]:'结束'};
      tl=mkPlot(tlHost,{W:680,H:260,xr:[0,n],yr:[0,yMax],xt:[xs[0],xs[iFwd0],xs[iFwdEnd],xs[iBwdEnd],n],xf:t=>lab[t]||'',yt,yf:t=>num(t,3),xl:'步骤（合并的第 2 到第 L 层占 12 格，段内每层一级台阶）',yl:'显存 (GiB)',aria:'一次迭代各步骤的显存堆叠面积图'});
      let sv='';
      steps.forEach((o,i)=>{ if(o.mod==='rest'&&i>0){ sv+=`<rect x="${tl.X(xs[i-1])}" y="${tl.mt}" width="${tl.X(xs[i])-tl.X(xs[i-1])}" height="${tl.H-tl.mt-tl.mb}" fill="var(--grid)" opacity=".6"/><text class="ann" x="${(tl.X(xs[i-1])+tl.X(xs[i]))/2}" y="${tl.H-tl.mb-6}" text-anchor="middle">${o.mode==='fwd'?'前向':'反向'}第 2–${ctx.L} 层</text>`; } });
      // 阶梯：每一步在自己的横坐标处跳变；合并的“其余层”一步按层数分成多级跳变
      const pts=[{x:0,mem:steps[0].mem}];
      steps.forEach((o,i)=>{ if(i===0) return; const prev=steps[i-1].mem;
        if(o.mod==='rest'){ const nL=ctx.L-1; let last=prev; for(let j=1;j<=nL;j++){ const x=xs[i-1]+(xs[i]-xs[i-1])*j/nL; const m={}; for(const k in o.mem) m[k]=prev[k]+(o.mem[k]-prev[k])*j/nL; pts.push({x,mem:last},{x,mem:m}); last=m; } }
        else pts.push({x:xs[i],mem:prev},{x:xs[i],mem:o.mem}); });
      let base=pts.map(()=>0);
      for(const c of V.cats){
        const top=pts.map((p,i)=>base[i]+p.mem[c.k]);
        let d='M'+tl.X(0)+' '+tl.Y(base[0]/GiB); pts.forEach((p,i)=>{ d+=' L'+tl.X(p.x)+' '+tl.Y(top[i]/GiB); }); for(let i=pts.length-1;i>=0;i--) d+=' L'+tl.X(pts[i].x)+' '+tl.Y(base[i]/GiB);
        sv+=`<path d="${d}Z" fill="${c.c}" opacity=".8"/>`; base=top;
      }
      sv+=`<line x1="${tl.ml}" x2="${tl.W-tl.mr}" y1="${tl.Y(peak/GiB)}" y2="${tl.Y(peak/GiB)}" stroke="var(--axis)" stroke-dasharray="4 3"/><text class="ann" x="${tl.W-tl.mr-4}" y="${tl.Y(peak/GiB)-5}" text-anchor="end">峰值 ${num(peak/GiB,4)} GiB（${steps[peakI].title}）</text><line class="cursor" x1="0" x2="0" y1="${tl.mt}" y2="${tl.H-tl.mb}" stroke="var(--ink)" stroke-width="1.5"/>`;
      tl.body.innerHTML=sv;
      tl.svg.addEventListener('click',ev=>{ const r=tl.svg.getBoundingClientRect(); const x=(ev.clientX-r.left)/r.width*tl.W; const u=(x-tl.ml)/(tl.W-tl.ml-tl.mr)*n; let best=0; xs.forEach((v,i)=>{ if(Math.abs(v-u)<Math.abs(xs[best]-u)) best=i; }); cur=best; renderStep(); });
      V.peak={bytes:peak,title:steps[peakI].title,i:peakI};
    }
    function renderCursor(){ const c=tl.body.querySelector('.cursor'); c.setAttribute('x1',tl.X(xs[cur])); c.setAttribute('x2',tl.X(xs[cur])); }
    $(id('next')).addEventListener('click',()=>{ if(cur<steps.length-1){cur++; renderStep();} });
    $(id('prev')).addEventListener('click',()=>{ if(cur>0){cur--; renderStep();} });
    $(id('reset')).addEventListener('click',()=>{ cur=0; renderStep(); });
    $(id('phase')).addEventListener('click',()=>{ const mode=steps[cur].mode; let i=cur; while(i<steps.length-1&&steps[i+1].mode===mode) i++; if(i===cur&&cur<steps.length-1) i++; cur=i; renderStep(); });
    return {V,build(){ steps=buildSteps(V); cur=Math.min(cur,steps.length-1); renderDiagramStatic(); renderTimelineStatic(); renderStep(); },get steps(){return steps;}};
  }

  /* ---- 四种实现的对比表 ---- */
  function renderCompare(demos){
    const mb=ctx.momB, D=Object.fromEntries(demos.map(d=>[d.V.key,d]));
    const rows=[
      ['权重',['fp32 权重 4Ψ，由 AdamW 直接更新；前向时另有 autocast 的 fp16 副本 2Ψ','fp16 权重 2Ψ + fp32 master 4Ψ（fp32_flat）','fp16 权重 2Ψ + fp32 master 4Ψ（main）','bf16 权重 2Ψ + int16 余数 2Ψ，拼成 fp32 master；余数是 FusedAdam 的状态']],
      ['梯度',['反向直接产生 fp32 梯度，累加进 .grad','fp16 梯度 2Ψ，保留到 step','fp16 梯度逐参数累加进常驻的 fp32 buffer 4Ψ；TE 融合 wgrad 时直接以 fp32 累加','同实现三；step 时挂到 bf16 参数的 .decoupled_grad']],
      ['unscale 的对象',['fp32 .grad，foreach kernel 原地','转换后的 fp32 flat 梯度，原地一次 mul_','fp32 buffer 的切片，foreach kernel 原地','bf16 无 loss scaling，没有 unscale']],
      ['临时显存',['无转换副本；反向期间 fp16 权重副本逐模块释放、fp32 梯度逐模块增加','step 内整份 fp32 梯度 4Ψ，与 fp16 梯度短暂并存','无转换副本；fp32 梯度 buffer 全程常驻','无转换副本；master 的还原与拆分在寄存器里完成']],
      ['inf/NaN 检查',['unscale 时由同一个 kernel 记录','转换之前，在 fp16 梯度上逐个检查','unscale 时由同一个 kernel 记录，再在模型并行组内 all_reduce','不检查（bf16 无 scaler）']],
      ['loss scale 默认',['初值 2¹⁶；2000 步无溢出 ×2；每次溢出 ×0.5','初值 2¹⁶；1000 步无溢出 ×2；每次溢出 ×0.5，下限 1','初值 2³²；1000 步无溢出 ×2；连续 2 次溢出 ×0.5，下限 1','无']],
      ['常驻显存（每参数字节）',[`${4+2*mb}`,`${6+2*mb}`,`${10+2*mb}`,`${8+2*mb}`],'m'],
      ['当前配置的峰值显存',['amp','ds','mlm','mlmpa'].map(k=>`<strong>${fmtB(D[k].V.peak.bytes)}</strong><br>${D[k].V.peak.title}`),'m'],
    ];
    const SHORT={amp:'torch.amp',ds:'DeepSpeed FP16_Optimizer',mlm:'Megatron 默认',mlmpa:'Megatron precision-aware'};
    let h='<table><thead><tr><th></th>'+demos.map(d=>`<th>${SHORT[d.V.key]}</th>`).join('')+'</tr></thead><tbody>';
    for(const [t,cells,cls] of rows) h+=`<tr><td><strong>${t}</strong></td>${cells.map(c=>`<td${cls?` class="${cls}"`:''}>${c}</td>`).join('')}</tr>`;
    $('it-compare').innerHTML=h+'</tbody></table>';
  }

  /* ---- 每个模块的参数量、激活值与 FLOPs 表 ---- */
  function renderTable(){
    const {c,L,psi,layerParams,layerAct,layerFlops,logitsB,T,mods,layerMods}=ctx;
    let h='<table><thead><tr><th>模块</th><th>权重形状</th><th>精度</th><th class="r">参数量</th><th class="r">权重相关显存 (16 B/参数)</th><th class="r">保留的激活值</th><th class="r">前向 FLOPs</th></tr></thead><tbody>';
    const precTxt=m=>(m.prec||[]).map(k=>({gemm:'GEMM · fp32 累加',red:'reduction · fp32',pw:'逐元素 · fp16',f32:'fp32 输出'})[k]).join('，');
    const row=(m,tag)=>`<tr><td>${m.name}${tag?` <span class="pill">${tag}</span>`:''}</td><td class="m">${m.w}</td><td>${precTxt(m)}</td><td class="m r">${fmtP(m.params)}</td><td class="m r">${m.params?fmtB(16*m.params):'—'}</td><td class="m r">${m.act?fmtB(m.act):'—'}</td><td class="m r">${fmtF(m.flops)}</td></tr>`;
    h+=row(mods.find(m=>m.id==='embed'));
    layerMods.forEach(m=>h+=row(m,'每层'));
    h+=`<tr><td><strong>一层合计</strong></td><td class="m">—</td><td></td><td class="m r"><strong>${fmtP(layerParams)}</strong></td><td class="m r"><strong>${fmtB(16*layerParams)}</strong></td><td class="m r"><strong>${fmtB(layerAct)}</strong></td><td class="m r"><strong>${fmtF(layerFlops)}</strong></td></tr>`;
    h+=`<tr><td><strong>${L} 层合计</strong></td><td class="m">—</td><td></td><td class="m r"><strong>${fmtP(L*layerParams)}</strong></td><td class="m r"><strong>${fmtB(16*L*layerParams)}</strong></td><td class="m r"><strong>${fmtB(L*layerAct)}</strong></td><td class="m r"><strong>${fmtF(L*layerFlops)}</strong></td></tr>`;
    h+=row(mods.find(m=>m.id==='f_norm'));
    const lm=mods.find(m=>m.id==='lm_head'); h+=row(lm);
    h+=`<tr><td>logits（fp32）</td><td class="m">—</td><td>fp32 存储</td><td class="m r">—</td><td class="m r">—</td><td class="m r">${fmtB(logitsB)}</td><td class="m r">—</td></tr>`;
    const totAct=L*layerAct+2*T*c.h*2+logitsB, totFlops=L*layerFlops+lm.flops;
    h+=`<tr><td><strong>整个模型</strong></td><td class="m">—</td><td></td><td class="m r"><strong>Ψ = ${fmtP(psi)}</strong></td><td class="m r"><strong>${fmtB(16*psi)}</strong></td><td class="m r"><strong>${fmtB(totAct)}</strong></td><td class="m r"><strong>${fmtF(totFlops)}</strong>（每 token ${fmtF(totFlops/T)}）</td></tr>`;
    $('it-table').innerHTML=h+'</tbody></table>';
  }

  const demos=['amp','ds','mlm','mlmpa'].map(k=>makeDemo(VARIANTS[k]));
  function buildAll(){ buildCtx(); demos.forEach(d=>d.build()); renderCompare(demos); renderTable(); }
  for(const el of [modelSel,sSel,bIn,attnSel,optSel]) el.addEventListener('input',buildAll);
  buildAll();
}
