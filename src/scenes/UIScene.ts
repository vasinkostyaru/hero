import Phaser from 'phaser';
import { feedback } from '../audio/feedback';
import { BUTTONS, layoutButtons, type ButtonId, type TouchControls } from '../input/TouchControls';
import { ItemSlots, type SlotStyle } from '../ui/ItemSlots';
import { itemScale } from '../world/Item';
import { addVignette } from '../world/Vignette';
import type { LevelScene } from './LevelScene';

const ALPHA_IDLE = 0.38;
const ALPHA_DOWN = 0.8;
const IRIS_MS = 380;
/** Маленькие кнопки в углу: пауза и домик (на карту). */
const CORNER_BTN = 0.62;
/** Затемнение под паузой и победой. */
const DIM = 0x140820;

/**
 * Экранный слой поверх игры: виньетка, сенсорные кнопки, верёвка с прищепками для
 * предметов, кнопки «пауза» и «домик», меню паузы, экран победы и переход «кругом».
 * Своя камера — зум и тряска игровой камеры его не задевают.
 */
export class UIScene extends Phaser.Scene {
  private views = new Map<ButtonId, { root: Phaser.GameObjects.Container; down: boolean }>();
  private touch!: TouchControls;
  private iris!: Phaser.GameObjects.Graphics;
  private irisR = 0;
  private openOnStart = false;
  private itemKeys: string[] = [];
  private slotStyle: SlotStyle = 'rope';
  private hud!: ItemSlots;
  private victory: ItemSlots | null = null;
  private overlay: Phaser.GameObjects.Container | null = null;
  private corner!: Phaser.GameObjects.Container;

  constructor() {
    super('UI');
  }

  init(data: { touch: TouchControls; iris?: boolean; items: string[]; slots: SlotStyle }) {
    this.touch = data.touch;
    this.openOnStart = !!data.iris;
    this.itemKeys = data.items;
    this.slotStyle = data.slots;
    this.victory = null;
    this.overlay = null;
  }

  private get game_() {
    return this.scene.get('Level') as LevelScene;
  }

  create() {
    const vignette = addVignette(this);
    layoutButtons(this.scale.width);
    for (const b of BUTTONS) this.makeButton(b.id, b.x, b.y, b.r);

    // сверху по центру — верёвка с прищепками: пустые слоты — едва видные силуэты-подсказки
    this.hud = new ItemSlots(this, this.scale.width / 2, 44, this.itemKeys, this.slotStyle, 0.62, 64, 0.3);
    // в углу — пауза и домик
    this.corner = this.add.container(0, 0, [
      this.iconButton('ui_pause', 86, 86, CORNER_BTN, () => this.showPause()),
      this.iconButton('ui_home', 196, 86, CORNER_BTN, () => this.game_.restartRoom()),
    ]);

    // ширина экрана зависит от телефона и может смениться (поворот, шторка) — перекладываем кнопки
    const onResize = (size: Phaser.Structs.Size) => {
      layoutButtons(size.width);
      for (const b of BUTTONS) this.views.get(b.id)?.root.setPosition(b.x, b.y);
      vignette.setScale(size.width / 1920, size.height / 1080);
      this.hud.root.setX(size.width / 2);
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

  update(_t: number, deltaMs: number) {
    const dt = deltaMs / 1000;
    this.hud.update(dt);
    this.victory?.update(dt);
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

  /** Предмет подобран в (sx, sy) на экране — копия летит по дуге в свою прищепку. */
  collect(i: number, sx: number, sy: number) {
    const key = this.itemKeys[i];
    const img = this.add.image(sx, sy, key).setScale(itemScale(this, key, 92)).setDepth(100);
    const to = this.hud.slotPos(i);
    const ctrl = { x: (sx + to.x) / 2, y: Math.min(sy, to.y) - 220 };
    const s0 = img.scale;
    const s1 = itemScale(this, key, 64) * this.hud.root.scale;
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 750,
      ease: 'Sine.InOut',
      onUpdate: (tw) => {
        const k = tw.getValue() ?? 0;
        const a = (1 - k) * (1 - k);
        const b = 2 * (1 - k) * k;
        const c = k * k;
        img.setPosition(a * sx + b * ctrl.x + c * to.x, a * sy + b * ctrl.y + c * to.y);
        img.setAngle(k * 720).setScale(s0 + (s1 - s0) * k);
      },
      onComplete: () => {
        img.destroy();
        this.hud.fill(i);
        this.burst(to.x, to.y, 14);
        feedback.cocoon();
      },
    });
  }

  /** Пауза: игра замирает и размывается, три большие кнопки — продолжить, заново, на карту. */
  private showPause() {
    if (this.overlay) return;
    const demo = this.game_;
    this.scene.pause('Level');
    const blur = demo.cameras.main.postFX.addBlur(0, 2, 2, 1.2);
    const W = this.scale.width;
    const H = this.scale.height;
    const close = () => {
      demo.cameras.main.postFX.remove(blur);
      this.overlay?.destroy();
      this.overlay = null;
      this.setControlsVisible(true);
    };
    this.overlay = this.add.container(0, 0, [
      this.add.rectangle(0, 0, W, H, DIM, 0.55).setOrigin(0, 0).setInteractive(),
      this.iconButton('ui_play', W / 2 - 260, H / 2, 1.25, () => {
        close();
        this.scene.resume('Level');
      }),
      this.iconButton('ui_restart', W / 2, H / 2, 1.25, () => {
        close();
        this.scene.resume('Level');
        demo.restartRoom();
      }),
      this.iconButton('ui_home', W / 2 + 260, H / 2, 1.25, () => {
        // карты пока нет — домик тоже начинает уровень заново
        close();
        this.scene.resume('Level');
        demo.restartRoom();
      }),
    ]).setDepth(1000);
    this.setControlsVisible(false);
  }

  /**
   * Победа: верёвка с тремя предметами (найденные — в цвете, остальные — силуэтом),
   * звёзды падают по одной, Август машет вслед Ворону; кнопки «дальше» и «ещё раз».
   */
  showVictory(found: boolean[]) {
    const W = this.scale.width;
    const H = this.scale.height;
    this.setControlsVisible(false);
    this.hud.root.setVisible(false);
    const dim = this.add.rectangle(0, 0, W, H, DIM, 0).setOrigin(0, 0).setInteractive();
    this.tweens.add({ targets: dim, fillAlpha: 0.72, duration: 500 });
    const slots = new ItemSlots(this, W / 2, H * 0.42, this.itemKeys, this.slotStyle, 1.7, 190);
    found.forEach((f, i) => f && slots.fill(i));
    slots.root.setAlpha(0);
    this.tweens.add({ targets: slots.root, alpha: 1, y: { from: H * 0.42 - 60, to: H * 0.42 }, duration: 600, delay: 200, ease: 'Back.Out' });
    this.victory = slots;

    // звёзды: по одной за найденный предмет, падают сверху с отскоком
    const n = found.filter(Boolean).length;
    const stars = [0, 1, 2].map((i) => {
      const star = this.add.image(W / 2 + (i - 1) * 170, -120, i < n ? 'ui_star_full' : 'ui_star_empty').setScale(i === 1 ? 1.9 : 1.6);
      this.tweens.add({
        targets: star,
        y: i === 1 ? 150 : 180,
        duration: 600,
        delay: 700 + i * 380,
        ease: 'Bounce.Out',
        onComplete: () => {
          if (i < n) {
            this.burst(star.x, star.y, 18);
            feedback.cocoon();
          }
        },
      });
      return star;
    });

    // Август машет вслед Ворону: попеременно стоит и тянет руку
    const hero = this.add.sprite(W * 0.18, H - 120, 'hero', 'idle').setOrigin(0.5, 300 / 320).setScale(1.4);
    this.time.addEvent({ delay: 380, loop: true, callback: () => hero.setFrame(hero.frame.name === 'idle' ? 'shoot' : 'idle') });
    // а Ворон с носком в клюве улетает в правый верхний угол, машет крыльями
    const crowImg = this.add.image(0, 0, 'crow_fly_1').setScale(0.3);
    const sock = this.add.image(46, 12, 'sock').setScale(0.24).setOrigin(0.5, 0.15);
    const crow = this.add.container(W * 0.72, H * 0.2, [crowImg, sock]);
    this.time.addEvent({ delay: 125, loop: true, callback: () => crowImg.setTexture(crowImg.texture.key === 'crow_fly_1' ? 'crow_fly_2' : 'crow_fly_1') });
    this.tweens.add({ targets: crow, x: W + 200, y: -150, duration: 3200, ease: 'Sine.In' });

    const buttons = [
      this.iconButton('ui_restart', W / 2 - 150, H - 140, 1.15, () => this.game_.restartRoom()),
      // уровней дальше и карты пока нет — «дальше» тоже начинает уровень 1
      this.iconButton('ui_play', W / 2 + 150, H - 140, 1.35, () => this.game_.restartRoom()),
    ];
    for (const b of buttons) {
      b.setAlpha(0);
      this.tweens.add({ targets: b, alpha: 1, duration: 300, delay: 1900 });
    }
    this.overlay = this.add.container(0, 0, [dim, slots.root, ...stars, hero, crow, ...buttons]).setDepth(1000);
  }

  /** Круглая кнопка-иконка: при нажатии сжимается, отпустили — пружинит и срабатывает. */
  private iconButton(key: string, x: number, y: number, scale: number, onTap: () => void) {
    const img = this.add.image(x, y, key).setScale(scale).setInteractive({ useHandCursor: true });
    img.on(Phaser.Input.Events.POINTER_DOWN, () => {
      feedback.button();
      this.tweens.add({ targets: img, scale: scale * 0.88, duration: 60 });
    });
    img.on(Phaser.Input.Events.POINTER_UP, () => {
      this.tweens.add({ targets: img, scale, duration: 220, ease: 'Back.Out' });
      onTap();
    });
    img.on(Phaser.Input.Events.POINTER_OUT, () => this.tweens.add({ targets: img, scale, duration: 120 }));
    return img;
  }

  private setControlsVisible(v: boolean) {
    for (const view of this.views.values()) view.root.setVisible(v);
    this.corner.setVisible(v);
  }

  /** Искорки на экране (glow — текстура игровой сцены, текстуры общие). */
  private burst(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = 40 + Math.random() * 90;
      const p = this.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(Phaser.Utils.Array.GetRandom([0xffffff, 0xfff1a8, 0xbffcf4])).setScale(0.7).setDepth(1100);
      this.tweens.add({ targets: p, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, scale: 0, alpha: 0, duration: 420 + Math.random() * 300, ease: 'Cubic.Out', onComplete: () => p.destroy() });
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
