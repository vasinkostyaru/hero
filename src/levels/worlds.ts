import type { SlotStyle } from '../ui/ItemSlots';
import type { VillainKind } from '../world/Villain';

export type WorldId = 1 | 2 | 3;

/** Мир (GAME.md): свой злодей, особая вещь, которую он держит до битвы, и фон слотов. */
export interface WorldDef {
  villain: VillainKind;
  /** у злодея в лапах до финала мира; на уровнях как обычную находку не ставить */
  special: string;
  slots: SlotStyle;
}

export const WORLDS: Record<WorldId, WorldDef> = {
  1: { villain: 'crow', special: 'sock', slots: 'rope' },
  2: { villain: 'bumblebee', special: 'dragon', slots: 'shelf' },
  3: { villain: 'raccoon', special: 'cake', slots: 'table' },
};

/** Вещи миров (ITEMS.md; игрушки и сладости — art/raw/toys.png, sweets.png). */
export const WORLD_ITEMS: Record<WorldId, string[]> = {
  1: ['tshirt', 'cap', 'scarf', 'mitten', 'shorts', 'towel', 'pajamas', 'underpants', 'sock'],
  2: ['brick_red', 'brick_yellow', 'minifig', 'wheel', 'brick_window', 'rocket', 'transformer', 'lego_house', 'dragon'],
  3: ['cupcake', 'lollipop', 'donut', 'icecream', 'candy', 'candycane', 'gift', 'balloons', 'cake'],
};
