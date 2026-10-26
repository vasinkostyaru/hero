import Phaser from 'phaser';
import { feedback } from '../audio/feedback';
import { Critter, type CritterEnv } from './Critter';
import { scaledTexture } from './textures';

/** Дрон ~1/2 роста героя: drone.png (434 px) × 0.25. */
const SCALE = 0.25;
// Сборка по drone_layout.json: смещения центров деталей от центра drone.png (418×434)
const BODY_OFF = { x: (16 + 401 / 2 - 209) * SCALE, y: (60 + 374 / 2 - 217) * SCALE };
const PROP_OFF = { x: (191 - 209) * SCALE, y: (43.5 - 217) * SCALE };
/** Кокон дрона-2: drone2_cocoon.png × 0.35. */
const DRONE2_SCALE = 0.35;
/**
 * Дрон-2 из частей (art/drone2.py): целый на листе 505 px → ~109 px, как прежний drone2.png.
 * Смещения центров от центра целого дрона — по drone2_layout.json (корпус сдвинут от центра на 8, 11.5).
 */
const D2 = 109 / 505;
const D2_BODY_OFF = { x: 8 * D2, y: 11.5 * D2 };
const D2_PROP_OFF = { x: (8 - 9.4) * D2, y: (11.5 - 207.1) * D2 };
/** Таран дрона-2: замечает героя ближе этого, предупреждает, летит, возвращается. */
const RAM_NOTICE = 460;
const RAM_AIM = 0.6;
const RAM_SPEED = 720;
const RAM_TIME = 0.85;
const RAM_BACK = 1.4;
const RAM_COOLDOWN = 3;

export type DroneKind = 'drone' | 'drone2';

/**
 * Дрон-мишень: пропеллер крутится (scaleX = cos) с размытием из двух полупрозрачных копий,
 * корпус покачивается и наклоняется по ходу. Обычный дрон — спокойная мишень.
 * Дрон-2 — цельный, летает шире и бойчее и иногда таранит героя (мягкий толчок, без урона).
 * Попадание — общий для шалунов кокон (Critter).
 */
export class Drone extends Critter {
  private props: Phaser.GameObjects.Image[] = [];
  private phase = Math.random() * Math.PI * 2;
  private prevX: number;
  private tintable: Phaser.GameObjects.Image[] = [];
  private mode: 'patrol' | 'aim' | 'ram' | 'return' = 'patrol';
  private modeT = 0;
  private ramCd = 0;
  private ramDir = { x: 0, y: 0 };
  private backFrom = { x: 0, y: 0 };

  constructor(
    scene: Phaser.Scene,
    private baseX: number,
    private baseY: number,
    env: CritterEnv,
    private kind: DroneKind = 'drone',
  ) {
    super(
      scene,
      baseX,
      baseY,
      env,
      kind === 'drone'
        ? { key: 'drone_cocoon', scale: SCALE, wrap: { x: BODY_OFF.x, y: BODY_OFF.y, rx: 52, ry: 22 } }
        : { key: 'drone2_cocoon', scale: DRONE2_SCALE, wrap: { x: 0, y: 14, rx: 50, ry: 22 } },
    );
    const [prefix, scale, bodyOff, propOff] =
      kind === 'drone' ? ['drone', SCALE, BODY_OFF, PROP_OFF] : ['drone2', D2, D2_BODY_OFF, D2_PROP_OFF];
    const propKey = scaledTexture(scene, `${prefix}_propeller`, scale);
    // две «отстающие» копии пропеллера — простое motion blur
    this.props = [0.18, 0.35, 1].map((a) => scene.add.image(propOff.x, propOff.y, propKey).setAlpha(a));
    const body = scene.add.image(bodyOff.x, bodyOff.y, scaledTexture(scene, `${prefix}_body`, scale));
    this.addParts([...this.props, body]);
    if (kind === 'drone2') {
      this.tintable = [body, ...this.props];
      this.ramCd = Phaser.Math.FloatBetween(1, 2.5);
    }
    this.prevX = baseX;
  }

  get hurtRadius() {
    return this.mode === 'ram' ? 46 : 0;
  }

  bumped() {
    // толкнул — сразу назад на свой маршрут
    this.toReturn();
  }

  protected live(dt: number) {
    const r = this.root;
    const wide = this.kind === 'drone2';
    let x = this.baseX + Math.sin(this.t * (wide ? 0.8 : 0.55) + this.phase) * (wide ? 170 : 70);
    let y = this.baseY + Math.sin(this.t * 1.4 + this.phase) * (wide ? 30 : 14);
    if (wide) [x, y] = this.ramStep(dt, x, y);
    // в таране и на прицеле пропеллер крутится быстрее
    const fast = this.mode === 'aim' || this.mode === 'ram';
    const vx = (x - this.prevX) / Math.max(dt, 1e-3);
    this.prevX = x;
    r.setPosition(x, y);
    // наклон по направлению движения
    const maxTilt = wide ? 14 : 10;
    r.rotation += (Phaser.Math.DegToRad(Phaser.Math.Clamp(vx * 0.12, -maxTilt, maxTilt)) - r.rotation) * Math.min(1, dt * 6);
    this.spinProps(fast ? 46 : 28);
  }

  /**
   * Дрон-2: заметил героя — замирает и дрожит (предупреждение), затем таранит по прямой
   * туда, где герой был, и плавно возвращается на свой маршрут. Возвращает позицию.
   */
  private ramStep(dt: number, patrolX: number, patrolY: number): [number, number] {
    const r = this.root;
    const hero = this.env.hero;
    const hx = hero.x;
    const hy = hero.y - 100;
    this.modeT += dt;
    this.ramCd = Math.max(0, this.ramCd - dt);
    switch (this.mode) {
      case 'patrol':
        if (this.ramCd === 0 && Math.hypot(hx - r.x, hy - r.y) < RAM_NOTICE) {
          this.mode = 'aim';
          this.modeT = 0;
          feedback.beep();
        }
        return [patrolX, patrolY];
      case 'aim': {
        // дрожит на месте и мигает — «сейчас полечу!»
        const k = this.modeT / RAM_AIM;
        this.addTint(0xff9a8a, 0.5 + 0.5 * Math.sin(this.modeT * 40));
        if (k >= 1) {
          const d = Math.hypot(hx - r.x, hy - r.y) || 1;
          this.ramDir = { x: (hx - r.x) / d, y: (hy - r.y) / d };
          this.mode = 'ram';
          this.modeT = 0;
          this.clearTint();
          feedback.zoom();
        }
        return [r.x + Math.sin(this.modeT * 70) * 3, r.y];
      }
      case 'ram': {
        if (this.modeT > RAM_TIME) this.toReturn();
        const floor = this.env.floorAt(r.x, r.y) - 60;
        return [r.x + this.ramDir.x * RAM_SPEED * dt, Math.min(floor, r.y + this.ramDir.y * RAM_SPEED * dt)];
      }
      case 'return': {
        const k = Math.min(1, this.modeT / RAM_BACK);
        if (k >= 1) this.mode = 'patrol';
        const e = k * k * (3 - 2 * k);
        return [this.backFrom.x + (patrolX - this.backFrom.x) * e, this.backFrom.y + (patrolY - this.backFrom.y) * e];
      }
    }
  }

  private toReturn() {
    if (this.mode === 'return' || this.mode === 'patrol') return;
    this.mode = 'return';
    this.modeT = 0;
    this.ramCd = RAM_COOLDOWN;
    this.backFrom = { x: this.root.x, y: this.root.y };
    this.clearTint();
  }

  /** Мигание: k > 0.5 — подкрашен, иначе обычный. */
  private addTint(color: number, k: number) {
    // alpha копий пропеллера не трогаем — только цвет
    for (const p of this.tintable) {
      if (k > 0.5) p.setTint(color);
      else p.clearTint();
    }
  }

  private clearTint() {
    for (const p of this.tintable) p.clearTint();
  }

  protected wrapping(k: number) {
    this.clearTint();
    this.spinProps(28 * (1 - k));
  }

  private spinProps(speed: number) {
    this.props.forEach((p, i) => p.setScale(Math.cos(this.t * speed - (2 - i) * 0.35), 1));
  }
}
