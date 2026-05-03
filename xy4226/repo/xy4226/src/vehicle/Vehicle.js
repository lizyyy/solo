import * as THREE from 'three';

class Vehicle {
  constructor(startPosition, startRotation = 0) {
    this.mesh = null;
    this.wheels = [];
    this.forks = null;
    this.mast = null;
    
    this.position = new THREE.Vector3(startPosition.x, startPosition.y, startPosition.z);
    this.rotation = startRotation;
    
    this.velocity = 0;
    this.angularVelocity = 0;
    this.maxSpeed = 5;
    this.turningRadius = 3;
    
    this.currentSpeed = 0;
    this.isReversing = false;
    this.forkHeight = 0;
    this.maxForkHeight = 4;
    
    this.carriedPallet = null;
    this.path = [];
    this.currentPathIndex = 0;
    
    this.createModel();
  }

  createModel() {
    this.mesh = new THREE.Group();
    
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0xFF4500,
      roughness: 0.4,
      metalness: 0.6
    });
    
    const bodyGeometry = new THREE.BoxGeometry(2.5, 1.5, 4);
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.set(0, 0.75, 0);
    body.castShadow = true;
    body.receiveShadow = true;
    this.mesh.add(body);
    
    const cabinGeometry = new THREE.BoxGeometry(1.8, 1.8, 1.5);
    const cabinMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      transparent: true,
      opacity: 0.7,
      roughness: 0.2,
      metalness: 0.8
    });
    const cabin = new THREE.Mesh(cabinGeometry, cabinMaterial);
    cabin.position.set(0, 1.65, -0.75);
    cabin.castShadow = true;
    this.mesh.add(cabin);
    
    const wheelGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.4, 16);
    const wheelMaterial = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.9,
      metalness: 0.1
    });
    
    const wheelPositions = [
      { x: -1.2, z: 1.5 },
      { x: 1.2, z: 1.5 },
      { x: -1.2, z: -1.5 },
      { x: 1.2, z: -1.5 }
    ];
    
    wheelPositions.forEach(pos => {
      const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(pos.x, 0.5, pos.z);
      wheel.castShadow = true;
      wheel.receiveShadow = true;
      this.mesh.add(wheel);
      this.wheels.push(wheel);
    });
    
    const mastGeometry = new THREE.BoxGeometry(0.3, 3, 0.3);
    const mastMaterial = new THREE.MeshStandardMaterial({
      color: 0x808080,
      roughness: 0.3,
      metalness: 0.7
    });
    
    this.mast = new THREE.Group();
    const leftMast = new THREE.Mesh(mastGeometry, mastMaterial);
    leftMast.position.set(-0.6, 1.5, 1.9);
    leftMast.castShadow = true;
    this.mast.add(leftMast);
    
    const rightMast = new THREE.Mesh(mastGeometry, mastMaterial);
    rightMast.position.set(0.6, 1.5, 1.9);
    rightMast.castShadow = true;
    this.mast.add(rightMast);
    
    this.mesh.add(this.mast);
    
    const forkGeometry = new THREE.BoxGeometry(1.0, 0.15, 1.5);
    const forkMaterial = new THREE.MeshStandardMaterial({
      color: 0x404040,
      roughness: 0.4,
      metalness: 0.6
    });
    
    this.forks = new THREE.Group();
    const leftFork = new THREE.Mesh(forkGeometry, forkMaterial);
    leftFork.position.set(-0.5, 0.15, 2.5);
    leftFork.castShadow = true;
    this.forks.add(leftFork);
    
    const rightFork = new THREE.Mesh(forkGeometry, forkMaterial);
    rightFork.position.set(0.5, 0.15, 2.5);
    rightFork.castShadow = true;
    this.forks.add(rightFork);
    
    this.mesh.add(this.forks);
    
    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.rotation;
  }

  setPath(path) {
    this.path = path;
    this.currentPathIndex = 0;
  }

  moveTo(targetPosition, speed = 3) {
    this.velocity = speed;
    this.currentSpeed = speed;
  }

  rotateTo(targetRotation, speed = 1) {
    this.angularVelocity = speed;
  }

  liftForks(height, speed = 1) {
    const targetHeight = Math.min(height, this.maxForkHeight);
    const delta = targetHeight - this.forkHeight;
    this.forkHeight += Math.sign(delta) * Math.min(Math.abs(delta), speed * 0.1);
    
    this.forks.position.y = this.forkHeight;
    
    if (this.carriedPallet) {
      this.carriedPallet.position.y = this.forkHeight + 0.15;
    }
  }

  lowerForks(speed = 1) {
    this.liftForks(0, speed);
  }

  pickupPallet(pallet) {
    if (this.carriedPallet) {
      return false;
    }
    
    this.carriedPallet = pallet;
    return true;
  }

  dropPallet() {
    const pallet = this.carriedPallet;
    this.carriedPallet = null;
    return pallet;
  }

  update(deltaTime) {
    if (this.path.length > 0 && this.currentPathIndex < this.path.length) {
      const target = this.path[this.currentPathIndex];
      const targetPos = new THREE.Vector3(target.x, target.y || 0, target.z);
      
      const distance = this.position.distanceTo(targetPos);
      
      if (distance < 0.5) {
        this.currentPathIndex++;
        if (target.action === 'lift') {
          this.liftForks(target.height || 2);
        } else if (target.action === 'lower') {
          this.lowerForks();
        }
      } else {
        const direction = targetPos.clone().sub(this.position).normalize();
        const moveSpeed = this.maxSpeed * 0.5;
        const moveDelta = direction.multiplyScalar(moveSpeed * deltaTime);
        
        this.position.add(moveDelta);
        this.currentSpeed = moveSpeed;
        
        const targetAngle = Math.atan2(direction.x, direction.z);
        let angleDiff = targetAngle - this.rotation;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        
        this.rotation += angleDiff * 5 * deltaTime;
      }
    }
    
    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.rotation;
    
    if (this.currentSpeed > 0.1) {
      this.wheels.forEach(wheel => {
        wheel.rotation.x += (this.currentSpeed * deltaTime) / 0.5;
      });
    }
    
    this.isReversing = this.velocity < 0;
  }

  isMoving() {
    return Math.abs(this.currentSpeed) > 0.1 || Math.abs(this.angularVelocity) > 0.01;
  }

  getState() {
    return {
      position: {
        x: this.position.x,
        y: this.position.y,
        z: this.position.z
      },
      rotation: this.rotation,
      velocity: this.velocity,
      angularVelocity: this.angularVelocity,
      currentSpeed: this.currentSpeed,
      isReversing: this.isReversing,
      forkHeight: this.forkHeight,
      carriedPallet: this.carriedPallet ? this.carriedPallet.id : null,
      path: [...this.path],
      currentPathIndex: this.currentPathIndex
    };
  }

  restoreState(state) {
    this.position.set(state.position.x, state.position.y, state.position.z);
    this.rotation = state.rotation;
    this.velocity = state.velocity;
    this.angularVelocity = state.angularVelocity;
    this.currentSpeed = state.currentSpeed;
    this.isReversing = state.isReversing;
    this.forkHeight = state.forkHeight;
    this.path = [...state.path];
    this.currentPathIndex = state.currentPathIndex;
    
    if (this.mesh) {
      this.mesh.position.copy(this.position);
      this.mesh.rotation.y = this.rotation;
    }
    
    if (this.forks) {
      this.forks.position.y = this.forkHeight;
    }
  }

  getBoundingBox() {
    const box = new THREE.Box3();
    box.setFromCenterAndSize(
      this.position.clone().add(new THREE.Vector3(0, 1, 0)),
      new THREE.Vector3(2.5, 2, 4)
    );
    return box;
  }

  getCollisionRadius() {
    return 3;
  }

  getForwardDirection() {
    const direction = new THREE.Vector3(0, 0, 1);
    direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.rotation);
    return direction;
  }

  dispose() {
    if (this.mesh) {
      this.mesh.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    }
  }
}

export default Vehicle;
