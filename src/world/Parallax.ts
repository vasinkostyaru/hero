import Phaser from 'phaser';
import { PARALLAX } from '../config/game';

/** Насколько слои двигаются по вертикали относительно горизонтали. */
const VERTICAL = 0.35;
/** Небо увеличено, чтобы его хватало при отъезде камеры (zoom 0.92) и вертикальном сдвиге. */
const SKY_SCALE = 1.16;
/** Облака плывут туда-обратно: центр и размах сдвига неба, px. */
const SKY_DRIFT = 70;
const WINDOWS_PER_HALF = 22;
/** С какой высоты в слоях города начинается непрозрачное (с запасом на размытие). */
const OPAQUE_TOP: Record<string, number> = { city_far: 470, city_mid: 715 };

interface WindowLight {
  img: Phaser.GameObjects.Image;
  part: number;
  dx: number;
  dy: number;
  on: boolean;
  level: number;
  timer: number;
}

/**
 * Фон в три слоя. Сдвиг делает сам Phaser через scrollFactor — в момент отрисовки,
 * по актуальной камере, поэтому фон не отстаёт на кадр.
 * - Небо (2527 px) не тянем под длину уровня: повторяем через зеркальную копию (A | Aʹ | A …) —
 *   шва нет, масштаб постоянный; облака медленно плывут (сдвиг по времени).
 * - Города бесшовные, но 5052 px больше лимита текстуры телефонов (4096) — разрезаны
 *   на половины _a/_b (art/split_bg.py) и собираются из картинок A B A B.
 * - Дальний город размыт заранее (canvas filter при загрузке) — во время игры ноль проходов;
 *   поверх — огоньки окон, которые иногда загораются и гаснут.
 */
export class Parallax {
  private sky: Phaser.GameObjects.Image[] = [];
  private layers: { parts: Phaser.GameObjects.Image[]; factor: number; period: number }[] = [];
  private windows: WindowLight[] = [];
  private t = 0;

  constructor(private scene: Phaser.Scene, worldW: number) {
    // столько копий неба, чтобы хватило на весь уровень с отъездом камеры и дрейфом облаков
    const viewW = scene.scale.width / 0.92;
    const need = viewW + PARALLAX.sky * Math.max(0, worldW - scene.scale.width) + SKY_DRIFT * 2 + 20;
    const skyW = scene.textures.get('sky').getSourceImage().width * SKY_SCALE;
    for (let i = 0; i < Math.ceil(need / skyW); i++) {
      this.sky.push(
        scene.add
          .image(i * skyW, -90, 'sky')
          .setOrigin(0, 0)
          .setScale(SKY_SCALE)
          .setFlipX(i % 2 === 1)
          .setScrollFactor(PARALLAX.sky, PARALLAX.sky * VERTICAL * 0.5)
          .setDepth(-100),
      );
    }

    // лёгкое размытие дальнего города — «воздушная перспектива»
    for (const k of ['city_far_a', 'city_far_b']) blurredCopy(scene, k, 1.6);
    const farParts = this.add('city_far', '@blur', PARALLAX.cityFar, -90);
    this.addWindows(farParts);
    this.add('city_mid', '', PARALLAX.cityMid, -80);
  }

  private add(key: string, suffix: string, factor: number, depth: number) {
    const src = this.scene.textures.get(`${key}_a`).getSourceImage();
    const half = src.width;
    // верх слоёв города полностью прозрачный — не рисуем его (на телефоне закраска пикселей дорогая)
    const top = OPAQUE_TOP[key] ?? 0;
    const parts = [0, 1, 2, 3].map((i) =>
      this.scene.add
        .image(i * half, 0, `${key}_${i % 2 ? 'b' : 'a'}${suffix}`)
        .setOrigin(0, 0)
        .setCrop(0, top, half, src.height - top)
        .setScrollFactor(factor, factor * VERTICAL)
        .setDepth(depth),
    );
    this.layers.push({ parts, factor, period: half * 2 });
    return parts;
  }

  /** Тёплые огоньки в окнах дальнего города: точки берём там, где у слоя непрозрачные дома. */
  private addWindows(parts: Phaser.GameObjects.Image[]) {
    const spots = ['city_far_a', 'city_far_b'].map((k) => this.findSpots(k));
    parts.forEach((part, pi) => {
      for (const s of spots[pi % 2]) {
        const img = this.scene.add
          .image(0, 0, 'glow')
          .setDepth(-89)
          .setTint(0xffc871)
          .setScale(0.32, 0.4)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setScrollFactor(part.scrollFactorX, part.scrollFactorY)
          .setAlpha(0);
        const on = Math.random() < 0.5;
        this.windows.push({ img, part: pi, dx: s.x, dy: s.y, on, level: on ? 1 : 0, timer: Math.random() * 8 });
      }
    });
  }

  private findSpots(key: string) {
    const src = this.scene.textures.get(key).getSourceImage() as HTMLImageElement;
    const c = document.createElement('canvas');
    c.width = src.width;
    c.height = src.height;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(src, 0, 0);
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    const spots: { x: number; y: number }[] = [];
    for (let tries = 0; tries < 4000 && spots.length < WINDOWS_PER_HALF; tries++) {
      const x = Math.floor(Math.random() * c.width);
      const y = Math.floor(c.height * (0.62 + Math.random() * 0.33));
      const i = (y * c.width + x) * 4;
      // внутри дома: непрозрачно и не слишком светло (не край крыши и не уже горящее окно)
      if (data[i + 3] > 250 && data[i] + data[i + 1] + data[i + 2] < 420) spots.push({ x, y });
    }
    return spots;
  }

  update(dt: number) {
    this.t += dt;
    const scrollX = this.scene.cameras.main.scrollX;
    // облака плывут очень медленно: туда-обратно за ~7 минут
    const drift = -(SKY_DRIFT + SKY_DRIFT * Math.sin((this.t * Math.PI * 2) / 420));
    this.sky.forEach((sky, i) => (sky.x = drift + i * sky.displayWidth));

    for (const { parts, factor, period } of this.layers) {
      const base = Math.floor((scrollX * factor) / period) * period;
      parts.forEach((p, i) => (p.x = base + (i * period) / 2));
    }
    const farParts = this.layers[0].parts;
    for (const w of this.windows) {
      w.timer -= dt;
      if (w.timer <= 0) {
        w.on = !w.on;
        w.timer = w.on ? 4 + Math.random() * 10 : 3 + Math.random() * 12;
      }
      w.level += ((w.on ? 1 : 0) - w.level) * Math.min(1, dt * 3);
      const p = farParts[w.part];
      w.img.setPosition(p.x + w.dx, p.y + w.dy).setAlpha(0.85 * w.level);
    }
  }
}

/** Размытая копия текстуры (ключ + '@blur'), один раз при загрузке. */
function blurredCopy(scene: Phaser.Scene, key: string, px: number) {
  const dst = `${key}@blur`;
  if (scene.textures.exists(dst)) return;
  const src = scene.textures.get(key).getSourceImage() as HTMLImageElement;
  const t = scene.textures.createCanvas(dst, src.width, src.height)!;
  const ctx = t.getContext();
  ctx.filter = `blur(${px}px)`;
  ctx.drawImage(src, 0, 0);
  t.refresh();
}
