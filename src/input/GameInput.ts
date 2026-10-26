/** Что контроллер героя читает из ввода — общее для клавиатуры и сенсорных кнопок. */
export interface GameInput {
  readonly left: boolean;
  readonly right: boolean;
  readonly up: boolean;
  readonly jumpHeld: boolean;
  /** true ровно один кадр после нажатия */
  readonly jumpPressed: boolean;
  readonly shootPressed: boolean;
  /** паутину держат — для качелей: отпустил кнопку, отпустил нить */
  readonly shootHeld: boolean;
}

/** Объединяет несколько источников ввода: нажато, если нажато хоть где-то. */
export class CombinedInput implements GameInput {
  constructor(private sources: GameInput[]) {}
  get left() { return this.sources.some((s) => s.left); }
  get right() { return this.sources.some((s) => s.right); }
  get up() { return this.sources.some((s) => s.up); }
  get jumpHeld() { return this.sources.some((s) => s.jumpHeld); }
  get shootHeld() { return this.sources.some((s) => s.shootHeld); }
  // JustDown у клавиатуры сбрасывается при чтении — опрашиваем все источники, а не до первого true
  get jumpPressed() { return this.any('jumpPressed'); }
  get shootPressed() { return this.any('shootPressed'); }

  /** Опрашиваем все источники без короткого замыкания: «нажато» снимается при чтении. */
  private any(key: 'jumpPressed' | 'shootPressed') {
    let hit = false;
    for (const s of this.sources) if (s[key]) hit = true;
    return hit;
  }
}
