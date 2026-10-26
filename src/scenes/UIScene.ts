import Phaser from 'phaser';
import { feedback } from '../audio/feedback';
import { BUTTONS, layoutButtons, type ButtonId, type TouchControls } from '../input/TouchControls';
import { addVignette } from '../world/Vignette';

const ALPHA_IDLE = 0.38;
const ALPHA_DOWN = 0.8;
const IRIS_MS = 380;

/**
 * Экранный слой поверх игры: виньетка, сенсорные кнопки и переход «кругом» (iris wipe).
 * Своя камера — зум и тряска игровой камеры его не задевают.
 */
export class UIScene extends Phaser.Scene {
  private views = new Map<ButtonId, { root: Phaser.GameObjects.Container; down: boolean }>();
  private touch!: TouchControls;
  private iris!: Phaser.GameObjects.Graphics;
  private irisR = 0;
  private openOnStart = false;

  constructor() {
    super('UI');
  }

  init(data: { touch: TouchControls; iris?: boolean }) {
    this.touch = data.touch;
    this.openOnStart = !!data.iris;
  }

  create() {
    const vignette = addVignette(this);
    layoutButtons(this.scale.width);
    for (const b of BUTTONS) this.makeButton(b.id, b.x, b.y, b.r);

    // ширина экрана зависит от телефона и может смениться (поворот, шторка) — перекладываем кнопки
    const onResize = (size: Phaser.Structs.Size) => {
      layoutButtons(size.width);
      for (const b of BUTTONS) this.views.get(b.id)?.root.setPosition(b.x, b.y);
      vignette.setScale(size.width / 1920, size.height / 1080);
      this.drawIris();
    };
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, onResize));

    this.iris = this.add.graphics().setDepth(5000);
    this.irisR = this.maxR;
    if (this.openOnStart) {
      this.irisR = 0;
      this.irisOpen();
    }
    this.drawIris();
  }

  update() {
    for (const [id, v] of this.views) {
      const down = this.touch.pressedNow.has(id);
      if (down === v.down) continue;
      v.down = down;
      this.tweens.killTweensOf(v.root);
      if (down) {
        // нажатие: быстро сжимается и светлеет, лёгкая вибрация
        this.tweens.add({ targets: v.root, scale: 0.9, alpha: ALPHA_DOWN, duration: 60, ease: 'Quad.Out' });
        feedback.button();
      } else {
        // отпустили — пружинит обратно
        this.tweens.add({ targets: v.root, scale: 1, duration: 320, ease: 'Back.Out', easeParams: [3] });
        this.tweens.add({ targets: v.root, alpha: ALPHA_IDLE, duration: 200 });
      }
    }
  }

  /** Круг сжимается в точку, потом onClosed (например, смена сцены). */
  irisClose(onClosed: () => void, cx = this.scale.width / 2, cy = this.scale.height / 2) {
    this.tweens.addCounter({
      from: this.maxR,
      to: 0,
      duration: IRIS_MS,
      ease: 'Cubic.In',
      onUpdate: (tw) => {
        this.irisR = tw.getValue() ?? 0;
        this.drawIris(cx, cy);
      },
      onComplete: onClosed,
    });
  }

  irisOpen(cx = this.scale.width / 2, cy = this.scale.height / 2) {
    this.tweens.addCounter({
      from: 0,
      to: this.maxR,
      duration: IRIS_MS * 1.3,
      ease: 'Cubic.Out',
      onUpdate: (tw) => {
        this.irisR = tw.getValue() ?? 0;
        this.drawIris(cx, cy);
      },
    });
  }

  private get maxR() {
    return Math.hypot(this.scale.width, this.scale.height) / 2 + 10;
  }

  /** Чёрное всё, кроме круга: толстое кольцо снаружи радиуса — без масок, дёшево. */
  private drawIris(cx = this.scale.width / 2, cy = this.scale.height / 2) {
    const g = this.iris;
    g.clear();
    if (this.irisR >= this.maxR - 1) return;
    const W = this.maxR * 2.2;
    g.lineStyle(W, 0x000000, 1).strokeCircle(cx, cy, this.irisR + W / 2);
  }

  /**
   * Кнопка рисуется один раз в текстуру: Graphics Phaser перестраивает каждый кадр,
   * а на телефоне четыре кнопки с кругами и иконками заметно съедали кадры.
   */
  private makeButton(id: ButtonId, x: number, y: number, r: number) {
    const key = `btn_${id}`;
    if (!this.textures.exists(key)) {
      const g = this.make.graphics({}, false);
      g.translateCanvas(r, r);
      g.fillStyle(0x1c0f2e, 0.55).fillCircle(0, 0, r);
      g.lineStyle(5, 0xffe7c4, 0.9).strokeCircle(0, 0, r - 3);
      g.fillStyle(0xfff3e0, 1);
      if (id === 'left' || id === 'right') {
        const d = id === 'left' ? -1 : 1;
        g.fillTriangle(42 * d, 0, -26 * d, -46, -26 * d, 46);
      } else if (id === 'jump') {
        g.fillTriangle(0, -58, -52, 4, 52, 4);
        g.fillRect(-20, 0, 40, 46);
      } else {
        this.webIcon(g);
      }
      g.generateTexture(key, r * 2, r * 2);
      g.destroy();
    }
    const root = this.add.container(x, y, [this.add.image(0, 0, key)]).setAlpha(ALPHA_IDLE);
    this.views.set(id, { root, down: false });
  }

  private webIcon(g: Phaser.GameObjects.Graphics) {
    g.lineStyle(5, 0xfff3e0, 1);
    const spokes = 8;
    const R = 52;
    for (let i = 0; i < spokes; i++) {
      const a = (i / spokes) * Math.PI * 2;
      g.lineBetween(0, 0, Math.cos(a) * R, Math.sin(a) * R);
    }
    for (const k of [0.4, 0.75]) {
      g.beginPath();
      for (let i = 0; i <= spokes; i++) {
        const a = (i / spokes) * Math.PI * 2;
        if (i === 0) g.moveTo(Math.cos(a) * R * k, Math.sin(a) * R * k);
        else g.lineTo(Math.cos(a) * R * k, Math.sin(a) * R * k);
      }
      g.strokePath();
    }
  }
}
