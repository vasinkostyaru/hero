import { GROUND_Y as G } from '../config/game';
import type { LevelDef } from './types';

/**
 * Уровень 3 «Крыши на закате» — битва с Вороном (GAME.md). ≈10 000 px дороги и арена.
 * Пижаму Ворон роняет по дороге на крюк крана (на пути). На арене — 10 попаданий паутиной:
 * он зовёт три волны шалунов и, пока волна не в коконах, сидит под щитом; между волнами
 * перелетает, после последней — пикирует. Побеждённый, роняет последние вещи мира —
 * трусики и носок.
 */
export const LEVEL3: LevelDef = {
  id: 3,
  items: ['pajamas', 'underpants', 'sock'],
  world: 1,
  theme: 'sunset',
  sections: [
    {
      name: 'Старт',
      w: 1600,
      start: 300,
      flag: 160,
      props: [
        { key: 'water_tower', x: 80, heroes: 3.4 },
        { key: 'chimney', x: 1250, heroes: 1.5 },
      ],
      critters: [
        { kind: 'pigeon', x: 700, floorY: G, minX: 550, maxX: 950 },{ kind: 'drone', x: 900, y: G - 450 }],
      perch: { x: 1290, y: G - 248 },
    },
    {
      // стройка: пролетая над краном, Ворон вешает пижаму на крюк
      name: 'Стройка',
      w: 2200,
      solids: [
        { x: 150, y: G - 215, w: 400, h: 64, kind: 'platform', look: 'scaffold' },
        { x: 800, y: G - 425, w: 500, h: 64, kind: 'platform', look: 'beam' },
        { x: 1500, y: G - 320, w: 350, h: 64, kind: 'platform', look: 'scaffold' },
      ],
      trolleys: [{ id: 'crane3', minX: 880, maxX: 1220, beamTop: G - 430 }],
      props: [{ key: 'chimney', x: 660, heroes: 1.5 }],
      critters: [
        { kind: 'pigeon', x: 350, floorY: G - 215, minX: 190, maxX: 510 },
        { kind: 'drone2', x: 1650, y: G - 600 },
      ],
      items: [{ key: 'pajamas', x: 0, y: 0, carried: true, attach: 'crane3' }],
      perch: { x: 470, y: G - 215 },
    },
    {
      name: 'Улица',
      w: 1800,
      flag: 120,
      roof: [
        [0, 560],
        [1320, 1800],
      ],
      hooks: [{ x: 940, y: G - 650, spanL: 430, spanR: 1450 }],
      critters: [{ kind: 'seagull', x: 1500, y: G - 760, range: 300 }],
      perch: { x: 1560, y: G },
    },
    {
      // люлька и колодец — подъём к арене; Ворон ждёт на стене и улетает на арену
      name: 'Колодец и люлька',
      w: 2200,
      flag: 100,
      cradles: [{ x: 300, top: G - 560, bottom: G - 40, period: 7 }],
      solids: [
        { x: 800, y: G - 615, w: 90, h: 615, kind: 'wall', climbable: true },
        { x: 1060, y: G - 545, w: 90, h: 545, kind: 'wall', climbable: true },
        { x: 1450, y: G - 280, w: 300, h: 64, kind: 'platform', look: 'wood' },
      ],
      critters: [
        { kind: 'drone', x: 640, y: G - 380 },
        { kind: 'drone2', x: 1500, y: G - 500 },
        { kind: 'pigeon', x: 1800, floorY: G, minX: 1300, maxX: 2150 },
      ],
      perch: { x: 1105, y: G - 545 },
    },
    {
      // арена: бочка, труба, высокий мостик — три насеста; Ворон зовёт три волны шалунов.
      // Мостики лесенкой в три яруса (прыжок ≈300 px, шаг ≤190) — к любому насесту можно подобраться.
      name: 'Арена',
      w: 2600,
      flag: 100,
      solids: [
        // слева — к бочке
        { x: 220, y: G - 190, w: 240, h: 64, kind: 'platform', look: 'wood' },
        { x: 520, y: G - 370, w: 220, h: 64, kind: 'platform', look: 'scaffold' },
        { x: 260, y: G - 550, w: 220, h: 64, kind: 'platform', look: 'wood' },
        // середина — горка над трубой
        { x: 1100, y: G - 200, w: 260, h: 64, kind: 'platform', look: 'scaffold' },
        { x: 1220, y: G - 390, w: 240, h: 64, kind: 'platform', look: 'wood' },
        { x: 1040, y: G - 570, w: 220, h: 64, kind: 'platform', look: 'scaffold' },
        // справа — к высокому мостику
        { x: 1700, y: G - 230, w: 220, h: 64, kind: 'platform', look: 'wood' },
        { x: 1950, y: G - 420, w: 300, h: 64, kind: 'platform', look: 'wood' },
        { x: 2260, y: G - 610, w: 260, h: 64, kind: 'platform', look: 'scaffold' },
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
            { kind: 'drone2', x: 1500, y: G - 600 },
            { kind: 'drone', x: 900, y: G - 480 },
            { kind: 'drone', x: 1750, y: G - 420 },
            { kind: 'pigeon', x: 1300, floorY: G, minX: 1000, maxX: 1600 },
          ],
          [
            { kind: 'drone', x: 400, y: G - 700 },
            { kind: 'seagull', x: 1000, y: G - 760, range: 400 },
            { kind: 'seagull', x: 1800, y: G - 720, range: 300 },
            { kind: 'pigeon', x: 800, floorY: G, minX: 450, maxX: 1100 },
            { kind: 'pigeon', x: 1900, floorY: G, minX: 1650, maxX: 2300 },
          ],
          [
            { kind: 'pigeon', x: 500, floorY: G, minX: 300, maxX: 800 },
            { kind: 'drone2', x: 1200, y: G - 520 },
            { kind: 'drone2', x: 1900, y: G - 480 },
            { kind: 'seagull', x: 1450, y: G - 760, range: 350 },
            { kind: 'drone', x: 700, y: G - 420 },
          ],
        ],
      },
      items: [
        { key: 'underpants', x: 1250, y: G - 70, boss: true },
        { key: 'sock', x: 1420, y: G - 70, boss: true },
      ],
    },
  ],
};
