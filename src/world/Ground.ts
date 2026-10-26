import Phaser from 'phaser';
import { GAME_H, GROUND_Y } from '../config/game';
import { addTiled } from './textures';

const FACADE_KEY = 'facade_shade';

/**
 * Кусок крыши от x0 до x1: каменный карниз и кирпичный фасад под ним.
 * Фасад уходит в тёмно-фиолетовый градиент — читается как крыша, а не стена.
 * Между кусками — улица (Platforms.addStreet).
 */
export function addGround(scene: Phaser.Scene, x0: number, x1: number) {
  const h = GAME_H - GROUND_Y + 40;
  const w = x1 - x0;
  addTiled(scene, x0, GROUND_Y, w, h, 'tex_brick', 0.5);

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
  scene.add.image(x0, GROUND_Y, FACADE_KEY).setOrigin(0, 0).setDisplaySize(w, h);

  // карниз чуть выступает над крышей; его верх — уровень, где стоит герой
  const edgeH = 148 * 0.5;
  addTiled(scene, x0, GROUND_Y - edgeH * 0.35, w, edgeH, 'roof_edge', 0.5);
}
