// 减少 Astro 的 MDX 流程里 rehype-raw 的耗时。
//
// Astro 在用户的 rehype 插件之前运行 rehype-raw。rehype-raw 对每个带子节点的 JSX 元素（MDX 里的
// <td>、<div>、<Fold> 等）分别调用一次 hast-util-from-parse5，后者每次都把整份源文件重新切分成行，
// 只为计算一个随后会被丢弃的根节点位置。矩阵微积分译文有约 400 个这样的元素和 9 万个字符，
// 这一步每次编译要 0.5 秒左右。元素自身的位置来自 parse5 的行列号，不读取源文件内容。
//
// remarkHideSource 在 remark 阶段结束时让 String(file) 暂时返回空字符串，
// rehypeRestoreSource 作为第一个用户 rehype 插件（在 rehype-raw 之后）恢复它。
export function remarkHideSource(){
  return (tree, file) => {
    file.toString = () => '';
  };
}

export function rehypeRestoreSource(){
  return (tree, file) => {
    delete file.toString;
  };
}
