import { texToSvg } from 'bake/math'

// Typesets the formulas inside root: every element with data-tex, and every $…$ in its text.
export async function typeset(root) {
  const texts = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  while (walker.nextNode()) {
    const node = walker.currentNode
    if (node.nodeValue.split('$').length > 2 && !node.parentElement.closest('svg, script, style, textarea')) texts.push(node)
  }
  const jobs = []
  for (const node of texts) {
    const fragment = document.createDocumentFragment()
    node.nodeValue.split('$').forEach((part, index) => {
      if (index % 2 === 0) fragment.append(part)
      else fragment.append(formula(part))
    })
    node.replaceWith(fragment)
  }
  for (const element of root.querySelectorAll('[data-tex]')) {
    const span = formula(element.dataset.tex)
    element.removeAttribute('data-tex')
    element.replaceChildren(span)
  }
  function formula(tex) {
    const span = document.createElement('span')
    span.className = 'figure-tex'
    span.textContent = tex
    jobs.push(
      texToSvg(tex).then(
        (svg) => {
          svg.setAttribute('aria-hidden', 'true')
          span.setAttribute('role', 'img')
          span.setAttribute('aria-label', tex)
          span.replaceChildren(svg)
        },
        (error) => console.error(`the formula "${tex}" cannot be typeset: ${error.message}`),
      ),
    )
    return span
  }
  await Promise.all(jobs)
}

// HTML for a formula that typeset() fills in.
export function tex(source) {
  return `<span data-tex="${source.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')}"></span>`
}
