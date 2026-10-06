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

export default function inlineEdit(){
  let srcDir = '';
  return {
    name: 'inline-edit',
    hooks: {
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
              return send(res, 200, await renderPreview(String(body.text ?? '')));
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
