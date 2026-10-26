import Phaser from 'phaser';
import { feedback } from '../audio/feedback';
import { Critter, partSize, type CritterEnv } from './Critter';
import { scaledTexture } from './textures';

/** Голубь ~1/2 роста героя: pigeon.png (372 px) × 0.3 ≈ 112 px. */
const SCALE = 0.3;
const WALK = 70;
/** Заметил героя на своей дорожке — идёт на него быстрее, надувшись. */
const CHARGE = 210;
const NOTICE = 380;

/**
 * Голубь ходит вперевалку туда-сюда по крыше или платформе, иногда останавливается поклевать.
 * Заметил героя рядом — надувается и бодается: мягко отталкивает (без урона).
 */
export class Pigeon extends Critter {
  private img: Phaser.GameObjects.Image;
  private h: number;
  private dir = Math.random() < 0.5 ? 1 : -1;
  private pause = 0;
  private peckT = -1;
  private nextPeck = Phaser.Math.FloatBetween(2, 5);
  private stepPhase = 0;
  private puff = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    floorY: number,
    private minX: number,
    private maxX: number,
    env: CritterEnv,
  ) {
    const { h } = partSize(scene, 'pigeon', SCALE);
    super(scene, x, floorY - h / 2, env, { key: 'pigeon_cocoon', scale: SCALE, wrap: { x: 0, y: 6, rx: 46, ry: 26 } });
    this.h = h;
    // origin у лап: покачивание вперевалку — вокруг лап, а не центра
    this.img = scene.add.image(0, h / 2, scaledTexture(scene, 'pigeon', SCALE)).setOrigin(0.5, 1);
    this.addParts([this.img]);
  }

  get hurtRadius() {
    return 44;
  }

  bumped() {
    // боднул — гордо стоит, потом уходит в другую сторону
    this.pause = 1.1;
    this.peckT = -1;
    this.dir = -this.dir;
    feedback.coo();
  }

  protected live(dt: number) {
    const hero = this.env.hero;
    const feetY = this.y + this.h / 2;
    const dx = hero.x - this.x;
    const onPath = Math.abs(hero.y - feetY) < 60 && hero.x > this.minX - 80 && hero.x < this.maxX + 80;
    const charging = this.pause <= 0 && onPath && Math.abs(dx) < NOTICE;

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
    this.img.setFlipX(this.dir < 0);

    // вперевалку: шаги чаще, когда идёт быстрее; на месте — только дыхание
    this.stepPhase += dt * speed * 0.13;
    const moving = speed > 0 ? 1 : 0;
    let rot = Math.sin(this.stepPhase) * 0.08 * moving;
    const hop = Math.abs(Math.sin(this.stepPhase)) * 5 * moving;
    if (this.peckT >= 0 && this.pause > 0) rot = this.dir * 0.4 * Math.abs(Math.sin(this.peckT * 7));
    this.puff += ((charging ? 1 : 0) - this.puff) * Math.min(1, dt * 6);
    rot += this.dir * 0.12 * this.puff;
    const breath = 1 + 0.015 * Math.sin(this.t * 3);
    this.img
      .setRotation(rot)
      .setScale(1 + 0.08 * this.puff, (1 + 0.08 * this.puff) * breath)
      .setY(this.h / 2 - hop);
  }
}
