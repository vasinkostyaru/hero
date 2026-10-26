import { GROUND_Y as G } from '../config/game';
import type { LevelDef } from './types';

/**
 * Уровень 5 «Ночная стройка: краны» (мир 2): ≈15 400 px. Горка из балок, улица из трёх
 * фонарей подряд, лифты и две тележки кранов. Жёлтый кубик Робо-Шмель роняет на крышу
 * за балками (на пути), окошко — на высокую балку у лифтов (по желанию), ракету вешает
 * на крюк дальнего крана.
 */
export const LEVEL5: LevelDef = {
  id: 5,
  world: 2,
  theme: 'night',
  items: ['brick_yellow', 'brick_window', 'rocket'],
  sections: [
    {
      name: 'Старт',
      w: 1600,
      start: 300,
      flag: 160,
      props: [
        { key: 'chimney', x: 700, heroes: 1.5 },
        { key: 'water_tower', x: 1300, heroes: 3.4, far: true },
      ],
      lamps: [{ x: 450 }],
      critters: [
        { kind: 'vacuum', x: 900, floorY: G, minX: 650, maxX: 1150 },{ kind: 'drone2', x: 1000, y: G - 480 }],
      perch: { x: 1250, y: G - 400 },
    },
    {
      // горка из балок: вверх и вниз; под ней катается пылесос
      name: 'Горка из балок',
      w: 2200,
      solids: [
        { x: 200, y: G - 190, w: 280, h: 64, kind: 'platform', look: 'beam' },
        { x: 520, y: G - 370, w: 280, h: 64, kind: 'platform', look: 'scaffold' },
        { x: 870, y: G - 550, w: 300, h: 64, kind: 'platform', look: 'beam' },
        { x: 1240, y: G - 370, w: 280, h: 64, kind: 'platform', look: 'scaffold' },
        { x: 1580, y: G - 190, w: 280, h: 64, kind: 'platform', look: 'beam' },
      ],
      critters: [
        { kind: 'vacuum', x: 800, floorY: G, minX: 250, maxX: 1500 },
        { kind: 'drone', x: 1020, y: G - 760 },
      ],
      items: [{ key: 'brick_yellow', x: 2000, y: G - 70, carried: true }],
      perch: { x: 330, y: G - 420 },
    },
    {
      // три фонаря подряд над широкой улицей — длинная цепочка качелей
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
      critters: [{ kind: 'drone', x: 2500, y: G - 400 }],
      perch: { x: 2500, y: G - 300 },
    },
    {
      // два лифта; с верхнего — на высокую балку за окошком (по желанию)
      name: 'Лифты',
      w: 2200,
      flag: 100,
      cradles: [
        { x: 250, top: G - 620, bottom: G - 40, period: 6.5 },
        { x: 640, top: G - 640, bottom: G - 260, period: 5 },
      ],
      solids: [
        { x: 1000, y: G - 660, w: 360, h: 64, kind: 'platform', look: 'beam' },
        { x: 1500, y: G - 420, w: 300, h: 64, kind: 'platform', look: 'scaffold' },
        { x: 1500, y: G - 190, w: 300, h: 64, kind: 'platform', look: 'scaffold' },
      ],
      critters: [
        { kind: 'drone', x: 1900, y: G - 650 },
        { kind: 'drone2', x: 1300, y: G - 460 },
        { kind: 'vacuum', x: 1700, floorY: G - 190, minX: 1530, maxX: 1800 },
      ],
      items: [{ key: 'brick_window', x: 1180, y: G - 740, carried: true }],
      perch: { x: 1950, y: G - 420 },
    },
    {
      // две тележки кранов; на дальний крюк шмель вешает ракету
      name: 'Тележки',
      w: 2200,
      flag: 100,
      solids: [
        { x: 200, y: G - 425, w: 500, h: 64, kind: 'platform', look: 'beam' },
        { x: 850, y: G - 220, w: 300, h: 64, kind: 'platform', look: 'scaffold' },
        { x: 1250, y: G - 470, w: 600, h: 64, kind: 'platform', look: 'beam' },
      ],
      trolleys: [
        { id: 'crane5a', minX: 280, maxX: 620, beamTop: G - 430 },
        { id: 'crane5b', minX: 1330, maxX: 1770, beamTop: G - 475 },
      ],
      critters: [
        { kind: 'drone2', x: 1600, y: G - 680 },
        { kind: 'vacuum', x: 1000, floorY: G, minX: 700, maxX: 2100 },
        { kind: 'drone', x: 600, y: G - 650 },
      ],
      items: [{ key: 'rocket', x: 0, y: 0, carried: true, attach: 'crane5b' }],
      perch: { x: 2050, y: G - 380 },
    },
    {
      // колодец: стены с сеткой, наверху шмель; за ними горка ящиков
      name: 'Колодец и ящики',
      w: 2000,
      flag: 100,
      solids: [
        { x: 400, y: G - 640, w: 90, h: 640, kind: 'wall', climbable: true },
        { x: 680, y: G - 560, w: 90, h: 560, kind: 'wall', climbable: true },
        { x: 1250, y: G - 110, w: 120, h: 110, kind: 'box' },
        { x: 1370, y: G - 110, w: 120, h: 110, kind: 'box' },
        { x: 1310, y: G - 220, w: 120, h: 110, kind: 'box' },
      ],
      lamps: [{ x: 1000 }],
      critters: [
        { kind: 'drone', x: 1050, y: G - 450 },
        { kind: 'vacuum', x: 1750, floorY: G, minX: 1600, maxX: 1950 },
      ],
      perch: { x: 725, y: G - 640 },
    },
    {
      // финал: шмель над бочкой — петля над Августом и улетает с драконом
      name: 'Финальная крыша',
      w: 2400,
      flag: 100,
      solids: [
        { x: 900, y: G - 200, w: 300, h: 64, kind: 'platform', look: 'scaffold' },
        { x: 1300, y: G - 400, w: 300, h: 64, kind: 'platform', look: 'beam' },
      ],
      props: [
        { key: 'water_tower', x: 1900, heroes: 3.4 },
        { key: 'antenna', x: 2300, heroes: 2, far: true },
      ],
      critters: [
        { kind: 'drone', x: 1700, y: G - 420 },
        { kind: 'drone2', x: 1200, y: G - 600 },
        { kind: 'vacuum', x: 500, floorY: G, minX: 250, maxX: 850 },
      ],
      perch: { x: 1900, y: G - 700 },
    },
  ],
};
