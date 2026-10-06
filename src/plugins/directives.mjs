// Markdown 页面（src/topics/**/*.md）里的指令块，语法见 remark-directive：
//
//   :mark[文字]                     文字标记，输出 <mark>文字</mark>
//   :::gradient-figure{x0="1.2"}    交互图。名字里带连字符的容器指令输出同名的 custom element，
//   图题，可以写公式和多个段落        属性原样成为元素的属性，指令里的内容成为图题 <figcaption>。
//   :::                             custom element 的定义在 src/elements/registry.js 里登记。
//
// 其他名字的指令不认识，构建时报错，避免内容在页面上静默消失。
import { visit } from 'unist-util-visit';

export default function remarkDirectives(){
  return (tree, file) => {
    visit(tree, ['textDirective', 'leafDirective', 'containerDirective'], node => {
      if(node.type === 'textDirective' && node.name === 'mark'){
        node.data = { hName: 'mark' };
        return;
      }
      if(node.type === 'containerDirective' && node.name.includes('-')){
        node.data = { hName: node.name, hProperties: { ...node.attributes } };
        node.children = [{ type: 'figureCaption', data: { hName: 'figcaption' }, children: node.children }];
        return;
      }
      file.fail(`不认识的指令：${node.name}`, { place: node.position });
    });
  };
}
