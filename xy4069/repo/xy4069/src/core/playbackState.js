import { CRDTTextModel } from './collabModel.js';

export class PlaybackState {
  constructor() {
    this.model = new CRDTTextModel();
    this.operations = [];
    this.currentIndex = -1;
    this.isPlaying = false;
    this.playbackSpeed = 1;
    this.playInterval = null;
    this.activeUserId = null;
    this.conflictMarkers = [];
    this.listeners = new Map();
    this.historySnapshots = [];
  }

  loadOperations(operations) {
    this.operations = operations;
    this.currentIndex = -1;
    this.model.reset();
    this.conflictMarkers = [];
    this.historySnapshots = [];
    this.activeUserId = this._detectDefaultUser();
    this._notify('operationsLoaded', { operations, activeUserId: this.activeUserId });
    return this.getState();
  }

  _detectDefaultUser() {
    if (this.operations.length === 0) return null;
    const userIds = [...new Set(this.operations.map(op => op.userId))];
    return userIds[0];
  }

  getState() {
    const modelState = this.model.getState();
    return {
      ...modelState,
      currentIndex: this.currentIndex,
      totalOperations: this.operations.length,
      isPlaying: this.isPlaying,
      playbackSpeed: this.playbackSpeed,
      activeUserId: this.activeUserId,
      conflictMarkers: [...this.conflictMarkers],
      currentOperation: this.operations[this.currentIndex] || null,
      progress: this.operations.length > 0 ? (this.currentIndex + 1) / this.operations.length : 0
    };
  }

  play(speed = 1) {
    if (this.isPlaying) this.pause();
    
    this.playbackSpeed = speed;
    this.isPlaying = true;
    this._notify('playbackStarted', { speed });

    const step = () => {
      if (!this.isPlaying) return;
      
      if (this.currentIndex >= this.operations.length - 1) {
        this.pause();
        this._notify('playbackEnded');
        return;
      }

      this.stepForward();
      
      const delay = 1000 / speed;
      this.playInterval = setTimeout(step, delay);
    };

    step();
    return this.getState();
  }

  pause() {
    this.isPlaying = false;
    if (this.playInterval) {
      clearTimeout(this.playInterval);
      this.playInterval = null;
    }
    this._notify('playbackPaused');
    return this.getState();
  }

  togglePlay() {
    if (this.isPlaying) {
      return this.pause();
    } else {
      return this.play(this.playbackSpeed);
    }
  }

  stepForward() {
    if (this.currentIndex >= this.operations.length - 1) {
      return this.getState();
    }

    if (this.historySnapshots.length <= this.currentIndex) {
      this.historySnapshots.push({
        modelState: JSON.parse(JSON.stringify(this.model.getState())),
        index: this.currentIndex
      });
    }

    this.currentIndex++;
    const operation = this.operations[this.currentIndex];
    
    const result = this.model.applyOperation(operation);
    
    if (result.conflicts.length > 0) {
      this.conflictMarkers.push({
        index: this.currentIndex,
        operationId: operation.operationId,
        conflicts: result.conflicts,
        timestamp: new Date().toISOString()
      });
      this._notify('conflictDetected', {
        index: this.currentIndex,
        operation,
        conflicts: result.conflicts
      });
    }

    this._notify('operationApplied', {
      index: this.currentIndex,
      operation,
      result
    });

    return this.getState();
  }

  stepBackward() {
    if (this.currentIndex < 0) {
      return this.getState();
    }

    if (this.historySnapshots.length > 0) {
      const snapshot = this.historySnapshots.pop();
      this.model = new CRDTTextModel();
      
      Object.entries(snapshot.modelState.userStates || {}).forEach(([userId, state]) => {
        this.model.userStates.set(userId, JSON.parse(JSON.stringify(state)));
      });
      this.model.document = snapshot.modelState.document;
      
      Object.entries(snapshot.modelState.cursors || {}).forEach(([userId, cursor]) => {
        this.model.cursors.set(userId, cursor);
      });
      
      this.model.operations = JSON.parse(JSON.stringify(snapshot.modelState.operations || []));
      this.model.conflicts = JSON.parse(JSON.stringify(snapshot.modelState.conflicts || []));
      
      Object.entries(snapshot.modelState.versionVector || {}).forEach(([userId, version]) => {
        this.model.versionVector.set(userId, version);
      });

      this.currentIndex = snapshot.index;
    } else {
      this.currentIndex--;
      this.model.reset();
      for (let i = 0; i <= this.currentIndex; i++) {
        this.model.applyOperation(this.operations[i]);
      }
    }

    this.conflictMarkers = this.conflictMarkers.filter(m => m.index <= this.currentIndex);

    this._notify('operationReverted', {
      index: this.currentIndex,
      operation: this.operations[this.currentIndex + 1]
    });

    return this.getState();
  }

  goToIndex(index) {
    if (index < 0 || index >= this.operations.length) {
      return this.getState();
    }

    if (index < this.currentIndex) {
      this.model.reset();
      this.historySnapshots = [];
      this.conflictMarkers = [];
      this.currentIndex = -1;
    }

    while (this.currentIndex < index) {
      this.stepForward();
    }

    return this.getState();
  }

  goToBeginning() {
    return this.goToIndex(-1);
  }

  goToEnd() {
    return this.goToIndex(this.operations.length - 1);
  }

  setPlaybackSpeed(speed) {
    this.playbackSpeed = Math.max(0.1, Math.min(10, speed));
    this._notify('speedChanged', { speed: this.playbackSpeed });
    return this.getState();
  }

  setActiveUserId(userId) {
    const oldUserId = this.activeUserId;
    this.activeUserId = userId;
    this._notify('activeUserChanged', { oldUserId, newUserId: userId });
    return this.getState();
  }

  getUniqueUsers() {
    return [...new Set(this.operations.map(op => op.userId))];
  }

  getOperationsByUser(userId) {
    return this.operations.filter(op => op.userId === userId);
  }

  getConflictsAtCurrentStep() {
    return this.conflictMarkers.filter(m => m.index === this.currentIndex);
  }

  getAllConflicts() {
    return this.conflictMarkers;
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (!this.listeners.has(event)) return;
    const callbacks = this.listeners.get(event);
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }

  _notify(event, data = {}) {
    if (!this.listeners.has(event)) return;
    const callbacks = this.listeners.get(event);
    for (const callback of callbacks) {
      try {
        callback(data);
      } catch (e) {
        console.error(`Error in event listener for ${event}:`, e);
      }
    }
  }

  reset() {
    this.pause();
    this.operations = [];
    this.currentIndex = -1;
    this.model.reset();
    this.conflictMarkers = [];
    this.historySnapshots = [];
    this.activeUserId = null;
    this._notify('reset');
    return this.getState();
  }
}
