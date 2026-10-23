import './grid.css'

// Fills the matrix grids of the shape figures: each <div class="g"> gets rows × cols cells, coloured by data-hl.
export function fillGrids(root) {
  const center = 3, context = 6
  for (const g of root.querySelectorAll('.g')) {
    const rows = +g.dataset.rows, cols = +g.dataset.cols, hl = g.dataset.hl
    const negatives = (g.dataset.neg || '').split(',').filter(Boolean).map(Number)
    g.style.gridTemplateColumns = `repeat(${cols}, 16px)`
    for (let r = 0; r < rows; r++) {
      for (let k = 0; k < cols; k++) {
        const cell = document.createElement('i')
        if ((hl === 'c' && r === center) || hl === 'all-c') cell.className = 'c'
        else if (hl === 'o' && r === context) cell.className = 'o'
        else if (hl === 'all-u') cell.className = r === context ? 'o' : 'u'
        else if (hl === 'ns') cell.className = r === context ? 'o' : negatives.includes(r) ? 'k' : ''
        g.appendChild(cell)
      }
    }
  }
}
