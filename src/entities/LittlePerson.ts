import Phaser from 'phaser';
import {
  CHAR_SPEED, CHAR_W, CHAR_H,
  LOWER_WALK_Y, UPPER_WALK_Y,
  FLOOR_SEP_TOP, FLOOR_SEP_BOT, STAIRS_X,
  LEFT_ROOM_RIGHT, RIGHT_ROOM_LEFT,
  COLORS,
} from '../config';
import type { BehaviorState, Needs } from '../types';

interface Waypoint { x: number; y: number }

const SKIN  = COLORS.skin;
const HAIR  = COLORS.hair;

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
  private thoughtText: Phaser.GameObjects.Text;
  private thoughtTimer = 0;
  private bounceOffset = 0;
  private bounceDir = 1;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    this.gfx = scene.add.graphics();
    this.add(this.gfx);

    this.thoughtText = scene.add.text(0, -CHAR_H - 14, '', {
      fontSize: '8px',
      color: '#1a1a1a',
      backgroundColor: '#fff9c4',
      padding: { x: 4, y: 2 },
      wordWrap: { width: 120 },
    }).setOrigin(0.5, 1).setVisible(false);
    this.add(this.thoughtText);

    scene.add.existing(this);
    this.draw();
  }

  navigateTo(tx: number, ty: number): void {
    this.waypoints = [];
    this.atTarget = false;
    this.behavior = 'walking';

    const myFloor  = this.y < (FLOOR_SEP_TOP + FLOOR_SEP_BOT) / 2 ? 'upper' : 'lower';
    const tgtFloor = ty      < (FLOOR_SEP_TOP + FLOOR_SEP_BOT) / 2 ? 'upper' : 'lower';

    if (myFloor !== tgtFloor) {
      // Walk to staircase, cross floor, then go to target
      const stairsApproachY = myFloor === 'lower' ? LOWER_WALK_Y : UPPER_WALK_Y;
      const stairsExitY     = tgtFloor === 'lower' ? LOWER_WALK_Y : UPPER_WALK_Y;
      this.waypoints.push({ x: STAIRS_X, y: stairsApproachY });
      this.waypoints.push({ x: STAIRS_X, y: stairsExitY });
    }

    this.waypoints.push({ x: tx, y: ty });
  }

  startAction(behavior: BehaviorState, duration: number): void {
    this.behavior = behavior;
    this.actionDuration = duration;
    this.actionTimer = 0;
    this.atTarget = true;
  }

  showThought(text: string, durationMs = 4000): void {
    this.thoughtText.setText(text).setVisible(true);
    this.thoughtTimer = durationMs;
  }

  hideThought(): void {
    this.thoughtText.setVisible(false);
    this.thoughtTimer = 0;
  }

  update(delta: number): void {
    const dt = delta / 1000;

    // Move along waypoints
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
        const speed = CHAR_SPEED * dt;
        this.facingRight = dx > 0;
        this.x += (dx / dist) * speed;
        this.y += (dy / dist) * speed;
        this.behavior = 'walking';
      }
    }

    // Action timer
    if (this.atTarget && this.actionDuration > 0) {
      this.actionTimer += delta;
      if (this.actionTimer >= this.actionDuration) {
        this.actionTimer = 0;
        this.actionDuration = 0;
        this.behavior = 'idle';
        this.atTarget = true;
      }
    }

    // Walk animation frame
    if (this.behavior === 'walking') {
      this.walkTimer += delta;
      if (this.walkTimer > 160) {
        this.walkTimer = 0;
        this.walkFrame = (this.walkFrame + 1) % 4;
      }
    } else {
      this.walkFrame = 0;
      this.walkTimer = 0;
    }

    // Idle bounce
    if (this.behavior === 'idle' || this.behavior === 'watching_tv' || this.behavior === 'using_computer') {
      this.bounceOffset += this.bounceDir * 0.4 * dt * 60;
      if (Math.abs(this.bounceOffset) > 0.8) this.bounceDir *= -1;
    } else {
      this.bounceOffset = 0;
    }

    // Thought bubble timer
    if (this.thoughtTimer > 0) {
      this.thoughtTimer -= delta;
      if (this.thoughtTimer <= 0) this.hideThought();
    }

    this.draw();
  }

  private draw(): void {
    const g = this.gfx;
    g.clear();

    const flip = this.facingRight ? 1 : -1;
    const isSleeping = this.behavior === 'sleeping';
    const isShowering = this.behavior === 'showering';

    if (isSleeping) {
      this.drawSleeping(g);
      return;
    }

    // Walk animation: leg/arm angles
    const legSwing = this.behavior === 'walking'
      ? Math.sin(this.walkFrame * Math.PI / 2) * 5
      : 0;
    const armSwing = -legSwing;

    const cy = Math.round(this.bounceOffset);

    // Shoes
    g.fillStyle(COLORS.shoes, 1);
    g.fillRect(-5, cy + 10, 5, 3);
    g.fillRect(1, cy + 10, 5, 3);

    // Legs (pants)
    g.fillStyle(COLORS.pants, 1);
    // left leg
    g.fillRect(-5 + Math.round(legSwing * flip), cy + 1, 4, 10);
    // right leg
    g.fillRect(1 + Math.round(-legSwing * flip), cy + 1, 4, 10);

    // Body / torso
    const shirtColor = (this.behavior === 'sleeping') ? COLORS.shirtPajama : COLORS.shirt;
    g.fillStyle(shirtColor, 1);
    g.fillRect(-6, cy - 12, 12, 14);

    // Arms
    g.fillStyle(shirtColor, 1);
    // left arm
    g.fillRect(-9, cy - 11 + Math.round(armSwing * flip), 3, 8);
    // right arm
    if (this.behavior === 'eating' || this.behavior === 'cooking') {
      g.fillRect(6, cy - 16, 3, 8);  // arm raised
    } else if (this.behavior === 'using_computer') {
      g.fillRect(6, cy - 8, 3, 5);
      g.fillRect(-9, cy - 8, 3, 5);
    } else {
      g.fillRect(6, cy - 11 + Math.round(-armSwing * flip), 3, 8);
    }

    // Neck
    g.fillStyle(SKIN, 1);
    g.fillRect(-2, cy - 14, 4, 3);

    // Head
    g.fillStyle(SKIN, 1);
    g.fillRect(-5, cy - 25, 10, 11);

    // Hair
    g.fillStyle(HAIR, 1);
    g.fillRect(-5, cy - 25, 10, 4);

    // Eye
    g.fillStyle(0x000000, 1);
    if (flip > 0) {
      g.fillRect(1, cy - 20, 2, 2);
    } else {
      g.fillRect(-3, cy - 20, 2, 2);
    }

    // Shower effect
    if (isShowering) {
      g.fillStyle(0x29b6f6, 0.4);
      for (let i = 0; i < 5; i++) {
        g.fillRect(-8 + i * 4, cy - 28 - (Math.floor(Date.now() / 200 + i) % 6) * 3, 2, 5);
      }
    }
  }

  private drawSleeping(g: Phaser.GameObjects.Graphics): void {
    // Lying down (rotated)
    g.fillStyle(COLORS.bedSheet, 1);
    g.fillRect(-16, -6, 32, 10);

    g.fillStyle(SKIN, 1);
    g.fillRect(-21, -7, 10, 10);  // head on pillow

    g.fillStyle(HAIR, 1);
    g.fillRect(-21, -7, 10, 3);

    // Z Z Z
    g.fillStyle(0xffd54f, 0.9);
    g.fillRect(-24, -14, 4, 4);
    g.fillRect(-20, -20, 5, 5);
    g.fillRect(-14, -26, 6, 6);
  }
}
