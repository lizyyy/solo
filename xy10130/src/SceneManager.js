import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DEFAULT_CONFIG, COLORS } from './config.js';

export class SceneManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.container = canvas.parentElement;
    
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(COLORS.background);
    
    this.camera = new THREE.PerspectiveCamera(
      60,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      1000
    );
    
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true
    });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 100;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.05;
    
    this.roomMeshes = {
      floor: null,
      walls: [],
      grid: null
    };
    
    this.roomConfig = { ...DEFAULT_CONFIG.room };
    
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    
    this.animationPlaying = false;
    this.animationSpeed = 0.5;
    this.animationTime = 0;
    
    this.init();
  }
  
  init() {
    this.setupLights();
    this.createRoom();
    this.resetCamera();
    
    window.addEventListener('resize', () => this.onResize());
  }
  
  setupLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(20, 30, 20);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 100;
    directionalLight.shadow.camera.left = -50;
    directionalLight.shadow.camera.right = 50;
    directionalLight.shadow.camera.top = 50;
    directionalLight.shadow.camera.bottom = -50;
    this.scene.add(directionalLight);
    
    const hemispherLight = new THREE.HemisphereLight(0x87ceeb, 0x222233, 0.3);
    this.scene.add(hemispherLight);
  }
  
  createRoom() {
    this.removeRoom();
    
    const { width, depth, height } = this.roomConfig;
    
    const floorGeometry = new THREE.PlaneGeometry(width, depth);
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: COLORS.floor,
      roughness: 0.8,
      metalness: 0.1
    });
    this.roomMeshes.floor = new THREE.Mesh(floorGeometry, floorMaterial);
    this.roomMeshes.floor.rotation.x = -Math.PI / 2;
    this.roomMeshes.floor.position.set(width / 2, 0, depth / 2);
    this.roomMeshes.floor.receiveShadow = true;
    this.roomMeshes.floor.userData = { type: 'floor' };
    this.scene.add(this.roomMeshes.floor);
    
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: COLORS.wall,
      roughness: 0.7,
      metalness: 0.1,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8
    });
    
    const positions = [
      { x: width / 2, y: height / 2, z: 0, rotY: 0 },
      { x: width / 2, y: height / 2, z: depth, rotY: 0 },
      { x: 0, y: height / 2, z: depth / 2, rotY: Math.PI / 2 },
      { x: width, y: height / 2, z: depth / 2, rotY: Math.PI / 2 }
    ];
    
    for (const pos of positions) {
      const isXWall = pos.rotY !== 0;
      const wallGeometry = new THREE.PlaneGeometry(
        isXWall ? depth : width,
        height
      );
      const wall = new THREE.Mesh(wallGeometry, wallMaterial);
      wall.position.set(pos.x, pos.y, pos.z);
      wall.rotation.y = pos.rotY;
      wall.receiveShadow = true;
      this.roomMeshes.walls.push(wall);
      this.scene.add(wall);
    }
    
    const gridSize = Math.max(width, depth);
    const gridDivisions = Math.max(width, depth);
    this.roomMeshes.grid = new THREE.GridHelper(gridSize, gridDivisions, COLORS.grid, COLORS.grid);
    this.roomMeshes.grid.position.set(width / 2, 0.001, depth / 2);
    this.roomMeshes.grid.material.opacity = 0.3;
    this.roomMeshes.grid.material.transparent = true;
    this.scene.add(this.roomMeshes.grid);
  }
  
  removeRoom() {
    if (this.roomMeshes.floor) {
      this.scene.remove(this.roomMeshes.floor);
    }
    
    for (const wall of this.roomMeshes.walls) {
      this.scene.remove(wall);
    }
    this.roomMeshes.walls = [];
    
    if (this.roomMeshes.grid) {
      this.scene.remove(this.roomMeshes.grid);
    }
  }
  
  setRoomConfig(config) {
    this.roomConfig = { ...this.roomConfig, ...config };
    this.createRoom();
  }
  
  resetCamera() {
    const { width, depth, height } = this.roomConfig;
    const maxDim = Math.max(width, depth);
    
    this.camera.position.set(
      width + maxDim * 0.5,
      maxDim * 0.8,
      depth + maxDim * 0.5
    );
    
    this.controls.target.set(width / 2, height / 2, depth / 2);
    this.controls.update();
  }
  
  setGridVisible(visible) {
    if (this.roomMeshes.grid) {
      this.roomMeshes.grid.visible = visible;
    }
  }
  
  setWallsVisible(visible) {
    for (const wall of this.roomMeshes.walls) {
      wall.visible = visible;
    }
  }
  
  playAnimation() {
    this.animationPlaying = true;
  }
  
  pauseAnimation() {
    this.animationPlaying = false;
  }
  
  onResize() {
    this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
  }
  
  getIntersects(event, objects) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    this.raycaster.setFromCamera(this.mouse, this.camera);
    return this.raycaster.intersectObjects(objects, true);
  }
  
  getFloorPosition(event) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const point = new THREE.Vector3();
    
    if (this.raycaster.ray.intersectPlane(plane, point)) {
      return {
        x: Math.max(0, Math.min(this.roomConfig.width, point.x)),
        z: Math.max(0, Math.min(this.roomConfig.depth, point.z))
      };
    }
    
    return null;
  }
  
  update(deltaTime) {
    if (this.animationPlaying) {
      this.animationTime += deltaTime * this.animationSpeed;
      
      const radius = Math.max(this.roomConfig.width, this.roomConfig.depth) * 0.8;
      const angle = this.animationTime * 0.5;
      
      this.camera.position.x = this.roomConfig.width / 2 + Math.cos(angle) * radius;
      this.camera.position.z = this.roomConfig.depth / 2 + Math.sin(angle) * radius;
      
      this.controls.target.set(
        this.roomConfig.width / 2,
        this.roomConfig.height / 2,
        this.roomConfig.depth / 2
      );
    }
    
    this.controls.update();
  }
  
  render() {
    this.renderer.render(this.scene, this.camera);
  }
  
  dispose() {
    window.removeEventListener('resize', () => this.onResize());
    this.renderer.dispose();
    this.controls.dispose();
  }
}
