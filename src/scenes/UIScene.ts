import Phaser from 'phaser';
import { W, H, UI_Y, COLORS } from '../config';
import type { GameScene } from './GameScene';

const BAR_W = 120;
const BAR_H = 10;
const BAR_Y = UI_Y + 22;

const BARS: { key: keyof ReturnType<GameScene['getNeeds']>; label: string; color: number; x: number }[] = [
  { key: 'hunger',    label: 'HUNGER',    color: COLORS.hungerBar,    x: 20  },
  { key: 'happiness', label: 'HAPPY',     color: COLORS.happinessBar, x: 170 },
  { key: 'energy',    label: 'ENERGY',    color: COLORS.energyBar,    x: 320 },
  { key: 'hygiene',   label: 'HYGIENE',   color: COLORS.hygieneBar,   x: 470 },
];

interface Btn {
  bg: Phaser.GameObjects.Rectangle;
  txt: Phaser.GameObjects.Text;
}

const BEHAVIOR_LABELS: Record<string, string> = {
  idle:           'Idle',
  walking:        'Walking...',
  eating:         'Eating 🍽',
  sleeping:       'Sleeping 💤',
  watching_tv:    'Watching TV 📺',
  using_computer: 'Using computer 💻',
  reading:        'Reading 📖',
  showering:      'Showering 🚿',
  cooking:        'Cooking 🍳',
  greeting_player:'Hello!',
  chatting:       'Chatting...',
};

export class UIScene extends Phaser.Scene {
  private barGraphics!: Phaser.GameObjects.Graphics;
  private barFills: Phaser.GameObjects.Graphics[] = [];
  private barLabels: Phaser.GameObjects.Text[] = [];
  private timeText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private chatInput!: Phaser.GameObjects.DOMElement;
  private chatVisible = false;
  private gameScene!: GameScene;
  private roomLabels: Phaser.GameObjects.Text[] = [];

  constructor() { super({ key: 'UIScene', active: false }); }

  create(): void {
    // Wait one frame for GameScene to register itself
    this.time.delayedCall(100, () => {
      this.gameScene = this.game.registry.get('gameScene') as GameScene;
      this.buildUI();
      this.buildRoomLabels();
    });
  }

  private buildUI(): void {
    // Panel background
    const panel = this.add.graphics();
    panel.fillStyle(COLORS.uiBg, 0.95);
    panel.fillRect(0, UI_Y, W, H - UI_Y);
    panel.fillStyle(COLORS.uiBorder, 1);
    panel.fillRect(0, UI_Y, W, 2);

    this.barGraphics = this.add.graphics();

    // Create bar fills and labels
    for (let i = 0; i < BARS.length; i++) {
      const bar = BARS[i];

      // Label above bar
      const lbl = this.add.text(bar.x, BAR_Y - 14, bar.label, {
        fontSize: '8px',
        color: '#a0a0a0',
        fontFamily: 'monospace',
      }).setOrigin(0, 0);
      this.barLabels.push(lbl);

      // Bar fill (will be updated every frame)
      const fill = this.add.graphics();
      this.barFills.push(fill);
    }

    // Buttons
    this.createButton('🍞 FEED',   620, UI_Y + 20, () => this.gameScene?.triggerFeed());
    this.createButton('💬 CHAT',   700, UI_Y + 20, () => this.triggerChat());
    this.createButton('🔔 BELL',   780, UI_Y + 20, () => this.gameScene?.triggerBell());

    // Wait, the buttons need to fit in 800px. Let me adjust x positions
    // Time display
    this.timeText = this.add.text(624, UI_Y + 48, '08:00', {
      fontSize: '14px',
      color: '#e8d5b7',
      fontFamily: 'monospace',
    }).setOrigin(0.5, 0);

    // Status / behavior text
    this.statusText = this.add.text(624, UI_Y + 66, '', {
      fontSize: '8px',
      color: '#7a8a9a',
      fontFamily: 'monospace',
    }).setOrigin(0.5, 0);

    // Chat input DOM element (hidden initially)
    const inputEl = document.createElement('input');
    inputEl.type = 'text';
    inputEl.placeholder = 'Say something...';
    inputEl.style.cssText = [
      'width:300px', 'padding:6px 10px', 'background:#1a2a3a',
      'border:1px solid #3a5a7a', 'color:#e8d5b7', 'font-family:monospace',
      'font-size:12px', 'outline:none', 'border-radius:3px',
    ].join(';');
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.sendChat(inputEl.value);
        inputEl.value = '';
        this.hideChatInput();
      }
      if (e.key === 'Escape') {
        this.hideChatInput();
      }
    });
    this.chatInput = this.add.dom(W / 2, UI_Y + 55, inputEl).setVisible(false);
  }

  private createButton(label: string, x: number, y: number, cb: () => void): Btn {
    const bg = this.add.rectangle(x, y, 68, 22, COLORS.btnBg)
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true });
    const txt = this.add.text(x, y + 11, label, {
      fontSize: '9px',
      color: '#e8d5b7',
      fontFamily: 'monospace',
    }).setOrigin(0.5, 0.5);

    bg.on('pointerover',  () => { bg.fillColor = COLORS.btnHover; });
    bg.on('pointerout',   () => { bg.fillColor = COLORS.btnBg; });
    bg.on('pointerdown',  () => { bg.fillColor = 0x3a4a5a; cb(); });
    bg.on('pointerup',    () => { bg.fillColor = COLORS.btnHover; });
    return { bg, txt };
  }

  private buildRoomLabels(): void {
    const { LOWER_Y_TOP, UPPER_Y_TOP } = {
      LOWER_Y_TOP: 285,
      UPPER_Y_TOP: 30,
    };
    const style = { fontSize: '9px', color: '#a09080', fontFamily: 'monospace' };
    this.roomLabels = [
      this.add.text(210, LOWER_Y_TOP + 12, 'LIVING ROOM', style).setOrigin(0.5, 0).setAlpha(0.7),
      this.add.text(590, LOWER_Y_TOP + 12, 'KITCHEN',     style).setOrigin(0.5, 0).setAlpha(0.7),
      this.add.text(200, UPPER_Y_TOP + 10, 'BEDROOM',     style).setOrigin(0.5, 0).setAlpha(0.7),
      this.add.text(590, UPPER_Y_TOP + 10, 'BATHROOM',    style).setOrigin(0.5, 0).setAlpha(0.7),
    ];
  }

  private triggerChat(): void {
    if (this.chatVisible) {
      this.hideChatInput();
    } else {
      this.chatVisible = true;
      this.chatInput.setVisible(true);
      (this.chatInput.node as HTMLInputElement).focus();
    }
  }

  private sendChat(text: string): void {
    if (!text.trim() || !this.gameScene) return;
    this.gameScene.triggerChat();
  }

  private hideChatInput(): void {
    this.chatVisible = false;
    this.chatInput.setVisible(false);
  }

  update(): void {
    if (!this.gameScene) return;

    const needs = this.gameScene.getNeeds();
    const gt    = this.gameScene.getGameTime();
    const beh   = this.gameScene.getBehavior();

    // Update bars
    for (let i = 0; i < BARS.length; i++) {
      const bar  = BARS[i];
      const val  = needs[bar.key] as number;
      const fill = this.barFills[i];
      fill.clear();

      // Background
      fill.fillStyle(COLORS.barBg, 1);
      fill.fillRect(bar.x, BAR_Y, BAR_W, BAR_H);

      // Fill
      const isLow   = val < 25;
      const fillColor = isLow ? COLORS.barLow : bar.color;
      fill.fillStyle(fillColor, 1);
      fill.fillRect(bar.x, BAR_Y, Math.floor((val / 100) * BAR_W), BAR_H);

      // Border
      fill.lineStyle(1, 0x2a3a4a, 1);
      fill.strokeRect(bar.x, BAR_Y, BAR_W, BAR_H);

      // Value number
      this.barLabels[i].setText(`${bar.label} ${Math.floor(val)}`);
    }

    // Time display
    const h = String(gt.hour).padStart(2, '0');
    const m = String(gt.minute).padStart(2, '0');
    const period = gt.hour < 12 ? 'AM' : 'PM';
    const h12 = gt.hour % 12 || 12;
    this.timeText.setText(`${h12}:${m} ${period}`);

    // Status
    this.statusText.setText(BEHAVIOR_LABELS[beh] ?? beh);
  }
}
