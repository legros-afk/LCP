import Phaser from 'phaser';
import { W, H } from './config';
import { PreloadScene } from './scenes/PreloadScene';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: W,
  height: H,
  backgroundColor: '#0d1117',
  pixelArt: true,
  antialias: false,
  parent: 'game-container',
  scene: [PreloadScene, GameScene, UIScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

new Phaser.Game(config);
