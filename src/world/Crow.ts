import Phaser from 'phaser';
import { feedback } from '../audio/feedback';
import type { CritterEnv, WebTarget } from './Critter';
import type { Perch } from './Level';
import { scaledTexture } from './textures';

/** Ворон ~ростом с героя: crow2/crow_laugh.png (461 px) × 0.46 ≈ 212 px. */
const LAUGH_SCALE = 0.46;
/** Полёт (crow_fly_1/2) и лёжа — на этих картинках он нарисован крупнее. */
const FLY_SCALE = 0.45;
const DIZZY_SCALE = 0.42;
/** Носок, выпавший у босса, — как предмет уровня. */
const SOCK_SCALE = 0.42;
/** Взмахи: 2 кадра, ~8 к/с (CROW2.md). */
const FLAP_FPS = 8;
/** Клюв в полёте — от точки у лап (вещь висит под ним); картинки выровнены по клюву (beak.json). */
const BEAK = { x: 70, y: -125 };
/** На насесте вещь свисает с нижней половины раскрытого клюва (crow_laugh, от точки у лап). */
const LAUGH_BEAK = { x: 53, y: -143 };
/** Сидит над местом вещи — роняет её, когда герой подошёл настолько (видит это). */
const DROP_X = 950;
/** Вещь в клюве — по большей стороне (как на art/crow_items_preview.png, ~треть Ворона). */
const CARRY_SIZE = 70;
const HITS = 3;
/** Герой подошёл ближе — Ворон перелетает на другое место. */
const FLEE_X = 320;
const FLEE_Y = 300;
const FLY_SPEED = 650;
/** Дразнится, только когда герой хотя бы примерно рядом. */
const TEASE_DIST = 1300;
const GRAVITY = 1900;
/** Голова на crow_dizzy относительно лап (origin снизу по центру) — над ней кружат звёздочки. */
const DIZZY_HEAD = { x: 66, y: -100 };

type CrowState = 'perch' | 'fly' | 'escape' | 'gone' | 'dizzy';
/** Уровень: дразнится и ведёт вперёд, в конце улетает. Босс: перелетает между насестами, 3 попадания. */
export interface CrowOptions {
  boss?: boolean;
  /** вещи уровня по порядку: несёт следующую, роняет над её местом (или улетая с насеста) */
  items?: CarriedItem[];
  /** уронил вещь из клюва в точке (x, y) */
  onDrop?: (key: string, x: number, y: number) => void;
  /** улетел с последнего насеста за край — уровень пройден */
  onEscape?: () => void;
}
/** На уровне: подошёл на столько (или обогнал) — улетает на насест следующей зоны. */
const LEAD_X = 380;

/** Вещь, которую Ворон несёт: place — x её места на уровне; atPerch — роняет, улетая с этого насеста. */
export interface CarriedItem {
  key: string;
  place: number;
  atPerch?: boolean;
}
type SockState = 'none' | 'drop' | 'rest' | 'taken';

interface Point {
  x: number;
  y: number;
}

/**
 * Ворон-хулиган (CROW2.md). Сидит на насесте и хохочет; в полёте машет крыльями (2 кадра)
 * и несёт в клюве следующую вещь уровня — пролетая над её местом, роняет, и вещь, кружась,
 * падает туда; вещей не осталось — несёт носок.
 * На уровне (GAME.md): насест в каждой зоне, подошёл — улетает только вперёд;
 * попал паутиной — сердито каркает и улетает раньше; с последнего насеста улетает
 * за край — уровень пройден. Босс (уровень 3 мира): перелетает между насестами,
 * после трёх попаданий падает без сил (звёздочки кружат) и роняет носок.
 * Корень — точка у лап; прицел — центр тела.
 */
export class Crow implements WebTarget {
  readonly root: Phaser.GameObjects.Container;
  private laugh: Phaser.GameObjects.Image;
  private fly: Phaser.GameObjects.Image;
  private carry: Phaser.GameObjects.Image;
  private carried: CarriedItem[];
  private beak: Record<'crow_fly_1' | 'crow_fly_2', { beakX: number; beakY: number }>;
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
  /** пока true — сидит и не улетает (крупный план в начале уровня) */
  hold = false;

  constructor(
    private scene: Phaser.Scene,
    private perches: Perch[],
    private env: CritterEnv,
    glowLayer: Phaser.GameObjects.Layer,
    private opts: CrowOptions = {},
  ) {
    const p = perches[0];
    this.carried = [...(opts.items ?? [])].sort((a, b) => a.place - b.place);
    this.beak = scene.cache.json.get('crow_beak');
    this.laugh = scene.add.image(0, 0, scaledTexture(scene, 'crow_laugh', LAUGH_SCALE)).setOrigin(0.5, 1);
    this.fly = scene.add.image(BEAK.x, BEAK.y, scaledTexture(scene, 'crow_fly_1', FLY_SCALE)).setVisible(false);
    // вещь в клюве видна всегда — и на насесте, и в полёте: понятно, что у него ещё есть одежда
    this.carry = scene.add.image(BEAK.x, BEAK.y, 'sock').setOrigin(0.5, 0.15);
    this.dizzy = scene.add.image(0, 0, scaledTexture(scene, 'crow_dizzy', DIZZY_SCALE)).setOrigin(0.5, 1).setVisible(false);
    this.stars = scene.add.graphics();
    this.root = scene.add.container(p.x, p.y, [this.laugh, this.fly, this.carry, this.dizzy, this.stars]).setDepth(8);
    this.setCarry();
    this.sockGlow = scene.make.image({ x: 0, y: 0, key: 'glow' }, false)
      .setTint(0xffd27a).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    glowLayer.add(this.sockGlow);
    this.sock = scene.add.image(0, 0, scaledTexture(scene, 'sock', SOCK_SCALE)).setDepth(9).setVisible(false);
  }

  /** В клюве — следующая вещь, а когда вещей не осталось — носок. */
  private setCarry() {
    const key = this.carried[0]?.key ?? 'sock';
    const src = this.scene.textures.get(key).getSourceImage();
    this.carry.setTexture(scaledTexture(this.scene, key, CARRY_SIZE / Math.max(src.width, src.height)));
  }

  /** Роняет вещь из клюва: она падает в своё место (Item.drop), в клюве — следующая. */
  private dropCarried() {
    const it = this.carried.shift();
    if (!it) return;
    const m = this.carry.getWorldTransformMatrix();
    this.opts.onDrop?.(it.key, m.tx, m.ty + 20);
    this.setCarry();
    this.kick(0.1);
    feedback.caw(1.2);
  }

  /** Сразу улететь вперёд (после крупного плана в начале уровня). */
  leave() {
    if (this.state === 'perch') this.flee();
  }

  /** Кадр взмаха и вещь под клювом: картинки выровнены по клюву, при отражении — зеркально. */
  private flap() {
    const frame = Math.floor(this.t * FLAP_FPS) % 2 === 0 ? 'crow_fly_1' : 'crow_fly_2';
    const flip = this.facing < 0;
    const f = this.fly.setTexture(scaledTexture(this.scene, frame, FLY_SCALE)).setFlipX(flip);
    const src = this.scene.textures.get(frame).getSourceImage();
    const b = this.beak[frame];
    f.setOrigin(flip ? 1 - b.beakX / src.width : b.beakX / src.width, b.beakY / src.height);
    // корпус чуть поднимается на взмахе вниз и опускается на взмахе вверх
    const bob = frame === 'crow_fly_1' ? 5 : -5;
    f.setPosition(BEAK.x * this.facing, BEAK.y + bob);
    // вещь — маятником в такт взмахам
    this.carry.setPosition(BEAK.x * this.facing, BEAK.y + bob).setFlipX(flip).setAngle(10 * Math.sin(this.t * FLAP_FPS * Math.PI));
  }

  get alive() {
    return this.state === 'perch' || this.state === 'fly';
  }

  /** Сразу расхохотаться (крупный план). */
  laughNow() {
    this.laughT = 0;
    this.nextLaugh = 1.2;
    this.kick(0.14);
    feedback.caw();
  }
  get x() { return this.root.x; }
  get y() { return this.root.y - 100; }

  hit() {
    if (!this.alive) return;
    this.hits++;
    this.kick(-0.18);
    this.flashWhite();
    if (!this.opts.boss) {
      // на уровне не падает — сердится и улетает раньше
      feedback.caw(0.85);
      if (this.state === 'perch') this.flee();
      return;
    }
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
      case 'escape':
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

    // вещь свисает из клюва и качается, пока хохочет
    const shake = this.laughT >= 0 ? Math.sin(this.laughT * 28) * 0.06 : 0;
    this.carry
      .setPosition(LAUGH_BEAK.x * this.facing, LAUGH_BEAK.y + (this.laughT >= 0 ? -4 * Math.abs(Math.sin(this.laughT * 20)) : 0))
      .setFlipX(this.facing < 0)
      .setRotation(shake * 3 + 0.12 * Math.sin(this.t * 2.4));

    if (this.hold) return;
    // насест над местом вещи: герой подошёл и видит — роняет её туда, хохочет и ждёт дальше
    const here = this.perches[this.perch];
    if (here.drop && this.carried[0]?.key === here.drop && dx > -DROP_X) {
      here.drop = undefined;
      this.dropCarried();
      this.laughNow();
    }
    if (this.opts.boss ? Math.abs(dx) < FLEE_X && Math.abs(hero.y - this.root.y) < FLEE_Y : dx > -LEAD_X) this.flee();
  }

  /** Улетает: на уровне — на насест следующей зоны (или за край), у босса — на другой насест. */
  private flee() {
    const hero = this.env.hero;
    const cur = { x: this.root.x, y: this.root.y };
    const here = this.perches[this.perch];
    this.showFlight();
    // эту вещь роняет, улетая с этого насеста, — у героя на глазах
    if (here.drop && this.carried[0]?.key === here.drop) this.dropCarried();
    here.drop = undefined;
    if (!this.opts.boss) {
      if (this.perch + 1 >= this.perches.length) {
        this.escape();
        return;
      }
      this.flyTo(this.perch + 1, this.perches[this.perch + 1]);
      return;
    }
    const others = this.perches.map((p, i) => ({ p, i })).filter(({ i }) => i !== this.perch);
    const safe = others.filter(({ p }) => Math.abs(p.x - hero.x) > 600);
    const pool = safe.length ? safe : others;
    pool.sort((a, b) => Math.hypot(a.p.x - cur.x, a.p.y - cur.y) - Math.hypot(b.p.x - cur.x, b.p.y - cur.y));
    this.flyTo(pool[0].i, pool[0].p);
  }

  /** Улетает с носком вверх-вправо за край экрана — дальше уровень заканчивается. */
  private escape() {
    const cur = { x: this.root.x, y: this.root.y };
    this.startFlight(cur, { x: cur.x + 1700, y: cur.y - 900 }, 2.2);
    this.state = 'escape';
  }

  private flyTo(i: number, p: Point) {
    this.perch = i;
    const cur = { x: this.root.x, y: this.root.y };
    this.startFlight(p, p, Math.max(0.9, Math.hypot(p.x - cur.x, p.y - cur.y) / FLY_SPEED));
  }

  /** Перелёт по дуге вверх. */
  private startFlight(to: Point, end: Point, dur: number) {
    const cur = { x: this.root.x, y: this.root.y };
    this.from = cur;
    this.to = { ...end };
    this.ctrl = { x: (cur.x + to.x) / 2, y: Math.min(cur.y, to.y) - 260 };
    this.flyDur = dur;
    this.state = 'fly';
    this.stateT = 0;
    this.laughT = -1;
    this.facing = Math.sign(end.x - cur.x) || this.facing;
    this.showFlight();
    this.kick(0.12);
    feedback.caw(1.1);
  }

  private showFlight() {
    this.laugh.setVisible(false);
    this.fly.setVisible(true);
    this.carry.setVisible(true);
    this.flap();
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
    // взмахи, наклон по ходу
    this.flap();
    this.root.setRotation(Phaser.Math.Clamp((this.root.y - prevY) * 0.02, -0.3, 0.3) * this.facing);
    // пролетает над местом следующей вещи — роняет её туда
    const next = this.carried[0];
    if (next && !next.atPerch && (this.root.x - next.place) * this.facing >= 0 && Math.abs(this.root.x - next.place) < 400) this.dropCarried();
    if (u >= 1 && this.state === 'escape') {
      this.state = 'gone';
      this.root.setVisible(false);
      this.opts.onEscape?.();
      return;
    }
    if (u >= 1) {
      this.state = 'perch';
      this.stateT = 0;
      this.root.setRotation(0);
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
    this.carry.setVisible(false);
    this.root.setRotation(0);
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
