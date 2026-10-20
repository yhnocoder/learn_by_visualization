export default {
  title: 'Learn by Visualization',
  description: '用可交互的页面解释大模型训练、推理与深度学习中的具体机制。',
  url: 'https://yhnocoder.github.io/learn_by_visualization',
  language: 'zh-CN',
  theme: 'essay',
  toc: 'notes',
  home: { columns: 3, groupBy: 'category' },
  categories: [
    { id: 'math', name: '数学', color: '#985b57', desc: '理解深度学习中的数学概念与推导。' },
    { id: 'numerics', name: '数值与精度', color: '#2a78d6', desc: '如何做一个 1' },
    { id: 'tokenize', name: '分词', color: '#eb6834', desc: 'f(文本) = list[token]' },
    { id: 'repr', name: '表示学习', color: '#7c5cd6', desc: 'f(token) = vector' },
    { id: 'arch', name: '模型结构', color: '#1baf7a', desc: 'Building Blocks' },
    { id: 'train', name: '训练', color: '#eda100', desc: '优化器、并行策略与训练稳定性。' },
  ],
};
