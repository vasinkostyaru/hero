import Phaser from 'phaser';

/** Мягкие текстуры для тени, пыли и искр — рисуем один раз на canvas. */
export function makeFxTextures(scene: Phaser.Scene) {
  const radial = (key: string, size: number, stops: [number, string][], squashY = 1) => {
    if (scene.textures.exists(key)) return;
    const t = scene.textures.createCanvas(key, size, Math.round(size * squashY))!;
    const ctx = t.getContext();
    ctx.save();
    ctx.scale(1, squashY);
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    for (const [o, c] of stops) g.addColorStop(o, c);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    ctx.restore();
    t.refresh();
  };
  radial('soft_shadow', 128, [[0, 'rgba(15, 4, 25, 0.95)'], [0.55, 'rgba(15, 4, 25, 0.6)'], [1, 'rgba(15, 4, 25, 0)']], 40 / 128);
  radial('dust', 48, [[0, 'rgba(255, 240, 225, 0.95)'], [0.6, 'rgba(240, 215, 200, 0.5)'], [1, 'rgba(240, 215, 200, 0)']]);
  radial('glow', 32, [[0, 'rgba(255, 255, 255, 1)'], [0.35, 'rgba(200, 255, 250, 0.8)'], [1, 'rgba(120, 240, 230, 0)']]);
}

const DUST_CFG: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig = {
  emitting: false,
  lifespan: { min: 320, max: 520 },
  speed: { min: 60, max: 190 },
  scale: { start: 0.5, end: 1.3 },
  alpha: { start: 0.7, end: 0 },
  gravityY: -60,
  tint: 0xf1d9c4,
};

/** Облачка пыли: при приземлении — в обе стороны, на бегу — назад, от стены — в сторону толчка. */
export class Dust {
  private left: Phaser.GameObjects.Particles.ParticleEmitter;
  private right: Phaser.GameObjects.Particles.ParticleEmitter;
  private stepL: Phaser.GameObjects.Particles.ParticleEmitter;
  private stepR: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(scene: Phaser.Scene) {
    const make = (minA: number, maxA: number, extra: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig = {}) =>
      scene.add.particles(0, 0, 'dust', { ...DUST_CFG, angle: { min: minA, max: maxA }, ...extra }).setDepth(12);
    this.left = make(170, 205);
    this.right = make(-25, 10);
    const step = { speed: { min: 30, max: 80 }, scale: { start: 0.3, end: 0.8 }, alpha: { start: 0.45, end: 0 }, lifespan: { min: 250, max: 380 } };
    this.stepL = make(185, 215, step);
    this.stepR = make(-35, -5, step);
  }

  /** Пыль в обе стороны по земле; strength 0..1 — сила удара. */
  ground(x: number, y: number, strength = 1) {
    const n = Math.round(4 + 6 * strength);
    this.left.explode(n, x, y);
    this.right.explode(n, x, y);
  }

  /** Маленькое облачко из-под ноги на бегу; facing — куда бежит герой (пыль летит назад). */
  step(x: number, y: number, facing: number) {
    (facing > 0 ? this.stepL : this.stepR).explode(2, x, y);
  }

  /** Пыль от стены: dir — куда отталкиваемся (-1 влево, 1 вправо). */
  wall(x: number, y: number, dir: number) {
    (dir > 0 ? this.right : this.left).explode(8, x, y);
  }
}

/** Искорки: при выстреле из ладони и облачко при исчезновении кокона. */
export class Sparks {
  private emitter: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(scene: Phaser.Scene, glowLayer: Phaser.GameObjects.Layer) {
    this.emitter = scene.make
      .particles({ x: 0, y: 0, key: 'glow', config: {
        emitting: false,
        lifespan: { min: 220, max: 480 },
        speed: { min: 80, max: 320 },
        scale: { start: 0.55, end: 0 },
        alpha: { start: 1, end: 0 },
        tint: [0xffffff, 0xbffcf4, 0x8ff0ff, 0xfff1a8],
        blendMode: Phaser.BlendModes.ADD,
      } }, false);
    glowLayer.add(this.emitter);
  }

  burst(x: number, y: number, n = 8) {
    this.emitter.explode(n, x, y);
  }
}
