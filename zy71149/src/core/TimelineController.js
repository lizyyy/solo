import * as THREE from 'three';

export class TimelineController {
  constructor(sceneManager) {
    this.sceneManager = sceneManager;
    this.playing = false;
    this.currentTime = 0;
    this.duration = 10;
    this.speed = 1;
    this.routePoints = [];
    this.curve = null;
    this.animationFrame = null;
    this.lastTime = 0;
    this.onTimeUpdate = null;
    this.onPlayStateChange = null;
    this.vehicleRotation = 0;
  }

  setRoute(points) {
    this.routePoints = points;
    
    if (points.length >= 2) {
      const pathPoints = points.map(p => new THREE.Vector3(p.x, 0, p.z));
      this.curve = new THREE.CatmullRomCurve3(pathPoints);
      this.duration = Math.max(5, Math.min(30, points.length * 2));
    } else {
      this.curve = null;
    }
    
    this.currentTime = 0;
    this.updateVehicle();
  }

  play() {
    if (this.playing || !this.curve) return;
    
    this.playing = true;
    this.lastTime = performance.now();
    this.animate();
    
    if (this.onPlayStateChange) {
      this.onPlayStateChange(this.playing);
    }
  }

  pause() {
    this.playing = false;
    
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    
    if (this.onPlayStateChange) {
      this.onPlayStateChange(this.playing);
    }
  }

  toggle() {
    if (this.playing) {
      this.pause();
    } else {
      this.play();
    }
  }

  setTime(time) {
    this.currentTime = Math.max(0, Math.min(this.duration, time));
    this.updateVehicle();
    
    if (this.onTimeUpdate) {
      this.onTimeUpdate(this.currentTime, this.duration);
    }
  }

  setSpeed(speed) {
    this.speed = Math.max(0.25, Math.min(4, speed));
  }

  speedUp() {
    this.setSpeed(this.speed * 1.5);
  }

  speedDown() {
    this.setSpeed(this.speed / 1.5);
  }

  reset() {
    this.pause();
    this.currentTime = 0;
    this.updateVehicle();
    
    if (this.onTimeUpdate) {
      this.onTimeUpdate(this.currentTime, this.duration);
    }
  }

  animate() {
    if (!this.playing) return;
    
    this.animationFrame = requestAnimationFrame(() => this.animate());
    
    const now = performance.now();
    const delta = (now - this.lastTime) / 1000;
    this.lastTime = now;
    
    this.currentTime += delta * this.speed;
    
    if (this.currentTime >= this.duration) {
      this.currentTime = this.duration;
      this.pause();
    }
    
    this.updateVehicle();
    
    if (this.onTimeUpdate) {
      this.onTimeUpdate(this.currentTime, this.duration);
    }
  }

  updateVehicle() {
    if (!this.curve || !this.sceneManager.vehicle) return;
    
    const t = this.duration > 0 ? this.currentTime / this.duration : 0;
    const position = this.curve.getPointAt(t);
    
    const tangent = this.curve.getTangentAt(t);
    const angle = Math.atan2(tangent.x, tangent.z);
    
    this.sceneManager.updateVehiclePosition(
      { x: position.x, z: position.z },
      angle
    );
  }

  getProgress() {
    return this.duration > 0 ? (this.currentTime / this.duration) * 100 : 0;
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  dispose() {
    this.pause();
  }
}
