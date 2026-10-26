import Phaser from 'phaser';
import { feedback } from '../audio/feedback';
import type { Sparks } from './fx';
import { scaledTexture } from './textures';

/** Во что можно попасть паутиной: автоприцел летит в (x, y). */
export interface WebTarget {
  readonly alive: boolean;
  readonly x: number;
  readonly y: number;
  hit(): void;
}

/** Что шалунам нужно знать о мире. */
export interface CritterEnv {
  sparks: Sparks;
  /** верх опоры под точкой: кокон падает на крышу или платформу */
  floorAt: (x: number, y: number) => number;
  /** героя видят все: голубь идёт на него, чайка пикирует, Ворон улетает */
  hero: { readonly x: number; readonly y: number };
  /** шалун бросил что-то (жёлудь белки) — сцена обновляет его, толкает им героя и даёт сбить паутиной */
  spawn?: (c: Critter) => void;
}

/** Вид после попадания: картинка кокона и эллипс, по которому наматываются нити. */
export interface CocoonLook {
  key: string;
  scale: number;
  wrap: { x: number; y: number; rx: number; ry: number };
}

export type CritterState = 'live' | 'wrap' | 'cocoon' | 'gone';

const WRAP_MS = 320;
const VANISH_S = 3;

/**
 * Шалун: живёт по-своему (live), а попадание паутиной у всех одинаковое —
 * белые нити быстро наматываются, подмена на кокон, кокон падает с вращением,
 * 1–2 раза отскакивает и через 3 с исчезает облачком искорок.
 * Корень — центр тела: в него целится автоприцел.
 */
export abstract class Critter implements WebTarget {
  readonly root: Phaser.GameObjects.Container;
  state: CritterState = 'live';
  protected t = Math.random() * 10;
  protected stateT = 0;
  /** 1 — смотрит вправо, как нарисован; -1 — отражён */
  protected facing = 1;
  private parts: Phaser.GameObjects.GameObject[] = [];
  private cocoon: Phaser.GameObjects.Image;
  private wrapG: Phaser.GameObjects.Graphics;
  private vy = 0;
  private spin = 0;
  private bounces = 0;

  constructor(
    protected scene: Phaser.Scene,
    x: number,
    y: number,
    protected env: CritterEnv,
    private look: CocoonLook,
  ) {
    this.cocoon = scene.add.image(0, 0, scaledTexture(scene, look.key, look.scale)).setVisible(false);
    this.wrapG = scene.add.graphics();
    this.root = scene.add.container(x, y, [this.cocoon, this.wrapG]).setDepth(8);
  }

  /** Картинки живого шалуна — под коконом и нитями; при обмотке прячутся. */
  protected addParts(parts: Phaser.GameObjects.GameObject[]) {
    this.parts.push(...parts);
    this.root.addAt(parts, 0);
  }

  get alive() {
    return this.state === 'live';
  }
  get x() { return this.root.x; }
  get y() { return this.root.y; }

  /** Радиус, в котором шалун толкает героя; 0 — безобидный. */
  get hurtRadius() {
    return 0;
  }

  /** Толкнул героя — своя реакция (развернуться, отлететь). */
  bumped() {}

  hit() {
    if (!this.alive) return;
    this.state = 'wrap';
    this.stateT = 0;
  }

  update(dt: number) {
    this.t += dt;
    this.stateT += dt;
    switch (this.state) {
      case 'live':
        this.live(dt);
        break;
      case 'wrap':
        this.wrap();
        break;
      case 'cocoon':
        this.fall(dt);
        break;
    }
  }

  protected abstract live(dt: number): void;

  /** Пока обматывают нитями: k 0..1 (дрон, например, сбавляет пропеллер). */
  protected wrapping(_k: number) {}

  private wrap() {
    // белые нити-дуги быстро нарастают вокруг тела
    const k = Math.min(1, (this.stateT * 1000) / WRAP_MS);
    const { x: cx, y: cy, rx, ry } = this.look.wrap;
    const g = this.wrapG;
    g.clear();
    const n = 9;
    for (let i = 0; i < n; i++) {
      const p = Phaser.Math.Clamp(k * 1.6 - i / n, 0, 1);
      if (p <= 0) continue;
      const tilt = -0.9 + (1.8 * i) / (n - 1);
      g.lineStyle(2.5, 0xffffff, 0.9);
      g.beginPath();
      const ery = ry + (i % 3) * 6;
      const steps = 24;
      for (let s = 0; s <= steps * p; s++) {
        const a = (s / steps) * Math.PI * 2 + i;
        const ex = Math.cos(a) * rx;
        const ey = Math.sin(a) * ery;
        const px = cx + ex * Math.cos(tilt) - ey * Math.sin(tilt);
        const py = cy + ex * Math.sin(tilt) + ey * Math.cos(tilt);
        if (s === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.strokePath();
    }
    this.wrapping(k);
    if (k >= 1) {
      g.clear();
      for (const p of this.parts) (p as Phaser.GameObjects.Image).setVisible(false);
      this.cocoon.setVisible(true).setFlipX(this.facing < 0);
      this.state = 'cocoon';
      feedback.cocoon();
      this.vy = -120;
      this.spin = Phaser.Math.FloatBetween(3, 5) * (Math.random() < 0.5 ? -1 : 1);
      this.bounces = 0;
    }
  }

  private fall(dt: number) {
    const r = this.root;
    const floor = this.env.floorAt(r.x, r.y) - this.cocoon.height * 0.45;
    if (r.y < floor || this.vy !== 0) {
      this.vy += 1900 * dt;
      r.y += this.vy * dt;
      r.rotation += this.spin * dt;
      if (r.y >= floor) {
        r.y = floor;
        if (this.bounces < 2 && this.vy > 200) {
          this.vy = -this.vy * 0.42;
          this.spin *= -0.6;
          this.bounces++;
        } else {
          this.vy = 0;
        }
      }
    }
    // на земле плавно выпрямляемся
    if (this.vy === 0) r.rotation *= 1 - Math.min(1, dt * 8);

    if (this.stateT > VANISH_S + WRAP_MS / 1000) {
      this.env.sparks.burst(r.x, r.y, 18);
      feedback.poof();
      this.state = 'gone';
      this.scene.tweens.add({ targets: r, alpha: 0, scale: 0.6, duration: 160, onComplete: () => r.destroy() });
    }
  }
}
