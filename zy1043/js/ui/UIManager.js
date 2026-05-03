/**
 * UI 管理器
 * 协调所有 UI 模块的交互
 */

class UIManager {
    constructor(app) {
        this.app = app;
        this.warehouse = app.warehouse;
        this.sceneManager = app.sceneManager;
        this.interactionController = app.interactionController;
        
        this.init();
    }
    
    init() {
        this.objectListUI = new ObjectListUI(this);
        this.propertiesUI = new PropertiesUI(this);
        this.pickingUI = new PickingUI(this);
        this.modalUI = new ModalUI(this);
        
        this.setupEventListeners();
        this.setupToolbarListeners();
        this.setupViewListeners();
        this.setupRouteControlListeners();
    }
    
    setupEventListeners() {
        eventBus.on(Constants.EVENTS.OBJECT_ADDED, (obj) => {
            this.objectListUI.refresh();
            this.updateStatusBar();
            this.runConflictDetection();
        });
        
        eventBus.on(Constants.EVENTS.OBJECT_REMOVED, (obj) => {
            this.objectListUI.refresh();
            this.propertiesUI.clear();
            this.updateStatusBar();
            this.runConflictDetection();
        });
        
        eventBus.on(Constants.EVENTS.OBJECT_UPDATED, (obj) => {
            this.objectListUI.refresh();
            this.propertiesUI.updateSelectedObject();
            this.updateStatusBar();
        });
        
        eventBus.on(Constants.EVENTS.OBJECT_SELECTED, (obj) => {
            if (obj) {
                this.propertiesUI.showObjectProperties(obj);
                this.objectListUI.selectItem(obj.id);
            } else {
                this.propertiesUI.clear();
                this.objectListUI.deselectAll();
            }
        });
        
        eventBus.on(Constants.EVENTS.CONFLICTS_UPDATED, (conflicts) => {
            this.updateConflictsPanel(conflicts);
            this.updateStatusBar();
        });
        
        eventBus.on(Constants.EVENTS.ROUTE_UPDATED, (route) => {
            this.pickingUI.updateRouteDisplay(route);
            this.updateStatusBar();
        });
        
        eventBus.on(Constants.EVENTS.TOOL_CHANGED, (tool) => {
            this.updateToolButtons(tool);
        });
        
        eventBus.on(Constants.EVENTS.PICKING_IMPORTED, (pickingOrder) => {
            this.pickingUI.updatePickingDisplay(pickingOrder);
            this.updateStatusBar();
        });
    }
    
    setupToolbarListeners() {
        const tools = {
            'toolSelect': Constants.TOOLS.SELECT,
            'toolPan': Constants.TOOLS.PAN,
            'toolRotate': Constants.TOOLS.ROTATE,
            'toolMove': Constants.TOOLS.MOVE
        };
        
        Object.entries(tools).forEach(([id, tool]) => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.addEventListener('click', () => {
                    this.interactionController.setTool(tool);
                });
            }
        });
        
        document.getElementById('btnSave')?.addEventListener('click', () => {
            this.saveProject();
        });
        
        document.getElementById('btnImport')?.addEventListener('click', () => {
            this.modalUI.showImportProjectModal();
        });
        
        document.getElementById('btnExport')?.addEventListener('click', () => {
            this.exportProject();
        });
        
        document.getElementById('btnReport')?.addEventListener('click', () => {
            this.modalUI.showReportModal();
        });
        
        document.getElementById('addObjectBtn')?.addEventListener('click', () => {
            this.modalUI.showAddObjectModal();
        });
    }
    
    setupViewListeners() {
        const views = {
            'viewPerspective': Constants.VIEWS.PERSPECTIVE,
            'viewTop': Constants.VIEWS.TOP,
            'viewFront': Constants.VIEWS.FRONT,
            'viewLeft': Constants.VIEWS.LEFT
        };
        
        Object.entries(views).forEach(([id, view]) => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.addEventListener('click', () => {
                    this.sceneManager.setCameraView(view);
                    this.updateViewButtons(view);
                });
            }
        });
        
        document.getElementById('viewReset')?.addEventListener('click', () => {
            this.sceneManager.resetCamera();
            this.updateViewButtons(Constants.VIEWS.PERSPECTIVE);
        });
    }
    
    setupRouteControlListeners() {
        document.getElementById('routePlay')?.addEventListener('click', () => {
            this.playRoute();
        });
        
        document.getElementById('routePause')?.addEventListener('click', () => {
            this.pauseRoute();
        });
        
        document.getElementById('routeStop')?.addEventListener('click', () => {
            this.stopRoute();
        });
    }
    
    updateToolButtons(activeTool) {
        const tools = {
            'toolSelect': Constants.TOOLS.SELECT,
            'toolPan': Constants.TOOLS.PAN,
            'toolRotate': Constants.TOOLS.ROTATE,
            'toolMove': Constants.TOOLS.MOVE
        };
        
        Object.entries(tools).forEach(([id, tool]) => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.classList.toggle('active', tool === activeTool);
            }
        });
    }
    
    updateViewButtons(activeView) {
        const views = {
            'viewPerspective': Constants.VIEWS.PERSPECTIVE,
            'viewTop': Constants.VIEWS.TOP,
            'viewFront': Constants.VIEWS.FRONT,
            'viewLeft': Constants.VIEWS.LEFT
        };
        
        Object.entries(views).forEach(([id, view]) => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.classList.toggle('active', view === activeView);
            }
        });
    }
    
    updateStatusBar() {
        const objectCount = this.warehouse ? this.warehouse.objects.length : 0;
        const pickingCount = this.app.pickingOrder ? this.app.pickingOrder.items.length : 0;
        const conflictCount = this.warehouse ? this.warehouse.conflicts.length : 0;
        
        const objectCountEl = document.getElementById('objectCount');
        const pickingCountEl = document.getElementById('pickingCount');
        const statusDot = document.getElementById('statusDot');
        const statusText = document.getElementById('statusText');
        
        if (objectCountEl) {
            objectCountEl.textContent = `对象: ${objectCount}`;
        }
        
        if (pickingCountEl) {
            pickingCountEl.textContent = `拣货单: ${pickingCount}`;
        }
        
        if (statusDot && statusText) {
            if (conflictCount > 0) {
                statusDot.className = 'status-dot warning';
                statusText.textContent = `存在 ${conflictCount} 个布局问题`;
            } else {
                statusDot.className = 'status-dot ok';
                statusText.textContent = '布局正常';
            }
        }
    }
    
    updateConflictsPanel(conflicts) {
        const panel = document.getElementById('conflictsPanel');
        const countEl = document.getElementById('conflictsCount');
        const listEl = document.getElementById('conflictsList');
        
        if (!panel || !countEl || !listEl) return;
        
        if (conflicts.length === 0) {
            panel.classList.add('hidden');
            return;
        }
        
        panel.classList.remove('hidden');
        countEl.textContent = conflicts.length;
        
        listEl.innerHTML = conflicts.map((conflict, index) => {
            const typeName = Constants.CONFLICT_TYPE_NAMES[conflict.type] || '未知问题';
            const objA = conflict.objectA ? this.warehouse.getObjectById(conflict.objectA) : null;
            const objB = conflict.objectB ? this.warehouse.getObjectById(conflict.objectB) : null;
            
            let objectsText = '';
            if (objA && objB) {
                objectsText = `${objA.name} ↔ ${objB.name}`;
            } else if (objA) {
                objectsText = objA.name;
            }
            
            return `
                <div class="conflict-item" data-index="${index}" data-obj-a="${conflict.objectA || ''}" data-obj-b="${conflict.objectB || ''}">
                    <div class="conflict-type">${typeName}</div>
                    <div class="conflict-description">${conflict.description || '检测到冲突'}</div>
                    ${objectsText ? `<div class="conflict-objects">涉及: ${objectsText}</div>` : ''}
                </div>
            `;
        }).join('');
        
        listEl.querySelectorAll('.conflict-item').forEach(item => {
            item.addEventListener('click', () => {
                const objA = item.dataset.objA;
                const objB = item.dataset.objB;
                
                if (objA) {
                    this.interactionController.selectObject(objA);
                }
            });
        });
    }
    
    runConflictDetection() {
        if (this.warehouse) {
            ConflictDetector.detect(this.warehouse);
        }
    }
    
    saveProject() {
        const projectData = ProjectIO.createProjectData(this.warehouse, this.app.pickingOrder);
        LocalStorageManager.saveCurrentProject(projectData);
        this.showNotification('项目已保存');
    }
    
    exportProject() {
        const projectData = ProjectIO.createProjectData(this.warehouse, this.app.pickingOrder);
        const jsonStr = JSON.stringify(projectData, null, 2);
        
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `warehouse_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showNotification('项目已导出');
    }
    
    loadProject(projectData) {
        try {
            const warehouse = ProjectIO.loadProject(projectData);
            this.app.warehouse = warehouse;
            this.warehouse = warehouse;
            
            this.sceneManager.setWarehouse(warehouse);
            this.runConflictDetection();
            
            if (projectData.pickingOrder) {
                this.app.pickingOrder = PickingOrder.fromJSON(projectData.pickingOrder);
                eventBus.emit(Constants.EVENTS.PICKING_IMPORTED, this.app.pickingOrder);
            }
            
            this.objectListUI.refresh();
            this.propertiesUI.clear();
            this.updateStatusBar();
            
            eventBus.emit(Constants.EVENTS.PROJECT_LOADED, warehouse);
            this.showNotification('项目已加载');
            
            return true;
        } catch (e) {
            console.error('加载项目失败:', e);
            this.showNotification('加载项目失败: ' + e.message, 'error');
            return false;
        }
    }
    
    playRoute() {
        if (!this.app.currentRoute) return;
        
        if (this.routePlayer) {
            this.routePlayer.resume();
        } else {
            this.routePlayer = new RoutePlayer(this.sceneManager, this.app.currentRoute);
            this.routePlayer.onProgress = (current, total) => {
                this.updateRouteProgress(current, total);
            };
            this.routePlayer.onComplete = () => {
                this.routePlayer = null;
            };
            this.routePlayer.play();
        }
    }
    
    pauseRoute() {
        if (this.routePlayer) {
            this.routePlayer.pause();
        }
    }
    
    stopRoute() {
        if (this.routePlayer) {
            this.routePlayer.stop();
            this.routePlayer = null;
        }
        this.updateRouteProgress(0, 0);
    }
    
    updateRouteProgress(current, total) {
        const progressFill = document.getElementById('routeProgressFill');
        const progressText = document.getElementById('routeProgressText');
        const routeControls = document.getElementById('routeControls');
        
        if (progressFill) {
            const percent = total > 0 ? (current / total * 100) : 0;
            progressFill.style.width = `${percent}%`;
        }
        
        if (progressText) {
            progressText.textContent = total > 0 ? `${current} / ${total}` : '0 / 0';
        }
        
        if (routeControls && total > 0) {
            routeControls.classList.remove('hidden');
        }
    }
    
    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 70px;
            right: 20px;
            padding: 12px 20px;
            background-color: ${type === 'error' ? '#ef4444' : '#10b981'};
            color: white;
            border-radius: 6px;
            z-index: 9999;
            font-size: 14px;
            animation: slideIn 0.3s ease-out;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
    
    refresh() {
        this.objectListUI.refresh();
        this.updateStatusBar();
        this.runConflictDetection();
    }
}
