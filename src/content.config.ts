import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { schema } from './lib/page-schema';

// 每个主题是 src/topics/<slug>/ 下的一个 .mdx 文件，同一目录里放它自己的组件、脚本、样式和图片。
// index.mdx 的地址是 /topics/<slug>/，其他文件（例如 deep-learning.mdx）的地址是 /topics/<slug>/<文件名>/。
// 整页都是交互程序、不适合写成 MDX 的主题（floating_points、bpe）直接写成 src/pages/topics/<slug>/index.astro。
// 用 Markdown 加指令块写的页面（*.md）不在这里，见 src/lib/markdown-page.js。
const topics = defineCollection({
  loader: glob({
    pattern: '**/*.mdx',
    base: './src/topics',
    generateId: ({ entry }) => entry.replace(/\.mdx$/, '').replace(/\/index$/, ''),
  }),
  schema,
});

export const collections = { topics };
