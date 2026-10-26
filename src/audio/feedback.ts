import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { ZZFX, ZZFXSound } from 'zzfx';

/**
 * Звуки (ZzFX, синтез без файлов) и вибрация — всё «ощущение» игры в одном месте.
 * Звуки мягкие и детские: синус/треугольник, плавная атака, без резкого шума.
 * Параметры ZzFX: [громкость, разброс, частота, атака, сустейн, релиз, форма, кривизна,
 * слайд, дельта-слайд, скачок тона, время скачка, повтор, шум, модуляция, биткраш,
 * задержка, громкость сустейна, спад, тремоло, фильтр].
 */

ZZFX.volume = 0.5;

// Фильтр ZzFX (последний параметр): отрицательный — срезаем верха (мягче), положительный — низы.
const S = {
  // прыжок: игровое «бойнг» вверх + еле слышное «вжух» воздуха
  whoosh: new ZZFXSound([0.18, 0, 900, 0.04, 0.03, 0.12, 4, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.7, 0, 0, -2600]),
  // классическое игровое «бойнг» вверх: квадратная волна, верха срезаны — не режет уши
  hop: new ZZFXSound([0.32, 0, 280, 0.005, 0.07, 0.08, 5, 1, 12, 0, 0, 0, 0, 0, 0, 0, 0, 0.7, 0.03, 0, -3500]),
  land: new ZZFXSound([0.8, 0.08, 95, 0.004, 0.02, 0.14, 0, 1.2, -3, 0, 0, 0, 0, 0.4, 0, 0, 0, 0.6, 0.04, 0, -700]),
  step: new ZZFXSound([0.3, 0.25, 150, 0.002, 0.008, 0.045, 0, 1, -4, 0, 0, 0, 0, 0.6, 0, 0, 0, 0.4, 0, 0, -1200]),
  // выстрел паутиной: короткое «твип»
  shoot: new ZZFXSound([0.35, 0.03, 1400, 0.004, 0.025, 0.1, 1, 1, -40, 0, 0, 0, 0, 0, 0, 0, 0, 0.7, 0.02, 0, -4000]),
  // попадание: липкое «шлёп» паутины…
  splat: new ZZFXSound([0.6, 0.1, 160, 0.003, 0.03, 0.14, 4, 1, -2, 0, 0, 0, 0, 0, 0, 0, 0, 0.5, 0.05, 0, -900]),
  // …«фррр» — нити обматывают дрона…
  wrap: new ZZFXSound([0.25, 0.05, 300, 0.02, 0.22, 0.08, 4, 1, 0, 0, 0, 0, 0.035, 0, 0, 0, 0, 0.6, 0, 0.6, -1800]),
  // …и «монеточный» двухнотный «дзынь», когда кокон готов
  chime: new ZZFXSound([0.28, 0, 988, 0.002, 0.06, 0.25, 5, 1, 0, 0, 331, 0.06, 0, 0, 0, 0, 0, 0.6, 0.03, 0, -5000]),
  poof: new ZZFXSound([0.4, 0.2, 380, 0.03, 0.06, 0.32, 0, 1, 2, 0, 0, 0, 0, 1.2, 0, 0, 0.04, 0.5, 0.1, 0, -1600]),
  stick: new ZZFXSound([0.4, 0.05, 210, 0.004, 0.015, 0.08, 1, 1.2, -9, 0, 0, 0, 0, 0.3, 0, 0, 0, 0.6, 0, 0, -1400]),
};

let lastBuzz = 0;
function buzz(style: ImpactStyle) {
  // не накладываем вибрации друг на друга (кнопка + выстрел в одном кадре)
  const now = performance.now();
  if (now - lastBuzz < 45) return;
  lastBuzz = now;
  Haptics.impact({ style }).catch(() => {});
}

/** Браузеры и WebView запускают звук только после жеста пользователя. */
export function unlockAudio() {
  const ctx = ZZFX.audioContext as AudioContext;
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
}

export const feedback = {
  button() {
    buzz(ImpactStyle.Light);
  },
  jump() {
    S.whoosh.play();
    S.hop.play();
  },
  /** impact 0..1 — сила приземления (высота падения) */
  land(impact: number) {
    S.land.play(0.35 + 0.65 * impact, 1 - 0.15 * impact);
    if (impact > 0.35) buzz(ImpactStyle.Light);
  },
  step() {
    S.step.play(0.6);
  },
  shoot() {
    S.shoot.play();
    buzz(ImpactStyle.Light);
  },
  hit() {
    S.splat.play();
    S.wrap.play();
    buzz(ImpactStyle.Medium);
  },
  /** кокон готов — радостный «дзынь» */
  cocoon() {
    S.chime.play();
  },
  poof() {
    S.poof.play();
  },
  stick() {
    S.stick.play();
    buzz(ImpactStyle.Light);
  },
  wallJump() {
    S.whoosh.play(1, 1.15);
    S.hop.play(0.8, 1.2);
    buzz(ImpactStyle.Light);
  },
};
