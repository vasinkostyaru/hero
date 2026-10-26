import Phaser from 'phaser';
import { feedback } from '../audio/feedback';
import { WORLD_TOP } from '../config/game';
import { scaledTexture } from './textures';

/**
 * Набор платформ мира 1 — атлас platforms (art/platforms.py), всё уже в игровом размере.
 * Длинные (доски, леса, балка) собираются из краёв и модулей середины любой длины;
 * люлька ездит вверх-вниз; бельё и тент — батуты; тележка с крюком катается по балке.
 */

export type PlatformLook = 'wood' | 'scaffold' | 'beam';

interface LongMeta {
  h: number;
  /** где стоит герой — от верха картинки */
  stand: number;
  left: number;
  right: number;
  mids: number[];
}

interface SpecialMeta {
  w: number;
  h: number;
  stand: number | null;
}

export interface PlatformsMeta {
  long: Record<PlatformLook, LongMeta>;
  special: Record<'cradle' | 'balcony' | 'clothesline' | 'trolley', SpecialMeta>;
}

export const meta = (scene: Phaser.Scene) => scene.cache.json.get('platforms_meta') as PlatformsMeta;

/** Опоры до крыши — цвет материала: тёмное дерево или сталь. */
export const POST_COLOR: Record<PlatformLook, number> = { wood: 0x3a1f14, scaffold: 0x232a44, beam: 0x232a44 };

/**
 * Длинная платформа: левый край, модули середины вперемешку, правый край.
 * Ширина подгоняется к целому числу модулей — возвращает итоговую.
 * y — линия, где стоит герой.
 */
export function addLongPlatform(scene: Phaser.Scene, look: PlatformLook, x: number, y: number, w: number, depth: number) {
  const m = meta(scene).long[look];
  const top = y - m.stand;
  let cx = x;
  scene.add.image(cx, top, 'platforms', `${look}_l`).setOrigin(0, 0).setDepth(depth);
  cx += m.left;
  // порядок модулей — от x: одна и та же платформа всегда выглядит одинаково
  let i = Math.floor(x / 7);
  while (cx + m.right < x + w - 10) {
    const k = i % m.mids.length;
    scene.add.image(cx, top, 'platforms', `${look}_m${k + 1}`).setOrigin(0, 0).setDepth(depth);
    cx += m.mids[k];
    i += 3;
  }
  scene.add.image(cx, top, 'platforms', `${look}_r`).setOrigin(0, 0).setDepth(depth);
  return cx + m.right - x;
}

/** Ширина пола у особых платформ: края картинки — перила и шкивы, на них не стоят. */
const CRADLE_INSET = 18;

/**
 * Люлька мойщика окон: ездит вверх-вниз между top и bottom (линии пола), тросы уходят в небо.
 * Тело — одностороннее, как у платформ; героя, стоящего на полу, везёт с собой (Level.update).
 */
export class Cradle {
  readonly body: Phaser.Physics.Arcade.StaticBody;
  readonly floor: { x: number; y: number; w: number };
  /** сдвиг пола за последний кадр — чтобы везти героя */
  dy = 0;
  private img: Phaser.GameObjects.Image;
  private ropes: Phaser.GameObjects.Graphics;
  private t: number;
  private stand: number;

  constructor(
    scene: Phaser.Scene,
    private x: number,
    private top: number,
    private bottom: number,
    private period: number,
  ) {
    const m = meta(scene).special.cradle;
    this.stand = m.stand!;
    this.t = Math.random() * period;
    this.floor = { x: x + CRADLE_INSET, y: this.yAt(this.t), w: m.w - CRADLE_INSET * 2 };
    this.ropes = scene.add.graphics().setDepth(4);
    this.img = scene.add.image(x, 0, 'platforms', 'cradle').setOrigin(0, 0).setDepth(7);
    this.body = scene.physics.add.staticBody(this.floor.x, this.floor.y, this.floor.w, 24);
    this.body.checkCollision.down = false;
    this.body.checkCollision.left = false;
    this.body.checkCollision.right = false;
    this.place();
  }

  /** Плавно туда-обратно: у концов замедляется. */
  private yAt(t: number) {
    const k = 0.5 - 0.5 * Math.cos((t / this.period) * Math.PI * 2);
    return this.bottom + (this.top - this.bottom) * k;
  }

  update(dt: number) {
    this.t += dt;
    const y = this.yAt(this.t);
    this.dy = y - this.floor.y;
    this.floor.y = y;
    // у тела нет игрового объекта — StaticBody.reset не подходит, двигаем сами
    // (у RTree в типах Phaser нет remove/insert, но они есть — ими пользуется сам StaticBody)
    const tree = this.body.world.staticTree as unknown as { remove(b: unknown): void; insert(b: unknown): void };
    tree.remove(this.body);
    this.body.position.set(this.floor.x, y);
    this.body.updateCenter();
    tree.insert(this.body);
    this.place();
  }

  private place() {
    const imgTop = this.floor.y - this.stand;
    this.img.setY(imgTop);
    // тросы на картинке доходят до её верха — дальше тянем их до неба
    const g = this.ropes;
    g.clear();
    for (const rx of [this.x + 13, this.x + this.img.width - 13]) {
      g.lineStyle(5, 0x5a3a24, 1).lineBetween(rx, WORLD_TOP, rx, imgTop + 4);
      g.lineStyle(2, 0xc98a52, 0.7).lineBetween(rx + 1, WORLD_TOP, rx + 1, imgTop + 4);
    }
  }
}

/**
 * Батут: бельё на верёвке или тент. Не твёрдый — падаешь на верх, и тебя подбрасывает
 * (HeroController). Сам пружинит: картинка сплющивается и отыгрывает.
 */
export class Bouncer {
  readonly top: number;
  readonly left: number;
  readonly right: number;
  private sq = 0;
  private sqVel = 0;
  private imgs: Phaser.GameObjects.Image[];

  /** launchTo — подбросить не вверх, а к этой точке по x (тенты в улице — обратно к краю крыши). */
  constructor(
    img: Phaser.GameObjects.Image | Phaser.GameObjects.Image[],
    top: number,
    left: number,
    right: number,
    readonly power: number,
    readonly launchTo?: number,
  ) {
    this.imgs = Array.isArray(img) ? img : [img];
    this.top = top;
    this.left = left;
    this.right = right;
  }

  /** Пересёк ли низ героя верх батута за этот кадр (сверху вниз). */
  caught(x: number, prevBottom: number, bottom: number) {
    return x > this.left && x < this.right && prevBottom <= this.top + 6 && bottom >= this.top;
  }

  bounce() {
    this.sq = -0.22;
    this.sqVel = 0;
    feedback.boing();
  }

  update(dt: number) {
    this.sqVel += (-520 * this.sq - 12 * this.sqVel) * dt;
    this.sq += this.sqVel * dt;
    for (const img of this.imgs) img.setScale(1 - this.sq * 0.25, 1 + this.sq);
  }
}

/** Бельё на верёвке между столбиками; линия батута — верх белья. */
export function addClothesline(scene: Phaser.Scene, x: number, groundY: number) {
  const m = meta(scene).special.clothesline;
  // origin у основания: пружинит от земли
  const img = scene.add.image(x + m.w / 2, groundY + 4, 'platforms', 'clothesline').setOrigin(0.5, 1).setDepth(6);
  return new Bouncer(img, groundY + 4 - m.h + m.stand!, x + 30, x + m.w - 30, 1750);
}

/** awning.png (530×235) × 0.5: тент на стене, кронштейн слева — вешаем на правый бок стены. */
const AWNING_SCALE = 0.5;
/** верх полотна от верха картинки */
const AWNING_STAND = 30;

/** y — верх картинки тента. */
export function addAwning(scene: Phaser.Scene, wallRight: number, y: number) {
  const key = scaledTexture(scene, 'awning', AWNING_SCALE);
  // origin снизу: при прыжке полотно проминается вниз
  const img = scene.add.image(wallRight, y, key).setOrigin(0, 1).setDepth(6);
  img.setY(y + img.height);
  return new Bouncer(img, y + AWNING_STAND, wallRight + 30, wallRight + img.width - 10, 1900);
}

/**
 * Улица между домами: внизу ряд тентов на всю ширину. Упал — тент подбрасывает
 * обратно на край крыши, с которой прыгал (GAME.md: сразу пробовать снова, без флага).
 */
export function addStreet(scene: Phaser.Scene, x0: number, x1: number, groundY: number, bottom: number) {
  const g = scene.add.graphics().setDepth(-3);
  // провал: тёмная улица вглубь, по бокам — стены домов
  g.fillGradientStyle(0x2a1638, 0x2a1638, 0x120818, 0x120818, 1).fillRect(x0, groundY - 4, x1 - x0, bottom - groundY + 8);
  g.fillStyle(0x1c0c2a, 1).fillRect(x0 - 4, groundY - 4, 10, bottom - groundY + 8).fillRect(x1 - 6, groundY - 4, 10, bottom - groundY + 8);
  // тёплые окна напротив, вглубине улицы
  for (let wx = x0 + 60; wx < x1 - 60; wx += 120) {
    g.fillStyle(0xffc871, 0.35).fillRect(wx, groundY + 50, 26, 34);
  }
  const key = scaledTexture(scene, 'awning', AWNING_SCALE);
  const imgs: Phaser.GameObjects.Image[] = [];
  const top = bottom - 70;
  for (let x = x0 + 10; x < x1 - 40; x += 230) {
    const img = scene.add.image(x, top - AWNING_STAND, key).setOrigin(0, 1).setDepth(6);
    img.setY(top - AWNING_STAND + img.height);
    imgs.push(img);
  }
  return new Bouncer(imgs, top, x0 + 10, x1 - 10, 1900, x0 - 90);
}

/** Тележка с крюком катается по балке туда-обратно (пока украшение; потом — крюк, за который цепляться). */
export class Trolley {
  private img: Phaser.GameObjects.Image;
  private t = Math.random() * 10;

  /** Кончик крюка в мире — на нём может висеть предмет. */
  hookPoint() {
    const r = this.img.rotation;
    // крюк на картинке — около (−8, 125) от верха по центру; поворачивается вместе с тележкой
    return { x: this.img.x - 8 * Math.cos(r) - 125 * Math.sin(r), y: this.img.y + 125 * Math.cos(r) - 8 * Math.sin(r) };
  }

  constructor(
    scene: Phaser.Scene,
    private minX: number,
    private maxX: number,
    beamTop: number,
  ) {
    this.img = scene.add.image(minX, beamTop, 'platforms', 'trolley').setOrigin(0.5, 0).setDepth(6);
  }

  update(dt: number) {
    this.t += dt;
    const k = 0.5 - 0.5 * Math.cos(this.t * 0.9);
    const x = this.minX + (this.maxX - this.minX) * k;
    const vx = (x - this.img.x) / Math.max(dt, 1e-3);
    this.img.x = x;
    // крюк чуть отстаёт — качается против хода
    this.img.rotation += (Phaser.Math.Clamp(-vx * 0.0006, -0.12, 0.12) - this.img.rotation) * Math.min(1, dt * 4);
  }
}
