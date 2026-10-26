import { GROUND_Y as G } from '../config/game';
import type { LevelDef } from './types';

/**
 * Уровень 2 «Крыши на закате» (GAME.md, ITEMS.md): ≈14 000 px, две улицы с крюками, люльки.
 * Вещи несёт Ворон и роняет каждую в её место, пролетая над ним у героя на глазах:
 * варежка — на крыше (на пути), полотенце — на высоком мостике у люльки (высоко, по желанию),
 * шорты — в гнезде под голубем (сторож).
 */
export const LEVEL2: LevelDef = {
  id: 2,
  items: ['mitten', 'towel', 'shorts'],
  world: 1,
  theme: 'sunset',
  sections: [
    {
      name: 'Крыша с бельём',
      w: 1600,
      start: 300,
      flag: 160,
      clotheslines: [{ x: 600 }],
      props: [
        { key: 'water_tower', x: 1000, heroes: 3.4, far: true },
        { key: 'chimney', x: 1250, heroes: 1.5 },
      ],
      critters: [
        { kind: 'pigeon', x: 950, floorY: G, minX: 850, maxX: 1150 },{ kind: 'drone', x: 950, y: G - 450 }],
      perch: { x: 1290, y: G - 248 },
    },
    {
      // мостики лесенкой; варежку Ворон роняет на крышу за ними
      name: 'Мостики',
      w: 2000,
      solids: [
        { x: 300, y: G - 180, w: 260, h: 64, kind: 'platform', look: 'wood' },
        { x: 680, y: G - 340, w: 260, h: 64, kind: 'platform', look: 'wood' },
        { x: 1080, y: G - 200, w: 300, h: 64, kind: 'platform', look: 'wood' },
      ],
      props: [
        { key: 'antenna', x: 1550, heroes: 2 },
        { key: 'ac_unit', x: 200, heroes: 0.6 },
      ],
      critters: [
        { kind: 'pigeon', x: 800, floorY: G - 340, minX: 700, maxX: 920 },
        { kind: 'drone', x: 1450, y: G - 430 },
      ],
      items: [{ key: 'mitten', x: 1800, y: G - 70, carried: true }],
      perch: { x: 1300, y: G - 200 },
    },
    {
      name: 'Первая улица',
      w: 1800,
      flag: 120,
      roof: [
        [0, 560],
        [1320, 1800],
      ],
      hooks: [{ x: 940, y: G - 650, spanL: 430, spanR: 1450 }],
      critters: [{ kind: 'drone', x: 1650, y: G - 380 }],
      perch: { x: 1560, y: G },
    },
    {
      // две люльки; со второй — на высокий мостик за полотенцем. Кому люльки трудно —
      // справа лесенка из мостиков к тому же мостику
      name: 'Люльки',
      w: 2200,
      flag: 100,
      cradles: [
        { x: 300, top: G - 560, bottom: G - 40, period: 6 },
        { x: 820, top: G - 640, bottom: G - 220, period: 7.5 },
      ],
      solids: [
        { x: 1380, y: G - 620, w: 300, h: 64, kind: 'platform', look: 'wood' },
        { x: 1720, y: G - 420, w: 220, h: 64, kind: 'platform', look: 'wood' },
        { x: 1900, y: G - 220, w: 250, h: 64, kind: 'platform', look: 'wood' },
      ],
      props: [
        { key: 'water_tower', x: 1250, heroes: 3.4, far: true },
        { key: 'chimney', x: 2120, heroes: 1.5, far: true },
      ],
      critters: [
        { kind: 'drone', x: 600, y: G - 420 },{ kind: 'seagull', x: 1100, y: G - 780, range: 400 }],
      items: [{ key: 'towel', x: 1530, y: G - 700, carried: true }],
      perch: { x: 1200, y: G },
    },
    {
      name: 'Вторая улица',
      w: 1900,
      flag: 100,
      roof: [
        [0, 500],
        [1300, 1900],
      ],
      hooks: [{ x: 900, y: G - 650, spanL: 380, spanR: 1420 }],
      critters: [{ kind: 'pigeon', x: 1600, floorY: G, minX: 1350, maxX: 1850 }],
      perch: { x: 1700, y: G },
    },
    {
      // колодец; за ним гнездо на ящиках — шорты под голубем
      name: 'Колодец и гнездо',
      w: 2200,
      flag: 100,
      slot: 'голубь-толстяк (сидит на гнезде вместо голубя)',
      solids: [
        { x: 600, y: G - 615, w: 90, h: 615, kind: 'wall', climbable: true },
        { x: 860, y: G - 545, w: 90, h: 545, kind: 'wall', climbable: true },
        { x: 1150, y: G - 300, w: 400, h: 64, kind: 'platform', look: 'scaffold' },
        { x: 1700, y: G - 110, w: 120, h: 110, kind: 'box' },
        { x: 1820, y: G - 110, w: 120, h: 110, kind: 'box' },
      ],
      critters: [
        { kind: 'drone2', x: 1350, y: G - 520 },
        { kind: 'pigeon', id: 'nestGuard2', x: 1820, floorY: G - 110, minX: 1820, maxX: 1820 },
      ],
      items: [{ key: 'shorts', x: 1820, y: G - 132, guard: 'nestGuard2', carried: true }],
      perch: { x: 905, y: G - 545 },
    },
    {
      // финал: Ворон на бочке, мёртвая петля над Августом — улетает
      name: 'Финальная крыша',
      w: 2400,
      flag: 100,
      slot: 'кот-воришка — пока голубь',
      solids: [{ x: 1100, y: G - 220, w: 300, h: 64, kind: 'platform', look: 'scaffold' }],
      props: [
        { key: 'water_tower', x: 1700, heroes: 3.4 },
        { key: 'antenna', x: 2250, heroes: 2, far: true },
      ],
      lamps: [{ x: 2100 }],
      critters: [
        { kind: 'seagull', x: 1950, y: G - 760, range: 300 },
        { kind: 'pigeon', x: 600, floorY: G, minX: 400, maxX: 1000 },
        { kind: 'drone2', x: 1300, y: G - 520 },
      ],
      perch: { x: 1700, y: G - 690 },
    },
  ],
};
