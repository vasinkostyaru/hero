import Phaser from 'phaser';
import { GAME_H, GROUND_Y, WORLD_TOP, WORLD_W } from '../config/game';
import { feedback } from '../audio/feedback';
import { startBeat } from '../audio/music';
import { Hero } from '../hero/Hero';
import { HeroController } from '../hero/HeroController';
import { CombinedInput } from '../input/GameInput';
import { KeyboardInput } from '../input/Keyboard';
import { TouchControls } from '../input/TouchControls';
import { Birds } from '../world/Birds';
import type { Critter, CritterEnv } from '../world/Critter';
import { Crow } from '../world/Crow';
import { Drone } from '../world/Drone';
import { Flag, Lamp, addChimneySmoke, addGoldenMotes } from '../world/Ambient';
import { Dust, Sparks, makeFxTextures } from '../world/fx';
import { addGround } from '../world/Ground';
import { Parallax } from '../world/Parallax';
import { Pigeon } from '../world/Pigeon';
import { addProps } from '../world/Props';
import { addColorGrade } from '../world/Vignette';
import { LEVEL, Level } from '../world/Level';
import { Seagull } from '../world/Seagull';
import { Web } from '../world/Web';
import type { UIScene } from './UIScene';

const LOOK_AHEAD = 160;
/** Скорость, с которой камера догоняет героя (1/с). */
const CAMERA_FOLLOW = 7.7;
/** Камера смотрит чуть выше стоп: на крыше её всё равно держит нижняя граница мира. */
const FOLLOW_OFFSET_Y = 54;
/** Отъезд камеры на стене, после отталкивания от неё и высоко над крышей. */
const ZOOM_OUT = 0.92;
/** Выше этого над крышей — тоже отъезжаем (обычный прыжок с места до сюда не достаёт). */
const HIGH = 420;
/** Отъехав, держим отъезд хотя бы столько, чтобы камера не «дёргалась» туда-обратно. */
const ZOOM_HOLD = 0.6;
const MUSIC_VOLUME = 0.4;
const MUSIC_URL = 'assets/audio/music.ogg';
/** С какой скорости падения приземление трясёт камеру. */
const SHAKE_FALL_V = 1350;
/** После толчка шалуна столько никто не толкает снова. */
const BUMP_GRACE = 1.2;

export class DemoRoom extends Phaser.Scene {
  private parallax!: Parallax;
  private birds!: Birds;
  private keys!: KeyboardInput;
  private touch!: TouchControls;
  private critters: Critter[] = [];
  private crow!: Crow;
  private sparks!: Sparks;
  private bumpCd = 0;
  private web!: Web;
  private lamp!: Lamp;
  private flag!: Flag;
  private zoomHold = 0;
  private camX = 0;
  private camY = 0;
  private lookX = 0;
  private restarted = false;
  hero!: Hero;
  controller!: HeroController;
  level!: Level;

  constructor() {
    super('DemoRoom');
  }

  init(data: { restarted?: boolean }) {
    this.restarted = !!data.restarted;
  }

  create() {
    makeFxTextures(this);
    this.parallax = new Parallax(this);
    this.birds = new Birds(this);

    const props = addProps(this);
    addGround(this);
    this.physics.world.setBounds(0, WORLD_TOP, WORLD_W, GAME_H - WORLD_TOP);
    this.level = new Level(this);

    // всё светящееся — в одном слое; ореол дают сами ADD-спрайты (без полноэкранного bloom)
    const glowLayer = this.add.layer().setDepth(13);

    this.lamp = new Lamp(this, LEVEL.lampX, GROUND_Y + 4, glowLayer);
    this.flag = new Flag(this, LEVEL.flagX, GROUND_Y + 4);
    for (const { def, img } of props) {
      if (def.key !== 'chimney') continue;
      // дымок из левой трубы на шапке трубы
      addChimneySmoke(this, img.x - img.displayWidth * 0.12, img.y - img.displayHeight * 0.97, def.far);
    }
    addGoldenMotes(this, glowLayer);

    const dust = new Dust(this);
    const sparks = new Sparks(this, glowLayer);
    this.sparks = sparks;
    this.bumpCd = 0;
    this.keys = new KeyboardInput(this);
    this.touch = new TouchControls(this.input.manager);
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => this.touch.onPointerDown(p));
    const input = new CombinedInput([this.keys, this.touch]);
    this.hero = new Hero(this, LEVEL.start.x, LEVEL.start.y, dust);
    this.controller = new HeroController(this, this.hero, input, this.level, dust);

    // шалуны: дроны-мишени, бойкий дрон-2, голуби, чайка и Ворон с носком
    const env: CritterEnv = { sparks, floorAt: (x, y) => this.level.floorAt(x, y), hero: this.hero };
    this.critters = [
      ...LEVEL.drones.map((d) => new Drone(this, d.x, d.y, env)),
      ...LEVEL.drones2.map((d) => new Drone(this, d.x, d.y, env, 'drone2')),
      ...LEVEL.pigeons.map((p) => new Pigeon(this, p.x, p.floorY, p.minX, p.maxX, env)),
      ...LEVEL.seagulls.map((g) => new Seagull(this, g.x, g.y, g.range, env)),
    ];
    this.crow = new Crow(this, LEVEL.crowPerches, env, glowLayer);
    this.web = new Web(this, sparks, this.level.webTargets, glowLayer);
    this.controller.onShoot = (from, facing) => this.web.fire(from, facing, [...this.critters, this.crow]);
    this.controller.onLand = (v) => {
      if (v > SHAKE_FALL_V) this.cameras.main.shake(150, 0.0035 * Math.min(2, v / SHAKE_FALL_V));
    };

    const cam = this.cameras.main;
    cam.setBounds(0, WORLD_TOP, WORLD_W, GAME_H - WORLD_TOP);
    // камеру ведём сами (updateCamera) — плавно по реальному времени, а не на долю за кадр
    this.camX = this.hero.x;
    this.camY = this.hero.y - FOLLOW_OFFSET_Y;
    this.lookX = 0;
    cam.centerOn(this.camX, this.camY);
    addColorGrade(this);

    // экранный слой (кнопки, виньетка) — отдельная сцена поверх, зум камеры его не трогает
    this.scene.launch('UI', { touch: this.touch, iris: this.restarted });
    // первый запуск — плавно из чёрного; перезапуск — раскрытие кругом (в UIScene)
    if (!this.restarted) cam.fadeIn(700, 0, 0, 0);

    this.startMusic();
    // R — перезапуск комнаты с переходом кругом
    this.input.keyboard?.on('keydown-R', () => this.restartRoom());
  }

  /**
   * Музыка: если в public/assets/audio лежит music.ogg — играет он, иначе синтезированный бит.
   * Проверяем, что файл действительно аудио (dev-сервер на отсутствующий файл отдаёт HTML).
   */
  private startMusic() {
    if (this.cache.audio.exists('music')) {
      this.playMusicFile();
      return;
    }
    fetch(MUSIC_URL, { method: 'HEAD' })
      .then((r) => r.ok && (r.headers.get('content-type') ?? '').startsWith('audio'))
      .catch(() => false)
      .then((hasFile) => {
        if (!this.sys.isActive()) return;
        if (!hasFile) {
          // своего трека нет — бит; стартует после первого касания (так требует браузер)
          const begin = () => startBeat(MUSIC_VOLUME);
          this.input.once(Phaser.Input.Events.POINTER_DOWN, begin);
          this.input.keyboard?.once('keydown', begin);
          return;
        }
        this.load.audio('music', MUSIC_URL);
        this.load.once(Phaser.Loader.Events.COMPLETE, () => this.playMusicFile());
        this.load.start();
      });
  }

  private playMusicFile() {
    const play = () => {
      const existing = this.sound.get('music');
      if (existing?.isPlaying) return; // при перезапуске комнаты музыка продолжает играть
      const music = this.sound.add('music', { loop: true, volume: 0 });
      music.play();
      this.tweens.add({ targets: music, volume: MUSIC_VOLUME, duration: 2500 });
    };
    if (this.sound.locked) this.sound.once(Phaser.Sound.Events.UNLOCKED, play);
    else play();
  }

  private restartRoom() {
    const ui = this.scene.get('UI') as UIScene;
    ui.irisClose(() => this.scene.restart({ restarted: true }));
  }

  update(_time: number, deltaMs: number) {
    const dt = Math.min(deltaMs / 1000, 1 / 20);
    if (this.keys.debugPressed) this.hero.debug = !this.hero.debug;

    // ввод → физика и позиция героя (в одном месте) → всё остальное; камера следует уже за итогом
    this.touch.update();
    this.controller.update(dt);
    for (const c of this.critters) c.update(dt);
    this.critters = this.critters.filter((c) => c.state !== 'gone');
    this.crow.update(dt);
    this.checkBumps(dt);
    if (this.crow.takeSock(this.controller.body)) this.celebrate();
    this.web.update(dt);
    this.lamp.update(dt);
    this.flag.update(dt);
    this.birds.update(dt);
    this.updateCamera(Math.min(deltaMs / 1000, 0.1));
    this.parallax.update(dt);
  }

  /** Шалун коснулся героя — мягкий толчок прочь от него (без урона). */
  private checkBumps(dt: number) {
    this.bumpCd = Math.max(0, this.bumpCd - dt);
    if (this.bumpCd > 0) return;
    const b = this.controller.body;
    for (const c of this.critters) {
      const r = c.hurtRadius;
      if (!c.alive || r === 0) continue;
      const nx = Phaser.Math.Clamp(c.x, b.left, b.right);
      const ny = Phaser.Math.Clamp(c.y, b.top, b.bottom);
      if (Math.hypot(c.x - nx, c.y - ny) > r) continue;
      this.controller.bump(Math.sign(b.center.x - c.x) || -this.hero.facing);
      c.bumped();
      this.sparks.burst(nx, ny, 8);
      this.cameras.main.shake(120, 0.003);
      this.bumpCd = BUMP_GRACE;
      return;
    }
  }

  /** Носок найден — победа: «дзынь» вверх, герой подпрыгивает от радости, искры волнами. */
  private celebrate() {
    feedback.win();
    this.hero.kick(0.2);
    for (let i = 0; i < 4; i++) {
      this.time.delayedCall(i * 160, () => {
        const a = Math.random() * Math.PI * 2;
        this.sparks.burst(this.hero.x + Math.cos(a) * 90, this.hero.y - 140 + Math.sin(a) * 60, 22);
      });
    }
  }

  private updateCamera(dt: number) {
    const cam = this.cameras.main;
    const h = this.hero;
    // догоняем героя по реальному времени (как lerp 0.12 при 60 к/с, но без рывков на долгих кадрах),
    // с небольшим опережением по ходу движения
    this.lookX += (h.facing * LOOK_AHEAD - this.lookX) * (1 - Math.exp(-2.5 * dt));
    const k = 1 - Math.exp(-CAMERA_FOLLOW * dt);
    this.camX += (h.x + this.lookX - this.camX) * k;
    this.camY += (h.y - FOLLOW_OFFSET_Y - this.camY) * k;
    cam.centerOn(this.camX, this.camY);
    // стена, прыжок от стены или высоко над крышей — плавный отъезд; обычный прыжок с места не трогает зум
    const wide =
      h.state === 'wall' ||
      (h.state === 'air' && this.controller.fromWall) ||
      h.y < GROUND_Y - HIGH;
    if (wide) this.zoomHold = ZOOM_HOLD;
    else this.zoomHold = Math.max(0, this.zoomHold - dt);
    const target = this.zoomHold > 0 ? ZOOM_OUT : 1;
    // отъезжаем чуть быстрее, возвращаемся мягче
    const rate = target < cam.zoom ? 2.2 : 1.2;
    const z = cam.zoom + (target - cam.zoom) * Math.min(1, dt * rate);
    cam.setZoom(Math.abs(z - target) < 0.001 ? target : z);
  }
}
