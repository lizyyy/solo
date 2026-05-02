import * as THREE from 'three';

export class InteractionController {
  constructor(sceneRenderer, canvas) {
    this.sceneRenderer = sceneRenderer;
    this.canvas = canvas;
    this.scene = sceneRenderer.scene;
    this.camera = sceneRenderer.camera;
    this.controls = sceneRenderer.controls;

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.isDragging = false;
    this.dragPlane = null;
    this.dragOffset = new THREE.Vector3();
    this.selectedObject = null;
    this.mode = 'select';

    this.onSelect = null;
    this.onDeselect = null;
    this.onMove = null;
    this.onRotate = null;

    this.init();
  }

  init() {
    this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
    this.canvas.addEventListener('wheel', (e) => this.onWheel(e));
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    this.createDragPlane();
  }

  createDragPlane() {
    const geometry = new THREE.PlaneGeometry(200, 200);
    const material = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide
    });
    this.dragPlane = new THREE.Mesh(geometry, material);
    this.dragPlane.rotation.x = -Math.PI / 2;
    this.dragPlane.visible = false;
    this.scene.add(this.dragPlane);
  }

  onMouseDown(e) {
    if (e.button !== 0) return;

    this.updateMousePosition(e);

    const intersects = this.getIntersects();
    
    if (intersects.length > 0) {
      const hitObject = this.findSelectableObject(intersects[0].object);
      
      if (hitObject) {
        this.isDragging = true;
        this.selectedObject = hitObject;
        this.sceneRenderer.selectObject(hitObject);
        
        if (this.onSelect) {
          this.onSelect(hitObject);
        }

        this.controls.enabled = false;
        this.dragPlane.visible = true;

        const planeIntersect = this.raycaster.intersectObject(this.dragPlane);
        if (planeIntersect.length > 0) {
          this.dragOffset.copy(planeIntersect[0].point).sub(this.getObjectBasePosition(hitObject));
        }
      }
    } else {
      this.deselect();
    }
  }

  onMouseMove(e) {
    this.updateMousePosition(e);

    if (this.isDragging && this.selectedObject) {
      const intersects = this.raycaster.intersectObject(this.dragPlane);
      
      if (intersects.length > 0) {
        const newPosition = intersects[0].point.clone().sub(this.dragOffset);
        
        if (this.selectedObject.userData.type === 'camera') {
          this.selectedObject.position.x = newPosition.x;
          this.selectedObject.position.z = newPosition.z;
          this.sceneRenderer.updateCameraFrustum(this.selectedObject);
          
          if (this.selectedObject.userData.data) {
            this.selectedObject.userData.data.position.x = newPosition.x;
            this.selectedObject.userData.data.position.z = newPosition.z;
          }
        } else {
          if (this.selectedObject.userData.type === 'wall') {
            const height = this.selectedObject.userData.data?.height || 3;
            this.selectedObject.position.x = newPosition.x;
            this.selectedObject.position.y = height / 2;
            this.selectedObject.position.z = newPosition.z;
          } else if (this.selectedObject.userData.type === 'pillar') {
            const height = this.selectedObject.userData.data?.height || 3;
            this.selectedObject.position.x = newPosition.x;
            this.selectedObject.position.y = height / 2;
            this.selectedObject.position.z = newPosition.z;
          } else {
            this.selectedObject.position.x = newPosition.x;
            this.selectedObject.position.z = newPosition.z;
          }
          
          if (this.selectedObject.userData.data) {
            this.selectedObject.userData.data.position.x = newPosition.x;
            this.selectedObject.userData.data.position.z = newPosition.z;
          }
        }

        if (this.onMove) {
          this.onMove(this.selectedObject, newPosition);
        }
      }
    }
  }

  onMouseUp(e) {
    if (this.isDragging) {
      this.isDragging = false;
      this.controls.enabled = true;
      this.dragPlane.visible = false;
    }
  }

  onWheel(e) {
  }

  updateMousePosition(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    
    this.raycaster.setFromCamera(this.mouse, this.camera);
  }

  getIntersects() {
    const selectableMeshes = this.sceneRenderer.meshes.filter(m => 
      m.userData && m.userData.type && m.userData.type !== 'ground'
    );
    
    const allMeshes = [];
    selectableMeshes.forEach(mesh => {
      if (mesh.isGroup) {
        mesh.traverse(child => {
          if (child.isMesh) {
            allMeshes.push(child);
          }
        });
      } else {
        allMeshes.push(mesh);
      }
    });

    return this.raycaster.intersectObjects(allMeshes, true);
  }

  findSelectableObject(mesh) {
    let current = mesh;
    while (current) {
      if (current.userData && current.userData.type && current.userData.type !== 'ground') {
        return current;
      }
      current = current.parent;
    }
    return null;
  }

  getObjectBasePosition(obj) {
    if (obj.userData.type === 'camera') {
      return new THREE.Vector3(
        obj.position.x,
        0,
        obj.position.z
      );
    }
    return new THREE.Vector3(
      obj.position.x,
      0,
      obj.position.z
    );
  }

  deselect() {
    this.selectedObject = null;
    this.sceneRenderer.selectObject(null);
    
    if (this.onDeselect) {
      this.onDeselect();
    }
  }

  rotateSelected(deltaY) {
    if (!this.selectedObject) return;

    if (this.selectedObject.userData.type === 'camera') {
      this.selectedObject.rotation.y += deltaY * 0.01;
      this.sceneRenderer.updateCameraFrustum(this.selectedObject);
      
      if (this.selectedObject.userData.data) {
        this.selectedObject.userData.data.rotation.y = this.selectedObject.rotation.y;
      }
    } else if (this.selectedObject.userData.type === 'wall' || 
               this.selectedObject.userData.type === 'parking' ||
               this.selectedObject.userData.type === 'passage') {
      this.selectedObject.rotation.y += deltaY * 0.01;
      
      if (this.selectedObject.userData.data) {
        this.selectedObject.userData.data.rotation = this.selectedObject.rotation.y;
      }
    }

    if (this.onRotate) {
      this.onRotate(this.selectedObject, this.selectedObject.rotation.y);
    }
  }

  setMode(mode) {
    this.mode = mode;
  }

  getSelectedObject() {
    return this.selectedObject;
  }
}

export default InteractionController;
