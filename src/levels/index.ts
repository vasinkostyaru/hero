import type { LevelDef } from './types';
import { LEVEL1 } from './level1';
import { LEVEL2 } from './level2';
import { LEVEL3 } from './level3';
import { LEVEL4 } from './level4';
import { LEVEL5 } from './level5';
import { LEVEL6 } from './level6';
import { LEVEL7 } from './level7';
import { LEVEL8 } from './level8';
import { LEVEL9 } from './level9';

/** Готовые уровни по номеру на карте; остальные на карте закрыты. */
export const LEVELS: Record<number, LevelDef> = {
  1: LEVEL1,
  2: LEVEL2,
  3: LEVEL3,
  4: LEVEL4,
  5: LEVEL5,
  6: LEVEL6,
  7: LEVEL7,
  8: LEVEL8,
  9: LEVEL9,
};
