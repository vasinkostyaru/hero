import Phaser from 'phaser';
import { GROUND_Y, WORLD_W } from '../config/game';
import { addTiled, scaledTexture } from './textures';

export type SolidKind = 'roof' | 'platform' | 'wall' | 'box';

/** Твёрдый прямоугольник уровня: x, y — левый верхний угол. */
export interface Solid {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: SolidKind;
  /** по такой стене можно лазать — кирпич с плющом */
  climbable?: boolean;
}

const PLATFORM_H = 64;
/** Тон кирпича под палитру заката: чуть темнее и в сиреневый, как всё, что стоит в тени. */
const BRICK_TINT = 0xd9c6d6;
const RIM_COLOR = 0xffb46a;
const OUTLINE = 0x1c0c2a;
/** Ящик по пояс герою: crate.png (265 px) × 0.42 ≈ 110 px. */
const CRATE_SCALE = 0.42;

/**
 * Демо-комната (≈2.5 экрана): крыша по всей длине, ящик-ступенька, 3 платформы,
 * высокая стена с плющом и узкий колодец из двух стен для прыжков от стены к стене.
 */
const SOLIDS: Solid[] = [
  { x: 0, y: GROUND_Y, w: WORLD_W, h: 400, kind: 'roof' },
  { x: 860, y: GROUND_Y - 110, w: 120, h: 110, kind: 'box' },
  { x: 1100, y: GROUND_Y - 190, w: 300, h: PLATFORM_H, kind: 'platform' },
  { x: 1650, y: GROUND_Y - 575, w: 110, h: 575, kind: 'wall', climbable: true },
  { x: 1900, y: GROUND_Y - 425, w: 350, h: PLATFORM_H, kind: 'platform' },
  { x: 2550, y: GROUND_Y - 215, w: 300, h: PLATFORM_H, kind: 'platform' },
  // колодец: щель 170 px между стенами — прыгать от одной к другой
  { x: 3250, y: GROUND_Y - 615, w: 90, h: 615, kind: 'wall', climbable: true },
  { x: 3510, y: GROUND_Y - 545, w: 90, h: 545, kind: 'wall', climbable: true },
];

export const LEVEL = {
  start: { x: 500, y: GROUND_Y },
  drones: [
    { x: 2080, y: GROUND_Y - 590 },
    { x: 2700, y: GROUND_Y - 420 },
    { x: 3950, y: GROUND_Y - 360 },
  ],
  lampX: 4020,
  flagX: 4460,
};

/**
 * Уровень: рисует платформы/стены/ящик и создаёт статические тела Arcade.
 * Платформы — «односторонние»: снизу сквозь них можно запрыгнуть, сверху стоишь.
 */
export class Level {
  readonly solids = SOLIDS;
  readonly bodies: Phaser.Physics.Arcade.StaticBody[] = [];

  constructor(private scene: Phaser.Scene) {
    makeShadeTextures(scene);
    for (const s of this.solids) {
      this.draw(s);
      const body = scene.physics.add.staticBody(s.x, s.y, s.w, s.h);
      if (s.kind === 'platform') {
        body.checkCollision.down = false;
        body.checkCollision.left = false;
        body.checkCollision.right = false;
      }
      this.bodies.push(body);
    }
  }

  /** Стены и ящик — в них прилипает паутина. */
  get webTargets() {
    return this.solids.filter((s) => s.kind === 'wall' || s.kind === 'box');
  }

  /** Ближайшая опора под точкой. */
  surfaceAt(x: number, y: number, halfW = 0): Solid | undefined {
    let best: Solid | undefined;
    for (const s of this.solids) {
      if (x + halfW <= s.x || x - halfW >= s.x + s.w) continue;
      if (s.y >= y - 1 && (!best || s.y < best.y)) best = s;
    }
    return best;
  }

  /** Верх ближайшей опоры под точкой (для тени и падающего кокона). */
  floorAt(x: number, y: number, halfW = 0) {
    return this.surfaceAt(x, y, halfW)?.y ?? GROUND_Y;
  }

  /**
   * Упирается ли хитбокс боком в твёрдое (стену, ящик) — side 1 справа, -1 слева.
   * Платформы не в счёт: сквозь них сбоку проходишь.
   */
  blockedAt(side: number, left: number, right: number, top: number, bottom: number) {
    return this.solids.some(
      (s) =>
        s.kind !== 'platform' &&
        s.kind !== 'roof' &&
        bottom > s.y + 2 &&
        top < s.y + s.h &&
        Math.abs(side > 0 ? s.x - right : s.x + s.w - left) < 2,
    );
  }

  /** Climbable-стена вплотную к боку хитбокса: side 1 — справа, -1 — слева. */
  wallAt(side: number, left: number, right: number, top: number, bottom: number) {
    return this.solids.find(
      (s) =>
        s.kind === 'wall' &&
        s.climbable &&
        bottom > s.y + 4 &&
        top < s.y + s.h &&
        Math.abs(side > 0 ? s.x - right : s.x + s.w - left) < 4,
    );
  }

  private draw(s: Solid) {
    const add = this.scene.add;
    const edgeH = 148 * 0.5;
    switch (s.kind) {
      case 'roof':
        return; // крыша — addGround (фасад с градиентом)
      case 'box': {
        const key = scaledTexture(this.scene, 'crate', CRATE_SCALE);
        add.image(s.x + s.w / 2, s.y + s.h + 4, key).setOrigin(0.5, 1).setDepth(7);
        return;
      }
      case 'platform': {
        // опоры до крыши — платформа читается как конструкция на крыше, а не плитка в воздухе
        for (const k of [0.16, 0.84]) {
          const px = s.x + s.w * k;
          const top = s.y + s.h;
          add.rectangle(px - 6, top, 12, GROUND_Y - top, 0x2a1638).setOrigin(0, 0).setDepth(4);
          add.rectangle(px + 3, top, 3, GROUND_Y - top, RIM_COLOR, 0.25).setOrigin(0, 0).setDepth(4).setBlendMode(Phaser.BlendModes.ADD);
          add.rectangle(px - 10, GROUND_Y - 10, 20, 12, 0x2a1638).setOrigin(0, 0).setDepth(4);
        }
        addTiled(this.scene, s.x, s.y, s.w, s.h, 'tex_brick', 0.5, 5, BRICK_TINT);
        // объём: низ выступа в тени, тонкий тёмный контур — не сливается с городом позади
        add.image(s.x, s.y, 'shade_v').setOrigin(0, 0).setDisplaySize(s.w, s.h).setDepth(5);
        add.rectangle(s.x, s.y + s.h - 3, s.w, 3, OUTLINE, 0.9).setOrigin(0, 0).setDepth(5);
        addTiled(this.scene, s.x - 12, s.y - edgeH * 0.35, s.w + 24, edgeH, 'roof_edge', 0.5, 5);
        return;
      }
      case 'wall': {
        const tex = s.climbable ? 'tex_climb' : 'tex_brick';
        addTiled(this.scene, s.x, s.y, s.w, s.h, tex, s.climbable ? 0.45 : 0.5, 5, BRICK_TINT);
        // светотень как у фасада: края темнее (объём колонны), книзу уходит в тень
        add.image(s.x, s.y, 'shade_h').setOrigin(0, 0).setDisplaySize(s.w, s.h).setDepth(5);
        add.image(s.x, s.y, 'shade_v').setOrigin(0, 0).setDisplaySize(s.w, s.h).setDepth(5);
        // тёплый блик заката по краю со стороны солнца (справа) и тёмный контур с другой
        add.rectangle(s.x + s.w - 5, s.y, 5, s.h, RIM_COLOR, 0.32).setOrigin(0, 0).setDepth(5).setBlendMode(Phaser.BlendModes.ADD);
        add.rectangle(s.x, s.y, 3, s.h, OUTLINE, 0.85).setOrigin(0, 0).setDepth(5);
        add.rectangle(s.x + s.w - 2, s.y, 2, s.h, OUTLINE, 0.6).setOrigin(0, 0).setDepth(5);
        // тень у основания — стена «стоит» на крыше
        add.image(s.x + s.w / 2, s.y + s.h + 2, 'soft_shadow').setDisplaySize(s.w * 2.2, 34).setAlpha(0.8).setDepth(4);
        addTiled(this.scene, s.x - 10, s.y - edgeH * 0.35, s.w + 20, edgeH, 'roof_edge', 0.5, 5);
        return;
      }
    }
  }
}

/** Градиенты светотени для стен и платформ — рисуем один раз, растягиваем по размеру. */
function makeShadeTextures(scene: Phaser.Scene) {
  if (!scene.textures.exists('shade_h')) {
    const t = scene.textures.createCanvas('shade_h', 64, 4)!;
    const ctx = t.getContext();
    const g = ctx.createLinearGradient(0, 0, 64, 0);
    g.addColorStop(0, 'rgba(26, 8, 40, 0.55)');
    g.addColorStop(0.3, 'rgba(26, 8, 40, 0.1)');
    g.addColorStop(0.7, 'rgba(26, 8, 40, 0)');
    g.addColorStop(1, 'rgba(26, 8, 40, 0.25)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 4);
    t.refresh();
  }
  if (!scene.textures.exists('shade_v')) {
    const t = scene.textures.createCanvas('shade_v', 4, 128)!;
    const ctx = t.getContext();
    const g = ctx.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, 'rgba(40, 14, 58, 0)');
    g.addColorStop(0.45, 'rgba(40, 14, 58, 0.18)');
    g.addColorStop(1, 'rgba(26, 8, 42, 0.62)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 4, 128);
    t.refresh();
  }
}
