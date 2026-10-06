// 页面 frontmatter 的字段，MDX 页面（content.config.ts）和 Markdown 页面（markdown-page.js）共用。
import { z } from 'astro/zod';

export const schema = z.object({
  title: z.string(),
  // <title> 标签用的标题，默认与 title 相同
  pageTitle: z.string().optional(),
  description: z.string().optional(),
  // 标题上方的一行小字，例如 "LLM Architecture Notes · 2026-09"
  eyebrow: z.string().optional(),
  // 标题下方的导语，支持行内 HTML（例如 <mark>）
  lede: z.string().optional(),
  // 版式：essay 是从前往后读的单栏长文，左侧有目录；paper 是论文式双栏；bento 是卡片网格。
  // 字段不叫 layout，因为 Astro 会把 MDX frontmatter 里的 layout 当作布局文件的路径去导入。
  format: z.enum(['essay', 'paper', 'bento']).default('essay'),
  // 主题：src/styles/themes/ 下的文件名
  theme: z.string().default('blue'),
  // 图里用 tex() / label() 动态生成公式时为 true，页面会加载浏览器端 MathJax
  runtimeMath: z.boolean().default(false),
  // 额外加载的字体。rust 主题总是加载霞鹜文楷，其他主题需要时在这里写 lxgw-wenkai
  fonts: z.array(z.enum(['lxgw-wenkai'])).default([]),
  // 章节标题前是否自动加 01、02 这样的编号
  numbered: z.boolean().default(true),
  // essay 版式是否显示左侧目录
  toc: z.boolean().default(true),
  // 论文式版式的作者行与摘要
  authors: z.array(z.string()).optional(),
  abstract: z.string().optional(),
});
