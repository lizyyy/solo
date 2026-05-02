import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class SceneManager {
  constructor(container) {
    this.container = container;
    this.width = container.clientWidth;
    this.height = container.clientHeight;
    
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.raycaster = null;
    this.mouse = null;
    
    this.objects = {
      floors: new Map(),
      edges: new Map(),
      exits: new Map(),
      persons: new Map(),
      trajectories: new Map(),
      anomalies: new Map()
    };
    
    this.clickableObjects = [];
    this.onObjectClick = null;
    
    this.animationCallbacks = [];
    this.isAnimating = false;
    
    this.init();
  }

  init() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);
    
    this.camera = new THREE.PerspectiveCamera(
      60,
      this.width / this.height,
      0.1,
      1000
    );
    this.camera.position.set(50, 60, 50);
    
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    this.container.appendChild(this.renderer.domElement);
    
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.screenSpacePanning = true;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 200;
    this.controls.maxPolarAngle = Math.PI / 2;
    
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    
    this.setupLights();
    this.setupGrid();
    this.setupEventListeners();
  }

  setupLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 100, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.camera.left = -100;
    directionalLight.shadow.camera.right = 100;
    directionalLight.shadow.camera.top = 100;
    directionalLight.shadow.camera.bottom = -100;
    this.scene.add(directionalLight);
    
    const hemisphereLight = new THREE.HemisphereLight(0x87CEEB, 0x362a36, 0.4);
    this.scene.add(hemisphereLight);
  }

  setupGrid() {
    const gridHelper = new THREE.GridHelper(200, 100, 0x444444, 0x222222);
    gridHelper.position.y = -0.1;
    this.scene.add(gridHelper);
  }

  setupEventListeners() {
    window.addEventListener('resize', () => this.onWindowResize());
    
    this.renderer.domElement.addEventListener('click', (event) => this.onMouseClick(event));
    this.renderer.domElement.addEventListener('mousemove', (event) => this.onMouseMove(event));
  }

  onWindowResize() {
    this.width = this.container.clientWidth;
    this.height = this.container.clientHeight;
    
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    
    this.renderer.setSize(this.width, this.height);
  }

  onMouseClick(event) {
    if (!this.onObjectClick) return;
    
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    const intersects = this.raycaster.intersectObjects(this.clickableObjects, true);
    
    if (intersects.length > 0) {
      const obj = intersects[0].object;
      let target = obj;
      while (target && !target.userData.clickable) {
        target = target.parent;
      }
      
      if (target && target.userData.data) {
        this.onObjectClick(target.userData.type, target.userData.data);
      }
    }
  }

  onMouseMove(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  addObject(obj, category = null) {
    this.scene.add(obj);
    if (category && this.objects[category]) {
      this.objects[category].set(obj.uuid, obj);
    }
    if (obj.userData.clickable) {
      this.clickableObjects.push(obj);
    }
  }

  removeObject(obj) {
    this.scene.remove(obj);
    
    for (const category of Object.keys(this.objects)) {
      this.objects[category].delete(obj.uuid);
    }
    
    const index = this.clickableObjects.indexOf(obj);
    if (index > -1) {
      this.clickableObjects.splice(index, 1);
    }
    
    if (obj.dispose) {
      obj.dispose();
    }
  }

  clearCategory(category) {
    if (!this.objects[category]) return;
    
    for (const obj of this.objects[category].values()) {
      this.scene.remove(obj);
      
      const index = this.clickableObjects.indexOf(obj);
      if (index > -1) {
        this.clickableObjects.splice(index, 1);
      }
      
      if (obj.traverse) {
        obj.traverse((child) => {
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
    
    this.objects[category].clear();
  }

  clearAll() {
    for (const category of Object.keys(this.objects)) {
      this.clearCategory(category);
    }
    this.clickableObjects = [];
  }

  getObjectsByCategory(category) {
    return Array.from(this.objects[category]?.values() || []);
  }

  setClickCallback(callback) {
    this.onObjectClick = callback;
  }

  addAnimationCallback(callback) {
    this.animationCallbacks.push(callback);
  }

  removeAnimationCallback(callback) {
    const index = this.animationCallbacks.indexOf(callback);
    if (index > -1) {
      this.animationCallbacks.splice(index, 1);
    }
  }

  render() {
    this.controls.update();
    
    for (const callback of this.animationCallbacks) {
      callback();
    }
    
    this.renderer.render(this.scene, this.camera);
  }

  startAnimationLoop() {
    if (this.isAnimating) return;
    this.isAnimating = true;
    this.animate();
  }

  stopAnimationLoop() {
    this.isAnimating = false;
  }

  animate() {
    if (!this.isAnimating) return;
    
    requestAnimationFrame(() => this.animate());
    this.render();
  }

  setCameraView(angle) {
    switch (angle) {
      case 'top':
        this.camera.position.set(0, 80, 0.1);
        this.controls.target.set(0, 0, 0);
        break;
      case 'front':
        this.camera.position.set(0, 40, 60);
        this.controls.target.set(0, 10, 0);
        break;
      case 'side':
        this.camera.position.set(60, 40, 0);
        this.controls.target.set(0, 10, 0);
        break;
      case 'iso':
      default:
        this.camera.position.set(50, 60, 50);
        this.controls.target.set(0, 10, 0);
        break;
    }
    this.controls.update();
  }

  lookAt(x, y, z) {
    this.controls.target.set(x, y, z);
    this.controls.update();
  }

  zoomToFit(boundingBox) {
    if (!boundingBox) return;
    
    const center = new THREE.Vector3();
    boundingBox.getCenter(center);
    
    const size = new THREE.Vector3();
    boundingBox.getSize(size);
    
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = this.camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
    cameraZ *= 1.5;
    
    this.camera.position.set(center.x, center.y + cameraZ * 0.5, center.z + cameraZ);
    this.controls.target.set(center.x, center.y, center.z);
    this.controls.update();
  }

  destroy() {
    this.stopAnimationLoop();
    this.clearAll();
    
    if (this.renderer) {
      this.renderer.dispose();
      this.container.removeChild(this.renderer.domElement);
    }
    
    window.removeEventListener('resize', () => this.onWindowResize());
  }
}

export default SceneManager;
