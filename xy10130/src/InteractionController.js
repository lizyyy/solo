export class InteractionController {
  constructor(sceneManager, sensorManager) {
    this.sceneManager = sceneManager;
    this.sensorManager = sensorManager;
    
    this.isDragging = false;
    this.draggedSensorId = null;
    this.isAddingMode = false;
    
    this.bindEvents();
  }
  
  bindEvents() {
    const canvas = this.sceneManager.canvas;
    
    canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
    canvas.addEventListener('dblclick', (e) => this.onDoubleClick(e));
  }
  
  setAddingMode(enabled) {
    this.isAddingMode = enabled;
  }
  
  onMouseDown(event) {
    if (event.button !== 0) return;
    
    const sensorMeshes = Array.from(this.sensorManager.sensorMeshes.values());
    const intersects = this.sceneManager.getIntersects(event, sensorMeshes);
    
    if (intersects.length > 0) {
      const mesh = intersects[0].object;
      const sensorId = mesh.userData.sensorId;
      
      if (sensorId) {
        this.isDragging = true;
        this.draggedSensorId = sensorId;
        this.sensorManager.setSelectedSensor(sensorId);
        this.sceneManager.controls.enabled = false;
        event.preventDefault();
      }
    }
  }
  
  onMouseMove(event) {
    if (this.isDragging && this.draggedSensorId) {
      const pos = this.sceneManager.getFloorPosition(event);
      if (pos) {
        this.sensorManager.updateSensorPosition(this.draggedSensorId, pos.x, pos.z);
        this.emit('sensorMoved', { id: this.draggedSensorId, x: pos.x, z: pos.z });
      }
    }
  }
  
  onMouseUp(event) {
    if (this.isDragging) {
      this.isDragging = false;
      this.draggedSensorId = null;
      this.sceneManager.controls.enabled = true;
      this.emit('dragEnd');
    }
  }
  
  onDoubleClick(event) {
    const pos = this.sceneManager.getFloorPosition(event);
    if (pos) {
      const sensor = this.sensorManager.addSensor(pos.x, pos.z);
      this.sensorManager.setSelectedSensor(sensor.id);
      this.emit('sensorAdded', sensor);
    }
  }
  
  addSensorAtPosition(x, z) {
    const sensor = this.sensorManager.addSensor(x, z);
    this.sensorManager.setSelectedSensor(sensor.id);
    this.emit('sensorAdded', sensor);
    return sensor;
  }
  
  emit(eventName, data) {
    const event = new CustomEvent(`ic:${eventName}`, { detail: data });
    this.sceneManager.canvas.dispatchEvent(event);
  }
  
  on(eventName, callback) {
    this.sceneManager.canvas.addEventListener(`ic:${eventName}`, (e) => callback(e.detail));
  }
}
