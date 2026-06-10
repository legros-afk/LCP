import Phaser from 'phaser';
import { W, H, UI_Y, C } from '../config';
import { PORTRAIT } from '../utils/orientation';
import { calendarService } from '../services/CalendarService';
import type { GameScene } from './GameScene';

const BAR_W = 108;
const BAR_H = 12;
const BAR_Y = UI_Y + 30;

const BARS: { key: 'hunger' | 'happiness' | 'energy' | 'hygiene'; label: string; color: number; x: number }[] = [
  { key: 'hunger',    label: 'HUNGER',  color: C.hungerBar,    x: 14  },
  { key: 'happiness', label: 'HAPPY',   color: C.happinessBar, x: 136 },
  { key: 'energy',    label: 'ENERGY',  color: C.energyBar,    x: 258 },
  { key: 'hygiene',   label: 'HYGIENE', color: C.hygieneBar,   x: 380 },
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
  exercising:     'exercising',
  playing_music:  'listening to music',
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
  private lastPortraitDispatch = 0;
  private birthdayNotice!: Phaser.GameObjects.Text;

  constructor() { super({ key: 'UIScene', active: false }); }

  create(): void {
    this.time.delayedCall(120, () => {
      this.gameScene = this.game.registry.get('gameScene') as GameScene;
      if (!PORTRAIT) this.buildUI();
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
      this.add.text(bar.x, BAR_Y - 17, bar.label, {
        fontSize: '11px', color: '#556677', fontFamily: 'monospace',
      });
      this.barFills.push(this.add.graphics());
      this.barLabels.push(this.add.text(bar.x, BAR_Y + BAR_H + 4, '', {
        fontSize: '11px', color: '#556677', fontFamily: 'monospace',
      }));
    }

    // Interaction buttons
    this.makeBtn('FEED', 508, UI_Y + 74, () => this.gameScene?.triggerFeed());
    this.makeBtn('CHAT', 582, UI_Y + 74, () => this.toggleChat());
    this.makeBtn('BELL', 656, UI_Y + 74, () => this.gameScene?.triggerBell());

    // Calendar button (only if client ID configured)
    const calAvail = this.gameScene?.getCalService().isAvailable;
    const calBg = this.add.rectangle(508, UI_Y + 46, 160, 22, calAvail ? C.calBtnOk : C.btnBg)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: calAvail });
    this.calBtn = calBg;
    const calLabel = calAvail ? '📅 Calendar…' : '📅 Calendar (n/a)';
    this.calBtnText = this.add.text(508 + 80, UI_Y + 57, calLabel, {
      fontSize: '11px', color: '#aabbcc', fontFamily: 'monospace',
    }).setOrigin(0.5, 0.5);

    if (calAvail) {
      calBg.on('pointerover',  () => { calBg.fillColor = C.calBtnOkHover; });
      calBg.on('pointerout',   () => { calBg.fillColor = C.calBtnOk; });
      calBg.on('pointerdown',  () => { this.gameScene?.getCalService().requestAccess(); });
    }

    // Calendar event display
    this.calEventText = this.add.text(508, UI_Y + 72, '', {
      fontSize: '11px', color: '#88aacc', fontFamily: 'monospace',
    });

    // Name
    const name = this.game.registry.get('personName') as string ?? '';
    this.nameText = this.add.text(758, UI_Y + 8, name.toUpperCase(), {
      fontSize: '14px', color: '#ccddee', fontFamily: 'monospace',
    }).setOrigin(0.5, 0);

    // Time
    this.timeText = this.add.text(758, UI_Y + 28, '00:00', {
      fontSize: '20px', color: '#e8d5b7', fontFamily: 'monospace',
    }).setOrigin(0.5, 0);

    // Status
    this.statusText = this.add.text(758, UI_Y + 56, '', {
      fontSize: '11px', color: '#556677', fontFamily: 'monospace',
    }).setOrigin(0.5, 0);

    // Room labels (drawn over GameScene)
    const lblStyle = { fontSize: '8px', color: '#7a6a55', fontFamily: 'monospace' };
    this.add.text(205, 288, 'LIVING ROOM', lblStyle).setOrigin(0.5, 0).setAlpha(0.8);
    this.add.text(590, 288, 'KITCHEN',     lblStyle).setOrigin(0.5, 0).setAlpha(0.8);
    this.add.text(200, 32,  'BEDROOM',     lblStyle).setOrigin(0.5, 0).setAlpha(0.8);
    this.add.text(590, 32,  'BATHROOM',    lblStyle).setOrigin(0.5, 0).setAlpha(0.8);

    // Birthday notice (hidden until a birthday is detected today)
    this.birthdayNotice = this.add.text(W / 2, UI_Y + 6, '', {
      fontSize: '11px',
      fontFamily: 'monospace',
      color: '#ffdd44',
      backgroundColor: '#331100',
      padding: { x: 8, y: 3 },
    }).setOrigin(0.5, 0).setVisible(false);

    // Chat input
    const inputEl = document.createElement('input');
    inputEl.type = 'text';
    inputEl.placeholder = 'Say something...';
    inputEl.style.cssText = 'width:300px;padding:6px 12px;background:#0a1a24;border:1px solid #2a4a5a;color:#cce0ee;font-family:monospace;font-size:14px;outline:none;border-radius:2px';
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        if (inputEl.value.trim()) this.gameScene?.triggerChat();
        inputEl.value = '';
        this.hideChat();
      }
      if (e.key === 'Escape') this.hideChat();
    });
    this.chatInput = this.add.dom(W / 2, UI_Y + 58, inputEl).setVisible(false);
  }

  private makeBtn(label: string, x: number, y: number, cb: () => void): void {
    const bg = this.add.rectangle(x, y, 68, 28, C.btnBg).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    this.add.text(x + 34, y + 14, label, {
      fontSize: '12px', color: '#aabbcc', fontFamily: 'monospace',
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

    if (PORTRAIT) {
      // Drive the HTML overlay instead of Phaser visuals
      const now = this.time.now;
      if (now - this.lastPortraitDispatch >= 500) {
        this.lastPortraitDispatch = now;
        const todayBdays = calendarService.getBirthdaysToday();
        window.dispatchEvent(new CustomEvent('lcp-state', {
          detail: {
            needs,
            hour: gt.hour,
            minute: gt.minute,
            behavior: beh,
            floor: this.gameScene.getFloor(),
            birthdays: todayBdays.map(e => e.summary),
          },
        }));
      }
      return;
    }

    // Landscape: update Phaser visual elements
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

    const h = String(gt.hour).padStart(2, '0');
    const m = String(gt.minute).padStart(2, '0');
    this.timeText.setText(`${h}:${m}`);
    this.statusText.setText(BEHAVIOR_LABELS[beh] ?? beh);

    // Birthday notice banner
    const todayBirthdays = calendarService.getBirthdaysToday();
    if (todayBirthdays.length > 0) {
      const names = todayBirthdays.map(e => e.summary).join(' & ');
      this.birthdayNotice.setText(`🎂 ${names} 🎉`).setVisible(true);
    } else {
      this.birthdayNotice.setVisible(false);
    }

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
