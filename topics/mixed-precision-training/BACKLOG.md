# mixed-precision-training 页面规划

## 约束

- 目录自包含。index.html 只引用本目录内的文件，不出现 `../` 路径。tex-svg.js 与 fmt.js 从 llm-act-fns/ 和 floating_points/ 复制到本目录，复制后本目录可以单独移走或部署。
- 图表用原生 canvas 或 SVG，不引入图表库。
- 写每一节之前先核对该节涉及的事实，来源记录在下方「已核对的事实与来源」里；页面中的数字与结论只使用已核对的内容。

## 章节

1. 为什么要降精度：显存、访存带宽、Tensor Core 吞吐。格式表由 fmt.js 计算。
2. 机制一：fp32 master weights。演示：单步与多步更新在 fp16、bf16、fp32 中的结果与位视图。
3. 机制二：loss scaling。演示：梯度直方图；GradScaler 状态机步进器。
4. 机制三：fp32 accumulation。演示：三种加数分布下的顺序累加。
5. 一次迭代：操作、精度与显存。以 Qwen3 dense 模型为例（0.6B 到 32B 六个尺寸，config 已核对），按模块给出参数量、保留激活值、FLOPs 的公式。小节「哪些运算在 fp16，哪些在 fp32」回答三个问题：「放在 fp32」的三种含义，Qwen3 各模块的归类，换成 bf16 后的差异。小节「四种实现」给出四个独立的逐步演示，共用模型配置控件与模块图，各自有按源码展开的 torch 代码（高亮当前行）、步骤面板、显存时间线：（一）torch.autocast + GradScaler，fp32 权重、autocast 的 fp16 权重副本、fp32 梯度、原地 unscale；（二）DeepSpeed FP16_Optimizer（非 ZeRO），fp16 权重与梯度、flat 的 fp32 master、step 内整份转换成 fp32 梯度（峰值）；（三）Megatron-LM Float16OptimizerWithFloat16Params，fp16 权重、fp32 master、常驻的 fp32 梯度 buffer、hook 逐参数累加、原地 unscale；（四）Megatron-LM --use-precision-aware-optimizer + TransformerEngine FusedAdam，bf16 权重、master 以 int16 余数存在 FusedAdam 状态里、梯度挂 .decoupled_grad、kernel 内还原/更新/写回，无 loss scaling，数据并行度取 1。末尾是按当前配置实时计算的对比表。不做 DeepSpeed ZeRO（需要先讲并行）。表格列出每个模块的参数量、精度、权重相关显存、激活值、FLOPs。
6. bf16 改变了什么。
7. fp8 训练（待写）：Transformer Engine 与 DeepSeek-V3 分开讲，附 tile 量化演示。
8. 工程形态（待写）：autocast 的 op 清单、GradScaler 用法、手写 GradScaler 并在浏览器内运行梯度更新与 gradient accumulation。
9. 参考文献。

## 进度

- 2026-09-15：第 1 到第 6 节与参考文献已写入 index.html，版面加宽到 960px 正文。待写：第 7 节 fp8、第 8 节工程形态（含手写 GradScaler）。
- 2026-09-16：加第四个演示 Megatron precision-aware（bf16 + TE FusedAdam remainder），四份代码均通过 ast.parse，headless Chrome 遍历四个演示全部步骤无误。时间线改为阶梯图，合并的第 2 到第 L 层占 12 格、每层一级。
- 2026-09-15：第 5 节的单个演示改为三个独立演示（torch.amp、DeepSpeed FP16_Optimizer、Megatron-LM），代码按各自源码展开，三份代码均通过 ast.parse；headless Chrome 遍历三个演示的全部步骤，高亮行与模块一致，显存无负值且迭代结束回到常驻状态。

## 写作顺序

下一步写第 7 节 fp8，再写第 8 节工程形态与手写 GradScaler。篇幅过长时拆成第二个页面。

## 已核对的事实与来源

核对日期：2026-09-15。

### Micikevicius 等，Mixed Precision Training，ICLR 2018（arXiv:1710.03740）

- 三个技术：FP32 master copy of weights；loss scaling；FP16 乘积累加到 FP32（arithmetic precision）。
- 3.1 节给出 master weights 的两个动机：（a）lr × grad 的绝对值小于 2^-24 时在 FP16 中变成零，Figure 2b 显示约 5% 的权重梯度指数小于 -24；（b）权重与更新量之比达到 2048 以上时，对齐指数会把更新量右移 11 位以上，隐含位被移出，更新变成零。Mandarin 语音模型实验：有 master copy 时与 FP32 结果一致，用 FP16 权重直接更新时相对准确率损失 80%。
- master copy 使权重内存增加 50%，但训练内存由激活值主导，总体内存仍大约减半。
- 3.2 节：FP16 规格化数的指数范围为 [-14, 15]。Figure 3 是 Multibox SSD 网络训练中激活梯度的直方图，横轴为 log2(magnitude)，67% 的值为零，2% 落在 [2^-34, 2^-32)，2% 落在 [2^-24, 2^-23)。该网络不做 scaling 会发散，scale 8（指数加 3）即可与 FP32 一致。小于 2^-27 的梯度与训练无关，[2^-27, 2^-24) 区间的梯度必须保留。
- loss scaling 的做法：前向算出 loss 后乘以 scale 再反向；权重梯度在更新前必须 unscale，最简单的位置是反向结束后、梯度裁剪之前，这样不需要改任何超参数。
- 选 scale 的方法：常数 scale，实验中用过 8 到 32K；若有梯度统计信息，选一个使最大梯度绝对值乘 scale 后仍低于 65,504 的值。溢出时会在权重梯度里产生 inf 和 NaN，检测到溢出就跳过这次更新。
- 3.3 节：向量点积在 FP16 输入、FP32 累加（Volta Tensor Core 支持），有些网络不这样做就达不到 baseline 精度；大规模 reduction（batch norm 统计、softmax）在 FP32 中做，读写仍用 FP16 张量；逐元素运算受内存带宽限制，FP16 或 FP32 都可以。
- 4.1 节：ILSVRC 分类网络不需要 loss scaling；4.2 节 Table 2：Multibox SSD 无 loss scale 时发散，scale 8 后 mAP 77.1% 对 baseline 76.9%。

### PyTorch torch.amp（docs 2.14 与 torch/amp/grad_scaler.py 源码）

- GradScaler 默认值：init_scale = 2^16 = 65536，growth_factor = 2.0，backoff_factor = 0.5，growth_interval = 2000。
- scale(loss)：loss 乘以当前 scale。unscale_(optimizer)：梯度除以 scale，并记录是否出现 inf/NaN。step(optimizer)：若本次迭代尚未调用 unscale_ 则先调用，发现 inf/NaN 就跳过 optimizer.step()。update()：发现 inf/NaN 则 scale 乘 backoff_factor；连续 growth_interval 次未跳过则 scale 乘 growth_factor。update() 每次迭代只调用一次，且在所有 optimizer 的 step 之后。
- Gradient accumulation：累积期间 scale 保持不变，每个 micro-batch 调用 scaler.scale(loss / iters_to_accumulate).backward()，累够后再调用 scaler.step 与 scaler.update。
- Gradient clipping：先 scaler.unscale_(optimizer)，再 clip_grad_norm_，unscale_ 每个 optimizer 每步只能调用一次。
- CUDA autocast 到 float16 的 op：__matmul__, addbmm, addmm, addmv, addr, baddbmm, bmm, chain_matmul, multi_dot, conv1d, conv2d, conv3d, conv_transpose1d/2d/3d, GRUCell, linear, LSTMCell, matmul, mm, mv, prelu, RNNCell。
- CUDA autocast 到 float32 的 op：__pow__, __rdiv__, __rpow__, __rtruediv__, acos, asin, binary_cross_entropy_with_logits, cosh, cosine_embedding_loss, cdist, cosine_similarity, cross_entropy, cumprod, cumsum, dist, erfinv, exp, expm1, group_norm, hinge_embedding_loss, kl_div, l1_loss, layer_norm, log, log_softmax, log10, log1p, log2, margin_ranking_loss, mse_loss, multilabel_margin_loss, multi_margin_loss, nll_loss, norm, normalize, pdist, poisson_nll_loss, pow, prod, reciprocal, rsqrt, sinh, smooth_l1_loss, soft_margin_loss, softmax, softmin, softplus, sum, renorm, tan, triplet_margin_loss。
- 提升到最宽输入类型的 op：addcdiv, addcmul, atan2, bilinear, cross, dot, grid_sample, index_put, scatter_add, tensordot。

### Kalamkar 等，A Study of BFLOAT16 for Deep Learning Training，2019（arXiv:1905.12322）

- bfloat16 为 1 位符号、8 位指数、7 位尾数，数值范围与 FP32 相同，与 FP32 互转只需截断或舍入高 16 位。
- 训练方案：GEMM 与卷积以 BFLOAT16 为输入、FP32 累加，权重的 master copy 保留在 FP32 中用于更新。所有实验不改超参数、不用 loss scaling，结果与 FP32 一致；对比之下 FP16 训练需要额外调 loss scaling 超参数。

### Rajbhandari 等，ZeRO，2019（arXiv:1910.02054）

- 混合精度 Adam 的模型状态内存为 (2 + 2 + K)Ψ 字节，K = 12：FP16 参数 2Ψ，FP16 梯度 2Ψ，优化器状态 12Ψ（FP32 参数副本 4Ψ、FP32 momentum 4Ψ、FP32 variance 4Ψ），合计 16Ψ。论文 Figure 1 以 Ψ = 7.5B、K = 12 计算得 120GB。

### Micikevicius 等，FP8 Formats for Deep Learning，2022（arXiv:2209.05433）Table 1

- E4M3：指数偏置 7，无 infinity，NaN 只占用 S.1111.111 一种位模式，最大规格化数 S.1111.110 = 1.75 × 2^8 = 448，最小规格化数 2^-6，最大 subnormal 0.875 × 2^-6，最小 subnormal 2^-9。放弃 infinity 与多数 NaN 编码把动态范围从 17 个 binade 扩到 18 个，否则最大值只有 240。
- E5M2：指数偏置 15，遵循 IEEE 754 特殊值约定，最大规格化数 S.11110.11 = 1.75 × 2^15 = 57,344，最小规格化数 2^-14，最大 subnormal 0.75 × 2^-14，最小 subnormal 2^-16，动态范围 32 个 binade（含 subnormal）。
- 推荐用法：权重与激活用 E4M3，梯度用 E5M2。per-tensor scaling factor 由软件维护，让张量最大值接近格式最大值；溢出的值饱和到最大可表示值。FP16 式的溢出跳步对 FP8 不适用，因为 FP8 范围窄、溢出更频繁。

### NVIDIA Transformer Engine 用户手册（FP8 primer 与 common API，release 2.3）

- H100 支持 E4M3（最大 ±448）与 E5M2（最大 ±57344）。前向的激活与权重用 E4M3，反向梯度用 E5M2，理由是梯度对精度损失不敏感但需要更大动态范围。Format.HYBRID 表示前向 e4m3、反向 e5m2；Format.E4M3 与 Format.E5M2 表示全部张量用同一格式。
- 每个张量有独立的 scaling factor，由 amax（张量绝对值最大值）决定，使 amax 映射到 FP8 最大可表示值。
- DelayedScaling 默认参数：margin = 0，fp8_format = Format.HYBRID，amax_history_len = 1024，amax_compute_algo = "max"（另一个选项是 "most_recent"）。默认公式：new_scaling_factor = (FP8_MAX / amax) / 2^margin。「延迟」指 scale 由之前若干次迭代的 amax 历史推算，而不是用当前张量的 amax。

### Korthikanti 等，Reducing Activation Recomputation in Large Transformer Models，2022（arXiv:2205.05198）4.1 节

- 变量：a 为注意力头数，b 为 micro-batch 大小，h 为隐藏维度，L 为层数，s 为序列长度。假设激活值以 16 位存储（每元素 2 字节），dropout mask 每元素 1 字节；忽略 layer norm 的均值与方差等小缓冲。
- 每层激活值内存：attention block 为 11sbh + 5as²b 字节（QKV 输入 2sbh、QKᵀ 的 Q 与 K 共 4sbh、softmax 输出 2as²b、softmax dropout mask as²b、attention over V 的 dropout 输出 2as²b 与 V 2sbh、线性投影输入 2sbh、attention dropout mask sbh）；MLP 为 19sbh 字节（两个线性层输入 2sbh 与 8sbh、GeLU 输入 8sbh、dropout mask sbh）；两个 layer norm 共 4sbh。合计每层 sbh(34 + 5as/h) 字节，此式不含任何模型并行。

### DeepSeek-V3 Technical Report，2024（arXiv:2412.19437）3.3 节

- Linear 算子的三个 GEMM（Fprop、Dgrad、Wgrad）均以 FP8 为输入，输出为 BF16 或 FP32。embedding、output head、MoE gating、normalization、attention 算子保持 BF16 或 FP32。master weights、权重梯度、优化器状态保持高精度；3.3.3 节进一步说明 AdamW 的一阶矩与二阶矩用 BF16，master weights 与用于 batch 累积的梯度仍用 FP32。
- Fine-grained quantization：激活按 1×128 tile（每 token 每 128 channel）分组缩放，权重按 128×128 block 分组缩放。所有张量都用 E4M3，不采用 E4M3/E5M2 混合，理由是分组缩放让小组内共享指数位，缓解了动态范围不足。
- Increasing accumulation precision：H800 Tensor Core 上 FP8 GEMM 的累加精度只保留约 14 位，K = 4096 时最大相对误差接近 2%。做法是每累加 N_C = 128 个元素（4 次 WGMMA）把部分和提升到 CUDA Core 的 FP32 寄存器中累加，两个 warpgroup 交替执行以保持 Tensor Core 利用率。
- Online quantization：不用延迟量化，对每个 1×128 tile 或 128×128 block 在线计算 amax 并得到 scale。
- 相对 BF16 baseline，FP8 训练的相对 loss 误差始终低于 0.25%。

### Qwen3 dense 模型 config（Hugging Face 各仓库 config.json）

- 共同点：head_dim 128，num_key_value_heads 8，vocab_size 151936，attention_bias false，attention_dropout 0，torch_dtype bfloat16。
- 0.6B：hidden 1024，intermediate 3072，28 层，16 头，tie_word_embeddings true。1.7B：2048，6144，28 层，16 头，tie true。4B：2560，9728，36 层，32 头，tie true。8B：4096，12288，36 层，32 头，tie false。14B：5120，17408，40 层，40 头，tie false。32B：5120，25600，64 层，64 头，tie false。
- transformers 的 modeling_qwen3.py：q_proj → q_norm（对 head_dim 做 RMSNorm）→ RoPE；MLP 为 down_proj(act_fn(gate_proj(x)) * up_proj(x))；RMSNorm 在 fp32 中计算后转回输入精度；解码层顺序为 input_layernorm → self_attn → 残差 → post_attention_layernorm → mlp → 残差。
- 页面按 Ψ = L × 每层参数 + 词表参数计算，Qwen3-8B 得非 embedding 参数 6.95 B、总参数 8.19 B，与官方数字一致。

### PyTorch autocast 对 fp16 与 bf16 的处理（aten/src/ATen/autocast_mode.cpp）

- CUDA 的 autocast 内核以单一的 lower_precision_fp 类别注册（如 KERNEL_CUDA(mm, lower_precision_fp)、KERNEL_CUDA(softmax, fp32)、KERNEL_CUDA(layer_norm, fp32)），低精度类型由 autocast 的 dtype 参数决定，因此 fp16 与 bf16 共用同一份算子清单。
- 文档：autocast 到 float32 的算子「run in float32 and produce float32 output」。
- CUDA 说明文档有 torch.backends.cuda.matmul.allow_fp16_reduced_precision_reduction 与 allow_bf16_reduced_precision_reduction 两个开关，允许 GEMM 内部的分块求和用低精度。

### 「fp16 梯度整份转成 fp32 再 unscale、再 optimizer.step」这一写法的出处

- apex 23.08 tag，apex/fp16_utils/fp16_optimizer.py，FP16_Optimizer.backward 的 docstring：「fp16 grads are then copied to the master params' .grad attributes, which are guaranteed to be fp32. Finally, master grads are divided by loss_scale.」fp16util.model_grads_to_master_grads 逐参数 master.grad.data.copy_(model.grad.data)。该目录在 apex master 分支已移除。
- DeepSpeed master，deepspeed/runtime/fp16/unfused_optimizer.py，FP16_UnfusedOptimizer.step：先查溢出，再 fp32_param.grad = fp16_param.grad.to(fp32_param.dtype)，然后 unscale_and_clip_grads，再 self.optimizer.step()，最后 fp32_param.grad = None。fused_optimizer.py 的 FP16_Optimizer.step 把各组梯度 .to(fp32) 后 flatten 成一份 fp32 张量挂到 fp32_groups_flat[i].grad。
- Megatron-LM main（optimizer.py 2026-09-10 提交），Float16OptimizerWithFloat16Params._copy_model_grads_to_main_grads 写法相同（main_param.grad = model_param.main_grad.float()），但 bf16 训练时 arguments.py 自动置 accumulate_allreduce_grads_in_fp32 = True，梯度 buffer 本身是 fp32，.float() 不产生拷贝；DistributedOptimizer 只对本 rank 分片做同样操作。--use-precision-aware-optimizer 通过 .decoupled_grad 把低精度梯度直接交给 TE FusedAdam。

### 三种实现的梯度与 unscale 路径（源码核对，2026-09-15）

- PyTorch main，torch/amp/grad_scaler.py：_unscale_grads_ 调用 torch._amp_foreach_non_finite_check_and_unscale_ 原地乘 inv_scale 并写 found_inf；遇到 fp16 梯度直接 raise「Attempting to unscale FP16 gradients」；step 在 found_inf 为 0 时调用 optimizer.step；update 按 backoff_factor 0.5 / growth_factor 2 / growth_interval 2000 调整。torch/amp/autocast_mode.py：cache_enabled 默认 True，权重缓存在退出最外层 autocast（autocast_decrement_nesting 归零）时 clear_autocast_cache。autocast 下权重保持 fp32，梯度直接是 fp32。
- DeepSpeed master，deepspeed/runtime/fp16/fused_optimizer.py：构造时 fp16_groups_flat = flatten(clone)、参数改为切片、fp32_groups_flat = flat.clone().float() 作为优化器参数；step：overflow_checker.has_overflow(fp16 params) → _update_scale（溢出时 cur_scale = max(cur_scale/scale_factor, min_loss_scale)，无溢出时 stable_interval = cur_iter − last_overflow_iter − 1，>0 且整除 scale_window 就 ×scale_factor；无 hysteresis）→ 溢出则 fp16 grad 置 None 返回 → 每组 flatten([p.grad.to(fp32)]) 挂到 fp32_groups_flat[i].grad 并置 fp16 grad None → get_global_norm → unscale_and_clip_grads 把 1/cur_scale 与裁剪系数合并后原地 mul_ → optimizer.step → fp32 grad 置 None → unflatten 后 p.data.copy_(q)。deepspeed/runtime/constants.py 默认：initial_scale_power 16，loss_scale_window 1000，hysteresis 2，min_loss_scale 1。backward：(loss.float() × cur_scale).backward()。
- Megatron-LM main（2026-09-10 提交），megatron/core/optimizer/optimizer.py：Float16OptimizerWithFloat16Params 构造时 main_param = param.detach().clone().float()；MixedPrecisionOptimizer.prepare_grads：_copy_model_grads_to_main_grads（main_param.grad = model_param.main_grad.float()，随后 model_param.grad = None）→ _unscale_main_grads_and_check_for_nan（torch._amp_foreach_non_finite_check_and_unscale_ 原地，found_inf 在模型并行组 all_reduce MAX）→ grad_scaler.update(found_inf)；step：found_inf 则返回，否则 clip_grad_norm → optimizer.step → _copy_main_params_to_model_params（_multi_tensor_copy_this_to_that）。grad_scaler.py DynamicGradScaler.update：溢出时 growth 计数清零、hysteresis 计数减一，≤0 才 scale ×backoff（下限 min_scale）；无溢出时 growth 计数加一，等于 growth_interval 时重置两个计数并 ×growth_factor。training/arguments.py 默认：initial-loss-scale 2**32，min-loss-scale 1.0，loss-scale-window 1000，hysteresis 2；bf16 且 main_grads_dtype 为 fp32 时自动 accumulate_allreduce_grads_in_fp32 = True，fp16 需显式传该 flag；训练脚本把它传给 DDP 的 grad_reduce_in_fp32。distributed/param_and_grad_buffer.py：grad_dtype = torch.float if grad_reduce_in_fp32 else param.dtype，buffer 用 torch.zeros 一次分配；distributed_data_parallel.py：_make_backward_post_hook 中 param.main_grad.add_(param.grad.data) 然后 param.grad = None；zero_grad_buffer 每次迭代开头调用。optimizer/__init__.py：优先 transformer_engine.pytorch.optimizers.FusedAdam，其次 apex FusedAdam，再退回 torch AdamW；fp16 时创建 DynamicGradScaler(growth_factor=2.0, backoff_factor=0.5)，bf16 无 scaler。optimizer_config.py：use_precision_aware_optimizer 允许 main_grads_dtype / main_params_dtype / exp_avg_dtype / exp_avg_sq_dtype 各自设定，梯度通过 .decoupled_grad 交给 TE FusedAdam，只支持 adam。
- TransformerEngine main，transformer_engine/pytorch/module/linear.py：fuse_wgrad_accumulation 参数说明「enables fusing of creation and accumulation of the weight gradient. When enabled, it is assumed that the weights have an additional main_grad attribute (used instead of the regular grad) which is a pre-allocated buffer of the correct size to accumulate gradients in」。

### Megatron-LM --use-precision-aware-optimizer 与 TransformerEngine FusedAdam（源码核对，2026-09-16）

- Megatron-LM main，optimizer/__init__.py：use_precision_aware_optimizer 且非 DistributedOptimizer 时 raise ValueError「--use-precision-aware-optimizer only supported with distributed optimizer」；创建 FusedAdam 时传 exp_avg_dtype、exp_avg_sq_dtype，在 use_precision_aware_optimizer_no_fp8_or_ds_fp8 时再传 master_weights=True、use_decoupled_grad=True、master_weight_dtype=main_params_dtype，TE ≥ 2.1.0 时传 store_param_remainders（默认 True）。优先 transformer_engine.pytorch.optimizers.FusedAdam。
- optimizer_config.py：use_precision_aware_optimizer 默认 False；main_grads_dtype / main_params_dtype / exp_avg_dtype / exp_avg_sq_dtype 默认 fp32；store_param_remainders 默认 True，说明为「store the 16-bit FP32 parameter remainders in the optimizer state, excluding the 16 bits shared with the BF16 parameters」；只支持 adam，且检查 TE FusedAdam 的签名含 master_weight_dtype、exp_avg_dtype、exp_avg_sq_dtype、use_decoupled_grad。training/arguments.py：--main-grads-dtype 可选 fp32/bf16，--main-params-dtype fp32/fp16，--exp-avg-dtype 与 --exp-avg-sq-dtype 可选 fp32/fp16/bf16/fp8。
- distrib_optimizer.py：precision-aware 时 shard_main_param = None（注释「main params are held by FusedAdam」）；_copy_model_grads_to_main_grads 执行 shard_main_param.decoupled_grad = shard_model_grad，对象是 shard_float16_groups 里的 bf16 参数，注释说明 PyTorch 要求 param 与 grad 同 dtype 故改用 .decoupled_grad；_copy_main_params_to_model_params 在该开关下直接 return；_collect_main_grad_data_for_unscaling 读 .decoupled_grad。optimizer.py：get_grad_norm、clip_grad_norm、count_zeros、zero_grad 通过 _uses_decoupled_grad 改读 .decoupled_grad。非分布式的 Float16OptimizerWithFloat16Params 没有 precision-aware 分支。
- TransformerEngine main，transformer_engine/pytorch/optimizers/fused_adam.py：master_weights=True 时 master 保存在 optimizer state 的 master_param 里，第一次 step 时 initialize_state 建立（exp_avg、exp_avg_sq 清零；master 在 store_param_remainders 且参数为 bf16 时是 torch.zeros_like(param, dtype=torch.int16)，否则 param.clone().float()）；use_decoupled_grad 时读 p.decoupled_grad；store_param_remainders 只对 bf16 参数且 master_weight_dtype 为 fp32 生效，文档「Whole FP32 master can be reconstructed from BF16 params plus the trailing remainder bits」；bf16 参数且 store_param_remainders 时调用 multi_tensor_adam_param_remainder，张量列表为 g、p、m、v、p_remainder；exp_avg 与 exp_avg_sq 都是 bf16 时 fuse_unscale=True，状态直接以 bf16 读写，fp32 时无转换；fp16/fp8 状态另有标量 scale，本页不展开。
- transformer_engine/common/multi_tensor/adam.cu，multi_tensor_adam_param_remainder kernel：读入 bf16 p 与 int16 余数，「Reconstruct FP32 params」：余数 < 0 时 p 减一撤销舍入，int16[1] = p、int16[0] = 余数拼成 fp32；在 fp32 中做 Adam/AdamW；「Split into BF16 params (rounded-to-nearest) and remainders」：取高 16 位与低 16 位，低 16 位 < 0 时高位加一；写回 p、余数、m、v（m、v 为 MOMENT_T）。
