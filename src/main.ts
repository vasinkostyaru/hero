import Phaser from 'phaser';
import { unlockAudio } from './audio/feedback';
import { GAME_H, GAME_W } from './config/game';
import { BootScene } from './scenes/BootScene';
import { DemoRoom } from './scenes/DemoRoom';
import { UIScene } from './scenes/UIScene';

const game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'game',
  width: GAME_W,
  height: GAME_H,
  backgroundColor: '#2a1d4a',
  // antialias — сглаживание текстур; antialiasGL (MSAA всего экрана) выключен: на телефоне это
  // 4 выборки на каждый пиксель 2392×1080, а картинки и так гладкие
  // batchSize: Phaser по умолчанию держит буфер вершин на 4096 спрайтов (~700 КБ) и перезаписывает
  // его между отрисовками; драйвер Mali при этом копирует буфер целиком (десятки раз за кадр) —
  // кадр упирался в поток GPU, а не в пиксели. Маленький буфер копируется почти даром.
  render: { roundPixels: true, antialias: true, antialiasGL: false, powerPreference: 'high-performance', batchSize: 512 },
  scale: {
    // высота всегда 1080, ширина подстраивается под экран: на длинных телефонах видно больше по бокам
    mode: Phaser.Scale.EXPAND,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: { activePointers: 4 },
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: 2600 }, debug: false },
  },
  scene: [BootScene, DemoRoom, UIScene],
});

// Для Playwright-скриншотов и отладки из консоли
(window as unknown as { game: Phaser.Game }).game = game;

// Звук разрешён только внутри настоящего жеста пользователя — будим его прямо из DOM-событий
for (const type of ['pointerdown', 'touchend', 'keydown']) {
  window.addEventListener(type, unlockAudio, { capture: true, passive: true });
}
