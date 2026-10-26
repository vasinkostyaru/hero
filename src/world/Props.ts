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
}

// водонапорный бак в 3–4 роста, труба ~1.5, антенна ~2 (ящик — часть уровня, на него можно встать)
const PROPS: PropDef[] = [
  { key: 'water_tower', x: 230, heroes: 3.4 },
  // антенна тонкая — за мостиком из досок читается; труба — в просвете между балкой и лесами
  { key: 'antenna', x: 1300, heroes: 2 },
  { key: 'chimney', x: 2420, heroes: 1.5 },
  { key: 'ac_unit', x: 1520, heroes: 0.6 },
  { key: 'chimney', x: 3420, heroes: 1.5, far: true },
  { key: 'water_tower', x: 3800, heroes: 3.4, far: true },
  { key: 'antenna', x: 4650, heroes: 2, far: true },
];

/** Декор на крыше — за героем, без коллизий. Возвращает картинки (для дымка из труб). */
export function addProps(scene: Phaser.Scene) {
  const placed: { def: PropDef; img: Phaser.GameObjects.Image }[] = [];
  for (const p of PROPS) {
    const src = scene.textures.get(p.key).getSourceImage();
    const farK = p.far ? 0.82 : 1;
    const scale = ((p.heroes * HERO_H) / (src.height - 8)) * farK;
    // дальний декор стоит за карнизом (его низ прячется), ближний — на крыше
    const img = addScaledImage(scene, p.x, p.far ? GROUND_Y - 6 : GROUND_Y + 4, p.key, scale).setOrigin(0.5, 1);
    if (p.far) img.setTint(FAR_TINT).setDepth(-1);
    else img.setDepth(6);
    placed.push({ def: p, img });
  }
  return placed;
}
