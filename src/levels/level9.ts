import { GROUND_Y as G } from '../config/game';
import type { LevelDef } from './types';

/**
 * Уровень 9 «Рассвет» — битва с Енотом-Бандитом (GAME.md, мир 3). ≈10 600 px дороги и арена.
 * Дождь кончился, над городом радуга. Подарок Енот роняет по дороге на крышу. На арене —
 * 10 попаданий паутиной: он зовёт три волны банды (белки, голуби, чайки) и, пока волна
 * не в коконах, прячется под щитом; между волнами перелетает на зонте, после последней —
 * пикирует. Побеждённый (зонт вывернут), роняет шарики и торт.
 */
export const LEVEL9: LevelDef = {
  id: 9,
  world: 3,
  theme: 'dawn',
  items: ['gift', 'balloons', 'cake'],
  sections: [
    {
      name: 'Старт',
      w: 1600,
      start: 300,
      flag: 160,
      clotheslines: [{ x: 480 }],
      props: [
        { key: 'water_tower', x: 80, heroes: 3.4 },
        { key: 'chimney', x: 1150, heroes: 1.5 },
      ],
      critters: [
        { kind: 'seagull', x: 700, y: G - 780, range: 250 },{ kind: 'pigeon', x: 850, floorY: G, minX: 700, maxX: 1000 }],
      perch: { x: 1190, y: G - 248 },
    },
    {
      // стена в плюще с тентом-батутом и мостики; подарок — на крыше за ними
      name: 'Плющ и тент',
      w: 2200,
      solids: [
        { x: 500, y: G - 450, w: 110, h: 450, kind: 'wall', climbable: true },
        { x: 900, y: G - 560, w: 300, h: 64, kind: 'platform', look: 'wood' },
        { x: 1300, y: G - 380, w: 300, h: 64, kind: 'platform', look: 'wood' },
        { x: 500 - 208, y: G - 170, w: 200, h: 64, kind: 'platform', look: 'balcony' },
      ],
      awnings: [{ wallRight: 610, y: G - 210 }],
      critters: [
        { kind: 'pigeon', x: 1450, floorY: G - 380, minX: 1330, maxX: 1580 },
        { kind: 'squirrel', x: 1050, floorY: G - 560 },
        { kind: 'seagull', x: 1700, y: G - 760, range: 300 },
      ],
      items: [{ key: 'gift', x: 1850, y: G - 70, carried: true }],
      perch: { x: 555, y: G - 450 },
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
      critters: [{ kind: 'pigeon', x: 2100, floorY: G, minX: 1900, maxX: 2350 }],
      perch: { x: 2200, y: G },
    },
    {
      // люлька и колодец — подъём к арене; енот ждёт на стене и улетает на арену
      name: 'Подъём к арене',
      w: 2200,
      flag: 100,
      cradles: [{ x: 300, top: G - 560, bottom: G - 40, period: 7 }],
      solids: [
        { x: 800, y: G - 615, w: 90, h: 615, kind: 'wall', climbable: true },
        { x: 1060, y: G - 545, w: 90, h: 545, kind: 'wall', climbable: true },
        { x: 1450, y: G - 280, w: 300, h: 64, kind: 'platform', look: 'wood' },
      ],
      critters: [
        { kind: 'seagull', x: 600, y: G - 800, range: 250 },
        { kind: 'squirrel', x: 1600, floorY: G - 280 },
        { kind: 'pigeon', x: 1800, floorY: G, minX: 1300, maxX: 2150 },
      ],
      perch: { x: 1105, y: G - 545 },
    },
    {
      // арена на рассвете: бочка, труба, высокий мостик — три насеста; три волны банды
      name: 'Арена',
      w: 2600,
      flag: 100,
      solids: [
        { x: 220, y: G - 190, w: 240, h: 64, kind: 'platform', look: 'wood' },
        { x: 520, y: G - 370, w: 220, h: 64, kind: 'platform', look: 'wood' },
        { x: 260, y: G - 550, w: 220, h: 64, kind: 'platform', look: 'wood' },
        { x: 1100, y: G - 200, w: 260, h: 64, kind: 'platform', look: 'wood' },
        { x: 1220, y: G - 390, w: 240, h: 64, kind: 'platform', look: 'wood' },
        { x: 1040, y: G - 570, w: 220, h: 64, kind: 'platform', look: 'wood' },
        { x: 1700, y: G - 230, w: 220, h: 64, kind: 'platform', look: 'wood' },
        { x: 1950, y: G - 420, w: 300, h: 64, kind: 'platform', look: 'wood' },
        { x: 2260, y: G - 610, w: 260, h: 64, kind: 'platform', look: 'wood' },
      ],
      props: [
        { key: 'water_tower', x: 700, heroes: 3.4 },
        { key: 'chimney', x: 1540, heroes: 1.5 },
        { key: 'antenna', x: 2450, heroes: 2, far: true },
      ],
      arena: {
        perches: [
          { x: 700, y: G - 690 },
          { x: 1580, y: G - 248 },
          { x: 2390, y: G - 610 },
        ],
        waves: [
          [
            { kind: 'seagull', x: 1500, y: G - 780, range: 350 },
            { kind: 'squirrel', x: 370, floorY: G - 550 },
            { kind: 'pigeon', x: 1300, floorY: G, minX: 1000, maxX: 1600 },
            { kind: 'pigeon', x: 2000, floorY: G, minX: 1700, maxX: 2400 },
          ],
          [
            { kind: 'squirrel', x: 370, floorY: G - 550 },
            { kind: 'seagull', x: 1000, y: G - 760, range: 400 },
            { kind: 'squirrel', x: 2100, floorY: G - 420 },
            { kind: 'pigeon', x: 800, floorY: G, minX: 450, maxX: 1100 },
          ],
          [
            { kind: 'pigeon', x: 700, floorY: G, minX: 400, maxX: 1000 },
            { kind: 'squirrel', x: 1150, floorY: G - 570 },
            { kind: 'squirrel', x: 600, floorY: G - 370 },
            { kind: 'seagull', x: 1800, y: G - 720, range: 300 },
            { kind: 'pigeon', x: 1900, floorY: G, minX: 1650, maxX: 2300 },
          ],
        ],
      },
      items: [
        { key: 'balloons', x: 1250, y: G - 70, boss: true },
        { key: 'cake', x: 1420, y: G - 70, boss: true },
      ],
    },
  ],
};
