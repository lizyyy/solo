import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class SceneManager {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.clock = new THREE.Clock();
    this.animationCallbacks = [];
    this.objects = [];
    this.selectedObject = null;
    this.hoveredObject = null;
    
    this.init();
  }
  
  init() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1e272e);
    this.scene.fog = new THREE.Fog(0x1e272e, 30, 80);
    
    const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
    this.camera.position.set(15, 12, 15);
    
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true
    });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.screenSpacePanning = false;
    this.controls.minDistance = 3;
    this.controls.maxDistance = 60;
    this.controls.maxPolarAngle = Math.PI / 2.1;
    this.controls.target.set(0, 3, 0);
    
    this.setupLights();
    this.setupGrid();
    
    window.addEventListener('resize', () => this.onResize());
    this.onResize();
    
    this.animate();
  }
  
  setupLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    this.scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 100;
    directionalLight.shadow.camera.left = -30;
    directionalLight.shadow.camera.right = 30;
    directionalLight.shadow.camera.top = 30;
    directionalLight.shadow.camera.bottom = -30;
    this.scene.add(directionalLight);
    
    const fillLight = new THREE.DirectionalLight(0x88aaff, 0.4);
    fillLight.position.set(-10, 10, -10);
    this.scene.add(fillLight);
    
    const rimLight = new THREE.DirectionalLight(0xffaa88, 0.3);
    rimLight.position.set(0, 15, -20);
    this.scene.add(rimLight);
  }
  
  setupGrid() {
    const gridHelper = new THREE.GridHelper(60, 60, 0x444444, 0x333333);
    gridHelper.position.y = 0.01;
    this.scene.add(gridHelper);
    
    const axesHelper = new THREE.AxesHelper(3);
    axesHelper.position.y = 0.02;
    this.scene.add(axesHelper);
  }
  
  onResize() {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    
    this.renderer.setSize(width, height);
  }
  
  add(object) {
    if (object instanceof THREE.Object3D) {
      this.scene.add(object);
      this.objects.push(object);
    }
  }
  
  remove(object) {
    if (object instanceof THREE.Object3D) {
      this.scene.remove(object);
      const index = this.objects.indexOf(object);
      if (index > -1) {
        this.objects.splice(index, 1);
      }
    }
  }
  
  getIntersects(event, objects = null) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    const targetObjects = objects || this.objects;
    return this.raycaster.intersectObjects(targetObjects, true);
  }
  
  setSelectedObject(object) {
    if (this.selectedObject === object) return;
    
    if (this.selectedObject && this.selectedObject.userData.onDeselect) {
      this.selectedObject.userData.onDeselect();
    }
    
    this.selectedObject = object;
    
    if (object && object.userData.onSelect) {
      object.userData.onSelect();
    }
    
    this.emit('selectionChange', object);
  }
  
  setHoveredObject(object) {
    if (this.hoveredObject === object) return;
    
    if (this.hoveredObject && this.hoveredObject.userData.onMouseLeave) {
      this.hoveredObject.userData.onMouseLeave();
    }
    
    this.hoveredObject = object;
    
    if (object && object.userData.onMouseEnter) {
      object.userData.onMouseEnter();
    }
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
  
  animate() {
    requestAnimationFrame(() => this.animate());
    
    const delta = this.clock.getDelta();
    
    this.controls.update();
    
    for (const callback of this.animationCallbacks) {
      callback(delta);
    }
    
    this.renderer.render(this.scene, this.camera);
  }
  
  emit(eventName, data) {
    const event = new CustomEvent(`scene:${eventName}`, {
      detail: data,
      bubbles: true
    });
    this.canvas.dispatchEvent(event);
  }
  
  on(eventName, callback) {
    this.canvas.addEventListener(`scene:${eventName}`, (e) => callback(e.detail));
  }
  
  off(eventName, callback) {
    this.canvas.removeEventListener(`scene:${eventName}`, callback);
  }
}
