import { For } from 'solid-js';

export const CENTER_ROW = 3;
export const CONTEXT_ROW = 6;

export function cellKind(highlight, row, noise = []) {
  if ((highlight === 'center' && row === CENTER_ROW) || highlight === 'all-center') return 'w2v-cell-center';
  if (highlight === 'context' && row === CONTEXT_ROW) return 'w2v-cell-context';
  if (highlight === 'all-context') return row === CONTEXT_ROW ? 'w2v-cell-context' : 'w2v-cell-updated';
  if (highlight === 'negative') return row === CONTEXT_ROW ? 'w2v-cell-context' : noise.includes(row) ? 'w2v-cell-noise' : '';
  return '';
}

export function Grid(props) {
  const cells = () => Array.from({ length: props.rows * props.columns }, (_, index) => Math.floor(index / props.columns));
  return (
    <div class="w2v-grid" style={{ 'grid-template-columns': `repeat(${props.columns}, var(--w2v-cell, 16px))` }}>
      <For each={cells()}>{(row) => <i class={cellKind(props.highlight, row, props.noise)} />}</For>
    </div>
  );
}
