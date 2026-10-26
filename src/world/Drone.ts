import Phaser from 'phaser';
import { feedback } from '../audio/feedback';
import type { Sparks } from './fx';
import { scaledTexture } from './textures';

/** Дрон ~1/2 роста героя: drone.png (434 px) × 0.25. */
const SCALE = 0.25;
// Сборка по drone_layout.json: смещения центров деталей от центра drone.png (418×434)
const BODY_OFF = { x: (16 + 401 / 2 - 209) * SCALE, y: (60 + 374 / 2 - 217) * SCALE };
const PROP_OFF = { x: (191 - 209) * SCALE, y: (43.5 - 217) * SCALE };
const COCOON_H = 527 * SCALE;

const WRAP_MS = 320;
const VANISH_S = 3;

type DroneState = 'fly' | 'wrap' | 'cocoon' | 'gone';

/**
 * Дрон-мишень: пропеллер крутится (scaleX = cos) с размытием из двух полупрозрачных копий,
 * корпус покачивается и наклоняется по ходу. Попадание: обмотка нитями → кокон падает,
 * отскакивает и через 3 с исчезает облачком искорок.
 */
export class Drone {
  readonly root: Phaser.GameObjects.Container;
  state: DroneState = 'fly';
  private body: Phaser.GameObjects.Image;
  private props: Phaser.GameObjects.Image[];
  private cocoon: Phaser.GameObjects.Image;
  private wrapG: Phaser.GameObjects.Graphics;
  private t = Math.random() * 10;
  private phase = Math.random() * Math.PI * 2;
  private stateT = 0;
  private vy = 0;
  private spin = 0;
  private bounces = 0;
  private prevX: number;

  /** floorAt — верх опоры под точкой: кокон падает на крышу или платформу. */
  constructor(
    private scene: Phaser.Scene,
    private baseX: number,
    private baseY: number,
    private sparks: Sparks,
    private floorAt: (x: number, y: number) => number,
  ) {
    const propKey = scaledTexture(scene, 'drone_propeller', SCALE);
    // две «отстающие» копии пропеллера — простое motion blur
    this.props = [0.18, 0.35, 1].map((a) => scene.add.image(PROP_OFF.x, PROP_OFF.y, propKey).setAlpha(a));
    this.body = scene.add.image(BODY_OFF.x, BODY_OFF.y, scaledTexture(scene, 'drone_body', SCALE));
    this.cocoon = scene.add.image(0, 0, scaledTexture(scene, 'drone_cocoon', SCALE)).setVisible(false);
    this.wrapG = scene.add.graphics();
    this.root = scene.add.container(baseX, baseY, [...this.props, this.body, this.cocoon, this.wrapG]).setDepth(8);
    this.prevX = baseX;
  }

  get alive() {
    return this.state === 'fly';
  }
  get x() { return this.root.x; }
  get y() { return this.root.y; }

  hit() {
    if (this.state !== 'fly') return;
    this.state = 'wrap';
    this.stateT = 0;
  }

  update(dt: number) {
    this.t += dt;
    this.stateT += dt;
    switch (this.state) {
      case 'fly':
        this.fly(dt);
        break;
      case 'wrap':
        this.wrap();
        break;
      case 'cocoon':
        this.fall(dt);
        break;
    }
  }

  private fly(dt: number) {
    const r = this.root;
    const x = this.baseX + Math.sin(this.t * 0.55 + this.phase) * 70;
    const y = this.baseY + Math.sin(this.t * 1.4 + this.phase) * 14;
    const vx = (x - this.prevX) / Math.max(dt, 1e-3);
    this.prevX = x;
    r.setPosition(x, y);
    // наклон по направлению движения
    r.rotation += (Phaser.Math.DegToRad(Phaser.Math.Clamp(vx * 0.12, -10, 10)) - r.rotation) * Math.min(1, dt * 6);
    this.spinProps(28);
  }

  private spinProps(speed: number) {
    this.props.forEach((p, i) => p.setScale(Math.cos(this.t * speed - (2 - i) * 0.35), 1));
  }

  private wrap() {
    // белые нити-дуги быстро нарастают вокруг корпуса
    const k = Math.min(1, (this.stateT * 1000) / WRAP_MS);
    const g = this.wrapG;
    g.clear();
    const n = 9;
    for (let i = 0; i < n; i++) {
      const p = Phaser.Math.Clamp(k * 1.6 - i / n, 0, 1);
      if (p <= 0) continue;
      const tilt = -0.9 + (1.8 * i) / (n - 1);
      g.lineStyle(2.5, 0xffffff, 0.9);
      g.beginPath();
      const rx = 52;
      const ry = 22 + (i % 3) * 6;
      const steps = 24;
      for (let s = 0; s <= steps * p; s++) {
        const a = (s / steps) * Math.PI * 2 + i;
        const ex = Math.cos(a) * rx;
        const ey = Math.sin(a) * ry;
        const px = BODY_OFF.x + ex * Math.cos(tilt) - ey * Math.sin(tilt);
        const py = BODY_OFF.y + ex * Math.sin(tilt) + ey * Math.cos(tilt);
        if (s === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.strokePath();
    }
    this.spinProps(28 * (1 - k));
    if (k >= 1) {
      g.clear();
      this.props.forEach((p) => p.setVisible(false));
      this.body.setVisible(false);
      this.cocoon.setVisible(true);
      this.state = 'cocoon';
      feedback.cocoon();
      this.vy = -120;
      this.spin = Phaser.Math.FloatBetween(3, 5) * (Math.random() < 0.5 ? -1 : 1);
      this.bounces = 0;
    }
  }

  private fall(dt: number) {
    const r = this.root;
    const floor = this.floorAt(r.x, r.y) - COCOON_H * 0.45;
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
      this.sparks.burst(r.x, r.y, 18);
      feedback.poof();
      this.state = 'gone';
      this.scene.tweens.add({ targets: r, alpha: 0, scale: 0.6, duration: 160, onComplete: () => r.destroy() });
    }
  }
}
