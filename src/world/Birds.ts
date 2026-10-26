import Phaser from 'phaser';

const KEY = 'bird';
const SCROLL = 0.18;

/** Изредка вдали пролетает стайка птиц (V-строем, крылья машут). */
export class Birds {
  private birds: { img: Phaser.GameObjects.Image; phase: number }[] = [];
  private vx = 0;
  private timer = 6;

  constructor(private scene: Phaser.Scene) {
    if (!scene.textures.exists(KEY)) {
      const g = scene.make.graphics({}, false);
      g.lineStyle(3, 0x2a1638, 1);
      g.beginPath();
      g.arc(9, 10, 8, Math.PI * 1.1, Math.PI * 1.9);
      g.strokePath();
      g.beginPath();
      g.arc(25, 10, 8, Math.PI * 1.1, Math.PI * 1.9);
      g.strokePath();
      g.generateTexture(KEY, 34, 14);
      g.destroy();
    }
  }

  update(dt: number) {
    this.timer -= dt;
    if (this.timer <= 0 && this.birds.length === 0) this.spawn();
    const cam = this.scene.cameras.main;
    for (const b of this.birds) {
      b.phase += dt * 9;
      b.img.x += this.vx * dt;
      b.img.y += Math.sin(b.phase * 0.2) * 6 * dt;
      b.img.setScale(0.9, 0.55 + 0.45 * Math.abs(Math.sin(b.phase)));
    }
    // улетели за экран — убираем
    const left = cam.scrollX * SCROLL - 200;
    const right = left + cam.width + 400;
    if (this.birds.length && this.birds.every((b) => b.img.x < left || b.img.x > right)) {
      this.birds.forEach((b) => b.img.destroy());
      this.birds = [];
    }
  }

  private spawn() {
    this.timer = 14 + Math.random() * 14;
    const cam = this.scene.cameras.main;
    const dir = Math.random() < 0.5 ? 1 : -1;
    this.vx = dir * (70 + Math.random() * 40);
    const startX = cam.scrollX * SCROLL + (dir > 0 ? -120 : cam.width + 120);
    const y = 140 + Math.random() * 220;
    const n = 5 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const row = Math.ceil(i / 2);
      const side = i % 2 ? 1 : -1;
      const img = this.scene.add
        .image(startX - dir * row * 34, y + side * row * 16, KEY)
        .setScrollFactor(SCROLL, 0.05)
        .setDepth(-95)
        .setAlpha(0.8);
      this.birds.push({ img, phase: Math.random() * 6 });
    }
  }
}
