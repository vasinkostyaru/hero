import Phaser from 'phaser';
import { feedback } from '../audio/feedback';
import type { CritterEnv, WebTarget } from './Critter';
import type { Perch } from './Level';
import { scaledTexture } from './textures';

/** Вещь в лапах/клюве — по большей стороне (как на art/crow_items_preview.png, ~треть злодея). */
const CARRY_SIZE = 70;
/** Босс (уровень 3 мира): столько попаданий, чтобы он выронил последние вещи. */
export const BOSS_HITS = 10;
/** После стольких попаданий зовёт новую волну банды. */
const SUMMON_AT = [0, 3, 6];
/** После попадания столько неуязвим: очередью паутины босса не взять. */
const HURT_CD = 1.1;
/** Без щита пикирует на героя: пауза на насесте между пике, с; к концу битвы — всё чаще. */
const DIVE_PAUSE: [number, number] = [1.6, 2.4];
/** Банда в коконах, щит лопнул — почти сразу бросается на героя. */
const AFTER_SHIELD = 0.7;
/** Перед пике столько трясётся и краснеет — видно, что сейчас бросится. */
const DIVE_WARN = 0.45;
const DIVE_T = 1.3;
/** Герой подошёл ближе — злодей перелетает на другое место. */
const FLEE_X = 320;
const FLEE_Y = 300;
const FLY_SPEED = 650;
/** Дразнится, только когда герой хотя бы примерно рядом. */
const TEASE_DIST = 1300;
const GRAVITY = 1900;

export type VillainKind = 'crow' | 'bumblebee' | 'raccoon';

/**
 * Чем злодеи отличаются друг от друга. Кадры — в атласе chars/<kind> (art/chars2.py):
 * опора каждого кадра — у лап (корень злодея), в <kind>_meta.json — где висит вещь (hold)
 * и где голова у поверженного (head).
 */
interface VillainLook {
  /** цикл полёта и его частота */
  fly: string[];
  flyFps: number;
  /** пока набирает высоту — этот кадр (енот подпрыгивает с зонтом) */
  rise?: string;
  /** на насесте висит в воздухе, машет крыльями (шмель); хохочет — кадр laugh */
  hover?: boolean;
  /** цвет щита, пока банда не в коконах */
  shield: number;
  voice: (pitch?: number) => void;
}

const LOOKS: Record<VillainKind, VillainLook> = {
  // Ворон-хулиган: 2 взмаха ~8 к/с (CROW2.md)
  crow: { fly: ['fly_1', 'fly_2'], flyFps: 8, shield: 0x5ff5e6, voice: (p) => feedback.caw(p) },
  // Робо-Шмель: жужжит, крылья мелькают быстро, на насесте висит в воздухе
  bumblebee: { fly: ['fly_1', 'fly_2', 'fly_3', 'fly_4'], flyFps: 18, hover: true, shield: 0xffd84a, voice: (p) => feedback.buzz(p) },
  // Енот-Бандит: подпрыгивает с зонтом и планирует, болтая лапами
  raccoon: { fly: ['fly_1', 'fly_2', 'fly_3', 'fly_2'], flyFps: 6, rise: 'jump', shield: 0xff8a7a, voice: (p) => feedback.giggle(p) },
};

type VillainState = 'perch' | 'fly' | 'dive' | 'tease' | 'escape' | 'gone' | 'dizzy';
/** Уровень: дразнится и ведёт вперёд, в конце улетает. Босс: битва на арене, 10 попаданий. */
export interface VillainOptions {
  /** вещь, которую несёт, когда вещей уровня не осталось (носок, дракон, торт) */
  special: string;
  /** босс: попал — осталось столько попаданий */
  onBossHit?: (left: number) => void;
  /** босс зовёт волну шалунов (номер волны); пока они не в коконах — сам под щитом (unshield) */
  onSummon?: (wave: number) => void;
  /** босс повержен: упал в (x, y) — выронил последние вещи */
  onDefeat?: (x: number, y: number) => void;
  /** вещи уровня по порядку: несёт следующую, роняет над её местом (или улетая с насеста) */
  items?: CarriedItem[];
  /** уронил вещь в точке (x, y) */
  onDrop?: (key: string, x: number, y: number) => void;
  /** улетел с последнего насеста за край — уровень пройден */
  onEscape?: () => void;
}
/** На уровне: подошёл на столько (или обогнал) — улетает на насест следующей зоны. */
const LEAD_X = 380;

/** Вещь, которую злодей несёт: place — x её места на уровне; atPerch — роняет, улетая с этого насеста. */
export interface CarriedItem {
  key: string;
  place: number;
  /** высота места: злодей роняет вещь, зависнув над ней (вещь падает только вниз) */
  placeY: number;
  atPerch?: boolean;
}
/** Зависает над местом вещи на столько выше, чтобы уронить её. */
const DROP_ABOVE = 190;
/** …но не выше этого (лапы): с крыши верх экрана — y ≈ 0, злодей должен быть в кадре. */
const HOVER_MIN_Y = 170;

interface Point {
  x: number;
  y: number;
}

/**
 * Злодей мира (GAME.md): Ворон-хулиган, Робо-Шмель или Енот-Бандит — поведение общее,
 * отличаются кадры, голос и то, как летают (LOOKS). Сидит на насесте и хохочет; в полёте
 * несёт следующую вещь уровня — пролетая над её местом, роняет, и вещь, кружась, падает туда;
 * вещей не осталось — несёт особую вещь мира (носок, дракон, торт).
 * На уровне: насест в каждой зоне, подошёл — улетает только вперёд; попал паутиной —
 * сердится и улетает раньше; с последнего насеста улетает за край — уровень пройден.
 * Босс (уровень 3 мира): битва на арене, 10 попаданий в три фазы — перелетает между насестами;
 * зовёт банду (пока она не в коконах, неуязвим); пикирует на героя. Потом падает без сил
 * (звёздочки кружат) и роняет вещи. Корень — точка у лап; прицел — центр тела.
 */
export class Villain implements WebTarget {
  readonly root: Phaser.GameObjects.Container;
  private look: VillainLook;
  private img: Phaser.GameObjects.Sprite;
  private carry: Phaser.GameObjects.Image;
  private carried: CarriedItem[];
  private holdAt: Point;
  private head: Point;
  private stars: Phaser.GameObjects.Graphics;

  private state: VillainState = 'perch';
  private boss = false;
  /** зовёт банду — пока она не в коконах, паутина его не берёт */
  private shield = false;
  /** после попадания — неуязвим ещё столько */
  private hurtCd = 0;
  private shieldG: Phaser.GameObjects.Graphics;
  private diveIn = 0;
  private perch = 0;
  private hits = 0;
  private t = 0;
  private stateT = 0;
  private facing = 1;
  private laughT = -1;
  private nextLaugh = 1.5;
  private from: Point = { x: 0, y: 0 };
  private ctrl: Point = { x: 0, y: 0 };
  private to: Point = { x: 0, y: 0 };
  private flyDur = 1;
  private vy = 0;
  private bounces = 0;
  private sq = 0;
  private sqVel = 0;
  /** пока true — сидит и не улетает (крупный план в начале уровня) */
  hold = false;

  constructor(
    private scene: Phaser.Scene,
    readonly kind: VillainKind,
    private perches: Perch[],
    private env: CritterEnv,
    private opts: VillainOptions,
  ) {
    const p = perches[0];
    this.look = LOOKS[kind];
    const meta = scene.cache.json.get(`${kind}_meta`) as { hold: Point; head: Point };
    this.holdAt = meta.hold;
    this.head = meta.head;
    this.carried = [...(opts.items ?? [])].sort((a, b) => a.place - b.place);
    // опора кадров атласа — у лап: отражение (flipX) зеркалит вокруг неё
    this.img = scene.add.sprite(0, 0, kind, 'laugh');
    // вещь — только в полёте: на насесте он хохочет
    this.carry = scene.add.image(this.holdAt.x, this.holdAt.y, opts.special).setOrigin(0.5, 0.15).setVisible(false);
    this.stars = scene.add.graphics();
    this.shieldG = scene.add.graphics();
    this.root = scene.add.container(p.x, p.y, [this.img, this.carry, this.stars, this.shieldG]).setDepth(8);
    this.setCarry();
  }

  /**
   * Уменьшенные копии вещей — заранее, при загрузке уровня: созданная на лету
   * (новая вещь в лапах) — это canvas и загрузка в видеокарту, рывок кадра.
   */
  prewarm(itemKeys: string[]) {
    for (const key of [...itemKeys, this.opts.special]) {
      const src = this.scene.textures.get(key).getSourceImage();
      scaledTexture(this.scene, key, CARRY_SIZE / Math.max(src.width, src.height));
    }
  }

  /** В лапах — следующая вещь, а когда вещей не осталось — особая вещь мира (или что дали боссу). */
  private setCarry(force?: string) {
    const key = force ?? this.carried[0]?.key ?? this.opts.special;
    const src = this.scene.textures.get(key).getSourceImage();
    this.carry.setTexture(scaledTexture(this.scene, key, CARRY_SIZE / Math.max(src.width, src.height)));
  }

  /** Роняет вещь: она падает в своё место (Item.drop), в лапах — следующая. */
  private dropCarried() {
    const it = this.carried.shift();
    if (!it) return;
    const m = this.carry.getWorldTransformMatrix();
    this.opts.onDrop?.(it.key, m.tx, m.ty + 20);
    this.setCarry();
    this.kick(0.1);
    this.look.voice(1.2);
  }

  /** Сидит на последнем насесте уровня — ждёт финальной сценки (сам не улетает). */
  get atLastPerch() {
    return !this.boss && this.state === 'perch' && this.perch === this.perches.length - 1;
  }

  /** Финальная сценка: взлетает с особой вещью, делает дразнящую мёртвую петлю над (x, y) и улетает за край. */
  tease(x: number, y: number) {
    this.startFlight({ x, y }, { x, y }, 1.4);
    this.state = 'tease';
  }

  /** Сразу улететь вперёд (после крупного плана в начале уровня). */
  leave() {
    if (this.state === 'perch') this.flee();
  }

  /**
   * Кадр полёта и вещь в лапах. Опора кадров — у лап, поэтому отражение просто зеркалит
   * вокруг корня; вещь — в точке hold, качается маятником в такт.
   */
  private flap(rising = false) {
    const L = this.look;
    const i = Math.floor(this.t * L.flyFps) % L.fly.length;
    const frame = rising && L.rise ? L.rise : L.fly[i];
    this.img.setFrame(frame).setFlipX(this.facing < 0);
    // шмель жужжит — мелкая дрожь; остальные чуть поднимаются на взмахе
    const bob = this.kind === 'bumblebee' ? Math.sin(this.t * 40) * 1.5 : i % 2 === 0 ? 0 : -3;
    this.img.setY(bob);
    this.carry
      .setPosition(this.holdAt.x * this.facing, this.holdAt.y + bob)
      .setFlipX(this.facing < 0)
      .setAngle(10 * Math.sin(this.t * Math.min(L.flyFps, 8) * Math.PI));
  }

  get alive() {
    if (!this.boss) return this.state === 'perch' || this.state === 'fly';
    // босса ловим, только когда сидит или пикирует, без щита и не сразу после попадания
    return (this.state === 'perch' || this.state === 'dive') && !this.shield && this.hurtCd <= 0;
  }

  /** Пикирует на героя — касание толкает (как шалун). */
  get diving() {
    return this.state === 'dive';
  }

  /**
   * Битва с боссом: прилетает на арену (насесты perches), в лапах — carryKey.
   * Дальше — фазы по попаданиям (hit).
   */
  startBoss(perches: Perch[], carryKey: string) {
    this.boss = true;
    this.perches = perches;
    this.hits = 0;
    this.setCarry(carryKey);
    this.flyTo(0, perches[0]);
    this.summon(0);
  }

  /** Зовёт волну шалунов и прячется под щит, пока их не переловят. */
  private summon(wave: number) {
    this.shield = true;
    this.img.clearTint();
    this.opts.onSummon?.(wave);
    if (this.state === 'perch') this.laughNow();
  }

  /** Волна, которую он позвал, в коконах — щит лопается, снова можно попасть. */
  unshield() {
    if (!this.shield) return;
    this.shield = false;
    this.env.sparks.burst(this.x, this.y, 24);
    this.kick(-0.2);
    this.diveIn = AFTER_SHIELD;
    this.look.voice(0.8);
  }

  /** Сразу расхохотаться (крупный план). */
  laughNow() {
    this.laughT = 0;
    this.nextLaugh = 1.2;
    this.kick(0.14);
    this.look.voice();
  }
  get x() { return this.root.x; }
  get y() { return this.root.y - 100; }

  hit() {
    if (!this.alive) return;
    this.hits++;
    this.kick(-0.18);
    this.flashWhite();
    if (!this.boss) {
      // на уровне не падает — сердится и улетает раньше; с последнего насеста не улетает:
      // там его ждёт финальная сценка или битва
      this.look.voice(0.85);
      if (this.state === 'perch' && !this.atLastPerch) this.flee();
      return;
    }
    this.opts.onBossHit?.(BOSS_HITS - this.hits);
    if (this.hits >= BOSS_HITS) {
      this.toDizzy();
      return;
    }
    this.look.voice(0.85);
    this.hurtCd = HURT_CD;
    const wave = SUMMON_AT.indexOf(this.hits);
    if (wave > 0) {
      // новая волна: зовёт банду и хохочет под щитом
      this.summon(wave);
      return;
    }
    // обиделся — улетает на другой насест (в полёте или пике просто летит дальше)
    if (this.state === 'perch') this.flee();
  }

  /** Фаза 3: пикирует по дуге через героя и садится на другой насест. */
  private dive() {
    const hero = this.env.hero;
    const cur = { x: this.root.x, y: this.root.y };
    const others = this.perches.map((p, i) => ({ p, i })).filter(({ i }) => i !== this.perch);
    // садится на насест по ту сторону от героя
    const far = others.sort((a, b) => Math.abs(b.p.x - cur.x) - Math.abs(a.p.x - cur.x))[0];
    this.perch = far.i;
    const h = { x: hero.x, y: hero.y - 60 };
    this.startFlight(far.p, far.p, DIVE_T);
    // дуга через героя: в середине (s = 0.5) кривая Безье проходит ровно через h
    this.ctrl = { x: 2 * h.x - (cur.x + far.p.x) / 2, y: 2 * h.y - (cur.y + far.p.y) / 2 };
    this.state = 'dive';
    feedback.squawk();
  }

  update(dt: number) {
    this.t += dt;
    this.stateT += dt;
    this.hurtCd = Math.max(0, this.hurtCd - dt);
    this.drawShield();
    switch (this.state) {
      case 'perch':
        this.perched(dt);
        break;
      case 'fly':
      case 'dive':
      case 'tease':
      case 'escape':
        this.flying(dt);
        break;
      case 'dizzy':
        this.lying(dt);
        break;
    }

    // пружина squash & stretch (как у героя), origin у лап
    this.sqVel += (-480 * this.sq - 15 * this.sqVel) * dt;
    this.sq += this.sqVel * dt;
    this.root.setScale(1 - this.sq * 0.7, 1 + this.sq);
  }

  private perched(dt: number) {
    const hero = this.env.hero;
    const dx = hero.x - this.root.x;
    this.facing = Math.sign(dx) || this.facing;
    const img = this.img;

    // хохочет: трясётся и подпрыгивает
    const near = Math.abs(dx) < TEASE_DIST;
    if (this.laughT >= 0) {
      this.laughT += dt;
      img.setFrame('laugh')
        .setRotation(Math.sin(this.laughT * 28) * 0.06)
        .setScale(1, 1 + 0.05 * Math.abs(Math.sin(this.laughT * 20)));
      if (this.laughT > 0.9) this.laughT = -1;
    } else {
      // шмель висит в воздухе и машет крыльями, остальные просто дышат
      if (this.look.hover) this.flap();
      else img.setFrame('laugh');
      img.setRotation(0).setScale(1, 1 + 0.012 * Math.sin(this.t * 3));
      this.carry.setVisible(false);
      this.nextLaugh -= dt;
      if (this.nextLaugh <= 0 && near) {
        this.laughT = 0;
        this.nextLaugh = Phaser.Math.FloatBetween(2.2, 3.5);
        this.look.voice();
      }
    }
    img.setFlipX(this.facing < 0);
    if (this.look.hover) img.setY(Math.sin(this.t * 2.4) * 10);

    if (this.hold || this.atLastPerch) return;
    if (this.boss && !this.shield) {
      // банда в коконах: посидел — краснеет и трясётся — пикирует на героя
      const was = this.diveIn;
      this.diveIn -= dt;
      if (this.diveIn < DIVE_WARN) {
        if (was >= DIVE_WARN) feedback.squawk();
        img.setRotation(Math.sin(this.t * 60) * 0.08);
        if (Math.sin(this.t * 30) > 0) img.setTint(0xff9a8a);
        else img.clearTint();
      }
      if (this.diveIn <= 0) {
        img.clearTint();
        // чем ближе к победе, тем чаще
        const k = 1 - 0.4 * (this.hits / BOSS_HITS);
        this.diveIn = Phaser.Math.FloatBetween(...DIVE_PAUSE) * k;
        this.dive();
        return;
      }
    }
    if (this.boss ? Math.abs(dx) < FLEE_X && Math.abs(hero.y - this.root.y) < FLEE_Y : dx > -LEAD_X) this.flee();
  }

  /** Улетает: на уровне — на насест следующей зоны (или за край), у босса — на другой насест. */
  private flee() {
    const hero = this.env.hero;
    const cur = { x: this.root.x, y: this.root.y };
    const here = this.perches[this.perch];
    this.showFlight();
    // эту вещь роняет, улетая с этого насеста, — у героя на глазах
    if (here.drop && this.carried[0]?.key === here.drop) this.dropCarried();
    here.drop = undefined;
    if (!this.boss) {
      if (this.perch + 1 >= this.perches.length) {
        this.escape();
        return;
      }
      this.flyTo(this.perch + 1, this.perches[this.perch + 1]);
      return;
    }
    const others = this.perches.map((p, i) => ({ p, i })).filter(({ i }) => i !== this.perch);
    const safe = others.filter(({ p }) => Math.abs(p.x - hero.x) > 600);
    const pool = safe.length ? safe : others;
    pool.sort((a, b) => Math.hypot(a.p.x - cur.x, a.p.y - cur.y) - Math.hypot(b.p.x - cur.x, b.p.y - cur.y));
    this.flyTo(pool[0].i, pool[0].p);
  }

  /** Улетает вверх-вправо за край экрана — дальше уровень заканчивается. */
  private escape() {
    const cur = { x: this.root.x, y: this.root.y };
    this.startFlight(cur, { x: cur.x + 1700, y: cur.y - 900 }, 2.2);
    this.state = 'escape';
  }

  /**
   * Перелёт на насест i. Если по дороге место следующей вещи — сначала подлетает
   * и зависает над ним, роняет вещь вниз и только потом летит дальше (after).
   */
  private flyTo(i: number, p: Point) {
    this.perch = i;
    const cur = { x: this.root.x, y: this.root.y };
    const next = this.carried[0];
    if (next && !next.atPerch && (next.place - cur.x) * (p.x - cur.x) > 0 && Math.abs(next.place - cur.x) < Math.abs(p.x - cur.x)) {
      // вещь (hold.y над лапами) остаётся выше места — падает только вниз
      const over = { x: next.place, y: Math.min(Math.max(next.placeY - DROP_ABOVE, HOVER_MIN_Y), next.placeY - this.holdAt.y - 30) };
      this.after = { i, p };
      this.startFlight(over, over, Math.max(0.7, Math.hypot(over.x - cur.x, over.y - cur.y) / FLY_SPEED));
      return;
    }
    this.startFlight(p, p, Math.max(0.9, Math.hypot(p.x - cur.x, p.y - cur.y) / FLY_SPEED));
  }

  /** куда лететь, уронив вещь над её местом */
  private after: { i: number; p: Point } | null = null;

  /** Перелёт по дуге вверх. */
  private startFlight(to: Point, end: Point, dur: number) {
    const cur = { x: this.root.x, y: this.root.y };
    this.from = cur;
    this.to = { ...end };
    this.ctrl = { x: (cur.x + to.x) / 2, y: Math.min(cur.y, to.y) - 260 };
    this.flyDur = dur;
    this.state = 'fly';
    this.stateT = 0;
    this.laughT = -1;
    this.facing = Math.sign(end.x - cur.x) || this.facing;
    this.showFlight();
    this.kick(0.12);
    this.look.voice(1.1);
  }

  private showFlight() {
    this.img.setRotation(0).setScale(1).clearTint();
    this.carry.setVisible(true);
    this.flap();
  }

  private flying(_dt: number) {
    const u = Math.min(1, this.stateT / this.flyDur);
    const s = 0.5 - 0.5 * Math.cos(Math.PI * u);
    const a = (1 - s) * (1 - s);
    const b = 2 * (1 - s) * s;
    const c = s * s;
    const prevY = this.root.y;
    this.root.x = a * this.from.x + b * this.ctrl.x + c * this.to.x;
    this.root.y = a * this.from.y + b * this.ctrl.y + c * this.to.y;
    // кадр полёта (енот на подъёме — прыжок с зонтом), наклон по ходу
    this.flap(this.root.y < prevY - 0.5);
    // в пике за ним тянется хвост искр
    if (this.state === 'dive' && Math.floor(this.stateT * 25) !== Math.floor((this.stateT - _dt) * 25)) this.env.sparks.burst(this.x, this.y, 2);
    // в финале — мёртвая петля в середине подлёта, иначе — наклон по ходу
    const loop = this.state === 'tease' ? Phaser.Math.Clamp((u - 0.35) / 0.5, 0, 1) : 0;
    this.root.setRotation(
      loop > 0 && loop < 1 ? -loop * Math.PI * 2 * this.facing : Phaser.Math.Clamp((this.root.y - prevY) * 0.02, -0.3, 0.3) * this.facing,
    );
    // завис над местом вещи — роняет её вниз и летит дальше, не садясь
    if (u >= 1 && this.after) {
      const a = this.after;
      this.after = null;
      this.dropCarried();
      this.flyTo(a.i, a.p);
      return;
    }
    if (u >= 1 && this.state === 'tease') {
      this.look.voice(1.15);
      this.escape();
      return;
    }
    if (u >= 1 && this.state === 'escape') {
      this.state = 'gone';
      this.root.setVisible(false);
      this.opts.onEscape?.();
      return;
    }
    if (u >= 1) {
      this.state = 'perch';
      this.stateT = 0;
      this.root.setRotation(0);
      this.carry.setVisible(false);
      this.img.setFrame('laugh').setY(0);
      this.kick(-0.14);
      // сел — и сразу дразнится
      this.nextLaugh = 0.25;
    }
  }

  private toDizzy() {
    this.state = 'dizzy';
    this.stateT = 0;
    this.carry.setVisible(false);
    this.root.setRotation(0);
    this.img.setFrame('dizzy').setFlipX(false).setRotation(0).setScale(1).setY(0);
    this.vy = -320;
    this.bounces = 0;
    feedback.dizzy();
    this.env.sparks.burst(this.x, this.y, 16);
    // вещи выпадают из лап — их роняет сцена (обычные предметы уровня)
    this.opts.onDefeat?.(this.x, this.y);
  }

  private lying(dt: number) {
    const r = this.root;
    const floor = this.env.floorAt(r.x, r.y - 1);
    if (r.y < floor || this.vy !== 0) {
      this.vy += GRAVITY * dt;
      r.y += this.vy * dt;
      r.rotation += 2.5 * dt;
      if (r.y >= floor) {
        r.y = floor;
        if (this.bounces < 1 && this.vy > 300) {
          this.vy = -this.vy * 0.35;
          this.bounces++;
          this.kick(-0.2);
        } else {
          this.vy = 0;
          this.kick(-0.16);
        }
      }
    }
    if (this.vy === 0) r.rotation *= 1 - Math.min(1, dt * 8);
    this.drawStars();
  }

  /** Три звёздочки кружат над головой; дальние — мельче и прозрачнее. */
  private drawStars() {
    const g = this.stars;
    g.clear();
    for (let i = 0; i < 3; i++) {
      const a = this.t * 4 + (i * Math.PI * 2) / 3;
      const depth = 0.5 + 0.5 * Math.sin(a);
      const x = this.head.x + Math.cos(a) * 48;
      const y = this.head.y + Math.sin(a) * 12;
      drawStar(g, x, y, 7 + 4 * depth, this.t * 3 + i, 0.55 + 0.45 * depth);
    }
  }

  /** Щит босса: мерцающий пузырь цвета злодея — паутина его не берёт. */
  private drawShield() {
    const g = this.shieldG;
    g.clear();
    if (!this.shield || this.state === 'dizzy') return;
    const r = 120 + 6 * Math.sin(this.t * 5);
    const c = this.look.shield;
    g.fillStyle(c, 0.12).fillCircle(0, -100, r);
    g.lineStyle(4, c, 0.55 + 0.25 * Math.sin(this.t * 7)).strokeCircle(0, -100, r);
    g.lineStyle(2, 0xffffff, 0.35).beginPath().arc(0, -100, r - 14, -2.4 + this.t, -1.4 + this.t).strokePath();
  }

  private kick(amount: number) {
    this.sq = amount;
    this.sqVel = 0;
  }

  private flashWhite() {
    this.img.setTintFill(0xffffff);
    this.scene.time.delayedCall(90, () => this.img.clearTint());
  }
}

function drawStar(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, rot: number, alpha: number) {
  const pts: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < 10; i++) {
    const a = rot + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    pts.push(new Phaser.Math.Vector2(x + Math.cos(a) * rr, y + Math.sin(a) * rr));
  }
  g.fillStyle(0xffd84a, alpha);
  g.lineStyle(2, 0x5a2a10, alpha);
  g.fillPoints(pts, true);
  g.strokePoints(pts, true);
}
