import { UIController } from './ui/UIController.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log('🔊 声波迷宫救援队正在启动...');
    
    const uiController = new UIController();
    uiController.init();
    uiController.startRenderLoop();
    
    console.log('✅ 系统初始化完成！');
    console.log('📖 操作说明:');
    console.log('   - 方向键/WASD: 移动角色');
    console.log('   - 空格键: 发射声波');
    console.log('   - 滑动条: 调整角度和强度');
    console.log('   - 右下角按钮: 查看历史/回放失败/导出报告');
    
    window.gameController = uiController;
});
