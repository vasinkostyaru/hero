import { GROUND_Y as G } from '../config/game';
import type { LevelDef } from './types';

/**
 * Уровень 7 «Гроза» (GAME.md, мир 3): ≈14 200 px, ливень и молнии. Старый город:
 * балконы, стены в плюще, тенты-батуты, бельё. Енот-Бандит перелетает на зонте:
 * капкейк роняет на крышу за балконами (на пути), леденец — на верх высокой стены в плюще
 * (по желанию), пончик — в гнездо под голубем (сторож).
 * Банда: белки с жёлудями, голуби, чайки.
 */
export const LEVEL7: LevelDef = {
  id: 7,
  world: 3,
  theme: 'storm',
  items: ['cupcake', 'lollipop', 'donut'],
  sections: [
    {
      // завязка: енот на трубе с тортом, крупный план, хихикает и улетает на зонте
      name: 'Начало грозы',
      w: 1600,
      start: 300,
      flag: 160,
      clotheslines: [{ x: 480 }],
      props: [
        { key: 'water_tower', x: 60, heroes: 3.4, far: true },
        { key: 'chimney', x: 1150, heroes: 1.5 },
        { key: 'antenna', x: 1450, heroes: 2, far: true },
      ],
      critters: [
        { kind: 'seagull', x: 700, y: G - 780, range: 250 },{ kind: 'pigeon', x: 900, floorY: G, minX: 750, maxX: 1050 }],
      perch: { x: 1190, y: G - 248 },
    },
    {
      // балкон, стена в плюще с тентом-батутом и мостики над крышей; на верхнем — белка
      name: 'Балконы',
      w: 2000,
      solids: [
        { x: 300 - 208, y: G - 170, w: 200, h: 64, kind: 'platform', look: 'balcony' },
        { x: 300, y: G - 420, w: 110, h: 420, kind: 'wall', climbable: true },
        { x: 700, y: G - 560, w: 260, h: 64, kind: 'platform', look: 'wood' },
        { x: 1100, y: G - 400, w: 260, h: 64, kind: 'platform', look: 'wood' },
        { x: 1450, y: G - 220, w: 300, h: 64, kind: 'platform', look: 'wood' },
      ],
      awnings: [{ wallRight: 410, y: G - 210 }],
      critters: [
        { kind: 'seagull', x: 1300, y: G - 800, range: 300 },
        { kind: 'squirrel', x: 830, floorY: G - 560 },
        { kind: 'pigeon', x: 1600, floorY: G - 220, minX: 1480, maxX: 1720 },
      ],
      items: [{ key: 'cupcake', x: 1850, y: G - 70, carried: true }],
      perch: { x: 355, y: G - 420 },
    },
    {
      // антенны: белка на антенне кидается жёлудями, над крышей кружит чайка
      name: 'Антенны',
      w: 2000,
      flag: 100,
      solids: [{ x: 1000, y: G - 250, w: 300, h: 64, kind: 'platform', look: 'wood' }],
      props: [
        { key: 'antenna', x: 600, heroes: 2 },
        { key: 'ac_unit', x: 1500, heroes: 0.6 },
      ],
      critters: [
        { kind: 'squirrel', x: 600, floorY: G - 425 },
        { kind: 'pigeon', x: 1150, floorY: G - 250, minX: 1030, maxX: 1280 },
        { kind: 'seagull', x: 1500, y: G - 760, range: 300 },
      ],
      perch: { x: 1700, y: G },
    },
    {
      // мокрая улица: два фонаря подряд
      name: 'Мокрая улица',
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
      critters: [{ kind: 'pigeon', x: 2100, floorY: G, minX: 1900, maxX: 2350 }],
      perch: { x: 2200, y: G },
    },
    {
      // стены в плюще: на высокой — леденец (по желанию), дальше мостики вниз
      name: 'Плющ',
      w: 2200,
      flag: 100,
      solids: [
        { x: 400, y: G - 480, w: 100, h: 480, kind: 'wall', climbable: true },
        { x: 800, y: G - 700, w: 100, h: 700, kind: 'wall', climbable: true },
        { x: 1150, y: G - 450, w: 300, h: 64, kind: 'platform', look: 'wood' },
        { x: 1600, y: G - 250, w: 300, h: 64, kind: 'platform', look: 'wood' },
      ],
      awnings: [{ wallRight: 500, y: G - 250 }],
      critters: [
        { kind: 'squirrel', x: 1300, floorY: G - 450 },
        { kind: 'seagull', x: 600, y: G - 800, range: 250 },
      ],
      items: [{ key: 'lollipop', x: 850, y: G - 790, carried: true }],
      perch: { x: 1750, y: G - 250 },
    },
    {
      // бельё-батуты; пончик в гнезде на ящиках — на нём сидит голубь
      name: 'Бельё и гнездо',
      w: 2000,
      flag: 100,
      clotheslines: [{ x: 250 }],
      solids: [
        { x: 650, y: G - 380, w: 280, h: 64, kind: 'platform', look: 'wood' },
        { x: 1450, y: G - 110, w: 120, h: 110, kind: 'box' },
        { x: 1570, y: G - 110, w: 120, h: 110, kind: 'box' },
      ],
      critters: [
        { kind: 'seagull', x: 1100, y: G - 760, range: 300 },
        { kind: 'pigeon', id: 'nest7', x: 1570, floorY: G - 110, minX: 1570, maxX: 1570 },
        { kind: 'squirrel', x: 790, floorY: G - 380 },
      ],
      items: [{ key: 'donut', x: 1570, y: G - 132, guard: 'nest7', carried: true }],
      perch: { x: 1100, y: G },
    },
    {
      // финал: енот на водонапорной бочке — петля над Августом, улетает с тортом
      name: 'Финальная крыша',
      w: 2400,
      flag: 100,
      solids: [{ x: 1100, y: G - 200, w: 300, h: 64, kind: 'platform', look: 'wood' }],
      props: [
        { key: 'water_tower', x: 1700, heroes: 3.4 },
        { key: 'chimney', x: 2250, heroes: 1.5 },
      ],
      lamps: [{ x: 2050 }],
      critters: [
        { kind: 'squirrel', x: 1250, floorY: G - 200 },
        { kind: 'pigeon', x: 600, floorY: G, minX: 400, maxX: 950 },
        { kind: 'seagull', x: 1900, y: G - 760, range: 400 },
      ],
      perch: { x: 1700, y: G - 690 },
    },
  ],
};
