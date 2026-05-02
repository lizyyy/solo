import { Vector3, HangingPoint, Truss, Device, Obstacle, Counterweight, sceneManager } from '../models/SceneModel.js';
import { threeRenderer } from '../renderer/ThreeRenderer.js';
import { loadCalculator } from '../engine/LoadCalculator.js';
import { collisionDetector } from '../engine/CollisionDetector.js';

class InteractionManager {
  constructor() {
    this.mode = 'select';
    this.selectedObject = null;
    this.draggingObject = null;
    this.dragStartPosition = null;
    this.objectStartPosition = null;
    this.isDragging = false;
    
    this.callbacks = {
      onSelect: null,
      onDeselect: null,
      onDragStart: null,
      onDragEnd: null,
      onObjectAdded: null,
      onObjectRemoved: null,
      onObjectModified: null,
      onSceneUpdate: null
    };
    
    this.clipboard = null;
    this.snapToGrid = true;
    this.gridSize = 0.5;
    
    this.addModeType = 'device';
  }

  init(containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error('Container not found for InteractionManager');
      return false;
    }

    container.addEventListener('mousedown', (e) => this.onMouseDown(e));
    container.addEventListener('mousemove', (e) => this.onMouseMove(e));
    container.addEventListener('mouseup', (e) => this.onMouseUp(e));
    container.addEventListener('mouseleave', (e) => this.onMouseUp(e));
    container.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.onRightClick(e);
    });

    document.addEventListener('keydown', (e) => this.onKeyDown(e));
    document.addEventListener('keyup', (e) => this.onKeyUp(e));

    return true;
  }

  setMode(mode) {
    this.mode = mode;
    if (mode !== 'select' && mode !== 'add') {
      this.deselectAll();
    }
    this.updateCursor();
  }

  setAddModeType(type) {
    this.addModeType = type;
  }

  getMode() {
    return this.mode;
  }

  onMouseDown(e) {
    if (e.button !== 0) return;

    const userData = threeRenderer.getObjectAtPixel(e.clientX, e.clientY);
    
    if (this.mode === 'select') {
      if (userData && userData.type) {
        this.selectObject(userData);
        this.startDragging(userData, e);
      } else {
        this.deselectAll();
      }
    } else if (this.mode === 'add') {
      this.addObjectAtPosition(e);
    }
  }

  onMouseMove(e) {
    if (this.isDragging && this.draggingObject) {
      this.updateDragPosition(e);
    }
  }

  onMouseUp(e) {
    if (this.isDragging) {
      this.stopDragging();
    }
  }

  onRightClick(e) {
    const userData = threeRenderer.getObjectAtPixel(e.clientX, e.clientY);
    if (userData && userData.type) {
      this.showContextMenu(e, userData);
    }
  }

  onKeyDown(e) {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (this.selectedObject && this.selectedObject.id) {
        this.deleteSelectedObject();
      }
    } else if (e.key === 'Escape') {
      this.deselectAll();
      this.setMode('select');
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
      this.copySelected();
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
      this.pasteClipboard();
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
      this.duplicateSelected();
    }
  }

  onKeyUp(e) {
  }

  selectObject(userData) {
    this.deselectAll();
    this.selectedObject = userData;
    
    if (this.callbacks.onSelect) {
      this.callbacks.onSelect(userData);
    }
  }

  deselectAll() {
    const oldSelection = this.selectedObject;
    this.selectedObject = null;
    
    if (oldSelection && this.callbacks.onDeselect) {
      this.callbacks.onDeselect(oldSelection);
    }
  }

  startDragging(userData, e) {
    if (!userData || !userData.id) return;
    
    this.isDragging = true;
    this.draggingObject = userData;
    this.dragStartPosition = { x: e.clientX, y: e.clientY };
    
    const scene = sceneManager.currentScene;
    let object = null;
    
    switch (userData.type) {
      case 'hangingPoint':
        object = scene.getHangingPointById(userData.id);
        break;
      case 'truss':
        object = scene.getTrussById(userData.id);
        break;
      case 'device':
        object = scene.getDeviceById(userData.id);
        break;
      case 'obstacle':
        object = scene.getObstacleById(userData.id);
        break;
      case 'counterweight':
        object = scene.getCounterweightById(userData.id);
        break;
    }
    
    if (object) {
      this.objectStartPosition = object.position.clone();
    }
    
    if (this.callbacks.onDragStart) {
      this.callbacks.onDragStart(userData);
    }
  }

  updateDragPosition(e) {
    if (!this.draggingObject || !this.objectStartPosition) return;

    const dx = (e.clientX - this.dragStartPosition.x) * 0.02;
    const dz = (e.clientY - this.dragStartPosition.y) * 0.02;

    const scene = sceneManager.currentScene;
    let object = null;

    switch (this.draggingObject.type) {
      case 'hangingPoint':
        object = scene.getHangingPointById(this.draggingObject.id);
        break;
      case 'truss':
        object = scene.getTrussById(this.draggingObject.id);
        break;
      case 'device':
        object = scene.getDeviceById(this.draggingObject.id);
        break;
      case 'obstacle':
        object = scene.getObstacleById(this.draggingObject.id);
        break;
      case 'counterweight':
        object = scene.getCounterweightById(this.draggingObject.id);
        break;
    }

    if (object) {
      let newX = this.objectStartPosition.x + dx;
      let newZ = this.objectStartPosition.z + dz;

      if (this.snapToGrid) {
        newX = Math.round(newX / this.gridSize) * this.gridSize;
        newZ = Math.round(newZ / this.gridSize) * this.gridSize;
      }

      object.position.x = newX;
      object.position.z = newZ;

      scene.markModified();
      this.updateScene();
    }
  }

  stopDragging() {
    const wasDragging = this.isDragging;
    this.isDragging = false;
    this.draggingObject = null;
    this.dragStartPosition = null;
    this.objectStartPosition = null;

    if (wasDragging && this.callbacks.onDragEnd) {
      this.callbacks.onDragEnd();
    }
  }

  addObjectAtPosition(e) {
    const scene = sceneManager.currentScene;
    let newObject = null;

    switch (this.addModeType) {
      case 'hangingPoint':
        newObject = new HangingPoint();
        newObject.name = `吊点_${scene.hangingPoints.length + 1}`;
        newObject.position.y = 8;
        scene.addHangingPoint(newObject);
        break;

      case 'truss':
        newObject = new Truss();
        newObject.name = `桁架_${scene.trusses.length + 1}`;
        newObject.position.y = 7;
        scene.addTruss(newObject);
        break;

      case 'device':
        newObject = new Device();
        newObject.name = `设备_${scene.devices.length + 1}`;
        newObject.position.y = 6;
        scene.addDevice(newObject);
        break;

      case 'obstacle':
        newObject = new Obstacle();
        newObject.name = `障碍物_${scene.obstacles.length + 1}`;
        newObject.position.y = 4;
        scene.addObstacle(newObject);
        break;

      case 'counterweight':
        newObject = new Counterweight();
        newObject.name = `配重_${scene.counterweights.length + 1}`;
        newObject.position.y = 5;
        newObject.weight = 50;
        scene.addCounterweight(newObject);
        break;
    }

    if (newObject) {
      if (this.callbacks.onObjectAdded) {
        this.callbacks.onObjectAdded(newObject);
      }
      this.updateScene();
    }
  }

  deleteSelectedObject() {
    if (!this.selectedObject || !this.selectedObject.id) return;

    const scene = sceneManager.currentScene;
    const objectId = this.selectedObject.id;
    const objectType = this.selectedObject.type;

    let success = false;
    switch (objectType) {
      case 'hangingPoint':
        success = scene.removeHangingPoint(objectId);
        break;
      case 'truss':
        success = scene.removeTruss(objectId);
        break;
      case 'device':
        success = scene.removeDevice(objectId);
        break;
      case 'obstacle':
        success = scene.removeObstacle(objectId);
        break;
      case 'counterweight':
        success = scene.removeCounterweight(objectId);
        break;
    }

    if (success) {
      if (this.callbacks.onObjectRemoved) {
        this.callbacks.onObjectRemoved({ id: objectId, type: objectType });
      }
      this.deselectAll();
      this.updateScene();
    }
  }

  copySelected() {
    if (!this.selectedObject || !this.selectedObject.id) return;

    const scene = sceneManager.currentScene;
    const objectType = this.selectedObject.type;
    let sourceObject = null;

    switch (objectType) {
      case 'hangingPoint':
        sourceObject = scene.getHangingPointById(this.selectedObject.id);
        break;
      case 'truss':
        sourceObject = scene.getTrussById(this.selectedObject.id);
        break;
      case 'device':
        sourceObject = scene.getDeviceById(this.selectedObject.id);
        break;
      case 'obstacle':
        sourceObject = scene.getObstacleById(this.selectedObject.id);
        break;
      case 'counterweight':
        sourceObject = scene.getCounterweightById(this.selectedObject.id);
        break;
    }

    if (sourceObject) {
      this.clipboard = {
        type: objectType,
        data: sourceObject.toJSON()
      };
    }
  }

  pasteClipboard() {
    if (!this.clipboard) return;

    const scene = sceneManager.currentScene;
    const { type, data } = this.clipboard;
    let newObject = null;

    switch (type) {
      case 'hangingPoint':
        newObject = new HangingPoint();
        Object.assign(newObject, data);
        newObject.id = newObject.generateId();
        newObject.name = `${data.name}_copy`;
        newObject.position.x += 1;
        newObject.position.z += 1;
        scene.addHangingPoint(newObject);
        break;

      case 'truss':
        newObject = new Truss();
        Object.assign(newObject, data);
        newObject.id = newObject.generateId();
        newObject.name = `${data.name}_copy`;
        newObject.position.x += 1;
        newObject.position.z += 1;
        newObject.devices = [];
        newObject.hangingPoints = [];
        scene.addTruss(newObject);
        break;

      case 'device':
        newObject = new Device();
        Object.assign(newObject, data);
        newObject.id = newObject.generateId();
        newObject.name = `${data.name}_copy`;
        newObject.position.x += 1;
        newObject.position.z += 1;
        newObject.attachedTrussId = null;
        scene.addDevice(newObject);
        break;

      case 'obstacle':
        newObject = new Obstacle();
        Object.assign(newObject, data);
        newObject.id = newObject.generateId();
        newObject.name = `${data.name}_copy`;
        newObject.position.x += 1;
        newObject.position.z += 1;
        scene.addObstacle(newObject);
        break;

      case 'counterweight':
        newObject = new Counterweight();
        Object.assign(newObject, data);
        newObject.id = newObject.generateId();
        newObject.name = `${data.name}_copy`;
        newObject.position.x += 1;
        newObject.position.z += 1;
        scene.addCounterweight(newObject);
        break;
    }

    if (newObject && this.callbacks.onObjectAdded) {
      this.callbacks.onObjectAdded(newObject);
      this.updateScene();
    }
  }

  duplicateSelected() {
    this.copySelected();
    this.pasteClipboard();
  }

  updateScene() {
    loadCalculator.calculate();
    collisionDetector.detect();
    threeRenderer.renderScene();
    
    if (this.callbacks.onSceneUpdate) {
      this.callbacks.onSceneUpdate();
    }
  }

  setGridSnap(enabled, size = 0.5) {
    this.snapToGrid = enabled;
    this.gridSize = size;
  }

  setCallback(name, callback) {
    if (this.callbacks.hasOwnProperty(name)) {
      this.callbacks[name] = callback;
    }
  }

  showContextMenu(e, userData) {
    console.log('Context menu for:', userData);
  }

  updateCursor() {
    const container = threeRenderer.renderer?.domElement;
    if (!container) return;

    switch (this.mode) {
      case 'select':
        container.style.cursor = this.selectedObject ? 'move' : 'pointer';
        break;
      case 'add':
        container.style.cursor = 'crosshair';
        break;
      default:
        container.style.cursor = 'default';
    }
  }

  moveObject(objectId, type, deltaX, deltaY, deltaZ) {
    const scene = sceneManager.currentScene;
    let object = null;

    switch (type) {
      case 'hangingPoint':
        object = scene.getHangingPointById(objectId);
        break;
      case 'truss':
        object = scene.getTrussById(objectId);
        break;
      case 'device':
        object = scene.getDeviceById(objectId);
        break;
      case 'obstacle':
        object = scene.getObstacleById(objectId);
        break;
      case 'counterweight':
        object = scene.getCounterweightById(objectId);
        break;
    }

    if (object) {
      object.position.x += deltaX;
      object.position.y += deltaY;
      object.position.z += deltaZ;
      
      scene.markModified();
      
      if (this.callbacks.onObjectModified) {
        this.callbacks.onObjectModified(object);
      }
      
      this.updateScene();
      return true;
    }
    return false;
  }

  updateObjectProperties(objectId, type, properties) {
    const scene = sceneManager.currentScene;
    let object = null;

    switch (type) {
      case 'hangingPoint':
        object = scene.getHangingPointById(objectId);
        break;
      case 'truss':
        object = scene.getTrussById(objectId);
        break;
      case 'device':
        object = scene.getDeviceById(objectId);
        break;
      case 'obstacle':
        object = scene.getObstacleById(objectId);
        break;
      case 'counterweight':
        object = scene.getCounterweightById(objectId);
        break;
    }

    if (object) {
      for (const [key, value] of Object.entries(properties)) {
        if (key === 'position' && value instanceof Vector3) {
          object.position.x = value.x;
          object.position.y = value.y;
          object.position.z = value.z;
        } else if (key === 'rotation' && value instanceof Vector3) {
          object.rotation.x = value.x;
          object.rotation.y = value.y;
          object.rotation.z = value.z;
        } else if (key === 'dimensions' && value instanceof Vector3 && object.dimensions) {
          object.dimensions.x = value.x;
          object.dimensions.y = value.y;
          object.dimensions.z = value.z;
        } else if (object.hasOwnProperty(key)) {
          object[key] = value;
        }
      }
      
      scene.markModified();
      
      if (this.callbacks.onObjectModified) {
        this.callbacks.onObjectModified(object);
      }
      
      this.updateScene();
      return true;
    }
    return false;
  }
}

const interactionManager = new InteractionManager();

export {
  InteractionManager,
  interactionManager
};
