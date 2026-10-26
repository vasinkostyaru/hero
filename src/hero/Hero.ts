import Phaser from 'phaser';
import {
  CLIMB_FPS, FRAME, FRAME_GROUND_Y, FRAME_WALL_X, HAND, HERO_HITBOX,
  LAND_MS, RUN_FPS, SHOOT_MS, VY_APEX, VY_FALL2,
} from '../config/hero';
import { feedback } from '../audio/feedback';
import type { Dust } from '../world/fx';

export type HeroState = 'idle' | 'run' | 'air' | 'land' | 'wall';

/** Что контроллер сообщает герою каждый кадр (после физики). */
export interface HeroMotion {
  /** доля от максимальной скорости бега 0..1 */
  speed: number;
  /** ускорение по направлению взгляда, px/с² — для короткого наклона при старте и торможении */
  accel: number;
  vy: number;
  /** на стене: 1 — ползёт вверх, 0 — держится, -1 — сползает */
  wallMove: number;
  /** уровень опоры под героем для тени, null — тени нет */
  groundY: number | null;
  /** сама опора — тень не вылезает за её края */
  ground?: { x: number; w: number };
}

const TAU = Math.PI * 2;
/** Кадры бега, где стопа ставится на крышу. */
const STEP_FRAMES = new Set(['run_1', 'run_4']);
const lerpK = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);

/**
 * Герой из атласа hero2. Позиция — точка между ступнями (на стене — край хитбокса у стены).
 * Свет уже запечён в кадры; кодом добавляем только «сочность»: squash & stretch,
 * короткий наклон, очень слабое дыхание, тень и пыль.
 */
export class Hero {
  readonly root: Phaser.GameObjects.Container;
  private sprite: Phaser.GameObjects.Sprite;
  /** копия кадра поверх героя, залитая бирюзой — подсветка от вспышки выстрела */
  private flashSprite: Phaser.GameObjects.Sprite;
  private flashT = -1;
  private shadow: Phaser.GameObjects.Image;
  private debugG: Phaser.GameObjects.Graphics;

  state: HeroState = 'idle';
  facing = 1;
  debug = false;

  private stateT = 0;
  private t = 0;
  private shootT = -1;
  private sq = 0;
  private sqVel = 0;
  private lean = 0;
  /** наклон на качелях — голова к крюку (радианы); null — не качается */
  swingAngle: number | null = null;
  private swingRot = 0;
  /** покачивание после толчка шалуна, градусы */
  private wob = 0;
  private wobVel = 0;
  private speed = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, private dust: Dust) {
    const anims = scene.anims;
    if (!anims.exists('hero_run')) {
      anims.create({
        key: 'hero_run',
        frames: anims.generateFrameNames('hero', { prefix: 'run_', start: 1, end: 6 }),
        frameRate: RUN_FPS,
        repeat: -1,
      });
      anims.create({
        key: 'hero_climb',
        frames: anims.generateFrameNames('hero', { prefix: 'climb_', start: 1, end: 4 }),
        frameRate: CLIMB_FPS,
        repeat: -1,
      });
    }
    this.shadow = scene.add.image(x, y, 'soft_shadow').setDepth(9);
    this.sprite = scene.add.sprite(0, 0, 'hero', 'idle').setOrigin(0.5, FRAME_GROUND_Y / FRAME);
    this.flashSprite = scene.add.sprite(0, 0, 'hero', 'idle').setTintFill(0x6ff7ea).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    this.root = scene.add.container(x, y, [this.sprite, this.flashSprite]).setDepth(10);
    // шаг — на кадрах, где нога касается крыши: звук и облачко пыли в ритм бега
    this.sprite.on(Phaser.Animations.Events.ANIMATION_UPDATE, (_a: unknown, frame: Phaser.Animations.AnimationFrame) => {
      if (this.state !== 'run' || !STEP_FRAMES.has(String(frame.textureFrame))) return;
      feedback.step();
      if (this.speed > 0.5) this.dust.step(this.x - this.facing * 18, this.y, this.facing);
    });
    this.debugG = scene.add.graphics().setDepth(900);
  }

  get x() { return this.root.x; }
  get y() { return this.root.y; }

  setPosition(x: number, y: number) {
    this.root.setPosition(x, y);
  }

  setState(next: HeroState, impact = 1) {
    if (next === this.state) return;
    // приземление показываем ~120 мс; прервать его может только отрыв от земли
    if (this.state === 'land' && this.stateT < LAND_MS / 1000 && (next === 'idle' || next === 'run')) return;

    const prev = this.state;
    this.state = next;
    this.stateT = 0;
    this.sprite.stop();

    if (next === 'air' && prev !== 'wall') this.kick(prev === 'idle' || prev === 'run' || prev === 'land' ? 0.12 : 0);
    if (next === 'air' && prev === 'wall') this.kick(0.1);
    if (next === 'land') {
      this.kick(-0.06 - 0.12 * impact);
      this.dust.ground(this.x, this.y, impact);
      feedback.land(impact);
    }
    if (next === 'wall') {
      this.kick(-0.05);
      feedback.stick();
    }
  }

  /** Выстрел: показывает кадр shoot и возвращает, откуда летит паутина. */
  shoot(): { x: number; y: number } {
    this.shootT = 0;
    this.flashT = 0;
    return this.handPosition();
  }

  /** Мировые координаты ладони в текущем кадре (на земле при выстреле — кадр shoot). */
  handPosition(): { x: number; y: number } {
    const onGround = this.state === 'idle' || this.state === 'run' || this.state === 'land';
    const hand = onGround ? HAND.shoot : HAND[String(this.sprite.frame.name)] ?? HAND.apex;
    return { x: this.x + hand.x * this.facing, y: this.y + hand.y };
  }

  /** Шалун толкнул: сплющило и качнуло (dir — куда отлетаем). */
  ouch(dir: number) {
    this.kick(-0.16);
    this.wobVel = -dir * 420;
  }

  /** Толчок пружины squash: < 0 — сплющить, > 0 — вытянуть. */
  kick(amount: number) {
    if (amount === 0) return;
    this.sq = amount;
    this.sqVel = 0;
  }

  update(dt: number, m: HeroMotion) {
    this.t += dt;
    this.stateT += dt;
    if (this.shootT >= 0) {
      this.shootT += dt * 1000;
      if (this.shootT > SHOOT_MS) this.shootT = -1;
    }
    if (this.state === 'land' && this.stateT >= LAND_MS / 1000) this.state = 'idle';

    this.pickFrame(m);

    // пружина squash & stretch
    this.sqVel += (-480 * this.sq - 15 * this.sqVel) * dt;
    this.sq += this.sqVel * dt;
    const sx = 1 - this.sq * 0.7;
    let sy = 1 + this.sq;

    // очень слабое дыхание; origin внизу, поэтому стопы не дрожат
    if (this.state === 'idle') sy *= 1 + 0.008 * (0.5 + 0.5 * Math.sin((this.t * TAU) / 2.6));

    // короткий наклон при старте бега и торможении (только пока есть ускорение)
    const leanTarget = this.state === 'run' || this.state === 'idle' ? Phaser.Math.Clamp((m.accel / 2600) * 5, -5, 5) : 0;
    this.lean += (leanTarget - this.lean) * lerpK(12, dt);
    if (Math.abs(this.lean) < 0.05) this.lean = 0;

    this.wobVel += (-160 * this.wob - 9 * this.wobVel) * dt;
    this.wob += this.wobVel * dt;
    // на качелях тело тянется вдоль нити (чуть меньше её угла — мягче)
    this.swingRot += ((this.swingAngle ?? 0) * 0.8 - this.swingRot) * lerpK(this.swingAngle === null ? 10 : 18, dt);
    this.root.setScale(sx, sy).setRotation(Phaser.Math.DegToRad(this.lean * this.facing + this.wob) + this.swingRot);

    this.speed = m.speed;

    this.updateFlash(dt);
    this.updateShadow(m.groundY, m.ground);
    this.drawDebug();
  }

  private updateFlash(dt: number) {
    const f = this.flashSprite;
    if (this.flashT < 0) {
      f.setVisible(false);
      return;
    }
    this.flashT += dt;
    const a = 1 - this.flashT / 0.16;
    if (a <= 0) {
      this.flashT = -1;
      f.setVisible(false);
      return;
    }
    const s = this.sprite;
    f.setVisible(true)
      .setFrame(s.frame.name)
      .setOrigin(s.originX, s.originY)
      .setPosition(s.x, s.y)
      .setFlipX(s.flipX)
      .setAlpha(0.45 * a);
  }

  private pickFrame(m: HeroMotion) {
    const s = this.sprite;
    const flip = this.facing < 0;
    s.setFlipX(flip);

    if (this.state === 'wall') {
      // origin x — ровно поверхность стены; при отражении край кадра зеркалится
      const ox = (flip ? FRAME - FRAME_WALL_X : FRAME_WALL_X) / FRAME;
      s.setOrigin(ox, FRAME_GROUND_Y / FRAME).setPosition((HERO_HITBOX.w / 2) * this.facing, 0);
      const isClimb = s.anims.currentAnim?.key === 'hero_climb';
      if (m.wallMove > 0) {
        if (isClimb && s.anims.isPaused) s.anims.resume();
        else if (!(isClimb && s.anims.isPlaying)) s.play('hero_climb');
      } else if (m.wallMove < 0) {
        s.stop();
        s.setFrame('wall_slide');
      } else if (isClimb && s.anims.isPlaying && !s.anims.isPaused) {
        s.anims.pause(); // остановился — держим текущий кадр
      } else if (!String(s.frame.name).startsWith('climb_')) {
        s.setFrame('climb_1');
      }
      return;
    }

    s.setOrigin(0.5, FRAME_GROUND_Y / FRAME).setPosition(0, 0);
    if (this.shootT >= 0 && (this.state === 'idle' || this.state === 'run')) {
      s.stop();
      s.setFrame('shoot');
      return;
    }
    switch (this.state) {
      case 'run':
        if (s.anims.currentAnim?.key !== 'hero_run' || !s.anims.isPlaying) s.play('hero_run', true);
        s.anims.timeScale = 0.5 + 0.6 * m.speed;
        break;
      case 'air': {
        const name = m.vy < -VY_APEX ? 'jump' : m.vy <= VY_APEX ? 'apex' : m.vy <= VY_FALL2 ? 'fall_1' : 'fall_2';
        s.setFrame(name);
        break;
      }
      case 'land':
        s.setFrame('land');
        break;
      default:
        s.stop();
        s.setFrame('idle');
    }
  }

  private updateShadow(groundY: number | null, ground?: { x: number; w: number }) {
    if (groundY === null || this.state === 'wall') {
      this.shadow.setVisible(false);
      return;
    }
    const h = Math.max(0, groundY - this.y);
    const k = Phaser.Math.Clamp(1 - h / 420, 0.25, 1);
    // ширина тени, обрезанная по краям опоры (на узкой стене или у края платформы)
    const full = this.shadow.width * 1.7 * k;
    let left = this.x - full / 2;
    let right = this.x + full / 2;
    if (ground) {
      left = Math.max(left, ground.x + 4);
      right = Math.min(right, ground.x + ground.w - 4);
    }
    const w = right - left;
    if (w < 16) {
      this.shadow.setVisible(false);
      return;
    }
    this.shadow
      .setVisible(true)
      .setPosition(Math.round((left + right) / 2), groundY + 2)
      .setDisplaySize(w, this.shadow.height * 0.8 * k * Math.min(1, w / full + 0.3))
      .setAlpha(0.9 * k);
  }

  private drawDebug() {
    const g = this.debugG;
    g.clear();
    if (!this.debug) return;
    const { w, h } = HERO_HITBOX;
    g.lineStyle(2, 0xff3366, 1).strokeRect(this.x - w / 2, this.y - h, w, h);
    g.fillStyle(0xffee00, 1).fillCircle(this.x, this.y, 4);
  }
}
