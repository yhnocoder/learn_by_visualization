// 开发服务器（astro dev）里给正文的块级元素加上两个属性，构建（astro build）时不加：
//   data-source        “源文件路径:行:列”。按住 Alt（macOS 上是 Option）点击正文时，
//                      src/components/dev/SourceJump.astro 在编辑器里打开这一行。
//   data-source-range  这个元素在源文件里的起止字符位置“开始-结束”。页面内编辑
//                      （src/components/dev/InlineEdit.astro）按它读取和替换这一段源码。
import { visit } from 'unist-util-visit';

const BLOCKS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'pre', 'table', 'tr', 'figure', 'figcaption', 'div', 'section', 'mjx-container', 'img', 'hr', 'dt', 'dd']);
// 页面内编辑只用于这些元素：它们的源码是一段完整的 Markdown，可以单独渲染预览。
// pre 包括代码块和行间公式（remark-math 把 $$...$$ 输出成 <pre>，公式插件把这两个属性转到 <mjx-container> 上）
const EDITABLE = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'table', 'pre']);

// MDX 里直接写的 HTML 块（小写的 JSX 元素，例如 <table>、<div>、<td>）也可以编辑：
// 它们的子内容不是 Markdown 段落，没有自己的源码位置，所以给 JSX 元素本身加上这两个属性。
// 预览用 MDX 渲染（见 inline-edit-server.mjs），能显示这些 HTML。组件（大写开头）的属性会变成 props，不在这里处理。
const JSX_EDITABLE = new Set(['div', 'table', 'tr', 'ul', 'ol', 'li', 'td', 'th', 'p', 'center', 'blockquote', 'details', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

function setJsxAttribute(node, name, value){
  if(node.attributes.some(a => a.name === name)) return;
  node.attributes.push({ type: 'mdxJsxAttribute', name, value });
}

export default function rehypeSourceLines(){
  return (tree, file) => {
    if(process.env.NODE_ENV === 'production' || !file.path) return;
    visit(tree, node => node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement', node => {
      const start = node.position?.start, end = node.position?.end;
      if(!node.name || !JSX_EDITABLE.has(node.name) || start?.offset == null || end?.offset == null) return;
      setJsxAttribute(node, 'data-source', `${file.path}:${start.line}:${start.column}`);
      setJsxAttribute(node, 'data-source-range', `${start.offset}-${end.offset}`);
    });
    visit(tree, 'element', node => {
      const start = node.position?.start, end = node.position?.end;
      if(!start || !BLOCKS.has(node.tagName)) return;
      node.properties.dataSource = `${file.path}:${start.line}:${start.column}`;
      if(EDITABLE.has(node.tagName) && start.offset != null && end?.offset != null){
        node.properties.dataSourceRange = `${start.offset}-${end.offset}`;
      }
    });
  };
}
