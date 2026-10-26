import Phaser from 'phaser';
import { GAME_H, GROUND_Y } from '../config/game';
import type { CritterDef, LevelDef, SectionDef } from '../levels/types';
import { Flag, Lamp, addChimneySmoke } from './Ambient';
import type { Critter, CritterEnv } from './Critter';
import { Drone } from './Drone';
import { addGround } from './Ground';
import { Hook } from './Hook';
import { Item } from './Item';
import { Pigeon } from './Pigeon';
import { Bouncer, Cradle, POST_COLOR, Trolley, addAwning, addClothesline, addLongPlatform, addStreet, meta, type PlatformLook } from './Platforms';
import { addProps } from './Props';
import { Seagull } from './Seagull';
import { addTiled, scaledTexture } from './textures';

export type SolidKind = 'roof' | 'platform' | 'wall' | 'box';

/** Твёрдый прямоугольник уровня: x, y — левый верхний угол. */
export interface Solid {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: SolidKind;
  /** по такой стене можно лазать — кирпич с плющом */
  climbable?: boolean;
  /** вид платформы: доски, леса, балка или балкон (без — кирпич); y — где стоит герой */
  look?: PlatformLook | 'balcony';
}

/** Платформы из набора — перед декором крыши (6), но за героем и шалунами. */
const PLATFORM_DEPTH = 7;
/** Тон кирпича под палитру заката: чуть темнее и в сиреневый, как всё, что стоит в тени. */
const BRICK_TINT = 0xd9c6d6;
const RIM_COLOR = 0xffb46a;
const OUTLINE = 0x1c0c2a;
/** Ящик по пояс герою: crate.png (265 px) × 0.42 ≈ 110 px. */
const CRATE_SCALE = 0.42;
/** Секции дальше этого от края экрана не рисуются и не обновляются. */
const CULL_MARGIN = 700;

/** Насест злодея в мировых координатах. */
export interface Perch {
  x: number;
  y: number;
  drop?: string;
}

interface Updatable {
  update(dt: number): void;
}

/** Секция в мире: её объекты (для отключения отрисовки) и всё, что обновляется. */
interface Section {
  x0: number;
  x1: number;
  objects: Phaser.GameObjects.GameObject[];
  updaters: Updatable[];
  critters: Critter[];
  near: boolean;
}

/**
 * Уровень из секций (LevelDef): крыша кусками с улицами между ними, платформы и стены
 * (статические тела Arcade; платформы — односторонние), декор, флаги-чекпоинты, крюки,
 * батуты, люльки, тележки, шалуны и предметы. Объекты каждой секции запоминаются:
 * секции далеко за экраном не рисуются (cameraFilter) и не обновляются.
 */
export class Level {
  readonly width: number;
  readonly startX: number;
  readonly solids: Solid[] = [];
  readonly bodies: Phaser.Physics.Arcade.StaticBody[] = [];
  readonly bouncers: Bouncer[] = [];
  readonly hooks: Hook[] = [];
  readonly items: Item[] = [];
  readonly critters: Critter[] = [];
  readonly flags: Flag[] = [];
  readonly perches: Perch[] = [];
  /** арена босса: где начинается, насесты, где приземляются голуби (мировые координаты) */
  arena: { x: number; perches: Perch[]; waves: CritterDef[][] } | null = null;
  private sections: Section[] = [];
  private cradles: { cradle: Cradle; solid: Solid }[] = [];
  private trolleys = new Map<string, Trolley>();
  private byId = new Map<string, Critter>();

  constructor(
    private scene: Phaser.Scene,
    def: LevelDef,
    private env: CritterEnv,
    private glowLayer: Phaser.GameObjects.Layer,
  ) {
    makeShadeTextures(scene);
    let x0 = 0;
    let start = 0;
    for (const sd of def.sections) {
      if (sd.start !== undefined) start = x0 + sd.start;
      this.sections.push(this.buildSection(sd, x0));
      x0 += sd.w;
    }
    this.width = x0;
    this.startX = start;
    this.buildItems(def);
    // пока ни одна секция не скрыта — активны все
    this.active = [...this.critters];
  }

  /** Строит секцию и запоминает всё, что она добавила в сцену и в слой свечения. */
  private buildSection(sd: SectionDef, x0: number): Section {
    const scene = this.scene;
    const before = new Set(scene.children.list);
    const beforeGlow = new Set(this.glowLayer.list);
    const sec: Section = { x0, x1: x0 + sd.w, objects: [], updaters: [], critters: [], near: true };
    const X = (x: number) => x0 + x;

    // крыша кусками, между ними — улица с тентами
    const roof = sd.roof ?? [[0, sd.w]];
    roof.forEach(([a, b], i) => {
      addGround(scene, X(a), X(b));
      this.addSolid({ x: X(a), y: GROUND_Y, w: b - a, h: 400, kind: 'roof' });
      const next = roof[i + 1];
      if (next) this.bouncers.push(addStreet(scene, X(b), X(next[0]), GROUND_Y, GAME_H));
    });

    for (const p of addProps(scene, (sd.props ?? []).map((p) => ({ ...p, x: X(p.x) })))) {
      // дымок из левой трубы на шапке трубы
      if (p.def.key === 'chimney') addChimneySmoke(scene, p.img.x - p.img.displayWidth * 0.12, p.img.y - p.img.displayHeight * 0.97, p.def.far);
    }
    for (const s of sd.solids ?? []) this.addSolid({ ...s, x: X(s.x) });

    for (const c of sd.cradles ?? []) {
      const cradle = new Cradle(scene, X(c.x), c.top, c.bottom, c.period);
      // пол люльки — тоже опора: для тени героя и падающих коконов
      const solid: Solid = { ...cradle.floor, h: 24, kind: 'platform' };
      this.solids.push(solid);
      this.bodies.push(cradle.body);
      this.cradles.push({ cradle, solid });
    }
    for (const c of sd.clotheslines ?? []) this.bouncers.push(addClothesline(scene, X(c.x), GROUND_Y));
    for (const a of sd.awnings ?? []) this.bouncers.push(addAwning(scene, X(a.wallRight), a.y));
    sd.trolleys?.forEach((t, i) => {
      const trolley = new Trolley(scene, X(t.minX), X(t.maxX), t.beamTop);
      this.trolleys.set(t.id ?? `${x0}:${i}`, trolley);
      sec.updaters.push(trolley);
    });
    for (const h of sd.hooks ?? []) this.hooks.push(new Hook(scene, X(h.x), h.y, X(h.spanL), X(h.spanR), this.glowLayer));
    for (const l of sd.lamps ?? []) sec.updaters.push(new Lamp(scene, X(l.x), GROUND_Y + 4, this.glowLayer));
    if (sd.flag !== undefined) {
      // флаг первой секции (старт) поднят сразу
      const flag = new Flag(scene, X(sd.flag), GROUND_Y + 4, sd.start !== undefined);
      this.flags.push(flag);
      sec.updaters.push(flag);
    }
    if (sd.crow) this.perches.push({ ...sd.crow, x: X(sd.crow.x) });
    if (sd.arena) this.arena = { x: x0, perches: sd.arena.perches.map((p) => ({ ...p, x: X(p.x) })), waves: sd.arena.waves };

    for (const c of sd.critters ?? []) {
      const critter = this.makeCritter(c, X);
      sec.critters.push(critter);
      this.critters.push(critter);
      if (c.id) this.byId.set(c.id, critter);
    }

    sec.objects = scene.children.list.filter((o) => !before.has(o));
    sec.objects.push(...this.glowLayer.list.filter((o) => !beforeGlow.has(o)));
    this.pendingItems.push(...(sd.items ?? []).map((it) => ({ ...it, x: X(it.x), sec })));
    return sec;
  }

  private pendingItems: (NonNullable<SectionDef['items']>[number] & { sec: Section })[] = [];

  /** Предметы — после всех секций: им нужны сторожа и тележки по id. */
  private buildItems(def: LevelDef) {
    for (const it of this.pendingItems) {
      if (!def.items.includes(it.key)) continue;
      const before = new Set(this.scene.children.list);
      const beforeGlow = new Set(this.glowLayer.list);
      const guard = it.guard ? this.byId.get(it.guard) : undefined;
      const trolley = it.attach ? this.trolleys.get(it.attach) : undefined;
      const item = new Item(
        this.scene,
        it.key,
        it.x,
        it.y,
        this.glowLayer,
        guard ? () => guard.alive : undefined,
        // предмет висит под крюком: верх картинки — у кончика крюка
        trolley ? () => { const p = trolley.hookPoint(); return { x: p.x, y: p.y + 30 }; } : null,
        it.carried || it.boss,
      );
      this.items.push(item);
      // предмет у злодея может оказаться где угодно — его не прячем вместе с секцией
      if (!it.carried && !it.boss) {
        it.sec.objects.push(...this.scene.children.list.filter((o) => !before.has(o)));
        it.sec.objects.push(...this.glowLayer.list.filter((o) => !beforeGlow.has(o)));
      }
    }
    this.pendingItems = [];
  }

  /** Шалун по описанию; x в описании — от x0 (для волн босса — от начала арены). */
  spawnCritter(c: CritterDef, x0: number) {
    return this.makeCritter(c, (x) => x0 + x);
  }

  private makeCritter(c: NonNullable<SectionDef['critters']>[number], X: (x: number) => number): Critter {
    switch (c.kind) {
      case 'drone':
      case 'drone2':
        return new Drone(this.scene, X(c.x), c.y, this.env, c.kind);
      case 'pigeon':
        return new Pigeon(this.scene, X(c.x), c.floorY, X(c.minX), X(c.maxX), this.env);
      case 'seagull':
        return new Seagull(this.scene, X(c.x), c.y, c.range, this.env);
    }
  }

  private addSolid(s: Solid) {
    this.draw(s);
    const body = this.scene.physics.add.staticBody(s.x, s.y, s.w, s.h);
    if (s.kind === 'platform') {
      body.checkCollision.down = false;
      body.checkCollision.left = false;
      body.checkCollision.right = false;
    }
    this.solids.push(s);
    this.bodies.push(body);
  }

  /** Шалуны видимых секций (массив пересобирается, только когда секции появляются/пропадают). */
  get activeCritters() {
    return this.active;
  }
  private active: Critter[] = [];

  /** Флаг, который герой только что пробежал (или null). */
  passFlag(heroX: number) {
    for (const f of this.flags) {
      if (!f.active && heroX > f.x - 20) {
        f.activate();
        return f;
      }
    }
    return null;
  }

  /** Крюк, до которого герой (центр тела) сейчас дотягивается. */
  hookInReach(cx: number, cy: number) {
    let best: Hook | null = null;
    for (const h of this.hooks) if (h.inReach(cx, cy) && (!best || Math.abs(h.x - cx) < Math.abs(best.x - cx))) best = h;
    return best;
  }

  /**
   * Секции у экрана рисуются и обновляются, остальные — нет. Люльки везут героя,
   * батуты пружинят, крюки подсвечиваются. Вызывать до шага героя.
   */
  update(dt: number, hero: Phaser.Physics.Arcade.Body, cam: Phaser.Cameras.Scene2D.Camera) {
    const view = cam.worldView;
    for (const s of this.sections) {
      const near = s.x1 > view.left - CULL_MARGIN && s.x0 < view.right + CULL_MARGIN;
      if (near !== s.near) {
        s.near = near;
        for (const o of s.objects) (o as unknown as { cameraFilter: number }).cameraFilter = near ? 0 : cam.id;
        this.active = this.sections.filter((x) => x.near).flatMap((x) => x.critters);
      }
      if (!near) continue;
      for (const u of s.updaters) u.update(dt);
      for (const c of s.critters) c.update(dt);
    }
    for (const { cradle, solid } of this.cradles) {
      const f = cradle.floor;
      const riding =
        hero.blocked.down && Math.abs(hero.bottom - f.y) < 6 && hero.right > f.x && hero.left < f.x + f.w;
      cradle.update(dt);
      solid.y = f.y;
      // стоим на полу — едем вместе с ним
      if (riding) {
        hero.position.y += cradle.dy;
        hero.prev.y += cradle.dy;
        hero.prevFrame.y += cradle.dy;
        hero.updateCenter();
      }
    }
    for (const b of this.bouncers) b.update(dt);
    for (const h of this.hooks) h.update(dt, hero.center.x, hero.center.y);
    // предметов всего три — обновляем всегда: роняют их и далеко от героя
    for (const it of this.items) it.update(dt);
  }

  /** Стены и ящик — в них прилипает паутина. */
  get webTargets() {
    return this.solids.filter((s) => s.kind === 'wall' || s.kind === 'box');
  }

  /** Ближайшая опора под точкой. */
  surfaceAt(x: number, y: number, halfW = 0): Solid | undefined {
    let best: Solid | undefined;
    for (const s of this.solids) {
      if (x + halfW <= s.x || x - halfW >= s.x + s.w) continue;
      if (s.y >= y - 1 && (!best || s.y < best.y)) best = s;
    }
    return best;
  }

  /** Верх ближайшей опоры под точкой (для тени и падающего кокона). */
  floorAt(x: number, y: number, halfW = 0) {
    return this.surfaceAt(x, y, halfW)?.y ?? GROUND_Y;
  }

  /**
   * Упирается ли хитбокс боком в твёрдое (стену, ящик) — side 1 справа, -1 слева.
   * Платформы не в счёт: сквозь них сбоку проходишь.
   */
  blockedAt(side: number, left: number, right: number, top: number, bottom: number) {
    return this.solids.some(
      (s) =>
        s.kind !== 'platform' &&
        s.kind !== 'roof' &&
        bottom > s.y + 2 &&
        top < s.y + s.h &&
        Math.abs(side > 0 ? s.x - right : s.x + s.w - left) < 2,
    );
  }

  /** Climbable-стена вплотную к боку хитбокса: side 1 — справа, -1 — слева. */
  wallAt(side: number, left: number, right: number, top: number, bottom: number) {
    return this.solids.find(
      (s) =>
        s.kind === 'wall' &&
        s.climbable &&
        bottom > s.y + 4 &&
        top < s.y + s.h &&
        Math.abs(side > 0 ? s.x - right : s.x + s.w - left) < 4,
    );
  }

  /** Опоры от низа платформы до крыши, цвета материала, с тёплым бликом. */
  private addPosts(s: Solid, color: number, bottom: number) {
    const add = this.scene.add;
    for (const k of [0.16, 0.84]) {
      const px = s.x + s.w * k;
      add.rectangle(px - 6, bottom, 12, GROUND_Y - bottom, color).setOrigin(0, 0).setDepth(4);
      add.rectangle(px + 3, bottom, 3, GROUND_Y - bottom, RIM_COLOR, 0.25).setOrigin(0, 0).setDepth(4).setBlendMode(Phaser.BlendModes.ADD);
      add.rectangle(px - 10, GROUND_Y - 10, 20, 12, color).setOrigin(0, 0).setDepth(4);
    }
  }

  private draw(s: Solid) {
    const add = this.scene.add;
    const edgeH = 148 * 0.5;
    switch (s.kind) {
      case 'roof':
        return; // крыша — addGround (фасад с градиентом)
      case 'box': {
        const key = scaledTexture(this.scene, 'crate', CRATE_SCALE);
        add.image(s.x + s.w / 2, s.y + s.h + 4, key).setOrigin(0.5, 1).setDepth(7);
        return;
      }
      case 'platform': {
        if (s.look === 'balcony') {
          add.image(s.x, s.y - meta(this.scene).special.balcony.stand!, 'platforms', 'balcony').setOrigin(0, 0).setDepth(PLATFORM_DEPTH);
          return;
        }
        if (s.look) {
          s.w = addLongPlatform(this.scene, s.look, s.x, s.y, s.w, PLATFORM_DEPTH);
          this.addPosts(s, POST_COLOR[s.look], s.y + meta(this.scene).long[s.look].h - meta(this.scene).long[s.look].stand);
          return;
        }
        // опоры до крыши — платформа читается как конструкция на крыше, а не плитка в воздухе
        for (const k of [0.16, 0.84]) {
          const px = s.x + s.w * k;
          const top = s.y + s.h;
          add.rectangle(px - 6, top, 12, GROUND_Y - top, 0x2a1638).setOrigin(0, 0).setDepth(4);
          add.rectangle(px + 3, top, 3, GROUND_Y - top, RIM_COLOR, 0.25).setOrigin(0, 0).setDepth(4).setBlendMode(Phaser.BlendModes.ADD);
          add.rectangle(px - 10, GROUND_Y - 10, 20, 12, 0x2a1638).setOrigin(0, 0).setDepth(4);
        }
        addTiled(this.scene, s.x, s.y, s.w, s.h, 'tex_brick', 0.5, 5, BRICK_TINT);
        // объём: низ выступа в тени, тонкий тёмный контур — не сливается с городом позади
        add.image(s.x, s.y, 'shade_v').setOrigin(0, 0).setDisplaySize(s.w, s.h).setDepth(5);
        add.rectangle(s.x, s.y + s.h - 3, s.w, 3, OUTLINE, 0.9).setOrigin(0, 0).setDepth(5);
        addTiled(this.scene, s.x - 12, s.y - edgeH * 0.35, s.w + 24, edgeH, 'roof_edge', 0.5, 5);
        return;
      }
      case 'wall': {
        const tex = s.climbable ? 'tex_climb' : 'tex_brick';
        addTiled(this.scene, s.x, s.y, s.w, s.h, tex, s.climbable ? 0.45 : 0.5, 5, BRICK_TINT);
        // светотень как у фасада: края темнее (объём колонны), книзу уходит в тень
        add.image(s.x, s.y, 'shade_h').setOrigin(0, 0).setDisplaySize(s.w, s.h).setDepth(5);
        add.image(s.x, s.y, 'shade_v').setOrigin(0, 0).setDisplaySize(s.w, s.h).setDepth(5);
        // тёплый блик заката по краю со стороны солнца (справа) и тёмный контур с другой
        add.rectangle(s.x + s.w - 5, s.y, 5, s.h, RIM_COLOR, 0.32).setOrigin(0, 0).setDepth(5).setBlendMode(Phaser.BlendModes.ADD);
        add.rectangle(s.x, s.y, 3, s.h, OUTLINE, 0.85).setOrigin(0, 0).setDepth(5);
        add.rectangle(s.x + s.w - 2, s.y, 2, s.h, OUTLINE, 0.6).setOrigin(0, 0).setDepth(5);
        // тень у основания — стена «стоит» на крыше
        add.image(s.x + s.w / 2, s.y + s.h + 2, 'soft_shadow').setDisplaySize(s.w * 2.2, 34).setAlpha(0.8).setDepth(4);
        addTiled(this.scene, s.x - 10, s.y - edgeH * 0.35, s.w + 20, edgeH, 'roof_edge', 0.5, 5);
        return;
      }
    }
  }
}

/** Градиенты светотени для стен и платформ — рисуем один раз, растягиваем по размеру. */
function makeShadeTextures(scene: Phaser.Scene) {
  if (!scene.textures.exists('shade_h')) {
    const t = scene.textures.createCanvas('shade_h', 64, 4)!;
    const ctx = t.getContext();
    const g = ctx.createLinearGradient(0, 0, 64, 0);
    g.addColorStop(0, 'rgba(26, 8, 40, 0.55)');
    g.addColorStop(0.3, 'rgba(26, 8, 40, 0.1)');
    g.addColorStop(0.7, 'rgba(26, 8, 40, 0)');
    g.addColorStop(1, 'rgba(26, 8, 40, 0.25)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 4);
    t.refresh();
  }
  if (!scene.textures.exists('shade_v')) {
    const t = scene.textures.createCanvas('shade_v', 4, 128)!;
    const ctx = t.getContext();
    const g = ctx.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, 'rgba(40, 14, 58, 0)');
    g.addColorStop(0.45, 'rgba(40, 14, 58, 0.18)');
    g.addColorStop(1, 'rgba(26, 8, 42, 0.62)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 4, 128);
    t.refresh();
  }
}
