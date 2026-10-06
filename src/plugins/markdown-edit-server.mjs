// Markdown 页面编辑器（src/editor/）的服务端部分：一个只在 astro dev 里生效的 Astro integration，给开发服务器加两个接口。
//
//   POST /__md-edit/source  { file }              返回 { body }：去掉 frontmatter 的正文
//   POST /__md-edit/save    { file, base, body }  把正文换成 body，frontmatter 不变
//
// 只允许读写 src/topics/ 下的 .md 文件。保存时先确认文件里现在的正文与 base（编辑器上次读到或写入的正文）相同，
// 不同说明文件在编辑期间被别处改过，这时拒绝保存，避免覆盖别处的修改。
// 页面读取 .md 文件不经过 Vite 的模块图，所以保存不会触发页面刷新，编辑器里的光标位置不受影响。
import fs from 'node:fs/promises';
import path from 'node:path';

// frontmatter 连同它后面的空行，编辑器输出的正文不以空行开头
const FRONTMATTER = /^---\n[\s\S]*?\n---\n\n*/;

function split(source){
  const head = source.match(FRONTMATTER)?.[0] ?? '';
  return { head, body: source.slice(head.length) };
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

export default function markdownEditServer(){
  return {
    name: 'markdown-edit-server',
    hooks: {
      'astro:server:setup': ({ server }) => {
        const topics = path.join(server.config.root, 'src', 'topics') + path.sep;
        const resolve = file => {
          const full = path.resolve(server.config.root, String(file ?? ''));
          if(!full.startsWith(topics) || !full.endsWith('.md')) throw new Error(`只能编辑 src/topics/ 下的 .md 文件：${file}`);
          return full;
        };
        server.middlewares.use('/__md-edit', async (req, res) => {
          if(req.method !== 'POST') return send(res, 405, { error: '只支持 POST' });
          try{
            const { file, base, body } = await readBody(req);
            const full = resolve(file);
            const current = split(await fs.readFile(full, 'utf8'));
            if(req.url === '/source') return send(res, 200, { body: current.body });
            if(req.url !== '/save') return send(res, 404, { error: `没有这个接口：${req.url}` });
            if(typeof body !== 'string') throw new Error('缺少 body');
            if(current.body !== base) return send(res, 409, { error: '文件在编辑期间被其他地方修改过，请刷新页面后再编辑' });
            await fs.writeFile(full, current.head + body);
            send(res, 200, { ok: true });
          }catch(error){
            send(res, 400, { error: error.message });
          }
        });
      },
    },
  };
}
