import * as THREE from 'three';
import TWEEN from '@tweenjs/tween.js';
import dayjs from 'dayjs';
import { CONFIG } from './config.js';

export class AnimationController {
  constructor(sceneManager) {
    this.sceneManager = sceneManager;
    this.activeAnimations = new Map();
    this.animationQueue = [];
    this.isPlaying = false;
    this.playbackSpeed = 1.0;
    this.currentTime = 0;
    this.startTime = 0;
    this.endTime = 0;
  }

  setTimeRange(start, end) {
    this.startTime = dayjs(start).valueOf();
    this.endTime = dayjs(end).valueOf();
    this.currentTime = this.startTime;
  }

  setPlaybackSpeed(speed) {
    this.playbackSpeed = speed;
  }

  play() {
    this.isPlaying = true;
  }

  pause() {
    this.isPlaying = false;
  }

  stop() {
    this.isPlaying = false;
    this.activeAnimations.clear();
    this.animationQueue = [];
    TWEEN.removeAll();
  }

  reset() {
    this.stop();
    this.currentTime = this.startTime;
  }

  seekTo(time) {
    this.currentTime = dayjs(time).valueOf();
  }

  animateCar(vehicleId, fromPosition, toPosition, duration = 1000, options = {}) {
    return new Promise((resolve, reject) => {
      const carMesh = this.sceneManager.carMeshes.get(vehicleId);
      if (!carMesh) {
        reject(new Error(`Vehicle ${vehicleId} not found`));
        return;
      }

      const startPos = {
        x: fromPosition.x || carMesh.mesh.position.x,
        y: fromPosition.y || carMesh.mesh.position.y,
        z: fromPosition.z || carMesh.mesh.position.z
      };

      const endPos = {
        x: toPosition.x,
        y: toPosition.y || 0.1,
        z: toPosition.z
      };

      const dx = endPos.x - startPos.x;
      const dz = endPos.z - startPos.z;
      const targetRotation = Math.atan2(dx, dz);

      const tween = new TWEEN.Tween(startPos)
        .to(endPos, duration / this.playbackSpeed)
        .easing(TWEEN.Easing.Quadratic.InOut)
        .onUpdate((current) => {
          const progress = tween.getProgress();
          const currentRotation = carMesh.mesh.rotation.y + 
            (targetRotation - carMesh.mesh.rotation.y) * Math.min(1, progress * 2);
          
          this.sceneManager.updateCarPosition(vehicleId, current, currentRotation);
        })
        .onComplete(() => {
          this.activeAnimations.delete(`car_${vehicleId}`);
          resolve();
        })
        .start();

      this.activeAnimations.set(`car_${vehicleId}`, tween);
    });
  }

  animateElevator(elevatorId, fromFloor, toFloor, duration = 2000) {
    return new Promise((resolve, reject) => {
      const elevatorData = this.sceneManager.elevatorMeshes.get(elevatorId);
      if (!elevatorData) {
        reject(new Error(`Elevator ${elevatorId} not found`));
        return;
      }

      const fromY = fromFloor * CONFIG.FLOOR_HEIGHT + 1.25;
      const toY = toFloor * CONFIG.FLOOR_HEIGHT + 1.25;
      
      const currentY = { y: fromY };
      const targetY = { y: toY };

      this.sceneManager.updateElevatorStatus(elevatorId, fromFloor, 'moving');

      const tween = new TWEEN.Tween(currentY)
        .to(targetY, duration / this.playbackSpeed)
        .easing(TWEEN.Easing.Quadratic.InOut)
        .onUpdate((current) => {
          elevatorData.car.position.y = current.y;
          elevatorData.indicator.position.y = current.y + 2;
        })
        .onComplete(() => {
          this.sceneManager.updateElevatorStatus(elevatorId, toFloor, 'idle');
          this.activeAnimations.delete(`elevator_${elevatorId}`);
          resolve();
        })
        .start();

      this.activeAnimations.set(`elevator_${elevatorId}`, tween);
    });
  }

  animateSlotHighlight(slotId, type = 'warning', duration = 3000) {
    const slotData = this.sceneManager.slotMeshes.get(slotId);
    if (!slotData) return;

    const originalColor = slotData.mesh.material.color.clone();
    const highlightColor = type === 'critical' ? new THREE.Color(CONFIG.COLORS.CRITICAL) :
                          type === 'error' ? new THREE.Color(CONFIG.COLORS.ERROR) :
                          new THREE.Color(CONFIG.COLORS.WARNING);

    let blinkCount = 0;
    const maxBlinks = 4;

    const blink = () => {
      if (blinkCount >= maxBlinks) {
        this.sceneManager.updateSlotStatus(slotId, slotData.data.status === 'occupied' ? 'occupied' : 'empty');
        return;
      }

      const isHighlight = blinkCount % 2 === 0;
      slotData.mesh.material.color.copy(isHighlight ? highlightColor : originalColor);
      slotData.border.material.color.copy(isHighlight ? highlightColor : originalColor);
      
      blinkCount++;
      setTimeout(blink, 300 / this.playbackSpeed);
    };

    blink();
  }

  showTrajectoryAnimation(points, color = CONFIG.COLORS.TRAJECTORY) {
    this.sceneManager.showTrajectory(points, color);

    if (points.length >= 2) {
      const firstPoint = points[0];
      const lastPoint = points[points.length - 1];
      
      const arrowGeometry = new THREE.ConeGeometry(0.3, 0.6, 8);
      const arrowMaterial = new THREE.MeshBasicMaterial({ 
        color: color,
        transparent: true,
        opacity: 0.8
      });
      
      const startMarker = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.8 })
      );
      startMarker.position.set(firstPoint.x, (firstPoint.y || 0.1) + 0.5, firstPoint.z);
      this.sceneManager.trajectoriesGroup.add(startMarker);

      const endMarker = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.4, 0.4),
        new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.8 })
      );
      endMarker.position.set(lastPoint.x, (lastPoint.y || 0.1) + 0.5, lastPoint.z);
      this.sceneManager.trajectoriesGroup.add(endMarker);
    }
  }

  createPathAnimation(points, vehicleId, durationPerSegment = 500) {
    if (points.length < 2) return Promise.resolve();

    let chain = Promise.resolve();
    
    for (let i = 0; i < points.length - 1; i++) {
      const from = points[i];
      const to = points[i + 1];
      
      const distance = Math.sqrt(
        Math.pow(to.x - from.x, 2) + 
        Math.pow((to.y || 0) - (from.y || 0), 2) + 
        Math.pow(to.z - from.z, 2)
      );
      
      const duration = Math.max(durationPerSegment, distance * 200);
      
      chain = chain.then(() => 
        this.animateCar(vehicleId, from, to, duration)
      );
    }

    return chain;
  }

  scheduleAnimation(animation, delay = 0) {
    this.animationQueue.push({
      animation,
      delay,
      scheduledAt: this.currentTime + delay
    });
  }

  processScheduledAnimations(currentTime) {
    const toProcess = this.animationQueue.filter(
      a => a.scheduledAt <= currentTime && !a.started
    );

    toProcess.forEach(item => {
      item.started = true;
      item.animation();
    });

    this.animationQueue = this.animationQueue.filter(a => !a.started);
  }

  update(deltaTime) {
    if (this.isPlaying) {
      const timeIncrement = deltaTime * 1000 * this.playbackSpeed;
      this.currentTime = Math.min(this.currentTime + timeIncrement, this.endTime);
      
      this.processScheduledAnimations(this.currentTime);
    }

    TWEEN.update();
  }

  getProgress() {
    if (this.endTime === this.startTime) return 0;
    return (this.currentTime - this.startTime) / (this.endTime - this.startTime);
  }

  formatTime(timestamp) {
    const date = dayjs(timestamp);
    return date.format('HH:mm:ss');
  }

  isAtEnd() {
    return this.currentTime >= this.endTime;
  }
}
