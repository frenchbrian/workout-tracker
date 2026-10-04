// Tiny DOM helper: h('button', { class: 'x', onclick: fn }, 'text', childNode)
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'value') el.value = v;
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function today() {
  return new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
}

export function shortDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const opts = { month: 'short', day: 'numeric' };
  if (y !== new Date().getFullYear()) opts.year = 'numeric';
  return date.toLocaleDateString(undefined, opts);
}

export function fmtNum(v) {
  if (v === null || v === undefined || v === '') return '';
  return String(Number(v));
}

export const LOAD_TYPES = {
  machine: 'Machine level',
  free_weight: 'Free weight (lb)',
  bands: 'Bands (lb)',
  weight_vest: 'Weight vest (lb)',
  body: 'Body weight',
};

let audio;
export function beep() {
  try {
    audio = audio || new AudioContext();
    for (const [start, freq] of [[0, 880], [0.25, 880], [0.5, 1175]]) {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.frequency.value = freq;
      osc.connect(gain).connect(audio.destination);
      const t = audio.currentTime + start;
      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.start(t);
      osc.stop(t + 0.2);
    }
  } catch { /* no audio available */ }
}

export function primeAudio() {
  try { audio = audio || new AudioContext(); audio.resume(); } catch { /* ignore */ }
}
