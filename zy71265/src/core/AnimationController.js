import * as THREE from 'three';
import { lerp, lerpPoint } from '../utils/helpers.js';
import { GALLERY_DIMENSIONS } from '../utils/constants.js';

export class AnimationController {
  constructor(sceneManager) {
    this.sceneManager = sceneManager;
    this.isPlaying = false;
    this.currentTime = 0;
    this.duration = 0;
    this.speed = 1;
    this.visitors = [];
    this.activeVisitors = new Map();
    this.onUpdate = null;
    this.onComplete = null;
    this.animationFrameId = null;
    this.lastTimestamp = 0;
  }

  setVisitors(visitors) {
    this.visitors = visitors;
    this.activeVisitors.clear();
    this.sceneManager.clearVisitors();

    if (visitors.length === 0) {
      this.duration = 0;
      return;
    }

    const allTimestamps = visitors.flatMap(v => v.path.map(p => p.timestamp));
    const minTime = Math.min(...allTimestamps);
    const maxTime = Math.max(...allTimestamps);
    
    this.duration = (maxTime - minTime) / 1000;
    this.startTime = minTime;
    this.endTime = maxTime;
  }

  play() {
    if (this.isPlaying) return;
    if (this.visitors.length === 0) return;

    this.isPlaying = true;
    this.lastTimestamp = performance.now();
    this.animate();
  }

  pause() {
    this.isPlaying = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  toggle() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
    return this.isPlaying;
  }

  stop() {
    this.pause();
    this.currentTime = 0;
    this.updateVisitors();
    this.activeVisitors.clear();
    this.sceneManager.clearVisitors();
  }

  seek(time) {
    this.currentTime = Math.max(0, Math.min(this.duration, time));
    this.updateVisitors();
  }

  setSpeed(speed) {
    this.speed = Math.max(0.1, Math.min(10, speed));
  }

  animate() {
    if (!this.isPlaying) return;

    this.animationFrameId = requestAnimationFrame(() => this.animate());

    const now = performance.now();
    const delta = (now - this.lastTimestamp) / 1000;
    this.lastTimestamp = now;

    this.currentTime += delta * this.speed;

    if (this.currentTime >= this.duration) {
      this.currentTime = this.duration;
      this.updateVisitors();
      this.pause();
      if (this.onComplete) {
        this.onComplete();
      }
      return;
    }

    this.updateVisitors();

    if (this.onUpdate) {
      this.onUpdate(this.currentTime, this.duration);
    }
  }

  updateVisitors() {
    if (this.visitors.length === 0) return;

    const currentTimestamp = this.startTime + this.currentTime * 1000;
    const { height } = GALLERY_DIMENSIONS;

    for (const visitor of this.visitors) {
      const visitorState = this.getVisitorStateAtTime(visitor, currentTimestamp);
      
      if (!visitorState) {
        if (this.activeVisitors.has(visitor.id)) {
          this.activeVisitors.delete(visitor.id);
        }
        continue;
      }

      if (!this.activeVisitors.has(visitor.id)) {
        const batchColor = visitor.batchColor || 0x667eea;
        this.sceneManager.addVisitorPath(visitor.id, batchColor);
        this.activeVisitors.set(visitor.id, {
          lastTrailUpdate: 0,
          trailUpdateInterval: 0.1
        });
      }

      const activeVisitor = this.activeVisitors.get(visitor.id);
      const position = new THREE.Vector3(
        visitorState.position.x,
        visitorState.position.y,
        visitorState.position.z
      );

      const shouldAddToTrail = (this.currentTime - activeVisitor.lastTrailUpdate) >= activeVisitor.trailUpdateInterval / this.speed;
      
      this.sceneManager.updateVisitorPosition(visitor.id, position, shouldAddToTrail);
      
      if (shouldAddToTrail) {
        activeVisitor.lastTrailUpdate = this.currentTime;
      }
    }
  }

  getVisitorStateAtTime(visitor, timestamp) {
    const path = visitor.path;
    if (!path || path.length < 2) return null;

    if (timestamp < path[0].timestamp) return null;
    if (timestamp > path[path.length - 1].timestamp) return null;

    for (let i = 0; i < path.length - 1; i++) {
      const curr = path[i];
      const next = path[i + 1];

      if (timestamp >= curr.timestamp && timestamp <= next.timestamp) {
        const segmentDuration = (next.timestamp - curr.timestamp) / 1000;
        const elapsed = (timestamp - curr.timestamp) / 1000;
        const t = segmentDuration > 0 ? elapsed / segmentDuration : 0;

        return {
          position: lerpPoint(curr, next, t),
          segmentIndex: i,
          progress: t
        };
      }
    }

    return null;
  }

  getCurrentTimestamp() {
    return this.startTime + this.currentTime * 1000;
  }

  getProgress() {
    return this.duration > 0 ? this.currentTime / this.duration : 0;
  }

  dispose() {
    this.pause();
    this.visitors = [];
    this.activeVisitors.clear();
  }
}
