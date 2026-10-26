import Phaser from 'phaser';
import { FAR_TINT, GROUND_Y } from '../config/game';
import { addScaledImage } from './textures';

/** Рост героя на экране — от него считаем масштаб декора. */
const HERO_H = 216;

export interface PropDef {
  key: string;
  x: number;
  /** высота на экране в ростах героя */
  heroes: number;
  /** дальше героя: мельче, темнее и за карнизом */
  far?: boolean;
  /** низ предмета; по умолчанию — крыша */
  y?: number;
}

/** Декор на крыше — за героем, без коллизий. Возвращает картинки (для дымка из труб). */
export function addProps(scene: Phaser.Scene, props: PropDef[]) {
  const placed: { def: PropDef; img: Phaser.GameObjects.Image }[] = [];
  for (const p of props) {
    const src = scene.textures.get(p.key).getSourceImage();
    const farK = p.far ? 0.82 : 1;
    const scale = ((p.heroes * HERO_H) / (src.height - 8)) * farK;
    // дальний декор стоит за карнизом (его низ прячется), ближний — на крыше
    const y = p.y ?? (p.far ? GROUND_Y - 6 : GROUND_Y + 4);
    const img = addScaledImage(scene, p.x, y, p.key, scale).setOrigin(0.5, 1);
    if (p.far) img.setTint(FAR_TINT).setDepth(-1);
    else img.setDepth(6);
    placed.push({ def: p, img });
  }
  return placed;
}
