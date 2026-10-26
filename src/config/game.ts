export const GAME_W = 1920;
export const GAME_H = 1080;

// Демо-комната: ~2.5 экрана в ширину; вверх мир уходит выше экрана (высокая стена)
export const WORLD_W = 4800;
export const WORLD_TOP = -700;

/** Линия крыши: крыша занимает ~19% высоты экрана снизу. */
export const GROUND_Y = 875;

export const PARALLAX = {
  sky: 0.1,
  cityFar: 0.3,
  cityMid: 0.6,
};

/** Тинт декора, который стоит дальше героя. */
export const FAR_TINT = 0xb8a8c8;
