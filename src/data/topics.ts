// 首页的分类与主题列表。新增主题：在 topics 里加一条记录，并在 src/components/home/previews.js 里补一个同 id 的预览函数。

export interface Category { id: string; name: string; color: string; desc: string }
export interface Topic { id: string; cat: string; title: string; href: string; summary: string; tags: string[] }

export const categories: Category[] = [
  { id: 'math', name: '数学', color: '#985b57', desc: '理解深度学习中的数学概念与推导。' },
  { id: 'numerics', name: '数值与精度', color: '#2a78d6', desc: '如何做一个 1' },
  { id: 'tokenize', name: '分词', color: '#eb6834', desc: 'f(文本) = list[token]' },
  { id: 'repr', name: '表示学习', color: '#7c5cd6', desc: 'f(token) = vector' },
  { id: 'arch', name: '模型结构', color: '#1baf7a', desc: 'Building Blocks' },
  { id: 'train', name: '训练', color: '#eda100', desc: '优化器、并行策略与训练稳定性。' },
];

// href 相对于站点根目录，不带开头的 /；首页渲染时加上 BASE_URL
export const topics: Topic[] = [
  { id: 'matrix-calculus', cat: 'math', title: '深度学习所需的矩阵微积分', href: 'topics/matrix-calculus/',
    summary: '从偏导数与 Jacobian 到向量链式法则，逐步推导 ReLU 神经元和均方误差的参数梯度。', tags: ['Jacobian', '链式法则', '梯度', 'draft'] },
  { id: 'floating_points', cat: 'numerics', title: '浮点数格式', href: 'topics/floating_points/',
    summary: 'fp4 到 fp32 的位布局、可表示范围与舍入。输入一个数，逐位查看它的编码。', tags: ['fp4', 'fp8', 'bf16', 'fp32', 'v1'] },
  { id: 'bpe', cat: 'tokenize', title: 'BPE 分词', href: 'topics/bpe/',
    summary: '按 Sennrich et al. (2016) 的算法逐步合并最高频符号对，再用学到的合并顺序切分新词。', tags: ['sennrich', 'bpe', 'v1'] },
  { id: 'word2vec', cat: 'repr', title: 'word2vec：Skip-gram 是怎么来的', href: 'topics/word2vec/',
    summary: '从分布假设出发，解释 Skip-gram 为什么是一个预测任务、如何与大模型进行对比，并在浏览器里训练二维词向量。', tags: ['skip-gram', 'mikolov 2013', 'v1'] },
  { id: 'llm-act-fns', cat: 'arch', title: '大模型里的激活函数', href: 'topics/llm-act-fns/',
    summary: '从 ReLU 到 SwiGLU：比较各函数的输出、导数和极限行为，参数可调。', tags: ['GELU', 'SiLU', 'GLU', 'v1'] },
  { id: 'mixed-precision-training', cat: 'train', title: '混合精度训练', href: 'topics/mixed-precision-training/',
    summary: 'fp32 主权重、fp16/bf16 计算与 loss scaling 三个机制，以及一次迭代的完整流程。', tags: ['loss scaling', 'bf16', 'fp32 master', 'draft'] },
];
