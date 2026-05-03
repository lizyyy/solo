/**
 * 应用主类
 * 协调所有模块的工作
 */

class App {
    constructor() {
        this.warehouse = null;
        this.sceneManager = null;
        this.interactionController = null;
        this.uiManager = null;
        this.pickingOrder = null;
        this.currentRoute = null;
        
        this.init();
    }
    
    init() {
        console.log('App.init() 开始执行...');
        
        this.warehouse = this.createDefaultWarehouse();
        console.log('默认仓库已创建');
        
        console.log('开始创建 SceneManager...');
        this.sceneManager = new SceneManager('canvas-container');
        console.log('SceneManager 已创建，renderer:', this.sceneManager.renderer);
        
        console.log('开始创建 InteractionController...');
        this.interactionController = new InteractionController(this.sceneManager);
        
        this.sceneManager.setWarehouse(this.warehouse);
        
        this.uiManager = new UIManager(this);
        
        this.tryLoadSavedProject();
        
        this.sceneManager.start();
        
        this.uiManager.updateStatusBar();
        
        console.log('3D仓库拣货路线规划工具已启动');
    }
    
    createDefaultWarehouse() {
        const warehouse = new Warehouse({
            name: '我的仓库',
            length: 20,
            width: 15,
            height: 5,
            gridSize: 1,
            minAisleWidth: 1.2
        });
        
        return warehouse;
    }
    
    tryLoadSavedProject() {
        const savedProject = LocalStorageManager.loadCurrentProject();
        if (savedProject) {
            try {
                this.uiManager.loadProject(savedProject);
                console.log('已加载保存的项目');
            } catch (e) {
                console.warn('加载保存的项目失败，使用默认配置:', e);
            }
        } else {
            this.loadExampleWarehouse();
        }
    }
    
    loadExampleWarehouse() {
        const exampleData = ProjectIO.createExampleWarehouse();
        this.warehouse = exampleData.warehouse;
        
        this.sceneManager.setWarehouse(this.warehouse);
        this.sceneManager.renderObjects();
        
        this.uiManager.warehouse = this.warehouse;
        this.uiManager.objectListUI.setWarehouse(this.warehouse);
        this.uiManager.propertiesUI.setWarehouse(this.warehouse);
        this.uiManager.pickingUI.setWarehouse(this.warehouse);
        
        this.uiManager.refresh();
        
        console.log('已加载示例仓库数据');
    }
    
    saveCurrentProject() {
        const projectData = ProjectIO.createProjectData(this.warehouse, this.pickingOrder);
        LocalStorageManager.saveCurrentProject(projectData);
        this.uiManager.showNotification('项目已保存');
    }
    
    exportProject() {
        this.uiManager.exportProject();
    }
    
    importProject(projectData) {
        this.uiManager.loadProject(projectData);
    }
}
