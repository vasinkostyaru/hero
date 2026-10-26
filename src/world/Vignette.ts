import Phaser from 'phaser';
import { GAME_H, GAME_W } from '../config/game';

const KEY = 'vignette';

/** Тёмная виньетка по краям экрана — одна текстура на canvas, растягивается на ширину экрана. */
export function addVignette(scene: Phaser.Scene) {
  if (!scene.textures.exists(KEY)) {
    const tex = scene.textures.createCanvas(KEY, GAME_W, GAME_H)!;
    const ctx = tex.getContext();
    const g = ctx.createRadialGradient(
      GAME_W / 2, GAME_H * 0.5, GAME_H * 0.42,
      GAME_W / 2, GAME_H * 0.5, GAME_W * 0.62,
    );
    g.addColorStop(0, 'rgba(30, 8, 30, 0)');
    g.addColorStop(0.55, 'rgba(30, 8, 34, 0.22)');
    g.addColorStop(1, 'rgba(18, 4, 26, 0.62)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, GAME_W, GAME_H);
    tex.refresh();
  }
  return scene.add
    .image(0, 0, KEY)
    .setOrigin(0, 0)
    .setScrollFactor(0)
    .setDepth(1000)
    .setScale(scene.scale.width / GAME_W, scene.scale.height / GAME_H);
}

/** Общий тон сцены (тема уровня, world/Theme.ts): закат — тёплый, ночь — синий. */
let grade = 0xffeedd;

/** Тон темы — до постройки уровня: от него зависят уже тонированные картинки (graded). */
export function setGrade(color: number) {
  grade = color;
}

/** Цвет, умноженный на общий тон: для картинок, у которых уже свой тинт (кирпич, дальний декор). */
export function graded(color: number) {
  const ch = (shift: number) => Math.round((((color >> shift) & 255) * ((grade >> shift) & 255)) / 255);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/**
 * Общий тон: тинт всех картинок сцены (умножение цвета — на закате приглушает синий).
 * Ничего не стоит: ни полноэкранного прохода, ни лишнего слоя поверх.
 * Светящиеся (ADD) объекты и уже тонированные не трогаем.
 */
export function addColorGrade(scene: Phaser.Scene) {
  for (const obj of scene.children.list) {
    if (obj instanceof Phaser.GameObjects.Particles.ParticleEmitter) continue;
    const o = obj as Phaser.GameObjects.Image;
    if (typeof o.setTint !== 'function' || o.isTinted || o.blendMode === Phaser.BlendModes.ADD) continue;
    o.setTint(grade);
  }
}
