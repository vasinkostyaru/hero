import Phaser from 'phaser';
import { feedback } from '../audio/feedback';
import { Critter, type CritterEnv } from './Critter';
import { scaledTexture } from './textures';

/** Чайка ~2/3 роста героя: seagull.png (382 px) × 0.38 ≈ 145 px. */
const SCALE = 0.38;
const PATROL_V = 170;
const WARN_T = 0.55;
const DIVE_T = 1.25;

/**
 * Чайка кружит высоко над крышей. Заметив героя внизу, кричит («!» над головой),
 * затем пикирует по дуге через то место, где он стоит, и снова набирает высоту.
 * Задела — героя мягко отбрасывает (без урона). Сбить можно и в полёте, и в пике.
 */
export class Seagull extends Critter {
  private img: Phaser.GameObjects.Image;
  private bang: Phaser.GameObjects.Graphics;
  private mode: 'patrol' | 'warn' | 'dive' = 'patrol';
  private modeT = 0;
  private dir = 1;
  private cd = Phaser.Math.FloatBetween(1.5, 3);
  private p0 = { x: 0, y: 0 };
  private p1 = { x: 0, y: 0 };
  private p2 = { x: 0, y: 0 };

  constructor(
    scene: Phaser.Scene,
    private cx: number,
    private altY: number,
    private range: number,
    env: CritterEnv,
  ) {
    super(scene, cx, altY, env, { key: 'seagull_cocoon', scale: SCALE, wrap: { x: 0, y: 4, rx: 66, ry: 32 } });
    this.img = scene.add.image(0, 0, scaledTexture(scene, 'seagull', SCALE));
    this.bang = scene.add.graphics().setVisible(false);
    drawBang(this.bang);
    this.addParts([this.img, this.bang]);
  }

  get hurtRadius() {
    return this.mode === 'dive' ? 55 : 0;
  }

  protected live(dt: number) {
    this.modeT += dt;
    const r = this.root;
    const hero = this.env.hero;
    const hx = hero.x;
    const hy = hero.y - 100;
    let flapRate = 11;

    switch (this.mode) {
      case 'patrol': {
        r.x += this.dir * PATROL_V * dt;
        if (r.x > this.cx + this.range) this.dir = -1;
        if (r.x < this.cx - this.range) this.dir = 1;
        r.y += (this.altY + Math.sin(this.t * 1.3) * 16 - r.y) * Math.min(1, dt * 2);
        r.rotation *= 1 - Math.min(1, dt * 4);
        this.cd -= dt;
        const dx = Math.abs(hx - r.x);
        if (this.cd <= 0 && dx < 480 && dx > 120 && hy > r.y + 150) {
          this.mode = 'warn';
          this.modeT = 0;
          this.dir = Math.sign(hx - r.x) || 1;
          feedback.squawk();
        }
        break;
      }
      case 'warn': {
        // зависла, часто машет и кричит — «!» выпрыгивает над головой
        flapRate = 18;
        const pop = Math.min(1, this.modeT / 0.12);
        this.bang.setVisible(true).setScale(pop * (1 + 0.15 * Math.sin(this.modeT * 30)));
        if (this.modeT >= WARN_T) {
          this.bang.setVisible(false);
          // дуга через героя: в середине (u = 0.5) кривая Безье проходит ровно через точку H
          this.p0 = { x: r.x, y: r.y };
          this.p2 = { x: hx + (hx - r.x), y: r.y };
          this.p1 = { x: 2 * hx - (this.p0.x + this.p2.x) / 2, y: 2 * hy - (this.p0.y + this.p2.y) / 2 };
          this.mode = 'dive';
          this.modeT = 0;
        }
        break;
      }
      case 'dive': {
        flapRate = 4; // крылья почти сложены
        const u = Math.min(1, this.modeT / DIVE_T);
        const s = 0.5 - 0.5 * Math.cos(Math.PI * u);
        const prev = { x: r.x, y: r.y };
        const a = (1 - s) * (1 - s);
        const b = 2 * (1 - s) * s;
        const c = s * s;
        r.x = a * this.p0.x + b * this.p1.x + c * this.p2.x;
        r.y = a * this.p0.y + b * this.p1.y + c * this.p2.y;
        const vy = r.y - prev.y;
        const vx = Math.abs(r.x - prev.x) || 1e-3;
        r.rotation = Phaser.Math.Clamp(Math.atan2(vy, vx) * 0.6, -0.7, 0.7) * this.dir;
        if (u >= 1) {
          this.mode = 'patrol';
          this.cd = Phaser.Math.FloatBetween(3.5, 5.5);
        }
        break;
      }
    }

    this.facing = this.dir;
    this.img.setFlipX(this.dir < 0);
    this.bang.setX(this.dir * 34).setY(-78);
    // взмахи: картинка с раскрытыми крыльями чуть сплющивается в ритм
    this.img.setScale(1, 1 - 0.12 * (0.5 + 0.5 * Math.sin(this.t * flapRate)));
  }
}

/** Жёлтый «!» с тёмным контуром — рисуем один раз, потом только масштабируем. */
function drawBang(g: Phaser.GameObjects.Graphics) {
  g.fillStyle(0x3a1a0c, 1);
  g.fillRoundedRect(-9, -42, 18, 40, 8);
  g.fillCircle(0, 12, 10);
  g.fillStyle(0xffd84a, 1);
  g.fillRoundedRect(-6, -39, 12, 34, 6);
  g.fillCircle(0, 12, 7);
}
