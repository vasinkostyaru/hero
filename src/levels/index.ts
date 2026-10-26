import type { LevelDef } from './types';
import { LEVEL1 } from './level1';
import { LEVEL2 } from './level2';
import { LEVEL3 } from './level3';

/** Готовые уровни по номеру на карте; остальные на карте закрыты. */
export const LEVELS: Record<number, LevelDef> = { 1: LEVEL1, 2: LEVEL2, 3: LEVEL3 };
