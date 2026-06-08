import Phaser from 'phaser';
import {
  CHAR_SPEED, PX,
  LOWER_WALK_Y, UPPER_WALK_Y,
  FLOOR_SEP_TOP, FLOOR_SEP_BOT, STAIRS_X,
  C,
} from '../config';
import type { BehaviorState, Needs } from '../types';

interface Waypoint { x: number; y: number }

// ─── Pixel sprite helpers ────────────────────────────────────────────────────

type Row = (number | null)[];

function drawSprite(g: Phaser.GameObjects.Graphics, rows: Row[], px: number, ox: number, oy: number): void {
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let col = 0; col < row.length; col++) {
      const color = row[col];
      if (color !== null) {
        g.fillStyle(color, 1);
        g.fillRect(ox + col * px, oy + r * px, px, px);
      }
    }
  }
}

function drawSpriteOutline(g: Phaser.GameObjects.Graphics, rows: Row[], px: number, ox: number, oy: number): void {
  const offsets = [[-1,0],[1,0],[0,-1],[0,1]];
  g.fillStyle(C.outline, 1);
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let col = 0; col < row.length; col++) {
      if (row[col] !== null) {
        for (const [dx, dy] of offsets) {
          const nr = r + dy, nc = col + dx;
          const neighbor = rows[nr]?.[nc];
          if (neighbor === undefined || neighbor === null) {
            g.fillRect(ox + (col + dx) * px, oy + (r + dy) * px, px, px);
          }
        }
      }
    }
  }
}

// ─── Sprite frame definitions (10 wide × 20 tall at 1× = 30×60 at PX=3) ────

const K = C.outline;
const S = C.skin;
const D = C.skinShadow;
const H = C.hair;
const B = C.shirtBlue;
const L = C.shirtBlueLt;
const P = C.pants;
const Q = C.pantsLt;
const O = C.shoes;

// Body frame (without legs — legs are animated separately)
const BODY: Row[] = [
  [null,null,H,  H,  H,  H,  H,  H,  null,null],  // hair top
  [null,H,   H,  H,  H,  H,  H,  H,  H,   null],  // hair
  [null,H,   S,  S,  S,  S,  S,  S,  H,   null],  // head top
  [null,S,   S,  S,  S,  S,  S,  S,  S,   null],  // forehead
  [null,S,   S,  D,  S,  S,  D,  S,  S,   null],  // eyes (dark pupils)
  [null,S,   S,  S,  D,  D,  S,  S,  S,   null],  // nose bridge
  [null,S,   D,  S,  S,  S,  S,  S,  D,   null],  // cheeks
  [null,null,S,  D,  D,  D,  D,  S,  null,null],  // chin/mouth
  [null,null,B,  B,  B,  B,  B,  B,  null,null],  // collar
  [null,B,   B,  B,  B,  B,  B,  B,  B,   null],  // shoulder
  [B,   B,   B,  L,  B,  B,  L,  B,  B,   B   ],  // chest
  [B,   B,   B,  B,  B,  B,  B,  B,  B,   B   ],  // torso
  [null,B,   B,  B,  P,  P,  B,  B,  B,   null],  // waist
];

// Leg pairs per walk frame [leftLegRows, rightLegRows] offset from waist
function legsFrame(frame: number): { left: Row[]; right: Row[]; lx: number; rx: number } {
  // 4-frame cycle
  const swings = [[2, -2], [1, -1], [-2, 2], [-1, 1]];
  const [lo, ro] = swings[frame % 4];
  return {
    left:  [ [P,Q,P], [P,P,P], [P,Q,P], [O,O,O] ],
    right: [ [P,Q,P], [P,P,P], [P,Q,P], [O,O,O] ],
    lx: 2 + lo,
    rx: 5 + ro,
  };
}

// Sleeping sprite (lying horizontal, 22w × 8h)
const SLEEP: Row[] = [
  [null,null,null,null,null,null,null,null,H,H,H,H,H,H,null,null,null,null,null,null,null,null],
  [B,B,B,B,B,B,B,B,S,S,S,S,S,S,S,H,null,null,null,null,null,null],
  [B,L,B,B,B,B,B,B,S,S,D,S,S,D,S,H,null,null,null,null,null,null],
  [B,B,B,B,B,B,B,B,S,S,S,D,D,S,S,H,null,null,null,null,null,null],
  [P,P,P,P,P,Q,P,P,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
  [P,P,P,P,P,P,P,P,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
  [O,O,O,O,O,O,O,O,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
];

// ─── LittlePerson ────────────────────────────────────────────────────────────

export class LittlePerson extends Phaser.GameObjects.Container {
  public needs: Needs = { hunger: 80, happiness: 75, energy: 90, hygiene: 85 };
  public behavior: BehaviorState = 'idle';
  public atTarget = false;
  public facingRight = true;

  private waypoints: Waypoint[] = [];
  private gfx: Phaser.GameObjects.Graphics;
  private walkFrame = 0;
  private walkTimer = 0;
  private actionTimer = 0;
  private actionDuration = 0;
  private thoughtBubble: Phaser.GameObjects.Text;
  private thoughtTimer = 0;
  private zText: Phaser.GameObjects.Text;
  private zTimer = 0;
  private idleBounce = 0;
  private idleBounceDir = 1;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    this.gfx = scene.add.graphics();
    this.add(this.gfx);

    this.thoughtBubble = scene.add.text(0, -70, '', {
      fontSize: '9px',
      fontFamily: 'monospace',
      color: '#221100',
      backgroundColor: '#ffe8aa',
      padding: { x: 6, y: 4 },
      wordWrap: { width: 140 },
      align: 'center',
    }).setOrigin(0.5, 1).setDepth(50).setVisible(false);
    this.add(this.thoughtBubble);

    this.zText = scene.add.text(20, -80, '', {
      fontSize: '11px',
      fontFamily: 'monospace',
      color: '#bbccff',
    }).setDepth(50).setVisible(false);
    this.add(this.zText);

    scene.add.existing(this);
  }

  navigateTo(tx: number, ty: number): void {
    this.waypoints = [];
    this.atTarget = false;
    this.behavior = 'walking';

    const myFloor  = this.y < (FLOOR_SEP_TOP + FLOOR_SEP_BOT) / 2 ? 'upper' : 'lower';
    const tgtFloor = ty      < (FLOOR_SEP_TOP + FLOOR_SEP_BOT) / 2 ? 'upper' : 'lower';

    if (myFloor !== tgtFloor) {
      const approachY = myFloor === 'lower' ? LOWER_WALK_Y : UPPER_WALK_Y;
      const exitY     = tgtFloor === 'lower' ? LOWER_WALK_Y : UPPER_WALK_Y;
      this.waypoints.push({ x: STAIRS_X, y: approachY });
      this.waypoints.push({ x: STAIRS_X, y: exitY });
    }
    this.waypoints.push({ x: tx, y: ty });
  }

  startAction(behavior: BehaviorState, duration: number): void {
    this.behavior = behavior;
    this.actionDuration = duration;
    this.actionTimer = 0;
    this.atTarget = true;
  }

  showThought(text: string, ms = 4000): void {
    this.thoughtBubble.setText(text).setVisible(true);
    this.thoughtTimer = ms;
  }

  hideThought(): void {
    this.thoughtBubble.setVisible(false);
    this.thoughtTimer = 0;
  }

  update(delta: number): void {
    const dt = delta / 1000;

    // ── Navigation ───────────────────────────────────────────────────────────
    if (this.waypoints.length > 0) {
      const next = this.waypoints[0];
      const dx = next.x - this.x;
      const dy = next.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 3) {
        this.x = next.x;
        this.y = next.y;
        this.waypoints.shift();
        if (this.waypoints.length === 0) {
          this.behavior = 'idle';
          this.atTarget = true;
        }
      } else {
        this.facingRight = dx > 0;
        const spd = CHAR_SPEED * dt;
        this.x += (dx / dist) * spd;
        this.y += (dy / dist) * spd;
        this.behavior = 'walking';
      }
    }

    // ── Action timer ─────────────────────────────────────────────────────────
    if (this.atTarget && this.actionDuration > 0) {
      this.actionTimer += delta;
      if (this.actionTimer >= this.actionDuration) {
        this.actionTimer = 0;
        this.actionDuration = 0;
        this.behavior = 'idle';
      }
    }

    // ── Walk animation ───────────────────────────────────────────────────────
    if (this.behavior === 'walking') {
      this.walkTimer += delta;
      if (this.walkTimer > 140) { this.walkTimer = 0; this.walkFrame = (this.walkFrame + 1) % 4; }
    } else {
      this.walkFrame = 0; this.walkTimer = 0;
    }

    // ── Idle bounce ──────────────────────────────────────────────────────────
    if (this.behavior === 'idle') {
      this.idleBounce += this.idleBounceDir * 0.5 * dt * 60;
      if (Math.abs(this.idleBounce) > 1) this.idleBounceDir *= -1;
    } else { this.idleBounce = 0; }

    // ── Sleep Z's ────────────────────────────────────────────────────────────
    if (this.behavior === 'sleeping') {
      this.zTimer += delta;
      if (this.zTimer > 900) {
        this.zTimer = 0;
        const zs = ['z', 'zz', 'zzz'];
        this.zText.setText(zs[Math.floor(Math.random() * zs.length)]).setVisible(true);
        this.scene.time.delayedCall(700, () => this.zText.setVisible(false));
      }
    } else { this.zText.setVisible(false); this.zTimer = 0; }

    // ── Thought timer ─────────────────────────────────────────────────────────
    if (this.thoughtTimer > 0) {
      this.thoughtTimer -= delta;
      if (this.thoughtTimer <= 0) this.hideThought();
    }

    this.redraw();
  }

  private redraw(): void {
    const g = this.gfx;
    g.clear();
    const px = PX;
    const bounce = Math.round(this.idleBounce);

    if (this.behavior === 'sleeping') {
      this.drawSleeping(g, px);
      return;
    }

    const ox = -5 * px; // center: sprite is 10px wide
    const oy = (-BODY.length - 4) * px + bounce; // top of head, adjusted for legs

    // Flip if facing left
    const flipMat = this.facingRight
      ? undefined
      : { a: -1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };

    if (flipMat) {
      // Mirror by drawing at positive x and using negative scale trick with offset
      this.gfx.setX(5 * px); // pivot to sprite center
    } else {
      this.gfx.setX(0);
    }

    // Outline pass
    drawSpriteOutline(g, BODY, px, ox + (flipMat ? 0 : 0), oy);

    // Color pass
    if (!this.facingRight) {
      this.drawFlipped(g, BODY, px, ox, oy);
    } else {
      drawSprite(g, BODY, px, ox, oy);
    }

    // Legs
    const legsY = oy + BODY.length * px;
    const lf = legsFrame(this.walkFrame);

    const lox = ox + lf.lx * px;
    const rox = ox + lf.rx * px;

    if (this.facingRight) {
      drawSpriteOutline(g, lf.left, px, lox, legsY);
      drawSprite(g, lf.left, px, lox, legsY);
      drawSpriteOutline(g, lf.right, px, rox, legsY);
      drawSprite(g, lf.right, px, rox, legsY);
    } else {
      this.drawFlippedOutline(g, lf.left,  px, ox + (9 - lf.lx - 3) * px, legsY);
      this.drawFlipped(g, lf.left,  px, ox + (9 - lf.lx - 3) * px, legsY);
      this.drawFlippedOutline(g, lf.right, px, ox + (9 - lf.rx - 3) * px, legsY);
      this.drawFlipped(g, lf.right, px, ox + (9 - lf.rx - 3) * px, legsY);
    }
  }

  private drawFlipped(g: Phaser.GameObjects.Graphics, rows: Row[], px: number, ox: number, oy: number): void {
    const w = (rows[0]?.length ?? 0) - 1;
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      for (let col = 0; col < row.length; col++) {
        const color = row[col];
        if (color !== null) {
          g.fillStyle(color, 1);
          g.fillRect(ox + (w - col) * px, oy + r * px, px, px);
        }
      }
    }
  }

  private drawFlippedOutline(g: Phaser.GameObjects.Graphics, rows: Row[], px: number, ox: number, oy: number): void {
    const offsets = [[-1,0],[1,0],[0,-1],[0,1]];
    const w = (rows[0]?.length ?? 0) - 1;
    g.fillStyle(C.outline, 1);
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      for (let col = 0; col < row.length; col++) {
        if (row[col] !== null) {
          for (const [dx, dy] of offsets) {
            const nc = w - (col + dx);
            const nr = r + dy;
            if (rows[nr]?.[w - (col + dx)] === undefined || rows[nr]?.[nc] === null) {
              g.fillRect(ox + (w - col + dx) * px, oy + (r + dy) * px, px, px);
            }
          }
        }
      }
    }
  }

  private drawSleeping(g: Phaser.GameObjects.Graphics, px: number): void {
    const ox = -11 * px;
    const oy = -4 * px;
    drawSpriteOutline(g, SLEEP, px, ox, oy);
    drawSprite(g, SLEEP, px, ox, oy);
  }
}
