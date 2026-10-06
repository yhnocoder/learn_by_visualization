# Learn by Visualization

用可交互的页面解释大模型训练、推理与深度学习中的具体机制。站点用 [Astro](https://astro.build) 构建，正文写成 MDX，交互图写成 Astro 组件。

## 命令

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 启动开发服务器，修改文件后页面自动刷新 |
| `npm run build` | 构建静态站点到 `dist/` |
| `npm run preview` | 在 <http://127.0.0.1:4173> 提供 `dist/` 里的页面 |
| `npm test` | 构建后运行 Playwright 测试（桌面与手机两种视口） |

部署到 GitHub Pages 的项目页时，站点位于 `/learn_by_visualization/` 下，构建时设置 `BASE_PATH=/learn_by_visualization/`。见 `.github/workflows/deploy.yml`。

## 目录结构

```
src/
  pages/
    index.astro                 首页（主题卡片与实时预览）
    topics/[...slug].astro      把 src/topics/**/*.mdx 渲染成页面
    topics/floating_points/     整页都是交互程序的主题，直接写成 .astro 页面
    topics/bpe/
  topics/<slug>/                一个主题的全部文件
    index.mdx                   正文，地址是 /topics/<slug>/
    components/                 这个主题自己的交互图组件
    lib/                        这个主题自己的脚本
    assets/                     图片，在 MDX 里用相对路径引用，构建时压缩
  layouts/
    Base.astro                  <head>、字体、主题、浏览器端 MathJax
    Essay.astro                 从前往后读的长文：左侧目录、正文、右侧边注栏
    Paper.astro                 论文式双栏
    BentoPage.astro             卡片网格
  components/layout/            排版组件：Figure、Caption、Wide、MarginNote、Columns、Callout、Fold、Video、Bento、Card、Recap
  lib/                          多个主题共用的浏览器端脚本（ES module）
  scripts/                      版式和排版组件自带的浏览器端脚本（目录高亮、折叠动画、前文笔记）
  styles/
    tokens.css                  所有主题共用的颜色、字体、宽度 token
    themes/*.css                主题：只覆盖强调色和字体
    base.css                    正文、表格、图、控件的样式
  plugins/headings.mjs          标题 id、章节 <section>、目录的生成
  data/topics.ts                首页的分类与主题列表
public/                         原样复制到站点根目录的文件（favicon、MathJax）
tests/                          Playwright 测试
```

## 写一个新主题

1. 新建 `src/topics/<slug>/index.mdx`，写 frontmatter：

   ```mdx
   ---
   title: 大模型里的激活函数
   eyebrow: LLM Architecture Notes · 2026-09
   lede: 本文介绍激活函数如何引入非线性……
   layout: essay        # essay | paper | bento
   theme: blue          # src/styles/themes/ 下的文件名
   runtimeMath: true    # 交互图里用 tex() / label() 动态生成公式时打开
   ---
   ```

   全部字段及含义见 `src/content.config.ts`。
2. 在 `src/data/topics.ts` 里加一条记录，首页会显示这个主题。

### 标题与目录

章节用 `##`，小节用 `###`。标题末尾可以写一个 MDX 注释作为属性块，设定锚点 id 和目录里显示的短标题：

```mdx
## Sigmoid 与 Tanh：门控与 soft-capping {/* #s2 toc="Sigmoid 与 Tanh" */}
### 标准正态累积分布 $\Phi(x)$ {/* #normal-cdf */}
```

不写 id 时按标题文字生成。每个 `##` 和它后面的内容会被包进一个 `<section>`。Essay 版式按 `##` 和 `###` 生成左侧目录，`numbered: true`（默认）时章节标题前自动加 01、02 编号。

### 公式

正文里的 `$...$`、`$$...$$` 在构建时由 MathJax 渲染成 SVG，浏览器端不需要再排版。行间公式的 `$$` 各占一行：

```mdx
$$
\mathrm{FFN}(x) = \phi(xW_1 + b_1)\,W_2 + b_2
$$
```

MDX 会把 `{`、`}`、`<` 当作 JSX 解析，所以公式以外的正文里出现这几个字符时，写成 `\{`、`\}`、`&lt;`。公式内部不受影响。

### 排版组件

在 MDX 开头 import，例如 `import Figure from '../../components/layout/Figure.astro';`。

| 组件 | 作用 |
| --- | --- |
| `<Figure id title float width wide plain>` | 图的外框。`float="right"` 时正文绕排，`wide` 时比正文栏更宽 |
| `<Caption>` | 图题，放在 Figure 里的最后，可以写公式和多个段落 |
| `<Wide>` | 让任意内容比正文栏更宽：Essay 里伸进边注栏，Paper 里横跨两栏 |
| `<MarginNote label>` | 边注：宽屏时在右侧边注栏，窄屏时回到正文里 |
| `<Columns ratio="2:1">` + `<Column>` | 并排的多栏，窄屏时上下排列 |
| `<Callout label tone>` | 浅底色的注释块 |
| `<Fold summary>` | 默认收起的补充内容 |
| `<Video src loop>` | 视频；`loop` 用于自动循环播放的演示动画 |
| `<Bento columns>` + `<Card span="2x1" title>` | 卡片网格 |

### 交互图

一个交互图写成一个 `.astro` 组件，放在 `src/topics/<slug>/components/`。组件输出图的 HTML 结构，再用 `<script>` 引入浏览器端脚本。同一个组件在一页里用多次时，脚本只加载一次，所以脚本应当查找页面里所有的实例并分别初始化：

```astro
---
// SiLU 的输出与导数，β 可调
interface Props { id: string }
const { id } = Astro.props;
---
<div class="plot silu-plot" id={id}></div>
<script>
  import { mathReady } from '../../../lib/math.js';
  import { initSiluPlot } from '../lib/silu.js';
  await mathReady();
  document.querySelectorAll('.silu-plot').forEach(initSiluPlot);
</script>
```

共用的浏览器端脚本在 `src/lib/`：

- `svg.js`：`el()` 创建 SVG 元素，`tex()`、`label()` 把公式放进 SVG（需要 `runtimeMath: true`，调用前 `await mathReady()`）。
- `graph.js`：`drawChain()`、`drawGraph()` 画计算图。
- `math.js`：`mathReady()` 等待浏览器端 MathJax，`typeset()` 排版脚本插入的含公式的元素。
- `tokens.js`：`readColor('--s1')` 读取 token 的实际颜色，供 canvas 使用；`onColorSchemeChange()` 在亮暗色切换时重绘。

只有一个主题用到的脚本放在主题自己的 `lib/` 里；第二个主题也需要它时，再移到 `src/lib/`。

### 主题与版式

主题（`theme`）和版式（`layout`）是两个独立的选项。主题只是一份 token 文件，决定颜色和字体；版式是 `.astro` 模板，决定栏数、目录和标题区。某一页需要额外的 token 或样式时，在主题目录里写一个 CSS 文件，在 MDX 里 `import './topic.css';`。

颜色一律用 `tokens.css` 里的 token，例如 `var(--ink-2)`、`var(--s1)`。token 用 `light-dark()` 同时定义亮色和暗色的值，组件不需要再写暗色样式。

整页都需要自定义的主题，可以不使用任何版式，在 `src/pages/topics/<slug>/index.astro` 里直接写页面，只套 `Base.astro`。
