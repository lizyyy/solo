let sceneManager, pathfinding, robotController, reportGenerator, uiManager;

window.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    sceneManager = new SceneManager('canvas-container');
    
    pathfinding = new Pathfinding(1);
    
    robotController = new RobotController(sceneManager, pathfinding);
    
    reportGenerator = new ReportGenerator();
    
    uiManager = new UIManager(sceneManager, robotController, reportGenerator, pathfinding);
    
    setTimeout(() => {
        uiManager.loadSampleData();
    }, 500);
    
    console.log('🤖 室内巡检机器人路线可视化系统已启动');
    console.log('📋 功能说明：');
    console.log('   - 点击"加载样例数据"可查看预设的楼层模型');
    console.log('   - 使用"添加巡检点/障碍物/充电桩"在场景中创建元素');
    console.log('   - 拖拽场景中的元素可以调整位置');
    console.log('   - 点击"开始巡检"启动机器人模拟');
    console.log('   - 使用时间轴可以回放巡检过程');
    console.log('   - 完成后可导出HTML格式的巡检报告');
}

window.addEventListener('beforeunload', (e) => {
    if (robotController && robotController.isRunning) {
        e.preventDefault();
        e.returnValue = '';
    }
});