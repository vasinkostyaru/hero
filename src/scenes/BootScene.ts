import Phaser from 'phaser';
import { WORLD_ITEMS } from '../levels/worlds';

/**
 * Загрузка: сначала одна картинка — заставка (Август и три злодея, art/brand.py), поверх неё
 * кольцо прогресса (без текста), пока грузится всё остальное; затем плавный переход в игру.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    this.load.image('splash', 'assets/ui/splash.jpg');
  }

  create() {
    // заставка «cover»: по высоте экрана, лишнее по бокам обрезается
    const W = this.scale.width;
    const H = this.scale.height;
    const img = this.add.image(W / 2, H / 2, 'splash');
    img.setScale(Math.max(W / img.width, H / img.height)).setAlpha(0);
    this.tweens.add({ targets: img, alpha: 1, duration: 300 });
    this.drawLoader();
    this.queueAssets();
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Map'));
    });
    this.load.start();
  }

  private queueAssets() {
    this.load.setPath('assets/');
    this.load.image('sky', 'bg/sky.png');
    for (const key of ['city_far', 'city_mid']) {
      this.load.image(`${key}_a`, `bg/${key}_a.png`);
      this.load.image(`${key}_b`, `bg/${key}_b.png`);
    }
    for (const key of ['tex_brick', 'tex_climb', 'roof_edge']) this.load.image(key, `world/${key}.png`);
    for (const key of ['water_tower', 'chimney', 'antenna', 'ac_unit', 'crate', 'lamp', 'checkpoint_flag', 'awning']) this.load.image(key, `world/props/${key}.png`);
    for (const key of ['drone_body', 'drone_propeller', 'drone_cocoon']) this.load.image(key, `world/drone/${key}.png`);
    for (const key of ['pigeon_cocoon', 'seagull_cocoon', 'drone2_body', 'drone2_propeller', 'drone2_cocoon']) this.load.image(key, `chars/enemies/${key}.png`);
    // злодеи миров и новые шалуны — атласы с точкой опоры у лап (art/chars2.py)
    for (const key of ['crow', 'bumblebee', 'raccoon']) {
      this.load.atlas(key, `chars/${key}/${key}_atlas.png`, `chars/${key}/${key}_atlas.json`);
      this.load.json(`${key}_meta`, `chars/${key}/${key}_meta.json`);
    }
    for (const key of ['vacuum', 'squirrel']) {
      this.load.atlas(key, `chars/${key}/${key}_atlas.png`, `chars/${key}/${key}_atlas.json`);
      this.load.image(`${key}_cocoon`, `chars/${key}/${key}_cocoon.png`);
    }
    this.load.image('squirrel_acorn', 'chars/squirrel/squirrel_acorn.png');
    for (const key of Object.values(WORLD_ITEMS).flat()) this.load.image(key, `items/${key}.png`);
    for (const key of ['pause', 'home', 'play', 'restart']) this.load.image(`ui_${key}`, `ui/btn_${key}.png`);
    for (const key of ['star_full', 'star_empty', 'level_open', 'level_locked', 'level_glow']) this.load.image(`ui_${key}`, `ui/${key}.png`);
    this.load.image('city_map', 'map/city_map.jpg');
    this.load.atlas('seagull', 'chars/enemies/seagull_atlas.png', 'chars/enemies/seagull_atlas.json');
    this.load.atlas('pigeon', 'chars/enemies/pigeon_atlas.png', 'chars/enemies/pigeon_atlas.json');
    this.load.atlas('platforms', 'world/platforms.png', 'world/platforms.json');
    this.load.json('platforms_meta', 'world/platforms_meta.json');
    this.load.atlas('hero', 'hero2/hero_atlas.png', 'hero2/hero_atlas.json');
  }

  /** Кольцо прогресса внизу по центру, под Августом. */
  private drawLoader() {
    const cx = this.scale.width / 2;
    const cy = this.scale.height - 120;
    const g = this.add.graphics();
    this.load.on(Phaser.Loader.Events.PROGRESS, (p: number) => {
      g.clear();
      g.lineStyle(14, 0x3a2456, 0.8).strokeCircle(cx, cy, 50);
      g.lineStyle(14, 0xffc871, 1);
      g.beginPath();
      g.arc(cx, cy, 50, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.02, p));
      g.strokePath();
    });
  }
}
