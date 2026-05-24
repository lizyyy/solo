export class TimelineController {
  constructor(sceneManager) {
    this.sceneManager = sceneManager;
    this.playing = false;
    this.speed = 1;
    this.progress = 0;
    this.animationFrame = null;
    this.barrierStates = [];
    this.onProgressChange = null;
  }

  recordInitialState() {
    this.barrierStates = this.sceneManager.barriers.map((b, index) => ({
      index,
      startX: b.mesh.position.x,
      startZ: b.mesh.position.z,
      endX: b.mesh.position.x,
      endZ: b.mesh.position.z
    }));
  }

  setPlaybackSequence(targetPositions) {
    this.barrierStates = targetPositions;
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
    const t = this.progress / 100;
    
    this.sceneManager.barriers.forEach((barrier, index) => {
      const state = this.barrierStates[index];
      if (state) {
        const startX = state.startX || 0;
        const startZ = state.startZ || 0;
        const endX = state.endX !== undefined ? state.endX : barrier.data.x;
        const endZ = state.endZ !== undefined ? state.endZ : barrier.data.z;
        
        const easeT = this.easeInOutQuad(t);
        
        barrier.mesh.position.x = startX + (endX - startX) * easeT;
        barrier.mesh.position.z = startZ + (endZ - startZ) * easeT;
      }
    });
  }

  easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  reset() {
    this.pause();
    this.progress = 0;
    this.updateSceneState();
    
    this.sceneManager.barriers.forEach((barrier, index) => {
      const state = this.barrierStates[index];
      if (state) {
        barrier.mesh.position.x = state.startX;
        barrier.mesh.position.z = state.startZ;
      }
    });
  }

  destroy() {
    this.pause();
  }
}
