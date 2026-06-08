import Phaser from 'phaser';
import { W, H, UI_Y, C } from '../config';
import type { GameScene } from './GameScene';

const BAR_W = 100;
const BAR_H = 10;
const BAR_Y = UI_Y + 24;

const BARS: { key: 'hunger' | 'happiness' | 'energy' | 'hygiene'; label: string; color: number; x: number }[] = [
  { key: 'hunger',    label: 'HUNGER',  color: C.hungerBar,    x: 18  },
  { key: 'happiness', label: 'HAPPY',   color: C.happinessBar, x: 138 },
  { key: 'energy',    label: 'ENERGY',  color: C.energyBar,    x: 258 },
  { key: 'hygiene',   label: 'HYGIENE', color: C.hygieneBar,   x: 378 },
];

const BEHAVIOR_LABELS: Record<string, string> = {
  idle:           '...',
  walking:        'walking',
  eating:         'eating',
  sleeping:       'sleeping',
  watching_tv:    'watching TV',
  using_computer: 'at the computer',
  reading:        'reading',
  showering:      'showering',
  cooking:        'cooking',
  greeting_player:'waving hello',
  chatting:       'chatting',
};

export class UIScene extends Phaser.Scene {
  private barFills: Phaser.GameObjects.Graphics[] = [];
  private barLabels: Phaser.GameObjects.Text[] = [];
  private timeText!: Phaser.GameObjects.Text;
  private nameText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private calEventText!: Phaser.GameObjects.Text;
  private calBtn!: Phaser.GameObjects.Rectangle;
  private calBtnText!: Phaser.GameObjects.Text;
  private chatInput!: Phaser.GameObjects.DOMElement;
  private chatVisible = false;
  private gameScene!: GameScene;

  constructor() { super({ key: 'UIScene', active: false }); }

  create(): void {
    this.time.delayedCall(120, () => {
      this.gameScene = this.game.registry.get('gameScene') as GameScene;
      this.buildUI();
    });
  }

  private buildUI(): void {
    // Panel background
    const panel = this.add.graphics();
    panel.fillStyle(C.uiBg, 0.97);
    panel.fillRect(0, UI_Y, W, H - UI_Y);
    panel.fillStyle(C.uiBorder, 1);
    panel.fillRect(0, UI_Y, W, 2);

    // Bars
    for (let i = 0; i < BARS.length; i++) {
      const bar = BARS[i];
      this.add.text(bar.x, BAR_Y - 13, bar.label, {
        fontSize: '7px', color: '#556677', fontFamily: 'monospace',
      });
      this.barFills.push(this.add.graphics());
      this.barLabels.push(this.add.text(bar.x, BAR_Y + BAR_H + 3, '', {
        fontSize: '7px', color: '#556677', fontFamily: 'monospace',
      }));
    }

    // Interaction buttons
    this.makeBtn('FEED',   512, UI_Y + 14, () => this.gameScene?.triggerFeed());
    this.makeBtn('CHAT',   572, UI_Y + 14, () => this.toggleChat());
    this.makeBtn('BELL',   632, UI_Y + 14, () => this.gameScene?.triggerBell());

    // Calendar button (only if client ID configured)
    const calAvail = this.gameScene?.getCalService().isAvailable;
    const calBg = this.add.rectangle(512, UI_Y + 50, 150, 18, calAvail ? C.calBtnOk : C.btnBg)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: calAvail });
    this.calBtn = calBg;
    const calLabel = calAvail ? '📅 Connect Calendar' : '📅 Calendar (n/a)';
    this.calBtnText = this.add.text(587, UI_Y + 59, calLabel, {
      fontSize: '8px', color: '#aabbcc', fontFamily: 'monospace',
    }).setOrigin(0.5, 0.5);

    if (calAvail) {
      calBg.on('pointerover',  () => { calBg.fillColor = C.calBtnOkHover; });
      calBg.on('pointerout',   () => { calBg.fillColor = C.calBtnOk; });
      calBg.on('pointerdown',  () => { this.gameScene?.getCalService().requestAccess(); });
    }

    // Calendar event display
    this.calEventText = this.add.text(512, UI_Y + 72, '', {
      fontSize: '8px', color: '#88aacc', fontFamily: 'monospace',
    });

    // Name
    const name = this.game.registry.get('personName') as string ?? '';
    this.nameText = this.add.text(700, UI_Y + 10, name.toUpperCase(), {
      fontSize: '11px', color: '#ccddee', fontFamily: 'monospace',
    }).setOrigin(0.5, 0);

    // Time
    this.timeText = this.add.text(700, UI_Y + 28, '00:00', {
      fontSize: '16px', color: '#e8d5b7', fontFamily: 'monospace',
    }).setOrigin(0.5, 0);

    // Status
    this.statusText = this.add.text(700, UI_Y + 52, '', {
      fontSize: '8px', color: '#556677', fontFamily: 'monospace',
    }).setOrigin(0.5, 0);

    // Room labels (drawn over GameScene)
    const lblStyle = { fontSize: '8px', color: '#7a6a55', fontFamily: 'monospace' };
    this.add.text(205, 288, 'LIVING ROOM', lblStyle).setOrigin(0.5, 0).setAlpha(0.8);
    this.add.text(590, 288, 'KITCHEN',     lblStyle).setOrigin(0.5, 0).setAlpha(0.8);
    this.add.text(200, 32,  'BEDROOM',     lblStyle).setOrigin(0.5, 0).setAlpha(0.8);
    this.add.text(590, 32,  'BATHROOM',    lblStyle).setOrigin(0.5, 0).setAlpha(0.8);

    // Chat input
    const inputEl = document.createElement('input');
    inputEl.type = 'text';
    inputEl.placeholder = 'Say something...';
    inputEl.style.cssText = 'width:300px;padding:5px 10px;background:#0a1a24;border:1px solid #2a4a5a;color:#cce0ee;font-family:monospace;font-size:12px;outline:none;border-radius:2px';
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        if (inputEl.value.trim()) this.gameScene?.triggerChat();
        inputEl.value = '';
        this.hideChat();
      }
      if (e.key === 'Escape') this.hideChat();
    });
    this.chatInput = this.add.dom(W / 2, UI_Y + 56, inputEl).setVisible(false);
  }

  private makeBtn(label: string, x: number, y: number, cb: () => void): void {
    const bg = this.add.rectangle(x, y, 54, 22, C.btnBg).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    this.add.text(x + 27, y + 11, label, {
      fontSize: '9px', color: '#aabbcc', fontFamily: 'monospace',
    }).setOrigin(0.5, 0.5);
    bg.on('pointerover',  () => { bg.fillColor = C.btnHover; });
    bg.on('pointerout',   () => { bg.fillColor = C.btnBg; });
    bg.on('pointerdown',  () => { bg.fillColor = 0x2a3a44; cb(); });
    bg.on('pointerup',    () => { bg.fillColor = C.btnHover; });
  }

  private toggleChat(): void {
    if (this.chatVisible) { this.hideChat(); } else {
      this.chatVisible = true;
      this.chatInput.setVisible(true);
      (this.chatInput.node as HTMLInputElement).focus();
    }
  }

  private hideChat(): void {
    this.chatVisible = false;
    this.chatInput.setVisible(false);
  }

  update(): void {
    if (!this.gameScene) return;

    const needs = this.gameScene.getNeeds();
    const gt    = this.gameScene.getGameTime();
    const beh   = this.gameScene.getBehavior();
    const cal   = this.gameScene.getCalService();

    // Bars
    for (let i = 0; i < BARS.length; i++) {
      const bar  = BARS[i];
      const val  = needs[bar.key];
      const fill = this.barFills[i];
      fill.clear();
      fill.fillStyle(C.barBg, 1);
      fill.fillRect(bar.x, BAR_Y, BAR_W, BAR_H);
      fill.fillStyle(val < 25 ? C.barLow : bar.color, 1);
      fill.fillRect(bar.x, BAR_Y, Math.floor((val / 100) * BAR_W), BAR_H);
      fill.lineStyle(1, C.uiBorder, 1);
      fill.strokeRect(bar.x, BAR_Y, BAR_W, BAR_H);
      this.barLabels[i].setText(`${Math.floor(val)}`);
    }

    // Time (real clock)
    const h = String(gt.hour).padStart(2, '0');
    const m = String(gt.minute).padStart(2, '0');
    this.timeText.setText(`${h}:${m}`);

    // Status
    this.statusText.setText(BEHAVIOR_LABELS[beh] ?? beh);

    // Calendar
    if (cal.isConnected) {
      this.calBtnText.setText('📅 Calendar connected');
      this.calBtn.fillColor = C.calBtnOk;
      const ev = cal.getActiveEvent();
      if (ev) {
        this.calEventText.setText(`▶ ${ev.summary}`);
      } else {
        const next = cal.getNextEvent();
        this.calEventText.setText(next ? `Next: ${next.summary}` : '');
      }
    }
  }
}
