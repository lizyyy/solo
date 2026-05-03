/**
 * 应用入口
 * 初始化应用并启动
 */

function initApp() {
    console.log('DOM 已加载，开始初始化应用...');
    
    if (!window.THREE) {
        console.error('Three.js 未加载，请检查网络连接或 CDN 地址');
        alert('Three.js 未加载，应用无法启动。请检查网络连接后刷新页面。');
        return;
    }
    
    console.log('Three.js 已加载，版本:', THREE.REVISION);
    
    if (!window.OrbitControls) {
        console.error('OrbitControls 未加载');
        alert('OrbitControls 未加载，应用无法启动。请检查网络连接后刷新页面。');
        return;
    }
    
    console.log('OrbitControls 已加载');
    
    if (!window.TWEEN) {
        console.warn('TWEEN 未加载，动画功能可能受限');
    } else {
        console.log('TWEEN 已加载');
    }
    
    try {
        console.log('开始创建 App 实例...');
        window.app = new App();
        
        console.log('========================================');
        console.log('  3D仓库拣货路线规划工具 已启动');
        console.log('========================================');
        console.log('快捷键:');
        console.log('  V - 选择工具');
        console.log('  H - 平移工具');
        console.log('  R - 旋转工具');
        console.log('  G - 移动工具');
        console.log('  Delete/Backspace - 删除选中对象');
        console.log('  Escape - 取消选择');
        console.log('========================================');
        
    } catch (error) {
        console.error('应用启动失败:', error);
        alert(`应用启动失败: ${error.message}\n请查看控制台获取详细信息。`);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (window.THREE && window.OrbitControls) {
        initApp();
    } else {
        console.log('等待 Three.js 模块加载...');
        document.addEventListener('three-ready', () => {
            initApp();
        }, { once: true });
    }
});

window.addEventListener('beforeunload', (e) => {
    if (window.app && window.app.warehouse) {
        const projectData = ProjectIO.createProjectData(window.app.warehouse, window.app.pickingOrder);
        LocalStorageManager.saveCurrentProject(projectData);
    }
});
