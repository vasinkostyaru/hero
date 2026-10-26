import type { PlatformLook } from '../world/Platforms';

/**
 * Описание уровня: секции-зоны по ~1–1.5 экрана. Внутри секции x — от её левого края,
 * y — мировой (крыша — GROUND_Y). Level собирает секции подряд слева направо.
 */
export interface LevelDef {
  /** номер уровня на карте (src/config/levels.json) */
  id: number;
  /** 3 предмета уровня по порядку слотов (ключи картинок в assets/items) */
  items: string[];
  /** фон слотов: мир 1 — бельевая верёвка (мир 2 — полка, мир 3 — стол) */
  slots: 'rope';
  sections: SectionDef[];
}

export interface SectionDef {
  /** для отладки и комментариев */
  name: string;
  w: number;
  /** куски крыши [от, до]; по умолчанию — вся ширина. Между кусками — улица. */
  roof?: [number, number][];
  /** флаг-чекпоинт */
  flag?: number;
  /** старт героя (только в первой секции) */
  start?: number;
  solids?: SolidDef[];
  props?: PropDefLocal[];
  cradles?: { x: number; top: number; bottom: number; period: number }[];
  clotheslines?: { x: number }[];
  awnings?: { wallRight: number; y: number }[];
  trolleys?: { id?: string; minX: number; maxX: number; beamTop: number }[];
  /** крюк для качелей над улицей: x, y — точка, за которую цепляется нить */
  hooks?: { x: number; y: number; spanL: number; spanR: number }[];
  lamps?: { x: number }[];
  critters?: CritterDef[];
  items?: ItemDef[];
  /** насест злодея в этой зоне (точка у лап); drop — предмет, который он роняет, улетая */
  crow?: { x: number; y: number; drop?: string };
  /** место под будущего шалуна (кот, белка, голубь-толстяк) — пока стоит существующий */
  slot?: string;
  /**
   * Арена битвы с боссом (уровень 3 мира): злодей прилетает сюда, когда герой вошёл в секцию.
   * perches — насесты, pigeons — x, где приземляются голуби, которых он зовёт на помощь.
   */
  arena?: { perches: { x: number; y: number }[]; pigeons: number[] };
}

export interface SolidDef {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: 'platform' | 'wall' | 'box';
  climbable?: boolean;
  look?: PlatformLook | 'balcony';
}

export interface PropDefLocal {
  key: string;
  x: number;
  heroes: number;
  far?: boolean;
  /** низ предмета; по умолчанию — крыша */
  y?: number;
}

export type CritterDef =
  | { kind: 'drone' | 'drone2'; x: number; y: number; id?: string }
  | { kind: 'pigeon'; x: number; floorY: number; minX: number; maxX: number; id?: string }
  | { kind: 'seagull'; x: number; y: number; range: number; id?: string };

export interface ItemDef {
  key: string;
  x: number;
  y: number;
  /** сторож: id шалуна — пока он не в коконе, предмет не взять */
  guard?: string;
  /** у злодея в клюве: появляется, когда он роняет его над этим местом (CROW2.md) */
  carried?: boolean;
  /** висит на тележке с крюком (id тележки) — едет вместе с ней */
  attach?: string;
  /** выпадает у побеждённого босса: x, y — куда падает */
  boss?: boolean;
}
