import { Capacitor } from '@capacitor/core';
import Phaser from 'phaser';
import { feedback } from '../audio/feedback';
import levelsCfg from '../config/levels.json';
import { LEVELS } from '../levels';
import { progress } from '../progress';

/** Кнопка уровня на карте и её звёзды (MAP_UI.md): кнопка — на точку с origin (0.5, 0.75). */
const BTN_SCALE = 0.62;
const STAR_SCALE = 0.36;

/**
 * Карта — первый экран (GAME.md, MAP_UI.md): 9 уровней на тропинке по крышам трёх районов.
 * Открытые — синие со звёздами за лучший результат, закрытые — с замком; следующий
 * непройденный пульсирует ореолом, на нём стоит Август. Тап по открытому — уровень.
 * Карта заполняет экран по высоте; если она шире экрана (16:9), её можно двигать пальцем.
 * В браузере (веб-версия) в углу — кнопка «на весь экран» и обратно, если браузер это умеет
 * (Android, компьютер; на айфоне — нет: там игра на весь экран с экрана «Домой»).
 */
export class MapScene extends Phaser.Scene {
  private leaving = false;
  /** насколько палец сдвинул карту с нажатия: двигал — это не тап по уровню */
  private moved = 0;

  constructor() {
    super('Map');
  }

  create() {
    this.leaving = false;
    const W = this.scale.width;
    const H = this.scale.height;
    const { w: mw, h: mh } = levelsCfg.mapSize;
    // карта заполняет экран; что шире экрана — видно, если подвинуть пальцем (камера)
    const k = Math.max(W / mw, H / mh);
    const mapW = mw * k;
    this.add.image(mapW / 2, H / 2, 'city_map').setScale(k);
    const at = (x: number, y: number) => ({ x: x * k, y: H / 2 + (y - mh / 2) * k });
    const cam = this.cameras.main;
    cam.setBounds(0, 0, mapW, H);

    // текущий — первый открытый и ещё не пройденный готовый уровень (или последний пройденный)
    const ready = levelsCfg.levels.filter((l) => LEVELS[l.id] && progress.unlocked(l.id));
    const current = ready.find((l) => progress.stars(l.id) === undefined) ?? ready[ready.length - 1];

    for (const l of levelsCfg.levels) {
      const p = at(l.x, l.y);
      const open = !!LEVELS[l.id] && progress.unlocked(l.id);
      if (l === current) {
        const glow = this.add.image(p.x, p.y - 30 * k, 'ui_level_glow').setScale(0.9 * k);
        this.tweens.add({ targets: glow, scale: 1.05 * k, alpha: 0.6, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      }
      const btn = this.add.image(p.x, p.y, open ? 'ui_level_open' : 'ui_level_locked').setOrigin(0.5, 0.75).setScale(BTN_SCALE * k);
      if (open) {
        btn.setInteractive({ useHandCursor: true });
        btn.on(Phaser.Input.Events.POINTER_DOWN, () => {
          feedback.button();
          this.tweens.add({ targets: btn, scale: BTN_SCALE * k * 0.88, duration: 70, yoyo: true });
        });
        btn.on(Phaser.Input.Events.POINTER_UP, () => this.moved < 20 && this.play(l.id));
      }
      // звёзды под платформой пройденного уровня
      const stars = progress.stars(l.id);
      if (stars !== undefined) {
        for (let i = 0; i < 3; i++) {
          this.add
            .image(p.x + (i - 1) * 34 * k, p.y + 34 * k, i < stars ? 'ui_star_full' : 'ui_star_empty')
            .setScale(STAR_SCALE * k);
        }
      }
    }

    // Август стоит на текущем уровне и чуть подпрыгивает — «пойдём сюда»
    if (current) {
      const p = at(current.x, current.y);
      const hero = this.add.sprite(p.x, p.y - 95 * k, 'hero', 'idle').setOrigin(0.5, 300 / 320).setScale(0.42 * k);
      this.tweens.add({ targets: hero, y: hero.y - 14 * k, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    }

    // показываем текущий уровень; если карта шире экрана — двигаем её пальцем
    if (current) cam.centerOnX(at(current.x, current.y).x);
    let dragX: number | null = null;
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      dragX = p.x;
      this.moved = 0;
    });
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) => {
      if (dragX === null || !p.isDown) return;
      this.moved += Math.abs(p.x - dragX);
      cam.scrollX -= p.x - dragX;
      dragX = p.x;
    });
    this.input.on(Phaser.Input.Events.POINTER_UP, () => (dragX = null));

    this.addFullscreenButton();
    // повернули телефон или вышли из полноэкранного — карту раскладываем заново под новый размер
    let builtW = W;
    const relayout = (size: Phaser.Structs.Size) => {
      if (this.leaving || Math.abs(size.width - builtW) < 2) return;
      builtW = size.width;
      this.scene.restart();
    };
    this.scale.on(Phaser.Scale.Events.RESIZE, relayout);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, relayout));
    cam.fadeIn(400, 0, 0, 0);
  }

  /** Кнопка «на весь экран» и обратно — только в браузере, где это возможно. */
  private addFullscreenButton() {
    const sm = this.scale;
    if (Capacitor.isNativePlatform() || !sm.fullscreen.available) return;
    makeFullscreenIcons(this);
    const btn = this.add.image(0, 90, 'ui_fullscreen').setScrollFactor(0).setInteractive({ useHandCursor: true });
    // на весь экран — уголки наружу, обратно — уголки внутрь
    const place = () => btn.setX(sm.width - 90).setTexture(sm.isFullscreen ? 'ui_windowed' : 'ui_fullscreen');
    place();
    btn.on(Phaser.Input.Events.POINTER_UP, () => {
      if (this.moved > 20) return;
      feedback.button();
      if (sm.isFullscreen) {
        sm.stopFullscreen();
        return;
      }
      // только из нажатия: браузер разрешает весь экран лишь в ответ на жест
      sm.startFullscreen({ navigationUI: 'hide' });
      (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape').catch(() => {});
    });
    sm.on(Phaser.Scale.Events.ENTER_FULLSCREEN, place);
    sm.on(Phaser.Scale.Events.LEAVE_FULLSCREEN, place);
    sm.on(Phaser.Scale.Events.RESIZE, place);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      sm.off(Phaser.Scale.Events.ENTER_FULLSCREEN, place);
      sm.off(Phaser.Scale.Events.LEAVE_FULLSCREEN, place);
      sm.off(Phaser.Scale.Events.RESIZE, place);
    });
  }

  private play(id: number) {
    if (this.leaving) return;
    this.leaving = true;
    feedback.jump();
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Level', { levelId: id }));
  }
}

/**
 * Значки «на весь экран» (уголки наружу) и «обратно» (уголки внутрь): круглые кнопки
 * в стиле игры. Один раз в текстуры.
 */
function makeFullscreenIcons(scene: Phaser.Scene) {
  if (scene.textures.exists('ui_fullscreen')) return;
  const R = 56;
  for (const [key, inward] of [['ui_fullscreen', false], ['ui_windowed', true]] as const) {
    const g = scene.make.graphics({}, false);
    g.translateCanvas(R + 4, R + 4);
    g.fillStyle(0x1c0f2e, 0.6).fillCircle(0, 0, R);
    g.lineStyle(5, 0xffe7c4, 0.9).strokeCircle(0, 0, R - 3);
    g.lineStyle(8, 0xfff3e0, 1);
    const a = inward ? 12 : 26;
    const l = 14;
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      // угол уголка — снаружи (наружу) или внутри (внутрь), лучи — к соседним сторонам
      const d = inward ? 1 : -1;
      g.beginPath();
      g.moveTo(sx * a, sy * (a + d * l));
      g.lineTo(sx * a, sy * a);
      g.lineTo(sx * (a + d * l), sy * a);
      g.strokePath();
    }
    g.generateTexture(key, (R + 4) * 2, (R + 4) * 2);
    g.destroy();
  }
}
