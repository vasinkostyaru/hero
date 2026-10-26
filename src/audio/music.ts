import { ZZFX } from 'zzfx';

/**
 * Фоновый супергеройский бит, синтезированный ZzFX (пока нет music.ogg).
 * 8 тактов, 136 BPM, бодрый мажор C → F → G → C, бочка/малый/хэты,
 * бас восьмыми и звонкая мелодия-марш (квадратная волна со срезанными верхами). Сводится один раз
 * в AudioBuffer и играет по кругу — во время игры почти ничего не стоит.
 */

const BPM = 136;
const BEAT = 60 / BPM;
const BARS = 8;
const SR = 44100;

type Params = number[];
const freq = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

const kick: Params = [1, 0, 58, 0.002, 0.03, 0.2, 0, 1, -4, 0, 0, 0, 0, 0, 0, 0, 0, 0.9, 0.05];
const snare: Params = [0.55, 0, 230, 0.002, 0.02, 0.14, 4, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.6, 0.06, 0, -5200];
const hat: Params = [0.14, 0, 3000, 0.001, 0.004, 0.035, 4, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.5, 0, 0, 7000];
const bass = (midi: number, dur: number): Params => [0.55, 0, freq(midi), 0.005, dur * 0.6, 0.05, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.8, 0.02, 0, -900];
const lead = (midi: number, dur: number): Params => [0.24, 0, freq(midi), 0.008, dur * 0.65, 0.08, 5, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.75, 0.04, 0, -3200];

// корни аккордов по тактам (бас во 2-й октаве): C F G C | C F G C
const ROOTS = [36, 41, 43, 36, 36, 41, 43, 36];
// мелодия: [доля от начала такта, длительность в долях, нота]
const MELODY: [number, number, number][][] = [
  [[0, 0.5, 67], [0.5, 0.5, 72], [1, 0.5, 76], [1.5, 1.5, 79], [3, 0.5, 76], [3.5, 0.5, 79]],
  [[0, 1.5, 81], [1.5, 0.5, 79], [2, 1, 77], [3, 1, 72]],
  [[0, 0.5, 74], [0.5, 0.5, 79], [1, 1.5, 83], [2.5, 0.5, 81], [3, 1, 79]],
  [[0, 2, 84], [2, 0.5, 79], [2.5, 0.5, 76], [3, 1, 72]],
  [[0, 0.5, 67], [0.5, 0.5, 72], [1, 0.5, 76], [1.5, 1.5, 79], [3, 0.5, 76], [3.5, 0.5, 79]],
  [[0, 0.5, 77], [0.5, 0.5, 81], [1, 1.5, 84], [2.5, 0.5, 81], [3, 1, 77]],
  [[0, 0.5, 79], [0.5, 0.5, 83], [1, 1, 86], [2, 0.5, 83], [2.5, 0.5, 79], [3, 1, 74]],
  [[0, 1, 76], [1, 1, 79], [2, 2, 84]],
];

function render(): AudioBuffer {
  const ctx = ZZFX.audioContext as AudioContext;
  const build = ZZFX.buildSamples.bind(ZZFX) as (...p: number[]) => number[];
  const len = Math.ceil(BARS * 4 * BEAT * SR);
  const mix = new Float32Array(len);
  const cache = new Map<string, number[]>();
  const add = (p: Params, beat: number, gain = 1) => {
    const key = p.join(',');
    let smp = cache.get(key);
    if (!smp) cache.set(key, (smp = build(...p)));
    const start = Math.floor(beat * BEAT * SR);
    for (let i = 0; i < smp.length; i++) mix[(start + i) % len] += smp[i] * gain; // хвосты заворачиваются в начало петли
  };

  for (let bar = 0; bar < BARS; bar++) {
    const b0 = bar * 4;
    // барабаны: бочка 1, 3 и «и» третьей доли; малый 2 и 4; хэты восьмыми
    for (const k of [0, 2, 2.5]) add(kick, b0 + k);
    for (const sn of [1, 3]) add(snare, b0 + sn);
    for (let h = 0; h < 8; h++) add(hat, b0 + h * 0.5, h % 2 ? 0.6 : 1);
    if (bar % 4 === 3) for (const f of [3.25, 3.5, 3.75]) add(snare, b0 + f, 0.6); // сбивка в конце фразы
    // бас восьмыми: корень, с октавой на сильных долях
    for (let e = 0; e < 8; e++) add(bass(ROOTS[bar] + (e % 4 === 2 ? 12 : 0), BEAT * 0.5), b0 + e * 0.5);
    for (const [at, dur, note] of MELODY[bar]) add(lead(note, dur * BEAT), b0 + at);
  }

  let peak = 0;
  for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(mix[i]));
  const k = peak > 0 ? 0.9 / peak : 1;
  const buf = ctx.createBuffer(1, len, SR);
  const out = buf.getChannelData(0);
  for (let i = 0; i < len; i++) out[i] = mix[i] * k;
  return buf;
}

let started = false;

/** Играет ли уже бит. */
export const isBeatPlaying = () => started;

/** Запускает бит по кругу с плавным появлением. Повторный вызов ничего не делает. */
export function startBeat(volume: number, fadeSec = 2.5) {
  if (started) return;
  started = true;
  const ctx = ZZFX.audioContext as AudioContext;
  const src = ctx.createBufferSource();
  src.buffer = render();
  src.loop = true;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + fadeSec);
  src.connect(gain).connect(ctx.destination);
  src.start();

  // приложение свернули — звук на паузу
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) ctx.suspend().catch(() => {});
    else ctx.resume().catch(() => {});
  });
}
