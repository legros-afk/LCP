import Phaser from 'phaser';
import { W, H } from '../config';

const GREEN  = '#00ff41';
const DIM    = '#007a1f';
const WHITE  = '#e8ffe8';
const CURSOR = '#00ff41';

const BOOT_LINES = [
  { text: 'LITTLE COMPUTER PEOPLE  v2.0.26', delay: 0 },
  { text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', delay: 300 },
  { text: 'INITIALIZING HOUSE.EXE ............... [ OK ]', delay: 700 },
  { text: 'LOADING FURNITURE.DAT ................. [ OK ]', delay: 1100 },
  { text: 'ALLOCATING LIVING SPACE ............... [ OK ]', delay: 1500 },
  { text: 'CONFIGURING PERSONALITY ............... [ OK ]', delay: 1900 },
  { text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', delay: 2300 },
  { text: '', delay: 2700 },
  { text: 'A PERSON HAS MOVED INTO YOUR COMPUTER.', delay: 3000 },
  { text: '', delay: 3800 },
  { text: 'THEY WILL NEED FOOD, REST, AND COMPANY.', delay: 4000 },
  { text: 'PLEASE LOOK AFTER THEM.', delay: 4700 },
  { text: '', delay: 5300 },
  { text: 'ENTER THEIR NAME:', delay: 5600 },
];

const STYLE_NORMAL: Phaser.Types.GameObjects.Text.TextStyle = {
  fontSize: '14px',
  fontFamily: 'monospace',
  color: GREEN,
  lineSpacing: 6,
};

const STYLE_DIM: Phaser.Types.GameObjects.Text.TextStyle = {
  fontSize: '14px',
  fontFamily: 'monospace',
  color: DIM,
  lineSpacing: 6,
};

export class IntroScene extends Phaser.Scene {
  private nameBuffer = '';
  private nameText!: Phaser.GameObjects.Text;
  private cursorText!: Phaser.GameObjects.Text;
  private cursorVisible = true;
  private inputReady = false;
  private lineTexts: Phaser.GameObjects.Text[] = [];
  private mobileInputEl: HTMLInputElement | null = null;
  private mobileConfirmBtn: HTMLButtonElement | null = null;

  constructor() { super('IntroScene'); }

  create(): void {
    this.cameras.main.setBackgroundColor('#000000');

    // Scanlines
    const scan = this.add.graphics();
    for (let y = 0; y < H; y += 2) {
      scan.fillStyle(0x000000, 0.12);
      scan.fillRect(0, y, W, 1);
    }
    scan.setDepth(10);

    // Subtle green vignette
    const vignette = this.add.graphics();
    vignette.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.6, 0.6, 0.6, 0.6);
    vignette.fillRect(0, 0, W, H);
    vignette.setDepth(9);

    const startX = 60;
    let currentY = 80;
    const lineHeight = 26;

    // Schedule each boot line
    for (let i = 0; i < BOOT_LINES.length; i++) {
      const entry = BOOT_LINES[i];
      const y = currentY;
      const isHeader = entry.text.startsWith('LITTLE');
      const isDivider = entry.text.startsWith('━');
      const isPrompt = entry.text === 'ENTER THEIR NAME:';

      this.time.delayedCall(entry.delay, () => {
        const style = (isHeader || isPrompt)
          ? { ...STYLE_NORMAL, color: WHITE }
          : isDivider
          ? { ...STYLE_DIM }
          : STYLE_NORMAL;

        const t = this.add.text(startX, y, '', style).setDepth(5);
        this.lineTexts.push(t);

        if (isPrompt) {
          // Reveal prompt then show input
          this.typewriterReveal(t, entry.text, 40, () => {
            this.showNameInput(startX + t.width + 14, y);
          });
        } else if (entry.text !== '') {
          this.typewriterReveal(t, entry.text, 18);
        }
      });

      if (entry.text !== '') currentY += lineHeight;
    }

    // Keyboard input (active once inputReady)
    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => {
      if (!this.inputReady) return;
      if (e.key === 'Enter') {
        if (this.nameBuffer.trim().length > 0) this.confirmName();
      } else if (e.key === 'Backspace') {
        this.nameBuffer = this.nameBuffer.slice(0, -1);
        this.updateNameDisplay();
      } else if (e.key.length === 1 && this.nameBuffer.length < 18) {
        this.nameBuffer += e.key.toUpperCase();
        this.updateNameDisplay();
      }
    });
  }

  private showNameInput(x: number, y: number): void {
    this.nameText = this.add.text(x, y, '', {
      ...STYLE_NORMAL,
      color: WHITE,
    }).setDepth(5);

    this.cursorText = this.add.text(x, y, '█', {
      ...STYLE_NORMAL,
      color: CURSOR,
    }).setDepth(5);

    // Blink cursor
    this.time.addEvent({
      delay: 530,
      loop: true,
      callback: () => {
        this.cursorVisible = !this.cursorVisible;
        if (this.cursorText) this.cursorText.setVisible(this.cursorVisible);
      },
    });

    this.inputReady = true;

    // On touch devices the keyboard won't appear without a focused real input
    if ('ontouchstart' in window) {
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.maxLength = 18;
      inp.autocomplete = 'off';
      inp.spellcheck = false;
      inp.style.cssText = [
        'position:fixed', 'bottom:80px', 'left:50%', 'transform:translateX(-50%)',
        'width:280px', 'padding:12px 16px',
        'background:#000', 'border:1px solid #00ff41',
        'color:#00ff41', 'font-family:monospace', 'font-size:16px',
        'outline:none', 'z-index:500', 'text-transform:uppercase',
        'letter-spacing:2px',
      ].join(';');
      inp.placeholder = 'TYPE NAME HERE';
      document.body.appendChild(inp);
      this.mobileInputEl = inp;

      const btn = document.createElement('button');
      btn.textContent = 'CONFIRM →';
      btn.style.cssText = [
        'position:fixed', 'bottom:24px', 'left:50%', 'transform:translateX(-50%)',
        'padding:12px 36px', 'background:none',
        'border:1px solid #00ff41', 'color:#00ff41',
        'font-family:monospace', 'font-size:14px', 'letter-spacing:2px',
        'z-index:500', 'cursor:pointer', 'touch-action:manipulation',
      ].join(';');
      document.body.appendChild(btn);
      this.mobileConfirmBtn = btn;

      inp.addEventListener('input', () => {
        this.nameBuffer = inp.value.toUpperCase().slice(0, 18);
        inp.value = this.nameBuffer;
        this.updateNameDisplay();
      });

      const submit = () => {
        if (this.nameBuffer.trim().length > 0) this.confirmName();
      };
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
      btn.addEventListener('click', submit);

      inp.focus();
    }
  }

  private updateNameDisplay(): void {
    if (!this.nameText || !this.cursorText) return;
    this.nameText.setText(this.nameBuffer);
    this.cursorText.setX(this.nameText.x + this.nameText.width + 2);
  }

  private confirmName(): void {
    this.inputReady = false;
    if (this.mobileInputEl)    { this.mobileInputEl.remove();    this.mobileInputEl = null; }
    if (this.mobileConfirmBtn) { this.mobileConfirmBtn.remove(); this.mobileConfirmBtn = null; }
    const name = this.nameBuffer.trim();
    localStorage.setItem('lcp_name', name);
    this.game.registry.set('personName', name);

    // Dim existing lines
    for (const t of this.lineTexts) t.setStyle(STYLE_DIM);
    this.nameText.setStyle(STYLE_DIM);
    this.cursorText.setVisible(false);

    const lastLine = this.lineTexts[this.lineTexts.length - 1];
    const confirmY = (lastLine?.y ?? 350) + 60;

    const line1 = this.add.text(60, confirmY, '', { ...STYLE_NORMAL, color: WHITE }).setDepth(5);
    this.typewriterReveal(line1, `HELLO, ${name}.`, 55, () => {
      const line2 = this.add.text(60, confirmY + 30, '', STYLE_NORMAL).setDepth(5);
      this.typewriterReveal(line2, 'INITIALIZING LIFE...', 45, () => {
        this.time.delayedCall(600, () => {
          this.cameras.main.fadeOut(800, 0, 0, 0);
          this.time.delayedCall(900, () => {
            this.scene.start('GameScene');
            this.scene.launch('UIScene');
          });
        });
      });
    });
  }

  private typewriterReveal(
    textObj: Phaser.GameObjects.Text,
    fullText: string,
    charDelay: number,
    onComplete?: () => void,
  ): void {
    let i = 0;
    this.time.addEvent({
      delay: charDelay,
      repeat: fullText.length - 1,
      callback: () => {
        i++;
        textObj.setText(fullText.slice(0, i));
        if (i >= fullText.length && onComplete) onComplete();
      },
    });
  }
}
