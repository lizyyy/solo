export const ActionTypes = {
  ADD_DEVICE: 'add_device',
  REMOVE_DEVICE: 'remove_device',
  MOVE_DEVICE: 'move_device',
  ROTATE_DEVICE: 'rotate_device',
  ADD_BAR: 'add_bar',
  REMOVE_BAR: 'remove_bar',
  UPDATE_SETTINGS: 'update_settings',
  BATCH: 'batch'
};

export class HistoryManager {
  constructor(maxHistory = 50) {
    this.maxHistory = maxHistory;
    this.undoStack = [];
    this.redoStack = [];
    this.currentBatch = null;
  }
  
  canUndo() {
    return this.undoStack.length > 0;
  }
  
  canRedo() {
    return this.redoStack.length > 0;
  }
  
  push(action) {
    if (this.currentBatch) {
      this.currentBatch.actions.push(action);
      return;
    }
    
    this.undoStack.push(action);
    this.redoStack = [];
    
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    
    this.emit('change');
  }
  
  startBatch() {
    this.currentBatch = {
      type: ActionTypes.BATCH,
      actions: []
    };
  }
  
  endBatch() {
    if (this.currentBatch && this.currentBatch.actions.length > 0) {
      this.undoStack.push(this.currentBatch);
      this.redoStack = [];
      
      if (this.undoStack.length > this.maxHistory) {
        this.undoStack.shift();
      }
      
      this.emit('change');
    }
    
    this.currentBatch = null;
  }
  
  cancelBatch() {
    this.currentBatch = null;
  }
  
  undo() {
    if (!this.canUndo()) return null;
    
    const action = this.undoStack.pop();
    this.redoStack.push(action);
    
    this.emit('change');
    
    return action;
  }
  
  redo() {
    if (!this.canRedo()) return null;
    
    const action = this.redoStack.pop();
    this.undoStack.push(action);
    
    this.emit('change');
    
    return action;
  }
  
  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.currentBatch = null;
    this.emit('change');
  }
  
  createAddDeviceAction(device) {
    return {
      type: ActionTypes.ADD_DEVICE,
      deviceId: device.userData.id,
      deviceData: device.serialize(),
      timestamp: Date.now()
    };
  }
  
  createRemoveDeviceAction(device) {
    return {
      type: ActionTypes.REMOVE_DEVICE,
      deviceId: device.userData.id,
      deviceData: device.serialize(),
      timestamp: Date.now()
    };
  }
  
  createMoveDeviceAction(device, oldPosition, newPosition) {
    return {
      type: ActionTypes.MOVE_DEVICE,
      deviceId: device.userData.id,
      oldPosition: { ...oldPosition },
      newPosition: { ...newPosition },
      timestamp: Date.now()
    };
  }
  
  createRotateDeviceAction(device, oldRotation, newRotation) {
    return {
      type: ActionTypes.ROTATE_DEVICE,
      deviceId: device.userData.id,
      oldRotation: { ...oldRotation },
      newRotation: { ...newRotation },
      timestamp: Date.now()
    };
  }
  
  createUpdateSettingsAction(oldSettings, newSettings) {
    return {
      type: ActionTypes.UPDATE_SETTINGS,
      oldSettings: { ...oldSettings },
      newSettings: { ...newSettings },
      timestamp: Date.now()
    };
  }
  
  getUndoCount() {
    return this.undoStack.length;
  }
  
  getRedoCount() {
    return this.redoStack.length;
  }
  
  emit(eventName) {
    const event = new CustomEvent(`history:${eventName}`, {
      bubbles: true
    });
    document.dispatchEvent(event);
  }
  
  on(eventName, callback) {
    document.addEventListener(`history:${eventName}`, callback);
  }
  
  off(eventName, callback) {
    document.removeEventListener(`history:${eventName}`, callback);
  }
}
