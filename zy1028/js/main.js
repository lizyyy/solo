import { ui } from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log('夜市炒粉摊小游戏加载中...');
    
    try {
        ui.init();
        console.log('游戏初始化成功！');
    } catch (error) {
        console.error('游戏初始化失败:', error);
    }
});
