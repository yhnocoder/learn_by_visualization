// Markdown 页面的所见即所得编辑器，只在 astro dev 里使用（由 src/components/dev/MarkdownEditor.astro 加载）。
//
// 编辑器基于 Milkdown（ProseMirror 加 remark）。它用 remark 读写 Markdown，与构建页面时使用同一套语法：
// remark-math 的 $...$、$$...$$，remark-directive 的 :mark[...] 和 :::gradient-figure{...}。
// 在编辑器里：
//   - 正文直接在页面上输入，排版与发布后的页面相同；
//   - 点击公式，在公式下方修改 LaTeX，公式随输入重新渲染；输入 $...$ 生成行内公式，在空段落里输入 $$ 加空格生成行间公式；
//   - 交互图（custom element）在编辑器里正常运行，图上方的属性面板修改它的属性，图题像正文一样编辑；
//   - Ctrl/Cmd+Shift+H 给选中的文字加上或去掉标记（:mark[...]）。
// 修改在停止输入后自动写回 .md 文件（接口见 src/plugins/markdown-edit-server.mjs），Ctrl/Cmd+S 立即保存。
import { Editor, rootCtx, defaultValueCtx } from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import { history } from '@milkdown/kit/plugin/history';
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener';
import { $nodeSchema, $markSchema, $remark, $view, $inputRule, $prose } from '@milkdown/kit/utils';
import { InputRule } from '@milkdown/kit/prose/inputrules';
import { keymap } from '@milkdown/kit/prose/keymap';
import { toggleMark } from '@milkdown/kit/prose/commands';
import remarkMath from 'remark-math';
import remarkDirective from 'remark-directive';
import { mathReady } from '../lib/math.js';
import { defineElement } from '../elements/registry.js';
import './editor.css';

const remarkMathPlugin = $remark('remarkMath', () => remarkMath);
const remarkDirectivePlugin = $remark('remarkDirective', () => remarkDirective);

// ---------- 公式 ----------

async function renderTex(target, tex, display){
  await mathReady();
  if(!tex.trim()){ target.textContent = display ? '空公式' : '∅'; target.classList.add('md-math-empty'); return; }
  target.classList.remove('md-math-empty');
  const node = window.MathJax.tex2svg(tex, { display });
  // MathJax 给公式加了 tabindex，点击公式时焦点会离开编辑区域
  node.removeAttribute('tabindex');
  target.replaceChildren(node);
}

function mathSchema(id, markdownType, inline){
  return $nodeSchema(id, () => ({
    group: inline ? 'inline' : 'block',
    inline,
    atom: true,
    selectable: true,
    attrs: { value: { default: '' } },
    toDOM: node => [inline ? 'span' : 'div', { 'data-type': id, 'data-value': node.attrs.value }],
    parseDOM: [{ tag: `${inline ? 'span' : 'div'}[data-type="${id}"]`, getAttrs: dom => ({ value: dom.dataset.value ?? '' }) }],
    parseMarkdown: {
      match: node => node.type === markdownType,
      runner: (state, node, type) => { state.addNode(type, { value: node.value }); },
    },
    toMarkdown: {
      match: node => node.type.name === id,
      runner: (state, node) => { state.addNode(markdownType, undefined, node.attrs.value); },
    },
  }));
}

const mathInline = mathSchema('math_inline', 'inlineMath', true);
const mathBlock = mathSchema('math_block', 'math', false);

// 点开公式后出现在公式下方的 LaTeX 输入框。输入时公式随之重新渲染；
// 行内公式按 Enter、行间公式按 Ctrl/Cmd+Enter 确认，Esc 取消，点到别处也算确认。
let openPopup = null;

function editMath(view, getPos, nodeView, display){
  openPopup?.commit();
  const { dom } = nodeView;
  const original = nodeView.node.attrs.value;
  const popup = document.createElement('div');
  popup.className = 'md-math-popup';
  popup.innerHTML = `<textarea spellcheck="false" rows="${display ? 3 : 1}"></textarea><span>${display ? 'Ctrl/Cmd+Enter' : 'Enter'} 确认，Esc 取消</span>`;
  const input = popup.querySelector('textarea');
  input.value = original;
  document.body.append(popup);
  const place = () => {
    const r = dom.getBoundingClientRect();
    popup.style.left = `${Math.max(8, r.left + scrollX)}px`;
    popup.style.top = `${r.bottom + scrollY + 6}px`;
  };
  place();
  dom.classList.add('md-math-active');
  input.focus();
  input.select();

  let closed = false;
  const close = value => {
    if(closed) return;
    closed = true;
    openPopup = null;
    popup.remove();
    dom.classList.remove('md-math-active');
    const pos = getPos();
    if(pos == null) return;
    if(value === original){ renderTex(nodeView.texTarget, original, display); }
    else if(value.trim() === ''){ view.dispatch(view.state.tr.delete(pos, pos + nodeView.node.nodeSize)); }
    else{ view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { value })); }
    view.focus();
  };
  openPopup = { commit: () => close(input.value) };
  input.addEventListener('input', () => { renderTex(nodeView.texTarget, input.value, display).then(place); });
  input.addEventListener('keydown', e => {
    if(e.key === 'Escape'){ e.preventDefault(); close(original); }
    else if(e.key === 'Enter' && (!display || e.ctrlKey || e.metaKey)){ e.preventDefault(); close(input.value); }
  });
  input.addEventListener('blur', () => close(input.value));
}

function mathView(schema, display){
  return $view(schema.node, () => (node, view, getPos) => {
    const dom = document.createElement(display ? 'div' : 'span');
    dom.className = `md-math ${display ? 'md-math-block' : 'md-math-inline'}`;
    dom.contentEditable = 'false';
    const nodeView = {
      dom, node, texTarget: dom,
      update(next){
        if(next.type !== nodeView.node.type) return false;
        if(next.attrs.value !== nodeView.node.attrs.value) renderTex(dom, next.attrs.value, display);
        nodeView.node = next;
        return true;
      },
      ignoreMutation: () => true,
      stopEvent: e => e.type === 'mousedown',
    };
    renderTex(dom, node.attrs.value, display);
    dom.addEventListener('mousedown', e => { e.preventDefault(); editMath(view, getPos, nodeView, display); });
    // 用输入规则新建的空公式直接打开输入框
    if(!node.attrs.value) setTimeout(() => editMath(view, getPos, nodeView, display));
    return nodeView;
  });
}

const mathInlineView = mathView(mathInline, false);
const mathBlockView = mathView(mathBlock, true);

// 输入 $x^2$ 时，第二个 $ 把这段文字换成行内公式
const mathInlineRule = $inputRule(ctx => new InputRule(/(?:^|[^$\\])\$([^$\s](?:[^$]*[^$\s])?)\$$/, (state, match, start, end) => {
  const from = end - match[1].length - 2 + 1;
  return state.tr.replaceRangeWith(from, end, mathInline.type(ctx).create({ value: match[1] }));
}));

// 空段落里输入 $$ 加空格，换成一个空的行间公式
const mathBlockRule = $inputRule(ctx => new InputRule(/^\$\$\s$/, (state, match, start, end) => {
  const $start = state.doc.resolve(start);
  if($start.parent.content.size !== match[0].length - 1) return null;
  return state.tr.replaceRangeWith($start.before(), $start.after(), mathBlock.type(ctx).create({ value: '' }));
}));

// ---------- 文字标记 :mark[...] ----------

const highlight = $markSchema('highlight', () => ({
  toDOM: () => ['mark', 0],
  parseDOM: [{ tag: 'mark' }],
  parseMarkdown: {
    match: node => node.type === 'textDirective' && node.name === 'mark',
    runner: (state, node, type) => { state.openMark(type); state.next(node.children); state.closeMark(type); },
  },
  toMarkdown: {
    match: mark => mark.type.name === 'highlight',
    runner: (state, mark) => { state.withMark(mark, 'textDirective', undefined, { name: 'mark', attributes: {} }); },
  },
}));

const highlightKeymap = $prose(ctx => keymap({ 'Mod-Shift-h': toggleMark(highlight.type(ctx)) }));

// ---------- 交互图 :::name{...} ----------

const widget = $nodeSchema('widget', () => ({
  group: 'block',
  content: 'block+',
  defining: true,
  isolating: true,
  attrs: { name: { default: '' }, attributes: { default: {} } },
  toDOM: node => ['div', { 'data-type': 'widget', 'data-name': node.attrs.name }, ['figcaption', 0]],
  parseDOM: [],
  parseMarkdown: {
    match: node => node.type === 'containerDirective' && node.name.includes('-'),
    runner: (state, node, type) => {
      state.openNode(type, { name: node.name, attributes: { ...node.attributes } });
      state.next(node.children);
      state.closeNode();
    },
  },
  toMarkdown: {
    match: node => node.type.name === 'widget',
    runner: (state, node) => {
      state.openNode('containerDirective', undefined, { name: node.attrs.name, attributes: node.attrs.attributes });
      state.next(node.content);
      state.closeNode();
    },
  },
}));

function syncAttributes(el, attributes){
  for(const { name } of [...el.attributes]){
    if(!['id', 'class', 'role', 'contenteditable'].includes(name) && !(name in attributes)) el.removeAttribute(name);
  }
  for(const [k, v] of Object.entries(attributes)) if(el.getAttribute(k) !== String(v)) el.setAttribute(k, v);
}

// 交互图在编辑器里是一个整块：上方是属性面板，中间是正常运行的图，下方的图题是可编辑的正文（contentDOM）。
// 图内部的事件和 DOM 变化不交给编辑器处理，所以可以拖动滑块和图上的点。
const widgetView = $view(widget.node, () => (node, view, getPos) => {
  const { name } = node.attrs;
  const dom = document.createElement('div');
  dom.className = 'md-widget';
  const panel = document.createElement('div');
  panel.className = 'md-widget-panel';
  panel.contentEditable = 'false';
  panel.innerHTML = `<span class="md-widget-name">${name}</span>`;
  const el = document.createElement(name);
  syncAttributes(el, node.attrs.attributes);
  const caption = document.createElement('figcaption');
  el.append(caption);
  dom.append(panel, el);

  const inputs = {};
  const setAttribute = (key, value) => {
    const pos = getPos();
    if(pos == null) return;
    const attributes = { ...node.attrs.attributes, [key]: value };
    view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, attributes }));
  };
  defineElement(name).then(cls => {
    if(!cls){ panel.insertAdjacentHTML('beforeend', '<span class="md-widget-error">没有登记这个元素（src/elements/registry.js）</span>'); return; }
    for(const [key, spec] of Object.entries(cls.properties ?? {})){
      const label = document.createElement('label');
      label.textContent = spec.label ?? key;
      const input = document.createElement('input');
      input.type = spec.type === 'number' ? 'number' : 'text';
      for(const k of ['min', 'max', 'step']) if(spec[k] != null) input[k] = spec[k];
      input.value = node.attrs.attributes[key] ?? spec.default ?? '';
      input.addEventListener('input', () => setAttribute(key, input.value));
      label.append(input);
      panel.append(label);
      inputs[key] = input;
    }
  });

  return {
    dom,
    contentDOM: caption,
    update(next){
      if(next.type !== node.type || next.attrs.name !== name) return false;
      node = next;
      syncAttributes(el, node.attrs.attributes);
      for(const [key, input] of Object.entries(inputs)){
        const value = node.attrs.attributes[key];
        if(value != null && document.activeElement !== input) input.value = value;
      }
      return true;
    },
    stopEvent: e => !caption.contains(e.target),
    ignoreMutation: m => m.type !== 'selection' && !caption.contains(m.target),
  };
});

// ---------- 启动 ----------

async function post(endpoint, body){
  const res = await fetch(`/__md-edit/${endpoint}`, { method: 'POST', body: JSON.stringify(body) });
  const data = await res.json();
  if(!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

/** 把 container 里渲染好的正文换成编辑器。file 是 .md 文件的路径，setStatus 显示保存状态。 */
export async function startEditor(container, file, setStatus){
  let { body: base } = await post('source', { file });
  await mathReady();
  const host = document.createElement('div');
  host.className = 'md-editor md-body';
  host.spellcheck = false;
  container.after(host);
  container.hidden = true;

  let timer = 0, latest = null, saving = Promise.resolve();
  const save = () => {
    clearTimeout(timer);
    if(latest == null) return;
    const body = latest.endsWith('\n') ? latest : latest + '\n';
    latest = null;
    if(body === base){ setStatus('已保存'); return; }
    setStatus('正在保存……');
    saving = saving.then(() => post('save', { file, base, body }))
      .then(() => { base = body; setStatus('已保存'); })
      .catch(error => setStatus(`保存失败：${error.message}`, true));
  };

  const editor = await Editor.make()
    .config(ctx => {
      ctx.set(rootCtx, host);
      ctx.set(defaultValueCtx, base);
      ctx.get(listenerCtx).markdownUpdated((_, markdown) => {
        latest = markdown;
        setStatus('有未保存的修改');
        clearTimeout(timer);
        timer = setTimeout(save, 800);
      });
    })
    .use(commonmark).use(gfm).use(history).use(listener)
    .use([remarkMathPlugin, remarkDirectivePlugin].flat())
    .use([mathInline, mathBlock, mathInlineView, mathBlockView, mathInlineRule, mathBlockRule].flat())
    .use([highlight, highlightKeymap].flat())
    .use([widget, widgetView].flat())
    .create();

  host.addEventListener('keydown', e => {
    if(e.key === 's' && (e.ctrlKey || e.metaKey)){ e.preventDefault(); save(); }
  });
  addEventListener('beforeunload', e => { if(latest != null) e.preventDefault(); });
  setStatus('已保存');
  return { editor, flush: () => { save(); return saving; } };
}
