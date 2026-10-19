(() => {
  const figure = document.getElementById('figLossProbability');
  const size = figure.querySelector('#lpSize');
  const initial = [2, 1, 0, -1, 0.5, -0.5, 1.5, -1.5];
  let logits = initial.slice(0, Number(size.value));
  let target = 0;
  const output = (id, value) => { figure.querySelector(`#${id}`).textContent = value; };
  function signedBar(bar, value, scale) {
    bar.style.bottom = `${value < 0 ? 50 + value * 50 / scale : 50}%`;
    bar.style.height = `${Math.abs(value) * 50 / scale}%`;
  }
  function render() {
    figure.style.setProperty('--lp-count', logits.length);
    figure.querySelector('#lpLogits').innerHTML = logits.map((z, i) => `
      <div class="lp-cell" data-index="${i}">
        <button type="button" data-target="${i}" aria-label="设 token ${i + 1} 为目标">Token ${i + 1}</button>
        <div class="lp-logit-control"><span class="lp-limit lp-limit-top" aria-hidden="true">+6</span><span class="lp-limit lp-limit-bottom" aria-hidden="true">−6</span><div class="lp-bar-plot signed"><span class="lp-bar"></span><span class="lp-handle"></span></div>
        <input type="range" id="lpLogit${i}" aria-label="Token ${i + 1} 的 logit" min="-6" max="6" step="0.1" value="${z}" data-logit="${i}"></div>
        <output for="lpLogit${i}" class="lp-z"></output>
      </div>`).join('');
    figure.querySelector('#lpCombined').innerHTML = logits.map((_, i) => `
      <div class="lp-cell" data-index="${i}">
        <div class="lp-pair-values"><output class="lp-p" aria-label="Token ${i + 1} 的概率"></output><output class="lp-g" aria-label="Token ${i + 1} 的梯度"></output></div>
        <div class="lp-bar-plot signed lp-pair"><span class="lp-bar lp-probability-bar"></span><span class="lp-bar lp-gradient-bar"></span></div>
        <span class="lp-token-caption">Token ${i + 1}</span></div>`).join('');
    update();
  }
  function update() {
    const max = Math.max(...logits);
    const exps = logits.map(z => Math.exp(z - max));
    const sum = exps.reduce((a, b) => a + b, 0);
    const probabilities = exps.map(e => e / sum);
    const gradients = probabilities.map((p, i) => p - (i === target ? 1 : 0));
    output('lpLoss', (max - logits[target] + Math.log(sum)).toFixed(4));
    output('lpSum', probabilities.reduce((a, b) => a + b, 0).toFixed(3));
    const total = gradients.reduce((a, b) => a + b, 0);
    output('lpGradientSum', (Math.abs(total) < 1e-12 ? 0 : total).toFixed(3));
    figure.querySelectorAll('.lp-cell').forEach(cell => cell.classList.toggle('is-target', Number(cell.dataset.index) === target));
    logits.forEach((z, i) => {
      const logit = figure.querySelectorAll('#lpLogits .lp-cell')[i];
      logit.querySelector('button').setAttribute('aria-pressed', String(i === target));
      logit.querySelector('button').textContent = `${i === target ? '目标' : 'Token'} ${i + 1}`;
      logit.querySelector('.lp-z').textContent = z.toFixed(1);
      signedBar(logit.querySelector('.lp-bar'), z, 6);
      logit.querySelector('.lp-handle').style.bottom = `${(z + 6) / 12 * 100}%`;
      const pair = figure.querySelectorAll('#lpCombined .lp-cell')[i];
      pair.querySelector('.lp-p').textContent = probabilities[i].toFixed(3);
      pair.querySelector('.lp-g').textContent = `${gradients[i] < 0 ? '−' : '+'}${Math.abs(gradients[i]).toFixed(3)}`;
      signedBar(pair.querySelector('.lp-probability-bar'), probabilities[i], 1);
      signedBar(pair.querySelector('.lp-gradient-bar'), gradients[i], 1);
    });
  }
  figure.addEventListener('input', event => {
    if (!event.target.matches('[data-logit]')) return;
    logits[Number(event.target.dataset.logit)] = Number(event.target.value);
    update();
  });
  figure.addEventListener('click', event => {
    const button = event.target.closest('[data-target]');
    if (button) { target = Number(button.dataset.target); update(); }
  });
  size.addEventListener('change', () => {
    logits = Array.from({ length: Number(size.value) }, (_, i) => logits[i] ?? initial[i]);
    if (target >= logits.length) target = 0;
    render();
  });
  figure.querySelector('#lpRandom').addEventListener('click', () => {
    logits = logits.map(() => (Math.floor(Math.random() * 121) - 60) / 10);
    render();
  });
  figure.querySelector('#lpReset').addEventListener('click', () => {
    logits = initial.slice(0, Number(size.value)); target = 0; render();
  });
  render();
})();
