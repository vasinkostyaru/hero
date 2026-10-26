import { GROUND_Y as G } from '../config/game';
import type { LevelDef } from './types';

/**
 * Уровень 6 «Ночная стройка» — битва с Робо-Шмелём (GAME.md, мир 2). ≈10 600 px дороги и арена.
 * Трансформера шмель вешает по дороге на крюк крана. На арене — 10 попаданий паутиной:
 * он зовёт три волны своей банды (дроны, дроны-2, пылесосы) и, пока волна не в коконах,
 * висит под щитом; между волнами перелетает, после последней — пикирует. Побеждённый,
 * роняет домик из кубиков и плюшевого дракона.
 */
export const LEVEL6: LevelDef = {
  id: 6,
  world: 2,
  theme: 'night',
  items: ['transformer', 'lego_house', 'dragon'],
  sections: [
    {
      name: 'Старт',
      w: 1600,
      start: 300,
      flag: 160,
      props: [
        { key: 'water_tower', x: 80, heroes: 3.4 },
        { key: 'ac_unit', x: 1000, heroes: 0.6 },
      ],
      lamps: [{ x: 650 }],
      critters: [
        { kind: 'vacuum', x: 1000, floorY: G, minX: 650, maxX: 1150 },{ kind: 'drone', x: 900, y: G - 450 }],
      perch: { x: 1250, y: G - 400 },
    },
    {
      // стройка: пролетая над краном, шмель вешает трансформера на крюк
      name: 'Стройка',
      w: 2200,
      solids: [
        { x: 150, y: G - 215, w: 400, h: 64, kind: 'platform', look: 'scaffold' },
        { x: 800, y: G - 425, w: 500, h: 64, kind: 'platform', look: 'beam' },
        { x: 1500, y: G - 320, w: 350, h: 64, kind: 'platform', look: 'scaffold' },
      ],
      trolleys: [{ id: 'crane6', minX: 880, maxX: 1220, beamTop: G - 430 }],
      critters: [
        { kind: 'vacuum', x: 1700, floorY: G, minX: 1300, maxX: 2100 },
        { kind: 'drone2', x: 1650, y: G - 600 },
      ],
      items: [{ key: 'transformer', x: 0, y: 0, carried: true, attach: 'crane6' }],
      perch: { x: 470, y: G - 360 },
    },
    {
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
      critters: [{ kind: 'drone2', x: 2150, y: G - 450 }],
      perch: { x: 2150, y: G - 320 },
    },
    {
      // лифт и колодец — подъём к арене; шмель ждёт над стеной и улетает на арену
      name: 'Подъём к арене',
      w: 2200,
      flag: 100,
      cradles: [{ x: 300, top: G - 560, bottom: G - 40, period: 7 }],
      solids: [
        { x: 800, y: G - 615, w: 90, h: 615, kind: 'wall', climbable: true },
        { x: 1060, y: G - 545, w: 90, h: 545, kind: 'wall', climbable: true },
        { x: 1450, y: G - 280, w: 300, h: 64, kind: 'platform', look: 'scaffold' },
      ],
      critters: [
        { kind: 'drone', x: 620, y: G - 380 },
        { kind: 'drone', x: 1500, y: G - 500 },
        { kind: 'vacuum', x: 1800, floorY: G, minX: 1300, maxX: 2150 },
      ],
      perch: { x: 1105, y: G - 640 },
    },
    {
      // арена на лесах: три яруса мостиков; шмель висит в воздухе и зовёт банду
      name: 'Арена',
      w: 2600,
      flag: 100,
      solids: [
        { x: 220, y: G - 190, w: 240, h: 64, kind: 'platform', look: 'scaffold' },
        { x: 520, y: G - 370, w: 220, h: 64, kind: 'platform', look: 'beam' },
        { x: 260, y: G - 550, w: 220, h: 64, kind: 'platform', look: 'scaffold' },
        { x: 1100, y: G - 200, w: 260, h: 64, kind: 'platform', look: 'beam' },
        { x: 1220, y: G - 390, w: 240, h: 64, kind: 'platform', look: 'scaffold' },
        { x: 1040, y: G - 570, w: 220, h: 64, kind: 'platform', look: 'beam' },
        { x: 1700, y: G - 230, w: 220, h: 64, kind: 'platform', look: 'scaffold' },
        { x: 1950, y: G - 420, w: 300, h: 64, kind: 'platform', look: 'beam' },
        { x: 2260, y: G - 610, w: 260, h: 64, kind: 'platform', look: 'scaffold' },
      ],
      props: [
        { key: 'water_tower', x: 760, heroes: 3.4, far: true },
        { key: 'antenna', x: 2450, heroes: 2, far: true },
      ],
      lamps: [{ x: 1580 }],
      arena: {
        perches: [
          { x: 640, y: G - 700 },
          { x: 1500, y: G - 640 },
          { x: 2390, y: G - 760 },
        ],
        waves: [
          [
            { kind: 'drone2', x: 1500, y: G - 650 },
            { kind: 'drone', x: 900, y: G - 480 },
            { kind: 'drone', x: 1750, y: G - 520 },
            { kind: 'vacuum', x: 1300, floorY: G, minX: 1000, maxX: 1650 },
          ],
          [
            { kind: 'drone', x: 400, y: G - 700 },
            { kind: 'drone2', x: 1000, y: G - 600 },
            { kind: 'vacuum', x: 700, floorY: G, minX: 450, maxX: 1050 },
            { kind: 'vacuum', x: 2000, floorY: G, minX: 1650, maxX: 2400 },
            { kind: 'drone', x: 1800, y: G - 640 },
          ],
          [
            { kind: 'vacuum', x: 600, floorY: G, minX: 300, maxX: 950 },
            { kind: 'drone2', x: 1200, y: G - 520 },
            { kind: 'drone2', x: 1900, y: G - 560 },
            { kind: 'vacuum', x: 2100, floorY: G - 420, minX: 1980, maxX: 2250 },
            { kind: 'drone', x: 700, y: G - 420 },
          ],
        ],
      },
      items: [
        { key: 'lego_house', x: 1250, y: G - 70, boss: true },
        { key: 'dragon', x: 1420, y: G - 70, boss: true },
      ],
    },
  ],
};
