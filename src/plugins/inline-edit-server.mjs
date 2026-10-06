// 页面内编辑的服务端部分：一个只在 astro dev 里生效的 Astro integration，给开发服务器加三个接口。
// 浏览器端的部分是 src/components/dev/InlineEdit.astro。
//
//   POST /__inline-edit/source   { file, start, end }                  返回这一段源码
//   POST /__inline-edit/preview  { text }                              把一段 Markdown 渲染成 HTML，用于边输入边预览
//   POST /__inline-edit/save     { file, start, end, original, text }  把源文件里的这一段换成 text
//
// file、start、end 来自 src/plugins/source-lines.mjs 加在正文元素上的 data-source 和 data-source-range。
// 只允许读写 src/ 下的 .mdx 文件。保存时先确认这一段源码与打开编辑时读到的 original 相同，
// 不同说明文件在编辑期间被改过，这时拒绝保存，避免覆盖别处的修改。
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeStringify from 'rehype-stringify';
import rehypeMathSvg from './mathjax.mjs';

// 公式插件输出的是带 data.html 的 MDX 节点（见 mathjax.mjs），这里换成 raw 节点，由 rehype-stringify 原样输出
function rehypeMathToRaw(){
  const toRaw = node => {
    if(typeof node.data?.html === 'string') return { type: 'raw', value: node.data.html };
    if(node.children) node.children = node.children.map(toRaw);
    return node;
  };
  return tree => { toRaw(tree); };
}

const preview = unified()
  .use(remarkParse).use(remarkGfm).use(remarkMath)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeMathSvg)
  .use(rehypeMathToRaw)
  .use(rehypeStringify, { allowDangerousHtml: true });

async function renderPreview(text){
  // MDX 注释（标题末尾的 {/* #id */}）在 Markdown 里没有意义，预览时去掉
  const markdown = text.replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
  const tree = preview.runSync(preview.parse(markdown));
  // 公式插件在末尾加了一段样式和字形定义。字形定义单独返回，浏览器端把它放进页面里一个隐藏的容器
  let glyphs = '';
  const last = tree.children.at(-1);
  if(last?.type === 'raw' && last.value.includes('MJX-SVG-build-cache')){
    glyphs = last.value.replace('id="MJX-SVG-build-cache"', '');
    tree.children.pop();
  }
  return { html: preview.stringify(tree), glyphs };
}

function readBody(req){
  return new Promise((resolve, reject) => {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => { try{ resolve(JSON.parse(data)); }catch(error){ reject(error); } });
    req.on('error', reject);
  });
}

function send(res, status, body){
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

// 用 MDX 渲染一段源码，段落里的组件（<Tex>、<MarginNote> 等）也能预览。
//
// 预览的源码放在一个不存在的文件里：路径与被编辑的 MDX 在同一目录，内容是原文件的 import 语句加上这一段，
// 由下面的 Vite 插件在内存里提供。这样相对路径的 import 照常解析，文件系统里不产生任何文件，
// 也不会触发开发服务器的文件监听和页面刷新。渲染用 Astro 的 Container API，在开发服务器的 SSR 环境里执行。
const PREVIEW = '__inline-edit-preview__.mdx';
const RENDERER = '/__inline-edit-render__.mjs';
const previews = new Map();

const RENDERER_CODE = `
import { experimental_AstroContainer } from 'astro/container';
import mdxRenderer from '@astrojs/mdx/server.js';
let container;
export async function render(component){
  if(!container){
    container = await experimental_AstroContainer.create();
    container.addServerRenderer({ name: 'astro:jsx', renderer: mdxRenderer });
  }
  return container.renderToString(component);
}
`;

function previewPlugin(){
  return {
    name: 'inline-edit-preview',
    enforce: 'pre',
    resolveId(id){
      if(id === RENDERER) return id;
      if(previews.has(id)) return id;
    },
    load(id){
      if(id === RENDERER) return RENDERER_CODE;
      if(previews.has(id)) return previews.get(id);
    },
  };
}

// MDX 文件开头的 import 语句（只取 ESM 部分，正文里不会出现以 import 开头的行）
function importsOf(source){
  const body = source.replace(/^---\n[\s\S]*?\n---\n/, '');
  return body.split('\n').filter(line => /^import\s/.test(line)).join('\n');
}

async function renderMdxPreview(server, full, text){
  const environment = server.environments.ssr;
  const id = path.join(path.dirname(full), PREVIEW);
  const source = await fs.readFile(full, 'utf8');
  previews.set(id, `${importsOf(source)}\n\n${text}\n`);
  const node = environment.moduleGraph.getModuleById(id);
  if(node) environment.moduleGraph.invalidateModule(node);
  const runner = environment.runner;
  const [{ render }, mod] = await Promise.all([runner.import(RENDERER), runner.import(id)]);
  // 预览里的元素不应带源码位置：这些位置指向不存在的预览文件。
  // 组件的 <script> 也去掉：页面已经加载过这些脚本，再插入不会执行；交互图在保存、页面刷新后才初始化
  let html = (await render(mod.default))
    .replace(/ data-source(-range)?="[^"]*"/g, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
  let glyphs = '';
  const at = html.indexOf('<svg id="MJX-SVG-build-cache"');
  if(at >= 0){
    // 公式插件在末尾加的样式和字形定义：字形定义单独返回，样式页面里已经有了
    // （公式插件把两者连在一起输出，<style> 紧挨在 <svg> 前面）
    const styleAt = html.lastIndexOf('<style', at);
    const end = styleAt >= 0 && html.slice(styleAt, at).endsWith('</style>') ? styleAt : at;
    glyphs = html.slice(at).replace('id="MJX-SVG-build-cache"', '');
    html = html.slice(0, end);
  }
  return { html, glyphs };
}

export default function inlineEdit(){
  let srcDir = '';
  return {
    name: 'inline-edit',
    hooks: {
      'astro:config:setup': ({ command, updateConfig }) => {
        if(command === 'dev') updateConfig({ vite: { plugins: [previewPlugin()] } });
      },
      'astro:config:done': ({ config }) => { srcDir = fileURLToPath(config.srcDir); },
      'astro:server:setup': ({ server }) => {
        // 返回 src/ 下的 .mdx 文件的绝对路径，其他路径返回 null
        const resolveFile = file => {
          const full = path.resolve(String(file));
          return full.startsWith(srcDir) && full.endsWith('.mdx') ? full : null;
        };
        const readRange = async ({ file, start, end }) => {
          const full = resolveFile(file);
          if(!full || !Number.isInteger(start) || !Number.isInteger(end) || start > end) return null;
          const source = await fs.readFile(full, 'utf8');
          if(end > source.length) return null;
          return { full, source, text: source.slice(start, end) };
        };

        server.middlewares.use('/__inline-edit', async (req, res) => {
          if(req.method !== 'POST') return send(res, 405, { error: '只接受 POST 请求' });
          try{
            const body = await readBody(req);
            if(req.url === '/source'){
              const range = await readRange(body);
              return range ? send(res, 200, { text: range.text }) : send(res, 400, { error: '文件或位置无效' });
            }
            if(req.url === '/preview'){
              const text = String(body.text ?? '');
              const full = body.file ? resolveFile(body.file) : null;
              if(full){
                try{ return send(res, 200, { ...(await renderMdxPreview(server, full, text)), mode: 'mdx' }); }
                catch(error){
                  // 输入到一半时 MDX 常常不完整（例如标签还没闭合），这时退回只按 Markdown 渲染
                  return send(res, 200, { ...(await renderPreview(text)), mode: 'markdown', warning: String(error?.message ?? error).split('\n')[0] });
                }
              }
              return send(res, 200, await renderPreview(text));
            }
            if(req.url === '/save'){
              const range = await readRange(body);
              if(!range) return send(res, 400, { error: '文件或位置无效' });
              if(range.text !== body.original) return send(res, 409, { error: '这一段源码在编辑期间被改过，请刷新页面后重新编辑' });
              const updated = range.source.slice(0, body.start) + String(body.text) + range.source.slice(body.end);
              await fs.writeFile(range.full, updated);
              return send(res, 200, { ok: true });
            }
            send(res, 404, { error: '没有这个接口' });
          }catch(error){
            send(res, 500, { error: String(error?.message ?? error) });
          }
        });
      },
    },
  };
}
