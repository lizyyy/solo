import * as THREE from 'three';

export class DragController {
  constructor(sceneManager, mallBuilder) {
    this.sceneManager = sceneManager;
    this.mallBuilder = mallBuilder;
    this.canvas = sceneManager.canvas;
    this.scene = sceneManager.scene;
    this.camera = sceneManager.camera;
    this.controls = sceneManager.controls;

    this.selectedObject = null;
    this.dragging = false;
    this.dragPlane = new THREE.Plane();
    this.offset = new THREE.Vector3();
    this.intersection = new THREE.Vector3();
    this.barrierCounter = 0;
    this.onDragEnd = null;
    this.onBarrierRemove = null;
    this.dragStartPos = null;

    this.setupEventListeners();
  }

  setupEventListeners() {
    this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
    this.canvas.addEventListener('mouseleave', (e) => this.onMouseUp(e));
  }

  onMouseDown(event) {
    event.preventDefault();

    const barrierMeshes = this.sceneManager.barriers.map(b => b.mesh);
    const intersects = this.sceneManager.getIntersects(event, barrierMeshes);

    if (intersects.length > 0) {
      this.controls.enabled = false;
      this.dragging = true;
      this.selectedObject = intersects[0].object;
      
      while (this.selectedObject.parent && !this.selectedObject.userData.type) {
        this.selectedObject = this.selectedObject.parent;
      }

      this.dragPlane.setFromNormalAndCoplanarPoint(
        new THREE.Vector3(0, 1, 0),
        this.selectedObject.position
      );

      const raycaster = this.sceneManager.raycaster;
      if (raycaster.ray.intersectPlane(this.dragPlane, this.intersection)) {
        this.offset.copy(this.selectedObject.position).sub(this.intersection);
      }

      this.dragStartPos = {
        x: this.selectedObject.position.x,
        z: this.selectedObject.position.z
      };

      this.highlightObject(this.selectedObject, true);
      this.updateSelectedBarrierUI();
    }
  }

  onMouseMove(event) {
    event.preventDefault();

    if (this.dragging && this.selectedObject) {
      const raycaster = this.sceneManager.raycaster;
      const intersects = this.sceneManager.getIntersects(event);
      
      if (raycaster.ray.intersectPlane(this.dragPlane, this.intersection)) {
        const newPos = this.intersection.add(this.offset);
        this.selectedObject.position.x = Math.round(newPos.x);
        this.selectedObject.position.z = Math.round(newPos.z);
        
        this.updateBarrierData(this.selectedObject);
      }
    } else {
      const barrierMeshes = this.sceneManager.barriers.map(b => b.mesh);
      const intersects = this.sceneManager.getIntersects(event, barrierMeshes);
      this.canvas.style.cursor = intersects.length > 0 ? 'move' : 'default';
    }
  }

  onMouseUp(event) {
    if (this.dragging) {
      this.dragging = false;
      this.controls.enabled = true;
      
      if (this.selectedObject) {
        this.highlightObject(this.selectedObject, false);
        
        const endPos = {
          x: this.selectedObject.position.x,
          z: this.selectedObject.position.z
        };
        
        const hasMoved = this.dragStartPos && 
          (Math.abs(endPos.x - this.dragStartPos.x) > 0.1 || 
           Math.abs(endPos.z - this.dragStartPos.z) > 0.1);
        
        if (hasMoved && this.onDragEnd) {
          this.onDragEnd({
            barrierId: this.selectedObject.userData.id,
            from: { ...this.dragStartPos },
            to: { ...endPos }
          });
        }
        
        this.triggerValidation();
      }
      
      this.dragStartPos = null;
    }
  }

  highlightObject(object, highlight) {
    object.traverse((child) => {
      if (child.isMesh && child.material) {
        if (highlight) {
          child.material.emissive = new THREE.Color(0x00ff00);
          child.material.emissiveIntensity = 0.3;
        } else {
          child.material.emissive = new THREE.Color(0x000000);
          child.material.emissiveIntensity = 0;
        }
      }
    });
  }

  updateBarrierData(object) {
    const barrierObj = this.sceneManager.barriers.find(b => b.mesh === object);
    if (barrierObj) {
      barrierObj.data.x = object.position.x;
      barrierObj.data.z = object.position.z;
      object.userData.x = object.position.x;
      object.userData.z = object.position.z;
    }
  }

  updateSelectedBarrierUI() {
    const barrierItems = document.querySelectorAll('.barrier-item');
    barrierItems.forEach(item => {
      item.classList.remove('selected');
      if (this.selectedObject && item.dataset.id === this.selectedObject.userData.id) {
        item.classList.add('selected');
      }
    });
  }

  selectBarrierById(id) {
    const barrierObj = this.sceneManager.barriers.find(b => b.data.id === id);
    if (barrierObj) {
      if (this.selectedObject) {
        this.highlightObject(this.selectedObject, false);
      }
      this.selectedObject = barrierObj.mesh;
      this.highlightObject(this.selectedObject, true);
      this.updateSelectedBarrierUI();
    }
  }

  addBarrier(floorId = '1F') {
    this.barrierCounter++;
    const floorY = this.getFloorY(floorId);
    
    const barrierData = {
      id: `BAR-${String(this.barrierCounter).padStart(3, '0')}`,
      name: `围挡${this.barrierCounter}号`,
      floor: floorId,
      x: 0,
      z: 0,
      width: 6,
      depth: 0.5,
      rotation: 0,
      color: 0xff6b6b
    };

    const barrierObj = this.mallBuilder.buildBarrier(barrierData, floorY);
    this.updateBarrierListUI();
    this.triggerValidation();
    
    return barrierObj;
  }

  removeBarrier(id) {
    const index = this.sceneManager.barriers.findIndex(b => b.data.id === id);
    if (index > -1) {
      const barrierObj = this.sceneManager.barriers[index];
      const lastPosition = {
        x: barrierObj.mesh.position.x,
        z: barrierObj.mesh.position.z
      };
      
      this.scene.remove(barrierObj.mesh);
      this.sceneManager.barriers.splice(index, 1);
      
      if (this.selectedObject && this.selectedObject.userData.id === id) {
        this.selectedObject = null;
      }
      
      if (this.onBarrierRemove) {
        this.onBarrierRemove({
          barrierId: id,
          lastPosition
        });
      }
      
      this.updateBarrierListUI();
      this.triggerValidation();
    }
  }

  getFloorY(floorId) {
    const floorMap = { '1F': 0, '2F': 8, '3F': 16 };
    return floorMap[floorId] || 0;
  }

  updateBarrierListUI() {
    const listContainer = document.getElementById('barrier-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';
    
    this.sceneManager.barriers.forEach(barrier => {
      const item = document.createElement('div');
      item.className = 'barrier-item';
      item.dataset.id = barrier.data.id;
      item.innerHTML = `
        <span>${barrier.data.name}</span>
        <span class="barrier-remove" data-id="${barrier.data.id}">×</span>
      `;
      
      item.addEventListener('click', (e) => {
        if (!e.target.classList.contains('barrier-remove')) {
          this.selectBarrierById(barrier.data.id);
        }
      });

      const removeBtn = item.querySelector('.barrier-remove');
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeBarrier(barrier.data.id);
      });

      listContainer.appendChild(item);
    });
  }

  triggerValidation() {
    const event = new CustomEvent('barrierChanged', {
      detail: { barriers: this.sceneManager.barriers }
    });
    document.dispatchEvent(event);
  }

  getBarriersData() {
    return this.sceneManager.barriers.map(b => ({ ...b.data }));
  }

  clearSelection() {
    if (this.selectedObject) {
      this.highlightObject(this.selectedObject, false);
      this.selectedObject = null;
      this.updateSelectedBarrierUI();
    }
  }
}
