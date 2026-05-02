import * as THREE from 'three';

export const InteractionMode = {
  NONE: 'none',
  SELECT: 'select',
  MOVE_ATTACHMENT: 'move_attachment',
  MOVE_TOOTH: 'move_tooth',
  ROTATE_VIEW: 'rotate_view',
  PAN_VIEW: 'pan_view',
  ZOOM_VIEW: 'zoom_view'
};

export class InteractionState {
  constructor() {
    this.mode = InteractionMode.NONE;
    this.selectedTooth = null;
    this.selectedAttachment = null;
    
    this.isDragging = false;
    this.dragStartPosition = new THREE.Vector3();
    this.dragDelta = new THREE.Vector3();
    
    this.snapEnabled = true;
    this.snapStep = 0.5;
    
    this.axisLock = { x: false, y: false, z: false };
    this.movementLimit = { min: -50, max: 50 };
    
    this.listeners = [];
    
    this.history = [];
    this.historyIndex = -1;
    this.maxHistoryLength = 50;
  }

  setMode(mode) {
    if (this.mode !== mode) {
      const oldMode = this.mode;
      this.mode = mode;
      this.notify('modeChanged', { oldMode, newMode: mode });
    }
  }

  selectTooth(toothData) {
    this.selectedTooth = toothData;
    this.selectedAttachment = null;
    this.setMode(InteractionMode.SELECT);
    this.notify('toothSelected', { tooth: toothData });
  }

  selectAttachment(toothData, attachmentIndex = 0) {
    this.selectedTooth = toothData;
    this.selectedAttachment = {
      toothId: toothData.id,
      fdiNumber: toothData.fdiNumber,
      index: attachmentIndex
    };
    this.setMode(InteractionMode.MOVE_ATTACHMENT);
    this.notify('attachmentSelected', { 
      tooth: toothData, 
      attachmentIndex 
    });
  }

  clearSelection() {
    this.selectedTooth = null;
    this.selectedAttachment = null;
    this.setMode(InteractionMode.NONE);
    this.notify('selectionCleared', {});
  }

  startDrag(startPosition) {
    if (!this.canDrag()) {
      return false;
    }
    
    this.isDragging = true;
    this.dragStartPosition.copy(startPosition);
    this.dragDelta.set(0, 0, 0);
    this.notify('dragStarted', { startPosition });
    
    return true;
  }

  updateDrag(currentPosition) {
    if (!this.isDragging) {
      return null;
    }

    this.dragDelta.subVectors(currentPosition, this.dragStartPosition);

    if (this.axisLock.x) this.dragDelta.y = this.dragDelta.z = 0;
    if (this.axisLock.y) this.dragDelta.x = this.dragDelta.z = 0;
    if (this.axisLock.z) this.dragDelta.x = this.dragDelta.y = 0;

    if (this.snapEnabled) {
      this.dragDelta.x = Math.round(this.dragDelta.x / this.snapStep) * this.snapStep;
      this.dragDelta.y = Math.round(this.dragDelta.y / this.snapStep) * this.snapStep;
      this.dragDelta.z = Math.round(this.dragDelta.z / this.snapStep) * this.snapStep;
    }

    this._clampDelta();

    this.notify('dragUpdated', { 
      delta: this.dragDelta.clone(),
      currentPosition 
    });

    return this.dragDelta.clone();
  }

  endDrag(finalPosition) {
    if (!this.isDragging) {
      return false;
    }

    this.isDragging = false;
    
    const finalDelta = this.dragDelta.clone();
    this.notify('dragEnded', { 
      delta: finalDelta,
      finalPosition 
    });

    if (finalDelta.length() > 0) {
      this._saveHistory({
        type: this.mode,
        targetId: this.selectedAttachment?.toothId || this.selectedTooth?.id,
        delta: finalDelta.clone(),
        timestamp: Date.now()
      });
    }

    this.dragStartPosition.set(0, 0, 0);
    this.dragDelta.set(0, 0, 0);

    return true;
  }

  canDrag() {
    return (this.mode === InteractionMode.MOVE_ATTACHMENT && this.selectedAttachment) ||
           (this.mode === InteractionMode.MOVE_TOOTH && this.selectedTooth);
  }

  setSnapEnabled(enabled) {
    this.snapEnabled = enabled;
    this.notify('snapChanged', { enabled });
  }

  setSnapStep(step) {
    this.snapStep = Math.max(0.1, step);
    this.notify('snapStepChanged', { step: this.snapStep });
  }

  setAxisLock(lockX, lockY, lockZ) {
    this.axisLock = { x: lockX, y: lockY, z: lockZ };
    this.notify('axisLockChanged', this.axisLock);
  }

  setMovementLimit(min, max) {
    this.movementLimit = { min, max };
    this.notify('movementLimitChanged', this.movementLimit);
  }

  addEventListener(type, callback) {
    this.listeners.push({ type, callback });
  }

  removeEventListener(type, callback) {
    this.listeners = this.listeners.filter(
      l => !(l.type === type && l.callback === callback)
    );
  }

  notify(type, data) {
    this.listeners
      .filter(l => l.type === type)
      .forEach(l => l.callback(data));
  }

  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      const action = this.history[this.historyIndex];
      this.notify('undo', { action, index: this.historyIndex });
      return true;
    }
    return false;
  }

  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      const action = this.history[this.historyIndex];
      this.notify('redo', { action, index: this.historyIndex });
      return true;
    }
    return false;
  }

  canUndo() {
    return this.historyIndex > 0;
  }

  canRedo() {
    return this.historyIndex < this.history.length - 1;
  }

  clearHistory() {
    this.history = [];
    this.historyIndex = -1;
    this.notify('historyCleared', {});
  }

  getState() {
    return {
      mode: this.mode,
      selectedTooth: this.selectedTooth ? { ...this.selectedTooth } : null,
      selectedAttachment: this.selectedAttachment ? { ...this.selectedAttachment } : null,
      isDragging: this.isDragging,
      dragDelta: this.dragDelta.clone(),
      snapEnabled: this.snapEnabled,
      snapStep: this.snapStep,
      axisLock: { ...this.axisLock },
      movementLimit: { ...this.movementLimit },
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      historyLength: this.history.length,
      currentHistoryIndex: this.historyIndex
    };
  }

  _clampDelta() {
    this.dragDelta.x = Math.max(this.movementLimit.min, Math.min(this.movementLimit.max, this.dragDelta.x));
    this.dragDelta.y = Math.max(this.movementLimit.min, Math.min(this.movementLimit.max, this.dragDelta.y));
    this.dragDelta.z = Math.max(this.movementLimit.min, Math.min(this.movementLimit.max, this.dragDelta.z));
  }

  _saveHistory(action) {
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }

    this.history.push(action);

    if (this.history.length > this.maxHistoryLength) {
      this.history.shift();
    } else {
      this.historyIndex++;
    }

    this.notify('historyUpdated', { 
      action, 
      index: this.historyIndex,
      total: this.history.length
    });
  }
}

export default InteractionState;
