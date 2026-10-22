import { typeset } from '../../../../components/lib/typeset.js'
import './jacobian-shapes.css'

export const params = { variant: { label: '内容', type: 'enum', options: ['single', 'chain'], default: 'single' } }
export const layout = { placeholder: { narrow: 260, wide: 240 } }

const shape = (kind, tex) => `<span class="math-shape ${kind}">$${tex}$</span>`
const label = (name, kind, tex) => `<div class="shape-label">${name}</div>${shape(kind, tex)}`

const tables = {
  single: [
    ['', label('scalar', 'scalar', 'x'), label('vector', 'column', String.raw`\mathbf{x}`)],
    [label('scalar', 'scalar', 'f'), shape('scalar', String.raw`\frac{\partial f}{\partial x}`), shape('row', String.raw`\frac{\partial f}{\partial\mathbf{x}}`)],
    [label('vector', 'column', String.raw`\mathbf{f}`), shape('column', String.raw`\frac{\partial\mathbf{f}}{\partial x}`), shape('matrix', String.raw`\frac{\partial\mathbf{f}}{\partial\mathbf{x}}`)],
  ],
  chain: [
    ['', [label('scalar', 'scalar', 'x'), 2], label('vector', 'column', String.raw`\mathbf{x}`)],
    [
      String.raw`$\frac{\partial}{\partial\mathbf{x}}\mathbf{f}(\mathbf{g}(\mathbf{x}))=\frac{\partial\mathbf{f}}{\partial\mathbf{g}}\frac{\partial\mathbf{g}}{\partial\mathbf{x}}$`,
      label('scalar', 'scalar', 'u'),
      label('vector', 'column', String.raw`\mathbf{u}`),
      label('vector', 'column', String.raw`\mathbf{u}`),
    ],
    [
      label('scalar', 'scalar', 'f'),
      shape('scalar', String.raw`\frac{\partial f}{\partial u}`) + shape('scalar', String.raw`\frac{\partial u}{\partial x}`),
      shape('row', String.raw`\frac{\partial f}{\partial\mathbf{u}}`) + shape('column', String.raw`\frac{\partial\mathbf{u}}{\partial x}`),
      shape('row', String.raw`\frac{\partial f}{\partial\mathbf{u}}`) + shape('matrix', String.raw`\frac{\partial\mathbf{u}}{\partial\mathbf{x}}`),
    ],
    [
      label('vector', 'column', String.raw`\mathbf{f}`),
      shape('column', String.raw`\frac{\partial\mathbf{f}}{\partial u}`) + shape('scalar', String.raw`\frac{\partial u}{\partial x}`),
      shape('matrix', String.raw`\frac{\partial\mathbf{f}}{\partial\mathbf{u}}`) + shape('column', String.raw`\frac{\partial\mathbf{u}}{\partial x}`),
      shape('matrix', String.raw`\frac{\partial\mathbf{f}}{\partial\mathbf{u}}`) + shape('matrix', String.raw`\frac{\partial\mathbf{u}}{\partial\mathbf{x}}`),
    ],
  ],
}

export default class JacobianShapes extends HTMLElement {
  connectedCallback() {
    const rows = tables[this.params.variant]
    const cell = (content) => (Array.isArray(content) ? `<td colspan="${content[1]}">${content[0]}</td>` : `<td>${content}</td>`)
    this.innerHTML = `<div class="shape-table-wrap" tabindex="0" aria-label="Jacobian 维度示意表，可横向滚动"><table class="shape-table">${rows.map((row) => `<tr>${row.map(cell).join('')}</tr>`).join('')}</table></div>`
    typeset(this)
  }
}
