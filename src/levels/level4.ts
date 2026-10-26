import { GROUND_Y as G } from '../config/game';
import type { LevelDef } from './types';

/**
 * Уровень 4 «Ночная стройка» (GAME.md, мир 2): ≈15 000 px. Робо-Шмель висит в воздухе
 * над стройкой и уносит игрушки: красный кубик роняет на крышу за лесами (на пути),
 * колесо — на крюк крана, человечка — на высокую балку над лифтами (по желанию).
 * Банда: дроны, дроны-2, роботы-пылесосы. Улица — два фонаря подряд (цепочка качелей).
 */
export const LEVEL4: LevelDef = {
  id: 4,
  world: 2,
  theme: 'night',
  items: ['brick_red', 'wheel', 'minifig'],
  sections: [
    {
      // завязка: шмель висит над воротами стройки, крупный план, хохочет и улетает
      name: 'Ворота стройки',
      w: 1600,
      start: 300,
      flag: 160,
      props: [
        { key: 'water_tower', x: 80, heroes: 3.4, far: true },
        { key: 'ac_unit', x: 700, heroes: 0.6 },
        { key: 'antenna', x: 1450, heroes: 2, far: true },
      ],
      lamps: [{ x: 560 }],
      critters: [
        { kind: 'vacuum', x: 700, floorY: G, minX: 450, maxX: 1050 },{ kind: 'drone', x: 950, y: G - 430 }],
      perch: { x: 1250, y: G - 380 },
    },
    {
      // леса лесенкой вверх и вниз; под ними катается пылесос — красный кубик за лесами
      name: 'Леса',
      w: 2200,
      solids: [
        { x: 200, y: G - 190, w: 300, h: 64, kind: 'platform', look: 'scaffold' },
        { x: 560, y: G - 370, w: 300, h: 64, kind: 'platform', look: 'scaffold' },
        { x: 950, y: G - 540, w: 320, h: 64, kind: 'platform', look: 'beam' },
        { x: 1350, y: G - 360, w: 300, h: 64, kind: 'platform', look: 'scaffold' },
      ],
      props: [{ key: 'chimney', x: 1950, heroes: 1.5 }],
      critters: [
        { kind: 'vacuum', x: 1500, floorY: G, minX: 1100, maxX: 2100 },
        { kind: 'drone', x: 1100, y: G - 720 },
      ],
      items: [{ key: 'brick_red', x: 1800, y: G - 70, carried: true }],
      perch: { x: 400, y: G - 450 },
    },
    {
      // кран: шмель пролетает над балкой и вешает колесо на крюк тележки
      name: 'Кран',
      w: 2000,
      flag: 100,
      solids: [
        { x: 150, y: G - 215, w: 400, h: 64, kind: 'platform', look: 'scaffold' },
        { x: 700, y: G - 425, w: 500, h: 64, kind: 'platform', look: 'beam' },
        { x: 1400, y: G - 260, w: 300, h: 64, kind: 'platform', look: 'scaffold' },
      ],
      trolleys: [{ id: 'crane4', minX: 780, maxX: 1120, beamTop: G - 430 }],
      critters: [
        { kind: 'drone2', x: 1600, y: G - 560 },
        { kind: 'vacuum', x: 350, floorY: G - 215, minX: 190, maxX: 510 },
      ],
      items: [{ key: 'wheel', x: 0, y: 0, carried: true, attach: 'crane4' }],
      perch: { x: 470, y: G - 360 },
    },
    {
      // широкая улица: два фонаря на тросах — с первого на второй, и на ту сторону
      name: 'Два фонаря',
      w: 2400,
      flag: 120,
      roof: [
        [0, 500],
        [1820, 2400],
      ],
      hooks: [
        { x: 880, y: G - 650, spanL: 430, spanR: 1150 },
        { x: 1420, y: G - 650, spanL: 1150, spanR: 1880 },
      ],
      critters: [{ kind: 'drone', x: 2150, y: G - 400 }],
      perch: { x: 2150, y: G - 300 },
    },
    {
      // лифты стройки везут наверх; с верхней балки — к человечку (по желанию)
      name: 'Лифты',
      w: 2200,
      flag: 100,
      cradles: [
        { x: 250, top: G - 600, bottom: G - 40, period: 6 },
        { x: 560, top: G - 620, bottom: G - 260, period: 7.5 },
      ],
      solids: [
        { x: 860, y: G - 640, w: 400, h: 64, kind: 'platform', look: 'beam' },
        { x: 1380, y: G - 420, w: 300, h: 64, kind: 'platform', look: 'scaffold' },
        { x: 1760, y: G - 220, w: 300, h: 64, kind: 'platform', look: 'scaffold' },
      ],
      lamps: [{ x: 1250 }],
      critters: [
        { kind: 'drone', x: 1500, y: G - 620 },{ kind: 'vacuum', x: 1300, floorY: G, minX: 950, maxX: 2100 }],
      items: [{ key: 'minifig', x: 1060, y: G - 720, carried: true }],
      perch: { x: 1910, y: G - 380 },
    },
    {
      // колодец из лесов: две стены с сеткой, наверху — пролёт; за ними ящики
      name: 'Колодец',
      w: 2000,
      flag: 100,
      solids: [
        { x: 500, y: G - 600, w: 90, h: 600, kind: 'wall', climbable: true },
        { x: 760, y: G - 520, w: 90, h: 520, kind: 'wall', climbable: true },
        { x: 1450, y: G - 110, w: 120, h: 110, kind: 'box' },
        { x: 1570, y: G - 110, w: 120, h: 110, kind: 'box' },
        { x: 1510, y: G - 220, w: 120, h: 110, kind: 'box' },
      ],
      props: [{ key: 'water_tower', x: 1150, heroes: 3.4, far: true }],
      critters: [
        { kind: 'vacuum', x: 1850, floorY: G, minX: 1730, maxX: 1980 },
        { kind: 'drone2', x: 1200, y: G - 480 },
        { kind: 'drone', x: 1800, y: G - 380 },
      ],
      perch: { x: 1570, y: G - 420 },
    },
    {
      // финал: шмель над водонапорной бочкой, мёртвая петля над Августом — улетает с драконом
      name: 'Финальная крыша',
      w: 2400,
      flag: 100,
      solids: [{ x: 1000, y: G - 220, w: 300, h: 64, kind: 'platform', look: 'scaffold' }],
      props: [
        { key: 'water_tower', x: 1800, heroes: 3.4 },
        { key: 'antenna', x: 2250, heroes: 2, far: true },
      ],
      lamps: [{ x: 2150 }],
      critters: [
        { kind: 'drone2', x: 2050, y: G - 450 },
        { kind: 'vacuum', x: 600, floorY: G, minX: 300, maxX: 950 },
        { kind: 'drone', x: 1400, y: G - 500 },
      ],
      perch: { x: 1800, y: G - 700 },
    },
  ],
};
