/**
 * 游戏主入口
 * 初始化游戏控制器
 */

import { GameController } from './gameController.js';

// 等待页面加载完成
document.addEventListener('DOMContentLoaded', () => {
  console.log('夜市出餐手忙脚乱 - 游戏启动');
  
  try {
    // 初始化游戏控制器
    const gameController = new GameController();
    
    // 暴露到全局，方便调试
    window.gameController = gameController;
    
    console.log('游戏初始化完成');
  } catch (error) {
    console.error('游戏初始化失败:', error);
    
    // 显示错误信息
    const app = document.getElementById('app');
    if (app) {
      app.innerHTML = `
        <div style="text-align: center; padding: 50px; color: #e74c3c;">
          <h2>游戏启动失败</h2>
          <p>错误信息: ${error.message}</p>
          <p style="margin-top: 20px; color: #666; font-size: 14px;">
            请确保使用本地服务器运行游戏（如: npx serve 或 python -m http.server）
          </p>
        </div>
      `;
    }
  }
});
