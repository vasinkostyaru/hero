import Phaser from 'phaser';
import { feedback } from '../audio/feedback';
import { Critter, type CritterEnv } from './Critter';

/** Кокон: pigeon_cocoon.png (386 px) × 0.3 ≈ 116 px; кадры (pigeon_atlas) уже в игровом размере, ~105 px. */
const COCOON_SCALE = 0.3;
/** Лапы в кадрах атласа — на столько ниже центра кадра (art/bird_atlas.py). */
const FEET_BELOW = 46.6;
/** Центр тела над лапами — сюда целится паутина. */
const BODY_H = 100;
const WALK = 70;
const WALK_FPS = 8;
/** Заметил героя на своей дорожке — сердится и идёт на него быстрее, надувшись. */
const CHARGE = 210;
const NOTICE = 380;

/**
 * Голубь ходит туда-сюда по крыше или платформе (walk_1..4, голова ходит вперёд-назад),
 * иногда останавливается поклевать (peck). Заметил героя рядом — надувается (angry)
 * и бодается: мягко отталкивает (без урона).
 */
export class Pigeon extends Critter {
  private img: Phaser.GameObjects.Sprite;
  private dir = Math.random() < 0.5 ? 1 : -1;
  private pause = 0;
  private peckT = -1;
  private nextPeck = Phaser.Math.FloatBetween(2, 5);
  private angry = 0;
  private noticed = false;
  private puff = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    floorY: number,
    private minX: number,
    private maxX: number,
    env: CritterEnv,
  ) {
    super(scene, x, floorY - BODY_H / 2, env, { key: 'pigeon_cocoon', scale: COCOON_SCALE, wrap: { x: 0, y: 6, rx: 46, ry: 26 } });
    if (!scene.anims.exists('pigeon_walk')) {
      scene.anims.create({
        key: 'pigeon_walk',
        frames: scene.anims.generateFrameNames('pigeon', { prefix: 'walk_', start: 1, end: 4 }),
        frameRate: WALK_FPS,
        repeat: -1,
      });
    }
    // origin у лап: покачивание и надувание — вокруг лап, а не центра
    this.img = scene.add.sprite(0, BODY_H / 2, 'pigeon', 'walk_2');
    this.img.setOrigin(0.5, 0.5 + FEET_BELOW / this.img.height);
    this.addParts([this.img]);
  }

  get hurtRadius() {
    return 44;
  }

  bumped() {
    // боднул — гордо стоит надувшись, потом уходит в другую сторону
    this.pause = 1.1;
    this.angry = 1.1;
    this.peckT = -1;
    this.dir = -this.dir;
    feedback.coo();
  }

  protected live(dt: number) {
    const hero = this.env.hero;
    const feetY = this.y + BODY_H / 2;
    const dx = hero.x - this.x;
    const onPath = Math.abs(hero.y - feetY) < 60 && hero.x > this.minX - 80 && hero.x < this.maxX + 80;
    const sees = onPath && Math.abs(dx) < NOTICE;
    this.angry = Math.max(0, this.angry - dt);
    if (!sees) this.noticed = false;
    // заметил — сначала на миг надувается и сердится, потом идёт бодаться
    if (sees && !this.noticed && this.pause <= 0) {
      this.noticed = true;
      this.dir = Math.sign(dx) || this.dir;
      this.pause = 0.4;
      this.angry = 0.4;
      this.peckT = -1;
    }
    const charging = this.pause <= 0 && sees;

    let speed = 0;
    if (this.pause > 0) {
      this.pause -= dt;
      if (this.peckT >= 0) this.peckT += dt;
    } else if (charging) {
      this.dir = Math.sign(dx) || this.dir;
      speed = CHARGE;
    } else {
      speed = WALK;
      this.nextPeck -= dt;
      if (this.nextPeck <= 0) {
        this.nextPeck = Phaser.Math.FloatBetween(3, 6);
        this.pause = 0.9;
        this.peckT = 0;
        if (Math.random() < 0.5) feedback.coo();
      }
    }

    this.root.x += this.dir * speed * dt;
    if (this.root.x <= this.minX || this.root.x >= this.maxX) {
      this.root.x = Phaser.Math.Clamp(this.root.x, this.minX, this.maxX);
      if (!charging) {
        this.dir = this.root.x <= this.minX ? 1 : -1;
        this.pause = 0.5;
      }
    }
    this.facing = this.dir;
    this.pickFrame(speed);

    // надувается, пока сердится и бодается; на месте — лёгкое дыхание
    this.puff += ((charging || this.angry > 0 ? 1 : 0) - this.puff) * Math.min(1, dt * 6);
    const breath = speed > 0 ? 1 : 1 + 0.015 * Math.sin(this.t * 3);
    this.img
      .setRotation(this.dir * 0.08 * this.puff * (speed > 0 ? 1 : 0))
      .setScale(1 + 0.06 * this.puff, (1 + 0.06 * this.puff) * breath);
  }

  private pickFrame(speed: number) {
    const s = this.img;
    s.setFlipX(this.dir < 0);
    if (speed > 0) {
      if (!s.anims.isPlaying) s.play('pigeon_walk');
      s.anims.timeScale = speed / WALK;
      return;
    }
    s.stop();
    if (this.angry > 0) s.setFrame('angry');
    // клюёт дважды: наклон — выпрямился — наклон
    else if (this.peckT >= 0) s.setFrame(Math.sin(this.peckT * 7) > 0 ? 'peck' : 'walk_2');
    else s.setFrame('walk_2');
  }
}
