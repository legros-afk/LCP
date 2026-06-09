import Phaser from 'phaser';
import {
  W, H, WALL, FLOOR_SEP_TOP, FLOOR_SEP_BOT,
  LOWER_Y_TOP, LOWER_Y_BOT, UPPER_Y_TOP, UPPER_Y_BOT,
  LEFT_ROOM_RIGHT, RIGHT_ROOM_LEFT, DIVIDER,
  LOWER_WALK_Y, UPPER_WALK_Y, STAIRS_X, UI_Y, C,
} from '../config';
import { PORTRAIT } from '../utils/orientation';
import type { FurnitureItem, GameTimeData } from '../types';
import { LittlePerson } from '../entities/LittlePerson';
import { BehaviorAI } from '../systems/BehaviorAI';
import { tickNeeds, applyPlayerFeed, applyPlayerChat, applyPlayerBell } from '../systems/NeedsSystem';
import { calendarService } from '../services/CalendarService';

// ─── TV channels ─────────────────────────────────────────────────────────────
const TV_CHANNELS = [
  { name: 'NEWS',    screenColor: 0x1a3a66, glowColor: 0x3366bb, thought: 'Watching the news... 📰' },
  { name: 'SPORTS',  screenColor: 0x1a4422, glowColor: 0x33aa55, thought: 'Go go go! ⚽'            },
  { name: 'COOKING', screenColor: 0x441a0a, glowColor: 0xaa5522, thought: 'Cooking show! 🍳'         },
  { name: 'COMEDY',  screenColor: 0x443300, glowColor: 0xddaa00, thought: 'Hahaha 😂 So funny!'     },
  { name: 'NATURE',  screenColor: 0x1a3a22, glowColor: 0x44aa66, thought: 'Nature is beautiful 🌿'  },
];

const FURNITURE: FurnitureItem[] = [
  { id: 'bookshelf', x: 22,  y: LOWER_Y_TOP + 38,  width: 22, height: 110, floor: 'lower', action: 'reading',       label: 'Bookshelf' },
  { id: 'sofa',      x: 62,  y: LOWER_Y_BOT - 50,  width: 110, height: 40, floor: 'lower', action: 'watching_tv',   label: 'Sofa' },
  { id: 'tv',        x: 342, y: LOWER_Y_TOP + 28,  width: 16,  height: 65, floor: 'lower', action: 'watching_tv',   label: 'TV' },
  { id: 'stove',     x: 418, y: LOWER_Y_TOP + 85,  width: 85,  height: 28, floor: 'lower', action: 'cooking',       label: 'Stove' },
  { id: 'fridge',    x: 748, y: LOWER_Y_TOP + 25,  width: 30,  height: 95, floor: 'lower', action: null,            label: 'Fridge' },
  { id: 'table',     x: 568, y: LOWER_Y_BOT - 48,  width: 105, height: 20, floor: 'lower', action: 'eating',        label: 'Table' },
  { id: 'bed',       x: 25,  y: UPPER_Y_BOT - 50,  width: 135, height: 42, floor: 'upper', action: 'sleeping',      label: 'Bed' },
  { id: 'computer',  x: 308, y: UPPER_Y_BOT - 44,  width: 68,  height: 20, floor: 'upper', action: 'using_computer',label: 'Computer' },
  { id: 'shower',    x: 418, y: UPPER_Y_TOP + 14,  width: 78,  height: 125, floor: 'upper', action: 'showering',    label: 'Shower' },
  { id: 'toiletseat',x: 698, y: UPPER_Y_BOT - 58,  width: 40,  height: 52, floor: 'upper', action: null,            label: 'Toilet' },
  { id: 'sink',      x: 566, y: UPPER_Y_BOT - 32,  width: 52,  height: 20, floor: 'upper', action: null,            label: 'Sink' },
  { id: 'exercise_mat', x: 195, y: LOWER_Y_BOT - 20, width: 55, height: 12, floor: 'lower', action: 'exercising',    label: 'Exercise Mat' },
  { id: 'radio',        x: 22,  y: LOWER_Y_BOT - 52, width: 20, height: 18, floor: 'lower', action: 'playing_music', label: 'Radio' },
];

const WALK_OFFSETS: Partial<Record<string, { dx: number }>> = {
  bookshelf:    { dx: 30 }, sofa:         { dx: 55 }, tv:        { dx: -30 },
  stove:        { dx: 42 }, fridge:       { dx: -22 }, table:    { dx: 52 },
  bed:          { dx: 67 }, computer:     { dx: 34 }, shower:    { dx: 39 },
  toiletseat:   { dx: 20 }, sink:         { dx: 26 },
  exercise_mat: { dx: 27 }, radio:        { dx: 10 },
};

export class GameScene extends Phaser.Scene {
  private person!: LittlePerson;
  private ai!: BehaviorAI;
  private bg!: Phaser.GameObjects.Graphics;

  gameTime: GameTimeData = { hour: 0, minute: 0, totalMinutes: 0 };

  private pendingPlayerAction: 'feed' | 'chat' | 'bell' | null = null;
  private aiActionTimer = 0;
  private currentAIFurniture: FurnitureItem | null = null;
  private tvOn = false;
  private tvChannelIndex = 0;
  private tvChannelTimer = 0;
  private monitorOn = false;
  private lastHourDrawn = -1;

  constructor() { super('GameScene'); }

  create(): void {
    this.bg = this.add.graphics();
    this.syncRealTime();
    this.drawHouse();

    this.person = new LittlePerson(this, 150, LOWER_WALK_Y);
    this.drawScanlines();

    this.game.registry.set('gameScene', this);
    this.ai = new BehaviorAI(FURNITURE);

    if (PORTRAIT) {
      this.cameras.main.setZoom(2);
      this.cameras.main.scrollX = 0;
      this.cameras.main.scrollY = 300;
      // Expose controls for the HTML portrait UI
      (window as any).__lcpTriggerFeed  = () => this.triggerFeed();
      (window as any).__lcpTriggerChat  = () => this.triggerChat();
      (window as any).__lcpTriggerBell  = () => this.triggerBell();
      (window as any).__lcpGoFloor = (floor: 'upper' | 'lower') => {
        const wy = floor === 'upper' ? UPPER_WALK_Y : LOWER_WALK_Y;
        this.person.navigateTo(this.person.x, wy);
      };
    }

    calendarService.init();
    // Refresh calendar events every 10 minutes
    this.time.addEvent({ delay: 600_000, loop: true, callback: () => calendarService.fetchToday() });

    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      if (ptr.y > UI_Y - 3) return;
      const tx = Phaser.Math.Clamp(ptr.x, WALL + 10, W - WALL - 10);
      const ty = ptr.y < (FLOOR_SEP_TOP + FLOOR_SEP_BOT) / 2 ? UPPER_WALK_Y : LOWER_WALK_Y;
      this.person.navigateTo(tx, ty);
    });
  }

  triggerFeed(): void  { this.pendingPlayerAction = 'feed'; }
  triggerChat(): void  { this.pendingPlayerAction = 'chat'; }
  triggerBell(): void  { this.pendingPlayerAction = 'bell'; }

  getNeeds()    { return this.person.needs; }
  getGameTime() { return this.gameTime; }
  getBehavior() { return this.person.behavior; }
  getCalService() { return calendarService; }
  getFloor(): 'upper' | 'lower' {
    return this.person.y < (FLOOR_SEP_TOP + FLOOR_SEP_BOT) / 2 ? 'upper' : 'lower';
  }

  update(_time: number, delta: number): void {
    this.syncRealTime();

    // Redraw if hour changed (lighting changes)
    if (this.gameTime.hour !== this.lastHourDrawn) {
      this.lastHourDrawn = this.gameTime.hour;
      this.drawHouse();
    }

    tickNeeds(this.person.needs, this.person.behavior, delta);

    // Player interactions
    if (this.pendingPlayerAction) {
      const name = this.game.registry.get('personName') as string ?? '';
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
          applyPlayerBell(this.person.needs);
          this.person.showThought(name ? `Oh! Hi ${name}! 👋` : 'Oh! Hello there! 👋', 2500);
          this.person.navigateTo(200, LOWER_WALK_Y);
          break;
        }
      }
      this.pendingPlayerAction = null;
    }

    // AI
    if (this.person.atTarget || this.person.behavior === 'idle') {
      if (this.aiActionTimer > 0) {
        this.aiActionTimer -= delta;
      } else {
        const calEvent = calendarService.getActiveEvent();
        const target = this.ai.getNextTarget(
          this.person.needs, this.gameTime,
          this.person.behavior, this.person.atTarget,
          null, calEvent,
        );

        if (target) {
          const offset = WALK_OFFSETS[target.furniture.id] ?? { dx: 0 };
          const wx = target.furniture.x + offset.dx;
          const wy = target.furniture.floor === 'lower' ? LOWER_WALK_Y : UPPER_WALK_Y;
          this.person.navigateTo(wx, wy);
          this.currentAIFurniture = target.furniture;
          this.aiActionTimer = target.duration;

          const beh = target.behavior;
          const thought = target.thought;
          this.time.delayedCall(900, () => {
            if (this.currentAIFurniture) {
              this.person.startAction(beh, target.duration);
              if (thought) this.person.showThought(thought, 4000);
              const wasTV = this.tvOn, wasMon = this.monitorOn;
              this.tvOn      = beh === 'watching_tv'    ? true : beh === 'idle' ? false : this.tvOn;
              this.monitorOn = beh === 'using_computer' ? true : beh === 'idle' ? false : this.monitorOn;
              if (this.tvOn !== wasTV || this.monitorOn !== wasMon) this.drawHouse();
            }
          });
        } else {
          if (Math.random() > 0.55) {
            const wx = 50 + Math.random() * 700;
            const wy = Math.random() > 0.4 ? LOWER_WALK_Y : UPPER_WALK_Y;
            this.person.navigateTo(wx, wy);
          }
          this.aiActionTimer = 4000 + Math.random() * 8000;
        }
      }
    }

    this.person.update(delta);

    // TV channel rotation — switches every 30 real seconds while TV is on
    if (this.tvOn) {
      this.tvChannelTimer += delta;
      if (this.tvChannelTimer >= 30000) {
        this.tvChannelTimer = 0;
        this.tvChannelIndex = (this.tvChannelIndex + 1) % TV_CHANNELS.length;
        this.drawHouse();
        if (this.person.behavior === 'watching_tv') {
          this.person.showThought(TV_CHANNELS[this.tvChannelIndex].thought, 4000);
        }
      }
    } else {
      this.tvChannelTimer = 0;
    }

    if (PORTRAIT) {
      const cam = this.cameras.main;
      // Camera follows person: X pan across the floor, Y snaps to current floor
      const tx = Phaser.Math.Clamp(this.person.x - 200, 0, 400);
      const ty = Phaser.Math.Clamp(this.person.y - 120, 0, 300);
      cam.scrollX = Phaser.Math.Linear(cam.scrollX, tx, 0.06);
      cam.scrollY = Phaser.Math.Linear(cam.scrollY, ty, 0.04);
    }
  }

  private syncRealTime(): void {
    const now = new Date();
    this.gameTime.hour   = now.getHours();
    this.gameTime.minute = now.getMinutes();
    this.gameTime.totalMinutes = this.gameTime.hour * 60 + this.gameTime.minute;
  }

  private pickChatResponse(): string {
    const n = this.person.needs;
    const calEv = calendarService.getActiveEvent();
    if (calEv) return `I have "${calEv.summary}" right now!`;
    if (n.hunger < 25) return 'I\'m really hungry...';
    if (n.energy < 25) return 'So sleepy... yawn';
    if (n.hygiene < 25) return 'I really need a shower';
    if (n.happiness > 70) return ['Life is good! 😄', 'I\'m feeling great!', 'Lovely day!'][Math.floor(Math.random() * 3)];
    return ['Nice to see you!', 'What a pleasant surprise!', 'I was just thinking!', 'Hello there!'][Math.floor(Math.random() * 4)];
  }

  // ──────────────────────────────────────────────────────────────────────────
  // House drawing
  // ──────────────────────────────────────────────────────────────────────────

  private isNight(): boolean { return this.gameTime.hour < 6 || this.gameTime.hour >= 20; }
  private isDusk(): boolean  { return this.gameTime.hour >= 18 && this.gameTime.hour < 20; }

  private drawHouse(): void {
    const g = this.bg;
    g.clear();
    this.drawNightSky(g);
    this.drawLowerFloor(g);
    this.drawUpperFloor(g);
    this.drawFloorSeparator(g);
    this.drawStairs(g);
    this.drawRoof(g);
    this.drawHouseShell(g);
  }

  // ── Exterior ──────────────────────────────────────────────────────────────
  private drawNightSky(g: Phaser.GameObjects.Graphics): void {
    const night = this.isNight();
    const skyTop = night ? C.nightDeep : 0x334466;
    const skyBot = night ? C.nightMid  : 0x556688;

    // Sky gradient using dithered bands
    const bands = 12;
    const bandH = H / bands;
    for (let i = 0; i < bands; i++) {
      const t = i / bands;
      const r1 = (skyTop >> 16) & 0xff, g1 = (skyTop >> 8) & 0xff, b1 = skyTop & 0xff;
      const r2 = (skyBot >> 16) & 0xff, g2 = (skyBot >> 8) & 0xff, b2 = skyBot & 0xff;
      const col = Phaser.Display.Color.GetColor(
        Math.round(r1 + (r2-r1)*t), Math.round(g1 + (g2-g1)*t), Math.round(b1 + (b2-b1)*t),
      );
      g.fillStyle(col, 1);
      g.fillRect(0, Math.floor(i * bandH), W, Math.ceil(bandH) + 1);
    }

    if (night) {
      // Stars
      const stars = [
        [30,8],[80,4],[152,18],[248,7],[348,13],[452,4],[552,11],[648,7],[718,16],[768,3],
        [18,22],[108,28],[205,11],[305,23],[405,18],[505,26],[605,14],[705,21],[785,27],
        [55,40],[155,35],[255,42],[355,30],[455,38],[555,34],[655,40],[755,36],
      ];
      for (const [sx, sy] of stars) {
        const blink = Math.sin(Date.now() / 1200 + sx * 0.1) > 0.3;
        g.fillStyle(blink ? 0xffffff : 0xbbccee, 1);
        g.fillRect(sx, sy, 1, 1);
      }

      // Moon
      g.fillStyle(C.moonYellow, 1);
      g.fillCircle(680, 35, 14);
      g.fillStyle(C.nightMid, 1);
      g.fillCircle(685, 31, 11); // crescent cut-out
    }
  }

  private drawHouseShell(g: Phaser.GameObjects.Graphics): void {
    // Left/right outer walls
    this.drawBricks(g, 0, UPPER_Y_TOP, WALL, LOWER_Y_BOT);
    this.drawBricks(g, W - WALL, UPPER_Y_TOP, W, LOWER_Y_BOT);
    // Ground shadow
    g.fillStyle(C.nightDeep, 0.4);
    g.fillRect(0, LOWER_Y_BOT, W, H - LOWER_Y_BOT);
  }

  private drawBricks(g: Phaser.GameObjects.Graphics, x1: number, y1: number, x2: number, y2: number): void {
    g.fillStyle(C.brick, 1);
    g.fillRect(x1, y1, x2 - x1, y2 - y1);
    // Brick rows
    g.fillStyle(C.brickDark, 0.4);
    for (let by = y1; by < y2; by += 8) {
      g.fillRect(x1, by, x2 - x1, 1);
    }
  }

  // ── Lower floor ───────────────────────────────────────────────────────────
  private drawLowerFloor(g: Phaser.GameObjects.Graphics): void {
    const interior = !this.isNight();

    // Room backgrounds
    g.fillStyle(C.plaster, 1);
    g.fillRect(WALL, LOWER_Y_TOP, LEFT_ROOM_RIGHT - WALL, LOWER_Y_BOT - LOWER_Y_TOP);

    // Wainscoting on lower part of wall (lower half)
    const railY = LOWER_Y_TOP + Math.floor((LOWER_Y_BOT - LOWER_Y_TOP) * 0.55);
    g.fillStyle(C.wainscot, 1);
    g.fillRect(WALL, railY, LEFT_ROOM_RIGHT - WALL, LOWER_Y_BOT - railY);
    g.fillStyle(C.rail, 1);
    g.fillRect(WALL, railY, LEFT_ROOM_RIGHT - WALL, 3);

    // Kitchen — warmer walls
    g.fillStyle(C.plasterDark, 1);
    g.fillRect(RIGHT_ROOM_LEFT, LOWER_Y_TOP, W - WALL - RIGHT_ROOM_LEFT, LOWER_Y_BOT - LOWER_Y_TOP);
    g.fillStyle(C.wainscotDark, 1);
    g.fillRect(RIGHT_ROOM_LEFT, railY, W - WALL - RIGHT_ROOM_LEFT, LOWER_Y_BOT - railY);
    g.fillStyle(C.wainscot, 1);
    g.fillRect(RIGHT_ROOM_LEFT, railY, W - WALL - RIGHT_ROOM_LEFT, 3);

    // Floor boards
    this.drawFloorBoards(g, WALL, LOWER_Y_BOT - 10, W - WALL, LOWER_Y_BOT);

    // Room divider
    this.drawBricks(g, LEFT_ROOM_RIGHT, LOWER_Y_TOP, RIGHT_ROOM_LEFT, LOWER_Y_BOT - 10);

    // Windows with exterior glow
    this.drawWindow(g, 228, LOWER_Y_TOP + 28, 72, 56);
    this.drawWindow(g, 548, LOWER_Y_TOP + 28, 72, 56);

    // Ceiling cornice
    g.fillStyle(C.ceiling, 1);
    g.fillRect(WALL, LOWER_Y_TOP, W - WALL * 2, 6);

    // ── Living Room items ──────────────────────────────────────────────────
    this.drawBookshelf(g, 22, LOWER_Y_TOP + 38);
    this.drawSofa(g, 62, LOWER_Y_BOT - 10);
    this.drawTV(g, 340, LOWER_Y_TOP + 25);
    this.drawRug(g, 90, LOWER_Y_BOT - 16, 230, 16);
    if (interior) {
      this.drawLampGlow(g, 325, LOWER_Y_BOT - 80, 40, 0.25);
    }
    this.drawFloorLamp(g, 325, LOWER_Y_BOT - 14);

    // ── Kitchen items ──────────────────────────────────────────────────────
    this.drawKitchenCheckers(g);
    this.drawKitchenCounter(g, 418, LOWER_Y_TOP + 62);
    this.drawFridge(g, 748, LOWER_Y_TOP + 22);
    this.drawKitchenTable(g, 568, LOWER_Y_BOT - 10);

    this.drawExerciseMat(g, 195, LOWER_Y_BOT - 20);
    this.drawRadio(g, 22, LOWER_Y_BOT - 52);

    this.drawRoomLabel(g, 'LIVING ROOM', 210, LOWER_Y_TOP + 10);
    this.drawRoomLabel(g, 'KITCHEN',     588, LOWER_Y_TOP + 10);
  }

  // ── Upper floor ───────────────────────────────────────────────────────────
  private drawUpperFloor(g: Phaser.GameObjects.Graphics): void {
    // Bedroom — cool moonlit blues at night
    const bdroomWall = this.isNight() ? C.bedroomWall : C.plasterDark;
    const bdroomCeil = this.isNight() ? C.bedroomCeil : C.ceiling;
    g.fillStyle(bdroomWall, 1);
    g.fillRect(WALL, UPPER_Y_TOP, LEFT_ROOM_RIGHT - WALL, UPPER_Y_BOT - UPPER_Y_TOP);
    g.fillStyle(bdroomCeil, 1);
    g.fillRect(WALL, UPPER_Y_TOP, LEFT_ROOM_RIGHT - WALL, 5);

    // Bathroom — tiles
    this.drawBathroomTiles(g);

    // Floor boards
    this.drawFloorBoards(g, WALL, UPPER_Y_BOT - 8, W - WALL, UPPER_Y_BOT);

    // Room divider
    this.drawBricks(g, LEFT_ROOM_RIGHT, UPPER_Y_TOP, RIGHT_ROOM_LEFT, UPPER_Y_BOT - 8);

    // Windows
    this.drawWindow(g, 175, UPPER_Y_TOP + 18, 72, 56);

    // Moonlight pool in bedroom at night
    if (this.isNight()) {
      this.drawLampGlow(g, 211, UPPER_Y_BOT - 10, 60, 0.15, C.moonlight);
    }

    // ── Bedroom items ──────────────────────────────────────────────────────
    this.drawBed(g, 25, UPPER_Y_BOT - 50);
    this.drawComputerDesk(g, 308, UPPER_Y_BOT - 44);
    this.drawBedsideLamp(g, 174, UPPER_Y_BOT - 14);

    // ── Bathroom items ─────────────────────────────────────────────────────
    this.drawShower(g, 418, UPPER_Y_TOP + 12);
    this.drawBathroomSink(g, 566, UPPER_Y_BOT - 34);
    this.drawToilet(g, 698, UPPER_Y_BOT - 58);
    this.drawMirror(g, 566, UPPER_Y_TOP + 18);

    this.drawRoomLabel(g, 'BEDROOM',  200, UPPER_Y_TOP + 8);
    this.drawRoomLabel(g, 'BATHROOM', 590, UPPER_Y_TOP + 8);
  }

  // ── Floor separator ───────────────────────────────────────────────────────
  private drawFloorSeparator(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(C.beam, 1);
    g.fillRect(WALL, FLOOR_SEP_TOP, W - WALL * 2, FLOOR_SEP_BOT - FLOOR_SEP_TOP);
    g.fillStyle(C.beamDark, 1);
    for (let y = FLOOR_SEP_TOP + 5; y < FLOOR_SEP_BOT; y += 5) {
      g.fillRect(WALL, y, W - WALL * 2, 1);
    }
    // Top/bottom highlight
    g.fillStyle(C.floorLight, 0.6);
    g.fillRect(WALL, FLOOR_SEP_TOP, W - WALL * 2, 2);
  }

  private drawStairs(g: Phaser.GameObjects.Graphics): void {
    const steps = 5;
    const sw = 55;
    const sx = STAIRS_X - sw / 2;
    const stepH = (FLOOR_SEP_BOT - FLOOR_SEP_TOP) / steps;
    const stepW = sw / steps;
    for (let i = 0; i < steps; i++) {
      g.fillStyle(Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.IntegerToColor(C.floorMid),
        Phaser.Display.Color.IntegerToColor(C.floorLight),
        steps, i,
      ).color, 1);
      g.fillRect(sx + i * stepW, FLOOR_SEP_TOP + i * stepH, sw - i * stepW, stepH);
      g.fillStyle(C.beamDark, 0.5);
      g.fillRect(sx + i * stepW, FLOOR_SEP_TOP + i * stepH, sw - i * stepW, 1);
    }
  }

  private drawRoof(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(C.roof, 1);
    g.fillTriangle(W / 2, 0, WALL - 5, UPPER_Y_TOP, W - WALL + 5, UPPER_Y_TOP);
    g.fillStyle(C.roofDark, 0.6);
    g.fillTriangle(W / 2, 2, WALL - 5, UPPER_Y_TOP, W / 2 - 10, UPPER_Y_TOP);
    // Chimney
    g.fillStyle(C.brick, 1);
    g.fillRect(W * 0.68, 0, 24, 28);
    g.fillStyle(C.brickDark, 1);
    g.fillRect(W * 0.68, 0, 24, 3);
  }

  // ── Reusable primitives ───────────────────────────────────────────────────

  private drawFloorBoards(g: Phaser.GameObjects.Graphics, x1: number, y1: number, x2: number, y2: number): void {
    g.fillStyle(C.floorMid, 1);
    g.fillRect(x1, y1, x2 - x1, y2 - y1);
    g.fillStyle(C.plankLine, 0.7);
    for (let x = x1; x < x2; x += 28) {
      g.fillRect(x, y1, 1, y2 - y1);
    }
    g.fillStyle(C.floorDark, 0.4);
    g.fillRect(x1, y1, x2 - x1, 1);
  }

  private drawLampGlow(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, alpha: number, color = C.lampGlow): void {
    g.fillStyle(color, alpha * 0.5);
    g.fillCircle(x, y, r * 2);
    g.fillStyle(color, alpha);
    g.fillCircle(x, y, r);
  }

  private drawWindow(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number): void {
    const night = this.isNight();
    const glass = night ? C.windowGlassDark : C.windowGlass;

    // Warm glow around window from outside at night
    if (night) {
      g.fillStyle(C.windowGlowOuter, 0.3);
      g.fillRect(x - 8, y - 8, w + 16, h + 16);
    }

    // Frame
    g.fillStyle(C.windowFrame, 1);
    g.fillRect(x - 5, y - 5, w + 10, h + 10);

    // Glass
    g.fillStyle(glass, 1);
    g.fillRect(x, y, w, h);

    // Interior glow reflected
    if (night) {
      g.fillStyle(C.windowGlow, 0.2);
      g.fillRect(x, y, w, h);
    }

    // Pane dividers
    g.fillStyle(C.windowFrame, 1);
    g.fillRect(x + Math.floor(w / 2) - 1, y, 2, h);
    g.fillRect(x, y + Math.floor(h / 2) - 1, w, 2);
  }

  private drawRoomLabel(g: Phaser.GameObjects.Graphics, _label: string, _x: number, _y: number): void {
    // Text labels are added by UIScene
    void g; void _label; void _x; void _y;
  }

  // ── Living Room ───────────────────────────────────────────────────────────

  private drawBookshelf(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
    // Back panel
    g.fillStyle(C.shelfWood, 1);
    g.fillRect(x, y, 24, 115);
    // Shelves
    const books = [C.bookRed, C.bookGold, C.bookGreen, C.bookBlue, C.bookWhite, C.bookRed, C.bookGold, C.bookGreen];
    let bby = y + 5;
    for (let shelf = 0; shelf < 4; shelf++) {
      for (let b = 0; b < 4; b++) {
        const bc = books[(shelf * 4 + b) % books.length];
        g.fillStyle(bc, 1);
        g.fillRect(x + 2 + b * 5, bby, 4, 14);
      }
      // Shelf board
      g.fillStyle(C.wainscotLight, 1);
      g.fillRect(x, bby + 14, 24, 3);
      bby += 17 + 2;
    }
  }

  private drawSofa(g: Phaser.GameObjects.Graphics, x: number, floorY: number): void {
    const y = floorY - 50;
    // Legs
    g.fillStyle(C.shelfWood, 1);
    g.fillRect(x + 6, y + 44, 8, 8); g.fillRect(x + 96, y + 44, 8, 8);
    // Back
    g.fillStyle(C.sofaDark, 1);
    g.fillRect(x, y, 110, 24);
    g.fillStyle(C.sofa, 1);
    g.fillRect(x + 2, y + 2, 106, 20);
    // Seat
    g.fillStyle(C.sofa, 1);
    g.fillRect(x, y + 22, 110, 24);
    g.fillStyle(C.sofaCushion, 1);
    g.fillRect(x + 4, y + 24, 48, 18);
    g.fillRect(x + 58, y + 24, 48, 18);
    // Armrests
    g.fillStyle(C.sofaDark, 1);
    g.fillRect(x, y, 12, 46); g.fillRect(x + 98, y, 12, 46);
    // Highlight line
    g.fillStyle(C.sofaLight, 0.5);
    g.fillRect(x + 13, y + 2, 85, 2);
  }

  private drawTV(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
    const h = 68;
    // Stand
    g.fillStyle(C.shelfWood, 1);
    g.fillRect(x - 22, y + h + 2, 56, 8);
    g.fillRect(x + 4, y + h, 8, 4);
    // Casing
    g.fillStyle(C.tvCase, 1);
    g.fillRect(x - 26, y - 2, 64, h + 4);
    // Screen — colour depends on current channel
    const ch = TV_CHANNELS[this.tvChannelIndex];
    const screenCol = this.tvOn ? ch.screenColor : C.tvScreen;
    g.fillStyle(screenCol, 1);
    g.fillRect(x - 22, y + 4, 56, h - 10);
    if (this.tvOn) {
      // TV glow
      g.fillStyle(ch.glowColor, 0.15);
      g.fillCircle(x + 6, y + 30, 35);
      // Scanlines on screen
      g.fillStyle(0x000000, 0.15);
      for (let sy = y + 4; sy < y + h - 6; sy += 4) g.fillRect(x - 22, sy, 56, 1);
    }
  }

  private drawRug(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number): void {
    g.fillStyle(C.rugRed, 1);
    g.fillRect(x, y - h, w, h);
    // Border pattern
    g.fillStyle(C.rugPattern, 1);
    g.fillRect(x + 4, y - h + 2, w - 8, 2);
    g.fillRect(x + 4, y - 4, w - 8, 2);
    g.fillRect(x + 2, y - h + 2, 2, h - 4);
    g.fillRect(x + w - 4, y - h + 2, 2, h - 4);
  }

  private drawFloorLamp(g: Phaser.GameObjects.Graphics, x: number, floorY: number): void {
    g.fillStyle(C.lampBase, 1);
    g.fillRect(x, floorY - 80, 4, 80);
    g.fillRect(x - 8, floorY - 4, 20, 4);
    // Shade
    g.fillStyle(C.lampShade, 1);
    g.fillTriangle(x - 16, floorY - 80, x + 20, floorY - 80, x + 2, floorY - 112);
    g.fillStyle(C.lampGlow, 0.6);
    g.fillTriangle(x - 12, floorY - 80, x + 16, floorY - 80, x + 2, floorY - 108);
  }

  // ── Kitchen ───────────────────────────────────────────────────────────────

  private drawKitchenCheckers(g: Phaser.GameObjects.Graphics): void {
    const tileS = 12;
    const fy = LOWER_Y_BOT - 10;
    for (let tx = RIGHT_ROOM_LEFT; tx < W - WALL; tx += tileS) {
      const even = Math.floor((tx - RIGHT_ROOM_LEFT) / tileS) % 2 === 0;
      g.fillStyle(even ? C.tileCk1 : C.tileCk2, 0.4);
      g.fillRect(tx, fy - tileS, tileS, tileS);
    }
  }

  private drawKitchenCounter(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
    // Cabinet body
    g.fillStyle(C.counterDark, 1);
    g.fillRect(x, y, 130, 80);
    g.fillStyle(C.counter, 1);
    g.fillRect(x + 2, y + 2, 126, 76);
    // Cabinet door lines
    g.fillStyle(C.counterDark, 0.5);
    g.fillRect(x + 4, y + 4, 58, 70);
    g.fillRect(x + 68, y + 4, 58, 70);
    // Counter top
    g.fillStyle(C.countertop, 1);
    g.fillRect(x - 2, y - 10, 134, 12);
    // Stove
    g.fillStyle(C.stove, 1);
    g.fillRect(x + 8, y - 28, 75, 20);
    const burnColor = this.tvOn ? C.stoveBurner : 0x555555;
    g.fillStyle(burnColor, 1);
    g.fillCircle(x + 25, y - 18, 7); g.fillCircle(x + 58, y - 18, 7);
    g.fillStyle(C.countertop, 0.4);
    g.fillCircle(x + 25, y - 18, 4); g.fillCircle(x + 58, y - 18, 4);
    // Backsplash tiles
    g.fillStyle(C.tileCk1, 0.3);
    for (let ty = LOWER_Y_TOP + 10; ty < y - 28; ty += 10) {
      for (let tx = x; tx < x + 130; tx += 10) {
        if ((Math.floor((tx - x) / 10) + Math.floor((ty - LOWER_Y_TOP - 10) / 10)) % 2 === 0) {
          g.fillRect(tx, ty, 9, 9);
        }
      }
    }
    // Pot on stove
    g.fillStyle(C.potCopper, 1);
    g.fillRect(x + 84, y - 30, 28, 20);
    g.fillStyle(0x331100, 1);
    g.fillRect(x + 84, y - 30, 28, 3);
  }

  private drawFridge(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
    g.fillStyle(C.fridgeLine, 1);
    g.fillRect(x, y, 32, 95);
    g.fillStyle(C.fridgeBody, 1);
    g.fillRect(x + 2, y + 2, 28, 91);
    g.fillStyle(C.fridgeLine, 1);
    g.fillRect(x + 2, y + 38, 28, 2);
    g.fillRect(x + 26, y + 10, 3, 18); g.fillRect(x + 26, y + 52, 3, 18);
  }

  private drawKitchenTable(g: Phaser.GameObjects.Graphics, x: number, floorY: number): void {
    const y = floorY - 48;
    // Legs
    g.fillStyle(C.chairOak, 1);
    g.fillRect(x + 4, y + 16, 8, 32); g.fillRect(x + 93, y + 16, 8, 32);
    // Top
    g.fillStyle(C.tableOak, 1);
    g.fillRect(x, y, 105, 16);
    g.fillStyle(C.tableOakLt, 0.5);
    g.fillRect(x + 2, y + 2, 101, 4);
    // Chairs
    for (const cx of [x - 32, x + 115]) {
      g.fillStyle(C.chairOak, 1);
      g.fillRect(cx, y + 2, 28, 14);       // seat
      g.fillStyle(C.tableOak, 1);
      g.fillRect(cx, y - 16, 28, 18);      // back
      g.fillStyle(C.chairOak, 1);
      g.fillRect(cx + 4, y + 16, 7, 20);   // leg L
      g.fillRect(cx + 17, y + 16, 7, 20);  // leg R
    }
  }

  // ── Bedroom ───────────────────────────────────────────────────────────────

  private drawBed(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
    g.fillStyle(C.headboard, 1);
    g.fillRect(x, y - 18, 135, 18);
    g.fillStyle(C.bedFrame, 1);
    g.fillRect(x, y, 135, 42);
    g.fillStyle(C.bedSheet, 1);
    g.fillRect(x + 4, y + 4, 127, 28);
    g.fillStyle(C.bedSheetLt, 0.5);
    g.fillRect(x + 4, y + 4, 127, 6);
    g.fillStyle(C.bedPillow, 1);
    g.fillRect(x + 6, y + 6, 38, 22);
    // Footboard
    g.fillStyle(C.bedFrameLt, 1);
    g.fillRect(x, y + 42, 135, 8);
  }

  private drawComputerDesk(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
    // Desk
    g.fillStyle(C.deskWood, 1);
    g.fillRect(x, y, 72, 13);
    g.fillRect(x + 4, y + 13, 7, 28); g.fillRect(x + 61, y + 13, 7, 28);
    // Monitor
    g.fillStyle(C.monitorCase, 1);
    g.fillRect(x + 8, y - 32, 42, 32);
    const mscreen = this.monitorOn ? C.monitorGlow : C.monitorScreen;
    g.fillStyle(mscreen, 1);
    g.fillRect(x + 11, y - 29, 36, 25);
    if (this.monitorOn) {
      g.fillStyle(0x66aaff, 0.35);
      g.fillCircle(x + 29, y - 16, 18);
      g.fillStyle(0x4499ff, 0.6);
      for (let row = 0; row < 4; row++) g.fillRect(x + 13, y - 27 + row * 6, 18 + row * 4, 2);
    }
    g.fillStyle(C.monitorCase, 1);
    g.fillRect(x + 26, y - 4, 7, 6); g.fillRect(x + 18, y + 2, 22, 3);
    // Keyboard
    g.fillStyle(C.keyboardGrey, 1);
    g.fillRect(x + 5, y + 5, 44, 7);
  }

  private drawBedsideLamp(g: Phaser.GameObjects.Graphics, x: number, floorY: number): void {
    // Table
    g.fillStyle(C.deskWood, 1);
    g.fillRect(x - 14, floorY - 28, 30, 8);
    g.fillRect(x - 10, floorY - 20, 22, 20);
    // Lamp post
    g.fillStyle(C.lampBase, 1);
    g.fillRect(x - 1, floorY - 55, 4, 30);
    // Shade
    g.fillStyle(C.lampShade, 1);
    g.fillTriangle(x - 14, floorY - 52, x + 16, floorY - 52, x + 1, floorY - 72);
    if (!this.isNight()) {
      g.fillStyle(C.lampGlow, 0.4);
      g.fillTriangle(x - 10, floorY - 52, x + 12, floorY - 52, x + 1, floorY - 68);
    }
  }

  // ── Bathroom ──────────────────────────────────────────────────────────────

  private drawBathroomTiles(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(C.bathroomWall, 1);
    g.fillRect(RIGHT_ROOM_LEFT, UPPER_Y_TOP, W - WALL - RIGHT_ROOM_LEFT, UPPER_Y_BOT - UPPER_Y_TOP);
    const tileS = 14;
    for (let tx = RIGHT_ROOM_LEFT; tx < W - WALL; tx += tileS) {
      for (let ty = UPPER_Y_TOP + 5; ty < UPPER_Y_BOT - 8; ty += tileS) {
        g.fillStyle(C.tile, 1);
        g.fillRect(tx + 1, ty + 1, tileS - 2, tileS - 2);
        g.fillStyle(C.tileLight, 0.4);
        g.fillRect(tx + 1, ty + 1, tileS - 2, 3);
      }
    }
    g.fillStyle(C.tileGrout, 0.3);
    for (let tx = RIGHT_ROOM_LEFT; tx < W - WALL; tx += tileS) g.fillRect(tx, UPPER_Y_TOP, 1, UPPER_Y_BOT - UPPER_Y_TOP);
    for (let ty = UPPER_Y_TOP; ty < UPPER_Y_BOT; ty += tileS) g.fillRect(RIGHT_ROOM_LEFT, ty, W - WALL - RIGHT_ROOM_LEFT, 1);
    // Ceiling stripe
    g.fillStyle(C.tileWhite, 1);
    g.fillRect(RIGHT_ROOM_LEFT, UPPER_Y_TOP, W - WALL - RIGHT_ROOM_LEFT, 5);
  }

  private drawShower(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
    const h = 127;
    g.fillStyle(C.showerTile, 1);
    g.fillRect(x, y, 80, h);
    g.fillStyle(C.showerGlass, 0.35);
    g.fillRect(x, y, 14, h);
    g.fillStyle(C.chrome, 1);
    g.fillRect(x + 14, y, 2, h);
    g.fillRect(x + 60, y + 8, 5, 22);
    g.fillRect(x + 48, y + 6, 26, 5);
    g.fillStyle(C.porcelain, 1);
    g.fillRect(x + 2, y + h - 8, 76, 8);
    g.fillStyle(C.chrome, 1);
    g.fillRect(x + 35, y + h - 7, 10, 5);
  }

  private drawBathroomSink(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
    g.fillStyle(C.porcelain, 1);
    g.fillRect(x, y, 52, 20);
    g.fillStyle(C.porcelainSh, 1);
    g.fillRect(x + 5, y + 5, 42, 12);
    g.fillStyle(C.chrome, 1);
    g.fillRect(x + 22, y - 14, 6, 16);
    g.fillRect(x + 14, y - 16, 22, 4);
  }

  private drawToilet(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
    // Tank
    g.fillStyle(C.porcelain, 1);
    g.fillRect(x, y, 40, 24);
    g.fillStyle(C.porcelainSh, 0.3);
    g.fillRect(x + 2, y + 2, 36, 8);
    // Bowl
    g.fillStyle(C.porcelain, 1);
    g.fillRect(x - 2, y + 24, 44, 30);
    g.fillStyle(C.porcelainSh, 0.4);
    g.fillRect(x, y + 24, 40, 6);
  }

  private drawMirror(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
    g.fillStyle(C.chrome, 1);
    g.fillRect(x - 5, y - 5, 62, 62);
    g.fillStyle(C.mirrorGlass, 1);
    g.fillRect(x, y, 52, 52);
    g.fillStyle(0xffffff, 0.25);
    g.fillRect(x + 5, y + 5, 6, 42);
  }

  private drawExerciseMat(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
    // Mat body — teal with a lighter centre stripe
    g.fillStyle(0x2a7a88, 1);
    g.fillRect(x, y, 55, 12);
    g.fillStyle(0x3d9aaa, 0.6);
    g.fillRect(x + 4, y + 3, 47, 4);
    // Border
    g.lineStyle(1, 0x1a5566, 1);
    g.strokeRect(x, y, 55, 12);
    // End-grip texture lines
    g.fillStyle(0x1a5566, 0.5);
    for (let i = 0; i < 4; i++) {
      g.fillRect(x + 2 + i * 2, y + 1, 1, 10);
      g.fillRect(x + 49 - i * 2, y + 1, 1, 10);
    }
  }

  private drawRadio(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
    // Small side-table
    g.fillStyle(C.shelfWood, 1);
    g.fillRect(x - 2, y + 18, 24, 5);   // table top
    g.fillRect(x,     y + 23, 4, 12);   // left leg
    g.fillRect(x + 16, y + 23, 4, 12);  // right leg

    // Cabinet body
    g.fillStyle(0x1a1008, 1);
    g.fillRect(x, y, 20, 18);
    // Speaker grille
    g.fillStyle(0x332200, 1);
    g.fillRect(x + 2, y + 3, 11, 12);
    // Speaker dots
    g.fillStyle(0x110800, 1);
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        g.fillRect(x + 4 + col * 3, y + 5 + row * 3, 1, 1);
      }
    }
    // Tuner strip
    g.fillStyle(0x444422, 1);
    g.fillRect(x + 14, y + 3, 4, 7);
    g.fillStyle(0xaaaa44, 0.6);
    g.fillRect(x + 15, y + 4, 2, 2);   // tuner indicator
    // Antenna
    g.fillStyle(0x888866, 1);
    g.fillRect(x + 17, y - 10, 1, 12);
    g.fillRect(x + 17, y - 10, 4, 1);  // small cross-bar
  }

  private drawScanlines(): void {
    const g = this.add.graphics().setDepth(100);
    for (let y = 0; y < H; y += 2) {
      g.fillStyle(0x000000, 0.06);
      g.fillRect(0, y, W, 1);
    }
  }
}
