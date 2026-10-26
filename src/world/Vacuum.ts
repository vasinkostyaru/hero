import Phaser from 'phaser';
import { feedback } from '../audio/feedback';
import { Critter, type CritterEnv } from './Critter';

/** Центр тела над колёсами — сюда целится паутина; кадры атласа уже в игровом размере (~150 px). */
const BODY_H = 90;
const DRIVE = 95;
const DRIVE_FPS = 10;
/** Заметил героя на своей дорожке ближе этого — газует. */
const NOTICE = 540;
const REV_T = 0.6;
const DASH = 640;
const DASH_T = 1.1;
const REST_T = 0.9;
const COOLDOWN = 1.4;

/**
 * Робот-пылесос Робо-Шмеля (мир 2): катается по крыше или мостику туда-сюда (drive_1..3),
 * у края разворачивается. Заметил героя на своей дорожке — замирает и «газует» (rev: трясётся,
 * пищит), потом мчится на него рывком (dash) до края дорожки. Задел — мягко толкает.
 * Перепрыгни или закоконь паутиной.
 */
export class Vacuum extends Critter {
  private img: Phaser.GameObjects.Sprite;
  private dir = Math.random() < 0.5 ? 1 : -1;
  private mode: 'patrol' | 'rev' | 'dash' | 'rest' = 'patrol';
  private modeT = 0;
  private pause = 0;
  private cd = Phaser.Math.FloatBetween(0.5, 1.5);

  constructor(
    scene: Phaser.Scene,
    x: number,
    private floorY: number,
    private minX: number,
    private maxX: number,
    env: CritterEnv,
  ) {
    super(scene, x, floorY - BODY_H / 2, env, { key: 'vacuum_cocoon', scale: 1, wrap: { x: 0, y: 4, rx: 70, ry: 30 } });
    if (!scene.anims.exists('vacuum_drive')) {
      scene.anims.create({
        key: 'vacuum_drive',
        frames: scene.anims.generateFrameNames('vacuum', { prefix: 'drive_', start: 1, end: 3 }),
        frameRate: DRIVE_FPS,
        repeat: -1,
      });
    }
    // опора кадров — у колёс (art/chars2.py)
    this.img = scene.add.sprite(0, BODY_H / 2, 'vacuum', 'drive_1').play('vacuum_drive');
    this.addParts([this.img]);
  }

  get hurtRadius() {
    return this.mode === 'dash' ? 60 : 44;
  }

  bumped() {
    // толкнул — постоял и поехал в другую сторону
    this.mode = 'rest';
    this.modeT = 0;
    this.cd = COOLDOWN;
    this.dir = -this.dir;
    feedback.beep();
  }

  protected live(dt: number) {
    const hero = this.env.hero;
    const dx = hero.x - this.x;
    this.modeT += dt;
    this.cd = Math.max(0, this.cd - dt);
    const onPath = Math.abs(hero.y - this.floorY) < 70 && hero.x > this.minX - 80 && hero.x < this.maxX + 80;
    let speed = 0;
    let shake = 0;
    switch (this.mode) {
      case 'patrol':
        if (this.pause > 0) this.pause -= dt;
        else speed = DRIVE;
        if (onPath && Math.abs(dx) < NOTICE && this.cd === 0) {
          // заметил: разворачивается к герою и газует
          this.dir = Math.sign(dx) || this.dir;
          this.mode = 'rev';
          this.modeT = 0;
          feedback.beep();
        }
        break;
      case 'rev':
        shake = Math.sin(this.modeT * 70) * 3;
        if (this.modeT >= REV_T) {
          this.mode = 'dash';
          this.modeT = 0;
          feedback.zoom();
        }
        break;
      case 'dash':
        speed = DASH;
        if (this.modeT >= DASH_T) this.toRest();
        break;
      case 'rest':
        if (this.modeT >= REST_T) this.mode = 'patrol';
        break;
    }

    this.root.x += this.dir * speed * dt;
    // доехал до края дорожки (и едет в него) — разворот; стоящего у края не трогаем,
    // иначе пауза взводилась бы каждый кадр и он так и стоял бы у края
    if ((this.root.x <= this.minX && this.dir < 0) || (this.root.x >= this.maxX && this.dir > 0)) {
      this.root.x = Phaser.Math.Clamp(this.root.x, this.minX, this.maxX);
      if (this.mode === 'dash') this.toRest();
      this.dir = -this.dir;
      if (this.mode === 'patrol') this.pause = 0.4;
    }
    this.facing = this.dir;

    const s = this.img;
    s.setFlipX(this.dir < 0).setX(shake);
    if (this.mode === 'rev' || this.mode === 'dash') {
      s.stop();
      s.setFrame(this.mode);
    } else if (speed > 0) {
      if (!s.anims.isPlaying) s.play('vacuum_drive');
    } else {
      s.stop();
      s.setFrame('drive_1');
    }
    // на ходу чуть подпрыгивает на стыках крыши
    s.setY(BODY_H / 2 - (speed > 0 ? Math.abs(Math.sin(this.t * 14)) * 2 : 0));
  }

  private toRest() {
    this.mode = 'rest';
    this.modeT = 0;
    this.cd = COOLDOWN;
  }
}
