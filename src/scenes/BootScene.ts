import Phaser from 'phaser';

/** Загрузка: тёмный экран с кольцом прогресса (без текста), затем плавный переход в игру. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    this.drawLoader();

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
    for (const key of ['crow_fly_1', 'crow_fly_2', 'crow_laugh', 'crow_dizzy']) this.load.image(key, `chars/crow2/${key}.png`);
    this.load.json('crow_beak', 'chars/crow2/beak.json');
    for (const key of ['tshirt', 'cap', 'scarf', 'mitten', 'shorts', 'towel', 'pajamas', 'underpants', 'sock']) this.load.image(key, `items/${key}.png`);
    for (const key of ['pause', 'home', 'play', 'restart']) this.load.image(`ui_${key}`, `ui/btn_${key}.png`);
    for (const key of ['star_full', 'star_empty', 'level_open', 'level_locked', 'level_glow']) this.load.image(`ui_${key}`, `ui/${key}.png`);
    this.load.image('city_map', 'map/city_map.jpg');
    this.load.atlas('seagull', 'chars/enemies/seagull_atlas.png', 'chars/enemies/seagull_atlas.json');
    this.load.atlas('pigeon', 'chars/enemies/pigeon_atlas.png', 'chars/enemies/pigeon_atlas.json');
    this.load.atlas('platforms', 'world/platforms.png', 'world/platforms.json');
    this.load.json('platforms_meta', 'world/platforms_meta.json');
    this.load.atlas('hero', 'hero2/hero_atlas.png', 'hero2/hero_atlas.json');
  }

  private drawLoader() {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    const g = this.add.graphics();
    this.load.on(Phaser.Loader.Events.PROGRESS, (p: number) => {
      g.clear();
      g.lineStyle(14, 0x3a2456, 1).strokeCircle(cx, cy, 70);
      g.lineStyle(14, 0xffc871, 1);
      g.beginPath();
      g.arc(cx, cy, 70, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.02, p));
      g.strokePath();
    });
  }

  create() {
    this.cameras.main.fadeOut(220, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Map'));
  }
}
