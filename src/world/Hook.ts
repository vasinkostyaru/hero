import Phaser from 'phaser';
import { GROUND_Y } from '../config/game';

/** Насколько далеко дотягивается нить качелей (от центра героя до крюка). */
export const SWING_REACH = 640;
const POLE_TOP = GROUND_Y - 800;
const RING_KEY = 'hook_ring';

/**
 * Крюк для качелей над широкой улицей (GAME.md): трос натянут между столбами на крышах,
 * посередине висит фонарь — за его кронштейн цепляется нить. Когда герой может дотянуться,
 * вокруг крюка мягко пульсирует бирюзовое кольцо.
 */
export class Hook {
  private ring: Phaser.GameObjects.Image;
  private halo: Phaser.GameObjects.Image;
  private t = 0;
  private reachK = 0;

  constructor(
    scene: Phaser.Scene,
    readonly x: number,
    readonly y: number,
    poleL: number,
    poleR: number,
    glowLayer: Phaser.GameObjects.Layer,
  ) {
    makeRing(scene);
    const g = scene.add.graphics().setDepth(5);
    // столбы на крышах
    for (const px of [poleL, poleR]) {
      g.fillStyle(0x232a44, 1).fillRect(px - 7, POLE_TOP, 14, GROUND_Y - POLE_TOP);
      g.fillStyle(0xffb46a, 0.35).fillRect(px + 3, POLE_TOP, 3, GROUND_Y - POLE_TOP);
      g.fillStyle(0x232a44, 1).fillRect(px - 14, GROUND_Y - 12, 28, 14).fillCircle(px, POLE_TOP, 10);
    }
    // трос провисает к фонарю
    g.lineStyle(5, 0x2a1a24, 1);
    g.lineBetween(poleL, POLE_TOP + 6, x, y);
    g.lineBetween(x, y, poleR, POLE_TOP + 6);
    g.lineStyle(2, 0xffb46a, 0.5);
    g.lineBetween(poleL, POLE_TOP + 4, x, y - 2);
    g.lineBetween(x, y - 2, poleR, POLE_TOP + 4);
    // фонарь: кольцо-крюк, колпак, тёплое стекло
    g.lineStyle(6, 0x232a44, 1).strokeCircle(x, y + 8, 9);
    g.fillStyle(0x232a44, 1).fillTriangle(x - 34, y + 46, x + 34, y + 46, x, y + 16);
    g.fillStyle(0xffd27a, 1).fillRoundedRect(x - 20, y + 46, 40, 40, 6);
    g.fillStyle(0xfff3c4, 1).fillRoundedRect(x - 12, y + 52, 24, 26, 5);
    g.fillStyle(0x232a44, 1).fillRect(x - 24, y + 84, 48, 8);
    this.halo = scene.make.image({ x, y: y + 66, key: 'glow' }, false).setTint(0xffc46a).setBlendMode(Phaser.BlendModes.ADD).setScale(6);
    glowLayer.add(this.halo);
    this.ring = scene.make.image({ x, y: y + 8, key: RING_KEY }, false).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    glowLayer.add(this.ring);
  }

  /** Может ли герой (центр тела) дотянуться: крюк выше и не дальше SWING_REACH. */
  inReach(cx: number, cy: number) {
    return this.y < cy - 40 && Math.hypot(this.x - cx, this.y - cy) < SWING_REACH;
  }

  update(dt: number, heroX: number, heroY: number) {
    this.t += dt;
    const target = this.inReach(heroX, heroY) ? 1 : 0;
    this.reachK += (target - this.reachK) * Math.min(1, dt * 8);
    const pulse = 1 + 0.12 * Math.sin(this.t * 6);
    this.ring.setAlpha(this.reachK * (0.7 + 0.3 * Math.sin(this.t * 6))).setScale(pulse);
    this.halo.setAlpha(0.45 + 0.05 * Math.sin(this.t * 3.1));
  }
}

/** Бирюзовое кольцо — один раз в текстуру. */
function makeRing(scene: Phaser.Scene) {
  if (scene.textures.exists(RING_KEY)) return;
  const g = scene.make.graphics({}, false);
  const R = 64;
  g.lineStyle(10, 0x5ff5e6, 0.35).strokeCircle(R, R, 52);
  g.lineStyle(5, 0xbffcf4, 0.9).strokeCircle(R, R, 46);
  g.generateTexture(RING_KEY, R * 2, R * 2);
  g.destroy();
}
