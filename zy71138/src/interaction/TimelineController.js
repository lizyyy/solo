export class TimelineController {
  constructor(sceneManager) {
    this.sceneManager = sceneManager;
    this.playing = false;
    this.speed = 1;
    this.progress = 0;
    this.animationFrame = null;
    this.onProgressChange = null;
    
    this.history = [];
    this.initialStates = new Map();
    this.snapshots = [];
  }

  recordInitialState() {
    this.initialStates.clear();
    this.sceneManager.barriers.forEach(barrier => {
      this.initialStates.set(barrier.data.id, {
        x: barrier.mesh.position.x,
        z: barrier.mesh.position.z
      });
    });
    this.history = [];
    this.snapshots = [];
    this.createSnapshot();
  }

  recordDrag(dragEvent) {
    const { barrierId, from, to } = dragEvent;
    
    this.history.push({
      type: 'drag',
      barrierId,
      from,
      to,
      timestamp: Date.now()
    });
    
    this.createSnapshot();
  }

  recordBarrierAdd(barrierId, position) {
    this.initialStates.set(barrierId, { x: position.x, z: position.z });
    
    this.history.push({
      type: 'add',
      barrierId,
      position,
      timestamp: Date.now()
    });
    
    this.createSnapshot();
  }

  recordBarrierRemove(barrierId, lastPosition) {
    this.history.push({
      type: 'remove',
      barrierId,
      lastPosition,
      timestamp: Date.now()
    });
    
    this.createSnapshot();
  }

  createSnapshot() {
    const snapshot = new Map();
    this.sceneManager.barriers.forEach(barrier => {
      snapshot.set(barrier.data.id, {
        x: barrier.mesh.position.x,
        z: barrier.mesh.position.z,
        exists: true
      });
    });
    
    this.snapshots.push({
      index: this.snapshots.length,
      state: snapshot
    });
  }

  play() {
    if (this.playing) return;
    this.playing = true;
    this.animate();
  }

  pause() {
    this.playing = false;
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
  }

  toggle() {
    if (this.playing) {
      this.pause();
    } else {
      this.play();
    }
    return this.playing;
  }

  setSpeed(speed) {
    this.speed = speed;
  }

  setProgress(progress) {
    this.progress = Math.max(0, Math.min(100, progress));
    this.updateSceneState();
  }

  animate() {
    if (!this.playing) return;

    this.progress += 0.5 * this.speed;
    
    if (this.progress >= 100) {
      this.progress = 100;
      this.playing = false;
    }

    this.updateSceneState();
    
    if (this.onProgressChange) {
      this.onProgressChange(this.progress);
    }

    if (this.playing) {
      this.animationFrame = requestAnimationFrame(() => this.animate());
    }
  }

  updateSceneState() {
    if (this.snapshots.length === 0) return;

    const totalSteps = Math.max(this.snapshots.length - 1, 1);
    const stepProgress = (this.progress / 100) * totalSteps;
    const currentStep = Math.floor(stepProgress);
    const stepFraction = stepProgress - currentStep;

    const prevSnapshot = this.snapshots[Math.min(currentStep, this.snapshots.length - 1)];
    const nextSnapshot = this.snapshots[Math.min(currentStep + 1, this.snapshots.length - 1)];

    this.sceneManager.barriers.forEach(barrier => {
      const id = barrier.data.id;
      const prevState = prevSnapshot.state.get(id);
      const nextState = nextSnapshot.state.get(id);

      if (prevState && nextState) {
        const easeT = this.easeInOutQuad(stepFraction);
        barrier.mesh.position.x = prevState.x + (nextState.x - prevState.x) * easeT;
        barrier.mesh.position.z = prevState.z + (nextState.z - prevState.z) * easeT;
        
        barrier.data.x = barrier.mesh.position.x;
        barrier.data.z = barrier.mesh.position.z;
        barrier.mesh.userData.x = barrier.mesh.position.x;
        barrier.mesh.userData.z = barrier.mesh.position.z;
      } else if (prevState) {
        barrier.mesh.position.x = prevState.x;
        barrier.mesh.position.z = prevState.z;
        barrier.data.x = prevState.x;
        barrier.data.z = prevState.z;
        barrier.mesh.userData.x = prevState.x;
        barrier.mesh.userData.z = prevState.z;
      }
    });
  }

  easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  reset() {
    this.pause();
    this.progress = 0;
    
    if (this.snapshots.length > 0) {
      const firstSnapshot = this.snapshots[0];
      this.sceneManager.barriers.forEach(barrier => {
        const id = barrier.data.id;
        const state = firstSnapshot.state.get(id);
        if (state) {
          barrier.mesh.position.x = state.x;
          barrier.mesh.position.z = state.z;
          barrier.data.x = state.x;
          barrier.data.z = state.z;
          barrier.mesh.userData.x = state.x;
          barrier.mesh.userData.z = state.z;
        }
      });
    }
    
    this.updateSceneState();
    
    if (this.onProgressChange) {
      this.onProgressChange(0);
    }
  }

  goToEnd() {
    this.pause();
    this.progress = 100;
    this.updateSceneState();
    
    if (this.onProgressChange) {
      this.onProgressChange(100);
    }
  }

  getHistorySummary() {
    return {
      totalActions: this.history.length,
      dragActions: this.history.filter(h => h.type === 'drag').length,
      addActions: this.history.filter(h => h.type === 'add').length,
      removeActions: this.history.filter(h => h.type === 'remove').length,
      history: [...this.history]
    };
  }

  destroy() {
    this.pause();
  }
}
