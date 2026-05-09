import * as THREE from 'three';

export class DragController {
  constructor(scene, camera, renderer, instruments, onDragStart, onDrag, onDragEnd) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.instruments = instruments;
    this.onDragStart = onDragStart;
    this.onDrag = onDrag;
    this.onDragEnd = onDragEnd;

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.dragging = false;
    this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.91);
    this.selectedInstrument = null;
    this.dragOffset = new THREE.Vector3();
    this.intersectionPoint = new THREE.Vector3();
    this.isDragging = false;

    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.animate = this.animate.bind(this);

    this.renderer.domElement.addEventListener('mousedown', this.handleMouseDown);
    this.renderer.domElement.addEventListener('mousemove', this.handleMouseMove);
    this.renderer.domElement.addEventListener('mouseup', this.handleMouseUp);
  }

  setInstruments(instruments) {
    this.instruments = instruments;
  }

  updateMousePosition(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  getIntersectedInstruments() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const instrumentMeshes = [];
    
    Object.values(this.instruments).forEach(instrument => {
      instrument.traverse(child => {
        if (child.isMesh) {
          instrumentMeshes.push(child);
        }
      });
    });

    const intersects = this.raycaster.intersectObjects(instrumentMeshes, false);
    
    if (intersects.length > 0) {
      let instrument = intersects[0].object;
      while (instrument.parent && !instrument.userData.isInstrument) {
        instrument = instrument.parent;
      }
      return { instrument, point: intersects[0].point };
    }
    
    return null;
  }

  handleMouseDown(event) {
    if (event.button !== 0) return;
    
    this.updateMousePosition(event);
    const result = this.getIntersectedInstruments();
    
    if (result && result.instrument.userData.isInstrument) {
      this.isDragging = true;
      this.selectedInstrument = result.instrument;
      
      const worldIntersection = result.point.clone();
      this.dragOffset.copy(this.selectedInstrument.position).sub(worldIntersection);
      
      if (this.onDragStart) {
        this.onDragStart(this.selectedInstrument);
      }
    }
  }

  handleMouseMove(event) {
    if (!this.isDragging || !this.selectedInstrument) return;
    
    this.updateMousePosition(event);
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    const intersectsPlane = this.raycaster.ray.intersectPlane(
      this.dragPlane,
      this.intersectionPoint
    );
    
    if (intersectsPlane) {
      const newPosition = this.intersectionPoint.add(this.dragOffset);
      
      newPosition.x = Math.max(-4, Math.min(4, newPosition.x));
      newPosition.z = Math.max(-5, Math.min(5, newPosition.z));
      
      this.selectedInstrument.position.copy(newPosition);
      
      if (this.onDrag) {
        this.onDrag(this.selectedInstrument);
      }
    }
  }

  handleMouseUp() {
    if (this.isDragging && this.selectedInstrument) {
      if (this.onDragEnd) {
        this.onDragEnd(this.selectedInstrument);
      }
    }
    
    this.isDragging = false;
    this.selectedInstrument = null;
  }

  animate() {
    requestAnimationFrame(this.animate);
  }

  dispose() {
    this.renderer.domElement.removeEventListener('mousedown', this.handleMouseDown);
    this.renderer.domElement.removeEventListener('mousemove', this.handleMouseMove);
    this.renderer.domElement.removeEventListener('mouseup', this.handleMouseUp);
  }
}

export class RotationController {
  constructor(renderer, instruments, onRotate) {
    this.renderer = renderer;
    this.instruments = instruments;
    this.onRotate = onRotate;
    this.isRotating = false;
    this.rotationSensitivity = 0.01;
    this.lastMouseX = 0;

    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);

    window.addEventListener('keydown', this.handleKeyDown);
    this.renderer.domElement.addEventListener('mousedown', this.handleMouseDown);
    this.renderer.domElement.addEventListener('mousemove', this.handleMouseMove);
    this.renderer.domElement.addEventListener('mouseup', this.handleMouseUp);
  }

  setInstruments(instruments) {
    this.instruments = instruments;
  }

  handleKeyDown(event) {
    if (!this.selectedInstrument) return;

    const rotateAmount = Math.PI / 24;
    
    if (event.key === 'r' || event.key === 'R') {
      this.selectedInstrument.rotation.y += rotateAmount;
      if (this.onRotate) {
        this.onRotate(this.selectedInstrument);
      }
    } else if (event.key === 'e' || event.key === 'E') {
      this.selectedInstrument.rotation.y -= rotateAmount;
      if (this.onRotate) {
        this.onRotate(this.selectedInstrument);
      }
    }
  }

  handleMouseDown(event) {
    if (event.button !== 2) return;
    event.preventDefault();
    
    this.isRotating = true;
    this.lastMouseX = event.clientX;
  }

  handleMouseMove(event) {
    if (!this.isRotating || !this.selectedInstrument) return;
    
    const deltaX = event.clientX - this.lastMouseX;
    this.selectedInstrument.rotation.y += deltaX * this.rotationSensitivity;
    this.lastMouseX = event.clientX;
    
    if (this.onRotate) {
      this.onRotate(this.selectedInstrument);
    }
  }

  handleMouseUp() {
    this.isRotating = false;
  }

  setSelectedInstrument(instrument) {
    this.selectedInstrument = instrument;
  }

  dispose() {
    window.removeEventListener('keydown', this.handleKeyDown);
    this.renderer.domElement.removeEventListener('mousedown', this.handleMouseDown);
    this.renderer.domElement.removeEventListener('mousemove', this.handleMouseMove);
    this.renderer.domElement.removeEventListener('mouseup', this.handleMouseUp);
  }
}
