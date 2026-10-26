import Phaser from 'phaser';
import { feedback } from '../audio/feedback';
import type { CritterEnv, WebTarget } from './Critter';
import { scaledTexture } from './textures';

/** Ворон ~ростом с героя: crow_laugh.png (444 px) × 0.48 ≈ 213 px. */
const LAUGH_SCALE = 0.48;
/** В полёте и лёжа (и носок) — чуть мельче: на этих картинках он нарисован крупнее. */
const FLY_SCALE = 0.45;
const HITS = 3;
/** Герой подошёл ближе — Ворон перелетает на другое место. */
const FLEE_X = 320;
const FLEE_Y = 300;
const FLY_SPEED = 650;
/** Дразнится, только когда герой хотя бы примерно рядом. */
const TEASE_DIST = 1300;
const GRAVITY = 1900;
/** Голова на crow_dizzy относительно лап (origin снизу по центру) — над ней кружат звёздочки. */
const DIZZY_HEAD = { x: -28, y: -105 };

type CrowState = 'perch' | 'fly' | 'dizzy';
type SockState = 'none' | 'drop' | 'rest' | 'taken';

interface Point {
  x: number;
  y: number;
}

/**
 * Ворон-хулиган — мини-«босс» демо-комнаты. Утащил носок, сидит на насесте и хохочет.
 * Подходишь — перелетает на другой насест. Попал паутиной — каркает и улетает;
 * после трёх попаданий падает без сил (звёздочки кружат) и роняет носок.
 * Корень — точка у лап; прицел — центр тела.
 */
export class Crow implements WebTarget {
  readonly root: Phaser.GameObjects.Container;
  private laugh: Phaser.GameObjects.Image;
  private fly: Phaser.GameObjects.Image;
  private dizzy: Phaser.GameObjects.Image;
  private stars: Phaser.GameObjects.Graphics;
  private sock: Phaser.GameObjects.Image;
  private sockGlow: Phaser.GameObjects.Image;

  private state: CrowState = 'perch';
  private sockState: SockState = 'none';
  private perch = 0;
  private hits = 0;
  private t = 0;
  private stateT = 0;
  private facing = 1;
  private laughT = -1;
  private nextLaugh = 1.5;
  private from: Point = { x: 0, y: 0 };
  private ctrl: Point = { x: 0, y: 0 };
  private to: Point = { x: 0, y: 0 };
  private flyDur = 1;
  private vy = 0;
  private bounces = 0;
  private sq = 0;
  private sqVel = 0;
  private sockV = { x: 0, y: 0 };
  private sockRestY = 0;

  constructor(
    private scene: Phaser.Scene,
    private perches: Point[],
    private env: CritterEnv,
    glowLayer: Phaser.GameObjects.Layer,
  ) {
    const p = perches[0];
    this.laugh = scene.add.image(0, 0, scaledTexture(scene, 'crow_laugh', LAUGH_SCALE)).setOrigin(0.5, 1);
    this.fly = scene.add.image(0, -100, scaledTexture(scene, 'crow_fly', FLY_SCALE)).setOrigin(0.5, 0.6).setVisible(false);
    this.dizzy = scene.add.image(0, 0, scaledTexture(scene, 'crow_dizzy', FLY_SCALE)).setOrigin(0.5, 1).setVisible(false);
    this.stars = scene.add.graphics();
    this.root = scene.add.container(p.x, p.y, [this.laugh, this.fly, this.dizzy, this.stars]).setDepth(8);
    this.sockGlow = scene.make.image({ x: 0, y: 0, key: 'glow' }, false)
      .setTint(0xffd27a).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    glowLayer.add(this.sockGlow);
    this.sock = scene.add.image(0, 0, scaledTexture(scene, 'sock', FLY_SCALE)).setDepth(9).setVisible(false);
  }

  get alive() {
    return this.state !== 'dizzy';
  }
  get x() { return this.root.x; }
  get y() { return this.root.y - 100; }

  hit() {
    if (!this.alive) return;
    this.hits++;
    this.kick(-0.18);
    this.flashWhite();
    if (this.hits >= HITS) {
      this.toDizzy();
      return;
    }
    feedback.caw(0.85);
    // обиделся — улетает на другой насест (в полёте просто летит дальше)
    if (this.state === 'perch') this.flee();
  }

  /** Герой дотянулся до носка — забираем. Возвращает true в момент подбора. */
  takeSock(hero: { left: number; right: number; top: number; bottom: number }): boolean {
    if (this.sockState !== 'rest') return false;
    const s = this.sock;
    const r = 34;
    if (s.x + r < hero.left || s.x - r > hero.right || s.y + r < hero.top || s.y - r > hero.bottom) return false;
    this.sockState = 'taken';
    this.sockGlow.setVisible(false);
    // носок взлетает над головой героя, увеличивается и рассыпается искрами
    const cx = (hero.left + hero.right) / 2;
    this.scene.tweens.add({
      targets: s,
      x: cx,
      y: hero.top - 70,
      rotation: 0,
      scale: 1.6,
      duration: 420,
      ease: 'Back.Out',
      onComplete: () => {
        this.scene.tweens.add({
          targets: s,
          scale: 2.2,
          alpha: 0,
          delay: 350,
          duration: 200,
          onStart: () => this.env.sparks.burst(s.x, s.y, 30),
          onComplete: () => s.destroy(),
        });
      },
    });
    return true;
  }

  update(dt: number) {
    this.t += dt;
    this.stateT += dt;
    switch (this.state) {
      case 'perch':
        this.perched(dt);
        break;
      case 'fly':
        this.flying(dt);
        break;
      case 'dizzy':
        this.lying(dt);
        break;
    }
    this.updateSock(dt);

    // пружина squash & stretch (как у героя), origin у лап
    this.sqVel += (-480 * this.sq - 15 * this.sqVel) * dt;
    this.sq += this.sqVel * dt;
    this.root.setScale(1 - this.sq * 0.7, 1 + this.sq);
  }

  private perched(dt: number) {
    const hero = this.env.hero;
    const dx = hero.x - this.root.x;
    this.facing = Math.sign(dx) || this.facing;
    this.laugh.setFlipX(this.facing < 0);

    // хохочет: трясётся и подпрыгивает, «кар-кар»
    const near = Math.abs(dx) < TEASE_DIST;
    if (this.laughT >= 0) {
      this.laughT += dt;
      this.laugh
        .setRotation(Math.sin(this.laughT * 28) * 0.06)
        .setScale(1, 1 + 0.05 * Math.abs(Math.sin(this.laughT * 20)));
      if (this.laughT > 0.9) this.laughT = -1;
    } else {
      this.laugh.setRotation(0).setScale(1, 1 + 0.012 * Math.sin(this.t * 3));
      this.nextLaugh -= dt;
      if (this.nextLaugh <= 0 && near) {
        this.laughT = 0;
        this.nextLaugh = Phaser.Math.FloatBetween(2.2, 3.5);
        feedback.caw();
      }
    }

    if (Math.abs(dx) < FLEE_X && Math.abs(hero.y - this.root.y) < FLEE_Y) this.flee();
  }

  /** Перелёт на ближайший насест подальше от героя — по дуге вверх. */
  private flee() {
    const hero = this.env.hero;
    const cur = { x: this.root.x, y: this.root.y };
    const others = this.perches.map((p, i) => ({ p, i })).filter(({ i }) => i !== this.perch);
    const safe = others.filter(({ p }) => Math.abs(p.x - hero.x) > 600);
    const pool = safe.length ? safe : others;
    pool.sort((a, b) => Math.hypot(a.p.x - cur.x, a.p.y - cur.y) - Math.hypot(b.p.x - cur.x, b.p.y - cur.y));
    const next = pool[0];
    this.perch = next.i;
    this.from = cur;
    this.to = { ...next.p };
    this.ctrl = { x: (cur.x + next.p.x) / 2, y: Math.min(cur.y, next.p.y) - 260 };
    this.flyDur = Math.max(0.9, Math.hypot(next.p.x - cur.x, next.p.y - cur.y) / FLY_SPEED);
    this.state = 'fly';
    this.stateT = 0;
    this.laughT = -1;
    this.laugh.setVisible(false);
    this.fly.setVisible(true);
    this.facing = Math.sign(next.p.x - cur.x) || this.facing;
    this.fly.setFlipX(this.facing < 0);
    this.kick(0.12);
    feedback.caw(1.1);
  }

  private flying(_dt: number) {
    const u = Math.min(1, this.stateT / this.flyDur);
    const s = 0.5 - 0.5 * Math.cos(Math.PI * u);
    const a = (1 - s) * (1 - s);
    const b = 2 * (1 - s) * s;
    const c = s * s;
    const prevY = this.root.y;
    this.root.x = a * this.from.x + b * this.ctrl.x + c * this.to.x;
    this.root.y = a * this.from.y + b * this.ctrl.y + c * this.to.y;
    // взмахи крыльев и наклон по ходу
    this.fly
      .setScale(1, 1 - 0.14 * (0.5 + 0.5 * Math.sin(this.t * 13)))
      .setRotation(Phaser.Math.Clamp((this.root.y - prevY) * 0.02, -0.3, 0.3) * this.facing);
    if (u >= 1) {
      this.state = 'perch';
      this.stateT = 0;
      this.fly.setVisible(false);
      this.laugh.setVisible(true);
      this.kick(-0.14);
      // сел — и сразу дразнится
      this.nextLaugh = 0.25;
    }
  }

  private toDizzy() {
    this.state = 'dizzy';
    this.stateT = 0;
    this.laugh.setVisible(false);
    this.fly.setVisible(false);
    this.dizzy.setVisible(true).setFlipX(false);
    this.vy = -320;
    this.bounces = 0;
    feedback.dizzy();
    this.env.sparks.burst(this.x, this.y, 16);
    // носок вылетает из клюва
    this.sock.setVisible(true).setPosition(this.x, this.y).setRotation(0);
    this.sockV = { x: -this.facing * 180, y: -620 };
    this.sockState = 'drop';
  }

  private lying(dt: number) {
    const r = this.root;
    const floor = this.env.floorAt(r.x, r.y - 1);
    if (r.y < floor || this.vy !== 0) {
      this.vy += GRAVITY * dt;
      r.y += this.vy * dt;
      r.rotation += 2.5 * dt;
      if (r.y >= floor) {
        r.y = floor;
        if (this.bounces < 1 && this.vy > 300) {
          this.vy = -this.vy * 0.35;
          this.bounces++;
          this.kick(-0.2);
        } else {
          this.vy = 0;
          this.kick(-0.16);
        }
      }
    }
    if (this.vy === 0) r.rotation *= 1 - Math.min(1, dt * 8);
    this.drawStars();
  }

  /** Три звёздочки кружат над головой; дальние — мельче и прозрачнее. */
  private drawStars() {
    const g = this.stars;
    g.clear();
    for (let i = 0; i < 3; i++) {
      const a = this.t * 4 + (i * Math.PI * 2) / 3;
      const depth = 0.5 + 0.5 * Math.sin(a);
      const x = DIZZY_HEAD.x + Math.cos(a) * 48;
      const y = DIZZY_HEAD.y + Math.sin(a) * 12;
      drawStar(g, x, y, 7 + 4 * depth, this.t * 3 + i, 0.55 + 0.45 * depth);
    }
  }

  private updateSock(dt: number) {
    const s = this.sock;
    if (this.sockState === 'drop') {
      this.sockV.y += GRAVITY * dt;
      s.x += this.sockV.x * dt;
      s.y += this.sockV.y * dt;
      s.rotation += 8 * dt * Math.sign(this.sockV.x);
      const floor = this.env.floorAt(s.x, s.y) - s.height * 0.4;
      if (s.y >= floor && this.sockV.y > 0) {
        s.y = floor;
        if (this.sockV.y > 400) {
          this.sockV.y *= -0.4;
          this.sockV.x *= 0.5;
        } else {
          this.sockState = 'rest';
          this.sockRestY = floor;
          this.sockGlow.setVisible(true);
          feedback.cocoon();
        }
      }
    } else if (this.sockState === 'rest') {
      // парит и светится — «подбери меня»
      s.y = this.sockRestY - 10 - 8 * Math.sin(this.t * 3);
      s.rotation = 0.15 * Math.sin(this.t * 2);
      this.sockGlow.setPosition(s.x, s.y).setScale(3.2 + 0.5 * Math.sin(this.t * 5)).setAlpha(0.55);
    }
  }

  private kick(amount: number) {
    this.sq = amount;
    this.sqVel = 0;
  }

  private flashWhite() {
    const imgs = [this.laugh, this.fly];
    for (const i of imgs) i.setTintFill(0xffffff);
    this.scene.time.delayedCall(90, () => {
      for (const i of imgs) i.clearTint();
    });
  }
}

function drawStar(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, rot: number, alpha: number) {
  const pts: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < 10; i++) {
    const a = rot + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    pts.push(new Phaser.Math.Vector2(x + Math.cos(a) * rr, y + Math.sin(a) * rr));
  }
  g.fillStyle(0xffd84a, alpha);
  g.lineStyle(2, 0x5a2a10, alpha);
  g.fillPoints(pts, true);
  g.strokePoints(pts, true);
}
