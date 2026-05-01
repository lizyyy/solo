import * as THREE from 'three';

export const InteractionModes = {
  NONE: 'none',
  DRAG_DEVICE: 'drag_device',
  MOVE: 'move',
  ROTATE: 'rotate',
  SCALE: 'scale'
};

export class DragManager {
  constructor(sceneManager) {
    this.sceneManager = sceneManager;
    this.canvas = sceneManager.canvas;
    
    this.mode = InteractionModes.NONE;
    this.draggedDevice = null;
    this.dragStartPosition = new THREE.Vector3();
    this.dragStartMouse = { x: 0, y: 0 };
    
    this.ghostDevice = null;
    this.ghostMaterial = new THREE.MeshBasicMaterial({
      color: 0x3498db,
      transparent: true,
      opacity: 0.5,
      wireframe: true
    });
    
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.planeHelper = null;
    
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
    this.canvas.addEventListener('mouseleave', (e) => this.onMouseLeave(e));
    
    this.canvas.addEventListener('keydown', (e) => this.onKeyDown(e));
  }
  
  startDragDevice(deviceTemplate, screenX, screenY) {
    this.mode = InteractionModes.DRAG_DEVICE;
    this.dragStartMouse = { x: screenX, y: screenY };
    
    this.ghostDevice = deviceTemplate.clone();
    this.ghostDevice.traverse((child) => {
      if (child.isMesh) {
        child.material = this.ghostMaterial;
      }
    });
    
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const rect = this.canvas.getBoundingClientRect();
    mouse.x = ((screenX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((screenY - rect.top) / rect.height) * 2 + 1;
    
    raycaster.setFromCamera(mouse, this.sceneManager.camera);
    
    const planeY = 5;
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY);
    const intersectPoint = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, intersectPoint);
    
    if (intersectPoint) {
      this.ghostDevice.position.copy(intersectPoint);
    }
    
    this.sceneManager.add(this.ghostDevice);
    
    this.emit('dragStart', { device: this.ghostDevice });
  }
  
  onMouseDown(e) {
    if (e.button !== 0) return;
    
    const intersects = this.sceneManager.getIntersects(e);
    
    if (intersects.length > 0) {
      const object = this.getSelectableObject(intersects[0].object);
      
      if (object && object.userData.type === 'device') {
        this.sceneManager.controls.enabled = false;
        this.mode = InteractionModes.MOVE;
        this.draggedDevice = object;
        this.dragStartPosition.copy(object.position);
        
        this.plane = new THREE.Plane(
          new THREE.Vector3(0, 1, 0),
          -object.position.y
        );
        
        this.emit('select', object);
        this.emit('dragStart', { device: object });
      } else if (object) {
        this.sceneManager.setSelectedObject(object);
        this.emit('select', object);
      }
    } else {
      this.sceneManager.setSelectedObject(null);
      this.emit('select', null);
    }
  }
  
  onMouseMove(e) {
    const intersects = this.sceneManager.getIntersects(e);
    
    if (this.mode === InteractionModes.DRAG_DEVICE && this.ghostDevice) {
      const raycaster = new THREE.Raycaster();
      const mouse = new THREE.Vector2();
      const rect = this.canvas.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      
      raycaster.setFromCamera(mouse, this.sceneManager.camera);
      
      const planeY = 5;
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY);
      const intersectPoint = new THREE.Vector3();
      raycaster.ray.intersectPlane(plane, intersectPoint);
      
      if (intersectPoint) {
        this.ghostDevice.position.copy(intersectPoint);
        this.checkSnapPoints(intersectPoint);
      }
      
      this.emit('dragMove', { 
        device: this.ghostDevice, 
        position: this.ghostDevice.position.clone() 
      });
      
    } else if (this.mode === InteractionModes.MOVE && this.draggedDevice) {
      const raycaster = new THREE.Raycaster();
      const mouse = new THREE.Vector2();
      const rect = this.canvas.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      
      raycaster.setFromCamera(mouse, this.sceneManager.camera);
      
      const intersectPoint = new THREE.Vector3();
      raycaster.ray.intersectPlane(this.plane, intersectPoint);
      
      if (intersectPoint) {
        this.draggedDevice.updatePosition(
          intersectPoint.x,
          intersectPoint.y,
          intersectPoint.z
        );
        this.checkSnapPoints(intersectPoint);
      }
      
      this.emit('dragMove', { 
        device: this.draggedDevice, 
        position: this.draggedDevice.position.clone() 
      });
      
    } else {
      let hoveredObject = null;
      
      if (intersects.length > 0) {
        hoveredObject = this.getSelectableObject(intersects[0].object);
      }
      
      this.sceneManager.setHoveredObject(hoveredObject);
    }
  }
  
  onMouseUp(e) {
    if (this.mode === InteractionModes.DRAG_DEVICE && this.ghostDevice) {
      const position = this.ghostDevice.position.clone();
      
      this.sceneManager.remove(this.ghostDevice);
      
      this.emit('dragEnd', {
        device: this.ghostDevice,
        position: position,
        cancelled: false
      });
      
      this.ghostDevice = null;
      
    } else if (this.mode === InteractionModes.MOVE && this.draggedDevice) {
      this.emit('dragEnd', {
        device: this.draggedDevice,
        position: this.draggedDevice.position.clone(),
        cancelled: false
      });
      
      this.emit('positionChange', {
        device: this.draggedDevice,
        oldPosition: this.dragStartPosition.clone(),
        newPosition: this.draggedDevice.position.clone()
      });
    }
    
    this.mode = InteractionModes.NONE;
    this.draggedDevice = null;
    this.sceneManager.controls.enabled = true;
  }
  
  onMouseLeave(e) {
    this.sceneManager.setHoveredObject(null);
  }
  
  onKeyDown(e) {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      const selected = this.sceneManager.selectedObject;
      if (selected && selected.userData.type === 'device') {
        this.emit('delete', selected);
      }
    }
    
    if (e.key === 'Escape') {
      if (this.mode === InteractionModes.DRAG_DEVICE && this.ghostDevice) {
        this.sceneManager.remove(this.ghostDevice);
        this.ghostDevice = null;
        this.emit('dragEnd', { cancelled: true });
      }
      
      if (this.mode === InteractionModes.MOVE && this.draggedDevice) {
        this.draggedDevice.updatePosition(
          this.dragStartPosition.x,
          this.dragStartPosition.y,
          this.dragStartPosition.z
        );
        this.emit('dragEnd', { cancelled: true });
      }
      
      this.mode = InteractionModes.NONE;
      this.draggedDevice = null;
      this.sceneManager.controls.enabled = true;
    }
    
    if (this.sceneManager.selectedObject && this.sceneManager.selectedObject.userData.type === 'device') {
      const device = this.sceneManager.selectedObject;
      const moveAmount = 0.1;
      const rotateAmount = THREE.MathUtils.degToRad(5);
      const heightAmount = 0.1;
      
      if (e.shiftKey) {
        switch (e.key) {
          case 'ArrowLeft':
            device.updateRotation(
              device.userData.rotation.x,
              device.userData.rotation.y - rotateAmount,
              device.userData.rotation.z
            );
            this.emit('rotationChange', { device });
            break;
          case 'ArrowRight':
            device.updateRotation(
              device.userData.rotation.x,
              device.userData.rotation.y + rotateAmount,
              device.userData.rotation.z
            );
            this.emit('rotationChange', { device });
            break;
          case 'ArrowUp':
            device.updatePosition(
              device.userData.position.x,
              device.userData.position.y + heightAmount,
              device.userData.position.z
            );
            this.emit('heightChange', { device });
            break;
          case 'ArrowDown':
            device.updatePosition(
              device.userData.position.x,
              device.userData.position.y - heightAmount,
              device.userData.position.z
            );
            this.emit('heightChange', { device });
            break;
        }
      } else {
        switch (e.key) {
          case 'ArrowLeft':
            device.updatePosition(
              device.userData.position.x - moveAmount,
              device.userData.position.y,
              device.userData.position.z
            );
            this.emit('positionChange', { device });
            break;
          case 'ArrowRight':
            device.updatePosition(
              device.userData.position.x + moveAmount,
              device.userData.position.y,
              device.userData.position.z
            );
            this.emit('positionChange', { device });
            break;
          case 'ArrowUp':
            device.updatePosition(
              device.userData.position.x,
              device.userData.position.y,
              device.userData.position.z - moveAmount
            );
            this.emit('positionChange', { device });
            break;
          case 'ArrowDown':
            device.updatePosition(
              device.userData.position.x,
              device.userData.position.y,
              device.userData.position.z + moveAmount
            );
            this.emit('positionChange', { device });
            break;
        }
      }
    }
  }
  
  getSelectableObject(mesh) {
    let current = mesh;
    while (current) {
      if (current.userData.type && current.userData.type !== 'stage') {
        return current;
      }
      current = current.parent;
    }
    return null;
  }
  
  checkSnapPoints(position) {
    const snapDistance = 0.3;
    let snapped = false;
    
    for (const hoistPoint of this.sceneManager.scene.children) {
      if (hoistPoint.userData.type === 'hoistPoint') {
        const distance = position.distanceTo(hoistPoint.position);
        if (distance < snapDistance) {
          position.copy(hoistPoint.position);
          position.y -= 0.5;
          snapped = true;
          break;
        }
      }
    }
    
    return snapped;
  }
  
  emit(eventName, data) {
    const event = new CustomEvent(`drag:${eventName}`, {
      detail: data,
      bubbles: true
    });
    this.canvas.dispatchEvent(event);
  }
  
  on(eventName, callback) {
    this.canvas.addEventListener(`drag:${eventName}`, (e) => callback(e.detail));
  }
  
  off(eventName, callback) {
    this.canvas.removeEventListener(`drag:${eventName}`, callback);
  }
}
