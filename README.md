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

## 在页面上编辑

`npm run dev` 打开的页面上有两个只在开发服务器里存在的工具，构建出的站点不包含它们：

- **页面内编辑**：点右下角的“编辑正文”，再点一个段落、标题、列表项、引用或表格，下方出现这一段的 MDX 源码。输入时页面上这一段同步更新，公式也会重新渲染；Ctrl+Enter（macOS 上是 Cmd+Enter）保存并写回 MDX 文件，Esc 取消。预览只按 Markdown 渲染这一段，段落里的 MDX 组件在保存、页面刷新后才显示。
- **跳到源文件**：按住 Alt（macOS 上是 Option）点击页面上的任意元素，在编辑器里打开它的源文件和行号：正文打开 MDX，图和控件打开组件的 `.astro` 文件。默认使用 VS Code，在浏览器控制台执行 `localStorage.setItem('source-jump-editor', 'cursor')` 改用 Cursor（也可以写 `zed`）。

实现在 `src/plugins/source-lines.mjs`（给正文元素标上源码位置）、`src/plugins/inline-edit-server.mjs`（读取、预览、保存的接口）和 `src/components/dev/`。

## Markdown 页面与所见即所得编辑器（原型）

`src/topics/` 下的 `.md` 文件也生成页面，地址规则与 `.mdx` 相同。目前只有一个原型页面：`src/topics/matrix-calculus/partials.md`（`/topics/matrix-calculus/partials/`），内容取自深度学习矩阵微积分一页的“标量对向量”一节。

内容格式是 Markdown 加公式（`$...$`、`$$...$$`）加指令块（remark-directive 语法），不允许在段落里写 HTML：

- `:mark[文字]`：文字标记。
- `:::gradient-figure{x0="1.2" y0="0.8"}` … `:::`：交互图。名字带连字符的容器指令输出同名的 custom element，指令里的内容是图题。元素在 `src/elements/registry.js` 登记，读者或作者可能调整的数值写在元素类的 `static properties` 里。

`npm run dev` 打开 Markdown 页面时，右下角有“编辑”按钮。点开后正文直接在页面上编辑：

- 文字直接输入，排版与发布后的页面相同，输入时不重新编译。
- 点击公式，在下方修改 LaTeX，公式随输入重新渲染。输入 `$a^2$` 生成行内公式，在空段落里输入 `$$` 加空格生成行间公式。
- 交互图在编辑器里正常运行；图上方的属性面板修改属性，图随之重画；图题和正文一样编辑。
- Ctrl/Cmd+Shift+H 加上或去掉文字标记。
- 停止输入后自动写回 `.md` 文件，Ctrl/Cmd+S 立即保存。保存不会刷新页面；在编辑器之外修改 `.md` 文件后需要手动刷新。

实现在 `src/editor/`（编辑器，基于 Milkdown）、`src/plugins/markdown-edit-server.mjs`（读取、保存的接口）、`src/lib/markdown-page.js`（读取和渲染 Markdown 页面）和 `src/plugins/directives.mjs`（指令块）。

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
  components/dev/               开发时的页面内编辑和跳到源文件
  components/layout/            排版组件：Figure、Caption、Wide、MarginNote、Columns、Callout、Fold、Video、Bento、Card、Recap、Tex
  lib/                          多个主题共用的浏览器端脚本（ES module）
  scripts/                      版式和排版组件自带的浏览器端脚本（目录高亮、折叠动画、前文笔记）
  styles/
    tokens.css                  所有主题共用的颜色、字体、宽度 token
    themes/*.css                主题：只覆盖强调色和字体
    base.css                    正文、表格、图、控件的样式
  plugins/headings.mjs          标题 id、章节 <section>、目录的生成
  plugins/mathjax.mjs           构建时把正文公式渲染成 SVG（同一页的公式共用一份字形定义；渲染结果按公式缓存）
  plugins/math-dev-server.mjs   开发时在页面返回浏览器之前写入公式 SVG（开发时 MDX 模块里只放公式的占位标签）
  plugins/raw-location.mjs      减少 Astro 的 MDX 流程里 rehype-raw 的耗时
  plugins/source-lines.mjs      开发时给正文元素标上源码位置
  plugins/inline-edit-server.mjs  开发时页面内编辑的服务端接口
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
   format: essay        # 版式：essay | paper | bento
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

组件的 props 字符串不经过 MDX，其中的 `$...$` 不会被渲染。图题写在 `<Caption>` 里，组件模板里的静态公式用 `<Tex>`。

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
| `<Fold summary>` | 默认收起的补充内容；标题含公式时写在 `slot="summary"` 里 |
| `<Tex t={String.raw\`...\`} />` | 在 .astro 组件模板里写构建时渲染的行内公式 |
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

主题（`theme`）和版式（`format`）是两个独立的选项。主题只是一份 token 文件，决定颜色和字体；版式是 `.astro` 模板，决定栏数、目录和标题区。某一页需要额外的 token 或样式时，在主题目录里写一个 CSS 文件，在 MDX 里 `import './topic.css';`。

标题字体用霞鹜文楷时，主题选 `rust`，或在 frontmatter 里写 `fonts: [lxgw-wenkai]`。

颜色一律用 `tokens.css` 里的 token，例如 `var(--ink-2)`、`var(--s1)`。token 用 `light-dark()` 同时定义亮色和暗色的值，组件不需要再写暗色样式。

同一份正文可以换版式显示：`src/topics/matrix-calculus/paper.mdx` 引用 `index.mdx` 的正文，用 Paper 版式排成论文式双栏。`src/topics/llm-act-fns/cheatsheet.mdx` 是 Bento 版式的样例，卡片里复用正文页的 `ActFnPlot` 组件。

整页都需要自定义的主题，可以不使用任何版式，在 `src/pages/topics/<slug>/index.astro` 里直接写页面，只套 `Base.astro`。
