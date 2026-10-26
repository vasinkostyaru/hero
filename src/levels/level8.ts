import { GROUND_Y as G } from '../config/game';
import type { LevelDef } from './types';

/**
 * Уровень 8 «Дождик» (мир 3): ≈15 200 px, гроза уходит — капли реже, вдали радуга.
 * Сад на крыше, улица из трёх фонарей, люлька. Мороженое Енот роняет на крышу (на пути),
 * конфету — на самый верхний мостик сада (по желанию), карамельную трость — в гнездо
 * под голубем (сторож).
 */
export const LEVEL8: LevelDef = {
  id: 8,
  world: 3,
  theme: 'rain',
  items: ['icecream', 'candy', 'candycane'],
  sections: [
    {
      name: 'Старт',
      w: 1600,
      start: 300,
      flag: 160,
      clotheslines: [{ x: 450 }],
      props: [
        { key: 'chimney', x: 1250, heroes: 1.5 },
        { key: 'antenna', x: 900, heroes: 2, far: true },
      ],
      critters: [
        { kind: 'seagull', x: 700, y: G - 780, range: 250 },{ kind: 'pigeon', x: 950, floorY: G, minX: 800, maxX: 1150 }],
      perch: { x: 1290, y: G - 248 },
    },
    {
      // мостики, балкон у стены в плюще и тент-батут; мороженое — на крыше за ними
      name: 'Балкон и тент',
      w: 2200,
      solids: [
        { x: 200, y: G - 180, w: 260, h: 64, kind: 'platform', look: 'wood' },
        { x: 520, y: G - 350, w: 240, h: 64, kind: 'platform', look: 'wood' },
        { x: 1050 - 208, y: G - 170, w: 200, h: 64, kind: 'platform', look: 'balcony' },
        { x: 1050, y: G - 560, w: 110, h: 560, kind: 'wall', climbable: true },
        { x: 1450, y: G - 300, w: 300, h: 64, kind: 'platform', look: 'wood' },
      ],
      awnings: [{ wallRight: 1160, y: G - 330 }],
      critters: [
        { kind: 'squirrel', x: 640, floorY: G - 350 },
        { kind: 'seagull', x: 1500, y: G - 780, range: 300 },
      ],
      items: [{ key: 'icecream', x: 1950, y: G - 70, carried: true }],
      perch: { x: 1105, y: G - 560 },
    },
    {
      // три фонаря над широкой улицей
      name: 'Три фонаря',
      w: 2700,
      flag: 120,
      roof: [
        [0, 450],
        [2270, 2700],
      ],
      hooks: [
        { x: 830, y: G - 650, spanL: 400, spanR: 1090 },
        { x: 1350, y: G - 650, spanL: 1090, spanR: 1610 },
        { x: 1870, y: G - 650, spanL: 1610, spanR: 2320 },
      ],
      critters: [{ kind: 'pigeon', x: 2500, floorY: G, minX: 2320, maxX: 2650 }],
      perch: { x: 2550, y: G },
    },
    {
      // сад на крыше: мостики лесенкой; на верхнем — конфета (по желанию)
      name: 'Сад на крыше',
      w: 2200,
      flag: 100,
      solids: [
        { x: 300, y: G - 210, w: 300, h: 64, kind: 'platform', look: 'wood' },
        { x: 700, y: G - 400, w: 300, h: 64, kind: 'platform', look: 'wood' },
        { x: 1100, y: G - 590, w: 300, h: 64, kind: 'platform', look: 'wood' },
      ],
      props: [
        { key: 'water_tower', x: 1700, heroes: 3.4, far: true },
        { key: 'ac_unit', x: 150, heroes: 0.6 },
      ],
      critters: [
        { kind: 'pigeon', x: 450, floorY: G - 210, minX: 330, maxX: 580 },
        { kind: 'squirrel', x: 850, floorY: G - 400 },
        { kind: 'pigeon', x: 1700, floorY: G, minX: 1450, maxX: 2100 },
      ],
      items: [{ key: 'candy', x: 1250, y: G - 670, carried: true }],
      perch: { x: 1850, y: G },
    },
    {
      // люлька мойщика окон и колодец из одной стены
      name: 'Люлька',
      w: 2000,
      flag: 100,
      cradles: [{ x: 300, top: G - 560, bottom: G - 40, period: 6.5 }],
      solids: [
        { x: 800, y: G - 600, w: 90, h: 600, kind: 'wall', climbable: true },
        { x: 1150, y: G - 300, w: 300, h: 64, kind: 'platform', look: 'wood' },
      ],
      critters: [
        { kind: 'seagull', x: 1300, y: G - 760, range: 350 },
        { kind: 'squirrel', x: 1300, floorY: G - 300 },
      ],
      perch: { x: 845, y: G - 600 },
    },
    {
      // гнездо на ящиках: карамельная трость под голубем; белка на антенне
      name: 'Гнездо',
      w: 2000,
      flag: 100,
      solids: [
        { x: 1400, y: G - 110, w: 120, h: 110, kind: 'box' },
        { x: 1520, y: G - 110, w: 120, h: 110, kind: 'box' },
      ],
      props: [{ key: 'antenna', x: 700, heroes: 2 }],
      critters: [
        { kind: 'seagull', x: 1100, y: G - 760, range: 300 },
        { kind: 'squirrel', x: 700, floorY: G - 425 },
        { kind: 'pigeon', id: 'nest8', x: 1520, floorY: G - 110, minX: 1520, maxX: 1520 },
      ],
      items: [{ key: 'candycane', x: 1520, y: G - 132, guard: 'nest8', carried: true }],
      perch: { x: 1000, y: G },
    },
    {
      // финал: енот на бочке, над ним уже видна радуга — улетает с тортом
      name: 'Финальная крыша',
      w: 2400,
      flag: 100,
      clotheslines: [{ x: 400 }],
      solids: [{ x: 1100, y: G - 220, w: 300, h: 64, kind: 'platform', look: 'wood' }],
      props: [
        { key: 'water_tower', x: 1750, heroes: 3.4 },
        { key: 'antenna', x: 2250, heroes: 2, far: true },
      ],
      critters: [
        { kind: 'seagull', x: 1950, y: G - 760, range: 350 },
        { kind: 'squirrel', x: 1250, floorY: G - 220 },
        { kind: 'pigeon', x: 800, floorY: G, minX: 750, maxX: 1050 },
      ],
      perch: { x: 1750, y: G - 690 },
    },
  ],
};
