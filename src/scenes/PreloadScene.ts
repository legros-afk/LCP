import Phaser from 'phaser';

export class PreloadScene extends Phaser.Scene {
  constructor() { super('PreloadScene'); }

  preload(): void {
    // No external assets — everything is drawn procedurally
  }

  create(): void {
    const savedName = localStorage.getItem('lcp_name');
    if (savedName) {
      this.game.registry.set('personName', savedName);
      this.scene.start('GameScene');
      this.scene.launch('UIScene');
    } else {
      this.scene.start('IntroScene');
    }
  }
}
