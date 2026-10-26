import Phaser from 'phaser';
import { GAME_H, GROUND_Y, WORLD_W } from '../config/game';
import { addTiled } from './textures';

const FACADE_KEY = 'facade_shade';

/**
 * Крыша по всей длине уровня: каменный карниз и кирпичный фасад под ним.
 * Фасад уходит в тёмно-фиолетовый градиент — читается как крыша, а не стена.
 */
export function addGround(scene: Phaser.Scene) {
  const h = GAME_H - GROUND_Y + 40;
  addTiled(scene, 0, GROUND_Y, WORLD_W, h, 'tex_brick', 0.5);

  if (!scene.textures.exists(FACADE_KEY)) {
    const t = scene.textures.createCanvas(FACADE_KEY, 4, 256)!;
    const ctx = t.getContext();
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, 'rgba(40, 14, 58, 0.15)');
    g.addColorStop(0.45, 'rgba(36, 12, 54, 0.7)');
    g.addColorStop(1, 'rgba(24, 8, 40, 0.97)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 4, 256);
    t.refresh();
  }
  scene.add.image(0, GROUND_Y, FACADE_KEY).setOrigin(0, 0).setDisplaySize(WORLD_W, h);

  // карниз чуть выступает над крышей; его верх — уровень, где стоит герой
  const edgeH = 148 * 0.5;
  addTiled(scene, 0, GROUND_Y - edgeH * 0.35, WORLD_W, edgeH, 'roof_edge', 0.5);
}
