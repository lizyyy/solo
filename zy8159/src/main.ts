import './style.css';
import { GameController } from './game';
import { sampleConfig } from './config';

console.log('🏛️ 博物馆夜间撤展游戏初始化...');

function initializeGame(): void {
  try {
    const gameController = new GameController(sampleConfig);
    gameController.initialize();
    
    console.log('✅ 游戏初始化成功！');
    console.log('🎮 游戏ID:', gameController.getGameId());
  } catch (error) {
    console.error('❌ 游戏初始化失败:', error);
    alert('游戏初始化失败，请检查控制台获取更多信息。');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initializeGame();
});

if (document.readyState !== 'loading') {
  initializeGame();
}
