/**
 * 交互控制器
 * 处理用户与 3D 场景的交互：选择、平移、旋转、移动对象
 */

class InteractionController {
    constructor(sceneManager) {
        this.sceneManager = sceneManager;
        this.container = sceneManager.renderer.domElement;
        
        this.currentTool = Constants.TOOLS.SELECT;
        this.selectedObjectId = null;
        
        this.isDragging = false;
        this.dragStartPosition = { x: 0, z: 0 };
        this.dragStartMouse = { x: 0, y: 0 };
        
        this.hoveredObjectId = null;
        
        this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        this.container.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.container.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.container.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.container.addEventListener('mouseleave', (e) => this.onMouseLeave(e));
        this.container.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
        
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        document.addEventListener('keyup', (e) => this.onKeyUp(e));
        
        this.container.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    
    setTool(tool) {
        this.currentTool = tool;
        
        this.updateCursor();
        this.updateOrbitControls();
        
        eventBus.emit(Constants.EVENTS.TOOL_CHANGED, tool);
    }
    
    updateCursor() {
        switch (this.currentTool) {
            case Constants.TOOLS.SELECT:
                this.container.style.cursor = 'pointer';
                break;
            case Constants.TOOLS.PAN:
                this.container.style.cursor = 'grab';
                break;
            case Constants.TOOLS.ROTATE:
                this.container.style.cursor = 'move';
                break;
            case Constants.TOOLS.MOVE:
                this.container.style.cursor = 'move';
                break;
            default:
                this.container.style.cursor = 'default';
        }
    }
    
    updateOrbitControls() {
        if (!this.sceneManager.controls) return;
        
        const controls = this.sceneManager.controls;
        
        switch (this.currentTool) {
            case Constants.TOOLS.SELECT:
                controls.enabled = true;
                controls.enableRotate = true;
                controls.enablePan = true;
                break;
            case Constants.TOOLS.PAN:
                controls.enabled = true;
                controls.enableRotate = false;
                controls.enablePan = true;
                break;
            case Constants.TOOLS.ROTATE:
            case Constants.TOOLS.MOVE:
                controls.enabled = false;
                break;
        }
    }
    
    onMouseDown(e) {
        if (e.button !== 0) return;
        
        const intersects = this.getIntersects(e);
        
        if (this.currentTool === Constants.TOOLS.SELECT) {
            if (intersects.length > 0) {
                const objId = this.getObjectIdFromIntersect(intersects[0]);
                if (objId) {
                    this.selectObject(objId);
                }
            } else {
                this.deselectAll();
            }
        }
        
        if (this.selectedObjectId && 
            (this.currentTool === Constants.TOOLS.MOVE || this.currentTool === Constants.TOOLS.ROTATE)) {
            this.isDragging = true;
            this.dragStartMouse = { x: e.clientX, y: e.clientY };
            
            const obj = this.sceneManager.warehouse.getObjectById(this.selectedObjectId);
            if (obj) {
                this.dragStartPosition = { x: obj.x, z: obj.z };
                this.dragStartRotation = obj.rotation;
            }
        }
    }
    
    onMouseMove(e) {
        const intersects = this.getIntersects(e);
        
        if (intersects.length > 0) {
            const objId = this.getObjectIdFromIntersect(intersects[0]);
            if (objId !== this.hoveredObjectId) {
                if (this.hoveredObjectId && this.hoveredObjectId !== this.selectedObjectId) {
                    this.sceneManager.highlightObject(this.hoveredObjectId, false);
                }
                
                this.hoveredObjectId = objId;
                
                if (objId && objId !== this.selectedObjectId) {
                    this.sceneManager.highlightObject(objId, true);
                }
            }
        } else {
            if (this.hoveredObjectId && this.hoveredObjectId !== this.selectedObjectId) {
                this.sceneManager.highlightObject(this.hoveredObjectId, false);
            }
            this.hoveredObjectId = null;
        }
        
        if (this.isDragging && this.selectedObjectId) {
            const obj = this.sceneManager.warehouse.getObjectById(this.selectedObjectId);
            if (!obj || obj.locked) return;
            
            const deltaX = (e.clientX - this.dragStartMouse.x) * 0.02;
            const deltaY = (e.clientY - this.dragStartMouse.y) * 0.02;
            
            if (this.currentTool === Constants.TOOLS.MOVE) {
                obj.x = this.dragStartPosition.x + deltaX;
                obj.z = this.dragStartPosition.z - deltaY;
                
                this.sceneManager.updateObject(obj);
                eventBus.emit(Constants.EVENTS.OBJECT_UPDATED, obj);
                
            } else if (this.currentTool === Constants.TOOLS.ROTATE) {
                let rotation = this.dragStartRotation + (deltaX + deltaY) * 2;
                rotation = Utils.normalizeAngle(rotation);
                obj.rotation = Math.round(rotation / 15) * 15;
                
                this.sceneManager.updateObject(obj);
                eventBus.emit(Constants.EVENTS.OBJECT_UPDATED, obj);
            }
        }
    }
    
    onMouseUp(e) {
        if (this.isDragging) {
            this.isDragging = false;
            
            if (this.selectedObjectId) {
                const obj = this.sceneManager.warehouse.getObjectById(this.selectedObjectId);
                if (obj) {
                    ConflictDetector.detect(this.sceneManager.warehouse);
                }
            }
        }
    }
    
    onMouseLeave(e) {
        this.isDragging = false;
        
        if (this.hoveredObjectId && this.hoveredObjectId !== this.selectedObjectId) {
            this.sceneManager.highlightObject(this.hoveredObjectId, false);
        }
        this.hoveredObjectId = null;
    }
    
    onWheel(e) {
        if (this.currentTool !== Constants.TOOLS.SELECT && this.currentTool !== Constants.TOOLS.PAN) {
            e.preventDefault();
        }
    }
    
    onKeyDown(e) {
        switch (e.key) {
            case 'Delete':
            case 'Backspace':
                if (this.selectedObjectId) {
                    const obj = this.sceneManager.warehouse.getObjectById(this.selectedObjectId);
                    if (obj && !obj.locked) {
                        this.deleteSelectedObject();
                    }
                }
                break;
                
            case 'Escape':
                this.deselectAll();
                break;
                
            case 'v':
            case 'V':
                this.setTool(Constants.TOOLS.SELECT);
                break;
                
            case 'h':
            case 'H':
                this.setTool(Constants.TOOLS.PAN);
                break;
                
            case 'r':
            case 'R':
                this.setTool(Constants.TOOLS.ROTATE);
                break;
                
            case 'g':
            case 'G':
                this.setTool(Constants.TOOLS.MOVE);
                break;
        }
    }
    
    onKeyUp(e) {
    }
    
    selectObject(objId) {
        if (this.selectedObjectId === objId) return;
        
        this.selectedObjectId = objId;
        this.sceneManager.selectObject(objId);
        
        const obj = this.sceneManager.warehouse.getObjectById(objId);
        eventBus.emit(Constants.EVENTS.OBJECT_SELECTED, obj);
    }
    
    deselectAll() {
        if (this.selectedObjectId) {
            this.sceneManager.selectObject(null);
            this.selectedObjectId = null;
        }
        
        eventBus.emit(Constants.EVENTS.OBJECT_SELECTED, null);
    }
    
    deleteSelectedObject() {
        if (!this.selectedObjectId) return;
        
        const objId = this.selectedObjectId;
        this.deselectAll();
        
        this.sceneManager.warehouse.removeObject(objId);
        this.sceneManager.removeObject(objId);
        
        ConflictDetector.detect(this.sceneManager.warehouse);
    }
    
    getIntersects(e) {
        const rect = this.container.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        
        this.raycaster.setFromCamera(this.mouse, this.sceneManager.camera);
        
        const meshes = [];
        this.sceneManager.objectMeshes.forEach(mesh => {
            meshes.push(mesh);
        });
        
        return this.raycaster.intersectObjects(meshes, true);
    }
    
    getObjectIdFromIntersect(intersect) {
        let obj = intersect.object;
        
        while (obj) {
            if (obj.userData.objectId) {
                return obj.userData.objectId;
            }
            obj = obj.parent;
        }
        
        return null;
    }
    
    getSelectedObject() {
        if (!this.selectedObjectId) return null;
        return this.sceneManager.warehouse.getObjectById(this.selectedObjectId);
    }
}
