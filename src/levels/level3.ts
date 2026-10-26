import { GROUND_Y as G } from '../config/game';
import type { LevelDef } from './types';

/**
 * Уровень 3 «Крыши на закате» — битва с Вороном (GAME.md). ≈10 000 px дороги и арена.
 * Пижаму Ворон роняет по дороге на крюк крана (на пути). На арене — 10 попаданий паутиной:
 * перелетает между насестами, зовёт голубей, пикирует; побеждённый, роняет последние вещи
 * мира — трусики и носок.
 */
export const LEVEL3: LevelDef = {
  id: 3,
  items: ['pajamas', 'underpants', 'sock'],
  slots: 'rope',
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
      critters: [{ kind: 'drone', x: 900, y: G - 450 }],
      crow: { x: 1290, y: G - 248 },
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
      crow: { x: 470, y: G - 215 },
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
      crow: { x: 1560, y: G },
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
        { kind: 'drone2', x: 1500, y: G - 500 },
        { kind: 'pigeon', x: 1800, floorY: G, minX: 1300, maxX: 2150 },
      ],
      crow: { x: 1105, y: G - 545 },
    },
    {
      // арена: бочка, труба, высокий мостик — три насеста; голуби падают на крышу
      name: 'Арена',
      w: 2600,
      flag: 100,
      solids: [
        { x: 1950, y: G - 420, w: 300, h: 64, kind: 'platform', look: 'wood' },
        { x: 1150, y: G - 200, w: 260, h: 64, kind: 'platform', look: 'scaffold' },
      ],
      props: [
        { key: 'water_tower', x: 700, heroes: 3.4 },
        { key: 'chimney', x: 1500, heroes: 1.5 },
        { key: 'antenna', x: 2450, heroes: 2, far: true },
      ],
      lamps: [{ x: 2350 }],
      arena: {
        perches: [
          { x: 700, y: G - 690 },
          { x: 1540, y: G - 248 },
          { x: 2100, y: G - 420 },
        ],
        pigeons: [1000, 1800],
      },
      items: [
        { key: 'underpants', x: 1250, y: G - 70, boss: true },
        { key: 'sock', x: 1420, y: G - 70, boss: true },
      ],
    },
  ],
};
