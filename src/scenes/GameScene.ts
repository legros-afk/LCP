import Phaser from 'phaser';
import {
  W, H, WALL, FLOOR_SEP_TOP, FLOOR_SEP_BOT,
  LOWER_Y_TOP, LOWER_Y_BOT, UPPER_Y_TOP, UPPER_Y_BOT,
  LEFT_ROOM_RIGHT, RIGHT_ROOM_LEFT, DIVIDER,
  LOWER_WALK_Y, UPPER_WALK_Y,
  STAIRS_X, GAME_MINUTES_PER_SECOND, GAME_START_HOUR,
  COLORS,
} from '../config';
import type { FurnitureItem, GameTimeData } from '../types';
import { LittlePerson } from '../entities/LittlePerson';
import { BehaviorAI } from '../systems/BehaviorAI';
import { tickNeeds, applyPlayerFeed, applyPlayerChat, applyPlayerBell } from '../systems/NeedsSystem';

const FURNITURE: FurnitureItem[] = [
  // Lower floor – Living Room
  { id: 'bookshelf', x: 20,  y: LOWER_Y_TOP + 40, width: 20, height: 100, floor: 'lower', action: 'reading',        label: 'Bookshelf' },
  { id: 'sofa',      x: 60,  y: LOWER_Y_BOT - 45, width: 100, height: 35, floor: 'lower', action: 'watching_tv',    label: 'Sofa' },
  { id: 'tv',        x: 345, y: LOWER_Y_TOP + 30, width: 14,  height: 60, floor: 'lower', action: 'watching_tv',    label: 'TV' },
  // Lower floor – Kitchen
  { id: 'stove',     x: 415, y: LOWER_Y_TOP + 90, width: 80,  height: 25, floor: 'lower', action: 'cooking',        label: 'Stove' },
  { id: 'fridge',    x: 750, y: LOWER_Y_TOP + 30, width: 28,  height: 90, floor: 'lower', action: null,             label: 'Fridge' },
  { id: 'table',     x: 570, y: LOWER_Y_BOT - 45, width: 100, height: 18, floor: 'lower', action: 'eating',         label: 'Table' },
  // Upper floor – Bedroom
  { id: 'bed',       x: 28,  y: UPPER_Y_BOT - 48, width: 130, height: 38, floor: 'upper', action: 'sleeping',       label: 'Bed' },
  { id: 'computer',  x: 310, y: UPPER_Y_BOT - 42, width: 65,  height: 18, floor: 'upper', action: 'using_computer', label: 'Computer' },
  // Upper floor – Bathroom
  { id: 'shower',    x: 415, y: UPPER_Y_TOP + 15,  width: 75,  height: 120, floor: 'upper', action: 'showering',   label: 'Shower' },
  { id: 'toiletseat',x: 695, y: UPPER_Y_BOT - 55, width: 38,  height: 50, floor: 'upper', action: null,             label: 'Toilet' },
  { id: 'bathroomsink', x: 565, y: UPPER_Y_BOT - 30, width: 50, height: 18, floor: 'upper', action: null,          label: 'Sink' },
];

const FURNITURE_WALK_OFFSET: Partial<Record<string, { dx: number; dy: number }>> = {
  bookshelf:    { dx: 28, dy: 0 },
  sofa:         { dx: 50, dy: 0 },
  tv:           { dx: -25, dy: 0 },
  stove:        { dx: 40, dy: 0 },
  fridge:       { dx: -20, dy: 0 },
  table:        { dx: 50, dy: 0 },
  bed:          { dx: 50, dy: 0 },
  computer:     { dx: 32, dy: 0 },
  shower:       { dx: 37, dy: 60 },
  toiletseat:   { dx: 19, dy: 0 },
  bathroomsink: { dx: 25, dy: 0 },
};

export class GameScene extends Phaser.Scene {
  private person!: LittlePerson;
  private ai!: BehaviorAI;
  private houseBg!: Phaser.GameObjects.Graphics;
  private scanlines!: Phaser.GameObjects.Graphics;

  private gameTime: GameTimeData = {
    hour: GAME_START_HOUR,
    minute: 0,
    totalMinutes: GAME_START_HOUR * 60,
  };
  private gameTimeAccum = 0;

  private pendingPlayerAction: 'feed' | 'chat' | 'bell' | null = null;
  private aiActionTimer = 0;
  private aiActionDuration = 0;
  private currentAIFurniture: FurnitureItem | null = null;

  private tvScreenOn = false;
  private monitorOn = false;

  constructor() { super('GameScene'); }

  create(): void {
    this.houseBg = this.add.graphics();
    this.drawHouse();

    this.person = new LittlePerson(this, 150, LOWER_WALK_Y);

    this.drawScanlines();

    // Expose API to UIScene
    this.game.registry.set('gameScene', this);

    this.ai = new BehaviorAI(FURNITURE);
    this.aiActionTimer = 0;

    // Input: click on house to walk there
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      if (ptr.y > 505) return; // in UI area
      const tx = Phaser.Math.Clamp(ptr.x, WALL + 10, W - WALL - 10);
      const ty = this.snapToFloor(ptr.y);
      this.person.navigateTo(tx, ty);
    });
  }

  private snapToFloor(y: number): number {
    const mid = (FLOOR_SEP_TOP + FLOOR_SEP_BOT) / 2;
    return y < mid ? UPPER_WALK_Y : LOWER_WALK_Y;
  }

  // Called by UIScene buttons
  triggerFeed(): void  { this.pendingPlayerAction = 'feed'; }
  triggerChat(): void  { this.pendingPlayerAction = 'chat'; }
  triggerBell(): void  { this.pendingPlayerAction = 'bell'; }

  getNeeds()    { return this.person.needs; }
  getGameTime() { return this.gameTime; }
  getBehavior() { return this.person.behavior; }

  update(time: number, delta: number): void {
    // Advance in-game clock
    this.gameTimeAccum += delta * GAME_MINUTES_PER_SECOND;
    while (this.gameTimeAccum >= 1000) {
      this.gameTimeAccum -= 1000;
      this.gameTime.totalMinutes = (this.gameTime.totalMinutes + 1) % (24 * 60);
      this.gameTime.hour   = Math.floor(this.gameTime.totalMinutes / 60);
      this.gameTime.minute = this.gameTime.totalMinutes % 60;
    }

    // Tick needs
    tickNeeds(this.person.needs, this.person.behavior, delta);

    // Player interactions
    if (this.pendingPlayerAction) {
      switch (this.pendingPlayerAction) {
        case 'feed':
          applyPlayerFeed(this.person.needs);
          this.person.showThought('Yum! Thank you! 😊', 3500);
          break;
        case 'chat':
          applyPlayerChat(this.person.needs);
          this.person.showThought(this.pickChatResponse(), 4000);
          break;
        case 'bell': {
          const playerName = this.game.registry.get('personName') as string ?? '';
          applyPlayerBell(this.person.needs);
          this.person.showThought(playerName ? `Oh! Hi ${playerName}! 👋` : 'Oh! Hello there! 👋', 2500);
          this.person.navigateTo(200, LOWER_WALK_Y);
          break;
        }
      }
      this.pendingPlayerAction = null;
    }

    // AI decision making
    if (this.person.atTarget || this.person.behavior === 'idle') {
      if (this.aiActionTimer > 0) {
        this.aiActionTimer -= delta;
      } else {
        this.currentAIFurniture = null;
        const target = this.ai.getNextTarget(
          this.person.needs,
          this.gameTime,
          this.person.behavior,
          this.person.atTarget,
          null,
        );

        if (target) {
          const offset = FURNITURE_WALK_OFFSET[target.furniture.id] ?? { dx: 0, dy: 0 };
          const wx = target.furniture.x + offset.dx;
          const wy = target.furniture.floor === 'lower' ? LOWER_WALK_Y : UPPER_WALK_Y;
          this.person.navigateTo(wx, wy);
          this.currentAIFurniture = target.furniture;
          this.aiActionDuration = target.duration < 0 ? 999999 : target.duration;
          this.aiActionTimer = this.aiActionDuration;

          // Start action after arrival (handled in update next frame once atTarget)
          this.time.delayedCall(800, () => {
            if (this.currentAIFurniture) {
              this.person.startAction(target.behavior, this.aiActionDuration);
              this.updateAppliances(target.behavior, true);
            }
          });
        } else {
          // Idle wander
          const idleX = 50 + Math.random() * 700;
          const idleFloor = Math.random() > 0.4 ? 'lower' : 'upper';
          const idleY = idleFloor === 'lower' ? LOWER_WALK_Y : UPPER_WALK_Y;
          if (Math.random() > 0.6) this.person.navigateTo(idleX, idleY);
          this.aiActionTimer = 4000 + Math.random() * 6000;
        }
      }
    }

    this.person.update(delta);
    this.redrawDynamicElements();
  }

  private updateAppliances(behavior: string, on: boolean): void {
    this.tvScreenOn  = behavior === 'watching_tv' ? on : this.tvScreenOn;
    this.monitorOn   = behavior === 'using_computer' ? on : this.monitorOn;
    this.drawHouse();
  }

  private pickChatResponse(): string {
    const n = this.person.needs;
    if (n.hunger < 25) return 'I could really use some food...';
    if (n.energy < 25) return 'I\'m so tired... zzzz';
    if (n.hygiene < 25) return 'I should really shower...';
    if (n.happiness > 70) return 'Life is pretty great! 😄';
    const responses = [
      'Hello there! Nice to see you!',
      'What a nice day it is.',
      'I was just thinking about you!',
      'Do you want to play a game?',
      'The weather looks nice outside.',
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  private redrawDynamicElements(): void {
    // Dynamic elements (TV screen, monitor) are redrawn infrequently
  }

  // ──────────────────────────────────────────────────────────
  // House drawing
  // ──────────────────────────────────────────────────────────

  private drawHouse(): void {
    const g = this.houseBg;
    g.clear();

    this.drawExterior(g);
    this.drawLowerFloor(g);
    this.drawUpperFloor(g);
    this.drawFloorSeparator(g);
    this.drawStairs(g);
    this.drawWindows(g);
    this.drawRoof(g);
  }

  private drawExterior(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(COLORS.exteriorBg, 1);
    g.fillRect(0, 0, W, H);

    // Stars
    g.fillStyle(0xffffff, 0.7);
    const starPositions = [
      [30,10],[80,5],[150,20],[250,8],[350,15],[450,5],[550,12],[650,8],[720,18],[770,4],
      [20,25],[100,30],[200,12],[300,25],[400,20],[500,28],[600,15],[700,22],[780,28],
    ];
    for (const [sx, sy] of starPositions) {
      g.fillRect(sx, sy, 1, 1);
    }
  }

  private drawLowerFloor(g: Phaser.GameObjects.Graphics): void {
    // Floor background
    g.fillStyle(COLORS.wallInner, 1);
    g.fillRect(WALL, LOWER_Y_TOP, W - WALL * 2, LOWER_Y_BOT - LOWER_Y_TOP);

    // Floor boards
    g.fillStyle(COLORS.floorBoard, 1);
    g.fillRect(WALL, LOWER_Y_BOT - 8, W - WALL * 2, 8);
    g.fillStyle(COLORS.floorDark, 1);
    for (let x = WALL; x < W - WALL; x += 30) {
      g.fillRect(x, LOWER_Y_BOT - 8, 1, 8);
    }

    // Room divider
    g.fillStyle(COLORS.wallOuter, 1);
    g.fillRect(LEFT_ROOM_RIGHT, LOWER_Y_TOP, DIVIDER, LOWER_Y_BOT - LOWER_Y_TOP - 8);

    // Outer walls
    g.fillStyle(COLORS.wallOuter, 1);
    g.fillRect(0, LOWER_Y_TOP, WALL, LOWER_Y_BOT);
    g.fillRect(W - WALL, LOWER_Y_TOP, WALL, LOWER_Y_BOT);

    // ── Living Room furniture ──
    this.drawBookshelf(g, 20, LOWER_Y_TOP + 40);
    this.drawSofa(g, 60, LOWER_Y_BOT - 45);
    this.drawTV(g, 345, LOWER_Y_TOP + 25);

    // Room label
    this.drawRoomLabel(g, 'LIVING ROOM', 210, LOWER_Y_TOP + 12);

    // ── Kitchen furniture ──
    this.drawKitchenCounter(g, 415, LOWER_Y_TOP + 80);
    this.drawFridge(g, 750, LOWER_Y_TOP + 22);
    this.drawKitchenTable(g, 570, LOWER_Y_BOT - 45);

    this.drawRoomLabel(g, 'KITCHEN', 580, LOWER_Y_TOP + 12);
  }

  private drawUpperFloor(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(COLORS.wallInner, 1);
    g.fillRect(WALL, UPPER_Y_TOP, W - WALL * 2, UPPER_Y_BOT - UPPER_Y_TOP);

    // Ceiling line
    g.fillStyle(COLORS.ceilLight, 1);
    g.fillRect(WALL, UPPER_Y_TOP, W - WALL * 2, 6);

    // Floor boards at bottom of upper floor
    g.fillStyle(COLORS.floorBoard, 1);
    g.fillRect(WALL, UPPER_Y_BOT - 6, W - WALL * 2, 6);

    // Room divider
    g.fillStyle(COLORS.wallOuter, 1);
    g.fillRect(LEFT_ROOM_RIGHT, UPPER_Y_TOP, DIVIDER, UPPER_Y_BOT - UPPER_Y_TOP - 6);

    // Outer walls
    g.fillStyle(COLORS.wallOuter, 1);
    g.fillRect(0, UPPER_Y_TOP, WALL, UPPER_Y_BOT - UPPER_Y_TOP);
    g.fillRect(W - WALL, UPPER_Y_TOP, WALL, UPPER_Y_BOT - UPPER_Y_TOP);

    // ── Bedroom ──
    this.drawBed(g, 28, UPPER_Y_BOT - 48);
    this.drawComputerDesk(g, 310, UPPER_Y_BOT - 42);
    this.drawBedLamp(g, 175, UPPER_Y_BOT - 85);

    this.drawRoomLabel(g, 'BEDROOM', 200, UPPER_Y_TOP + 10);

    // ── Bathroom ──
    this.drawBathroomTiles(g);
    this.drawShower(g, 415, UPPER_Y_TOP + 12);
    this.drawBathroomSink(g, 565, UPPER_Y_BOT - 32);
    this.drawToilet(g, 695, UPPER_Y_BOT - 55);
    this.drawMirror(g, 565, UPPER_Y_TOP + 20);

    this.drawRoomLabel(g, 'BATHROOM', 590, UPPER_Y_TOP + 10);
  }

  private drawFloorSeparator(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(COLORS.wallOuter, 1);
    g.fillRect(WALL, FLOOR_SEP_TOP, W - WALL * 2, FLOOR_SEP_BOT - FLOOR_SEP_TOP);
    // Wood grain lines
    g.fillStyle(COLORS.floorDark, 0.4);
    for (let y = FLOOR_SEP_TOP + 6; y < FLOOR_SEP_BOT; y += 6) {
      g.fillRect(WALL, y, W - WALL * 2, 1);
    }
  }

  private drawStairs(g: Phaser.GameObjects.Graphics): void {
    const stairW = 50;
    const sx = STAIRS_X - stairW / 2;
    const steps = 5;
    const stepH = (FLOOR_SEP_BOT - FLOOR_SEP_TOP) / steps;
    const stepW = stairW / steps;
    g.fillStyle(COLORS.stairsColor, 1);
    for (let i = 0; i < steps; i++) {
      g.fillRect(sx + i * stepW, FLOOR_SEP_TOP + i * stepH, stairW - i * stepW, stepH);
    }
    g.fillStyle(COLORS.floorDark, 0.5);
    for (let i = 0; i < steps; i++) {
      g.fillRect(sx + i * stepW, FLOOR_SEP_TOP + i * stepH, stairW - i * stepW, 1);
    }
  }

  private drawWindows(g: Phaser.GameObjects.Graphics): void {
    const isNight = this.gameTime.hour < 6 || this.gameTime.hour >= 20;
    const glassColor = isNight ? COLORS.windowGlassNight : COLORS.windowGlass;

    // Living room window
    this.drawWindow(g, 230, LOWER_Y_TOP + 30, 70, 55, glassColor);
    // Kitchen window
    this.drawWindow(g, 550, LOWER_Y_TOP + 30, 70, 55, glassColor);
    // Bedroom window
    this.drawWindow(g, 170, UPPER_Y_TOP + 20, 70, 55, glassColor);
  }

  private drawWindow(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, glass: number): void {
    g.fillStyle(COLORS.windowFrame, 1);
    g.fillRect(x - 4, y - 4, w + 8, h + 8);
    g.fillStyle(glass, 1);
    g.fillRect(x, y, w, h);
    // Pane cross
    g.fillStyle(COLORS.windowFrame, 1);
    g.fillRect(x + w / 2 - 1, y, 2, h);
    g.fillRect(x, y + h / 2 - 1, w, 2);
  }

  private drawRoof(g: Phaser.GameObjects.Graphics): void {
    // Simple gable roof
    g.fillStyle(COLORS.wallOuter, 1);
    g.fillTriangle(W / 2, 0, WALL - 5, UPPER_Y_TOP, W - WALL + 5, UPPER_Y_TOP);
    // Chimney
    g.fillStyle(COLORS.wallOuter, 1);
    g.fillRect(W * 0.7, 0, 22, 26);
    g.fillStyle(0x444444, 1);
    g.fillRect(W * 0.7 + 3, 0, 16, 4);
  }

  private drawRoomLabel(g: Phaser.GameObjects.Graphics, _label: string, _x: number, _y: number): void {
    // Labels are added via Text objects in a separate pass — skip here
  }

  // ── Furniture drawing helpers ──

  private drawBookshelf(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
    g.fillStyle(COLORS.bookshelf, 1);
    g.fillRect(x, y, 20, 100);
    const books = [COLORS.bookA, COLORS.bookB, COLORS.bookC, COLORS.bookD, COLORS.bookA, COLORS.bookC];
    let by = y + 6;
    for (const c of books) {
      g.fillStyle(c, 1);
      g.fillRect(x + 2, by, 16, 12);
      by += 14;
    }
  }

  private drawSofa(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
    // Back rest
    g.fillStyle(COLORS.sofa, 1);
    g.fillRect(x, y - 20, 100, 20);
    // Seat
    g.fillStyle(COLORS.sofaCushion, 1);
    g.fillRect(x, y, 100, 22);
    // Arm rests
    g.fillStyle(COLORS.sofa, 1);
    g.fillRect(x, y - 20, 12, 40);
    g.fillRect(x + 88, y - 20, 12, 40);
    // Legs
    g.fillStyle(COLORS.bookshelf, 1);
    g.fillRect(x + 6, y + 22, 8, 6);
    g.fillRect(x + 86, y + 22, 8, 6);
  }

  private drawTV(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
    // TV stand
    g.fillStyle(COLORS.bookshelf, 1);
    g.fillRect(x - 20, y + 60, 50, 8);
    g.fillRect(x + 2, y + 52, 8, 10);
    // TV body
    g.fillStyle(COLORS.tv, 1);
    g.fillRect(x - 24, y, 56, 52);
    // Screen
    const screenColor = this.tvScreenOn ? COLORS.tvScreen : COLORS.tvScreenOff;
    g.fillStyle(screenColor, 1);
    g.fillRect(x - 20, y + 4, 48, 42);
    if (this.tvScreenOn) {
      // Scan lines effect on screen
      g.fillStyle(0x000000, 0.2);
      for (let sy = y + 4; sy < y + 46; sy += 4) {
        g.fillRect(x - 20, sy, 48, 1);
      }
    }
  }

  private drawKitchenCounter(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
    // Counter top
    g.fillStyle(COLORS.counter, 1);
    g.fillRect(x, y, 120, 16);
    // Counter body
    g.fillStyle(0x8d6e63, 1);
    g.fillRect(x, y + 16, 120, 80);
    // Stove on counter
    g.fillStyle(COLORS.stove, 1);
    g.fillRect(x + 10, y - 18, 70, 20);
    const burnerColor = this.tvScreenOn ? COLORS.stoveHot : 0x555555;
    g.fillStyle(burnerColor, 1);
    g.fillCircle(x + 25, y - 8, 6);
    g.fillCircle(x + 55, y - 8, 6);
    // Sink
    g.fillStyle(COLORS.sink, 1);
    g.fillRect(x + 88, y - 4, 28, 20);
    g.fillStyle(COLORS.sinkBasin, 1);
    g.fillRect(x + 90, y - 2, 24, 14);
    g.fillStyle(0x888, 1);
    g.fillRect(x + 100, y + 2, 4, 8); // tap
  }

  private drawFridge(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
    g.fillStyle(COLORS.fridge, 1);
    g.fillRect(x, y, 28, 90);
    g.fillStyle(COLORS.fridgeLine, 1);
    g.fillRect(x, y + 35, 28, 2);  // freezer line
    g.fillRect(x + 23, y + 10, 3, 15);  // handle top
    g.fillRect(x + 23, y + 50, 3, 15);  // handle bottom
  }

  private drawKitchenTable(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
    // Table top
    g.fillStyle(COLORS.table, 1);
    g.fillRect(x, y, 100, 15);
    // Legs
    g.fillStyle(COLORS.chair, 1);
    g.fillRect(x + 4, y + 15, 8, 20);
    g.fillRect(x + 88, y + 15, 8, 20);
    // Chairs
    g.fillStyle(COLORS.chair, 1);
    // Left chair
    g.fillRect(x - 26, y + 2, 22, 12); // seat
    g.fillRect(x - 26, y - 14, 22, 14); // back
    g.fillRect(x - 22, y + 14, 6, 14); // legs
    g.fillRect(x - 8, y + 14, 6, 14);
    // Right chair
    g.fillRect(x + 104, y + 2, 22, 12);
    g.fillRect(x + 104, y - 14, 22, 14);
    g.fillRect(x + 108, y + 14, 6, 14);
    g.fillRect(x + 122, y + 14, 6, 14);
  }

  private drawBed(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
    // Frame
    g.fillStyle(COLORS.bed, 1);
    g.fillRect(x, y, 130, 38);
    // Mattress / sheet
    g.fillStyle(COLORS.bedSheet, 1);
    g.fillRect(x + 4, y + 4, 122, 26);
    // Pillow
    g.fillStyle(COLORS.bedPillow, 1);
    g.fillRect(x + 6, y + 6, 30, 20);
    // Headboard
    g.fillStyle(COLORS.bed, 1);
    g.fillRect(x, y - 14, 130, 14);
    // Legs
    g.fillStyle(0x1a1a6e, 1);
    g.fillRect(x + 4, y + 38, 10, 8);
    g.fillRect(x + 116, y + 38, 10, 8);
  }

  private drawComputerDesk(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
    // Desk surface
    g.fillStyle(COLORS.deskWood, 1);
    g.fillRect(x, y, 70, 12);
    // Desk legs
    g.fillRect(x + 4, y + 12, 6, 24);
    g.fillRect(x + 60, y + 12, 6, 24);
    // Monitor
    g.fillStyle(COLORS.monitor, 1);
    g.fillRect(x + 8, y - 28, 38, 28);
    const monScreen = this.monitorOn ? COLORS.monitorScreen : 0x111111;
    g.fillStyle(monScreen, 1);
    g.fillRect(x + 10, y - 26, 34, 22);
    if (this.monitorOn) {
      // Text lines on screen
      g.fillStyle(0x4499ff, 0.6);
      for (let row = 0; row < 4; row++) {
        g.fillRect(x + 12, y - 23 + row * 5, 20 + Math.random() * 10, 2);
      }
    }
    // Monitor stand
    g.fillStyle(COLORS.monitor, 1);
    g.fillRect(x + 24, y - 2, 6, 4);
    g.fillRect(x + 18, y + 2, 18, 3);
    // Keyboard
    g.fillStyle(0x888, 1);
    g.fillRect(x + 5, y + 4, 40, 6);
  }

  private drawBedLamp(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
    g.fillStyle(COLORS.lampPost, 1);
    g.fillRect(x, y + 30, 4, 55);
    g.fillRect(x - 8, y + 80, 20, 4);  // base
    // Shade
    g.fillStyle(COLORS.lamp, 0.9);
    g.fillTriangle(x - 14, y + 30, x + 18, y + 30, x + 2, y);
    // Glow
    g.fillStyle(COLORS.lamp, 0.15);
    g.fillCircle(x + 2, y + 15, 22);
  }

  private drawBathroomTiles(g: Phaser.GameObjects.Graphics): void {
    const tileSize = 14;
    for (let tx = RIGHT_ROOM_LEFT; tx < W - WALL; tx += tileSize) {
      for (let ty = UPPER_Y_TOP; ty < UPPER_Y_BOT; ty += tileSize) {
        g.fillStyle(COLORS.tile, 1);
        g.fillRect(tx, ty, tileSize - 1, tileSize - 1);
      }
    }
    g.fillStyle(COLORS.tileGrout, 0.3);
    for (let tx = RIGHT_ROOM_LEFT; tx < W - WALL; tx += tileSize) {
      g.fillRect(tx, UPPER_Y_TOP, 1, UPPER_Y_BOT - UPPER_Y_TOP);
    }
    for (let ty = UPPER_Y_TOP; ty < UPPER_Y_BOT; ty += tileSize) {
      g.fillRect(RIGHT_ROOM_LEFT, ty, W - WALL - RIGHT_ROOM_LEFT, 1);
    }
  }

  private drawShower(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
    // Walls
    g.fillStyle(COLORS.showerWall, 1);
    g.fillRect(x, y, 75, 120);
    // Glass door
    g.fillStyle(0x29b6f6, 0.3);
    g.fillRect(x, y, 15, 120);
    // Shower head
    g.fillStyle(0x888, 1);
    g.fillRect(x + 55, y + 10, 4, 20);
    g.fillRect(x + 45, y + 8, 24, 6);
    // Shower tray
    g.fillStyle(0xbdbdbd, 1);
    g.fillRect(x + 2, y + 112, 71, 8);
    // Drain
    g.fillStyle(0x888, 1);
    g.fillRect(x + 33, y + 113, 10, 6);
  }

  private drawBathroomSink(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
    g.fillStyle(COLORS.bathroomSink, 1);
    g.fillRect(x, y, 50, 18);
    g.fillStyle(COLORS.bathroomSinkB, 1);
    g.fillRect(x + 4, y + 4, 42, 10);
    // Tap
    g.fillStyle(0x888, 1);
    g.fillRect(x + 22, y - 12, 6, 14);
    g.fillRect(x + 14, y - 14, 22, 4);
  }

  private drawToilet(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
    // Tank
    g.fillStyle(COLORS.toilet, 1);
    g.fillRect(x, y, 38, 22);
    // Bowl
    g.fillStyle(COLORS.toilet, 1);
    g.fillRect(x - 2, y + 22, 42, 28);
    // Seat
    g.fillStyle(COLORS.toiletSeat, 1);
    g.fillRect(x, y + 22, 38, 6);
    g.fillRect(x + 2, y + 22, 34, 22);
  }

  private drawMirror(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
    g.fillStyle(COLORS.bathroomSinkB, 1);
    g.fillRect(x - 4, y - 4, 58, 58);
    g.fillStyle(COLORS.mirror, 1);
    g.fillRect(x, y, 50, 50);
    // Reflection lines
    g.fillStyle(0xffffff, 0.3);
    g.fillRect(x + 6, y + 6, 4, 38);
  }

  private drawScanlines(g_?: Phaser.GameObjects.Graphics): void {
    const g = this.add.graphics().setDepth(100).setScrollFactor(0);
    for (let y = 0; y < H; y += 2) {
      g.fillStyle(0x000000, 0.07);
      g.fillRect(0, y, W, 1);
    }
    this.scanlines = g;
  }
}
