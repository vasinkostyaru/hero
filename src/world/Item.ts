import Phaser from 'phaser';
import { feedback } from '../audio/feedback';
import { scaledTexture } from './textures';

/** Предмет на уровне — около 1/3 роста героя (ITEMS.md): по большей стороне. */
export const ITEM_SIZE = 92;

export type ItemState = 'carried' | 'falling' | 'idle' | 'collected';

/** Масштаб картинки предмета до ITEM_SIZE по большей стороне. */
export function itemScale(scene: Phaser.Scene, key: string, size = ITEM_SIZE) {
  const src = scene.textures.get(key).getSourceImage();
  return size / Math.max(src.width, src.height);
}

/**
 * Предмет уровня (ITEMS.md): мягко покачивается (±6°), чуть поднимается и опускается,
 * раз в 2 с по нему пробегает блик, позади тёплый ореол — видно издалека.
 * Сторожит шалун — взять нельзя, пока он не в коконе. Злодей может нести его и уронить:
 * тогда предмет летит к цели (крюку) и дальше висит на ней.
 */
export class Item {
  state: ItemState;
  private img: Phaser.GameObjects.Image;
  private shine: Phaser.GameObjects.Image;
  private halo: Phaser.GameObjects.Image;
  private t = Math.random() * 10;
  private fallT = 0;
  private from = { x: 0, y: 0 };

  constructor(
    private scene: Phaser.Scene,
    readonly key: string,
    private x: number,
    private y: number,
    glowLayer: Phaser.GameObjects.Layer,
    /** пока true — предмет под охраной */
    private guarded: () => boolean = () => false,
    /** к чему прицеплен (крюк тележки); null — висит на месте */
    private anchor: (() => { x: number; y: number }) | null = null,
    carried = false,
  ) {
    const scale = itemScale(scene, key);
    this.halo = scene.make.image({ x, y, key: 'glow' }, false).setTint(0xffd27a).setBlendMode(Phaser.BlendModes.ADD).setScale(5.5);
    glowLayer.add(this.halo);
    this.img = scene.add.image(x, y, scaledTexture(scene, key, scale)).setDepth(9);
    // блик — та же картинка, залитая белым, вспыхивает и гаснет
    this.shine = scene.add.image(x, y, this.img.texture.key).setDepth(9).setTintFill(0xffffff).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    this.state = carried ? 'carried' : 'idle';
    if (carried) this.setVisible(false);
  }

  get pos() {
    return { x: this.img.x, y: this.img.y };
  }

  /** x места, куда предмет должен попасть (для злодея, который его роняет). */
  get place() {
    return this.anchor ? this.anchor().x : this.x;
  }

  /** Злодей роняет предмет из точки (x, y): летит к своему якорю. */
  drop(x: number, y: number) {
    if (this.state !== 'carried') return;
    this.state = 'falling';
    this.fallT = 0;
    this.from = { x, y };
    this.setVisible(true);
    this.img.setPosition(x, y);
    feedback.coo();
  }

  /** Можно ли взять сейчас. */
  get takeable() {
    return this.state === 'idle' && !this.guarded();
  }

  /** Касается ли героя (прямоугольник тела). */
  touches(b: { left: number; right: number; top: number; bottom: number }) {
    const { x, y } = this.img;
    const r = ITEM_SIZE * 0.45;
    return x + r > b.left && x - r < b.right && y + r > b.top && y - r < b.bottom;
  }

  /** Подобрали: подпрыгивает, крутится и гаснет (в слот улетает копия на экране — UIScene). */
  collect() {
    this.state = 'collected';
    this.halo.setVisible(false);
    this.shine.setVisible(false);
    this.scene.tweens.add({ targets: this.img, y: this.img.y - 70, angle: 360, scale: this.img.scale * 1.3, duration: 260, ease: 'Quad.Out' });
    this.scene.tweens.add({ targets: this.img, alpha: 0, delay: 200, duration: 120 });
  }

  update(dt: number) {
    this.t += dt;
    if (this.state === 'collected' || this.state === 'carried') return;
    let x = this.x;
    let y = this.y;
    if (this.anchor) ({ x, y } = this.anchor());
    if (this.state === 'falling') {
      // падает к якорю по дуге, крутясь, и повисает на нём
      this.fallT += dt;
      const k = Math.min(1, this.fallT / 0.9);
      const e = k * k;
      x = this.from.x + (x - this.from.x) * k;
      y = this.from.y + (y - this.from.y) * e - Math.sin(k * Math.PI) * 60;
      this.img.setAngle((1 - k) * 540);
      if (k >= 1) this.state = 'idle';
    } else {
      this.img.setAngle(6 * Math.sin(this.t * 1.8));
    }
    const bob = this.state === 'idle' ? Math.sin(this.t * 2.2) * 5 : 0;
    this.img.setPosition(x, y + bob);
    // под охраной — ореол тусклее, чтобы было видно: сначала разберись со сторожем
    const guarded = this.guarded();
    this.halo.setPosition(x, y + bob).setAlpha((guarded ? 0.25 : 0.55) + 0.12 * Math.sin(this.t * 3)).setScale(5.5 + 0.4 * Math.sin(this.t * 2.5));
    // блик раз в 2 с
    const phase = (this.t % 2) / 2;
    this.shine.setPosition(x, y + bob).setAngle(this.img.angle).setAlpha(phase < 0.12 ? Math.sin((phase / 0.12) * Math.PI) * 0.55 : 0);
  }

  private setVisible(v: boolean) {
    this.img.setVisible(v);
    this.shine.setVisible(v);
    this.halo.setVisible(v);
  }
}
