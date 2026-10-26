/**
 * Прогресс на этом устройстве: лучшие звёзды за каждый уровень (0–3).
 * Уровень пройден, если для него есть запись; следующий после пройденного — открыт.
 * Хранилище может быть недоступно (приватный режим) — тогда игра просто не помнит прогресс.
 */
const KEY = 'avgust.progress.v1';

interface Progress {
  stars: Record<number, number>;
}

function load(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Progress;
  } catch {
    // нет хранилища — начинаем с нуля
  }
  return { stars: {} };
}

function save(p: Progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // не сохранилось — не страшно
  }
}

export const progress = {
  /** Лучшие звёзды за уровень; undefined — ещё не пройден. */
  stars(id: number): number | undefined {
    return load().stars[id];
  },
  /** Открыт ли уровень: первый — всегда, остальные — после прохождения предыдущего. */
  unlocked(id: number) {
    return id === 1 || load().stars[id - 1] !== undefined;
  },
  /** Уровень пройден с n звёздами — запоминаем лучший результат. */
  complete(id: number, n: number) {
    const p = load();
    p.stars[id] = Math.max(p.stars[id] ?? 0, n);
    save(p);
  },
};
