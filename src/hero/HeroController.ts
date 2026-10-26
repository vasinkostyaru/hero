import Phaser from 'phaser';
import { feedback } from '../audio/feedback';
import { HERO_HITBOX } from '../config/hero';
import type { GameInput } from '../input/GameInput';
import type { Dust } from '../world/fx';
import { SWING_REACH, type Hook } from '../world/Hook';
import type { Level, Solid } from '../world/Level';
import type { Hero, HeroMotion } from './Hero';

const MAX_SPEED = 520;
const ACCEL = 2600;
const DECEL = 3200;
/** В воздухе без нажатия скорость гасится мягче — прыжок от стены долетает до соседней. */
const AIR_DECEL = 600;
/** Гравитация мира — в конфиге Arcade (main.ts), здесь только скорость прыжка. */
const JUMP_V = 1250;
/** Отпустил прыжок рано — добавочная гравитация, прыжок ниже. */
const CUT_GRAVITY = 3100;
const CLIMB_V = 470;
const SLIDE_V = 120;
const WALL_JUMP_VX = 520;
/** После отталкивания от стены столько не даём управлять в её сторону — чтобы не прилипнуть обратно. */
const WALL_LOCK = 0.15;
const SHOOT_COOLDOWN = 0.25;
/** Нажал прыжок чуть раньше приземления — прыжок сработает при касании опоры. */
const JUMP_BUFFER = 0.12;
/** Сошёл с края — ещё столько можно прыгнуть «с воздуха». */
const COYOTE = 0.1;
/** Толчок шалуна: отлетаем назад-вверх и чуть-чуть не слушаемся кнопок. Без урона. */
const BUMP_VX = 560;
const BUMP_VY = 620;
const BUMP_STUN = 0.35;
/** Качели: раскачка стрелками вдоль дуги, px/с². */
const PUMP = 900;
/** Отпустил нить — немного добавляем скорости, полёт «из пращи». */
const SWING_BOOST = 1.1;
/** Подстраховка при отпускании нити: не слабее этого вбок и вверх. */
const RELEASE_VX = 520;
const RELEASE_VY = -700;
/** После качелей и батута-улицы импульс в воздухе не гасим столько, с. */
const COAST = 0.45;
/** Тент в улице подбрасывает обратно к краю крыши: время полёта для расчёта скорости, с. */
const STREET_FLIGHT = 1.39;
/** Первые доли секунды прыжок не обрезается — даже лёгкий тап даёт заметный прыжок. */
const MIN_JUMP_TIME = 0.1;

/**
 * Управление героем на Arcade Physics. Тело — прямоугольник хитбокса; герой (картинка)
 * ставится по телу один раз за кадр, после физики, — камера следует уже за итогом.
 * Стены: прилипаем только к climbable. Держишь в стену — ползёт, отпустил — сползает,
 * прыжок — отталкивание по диагонали, на верхнем краю — вылез на крышу стены.
 */
export class HeroController {
  readonly body: Phaser.Physics.Arcade.Body;
  vx = 0;
  /** 1 — висим на стене справа, -1 — слева, 0 — не на стене */
  wallDir = 0;
  /** в воздухе после отталкивания от стены (для отъезда камеры) */
  fromWall = false;

  private wall: Solid | null = null;
  private grounded = true;
  private lock = 0;
  private lockDir = 0;
  private cooldown = 0;
  private jumpBuffer = 0;
  private coyote = 0;
  private jumpT = 99;
  private fallV = 0;
  private stun = 0;
  /** подбросило батутом — высоту не обрезаем, даже если прыжок не держат */
  private bounced = false;
  /** после качелей: импульс в воздухе не гасим */
  private coast = 0;
  /** подбросило тентом улицы: управление отдыхает, скорость к краю крыши не гасится */
  private launch = 0;
  /** качели: крюк и длина нити; null — не качаемся */
  swing: { hook: Hook; len: number } | null = null;
  /** крупный план, победа: герой стоит и не слушается кнопок */
  locked = false;
  /** низ тела на прошлом кадре: за кадр физика может сделать несколько шагов, и body.prev — только последний */
  private lastBottom = 0;
  /** только что отпустил нить — сразу не цепляемся снова */
  private swingCd = 0;
  /** летит между крюками (отпустил нить и ещё не встал): паутина только цепляется, не стреляет */
  private swingFlight = false;

  /** Приземление: скорость падения, px/с (для тряски камеры с высоты). */
  onLand: (fallSpeed: number) => void = () => {};
  /** Выстрел: откуда и куда смотрит герой. */
  onShoot: (from: { x: number; y: number }, facing: number) => void = () => {};

  constructor(
    scene: Phaser.Scene,
    private hero: Hero,
    private input: GameInput,
    private level: Level,
    private dust: Dust,
  ) {
    const { w, h } = HERO_HITBOX;
    this.body = scene.physics.add.body(hero.x - w / 2, hero.y - h, w, h);
    this.body.setCollideWorldBounds(true);
    this.body.setMaxVelocityY(1700);
    for (const solid of level.bodies) scene.physics.add.collider(this.body, solid);
  }

  update(dt: number) {
    const h = this.hero;
    const b = this.body;
    let dir = this.locked ? 0 : (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);
    this.coast = Math.max(0, this.coast - dt);
    this.launch = Math.max(0, this.launch - dt);
    if (this.launch > 0) dir = 0;
    this.lock = Math.max(0, this.lock - dt);
    if (this.lock > 0 && dir === this.lockDir) dir = 0;
    this.stun = Math.max(0, this.stun - dt);
    if (this.stun > 0) dir = 0;
    this.cooldown = Math.max(0, this.cooldown - dt);
    // «нажато» снимается при чтении — читаем ввод ровно один раз за кадр
    const jump = this.input.jumpPressed;
    const shoot = this.input.shootPressed;
    if (jump && this.stun === 0 && !this.locked) this.jumpBuffer = JUMP_BUFFER;
    else this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);

    const m = this.swing ? this.stepSwing(dt, dir) : this.wallDir !== 0 ? this.stepWall(dir) : this.stepFree(dt, dir);

    // картинка героя — по телу, один раз за кадр
    h.setPosition(b.center.x, b.bottom);
    if (this.grounded || this.wallDir !== 0) this.swingFlight = false;
    this.swingCd = Math.max(0, this.swingCd - dt);
    // в воздухе у крюка — качели; иначе обычный выстрел (ребёнку не нужно выбирать).
    // Нажал чуть раньше и держишь — нить цепляется сама, как только крюк в досягаемости.
    const hook =
      !this.locked && !this.swing && !this.grounded && this.wallDir === 0 && this.swingCd === 0 && (shoot || this.input.shootHeld)
        ? this.level.hookInReach(b.center.x, b.center.y)
        : null;
    if (hook) this.attach(hook);
    else if (shoot && !this.locked && !this.swing && !this.swingFlight) {
      if (this.cooldown === 0) {
        this.cooldown = SHOOT_COOLDOWN;
        feedback.shoot();
        this.onShoot(h.shoot(), h.facing);
      }
    }
    h.swingAngle = this.swing ? -Math.atan2(b.center.x - this.swing.hook.x, b.center.y - this.swing.hook.y) : null;
    h.update(dt, m);
    this.lastBottom = b.bottom;
  }

  /** Нить цепляется за крюк: дальше — маятник, пока держат кнопку паутины. */
  private attach(hook: Hook) {
    const b = this.body;
    const len = Phaser.Math.Clamp(Math.hypot(b.center.x - hook.x, b.center.y - hook.y), 180, SWING_REACH);
    this.swing = { hook, len };
    this.swingFlight = true;
    this.bounced = false;
    b.setGravityY(0);
    feedback.shoot();
    feedback.stick();
    this.hero.kick(0.12);
  }

  /**
   * Отпустил нить: летим по инерции вперёд и вверх. Для маленького игрока — с подстраховкой:
   * если летел вбок, бросает не слабее RELEASE_VX и всегда чуть вверх.
   */
  private releaseSwing(boost = SWING_BOOST) {
    const b = this.body;
    this.swing = null;
    const vx = b.velocity.x * boost;
    this.vx = Math.abs(vx) > 150 ? Math.sign(vx) * Math.max(Math.abs(vx), RELEASE_VX) : vx;
    b.setVelocity(this.vx, Math.min(b.velocity.y * boost, RELEASE_VY));
    this.coast = COAST;
    this.swingCd = 0.5;
    this.hero.setState('air');
    feedback.wallJump();
  }

  /**
   * Маятник: гравитация тянет вниз (Arcade), нить не даёт уйти дальше длины —
   * ставим тело обратно на окружность и убираем скорость «наружу». Стрелки раскачивают.
   */
  private stepSwing(dt: number, dir: number): HeroMotion {
    const h = this.hero;
    const b = this.body;
    const air: HeroMotion = { speed: 0, accel: 0, vy: b.velocity.y, wallMove: 0, groundY: this.level.floorAt(b.center.x, b.bottom) };
    if (!this.input.shootHeld || this.jumpBuffer > 0) {
      this.releaseSwing(this.jumpBuffer > 0 ? SWING_BOOST * 1.08 : SWING_BOOST);
      this.jumpBuffer = 0;
      return air;
    }
    if (b.blocked.down) {
      this.swing = null;
      this.grounded = true;
      return air;
    }
    const { hook, len } = this.swing!;
    const dx = b.center.x - hook.x;
    const dy = b.center.y - hook.y;
    const d = Math.hypot(dx, dy) || 1;
    const nx = dx / d;
    const ny = dy / d;
    if (d > len) {
      b.position.x -= nx * (d - len);
      b.position.y -= ny * (d - len);
      b.updateCenter();
      const vr = b.velocity.x * nx + b.velocity.y * ny;
      if (vr > 0) b.velocity.set(b.velocity.x - nx * vr, b.velocity.y - ny * vr);
    }
    if (dir !== 0) {
      // касательная к дуге в сторону нажатой стрелки
      let tx = -ny;
      let ty = nx;
      if (tx * dir < 0) {
        tx = -tx;
        ty = -ty;
      }
      b.velocity.set(b.velocity.x + tx * PUMP * dt, b.velocity.y + ty * PUMP * dt);
    }
    this.vx = b.velocity.x;
    if (Math.abs(this.vx) > 40) h.facing = Math.sign(this.vx);
    h.setState('air');
    return air;
  }

  /** Вернуть героя в точку (флаг), без скорости и без качелей. */
  respawn(x: number, y: number) {
    if (this.wallDir !== 0) this.release();
    this.swing = null;
    this.vx = 0;
    teleport(this.body, x - this.body.width / 2, y - this.body.height);
    this.lastBottom = y;
    this.hero.setPosition(x, y);
    this.hero.setState('idle');
  }

  private stepFree(dt: number, dir: number): HeroMotion {
    const h = this.hero;
    const b = this.body;
    const wasGrounded = this.grounded;
    this.grounded = b.blocked.down;

    // приземление
    if (this.grounded && !wasGrounded) {
      this.fromWall = false;
      h.setState('land', Math.min(1, this.fallV / 1400));
      this.onLand(this.fallV);
    }
    if (!this.grounded) this.fallV = Math.max(this.fallV, b.velocity.y);
    else this.fallV = 0;

    // разгон и торможение
    const prevVx = this.vx;
    if (dir !== 0) {
      this.vx += dir * ACCEL * dt;
      h.facing = dir;
    } else if (!((this.lock > 0 || this.stun > 0 || this.coast > 0 || this.launch > 0) && !this.grounded)) {
      // сразу после отталкивания от стены или толчка импульс не гасим
      const s = Math.sign(this.vx);
      this.vx -= s * (this.grounded ? DECEL : AIR_DECEL) * dt;
      if (Math.sign(this.vx) !== s) this.vx = 0;
    }
    this.vx = Phaser.Math.Clamp(this.vx, -MAX_SPEED, MAX_SPEED);
    // упёрлись в стену или ящик — стоим, а не «бег ↔ стоп» каждый кадр (из-за этого герой мигал)
    const side = Math.sign(this.vx);
    const blocked = side > 0 ? b.blocked.right : b.blocked.left;
    if (side !== 0 && this.launch === 0 && (blocked || this.level.blockedAt(side, b.left, b.right, b.top, b.bottom))) this.vx = 0;
    b.setVelocityX(this.vx);

    // батут: падаем на бельё или тент — подбрасывает
    if (this.grounded || b.velocity.y >= 0) this.bounced = false;
    if (!this.grounded && b.velocity.y > 0) {
      const bouncer = this.level.bouncers.find((o) => o.caught(b.center.x, this.lastBottom, b.bottom));
      if (bouncer) {
        b.setVelocityY(-bouncer.power);
        if (bouncer.launchTo !== undefined) {
          // тент в улице: обратно к краю крыши, с которой прыгал
          this.vx = (bouncer.launchTo - b.center.x) / STREET_FLIGHT;
          this.launch = STREET_FLIGHT * 0.6;
          h.facing = Math.sign(this.vx) || h.facing;
        }
        b.y = bouncer.top - b.height;
        this.bounced = true;
        this.jumpBuffer = 0;
        this.fromWall = false;
        bouncer.bounce();
        h.setState('air');
        h.kick(0.22);
        this.dust.ground(b.center.x, bouncer.top, 0.5);
      }
    }

    // прыжок: буфер нажатия + «койот» после схода с края
    this.coyote = this.grounded ? COYOTE : Math.max(0, this.coyote - dt);
    if (this.jumpBuffer > 0 && this.coyote > 0) {
      b.setVelocityY(-JUMP_V);
      this.grounded = false;
      this.jumpBuffer = 0;
      this.coyote = 0;
      this.jumpT = 0;
      feedback.jump();
    }
    this.jumpT += dt;
    const cut = b.velocity.y < 0 && !this.input.jumpHeld && this.jumpT > MIN_JUMP_TIME && !this.bounced;
    b.setGravityY(cut ? CUT_GRAVITY : 0);

    // прилипание: в воздухе — к любой climbable-стене рядом; на земле — если идёт в неё
    for (const side of [1, -1]) {
      const touching = side > 0 ? b.blocked.right || dir > 0 : b.blocked.left || dir < 0;
      if (!touching) continue;
      const wall = this.level.wallAt(side, b.left, b.right, b.top, b.bottom);
      if (wall && (!this.grounded || dir === side) && !(this.lock > 0 && this.lockDir === side)) {
        this.grab(side, wall);
        return { speed: 0, accel: 0, vy: 0, wallMove: 0, groundY: null };
      }
    }

    const speed = Math.abs(this.vx) / MAX_SPEED;
    if (!this.grounded) h.setState('air');
    else h.setState(speed > 0.08 ? 'run' : 'idle');

    return {
      speed,
      accel: ((this.vx - prevVx) / Math.max(dt, 1e-3)) * h.facing,
      vy: b.velocity.y,
      wallMove: 0,
      groundY: this.level.floorAt(b.center.x, b.bottom, HERO_HITBOX.w / 2),
      ground: this.level.surfaceAt(b.center.x, b.bottom, HERO_HITBOX.w / 2),
    };
  }

  /** Шалун толкнул: dir — куда отлетаем (1 вправо, -1 влево). */
  bump(dir: number) {
    const b = this.body;
    if (this.wallDir !== 0) this.release();
    this.swing = null;
    this.vx = dir * BUMP_VX;
    b.setVelocity(this.vx, -BUMP_VY);
    b.setGravityY(0);
    this.grounded = false;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.fromWall = false;
    this.stun = BUMP_STUN;
    this.hero.setState('air');
    this.hero.ouch(dir);
    feedback.bonk();
  }

  private grab(side: number, wall: Solid) {
    const b = this.body;
    this.wallDir = side;
    this.wall = wall;
    this.hero.facing = side;
    this.vx = 0;
    this.grounded = false;
    this.fromWall = false;
    b.setAllowGravity(false);
    b.setGravityY(0);
    b.setVelocity(0, 0);
    // встаём ровно к поверхности стены
    b.x = side > 0 ? wall.x - b.width : wall.x + wall.w;
    this.hero.setState('wall');
  }

  private release() {
    this.wallDir = 0;
    this.wall = null;
    this.body.setAllowGravity(true);
  }

  private stepWall(dir: number): HeroMotion {
    const h = this.hero;
    const b = this.body;
    const side = this.wallDir;
    const wall = this.wall!;
    const air: HeroMotion = { speed: 0, accel: 0, vy: b.velocity.y, wallMove: 0, groundY: this.level.floorAt(b.center.x, b.bottom) };

    if (this.jumpBuffer > 0) {
      // отталкиваемся по диагонали в обратную сторону и ненадолго блокируем управление к стене
      this.jumpBuffer = 0;
      this.release();
      this.vx = -side * WALL_JUMP_VX;
      b.setVelocity(this.vx, -JUMP_V * 0.92);
      this.jumpT = 0;
      this.lock = WALL_LOCK;
      this.lockDir = side;
      h.facing = -side;
      this.fromWall = true;
      feedback.wallJump();
      this.dust.wall(side > 0 ? b.right : b.left, b.center.y, -side);
      h.setState('air');
      return air;
    }
    if (dir === -side) {
      this.release();
      this.vx = dir * 150;
      b.setVelocityX(this.vx);
      h.setState('air');
      return air;
    }

    // наверху стены — вылезаем на неё
    if (b.bottom - b.height * 0.35 < wall.y) {
      this.release();
      const x = side > 0 ? wall.x + Math.min(wall.w / 2, 40) : wall.x + wall.w - Math.min(wall.w / 2, 40);
      teleport(b, x - b.width / 2, wall.y - b.height);
      this.grounded = true;
      h.facing = side;
      h.setState('land', 0.3);
      return { speed: 0, accel: 0, vy: 0, wallMove: 0, groundY: wall.y };
    }

    const climbing = dir === side || this.input.up;
    if (b.blocked.down && !climbing) {
      // сползли до опоры и не лезем — просто стоим
      this.release();
      this.grounded = true;
      h.setState('idle');
      return { speed: 0, accel: 0, vy: 0, wallMove: 0, groundY: b.bottom };
    }
    // прижимаемся к стене небольшой скоростью, чтобы контакт не терялся
    b.setVelocity(side * 20, climbing ? -CLIMB_V : SLIDE_V);
    return { speed: 0, accel: 0, vy: b.velocity.y, wallMove: climbing ? 1 : b.blocked.down ? 0 : -1, groundY: null };
  }
}

/** Переставить тело без «скорости от рывка» (у тела нет игрового объекта, reset не подходит). */
function teleport(b: Phaser.Physics.Arcade.Body, x: number, y: number) {
  b.position.set(x, y);
  b.prev.set(x, y);
  b.prevFrame.set(x, y);
  b.setVelocity(0, 0);
  b.updateCenter();
}
