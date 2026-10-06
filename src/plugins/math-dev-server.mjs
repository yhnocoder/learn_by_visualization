// 开发服务器里把页面 HTML 中的公式占位标签换成 SVG。占位标签的作用见 mathjax.mjs 里 deferred 的说明。
// 这是一个只在 astro dev 里生效的 Astro integration：给开发服务器加一个中间件，
// 先收齐 Astro 输出的 HTML，再调用 expandMath 替换后返回给浏览器。
import { expandMath } from './mathjax.mjs';

export default function mathDevServer(){
  return {
    name: 'math-dev-server',
    hooks: {
      'astro:server:setup': ({ server }) => {
        server.middlewares.use((req, res, next) => {
          if(req.method !== 'GET') return next();
          const chunks = [];
          const { write, end, writeHead } = res;
          const isHtml = () => String(res.getHeader('content-type') ?? '').includes('text/html');
          // 替换后长度会变，去掉 Astro 可能设置的 Content-Length
          res.writeHead = function(status, ...rest){
            const headers = rest.find(arg => arg && typeof arg === 'object');
            if(headers) for(const key of Object.keys(headers)) if(key.toLowerCase() === 'content-length') delete headers[key];
            res.removeHeader('content-length');
            return writeHead.call(this, status, ...rest);
          };
          res.write = function(chunk, encoding, callback){
            if(!isHtml()) return write.call(this, chunk, encoding, callback);
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, typeof encoding === 'string' ? encoding : 'utf8'));
            if(typeof encoding === 'function') encoding();
            else if(typeof callback === 'function') callback();
            return true;
          };
          res.end = function(chunk, encoding, callback){
            if(typeof chunk === 'function'){ callback = chunk; chunk = undefined; }
            if(!isHtml() && !chunks.length) return end.call(this, chunk, encoding, callback);
            if(chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, typeof encoding === 'string' ? encoding : 'utf8'));
            const html = expandMath(Buffer.concat(chunks).toString('utf8'));
            if(!res.headersSent) res.removeHeader('content-length');
            return end.call(this, html, 'utf8', typeof encoding === 'function' ? encoding : callback);
          };
          next();
        });
      },
    },
  };
}
