import Phaser from 'phaser';
import { GAME_H, GROUND_Y, WORLD_TOP } from '../config/game';
import { feedback } from '../audio/feedback';
import { startBeat } from '../audio/music';
import { Hero } from '../hero/Hero';
import { HeroController } from '../hero/HeroController';
import { CombinedInput } from '../input/GameInput';
import { KeyboardInput } from '../input/Keyboard';
import { TouchControls } from '../input/TouchControls';
import { LEVELS } from '../levels';
import type { LevelDef } from '../levels/types';
import { progress } from '../progress';
import { Birds } from '../world/Birds';
import { addGoldenMotes } from '../world/Ambient';
import type { Critter, CritterEnv } from '../world/Critter';
import { BOSS_HITS, Crow } from '../world/Crow';
import { Dust, Sparks, makeFxTextures } from '../world/fx';
import { Level } from '../world/Level';
import { Parallax } from '../world/Parallax';
import { Pigeon } from '../world/Pigeon';
import { addColorGrade } from '../world/Vignette';
import { Web } from '../world/Web';
import type { UIScene } from './UIScene';

const LOOK_AHEAD = 160;
/** Скорость, с которой камера догоняет героя (1/с). */
const CAMERA_FOLLOW = 7.7;
/** Камера смотрит чуть выше стоп: на крыше её всё равно держит нижняя граница мира. */
const FOLLOW_OFFSET_Y = 54;
/** Отъезд камеры на стене, после отталкивания от неё, на качелях и высоко над крышей. */
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
/** Победный удар по боссу — время на миг замедляется (GAME.md: блокбастер). */
const SLOWMO_S = 0.6;
const SLOWMO_K = 0.3;
/** Голуби, которых зовёт босс, падают с неба на крышу арены за столько, мс. */
const PIGEON_FALL_MS = 650;
/** Финал: герой подошёл к последнему насесту на столько — сценка (крупный план, петля, улетает). */
const FINALE_X = 900;
/** Уровень с боссом: подошёл к Ворону на столько — он улетает на арену и начинается битва. */
const BOSS_CALL_X = 600;
/** Крупный план Ворона в начале уровня, с. */
const INTRO_S = 2.4;
const INTRO_ZOOM = 1.45;

/**
 * Сцена уровня: фон, уровень из секций (Level), герой, Ворон-проводник, паутина, камера.
 * Начинается с крупного плана Ворона, дальше погоня; предметы улетают в прищепки (UIScene),
 * флаги отмечают чекпоинты. Уровни 1–2: Ворон улетает с последней крыши — экран победы.
 * Уровень 3: на арене битва с Вороном (10 попаданий), он роняет последние вещи —
 * собрал их — победа.
 */
export class LevelScene extends Phaser.Scene {
  private levelId = 1;
  private def: LevelDef = LEVELS[1];
  /** голуби, которых позвал босс */
  private helpers: Critter[] = [];
  private bossStarted = false;
  private bossDown = false;
  private bumpers: Critter[] = [];
  private parallax!: Parallax;
  private birds!: Birds;
  private keys!: KeyboardInput;
  private touch!: TouchControls;
  private crow!: Crow;
  private sparks!: Sparks;
  private web!: Web;
  private bumpCd = 0;
  private zoomHold = 0;
  private camX = 0;
  private camY = 0;
  private lookX = 0;
  private restarted = false;
  /** камера смотрит не на героя (крупный план) */
  private focus: { x: number; y: number; zoom: number } | null = null;
  private slowT = 0;
  private found: boolean[] = [];
  private respawnX = 0;
  private won = false;
  private finale = false;
  hero!: Hero;
  controller!: HeroController;
  level!: Level;

  constructor() {
    super('Level');
  }

  init(data: { restarted?: boolean; levelId?: number }) {
    this.restarted = !!data.restarted;
    this.levelId = data.levelId ?? this.levelId;
    this.def = LEVELS[this.levelId];
  }

  create() {
    makeFxTextures(this);
    this.found = this.def.items.map(() => false);
    this.won = false;
    this.finale = false;
    this.focus = null;
    this.slowT = 0;
    this.bumpCd = 0;
    this.helpers = [];
    this.bossStarted = false;
    this.bossDown = false;
    this.setTimeScale(1);

    // всё светящееся — в одном слое; ореол дают сами ADD-спрайты (без полноэкранного bloom)
    const glowLayer = this.add.layer().setDepth(13);
    const dust = new Dust(this);
    const sparks = new Sparks(this, glowLayer);
    this.sparks = sparks;
    this.keys = new KeyboardInput(this);
    this.touch = new TouchControls(this.input.manager);
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => this.touch.onPointerDown(p));
    const input = new CombinedInput([this.keys, this.touch]);

    this.hero = new Hero(this, 0, GROUND_Y, dust);
    const env: CritterEnv = { sparks, floorAt: (x, y) => this.level.floorAt(x, y), hero: this.hero };
    this.level = new Level(this, this.def, env, glowLayer);
    const W = this.level.width;
    this.parallax = new Parallax(this, W);
    this.birds = new Birds(this);
    addGoldenMotes(this, glowLayer);
    this.physics.world.setBounds(0, WORLD_TOP, W, GAME_H - WORLD_TOP);
    this.controller = new HeroController(this, this.hero, input, this.level, dust);
    this.controller.respawn(this.level.startX, GROUND_Y);
    this.respawnX = this.level.startX;

    // Ворон несёт вещи уровня и роняет каждую в её место; вещи босса — только после победы
    const dropAtPerch = new Set(this.level.perches.map((p) => p.drop));
    const bossItems = new Set(this.def.sections.flatMap((s) => (s.items ?? []).filter((i) => i.boss).map((i) => i.key)));
    const carried = this.level.items.filter((i) => i.state === 'carried' && !bossItems.has(i.key));
    this.crow = new Crow(this, this.level.perches, env, {
      items: carried.map((i) => ({ key: i.key, place: i.place, placeY: i.placeY, atPerch: dropAtPerch.has(i.key) })),
      onDrop: (key, x, y) => this.level.items.find((i) => i.key === key)?.drop(x, y),
      // на уровне с боссом улёт ничего не заканчивает — только победа в битве
      onEscape: () => !this.level.arena && this.win(),
      onBossHit: (left) => (this.scene.get('UI') as UIScene).bossHit(left),
      onSummon: (wave) => this.summonWave(wave),
      onDefeat: (x, y) => this.bossDefeated(x, y, bossItems),
    });
    this.crow.prewarm(this.def.items);
    this.web = new Web(this, sparks, this.level.webTargets, glowLayer);
    this.controller.onShoot = (from, facing) => this.web.fire(from, facing, [...this.level.activeCritters, ...this.helpers, this.crow]);
    // шалуны для толчков — один массив на кадр, без лишнего мусора
    this.bumpers = [];
    this.controller.onLand = (v) => {
      if (v > SHAKE_FALL_V) this.cameras.main.shake(150, 0.0035 * Math.min(2, v / SHAKE_FALL_V));
    };

    const cam = this.cameras.main;
    cam.setBounds(0, WORLD_TOP, W, GAME_H - WORLD_TOP);
    // камеру ведём сами (updateCamera) — плавно по реальному времени, а не на долю за кадр
    this.camX = this.hero.x;
    this.camY = this.hero.y - FOLLOW_OFFSET_Y;
    this.lookX = 0;
    cam.setZoom(1);
    cam.centerOn(this.camX, this.camY);
    addColorGrade(this);

    // экранный слой (кнопки, слоты, пауза, победа) — отдельная сцена поверх, зум камеры его не трогает
    this.scene.launch('UI', { touch: this.touch, iris: this.restarted, items: this.def.items, slots: this.def.slots, levelId: this.levelId });
    // первый запуск — плавно из чёрного; перезапуск — раскрытие кругом (в UIScene)
    if (!this.restarted) cam.fadeIn(700, 0, 0, 0);

    this.startMusic();
    this.intro();
    // R — заново с переходом кругом
    this.input.keyboard?.on('keydown-R', () => this.restartRoom());
  }

  /**
   * Завязка: камера наезжает на Ворона с носком, он хохочет — и улетает вперёд,
   * камера возвращается к Августу, погоня началась.
   */
  private intro() {
    const p = this.level.perches[0];
    if (!p) return;
    this.controller.locked = true;
    this.crow.hold = true;
    this.focus = { x: p.x - 60, y: p.y - 120, zoom: INTRO_ZOOM };
    this.time.delayedCall(700, () => this.crow.laughNow());
    this.time.delayedCall(1500, () => this.crow.laughNow());
    this.time.delayedCall(INTRO_S * 1000, () => {
      this.crow.hold = false;
      this.crow.leave();
      this.focus = null;
      this.controller.locked = false;
    });
  }

  /**
   * Финальная сценка: камера наезжает на Ворона на последней крыше, он хохочет,
   * взлетает с носком, делает над Августом мёртвую петлю и улетает за край → победа.
   */
  private startFinale() {
    this.finale = true;
    this.controller.locked = true;
    const c = this.crow;
    this.focus = { x: (this.hero.x + c.x) / 2, y: Math.min(this.hero.y - 200, c.y + 60), zoom: 1.2 };
    this.time.delayedCall(500, () => c.laughNow());
    this.time.delayedCall(1300, () => c.laughNow());
    this.time.delayedCall(2200, () => {
      this.focus = null;
      c.tease(this.hero.x + 120 * this.hero.facing, this.hero.y - 470);
    });
  }

  /** Герой вошёл на арену: Ворон прилетает на её насест, битва началась. */
  private startBoss() {
    const a = this.level.arena!;
    this.bossStarted = true;
    this.crow.hold = false;
    this.crow.laughNow();
    this.crow.startBoss(a.perches, this.def.items[1]);
    (this.scene.get('UI') as UIScene).showBossBar(BOSS_HITS);
    feedback.caw(0.9);
  }

  /**
   * Ворон зовёт волну шалунов: голуби падают с неба на крышу арены, дроны и чайки
   * появляются из облачка искр. Пока волна не в коконах — Ворон под щитом.
   */
  private summonWave(wave: number) {
    const arena = this.level.arena!;
    for (const def of arena.waves[wave] ?? []) {
      const c = this.level.spawnCritter(def, arena.x);
      if (c instanceof Pigeon) {
        const y = c.root.y;
        c.root.y = WORLD_TOP;
        this.tweens.add({ targets: c.root, y, duration: PIGEON_FALL_MS, ease: 'Bounce.Out', onComplete: () => this.sparks.burst(c.x, GROUND_Y - 10, 8) });
      } else {
        c.root.setScale(0);
        this.tweens.add({ targets: c.root, scale: 1, duration: 420, ease: 'Back.Out', onStart: () => this.sparks.burst(c.x, c.y, 14) });
      }
      this.helpers.push(c);
    }
  }

  /** Ворон повержен: миг замедления, тряска, из клюва выпадают последние вещи. */
  private bossDefeated(x: number, y: number, keys: Set<string>) {
    this.bossDown = true;
    this.slowT = SLOWMO_S;
    this.setTimeScale(SLOWMO_K);
    this.cameras.main.shake(260, 0.006);
    feedback.win();
    let i = 0;
    for (const item of this.level.items) {
      if (!keys.has(item.key)) continue;
      this.time.delayedCall(250 + i * 300, () => item.drop(x, y - 40));
      i++;
    }
  }

  private setTimeScale(k: number) {
    // у Arcade timeScale наоборот: 2 — вдвое медленнее
    this.physics.world.timeScale = 1 / k;
    this.anims.globalTimeScale = k;
    this.tweens.timeScale = k;
    this.time.timeScale = k;
  }

  /** Ворон улетел с последней крыши (или повержен и вещи собраны) — уровень пройден. */
  private win() {
    if (this.won) return;
    this.won = true;
    this.controller.locked = true;
    feedback.win();
    progress.complete(this.levelId, this.found.filter(Boolean).length);
    const boss = this.bossDown;
    this.time.delayedCall(700, () => (this.scene.get('UI') as UIScene).showVictory(this.found, boss));
  }

  /** На карту (домик). */
  goHome() {
    this.setTimeScale(1);
    const ui = this.scene.get('UI') as UIScene;
    ui.irisClose(() => {
      this.scene.stop('UI');
      this.scene.start('Map');
    });
  }

  /** Дальше: следующий готовый уровень, иначе — на карту. */
  nextLevel() {
    if (!LEVELS[this.levelId + 1]) {
      this.goHome();
      return;
    }
    this.setTimeScale(1);
    const ui = this.scene.get('UI') as UIScene;
    ui.irisClose(() => this.scene.restart({ restarted: true, levelId: this.levelId + 1 }));
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
      if (existing?.isPlaying) return; // при перезапуске уровня музыка продолжает играть
      const music = this.sound.add('music', { loop: true, volume: 0 });
      music.play();
      this.tweens.add({ targets: music, volume: MUSIC_VOLUME, duration: 2500 });
    };
    if (this.sound.locked) this.sound.once(Phaser.Sound.Events.UNLOCKED, play);
    else play();
  }

  /** Заново с переходом кругом (кнопки паузы, победы, домик, клавиша R). */
  restartRoom() {
    this.setTimeScale(1);
    const ui = this.scene.get('UI') as UIScene;
    ui.irisClose(() => this.scene.restart({ restarted: true }));
  }

  update(_time: number, deltaMs: number) {
    const real = Math.min(deltaMs / 1000, 1 / 20);
    // замедление считаем по реальному времени, игру двигаем замедленной
    if (this.slowT > 0) {
      this.slowT -= real;
      if (this.slowT <= 0) this.setTimeScale(1);
    }
    const dt = this.slowT > 0 ? real * SLOWMO_K : real;
    if (this.keys.debugPressed) this.hero.debug = !this.hero.debug;

    // ввод → уровень (люльки везут героя) → физика и позиция героя → всё остальное;
    // камера следует уже за итогом
    const body = this.controller.body;
    this.touch.update();
    this.level.update(dt, body, this.cameras.main);
    this.controller.update(dt);
    this.crow.update(dt);
    for (const p of this.helpers) p.update(dt);
    // голуби босса в коконах — Ворона снова можно бить
    if (this.helpers.length && this.helpers.every((p) => !p.alive)) {
      this.crow.unshield();
      this.helpers = this.helpers.filter((p) => p.state !== 'gone');
    }
    const swing = this.controller.swing;
    if (swing) {
      const hand = this.hero.swingHand();
      this.web.rope = { x1: hand.x, y1: hand.y, x2: swing.hook.x, y2: swing.hook.y + 8 };
    } else this.web.rope = null;
    this.web.update(dt);
    this.checkBumps(dt);
    this.checkItems();
    this.checkFlags();
    const arena = this.level.arena;
    if (arena) {
      // подошёл к Ворону на последнем насесте (или сразу на арену) — он улетает на арену, битва
      const near = this.crow.atLastPerch && this.crow.x - this.hero.x < BOSS_CALL_X;
      if (!this.bossStarted && (near || this.hero.x > arena.x + 150)) this.startBoss();
      // вещи босса собраны — победа
      if (this.bossDown && !this.won && this.level.items.every((i) => !this.isBossItem(i.key) || i.state === 'collected')) this.win();
    } else if (!this.finale && this.crow.atLastPerch && this.crow.x - this.hero.x < FINALE_X) this.startFinale();
    // упал ниже крыши мимо тентов (не должно случаться) — мягко к последнему флагу
    if (body.bottom >= GAME_H - 2 && !this.won) this.controller.respawn(this.respawnX, GROUND_Y);
    this.birds.update(dt);
    this.updateCamera(Math.min(deltaMs / 1000, 0.1));
    this.parallax.update(dt);
  }

  private isBossItem(key: string) {
    return this.def.sections.some((s) => s.items?.some((i) => i.key === key && i.boss));
  }

  /** Коснулся предмета — он подпрыгивает и улетает в свою прищепку наверху. */
  private checkItems() {
    const body = this.controller.body;
    for (const item of this.level.items) {
      if (!item.takeable || !item.touches(body)) continue;
      item.collect();
      const i = this.def.items.indexOf(item.key);
      this.found[i] = true;
      this.sparks.burst(item.pos.x, item.pos.y, 16);
      feedback.wallJump();
      const cam = this.cameras.main;
      const v = cam.worldView;
      (this.scene.get('UI') as UIScene).collect(i, (item.pos.x - v.x) * cam.zoom, (item.pos.y - v.y) * cam.zoom);
    }
  }

  /** Пробежал флаг — он взлетает, отсюда и продолжим, если что. */
  private checkFlags() {
    const f = this.level.passFlag(this.hero.x);
    if (!f) return;
    this.respawnX = f.x + 60;
    this.sparks.burst(f.x + 30, GROUND_Y - 300, 20);
    feedback.cocoon();
  }

  /** Шалун коснулся героя — мягкий толчок прочь от него (без урона). */
  private checkBumps(dt: number) {
    this.bumpCd = Math.max(0, this.bumpCd - dt);
    if (this.bumpCd > 0 || this.controller.locked) return;
    const b = this.controller.body;
    // Ворон в пике толкает, как шалун
    if (this.crow.diving) {
      const nx = Phaser.Math.Clamp(this.crow.x, b.left, b.right);
      const ny = Phaser.Math.Clamp(this.crow.y, b.top, b.bottom);
      if (Math.hypot(this.crow.x - nx, this.crow.y - ny) < 60) {
        this.controller.bump(Math.sign(b.center.x - this.crow.x) || -this.hero.facing);
        this.cameras.main.shake(120, 0.003);
        this.bumpCd = BUMP_GRACE;
        return;
      }
    }
    const list = this.bumpers;
    list.length = 0;
    for (const c of this.level.activeCritters) list.push(c);
    for (const c of this.helpers) list.push(c);
    for (const c of list) {
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

  private updateCamera(dt: number) {
    const cam = this.cameras.main;
    const h = this.hero;
    let tx = h.x + this.lookX;
    let ty = h.y - FOLLOW_OFFSET_Y;
    if (this.focus) {
      tx = this.focus.x;
      ty = this.focus.y;
    } else {
      // догоняем героя с небольшим опережением по ходу движения
      this.lookX += (h.facing * LOOK_AHEAD - this.lookX) * (1 - Math.exp(-2.5 * dt));
    }
    // по реальному времени (как lerp 0.12 при 60 к/с, но без рывков на долгих кадрах)
    const k = 1 - Math.exp(-(this.focus ? 3.2 : CAMERA_FOLLOW) * dt);
    this.camX += (tx - this.camX) * k;
    this.camY += (ty - this.camY) * k;
    cam.centerOn(this.camX, this.camY);
    // стена, качели, прыжок от стены или высоко над крышей — плавный отъезд
    const wide =
      h.state === 'wall' ||
      this.controller.swing !== null ||
      (h.state === 'air' && this.controller.fromWall) ||
      h.y < GROUND_Y - HIGH;
    if (wide) this.zoomHold = ZOOM_HOLD;
    else this.zoomHold = Math.max(0, this.zoomHold - dt);
    const target = this.focus ? this.focus.zoom : this.zoomHold > 0 ? ZOOM_OUT : 1;
    // отъезжаем чуть быстрее, возвращаемся мягче
    const rate = this.focus ? 2.4 : target < cam.zoom ? 2.2 : 1.2;
    const z = cam.zoom + (target - cam.zoom) * Math.min(1, dt * rate);
    cam.setZoom(Math.abs(z - target) < 0.001 ? target : z);
  }
}
