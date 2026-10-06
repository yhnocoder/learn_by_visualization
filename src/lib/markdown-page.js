// Markdown 页面（src/topics/**/*.md）的渲染流程：Markdown 加公式（$...$、$$...$$）加指令块（见 src/plugins/directives.mjs）。
// 与 MDX 页面使用同一套公式和标题插件。Markdown 页面不允许段落里写原始 HTML，只允许单独成块的 HTML。
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkDirective from 'remark-directive';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeStringify from 'rehype-stringify';
import remarkDirectives from '../plugins/directives.mjs';
import rehypeMathSvg, { expandMath } from '../plugins/mathjax.mjs';
import { rehypeSections, rehypeCollectToc } from '../plugins/headings.mjs';
import { schema } from './page-schema';

// 公式插件输出的是带 data.html 的 MDX 节点，换成 raw 节点，由 rehype-stringify 原样输出
function rehypeMathToRaw(){
  const toRaw = node => {
    if(typeof node.data?.html === 'string') return { type: 'raw', value: node.data.html };
    if(node.children) node.children = node.children.map(toRaw);
    return node;
  };
  return tree => { toRaw(tree); };
}

const processor = unified()
  .use(remarkParse).use(remarkGfm).use(remarkMath).use(remarkDirective).use(remarkDirectives)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeSections)
  .use(rehypeMathSvg)
  .use(rehypeCollectToc)
  .use(rehypeMathToRaw)
  .use(rehypeStringify, { allowDangerousHtml: true });

/** 把 Markdown 正文渲染成 HTML，同时返回目录条目。path 用于报错时指出文件。 */
export async function renderMarkdownPage(body, path){
  const file = await processor.process({ value: body, path });
  // 开发服务器里公式先输出成占位标签（见 mathjax.mjs），这里就地换成 SVG。
  // 不能留给 math-dev-server.mjs 处理：页面代码和那个中间件各自加载了一份 mathjax.mjs，公式缓存不共用
  return { html: expandMath(String(file)), toc: file.data.astro?.frontmatter?.toc ?? [] };
}

// Markdown 页面是 src/topics/ 下的 .md 文件，地址规则与 MDX 页面相同：index.md 的地址是 /topics/<slug>/，
// 其他文件的地址是 /topics/<slug>/<文件名>/。notes/ 目录和 BACKLOG.md 是写作笔记，不生成页面。
//
// 这些文件直接从文件系统读取，不放进 Astro 的 content collection：content collection 在开发时监视文件，
// 文件一变就刷新浏览器，编辑器每次自动保存都会因此刷新页面。代价是在编辑器之外修改 .md 文件后，需要手动刷新页面。
const TOPICS = 'src/topics';
const FRONTMATTER = /^---\n([\s\S]*?)\n---\n/;

function walk(dir){
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if(entry.isDirectory()) return entry.name === 'notes' ? [] : walk(full);
    return entry.name.endsWith('.md') && entry.name !== 'BACKLOG.md' ? [full] : [];
  });
}

/** 读取所有 Markdown 页面，返回 { id, filePath, data, body }。filePath 是相对项目根目录的路径。 */
export function loadMarkdownPages(){
  return walk(TOPICS).map(filePath => {
    const source = fs.readFileSync(filePath, 'utf8');
    const match = source.match(FRONTMATTER);
    const result = schema.safeParse(match ? yaml.load(match[1]) : {});
    if(!result.success) throw new Error(`${filePath} 的 frontmatter 不符合要求：${result.error.message}`);
    const id = path.relative(TOPICS, filePath).split(path.sep).join('/').replace(/\.md$/, '').replace(/\/index$/, '');
    return { id, filePath, data: result.data, body: source.slice(match ? match[0].length : 0) };
  });
}
