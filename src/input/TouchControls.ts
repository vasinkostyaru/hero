import Phaser from 'phaser';
import { GAME_H } from '../config/game';
import type { GameInput } from './GameInput';

export type ButtonId = 'left' | 'right' | 'jump' | 'shoot';

export interface ButtonLayout {
  id: ButtonId;
  x: number;
  y: number;
  r: number;
}

const BY = GAME_H - 175;
/** Отступ от боковых краёв — чтобы кнопки не попадали под вырез камеры и закругления экрана. */
const SIDE = 60;
/** Выше этого касание — не управление: там пауза, домик и слоты предметов. */
const ZONE_TOP = 260;
/** Ширина экрана — для деления на левую и правую половины. */
let screenW = 1920;

/** Слева ← →, справа прыжок (крупнее) и паутина. Правые кнопки прижаты к правому краю экрана. */
export const BUTTONS: ButtonLayout[] = [
  { id: 'left', x: 0, y: BY, r: 110 },
  { id: 'right', x: 0, y: BY, r: 110 },
  { id: 'shoot', x: 0, y: BY + 25, r: 100 },
  { id: 'jump', x: 0, y: BY - 40, r: 140 },
];

/** Расставляет кнопки под текущую ширину экрана (она зависит от телефона). */
export function layoutButtons(width: number) {
  screenW = width;
  const pos: Record<ButtonId, number> = {
    left: SIDE + 175,
    right: SIDE + 420,
    shoot: width - SIDE - 430,
    jump: width - SIDE - 185,
  };
  for (const b of BUTTONS) b.x = pos[b.id];
}
layoutButtons(1920);

/**
 * Состояние сенсорных кнопок. Мультитач: каждый кадр смотрим все активные касания,
 * поэтому можно бежать и прыгать одновременно и вести пальцем с ← на →.
 * Само нажатие ловим событием в момент касания: быстрый детский тап может начаться
 * и закончиться между кадрами, и опрос «держится ли палец» его бы пропустил.
 * Рисует кнопки UIScene — отдельно, чтобы зум игровой камеры их не трогал.
 */
export class TouchControls implements GameInput {
  pressedNow = new Set<ButtonId>();
  private justPressed = new Set<ButtonId>();
  /** нажатия, пойманные событиями с прошлого кадра */
  private taps = new Set<ButtonId>();
  private prevPressed = new Set<ButtonId>();

  constructor(private manager: Phaser.Input.InputManager) {}

  /** Вызывать из обработчика pointerdown — сразу, в момент касания. */
  onPointerDown(p: Phaser.Input.Pointer) {
    const b = this.hit(p.x, p.y);
    if (b) this.taps.add(b.id);
  }

  get left() { return this.pressedNow.has('left'); }
  get right() { return this.pressedNow.has('right'); }
  get up() { return false; }
  get jumpHeld() { return this.pressedNow.has('jump'); }
  get shootHeld() { return this.pressedNow.has('shoot'); }
  get jumpPressed() { return this.justPressed.has('jump'); }
  get shootPressed() { return this.justPressed.has('shoot'); }

  /** Вызывать в начале кадра, до контроллера героя. Множества переиспользуем — без мусора каждый кадр. */
  update() {
    const prev = this.prevPressed;
    prev.clear();
    for (const id of this.pressedNow) prev.add(id);
    this.pressedNow.clear();
    for (const p of this.manager.pointers) {
      if (!p.isDown) continue;
      const b = this.hit(p.x, p.y);
      if (b) this.pressedNow.add(b.id);
    }
    // короткий тап, который уже отпустили, всё равно виден как «нажато» один кадр — кнопка мигнёт
    for (const id of this.taps) this.pressedNow.add(id);
    this.justPressed.clear();
    for (const id of this.pressedNow) if (!prev.has(id) || this.taps.has(id)) this.justPressed.add(id);
    this.taps.clear();
  }

  /**
   * Кнопки — только подсказка: весь экран ниже верхней полосы поделён на зоны.
   * Левая половина — ходьба: левее середины между ← и → — влево, правее — вправо.
   * Правая половина — ближайшая из «прыжок» и «паутина». Детский палец, промахнувшись
   * мимо кружка, всё равно делает то, что хотел, а скользя — переходит с кнопки на кнопку.
   */
  private hit(x: number, y: number) {
    if (y < ZONE_TOP) return null;
    const side = BUTTONS.filter((b) => (x < screenW / 2) === (b.id === 'left' || b.id === 'right'));
    let best = side[0];
    let bestD = Infinity;
    for (const b of side) {
      // ← и → делим только по x; прыжок и паутину — по расстоянию до центра (прыжок крупнее — его зона шире)
      const d = b.id === 'left' || b.id === 'right' ? Math.abs(x - b.x) : Math.hypot(x - b.x, y - b.y) / b.r;
      if (d < bestD) {
        best = b;
        bestD = d;
      }
    }
    return best;
  }
}
