/** Герой v3 (HERO_V3.md): кадры 320×320 уже в игровом размере — setScale(1). */

export const FRAME = 320;
/** Линия земли в кадре — origin по Y для всех кадров. */
export const FRAME_GROUND_Y = 300;
/** В кадрах на стене руки и носки касаются вертикали x = 225 — это и есть поверхность стены. */
export const FRAME_WALL_X = 225;

/**
 * Откуда вылетает паутина — передняя рука в кадре, относительно origin (0.5, 300/320).
 * Замерено по атласу (самая передняя точка руки).
 */
export const HAND: Record<string, { x: number; y: number }> = {
  shoot: { x: 86, y: -119 },
  jump: { x: 66, y: -226 },
  apex: { x: 58, y: -173 },
  fall_1: { x: 64, y: -172 },
  fall_2: { x: 58, y: -214 },
};

/** Хитбокс в экранных пикселях, от точки между ступнями вверх. */
export const HERO_HITBOX = { w: 70, h: 200 };

/** Пороги vy для кадров прыжка (px/с). */
export const VY_APEX = 250;
export const VY_FALL2 = 650;

export const RUN_FPS = 11;
export const CLIMB_FPS = 11;
export const LAND_MS = 120;
export const SHOOT_MS = 260;
