import Phaser from 'phaser';
import { itemScale } from '../world/Item';
import { scaledTexture } from '../world/textures';

/** Фон слотов: мир 1 — бельевая верёвка с прищепками; мир 2 — полка с игрушками, мир 3 — праздничный стол. */
export type SlotStyle = 'rope' | 'shelf' | 'table';

/** Где слоты: точки и висят ли предметы (на прищепке) или стоят (на полке, на столе). */
interface Pins {
  points: { x: number; y: number }[];
  hang: boolean;
}

/** Не найденный предмет — тёмный силуэт (ITEMS.md). */
const SILHOUETTE = 0x2a1838;
const SILHOUETTE_ALPHA = 0.6;

/**
 * Рисует фон шириной w (центр — 0, 0) и возвращает точки слотов: откуда свисают предметы
 * или на чём стоят. Новый мир — новая функция здесь, остальной код слотов не меняется.
 */
const BACKDROPS: Record<SlotStyle, (g: Phaser.GameObjects.Graphics, w: number, k: number) => Pins> = {
  rope(g, w, k) {
    const sag = 16 * k;
    const yAt = (x: number) => sag * (1 - (2 * x) / w) * (1 + (2 * x) / w);
    // верёвка провисает; тёмная прядь и светлый блик
    for (const [width, color, dy] of [[6 * k, 0x5a3a24, 0], [2 * k, 0xd9a066, -1.5 * k]] as const) {
      g.lineStyle(width, color, 1).beginPath();
      for (let x = -w / 2; x <= w / 2; x += w / 24) {
        if (x === -w / 2) g.moveTo(x, yAt(x) + dy);
        else g.lineTo(x, yAt(x) + dy);
      }
      g.strokePath();
    }
    // узелки на концах
    g.fillStyle(0x5a3a24, 1).fillCircle(-w / 2, 0, 7 * k).fillCircle(w / 2, 0, 7 * k);
    const pins = [-w / 3, 0, w / 3].map((x) => ({ x, y: yAt(x) }));
    for (const p of pins) {
      // деревянная прищепка: две половинки и пружинка
      g.fillStyle(0x3a2216, 1).fillRoundedRect(p.x - 7 * k, p.y - 16 * k, 14 * k, 34 * k, 4 * k);
      g.fillStyle(0xe0a86a, 1).fillRoundedRect(p.x - 5 * k, p.y - 14 * k, 10 * k, 30 * k, 3 * k);
      g.fillStyle(0x8a5a34, 1).fillRect(p.x - 0.8 * k, p.y - 14 * k, 1.6 * k, 30 * k);
      g.fillStyle(0xb8c0d0, 1).fillCircle(p.x, p.y, 3.2 * k);
    }
    return { points: pins.map((p) => ({ x: p.x, y: p.y + 14 * k })), hang: true };
  },

  shelf(g, w, k) {
    // деревянная полка на двух кронштейнах; доска с тёмным торцом и светлой кромкой
    const top = 70 * k;
    const h = 18 * k;
    for (const x of [-w * 0.36, w * 0.36]) {
      g.fillStyle(0x3a2216, 1).fillTriangle(x - 6 * k, top + h, x + 6 * k, top + h, x - 6 * k, top + h + 34 * k);
      g.fillStyle(0x3a2216, 1).fillRect(x - 9 * k, top + h, 6 * k, 38 * k);
    }
    g.fillStyle(0x3a2216, 1).fillRoundedRect(-w / 2 - 4 * k, top - 2 * k, w + 8 * k, h + 4 * k, 5 * k);
    g.fillStyle(0xb8743e, 1).fillRoundedRect(-w / 2, top, w, h, 4 * k);
    g.fillStyle(0xe0a86a, 1).fillRect(-w / 2 + 4 * k, top + 2 * k, w - 8 * k, 4 * k);
    return { points: [-w / 3, 0, w / 3].map((x) => ({ x, y: top + 2 * k })), hang: false };
  },

  table(g, w, k) {
    // праздничный стол: скатерть в горошек с фестонами, ножки
    const top = 70 * k;
    const h = 30 * k;
    for (const x of [-w * 0.4, w * 0.4]) g.fillStyle(0x5a3a24, 1).fillRect(x - 6 * k, top + h, 12 * k, 30 * k);
    g.fillStyle(0x3a1830, 1).fillRoundedRect(-w / 2 - 4 * k, top - 3 * k, w + 8 * k, h + 6 * k, 6 * k);
    g.fillStyle(0xff7aa8, 1).fillRect(-w / 2, top, w, h);
    const n = 12;
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + (w / n) * (i + 0.5);
      g.fillStyle(0xff7aa8, 1).fillCircle(x, top + h, w / n / 2);
      g.fillStyle(0xfff3e0, 0.9).fillCircle(x, top + h * 0.45, 3.2 * k);
    }
    g.fillStyle(0xffb8d0, 1).fillRect(-w / 2, top, w, 4 * k);
    return { points: [-w / 3, 0, w / 3].map((x) => ({ x, y: top + 2 * k })), hang: false };
  },
};

/**
 * Три слота для предметов уровня: найденные висят в цвете и колышутся,
 * не найденные — тёмный силуэт (или почти невидимый, пока уровень идёт).
 */
export class ItemSlots {
  readonly root: Phaser.GameObjects.Container;
  private pins: { x: number; y: number }[];
  private hang: boolean;
  private imgs: Phaser.GameObjects.Image[];
  private filled: boolean[];
  private t = Math.random() * 10;

  /** k — масштаб всего (HUD — 1, экран победы — крупнее); size — размер предмета. */
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    keys: string[],
    style: SlotStyle,
    k: number,
    size: number,
    /** прозрачность силуэтов пустых слотов: в HUD — подсказка, на победе — как в ITEMS.md */
    emptyAlpha = SILHOUETTE_ALPHA,
  ) {
    const g = scene.add.graphics();
    const { points, hang } = BACKDROPS[style](g, 560 * k, k);
    this.pins = points;
    this.hang = hang;
    this.imgs = keys.map((key, i) => {
      const key2 = scaledTexture(scene, key, itemScale(scene, key, size));
      return scene.add.image(this.pins[i].x, this.pins[i].y, key2).setOrigin(0.5, hang ? 0.06 : 1).setTint(SILHOUETTE).setAlpha(emptyAlpha);
    });
    this.filled = keys.map(() => false);
    // вещи — за верёвкой с прищепками (прищепка держит сверху); игрушки и сладости стоят перед полкой
    this.root = scene.add.container(x, y, hang ? [...this.imgs, g] : [g, ...this.imgs]);
  }

  /** Где на экране слот i (для полёта предмета в прищепку). */
  slotPos(i: number) {
    const p = this.pins[i];
    const s = this.root.scale;
    return { x: this.root.x + p.x * s, y: this.root.y + (p.y + (this.hang ? 40 : -30)) * s };
  }

  fill(i: number) {
    if (this.filled[i]) return;
    this.filled[i] = true;
    const img = this.imgs[i].clearTint().setAlpha(1);
    // повис — подпрыгнул на прищепке
    img.scene.tweens.add({ targets: img, scale: { from: 1.35, to: 1 }, duration: 420, ease: 'Back.Out' });
  }

  update(dt: number) {
    this.t += dt;
    this.imgs.forEach((img, i) => {
      // найденные колышутся на ветру (стоящие — покачиваются чуть-чуть), силуэты — едва
      const amp = (this.filled[i] ? 7 : 2) * (this.hang ? 1 : 0.5);
      img.setAngle(amp * Math.sin(this.t * 1.7 + i * 1.3));
    });
  }
}
