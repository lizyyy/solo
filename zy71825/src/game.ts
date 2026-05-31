import Phaser from 'phaser';
import { MainScene } from './scenes/MainScene';
import { ImportScene } from './scenes/ImportScene';
import { ReviewScene } from './scenes/ReviewScene';
import { CorrectScene } from './scenes/CorrectScene';
import { HistoryScene } from './scenes/HistoryScene';
import { SummaryScene } from './scenes/SummaryScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'game-container',
  backgroundColor: '#2d5a27',
  scene: [
    MainScene,
    ImportScene,
    ReviewScene,
    CorrectScene,
    HistoryScene,
    SummaryScene
  ],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
};

window.addEventListener('load', () => {
  new Phaser.Game(config);
});
