import { GROUND_Y as G } from '../config/game';
import type { LevelDef } from './types';

/**
 * Уровень 1 «Крыши на закате» (GAME.md): 8 секций ≈ 16 000 px, 2–3 минуты.
 * Вещи несёт Ворон и роняет каждую в её место (CROW2.md): кепку — в гнездо под голубем
 * (сторож), шарф — на крюк крана у героя на глазах (на пути), футболку — на антенну
 * на башне над лесами (высоко, по желанию; видна с крыши).
 * Шалуны мира 1: дроны-мишени, голуби, чайки, дроны-2 — 16 штук, не больше 2–3 на экране.
 */
export const LEVEL1: LevelDef = {
  items: ['scarf', 'cap', 'tshirt'],
  slots: 'rope',
  sections: [
    {
      // завязка: Ворон сидит на трубе с носком, крупный план, хохочет и улетает
      name: 'Дом Августа',
      w: 1600,
      start: 300,
      flag: 160,
      clotheslines: [{ x: 480 }],
      props: [
        { key: 'water_tower', x: 60, heroes: 3.4 },
        { key: 'chimney', x: 1150, heroes: 1.5 },
        { key: 'antenna', x: 1450, heroes: 2, far: true },
      ],
      critters: [{ kind: 'drone', x: 820, y: G - 430 }],
      crow: { x: 1190, y: G - 248 },
    },
    {
      // учимся паутине на дронах; ящик и мостики-ступеньки
      name: 'Разминка',
      w: 2000,
      solids: [
        { x: 300, y: G - 110, w: 120, h: 110, kind: 'box' },
        { x: 560, y: G - 190, w: 300, h: 64, kind: 'platform', look: 'wood' },
        { x: 1000, y: G - 330, w: 260, h: 64, kind: 'platform', look: 'wood' },
      ],
      props: [
        { key: 'water_tower', x: 1300, heroes: 3.4, far: true },
        { key: 'ac_unit', x: 1500, heroes: 0.6 },
        { key: 'chimney', x: 1750, heroes: 1.5 },
      ],
      critters: [
        { kind: 'drone', x: 900, y: G - 480 },
        { kind: 'drone', x: 1480, y: G - 380 },
        { kind: 'pigeon', x: 700, floorY: G - 190, minX: 590, maxX: 830 },
      ],
      crow: { x: 1790, y: G - 248 },
    },
    {
      // кепка в гнезде на ящиках — на ней сидит голубь; закоконь — и кепка твоя
      name: 'Голубиная крыша',
      w: 2000,
      flag: 100,
      slot: 'голубь-толстяк (сидит на гнезде вместо голубя)',
      solids: [
        { x: 1050, y: G - 110, w: 120, h: 110, kind: 'box' },
        { x: 1170, y: G - 110, w: 120, h: 110, kind: 'box' },
        { x: 1500, y: G - 220, w: 300, h: 64, kind: 'platform', look: 'wood' },
      ],
      props: [
        { key: 'water_tower', x: 700, heroes: 3.4, far: true },
        { key: 'antenna', x: 1880, heroes: 2 },
      ],
      critters: [
        { kind: 'pigeon', x: 500, floorY: G, minX: 300, maxX: 900 },
        { kind: 'pigeon', id: 'nestGuard', x: 1170, floorY: G - 110, minX: 1170, maxX: 1170 },
      ],
      items: [{ key: 'cap', x: 1170, y: G - 132, guard: 'nestGuard', carried: true }],
      // сидит на мостике за гнездом: герой подходит — роняет кепку в гнездо
      crow: { x: 1600, y: G - 220, drop: 'cap' },
    },
    {
      // стройка: Ворон пролетает над балкой и роняет шарф — тот цепляется за крюк крана
      name: 'Стройка',
      w: 2200,
      solids: [
        { x: 150, y: G - 215, w: 400, h: 64, kind: 'platform', look: 'scaffold' },
        { x: 800, y: G - 425, w: 500, h: 64, kind: 'platform', look: 'beam' },
        { x: 1500, y: G - 300, w: 350, h: 64, kind: 'platform', look: 'scaffold' },
      ],
      trolleys: [{ id: 'crane', minX: 880, maxX: 1220, beamTop: G - 430 }],
      props: [
        { key: 'chimney', x: 660, heroes: 1.5 },
        { key: 'antenna', x: 1950, heroes: 2, far: true },
      ],
      critters: [
        { kind: 'drone', x: 1700, y: G - 560 },
        { kind: 'pigeon', x: 350, floorY: G - 215, minX: 190, maxX: 510 },
      ],
      items: [{ key: 'scarf', x: 0, y: 0, carried: true, attach: 'crane' }],
      crow: { x: 1050, y: G - 425, drop: 'scarf' },
    },
    {
      // низкая стена с балконом — основной путь; башня на лесах с футболкой — по желанию
      name: 'Высокая стена',
      w: 1800,
      flag: 100,
      slot: 'белка с жёлудями (на антенне) — пока чайка',
      solids: [
        { x: 520 - 208, y: G - 170, w: 200, h: 64, kind: 'platform', look: 'balcony' },
        { x: 520, y: G - 300, w: 110, h: 300, kind: 'wall', climbable: true },
        // под лесами герой проходит; кто хочет футболку — на леса и по башне вверх
        { x: 1000, y: G - 250, w: 420, h: 64, kind: 'platform', look: 'scaffold' },
        { x: 1150, y: G - 650, w: 110, h: 400, kind: 'wall', climbable: true },
      ],
      props: [{ key: 'antenna', x: 1180, heroes: 1.1, y: G - 646 }],
      critters: [
        { kind: 'seagull', x: 900, y: G - 760, range: 350 },
        { kind: 'pigeon', x: 1200, floorY: G, minX: 700, maxX: 1700 },
      ],
      items: [{ key: 'tshirt', x: 1200, y: G - 755, carried: true }],
      // сидит на верху башни рядом с антенной — роняет на неё футболку
      crow: { x: 1245, y: G - 650, drop: 'tshirt' },
    },
    {
      // широкая улица: не перепрыгнуть — качели на паутине за фонарь на тросе
      name: 'Широкая улица',
      w: 1800,
      flag: 120,
      roof: [
        [0, 560],
        [1320, 1800],
      ],
      // крюк высоко: нить длинная, размах большой
      hooks: [{ x: 940, y: G - 650, spanL: 430, spanR: 1450 }],
      critters: [{ kind: 'drone', x: 1650, y: G - 380 }],
      crow: { x: 1560, y: G },
    },
    {
      // люлька поднимает к колодцу; дрон-2 таранит
      name: 'Колодец и люлька',
      w: 2200,
      flag: 100,
      cradles: [{ x: 300, top: G - 560, bottom: G - 40, period: 7 }],
      solids: [
        { x: 800, y: G - 615, w: 90, h: 615, kind: 'wall', climbable: true },
        { x: 1060, y: G - 545, w: 90, h: 545, kind: 'wall', climbable: true },
        { x: 1350, y: G - 300, w: 300, h: 64, kind: 'platform', look: 'wood' },
      ],
      props: [
        { key: 'water_tower', x: 1800, heroes: 3.4, far: true },
        { key: 'chimney', x: 1950, heroes: 1.5 },
      ],
      critters: [
        { kind: 'drone2', x: 1500, y: G - 470 },
        { kind: 'pigeon', x: 1800, floorY: G, minX: 1300, maxX: 2150 },
      ],
      crow: { x: 1105, y: G - 545 },
    },
    {
      // финал: Ворон на водонапорной бочке хохочет и улетает с носком → победа
      name: 'Финальная крыша',
      w: 2400,
      flag: 100,
      slot: 'кот-воришка — пока голубь',
      solids: [{ x: 1150, y: G - 200, w: 300, h: 64, kind: 'platform', look: 'wood' }],
      props: [
        { key: 'water_tower', x: 1700, heroes: 3.4 },
        { key: 'ac_unit', x: 2300, heroes: 0.6 },
      ],
      lamps: [{ x: 2100 }],
      critters: [
        { kind: 'pigeon', x: 600, floorY: G, minX: 400, maxX: 1000 },
        { kind: 'drone2', x: 1300, y: G - 520 },
        { kind: 'seagull', x: 1900, y: G - 760, range: 400 },
      ],
      crow: { x: 1700, y: G - 690 },
    },
  ],
};
