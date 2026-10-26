import Phaser from 'phaser';

/** Дымок из трубы: медленный, полупрозрачный, тёплый. */
export function addChimneySmoke(scene: Phaser.Scene, x: number, y: number, far = false) {
  return scene.add
    .particles(x, y, 'dust', {
      frequency: far ? 520 : 380,
      lifespan: { min: 3500, max: 4800 },
      speedY: { min: -32, max: -48 },
      speedX: { min: 4, max: 16 },
      scale: { start: 0.55, end: 2.4 },
      alpha: { start: far ? 0.22 : 0.32, end: 0 },
      tint: far ? 0xa48aa8 : 0xd8b8a8,
      rotate: { min: 0, max: 360 },
    })
    .setDepth(far ? -2 : 5);
}

/** Редкие золотые пылинки по всей сцене: появляются у камеры, медленно плывут и гаснут. */
export function addGoldenMotes(scene: Phaser.Scene, glowLayer: Phaser.GameObjects.Layer) {
  const cam = scene.cameras.main;
  const emitter = scene.make.particles(
    {
      x: 0,
      y: 0,
      key: 'glow',
      config: {
        frequency: 420,
        lifespan: { min: 5000, max: 7500 },
        speedX: { min: -12, max: 12 },
        speedY: { min: -14, max: 4 },
        scale: { min: 0.08, max: 0.16 },
        alpha: {
          // плавно появляются и гаснут
          onEmit: () => 0,
          onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.sin(t * Math.PI) * 0.85,
        },
        tint: 0xffd27a,
        blendMode: Phaser.BlendModes.ADD,
        emitZone: {
          type: 'random',
          source: new Phaser.Geom.Rectangle(0, 0, scene.scale.width, 760),
          quantity: 1,
        } as Phaser.Types.GameObjects.Particles.ParticleEmitterRandomZoneConfig,
      },
    },
    false,
  );
  glowLayer.add(emitter);
  // зона рождения следует за камерой, сами пылинки остаются в мире
  scene.events.on('update', () => emitter.setPosition(cam.scrollX, cam.scrollY));
  return emitter;
}

/**
 * Фонарь: картинка, мягкий ореол с лёгким мерцанием и мотыльки-искорки вокруг лампы.
 * bulb — смещение лампы от точки (x, y) фонаря (низ основания).
 */
export class Lamp {
  private halo: Phaser.GameObjects.Image;
  private moths: { img: Phaser.GameObjects.Image; a: number; b: number; s: number }[] = [];
  private t = 0;
  private bx: number;
  private by: number;

  constructor(scene: Phaser.Scene, x: number, y: number, glowLayer: Phaser.GameObjects.Layer) {
    const img = scene.add.image(x, y, 'lamp').setOrigin(0.5, 1).setDepth(6);
    // лампа в lamp.png (188×392) — около (135, 130)
    this.bx = x + (135 - 94);
    this.by = y - (392 - 130);
    void img;
    this.halo = scene.make
      .image({ x: this.bx, y: this.by, key: 'glow' }, false)
      .setTint(0xffc46a)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(7);
    glowLayer.add(this.halo);
    for (let i = 0; i < 4; i++) {
      const m = scene.make
        .image({ x: this.bx, y: this.by, key: 'glow' }, false)
        .setTint(0xfff0b0)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(0.16);
      glowLayer.add(m);
      this.moths.push({ img: m, a: Math.random() * 6, b: Math.random() * 6, s: 0.8 + Math.random() * 0.8 });
    }
  }

  update(dt: number) {
    this.t += dt;
    // лёгкое мерцание: медленная волна + редкие быстрые подрагивания
    const flicker = 0.5 + 0.06 * Math.sin(this.t * 3.1) + (Math.random() < 0.03 ? -0.12 : 0);
    this.halo.setAlpha(flicker);
    for (const m of this.moths) {
      m.a += dt * 3.3 * m.s;
      m.b += dt * 4.7 * m.s;
      m.img.setPosition(this.bx + Math.sin(m.a) * 42 + Math.sin(m.b * 2.3) * 8, this.by + 20 + Math.cos(m.b) * 30);
      m.img.setAlpha(0.6 + 0.4 * Math.sin(m.a * 5));
    }
  }
}

/** Тон спущенного (ещё не взятого) флага и тон после подъёма (как общий тёплый тон сцены). */
const FLAG_OFF = 0x7a6a8a;
const FLAG_ON = 0xffeedd;
/** Насколько спущено полотнище у не взятого флага. */
const FLAG_LOWER = 120;

/**
 * Флаг-чекпоинт: полотнище нарезано на вертикальные полоски, каждая смещается
 * по синусу — волна бежит от древка, у древка полотно неподвижно.
 * Пока герой не добежал — спущен и серый; добежал — взлетает вверх и вспыхивает цветом.
 */
export class Flag {
  active = false;
  private strips: { img: Phaser.GameObjects.Image; k: number; baseY: number }[] = [];
  private t = 0;
  private lower = FLAG_LOWER;

  constructor(
    private scene: Phaser.Scene,
    readonly x: number,
    y: number,
    active = false,
  ) {
    // checkpoint_flag.png 240×367: древко с шаром x < 72, полотно x 66..236, y 50..212
    const W = 240;
    const H = 367;
    const left = x - W / 2;
    const top = y - H;
    const pole = scene.add.image(left, top, 'checkpoint_flag').setOrigin(0, 0).setDepth(6);
    pole.setCrop(0, 0, 72, H);
    scene.add.image(left, top, 'checkpoint_flag').setOrigin(0, 0).setDepth(6).setCrop(72, 214, W - 72, H - 214);

    const x0 = 72;
    const x1 = 238;
    const n = 12;
    const sw = (x1 - x0) / n;
    for (let i = 0; i < n; i++) {
      const cx = x0 + i * sw;
      const img = scene.add
        .image(left, top, 'checkpoint_flag')
        .setOrigin(0, 0)
        .setDepth(6)
        .setCrop(Math.floor(cx), 44, Math.ceil(sw) + 1, 172);
      this.strips.push({ img, k: (i + 1) / n, baseY: top });
    }
    this.active = active;
    this.lower = active ? 0 : FLAG_LOWER;
    for (const s of this.strips) s.img.setTint(active ? FLAG_ON : FLAG_OFF);
  }

  /** Герой добежал: полотнище взлетает вверх и загорается цветом. */
  activate() {
    if (this.active) return;
    this.active = true;
    this.scene.tweens.add({ targets: this, lower: 0, duration: 520, ease: 'Back.Out' });
    for (const s of this.strips) s.img.setTint(FLAG_ON);
  }

  update(dt: number) {
    this.t += dt;
    // спущенный флаг почти не колышется
    const amp = this.active ? 1 : 0.3;
    for (const s of this.strips) {
      const wave = Math.sin(this.t * 5 - s.k * 5.5) * 7 * s.k + Math.sin(this.t * 2.3 - s.k * 3) * 3 * s.k;
      s.img.y = s.baseY + this.lower + wave * amp;
    }
  }
}
