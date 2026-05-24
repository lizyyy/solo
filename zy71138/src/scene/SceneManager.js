import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class SceneManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.objects = [];
    this.barriers = [];
    this.escalators = [];
    this.fireDoors = [];
    this.heatmapObjects = [];
    this.directionArrows = [];
    
    this.init();
  }

  init() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a1a);
    this.scene.fog = new THREE.Fog(0x0a0a1a, 50, 150);

    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.camera = new THREE.PerspectiveCamera(60, rect.width / rect.height, 0.1, 1000);
    this.camera.position.set(40, 40, 40);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true
    });
    this.renderer.setSize(rect.width, rect.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 10;
    this.controls.maxDistance = 100;
    this.controls.maxPolarAngle = Math.PI / 2.1;

    this.setupLights();
    this.setupGrid();
    this.setupResize();
    this.animate();
  }

  setupLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
    mainLight.position.set(20, 40, 20);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 100;
    mainLight.shadow.camera.left = -50;
    mainLight.shadow.camera.right = 50;
    mainLight.shadow.camera.top = 50;
    mainLight.shadow.camera.bottom = -50;
    this.scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0x6688ff, 0.3);
    fillLight.position.set(-20, 20, -20);
    this.scene.add(fillLight);
  }

  setupGrid() {
    const gridHelper = new THREE.GridHelper(100, 50, 0x1a1a3a, 0x1a1a3a);
    gridHelper.position.y = -0.01;
    this.scene.add(gridHelper);
  }

  setupResize() {
    window.addEventListener('resize', () => {
      const rect = this.canvas.parentElement.getBoundingClientRect();
      this.camera.aspect = rect.width / rect.height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(rect.width, rect.height);
    });
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  addObject(object) {
    this.scene.add(object);
    this.objects.push(object);
  }

  removeObject(object) {
    this.scene.remove(object);
    const index = this.objects.indexOf(object);
    if (index > -1) {
      this.objects.splice(index, 1);
    }
  }

  setView(viewType) {
    const positions = {
      top: { x: 0, y: 80, z: 0.01 },
      front: { x: 0, y: 20, z: 60 },
      iso: { x: 40, y: 40, z: 40 },
      free: { x: 40, y: 40, z: 40 }
    };

    const pos = positions[viewType] || positions.iso;
    
    const startPos = this.camera.position.clone();
    const endPos = new THREE.Vector3(pos.x, pos.y, pos.z);
    const duration = 1000;
    const startTime = Date.now();

    const animateCamera = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      this.camera.position.lerpVectors(startPos, endPos, eased);
      
      if (viewType === 'top') {
        this.controls.target.set(0, 0, 0);
      }

      if (progress < 1) {
        requestAnimationFrame(animateCamera);
      }
    };

    animateCamera();
  }

  getIntersects(event, objects = this.objects) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    this.raycaster.setFromCamera(this.mouse, this.camera);
    return this.raycaster.intersectObjects(objects, true);
  }

  clearAll() {
    this.barriers.forEach(b => this.scene.remove(b.mesh));
    this.escalators.forEach(e => this.scene.remove(e.mesh));
    this.fireDoors.forEach(f => this.scene.remove(f.mesh));
    this.heatmapObjects.forEach(h => this.scene.remove(h));
    this.directionArrows.forEach(a => this.scene.remove(a));
    
    this.barriers = [];
    this.escalators = [];
    this.fireDoors = [];
    this.heatmapObjects = [];
    this.directionArrows = [];
    this.objects = [];
  }
}
