// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import { unified } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeMathjax from 'rehype-mathjax/svg';
import { remarkHeadingId, rehypeSections, rehypeCollectToc } from './src/plugins/headings.mjs';

// 部署到 GitHub Pages 的项目页时，站点位于 /learn_by_visualization/ 下，由部署流程通过 BASE_PATH 传入。
// 本地开发和测试时 BASE_PATH 为空，站点位于根路径。
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  base,
  vite: {
    build: {
      rolldownOptions: {
        // Astro 给引入了组件的 MDX 加的 "use astro:head-inject" 指令会被打包工具报告为模块级指令，这条警告不影响结果
        onwarn(warning, warn){ if(warning.code !== 'MODULE_LEVEL_DIRECTIVE') warn(warning); },
      },
    },
  },
  trailingSlash: 'ignore',
  integrations: [mdx()],
  markdown: {
    processor: unified({
      // 正文里的 $...$ 和 $$...$$ 在构建时由 MathJax 渲染成 SVG，浏览器端不需要再排版正文公式。
      remarkPlugins: [remarkMath, remarkHeadingId],
      rehypePlugins: [rehypeSections, [rehypeMathjax, { svg: { fontCache: 'local' } }], rehypeCollectToc],
      // 正文里的中文引号已经写好，不需要把英文引号自动换成弯引号
      smartypants: false,
    }),
    shikiConfig: { themes: { light: 'github-light', dark: 'github-dark' }, defaultColor: false },
  },
});
