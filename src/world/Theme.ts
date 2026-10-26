import Phaser from 'phaser';
import { GROUND_Y } from '../config/game';
import { feedback } from '../audio/feedback';

export type ThemeKey = 'sunset' | 'night' | 'storm' | 'rain' | 'dawn';

/**
 * Перекраска картинки на canvas: color — оттенок и насыщенность цвета при той же светлоте
 * (с прозрачностью colorAlpha), multiply — затемнить, screen — высветлить.
 */
interface Recolor {
  color?: string;
  colorAlpha?: number;
  multiply?: string;
  screen?: string;
}

/**
 * Небо, свет и погода уровня. Мир один и тот же — закатный фон, кирпич, декор;
 * время суток и погоду дают перекраска фона (один раз на canvas), общий тон всех картинок
 * (grade) и эффекты поверх: луна и звёзды, дождь, молнии, радуга.
 */
export interface ThemeDef {
  sky?: Recolor;
  city?: Recolor;
  /** общий тон всех картинок сцены (умножение цвета) */
  grade: number;
  /** блик по краю стен со стороны света */
  rim: number;
  /** пылинки в воздухе (цвет); null — нет */
  motes: number | null;
  /** огоньков в окнах дальнего города на половину слоя */
  windows: number;
  moon?: boolean;
  /** дождь: частота капель, мс (меньше — сильнее) */
  rain?: number;
  lightning?: boolean;
  rainbow?: boolean;
}

export const THEMES: Record<ThemeKey, ThemeDef> = {
  sunset: { grade: 0xffeedd, rim: 0xffb46a, motes: 0xffd27a, windows: 22 },
  // ночная стройка: город синий, окна горят, луна и звёзды, светлячки
  night: {
    sky: { color: '#1c2a6a', multiply: '#6a76b8' },
    city: { color: '#24306a', colorAlpha: 0.8, multiply: '#7880b8' },
    grade: 0xc4ccf2,
    rim: 0x9ab8ff,
    motes: 0xbfe6ff,
    windows: 46,
    moon: true,
  },
  // гроза: серо-сизо, ливень, молнии
  storm: {
    sky: { color: '#4a5270', colorAlpha: 0.9, multiply: '#8a8eaa' },
    city: { color: '#48506c', colorAlpha: 0.65, multiply: '#9a9cb6' },
    grade: 0xb8bcd0,
    rim: 0xb0c0e0,
    motes: null,
    windows: 30,
    rain: 5,
    lightning: true,
  },
  // дождик стихает: светлее, капли реже, вдали проступает радуга
  rain: {
    sky: { color: '#7c88b0', colorAlpha: 0.55, multiply: '#c8c8da' },
    city: { color: '#7080a8', colorAlpha: 0.35, multiply: '#cfd0de' },
    grade: 0xd8d8e6,
    rim: 0xd0d8f0,
    motes: null,
    windows: 22,
    rain: 14,
    rainbow: true,
  },
  // рассвет после дождя: розовее заката, радуга, золотые пылинки
  dawn: {
    sky: { color: '#ff8fb8', colorAlpha: 0.3, screen: '#1c1430' },
    city: { color: '#e090c0', colorAlpha: 0.15 },
    grade: 0xffe8f0,
    rim: 0xffb0c8,
    motes: 0xffe2a0,
    windows: 14,
    rainbow: true,
  },
};

/** Перекрашенные текстуры текущей темы: при смене темы старые удаляем (фон — десятки МБ). */
const made = new Map<string, ThemeKey>();

/**
 * Ключ картинки в цветах темы: перекрашивает один раз на canvas и запоминает.
 * У sunset (без перекраски) — сама картинка.
 */
export function themed(scene: Phaser.Scene, key: string, theme: ThemeKey, part: 'sky' | 'city') {
  const rc = THEMES[theme][part];
  if (!rc) return key;
  const dst = `${key}@${theme}`;
  if (scene.textures.exists(dst)) return dst;
  // перекраски других тем больше не нужны — освобождаем память видеокарты
  for (const [k, t] of made) {
    if (t === theme) continue;
    for (const s of [k, `${k}@blur`]) if (scene.textures.exists(s)) scene.textures.remove(s);
    made.delete(k);
  }
  const src = scene.textures.get(key).getSourceImage() as HTMLImageElement;
  const tex = scene.textures.createCanvas(dst, src.width, src.height)!;
  const ctx = tex.getContext();
  ctx.drawImage(src, 0, 0);
  const fill = (op: GlobalCompositeOperation, color: string, alpha = 1) => {
    ctx.globalCompositeOperation = op;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, src.width, src.height);
  };
  if (rc.color) fill('color', rc.color, rc.colorAlpha ?? 1);
  if (rc.multiply) fill('multiply', rc.multiply);
  if (rc.screen) fill('screen', rc.screen);
  // заливки закрасили и прозрачное — возвращаем прозрачность исходника
  ctx.globalCompositeOperation = 'destination-in';
  ctx.globalAlpha = 1;
  ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  tex.refresh();
  made.set(dst, theme);
  return dst;
}

/** Небо почти не двигается: луна, звёзды и радуга висят «на небе». */
const SKY_SCROLL = 0.05;
const SKY_DEPTH = -99;

/**
 * Погода и небесные украшения темы: луна со звёздами, радуга, дождь с брызгами на крыше,
 * молнии с громом. Всё дешёвое: картинки и частицы, без полноэкранных шейдеров.
 */
export class Weather {
  private stars: { img: Phaser.GameObjects.Image; phase: number; speed: number }[] = [];
  private rain: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private splash: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private flash: Phaser.GameObjects.Rectangle | null = null;
  private nextBolt = Phaser.Math.FloatBetween(3, 6);
  private t = 0;

  constructor(private scene: Phaser.Scene, private def: ThemeDef) {
    const W = scene.scale.width;
    if (def.moon) this.addMoon(W * 0.74, 190);
    if (def.rainbow) this.addRainbow(W * 0.62, 980);
    if (def.rain) this.addRain(def.rain);
    if (def.lightning) {
      // вспышка на весь экран (с запасом на отъезд камеры)
      this.flash = scene.add.rectangle(-400, -400, W + 800, scene.scale.height + 800, 0xeef0ff, 0).setOrigin(0, 0).setScrollFactor(0).setDepth(900);
    }
  }

  private addMoon(x: number, y: number) {
    const scene = this.scene;
    if (!scene.textures.exists('moon')) {
      const R = 64;
      const t = scene.textures.createCanvas('moon', R * 2 + 4, R * 2 + 4)!;
      const ctx = t.getContext();
      const g = ctx.createRadialGradient(R - 14, R - 18, 8, R + 2, R + 2, R);
      g.addColorStop(0, '#fffbe8');
      g.addColorStop(1, '#e6dcb8');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(R + 2, R + 2, R, 0, Math.PI * 2);
      ctx.fill();
      // мягкие кратеры
      ctx.fillStyle = 'rgba(190, 176, 140, 0.45)';
      for (const [cx, cy, r] of [[-20, -10, 14], [18, 16, 10], [10, -26, 7], [-8, 28, 8], [30, -4, 6]]) {
        ctx.beginPath();
        ctx.arc(R + 2 + cx, R + 2 + cy, r, 0, Math.PI * 2);
        ctx.fill();
      }
      t.refresh();
    }
    scene.add.image(x, y, 'glow').setScale(16).setTint(0x9ab8ff).setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD).setScrollFactor(SKY_SCROLL, 0.02).setDepth(SKY_DEPTH);
    scene.add.image(x, y, 'moon').setScrollFactor(SKY_SCROLL, 0.02).setDepth(SKY_DEPTH);
    for (let i = 0; i < 46; i++) {
      const img = scene.add
        .image(Phaser.Math.Between(0, scene.scale.width * 1.4), Phaser.Math.Between(20, 460), 'glow')
        .setScale(Phaser.Math.FloatBetween(0.06, 0.16))
        .setTint(0xfff6d8)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScrollFactor(SKY_SCROLL + 0.02, 0.02)
        .setDepth(SKY_DEPTH);
      this.stars.push({ img, phase: Math.random() * 6, speed: Phaser.Math.FloatBetween(1, 3) });
    }
  }

  /** Радуга: шесть полос по дуге, мягкие края; рисуем вдвое мельче и растягиваем. */
  private addRainbow(x: number, y: number) {
    const scene = this.scene;
    if (!scene.textures.exists('rainbow')) {
      const R = 560;
      const band = 13;
      const colors = ['#ff4a4a', '#ff9a3a', '#ffe14a', '#5ad85a', '#4aa8ff', '#9a6aff'];
      const t = scene.textures.createCanvas('rainbow', R * 2 + 40, R + 40)!;
      const ctx = t.getContext();
      ctx.filter = 'blur(5px)';
      colors.forEach((c, i) => {
        ctx.strokeStyle = c;
        ctx.lineWidth = band + 2;
        ctx.beginPath();
        ctx.arc(R + 20, R + 20, R - i * band, Math.PI, Math.PI * 2);
        ctx.stroke();
      });
      t.refresh();
    }
    scene.add.image(x, y, 'rainbow').setOrigin(0.5, 1).setScale(2).setAlpha(0.42).setScrollFactor(SKY_SCROLL + 0.04, 0.02).setDepth(SKY_DEPTH);
  }

  /** Косые капли по всему экрану и брызги на крыше; зона рождения следует за камерой. */
  private addRain(every: number) {
    const scene = this.scene;
    if (!scene.textures.exists('raindrop')) {
      const t = scene.textures.createCanvas('raindrop', 4, 46)!;
      const ctx = t.getContext();
      const g = ctx.createLinearGradient(0, 0, 0, 46);
      g.addColorStop(0, 'rgba(220, 230, 255, 0)');
      g.addColorStop(1, 'rgba(230, 238, 255, 0.95)');
      ctx.fillStyle = g;
      ctx.fillRect(1, 0, 2, 46);
      t.refresh();
    }
    const cam = scene.cameras.main;
    const W = scene.scale.width;
    this.rain = scene.add
      .particles(0, 0, 'raindrop', {
        frequency: every,
        lifespan: 750,
        speedY: { min: 1500, max: 1850 },
        speedX: { min: -260, max: -200 },
        rotate: 8,
        scaleY: { min: 0.6, max: 1.2 },
        alpha: { min: 0.25, max: 0.55 },
        emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(0, 0, W + 600, 10), quantity: 1 } as Phaser.Types.GameObjects.Particles.ParticleEmitterRandomZoneConfig,
      })
      .setDepth(12);
    this.splash = scene.add
      .particles(0, GROUND_Y - 4, 'dust', {
        frequency: every * 6,
        lifespan: 220,
        speedY: { min: -150, max: -60 },
        speedX: { min: -60, max: 60 },
        scale: { start: 0.14, end: 0.04 },
        alpha: { start: 0.6, end: 0 },
        tint: 0xdfe8ff,
        emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(0, 0, W + 200, 2), quantity: 1 } as Phaser.Types.GameObjects.Particles.ParticleEmitterRandomZoneConfig,
      })
      .setDepth(9);
    this.follow(cam);
  }

  private follow(cam: Phaser.Cameras.Scene2D.Camera) {
    this.rain?.setPosition(cam.scrollX - 150, cam.scrollY - 140);
    this.splash?.setX(cam.scrollX - 100);
  }

  update(dt: number) {
    this.t += dt;
    for (const s of this.stars) s.img.setAlpha(0.45 + 0.4 * Math.sin(this.t * s.speed + s.phase));
    this.follow(this.scene.cameras.main);
    if (this.flash) {
      this.nextBolt -= dt;
      if (this.nextBolt <= 0) {
        this.nextBolt = Phaser.Math.FloatBetween(5, 11);
        this.bolt();
      }
    }
  }

  /** Молния: двойная вспышка, через миг — гром. */
  private bolt() {
    const f = this.flash!;
    this.scene.tweens.chain({
      targets: f,
      tweens: [
        { fillAlpha: 0.55, duration: 40 },
        { fillAlpha: 0.08, duration: 90 },
        { fillAlpha: 0.4, duration: 40 },
        { fillAlpha: 0, duration: 380, ease: 'Quad.Out' },
      ],
    });
    this.scene.time.delayedCall(Phaser.Math.Between(350, 1100), () => feedback.thunder());
  }
}
