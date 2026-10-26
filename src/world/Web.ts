import Phaser from 'phaser';
import { feedback } from '../audio/feedback';
import type { WebTarget } from './Critter';
import type { Sparks } from './fx';
import type { Solid } from './Level';

const SPEED = 1900;
const AIM_RANGE = 1200;
const AIM_CONE = Phaser.Math.DegToRad(60);
/** Совсем рядом попадаем в любого — даже ниже руки, вплотную или чуть за спиной. */
const CLOSE_RANGE = 260;
const CLOSE_BEHIND = 70;
const HIT_R = 34;
/** Длина хвоста-нити за снарядом, px. */
const TRAIL_LEN = 240;
const SPLAT_LIFE = 1.2;
const SPLAT_FADE = 0.35;

interface Shot {
  x: number;
  y: number;
  dirX: number;
  dirY: number;
  target: WebTarget | null;
  age: number;
  trail: { x: number; y: number }[];
  head: Phaser.GameObjects.Image;
}

interface Splat {
  x: number;
  y: number;
  r: number;
  age: number;
  life: number;
  seed: number;
}

/**
 * Паутина: из ладони вылетает крутящийся паутинный шарик с коротким дрожащим хвостом
 * из двух нитей. Промах летит, пока не уйдёт за экран, и там просто исчезает.
 * Попадание в стену — сеточка паутины прилипает к ней примерно на секунду;
 * в шалуна — вспышка-сеточка, искры, лёгкая тряска камеры.
 */
export class Web {
  private g: Phaser.GameObjects.Graphics;
  private shots: Shot[] = [];
  private splats: Splat[] = [];
  private t = 0;
  /** нить качелей от руки к крюку; null — не качаемся */
  rope: { x1: number; y1: number; x2: number; y2: number } | null = null;
  /** сколько нить уже есть: выстреливает из руки к крюку за долю секунды */
  private ropeT = -1;
  /** попали в шалуна — для замедления времени */
  onHit: () => void = () => {};

  /** onFire — для вспышки у героя. Всё светящееся живёт в glowLayer (один проход bloom). */
  constructor(
    private scene: Phaser.Scene,
    private sparks: Sparks,
    private walls: Solid[],
    private glowLayer: Phaser.GameObjects.Layer,
  ) {
    this.g = scene.make.graphics({}, false);
    glowLayer.add(this.g);
  }

  fire(from: { x: number; y: number }, facing: number, targets: WebTarget[]) {
    // автоприцел щедрый: жмёшь — и паутина находит ближайшего шалуна впереди
    let target: WebTarget | null = null;
    let best = Infinity;
    for (const d of targets) {
      if (!d.alive) continue;
      const dx = d.x - from.x;
      const dy = d.y - from.y;
      const dist = Math.hypot(dx, dy);
      const close = dist < CLOSE_RANGE && dx * facing > -CLOSE_BEHIND;
      const ahead = dist < AIM_RANGE && dx * facing > 0 && Math.abs(Math.atan2(dy, Math.abs(dx))) <= AIM_CONE;
      if (!close && !ahead) continue;
      // в кого уже летит паутина — в последнюю очередь: очередь выстрелов разбирает всех по одному
      const score = dist + (this.shots.some((s) => s.target === d) ? 100000 : 0);
      if (score < best) {
        best = score;
        target = d;
      }
    }
    const head = this.scene.make.image({ x: from.x, y: from.y, key: 'glow' }, false).setBlendMode(Phaser.BlendModes.ADD);
    this.glowLayer.add(head);
    // бирюзовая вспышка у ладони
    const flash = this.scene.make.image({ x: from.x, y: from.y, key: 'glow' }, false).setTint(0x5ff5e6).setBlendMode(Phaser.BlendModes.ADD).setScale(2);
    this.glowLayer.add(flash);
    this.scene.tweens.add({ targets: flash, scale: 6, alpha: 0, duration: 180, ease: 'Cubic.Out', onComplete: () => flash.destroy() });
    this.shots.push({ x: from.x, y: from.y, dirX: facing, dirY: 0, target, age: 0, trail: [{ ...from }], head });
    this.sparks.burst(from.x, from.y, 7);
  }

  update(dt: number) {
    this.t += dt;
    const view = this.scene.cameras.main.worldView;

    for (const s of this.shots) {
      s.age += dt;
      if (s.target?.alive) {
        const dx = s.target.x - s.x;
        const dy = s.target.y - s.y;
        const d = Math.hypot(dx, dy) || 1;
        s.dirX = dx / d;
        s.dirY = dy / d;
        // радиус попадания + шаг за кадр: при низком FPS снаряд не «перепрыгивает» цель
        if (d < HIT_R + SPEED * dt) {
          s.target.hit();
          feedback.hit();
          this.onHit();
          this.splat(s.target.x, s.target.y, 46, 0.35);
          this.sparks.burst(s.target.x, s.target.y, 14);
          this.scene.cameras.main.shake(90, 0.002);
          this.kill(s);
          continue;
        }
      }
      s.x += s.dirX * SPEED * dt;
      s.y += s.dirY * SPEED * dt;
      s.trail.push({ x: s.x, y: s.y });
      this.trimTrail(s);

      const wall = this.walls.find((w) => s.x > w.x && s.x < w.x + w.w && s.y > w.y && s.y < w.y + w.h);
      if (wall) {
        // прилипает к поверхности стены со стороны, откуда прилетел
        const x = s.dirX > 0 ? wall.x : wall.x + wall.w;
        this.splat(x, s.y, 34, SPLAT_LIFE);
        this.sparks.burst(x, s.y, 5);
        this.kill(s);
        continue;
      }
      // улетел за экран — просто исчезает, без следов у края
      if (!Phaser.Geom.Rectangle.Contains(view, s.x, s.y) && s.age > 0.1) {
        const pad = 200;
        if (s.x < view.left - pad || s.x > view.right + pad || s.y < view.top - pad || s.y > view.bottom + pad) this.kill(s);
      }
      s.head.setPosition(s.x, s.y).setScale(0.7 + 0.15 * Math.sin(this.t * 40));
    }
    this.shots = this.shots.filter((s) => s.head.active);

    for (const p of this.splats) p.age += dt;
    this.splats = this.splats.filter((p) => p.age < p.life + SPLAT_FADE);
    this.draw();
  }

  private trimTrail(s: Shot) {
    let len = 0;
    for (let i = s.trail.length - 1; i > 0; i--) {
      len += Math.hypot(s.trail[i].x - s.trail[i - 1].x, s.trail[i].y - s.trail[i - 1].y);
      if (len > TRAIL_LEN) {
        s.trail.splice(0, i - 1);
        return;
      }
    }
  }

  private kill(s: Shot) {
    s.head.destroy();
  }

  private splat(x: number, y: number, r: number, life: number) {
    this.splats.push({ x, y, r, age: 0, life, seed: Math.random() * 1000 });
  }

  private draw() {
    const g = this.g;
    g.clear();
    if (this.rope) this.drawRope(this.rope);
    else this.ropeT = -1;
    for (const s of this.shots) {
      this.drawTrail(s);
      this.drawBall(s.x, s.y, 11, s.age * 14);
    }
    for (const p of this.splats) {
      const appear = Math.min(1, p.age / 0.08);
      const fade = p.age < p.life ? 1 : 1 - (p.age - p.life) / SPLAT_FADE;
      this.drawNet(p.x, p.y, p.r * (0.6 + 0.4 * appear), fade, p.seed);
    }
  }

  /** Две нити хвоста чуть дрожат и переплетаются; к концу тоньше и прозрачнее. */
  private drawTrail(s: Shot) {
    const g = this.g;
    const n = s.trail.length;
    if (n < 2) return;
    for (const strand of [1, -1]) {
      for (let i = 1; i < n; i++) {
        const a = s.trail[i - 1];
        const b = s.trail[i];
        const k = i / (n - 1); // 0 — хвост, 1 — у снаряда
        const nx = -s.dirY;
        const ny = s.dirX;
        const w0 = strand * Math.sin(this.t * 30 + i * 0.7) * 3.5 * (1 - k * 0.6);
        const w1 = strand * Math.sin(this.t * 30 + (i + 1) * 0.7) * 3.5 * (1 - k * 0.6);
        g.lineStyle(1.5 + k * 1.5, 0xf4fffd, 0.15 + 0.8 * k);
        g.lineBetween(a.x + nx * w0, a.y + ny * w0, b.x + nx * w1, b.y + ny * w1);
      }
    }
  }

  /**
   * Нить качелей — паутина, а не верёвка: бирюзовое свечение, белая сердцевина, две тонкие
   * пряди вьются вокруг неё; у крюка — сеточка, которой нить прилипла. Появляется,
   * выстреливая из руки к крюку.
   */
  private drawRope(r: { x1: number; y1: number; x2: number; y2: number }) {
    const g = this.g;
    if (this.ropeT < 0) {
      this.ropeT = 0;
      this.sparks.burst(r.x2, r.y2, 10);
    }
    this.ropeT += 1 / 60;
    const grow = Math.min(1, this.ropeT / 0.09);
    const ex = r.x1 + (r.x2 - r.x1) * grow;
    const ey = r.y1 + (r.y2 - r.y1) * grow;
    const nx = -(ey - r.y1);
    const ny = ex - r.x1;
    const len = Math.hypot(nx, ny) || 1;
    // свечение и сердцевина
    g.lineStyle(10, 0x5ff5e6, 0.16).lineBetween(r.x1, r.y1, ex, ey);
    g.lineStyle(3.2, 0xffffff, 0.95).lineBetween(r.x1, r.y1, ex, ey);
    // пряди вьются вокруг сердцевины, у концов сходятся
    const n = 22;
    for (const strand of [1, -1]) {
      g.lineStyle(1.4, 0xe8fffb, 0.75);
      g.beginPath();
      for (let i = 0; i <= n; i++) {
        const k = i / n;
        const w = strand * Math.sin(k * Math.PI * 7 + this.t * 9) * 4.5 * Math.sin(k * Math.PI);
        const x = r.x1 + (ex - r.x1) * k + (nx / len) * w;
        const y = r.y1 + (ey - r.y1) * k + (ny / len) * w;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.strokePath();
    }
    if (grow >= 1) this.drawNet(r.x2, r.y2, 24, 1, 7.3);
    // у руки — маленький комочек, откуда тянется нить
    g.fillStyle(0xffffff, 0.9).fillCircle(r.x1, r.y1, 4);
  }

  /** Паутинный шарик: спицы и кольцо, крутится в полёте. */
  private drawBall(x: number, y: number, r: number, rot: number) {
    const g = this.g;
    g.lineStyle(1.6, 0xffffff, 0.95);
    for (let i = 0; i < 6; i++) {
      const a = rot + (i * Math.PI) / 3;
      g.lineBetween(x, y, x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    g.strokeCircle(x, y, r * 0.6);
  }

  /** Сеточка паутины: неровные спицы и провисающие кольца между ними. */
  private drawNet(x: number, y: number, r: number, alpha: number, seed: number) {
    const g = this.g;
    const spokes = 9;
    const rnd = (i: number) => 0.5 + 0.5 * Math.sin(seed + i * 12.9898);
    const ends: { x: number; y: number }[] = [];
    g.lineStyle(1.8, 0xf6fffd, 0.95 * alpha);
    for (let i = 0; i < spokes; i++) {
      const a = (i / spokes) * Math.PI * 2 + rnd(i) * 0.35;
      const len = r * (0.75 + 0.35 * rnd(i + 50));
      const e = { x: x + Math.cos(a) * len, y: y + Math.sin(a) * len };
      ends.push(e);
      g.lineBetween(x, y, e.x, e.y);
    }
    g.lineStyle(1.3, 0xf6fffd, 0.85 * alpha);
    for (const ring of [0.35, 0.65, 0.95]) {
      for (let i = 0; i < spokes; i++) {
        const a = ends[i];
        const b = ends[(i + 1) % spokes];
        const p = { x: x + (a.x - x) * ring, y: y + (a.y - y) * ring };
        const q = { x: x + (b.x - x) * ring, y: y + (b.y - y) * ring };
        // середина нити провисает к центру
        const mx = (p.x + q.x) / 2 + (x - (p.x + q.x) / 2) * 0.12;
        const my = (p.y + q.y) / 2 + (y - (p.y + q.y) / 2) * 0.12;
        g.lineBetween(p.x, p.y, mx, my);
        g.lineBetween(mx, my, q.x, q.y);
      }
    }
  }
}
