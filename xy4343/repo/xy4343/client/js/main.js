// 主入口文件
document.addEventListener('DOMContentLoaded', () => {
    console.log('博物馆夜间安保训练系统已启动');
    
    // 初始化页面
    showScreen('main-menu');
});

// 全局错误处理
window.onerror = function(msg, url, lineNo, columnNo, error) {
    console.error('全局错误:', msg, '在', url, '第', lineNo, '行');
    return false;
};

// 未处理的Promise拒绝
window.addEventListener('unhandledrejection', function(event) {
    console.error('未处理的Promise拒绝:', event.reason);
});
