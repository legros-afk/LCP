import Phaser from 'phaser';

export class PreloadScene extends Phaser.Scene {
  constructor() { super('PreloadScene'); }

  preload(): void {
    // No external assets — everything is drawn procedurally
  }

  create(): void {
    this.scene.start('GameScene');
    this.scene.launch('UIScene');
  }
}
