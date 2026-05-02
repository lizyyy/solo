import { SceneManager } from './scene/SceneManager.js';
import { Stage, Bar } from './models/Stage.js';
import { Device, DeviceLibrary, DeviceTypes, MountingModes } from './models/Device.js';
import { DragManager } from './interaction/DragManager.js';
import { LoadCalculator } from './logic/LoadCalculator.js';
import { CollisionDetector, ProblemTypes } from './logic/CollisionDetector.js';
import { HistoryManager, ActionTypes } from './state/HistoryManager.js';
import { StateManager } from './state/StateManager.js';
import { ImportExportManager } from './io/ImportExportManager.js';
import { ReportGenerator } from './report/ReportGenerator.js';
import { UIManager } from './ui/UIManager.js';

class App {
  constructor() {
    this.init();
  }
  
  async init() {
    try {
      this.canvas = document.getElementById('main-canvas');
      
      this.sceneManager = new SceneManager(this.canvas);
      this.stage = new Stage();
      this.sceneManager.add(this.stage);
      
      this.deviceLibrary = new DeviceLibrary();
      this.historyManager = new HistoryManager();
      this.stateManager = new StateManager(this.stage);
      this.importExportManager = new ImportExportManager(this.stage, this.deviceLibrary);
      
      this.loadCalculator = new LoadCalculator(this.stage);
      this.collisionDetector = new CollisionDetector(this.stage);
      
      this.dragManager = new DragManager(this.sceneManager);
      
      this.uiManager = new UIManager(this);
      
      this.setupEventListeners();
      
      this.updateProblems();
      
      if (this.stateManager.hasSavedData()) {
        const result = this.stateManager.load();
        if (result.success) {
          this.loadState(result.state);
        }
      } else {
        this.loadExampleScene();
      }
      
      console.log('吊点载荷排练台已启动');
      
    } catch (error) {
      console.error('初始化失败:', error);
      alert('应用初始化失败，请刷新页面重试');
    }
  }
  
  setupEventListeners() {
    this.sceneManager.on('selectionChange', (object) => {
      this.uiManager.selectedObject = object;
      this.uiManager.renderPropertiesPanel();
    });
    
    this.dragManager.on('select', (object) => {
      this.sceneManager.setSelectedObject(object);
    });
    
    this.dragManager.on('positionChange', (data) => {
      this.historyManager.push(
        this.historyManager.createMoveDeviceAction(
          data.device,
          data.oldPosition,
          data.newPosition
        )
      );
      this.updateProblems();
    });
    
    this.dragManager.on('rotationChange', (data) => {
      this.updateProblems();
    });
    
    this.dragManager.on('delete', (device) => {
      this.handleDeleteDevice(device);
    });
    
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            this.handleRedo();
          } else {
            this.handleUndo();
          }
        } else if (e.key === 's') {
          e.preventDefault();
          this.handleSave();
        }
      }
    });
  }
  
  updateProblems() {
    const loadData = this.loadCalculator.calculateAll();
    const problems = this.collisionDetector.checkAll(loadData);
    
    this.uiManager.renderProblemsList(problems);
    this.uiManager.renderLoadsList(loadData);
    this.uiManager.updateProblemCount(problems);
    this.uiManager.updateDeviceCount();
    
    this.highlightProblemObjects(problems);
    
    return { loadData, problems };
  }
  
  highlightProblemObjects(problems) {
    for (const device of this.stage.devices) {
      device.setHighlightColor(0x3498db);
    }
    
    for (const problem of problems) {
      if (problem.objectType === 'device') {
        const device = this.stage.getDeviceById(problem.objectId);
        if (device) {
          device.setHighlightColor(
            problem.severity === 'danger' ? 0xe74c3c : 0xf39c12
          );
        }
        
        if (problem.relatedObjectId) {
          const relatedDevice = this.stage.getDeviceById(problem.relatedObjectId);
          if (relatedDevice) {
            relatedDevice.setHighlightColor(
              problem.severity === 'danger' ? 0xe74c3c : 0xf39c12
            );
          }
        }
      }
    }
  }
  
  handleDeleteDevice(device) {
    if (!device) return;
    
    if (confirm(`确定要删除 ${device.userData.name} 吗？`)) {
      this.historyManager.push(
        this.historyManager.createRemoveDeviceAction(device)
      );
      
      this.stage.removeDevice(device);
      this.sceneManager.remove(device);
      this.sceneManager.setSelectedObject(null);
      
      this.uiManager.renderPropertiesPanel();
      this.updateProblems();
      this.uiManager.updateStatus('已删除设备', 'safe');
    }
  }
  
  handleUndo() {
    if (this.historyManager.canUndo()) {
      const action = this.historyManager.undo();
      this.executeUndoAction(action);
      this.uiManager.updateStatus('已撤销', 'safe');
    }
  }
  
  handleRedo() {
    if (this.historyManager.canRedo()) {
      const action = this.historyManager.redo();
      this.executeRedoAction(action);
      this.uiManager.updateStatus('已重做', 'safe');
    }
  }
  
  handleSave() {
    const result = this.stateManager.save();
    if (result.success) {
      this.uiManager.updateLastSave(result.timestamp);
      this.uiManager.updateStatus('保存成功', 'safe');
    } else {
      this.uiManager.updateStatus(`保存失败: ${result.error}`, 'error');
    }
  }
  
  executeUndoAction(action) {
    if (!action) return;
    
    if (action.type === ActionTypes.BATCH) {
      for (const subAction of action.actions) {
        this.executeUndoAction(subAction);
      }
      return;
    }
    
    switch (action.type) {
      case ActionTypes.ADD_DEVICE:
        const deviceToRemove = this.stage.getDeviceById(action.deviceId);
        if (deviceToRemove) {
          this.stage.removeDevice(deviceToRemove);
          this.sceneManager.remove(deviceToRemove);
        }
        break;
        
      case ActionTypes.REMOVE_DEVICE:
        const restoredDevice = new Device(action.deviceData);
        restoredDevice.deserialize(action.deviceData);
        this.stage.addDevice(restoredDevice);
        this.sceneManager.add(restoredDevice);
        break;
        
      case ActionTypes.MOVE_DEVICE:
        const moveDevice = this.stage.getDeviceById(action.deviceId);
        if (moveDevice) {
          moveDevice.updatePosition(
            action.oldPosition.x,
            action.oldPosition.y,
            action.oldPosition.z
          );
        }
        break;
        
      case ActionTypes.ROTATE_DEVICE:
        const rotateDevice = this.stage.getDeviceById(action.deviceId);
        if (rotateDevice) {
          rotateDevice.updateRotation(
            action.oldRotation.x,
            action.oldRotation.y,
            action.oldRotation.z
          );
        }
        break;
        
      case ActionTypes.UPDATE_SETTINGS:
        this.stage.updateSettings(action.oldSettings);
        break;
    }
    
    this.updateProblems();
    this.uiManager.updateDeviceCount();
  }
  
  executeRedoAction(action) {
    if (!action) return;
    
    if (action.type === ActionTypes.BATCH) {
      for (const subAction of action.actions) {
        this.executeRedoAction(subAction);
      }
      return;
    }
    
    switch (action.type) {
      case ActionTypes.ADD_DEVICE:
        const addDevice = new Device(action.deviceData);
        addDevice.deserialize(action.deviceData);
        this.stage.addDevice(addDevice);
        this.sceneManager.add(addDevice);
        break;
        
      case ActionTypes.REMOVE_DEVICE:
        const removeDevice = this.stage.getDeviceById(action.deviceId);
        if (removeDevice) {
          this.stage.removeDevice(removeDevice);
          this.sceneManager.remove(removeDevice);
        }
        break;
        
      case ActionTypes.MOVE_DEVICE:
        const moveDevice = this.stage.getDeviceById(action.deviceId);
        if (moveDevice) {
          moveDevice.updatePosition(
            action.newPosition.x,
            action.newPosition.y,
            action.newPosition.z
          );
        }
        break;
        
      case ActionTypes.ROTATE_DEVICE:
        const rotateDevice = this.stage.getDeviceById(action.deviceId);
        if (rotateDevice) {
          rotateDevice.updateRotation(
            action.newRotation.x,
            action.newRotation.y,
            action.newRotation.z
          );
        }
        break;
        
      case ActionTypes.UPDATE_SETTINGS:
        this.stage.updateSettings(action.newSettings);
        break;
    }
    
    this.updateProblems();
    this.uiManager.updateDeviceCount();
  }
  
  loadState(state) {
    for (const device of [...this.stage.devices]) {
      this.stage.removeDevice(device);
      this.sceneManager.remove(device);
    }
    
    for (const bar of [...this.stage.bars]) {
      this.stage.removeBar(bar);
      this.sceneManager.remove(bar);
    }
    
    if (state.stage) {
      if (state.stage.settings) {
        this.stage.updateSettings(state.stage.settings);
      }
      
      if (state.stage.bars && state.stage.bars.length > 0) {
        for (const barData of state.stage.bars) {
          const bar = new Bar(barData);
          bar.deserialize(barData);
          this.stage.addBar(bar);
          this.sceneManager.add(bar);
        }
      }
      
      if (state.stage.devices && state.stage.devices.length > 0) {
        for (const deviceData of state.stage.devices) {
          const device = new Device(deviceData);
          device.deserialize(deviceData);
          this.stage.addDevice(device);
          this.sceneManager.add(device);
        }
      }
    }
    
    this.historyManager.clear();
    this.updateProblems();
    this.uiManager.updateDeviceCount();
    this.uiManager.renderPropertiesPanel();
  }
  
  loadExampleScene() {
    this.historyManager.startBatch();
    
    const devicesToAdd = [
      { templateId: 'light-par64', position: { x: -4, y: 6, z: -2 } },
      { templateId: 'light-par64', position: { x: 0, y: 6, z: -2 } },
      { templateId: 'light-par64', position: { x: 4, y: 6, z: -2 } },
      { templateId: 'light-moving-head', position: { x: -2, y: 6, z: 0 } },
      { templateId: 'light-moving-head', position: { x: 2, y: 6, z: 0 } },
      { templateId: 'screen-motorized', position: { x: 0, y: 5, z: 3 } },
      { templateId: 'speaker-15inch', position: { x: -6, y: 2, z: 2 } },
      { templateId: 'speaker-15inch', position: { x: 6, y: 2, z: 2 } },
      { templateId: 'speaker-sub', position: { x: -6, y: 0.3, z: 0 } },
      { templateId: 'speaker-sub', position: { x: 6, y: 0.3, z: 0 } },
      { templateId: 'light-led-panel', position: { x: -6, y: 5, z: -2 } },
      { templateId: 'light-led-panel', position: { x: 6, y: 5, z: -2 } }
    ];
    
    for (const item of devicesToAdd) {
      const device = this.deviceLibrary.createDeviceInstance(item.templateId);
      device.updatePosition(item.position.x, item.position.y, item.position.z);
      
      for (const hoistPoint of this.stage.hoistPoints) {
        const distance = Math.sqrt(
          Math.pow(device.userData.position.x - hoistPoint.userData.x, 2) +
          Math.pow(device.userData.position.z - hoistPoint.userData.z, 2)
        );
        
        if (distance < 1.5) {
          device.attachTo(hoistPoint.userData.id, 'hoistPoint');
          hoistPoint.attachDevice(device);
          break;
        }
      }
      
      this.stage.addDevice(device);
      this.sceneManager.add(device);
      this.historyManager.push(
        this.historyManager.createAddDeviceAction(device)
      );
    }
    
    this.historyManager.endBatch();
    
    this.updateProblems();
    this.uiManager.updateDeviceCount();
  }
  
  reset() {
    for (const device of [...this.stage.devices]) {
      this.stage.removeDevice(device);
      this.sceneManager.remove(device);
    }
    
    for (const bar of [...this.stage.bars]) {
      this.stage.removeBar(bar);
      this.sceneManager.remove(bar);
    }
    
    this.stage.updateSettings({
      width: 16,
      depth: 10,
      height: 8,
      gridXSpacing: 2,
      gridZSpacing: 2,
      hoistMaxLoad: 500
    });
    
    this.historyManager.clear();
    this.sceneManager.setSelectedObject(null);
    
    this.updateProblems();
    this.uiManager.updateDeviceCount();
    this.uiManager.renderPropertiesPanel();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new App();
});

export default App;
