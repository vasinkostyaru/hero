import Phaser from 'phaser';
import type { GameInput } from './GameInput';

type Action = 'jump' | 'shoot' | 'debug';

/**
 * Клавиатура для отладки: стрелки, пробел — прыжок, X — паутина, D — debug.
 * Нажатия ловим событием keydown: если клавишу отпустить раньше следующего кадра,
 * Phaser сбрасывает JustDown и короткое нажатие терялось бы.
 */
export class KeyboardInput implements GameInput {
  private keys: Record<'left' | 'right' | 'up' | 'jump' | 'shoot', Phaser.Input.Keyboard.Key>;
  private pressed = new Set<Action>();

  constructor(scene: Phaser.Scene) {
    const K = Phaser.Input.Keyboard.KeyCodes;
    const kb = scene.input.keyboard!;
    this.keys = {
      left: kb.addKey(K.LEFT),
      right: kb.addKey(K.RIGHT),
      up: kb.addKey(K.UP),
      jump: kb.addKey(K.SPACE),
      shoot: kb.addKey(K.X),
    };
    kb.on('keydown-SPACE', (e: KeyboardEvent) => !e.repeat && this.pressed.add('jump'));
    kb.on('keydown-X', (e: KeyboardEvent) => !e.repeat && this.pressed.add('shoot'));
    kb.on('keydown-D', (e: KeyboardEvent) => !e.repeat && this.pressed.add('debug'));
  }

  /** true один раз после нажатия — флаг снимается при чтении. */
  private take(a: Action) {
    return this.pressed.delete(a);
  }

  get left() { return this.keys.left.isDown; }
  get right() { return this.keys.right.isDown; }
  get up() { return this.keys.up.isDown; }
  get jumpHeld() { return this.keys.jump.isDown; }
  get shootHeld() { return this.keys.shoot.isDown; }
  get jumpPressed() { return this.take('jump'); }
  get shootPressed() { return this.take('shoot'); }
  get debugPressed() { return this.take('debug'); }
}
