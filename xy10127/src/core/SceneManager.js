import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

class SceneManager {
  constructor(options = {}) {
    this.container = options.container;
    this.stageSize = options.stageSize || { width: 16, height: 8, depth: 10 };
    
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    
    this.elements = [];
    this.selectedElement = null;
    this.draggedElement = null;
    
    this.isDragging = false;
    this.dragPlane = null;
    this.dragOffset = new THREE.Vector3();
    
    this.showCollision = true;
    this.showBoundary = true;
    
    this.onElementSelect = null;
    this.onElementsChange = null;
  }

  init() {
    this.createScene();
    this.createCamera();
    this.createRenderer();
    this.createControls();
    this.createStage();
    this.createLights();
    this.bindEvents();
    this.animate();
  }

  createScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a1a);
  }

  createCamera() {
    const aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
    this.camera.position.set(15, 15, 15);
    this.camera.lookAt(0, 0, 0);
  }

  createRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.container.appendChild(this.renderer.domElement);
  }

  createControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI * 0.9;
  }

  createStage() {
    const { width, height, depth } = this.stageSize;
    
    const floorGeometry = new THREE.PlaneGeometry(width, depth);
    const floorMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x1a1a2e,
      roughness: 0.8
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);
    
    const gridHelper = new THREE.GridHelper(Math.max(width, depth), 20, 0x333366, 0x222244);
    this.scene.add(gridHelper);
    
    const stageBoxGeometry = new THREE.BoxGeometry(width, height, depth);
    const edges = new THREE.EdgesGeometry(stageBoxGeometry);
    const line = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x444488, opacity: 0.5, transparent: true })
    );
    line.position.y = height / 2;
    this.scene.add(line);
  }

  createLights() {
    const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    this.scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    this.scene.add(directionalLight);
    
    const directionalLight2 = new THREE.DirectionalLight(0x8080ff, 0.3);
    directionalLight2.position.set(-10, 10, -10);
    this.scene.add(directionalLight2);
  }

  bindEvents() {
    window.addEventListener('resize', () => this.onWindowResize());
    
    this.renderer.domElement.addEventListener('mousedown', (e) => this.onMouseDown(e));
    this.renderer.domElement.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.renderer.domElement.addEventListener('mouseup', (e) => this.onMouseUp(e));
    this.renderer.domElement.addEventListener('click', (e) => this.onClick(e));
  }

  onWindowResize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  updateMouse(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  getIntersectingElements(e) {
    this.updateMouse(e);
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    const meshes = this.elements.map(el => el.mesh).filter(m => m);
    return this.raycaster.intersectObjects(meshes);
  }

  onMouseDown(e) {
    if (e.button !== 0) return;
    
    const intersects = this.getIntersectingElements(e);
    if (intersects.length > 0) {
      const mesh = intersects[0].object;
      const element = this.elements.find(el => el.mesh === mesh);
      
      if (element) {
        this.isDragging = true;
        this.draggedElement = element;
        this.controls.enabled = false;
        
        this.selectElement(element);
        
        const plane = new THREE.Plane();
        const normal = new THREE.Vector3(0, 1, 0);
        normal.applyQuaternion(this.camera.quaternion);
        plane.setFromNormalAndCoplanarPoint(normal, element.mesh.position);
        this.dragPlane = plane;
        
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const target = new THREE.Vector3();
        this.raycaster.ray.intersectPlane(plane, target);
        this.dragOffset.copy(element.mesh.position).sub(target);
      }
    }
  }

  onMouseMove(e) {
    if (!this.isDragging || !this.draggedElement || !this.dragPlane) return;
    
    this.updateMouse(e);
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    const target = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(this.dragPlane, target);
    
    const newPosition = target.add(this.dragOffset);
    this.draggedElement.mesh.position.copy(newPosition);
    
    if (this.onElementsChange) {
      this.onElementsChange();
    }
  }

  onMouseUp(e) {
    if (this.isDragging) {
      this.isDragging = false;
      this.draggedElement = null;
      this.dragPlane = null;
      this.controls.enabled = true;
      
      if (this.onElementsChange) {
        this.onElementsChange();
      }
    }
  }

  onClick(e) {
    if (this.isDragging) return;
    
    const intersects = this.getIntersectingElements(e);
    
    if (intersects.length > 0) {
      const mesh = intersects[0].object;
      const element = this.elements.find(el => el.mesh === mesh);
      if (element) {
        this.selectElement(element);
      }
    } else {
      this.deselectElement();
    }
  }

  selectElement(element) {
    this.deselectElement();
    this.selectedElement = element;
    
    if (element.mesh.material) {
      element.originalMaterial = element.mesh.material.clone();
      
      const selectedMaterial = element.mesh.material.clone();
      selectedMaterial.emissive = new THREE.Color(0x333366);
      selectedMaterial.emissiveIntensity = 0.5;
      element.mesh.material = selectedMaterial;
    }
    
    if (this.onElementSelect) {
      this.onElementSelect(element);
    }
  }

  deselectElement() {
    if (this.selectedElement && this.selectedElement.originalMaterial) {
      this.selectedElement.mesh.material = this.selectedElement.originalMaterial;
    }
    this.selectedElement = null;
    
    if (this.onElementSelect) {
      this.onElementSelect(null);
    }
  }

  addElements(elements) {
    elements.forEach(element => {
      this.elements.push(element);
      if (element.mesh) {
        this.scene.add(element.mesh);
      }
    });
  }

  clearElements() {
    this.elements.forEach(element => {
      if (element.mesh) {
        this.scene.remove(element.mesh);
      }
    });
    this.elements = [];
    this.selectedElement = null;
  }

  getElementData() {
    return this.elements.map(element => element.getData());
  }

  setElementHighlight(elementId, highlightType) {
    const element = this.elements.find(el => el.id === elementId);
    if (!element || !element.mesh) return;
    
    if (highlightType === 'collision') {
      if (!element.collisionMaterial) {
        element.collisionMaterial = new THREE.MeshStandardMaterial({
          color: 0xff0000,
          emissive: 0x330000,
          emissiveIntensity: 0.3,
          transparent: true,
          opacity: 0.8
        });
      }
      if (element === this.selectedElement) {
        element.collisionMaterial.emissive = new THREE.Color(0x663333);
      }
      element.mesh.material = element.collisionMaterial;
    } else if (highlightType === 'boundary') {
      if (!element.boundaryMaterial) {
        element.boundaryMaterial = new THREE.MeshStandardMaterial({
          color: 0xffc107,
          emissive: 0x332a00,
          emissiveIntensity: 0.3,
          transparent: true,
          opacity: 0.8
        });
      }
      element.mesh.material = element.boundaryMaterial;
    } else {
      if (element === this.selectedElement && element.originalMaterial) {
        const selectedMaterial = element.originalMaterial.clone();
        selectedMaterial.emissive = new THREE.Color(0x333366);
        selectedMaterial.emissiveIntensity = 0.5;
        element.mesh.material = selectedMaterial;
      } else if (element.originalMaterial) {
        element.mesh.material = element.originalMaterial;
      }
    }
  }

  resetHighlights() {
    this.elements.forEach(element => {
      if (element === this.selectedElement && element.originalMaterial) {
        const selectedMaterial = element.originalMaterial.clone();
        selectedMaterial.emissive = new THREE.Color(0x333366);
        selectedMaterial.emissiveIntensity = 0.5;
        element.mesh.material = selectedMaterial;
      } else if (element.originalMaterial) {
        element.mesh.material = element.originalMaterial;
      }
    });
  }

  setView(view) {
    const { width, height, depth } = this.stageSize;
    const distance = Math.max(width, height, depth) * 1.5;
    
    let targetPosition;
    
    switch (view) {
      case 'top':
        targetPosition = new THREE.Vector3(0, distance, 0);
        break;
      case 'front':
        targetPosition = new THREE.Vector3(0, height * 0.3, -distance);
        break;
      case 'side':
        targetPosition = new THREE.Vector3(distance, height * 0.3, 0);
        break;
      case 'perspective':
      default:
        targetPosition = new THREE.Vector3(distance * 0.7, distance * 0.5, distance * 0.7);
    }
    
    const animateCamera = () => {
      const t = 0.05;
      this.camera.position.lerp(targetPosition, t);
      this.camera.lookAt(0, 0, 0);
      
      const diff = this.camera.position.distanceTo(targetPosition);
      if (diff > 0.1) {
        requestAnimationFrame(animateCamera);
      } else {
        this.controls.target.set(0, 0, 0);
        this.controls.update();
      }
    };
    
    animateCamera();
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  update() {
  }
}

export default SceneManager;
