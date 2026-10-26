import Phaser from 'phaser';
import { GAME_H } from '../config/game';
import { feedback } from '../audio/feedback';
import { Critter, type CritterEnv } from './Critter';

/** Центр тела над лапами — сюда целится паутина; кадры атласа уже в игровом размере (~115 px). */
const BODY_H = 96;
/** Кидается, когда герой ближе этого по горизонтали. */
const RANGE_X = 950;
const RANGE_Y = 800;
/** Броск: тянется за жёлудем — замах — бросок — хохочет, с. */
const STEPS: [Mode, number][] = [
  ['reach', 0.35],
  ['windup', 0.32],
  ['throw', 0.25],
  ['laugh', 0.7],
];
const COOLDOWN: [number, number] = [1.6, 2.6];
const ACORN_G = 1500;

type Mode = 'idle' | 'reach' | 'windup' | 'throw' | 'laugh';

/**
 * Белка Енота-Бандита (мир 3): сидит на антенне, трубе или мостике и дразнится (idle,
 * взмах хвостом). Увидела героя — тянется за спину за жёлудем, замахивается и кидает его
 * дугой туда, где герой. Жёлудь мягко толкает; его можно сбить паутиной. Саму белку — в кокон.
 */
export class Squirrel extends Critter {
  private img: Phaser.GameObjects.Sprite;
  private mode: Mode = 'idle';
  private modeT = 0;
  private step = 0;
  private cd = Phaser.Math.FloatBetween(0.8, 2);
  private flick = Phaser.Math.FloatBetween(1.5, 3);

  constructor(scene: Phaser.Scene, x: number, floorY: number, env: CritterEnv) {
    super(scene, x, floorY - BODY_H / 2, env, { key: 'squirrel_cocoon', scale: 1, wrap: { x: 0, y: 6, rx: 52, ry: 36 } });
    // опора кадров — у лап (art/chars2.py)
    this.img = scene.add.sprite(0, BODY_H / 2, 'squirrel', 'idle_1');
    this.addParts([this.img]);
  }

  protected live(dt: number) {
    const hero = this.env.hero;
    const dx = hero.x - this.x;
    const dy = hero.y - this.y;
    this.modeT += dt;
    this.cd = Math.max(0, this.cd - dt);
    if (this.mode === 'idle') {
      this.facing = Math.sign(dx) || this.facing;
      this.flick -= dt;
      if (this.flick <= 0) this.flick = Phaser.Math.FloatBetween(1.5, 3);
      if (this.cd === 0 && Math.abs(dx) < RANGE_X && Math.abs(dy) < RANGE_Y) {
        this.step = 0;
        this.setMode(STEPS[0][0]);
      }
    } else if (this.modeT >= STEPS[this.step][1]) {
      this.step++;
      if (this.step >= STEPS.length) {
        this.cd = Phaser.Math.FloatBetween(...COOLDOWN);
        this.setMode('idle');
      } else {
        this.setMode(STEPS[this.step][0]);
        if (this.mode === 'throw') this.throwAcorn();
        if (this.mode === 'laugh') feedback.giggle(1.4);
      }
    }

    const s = this.img;
    // хвост вздрагивает: на миг второй кадр
    const frame = this.mode === 'idle' ? (this.flick < 0.25 ? 'idle_2' : 'idle_1') : this.mode;
    s.setFrame(frame).setFlipX(this.facing < 0);
    // замах — чуть приседает, хохочет — трясётся
    const shake = this.mode === 'laugh' ? Math.sin(this.modeT * 30) * 0.05 : 0;
    s.setRotation(shake).setScale(1, this.mode === 'windup' ? 0.95 : 1 + 0.015 * Math.sin(this.t * 3));
  }

  private setMode(m: Mode) {
    this.mode = m;
    this.modeT = 0;
  }

  /** Жёлудь летит дугой и падает туда, где сейчас герой (чуть выше ног). */
  private throwAcorn() {
    const hero = this.env.hero;
    const x = this.x + this.facing * 40;
    const y = this.y - 30;
    const dx = hero.x - x;
    const dy = hero.y - 80 - y;
    const T = Phaser.Math.Clamp(Math.abs(dx) / 700, 0.6, 1.2);
    const vx = dx / T;
    const vy = (dy - 0.5 * ACORN_G * T * T) / T;
    this.env.spawn?.(new Acorn(this.scene, x, y, vx, vy, this.env));
    feedback.shoot();
  }
}

/** Жёлудь: летит дугой и крутится; задел героя — толкает. Сбить паутиной — лопается искрами. */
export class Acorn extends Critter {
  private img: Phaser.GameObjects.Image;
  private hops = 0;
  private restT = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, private velX: number, private velY: number, env: CritterEnv) {
    super(scene, x, y, env, { key: 'squirrel_acorn', scale: 1, wrap: { x: 0, y: 0, rx: 24, ry: 24 } });
    this.img = scene.add.image(0, 0, 'squirrel_acorn');
    this.addParts([this.img]);
  }

  get hurtRadius() {
    return this.restT > 0 ? 0 : 28;
  }

  bumped() {
    this.pop();
  }

  hit() {
    if (!this.alive) return;
    feedback.cocoon();
    this.pop();
  }

  private pop() {
    if (this.state === 'gone') return;
    this.state = 'gone';
    this.env.sparks.burst(this.x, this.y, 10);
    this.root.destroy();
  }

  protected live(dt: number) {
    const r = this.root;
    if (this.restT > 0) {
      // лежит на крыше и тает
      this.restT += dt;
      r.setAlpha(Math.max(0, 1 - (this.restT - 0.6) / 0.4));
      if (this.restT > 1) this.pop();
      return;
    }
    this.velY += ACORN_G * dt;
    r.x += this.velX * dt;
    r.y += this.velY * dt;
    r.rotation += (this.velX > 0 ? 9 : -9) * dt;
    const floor = this.env.floorAt(r.x, r.y - 20) - 18;
    if (this.velY > 0 && r.y >= floor) {
      r.y = floor;
      if (this.hops < 1) {
        this.hops++;
        this.velY = -this.velY * 0.35;
        this.velX *= 0.5;
        feedback.stick();
      } else {
        this.restT = 0.001;
      }
    }
    if (r.y > GAME_H + 100) this.pop();
  }
}
