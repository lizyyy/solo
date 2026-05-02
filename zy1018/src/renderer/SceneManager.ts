import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Plan, BoothObject, FloorSettings, Vector3D, ColorRGB } from '../models/types';
import { degToRad } from '../utils/geometry';

const OBJECT_TYPE_NAMES: Record<string, string> = {
  table: '桌子',
  display_rack: '展架',
  cashier_desk: '收银台',
  power_outlet: '电源插座',
  power_cable: '电源线',
  entrance: '入口',
  exit: '出口',
  safety_aisle: '安全通道',
  feature_wall: '主视觉墙',
};

export class SceneManager {
  public container: HTMLElement;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public controls: OrbitControls;
  
  private objectMeshes: Map<string, THREE.Object3D> = new Map();
  private floorMesh: THREE.Mesh | null = null;
  private gridHelper: THREE.GridHelper | null = null;
  private axesHelper: THREE.AxesHelper | null = null;
  
  private currentPlan: Plan | null = null;
  
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  
  constructor(container: HTMLElement) {
    this.container = container;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf0f4f8);
    
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    this.camera.position.set(8, 8, 8);
    this.camera.lookAt(0, 0, 0);
    
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    
    container.appendChild(this.renderer.domElement);
    
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.screenSpacePanning = false;
    this.controls.minDistance = 3;
    this.controls.maxDistance = 50;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.1;
    
    this.setupLights();
    this.setupEventListeners();
    this.animate();
  }
  
  private setupLights(): void {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);
    
    const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
    mainLight.position.set(10, 15, 10);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 50;
    mainLight.shadow.camera.left = -15;
    mainLight.shadow.camera.right = 15;
    mainLight.shadow.camera.top = 15;
    mainLight.shadow.camera.bottom = -15;
    this.scene.add(mainLight);
    
    const fillLight = new THREE.DirectionalLight(0x8888ff, 0.3);
    fillLight.position.set(-10, 8, -5);
    this.scene.add(fillLight);
    
    const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.4);
    this.scene.add(hemisphereLight);
  }
  
  private setupEventListeners(): void {
    window.addEventListener('resize', () => this.onWindowResize());
  }
  
  private onWindowResize(): void {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }
  
  private animate(): void {
    requestAnimationFrame(() => this.animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
  
  public loadPlan(plan: Plan): void {
    this.clearScene();
    this.currentPlan = plan;
    
    this.createFloor(plan.floor);
    this.createGrid(plan.floor);
    
    for (const obj of plan.objects) {
      this.createObjectMesh(obj);
    }
    
    this.adjustCameraToPlan(plan);
  }
  
  private adjustCameraToPlan(plan: Plan): void {
    const maxDim = Math.max(plan.floor.width, plan.floor.depth);
    const targetDistance = maxDim * 1.8;
    
    this.camera.position.set(targetDistance, targetDistance, targetDistance);
    this.camera.lookAt(0, 0, 0);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }
  
  private clearScene(): void {
    for (const mesh of this.objectMeshes.values()) {
      this.scene.remove(mesh);
      this.disposeObject(mesh);
    }
    this.objectMeshes.clear();
    
    if (this.floorMesh) {
      this.scene.remove(this.floorMesh);
      this.disposeObject(this.floorMesh);
      this.floorMesh = null;
    }
    
    if (this.gridHelper) {
      this.scene.remove(this.gridHelper);
      this.gridHelper.dispose();
      this.gridHelper = null;
    }
    
    if (this.axesHelper) {
      this.scene.remove(this.axesHelper);
      this.axesHelper.dispose();
      this.axesHelper = null;
    }
  }
  
  private disposeObject(obj: THREE.Object3D): void {
    if (obj instanceof THREE.Mesh) {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    }
    obj.traverse(child => {
      if (child instanceof THREE.Mesh) {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      }
    });
  }
  
  private createFloor(settings: FloorSettings): void {
    const geometry = new THREE.PlaneGeometry(settings.width, settings.depth);
    const material = new THREE.MeshStandardMaterial({
      color: 0xe8e8e8,
      roughness: 0.8,
      metalness: 0.1,
    });
    
    this.floorMesh = new THREE.Mesh(geometry, material);
    this.floorMesh.rotation.x = -Math.PI / 2;
    this.floorMesh.receiveShadow = true;
    this.scene.add(this.floorMesh);
    
    const edgeGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(settings.width, 0.02, settings.depth));
    const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x888888, linewidth: 2 });
    const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    edges.position.y = 0.01;
    this.scene.add(edges);
  }
  
  private createGrid(settings: FloorSettings): void {
    if (!settings.showGrid) return;
    
    const maxSize = Math.max(settings.width, settings.depth) * 1.5;
    
    this.gridHelper = new THREE.GridHelper(
      maxSize,
      Math.ceil(maxSize / settings.gridSize),
      0xaaaaaa,
      0xdddddd
    );
    this.gridHelper.position.y = 0.001;
    this.scene.add(this.gridHelper);
    
    if (settings.showAxes) {
      this.axesHelper = new THREE.AxesHelper(Math.max(settings.width, settings.depth) / 2);
      this.axesHelper.position.y = 0.01;
      this.scene.add(this.axesHelper);
    }
  }
  
  private colorRgbToHex(color: ColorRGB): number {
    return (color.r << 16) | (color.g << 8) | color.b;
  }
  
  public createObjectMesh(obj: BoothObject): THREE.Object3D {
    let mesh: THREE.Object3D;
    
    switch (obj.type) {
      case 'table':
        mesh = this.createTableMesh(obj);
        break;
      case 'display_rack':
        mesh = this.createDisplayRackMesh(obj);
        break;
      case 'cashier_desk':
        mesh = this.createCashierDeskMesh(obj);
        break;
      case 'power_outlet':
        mesh = this.createPowerOutletMesh(obj);
        break;
      case 'power_cable':
        mesh = this.createPowerCableMesh(obj);
        break;
      case 'entrance':
      case 'exit':
        mesh = this.createMarkerMesh(obj);
        break;
      case 'safety_aisle':
        mesh = this.createSafetyAisleMesh(obj);
        break;
      case 'feature_wall':
        mesh = this.createFeatureWallMesh(obj);
        break;
      default:
        mesh = this.createGenericBoxMesh(obj);
    }
    
    mesh.position.set(obj.position.x, obj.position.y, obj.position.z);
    mesh.rotation.y = degToRad(obj.rotation);
    mesh.userData = { objectId: obj.id, objectType: obj.type };
    
    this.scene.add(mesh);
    this.objectMeshes.set(obj.id, mesh);
    
    return mesh;
  }
  
  private createTableMesh(obj: BoothObject): THREE.Object3D {
    const group = new THREE.Group();
    
    const color = this.colorRgbToHex(obj.color);
    
    const tableTopGeometry = new THREE.BoxGeometry(obj.dimensions.x, 0.05, obj.dimensions.z);
    const tableTopMaterial = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.7,
      metalness: 0.1,
    });
    const tableTop = new THREE.Mesh(tableTopGeometry, tableTopMaterial);
    tableTop.position.y = obj.dimensions.y - 0.025;
    tableTop.castShadow = true;
    tableTop.receiveShadow = true;
    group.add(tableTop);
    
    const legRadius = 0.04;
    const legHeight = obj.dimensions.y - 0.05;
    const legMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.5,
      metalness: 0.3,
    });
    
    const offsets = [
      { x: obj.dimensions.x / 2 - 0.06, z: obj.dimensions.z / 2 - 0.06 },
      { x: -obj.dimensions.x / 2 + 0.06, z: obj.dimensions.z / 2 - 0.06 },
      { x: obj.dimensions.x / 2 - 0.06, z: -obj.dimensions.z / 2 + 0.06 },
      { x: -obj.dimensions.x / 2 + 0.06, z: -obj.dimensions.z / 2 + 0.06 },
    ];
    
    for (const offset of offsets) {
      const legGeometry = new THREE.CylinderGeometry(legRadius, legRadius, legHeight, 8);
      const leg = new THREE.Mesh(legGeometry, legMaterial);
      leg.position.set(offset.x, legHeight / 2, offset.z);
      leg.castShadow = true;
      leg.receiveShadow = true;
      group.add(leg);
    }
    
    return group;
  }
  
  private createDisplayRackMesh(obj: BoothObject): THREE.Object3D {
    const group = new THREE.Group();
    const color = this.colorRgbToHex(obj.color);
    
    const frameMaterial = new THREE.MeshStandardMaterial({
      color: 0x444444,
      roughness: 0.6,
      metalness: 0.4,
    });
    
    const shelfMaterial = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.5,
      metalness: 0.2,
    });
    
    const poleRadius = 0.02;
    const poleGeometry = new THREE.CylinderGeometry(poleRadius, poleRadius, obj.dimensions.y, 8);
    
    const polePositions = [
      { x: -obj.dimensions.x / 2 + poleRadius, z: -obj.dimensions.z / 2 + poleRadius },
      { x: obj.dimensions.x / 2 - poleRadius, z: -obj.dimensions.z / 2 + poleRadius },
      { x: -obj.dimensions.x / 2 + poleRadius, z: obj.dimensions.z / 2 - poleRadius },
      { x: obj.dimensions.x / 2 - poleRadius, z: obj.dimensions.z / 2 - poleRadius },
    ];
    
    for (const pos of polePositions) {
      const pole = new THREE.Mesh(poleGeometry, frameMaterial);
      pole.position.set(pos.x, obj.dimensions.y / 2, pos.z);
      pole.castShadow = true;
      group.add(pole);
    }
    
    const shelfCount = 4;
    const shelfSpacing = obj.dimensions.y / (shelfCount + 1);
    const shelfThickness = 0.03;
    
    for (let i = 1; i <= shelfCount; i++) {
      const shelfGeometry = new THREE.BoxGeometry(obj.dimensions.x * 0.95, shelfThickness, obj.dimensions.z * 0.95);
      const shelf = new THREE.Mesh(shelfGeometry, shelfMaterial);
      shelf.position.set(0, i * shelfSpacing, 0);
      shelf.castShadow = true;
      shelf.receiveShadow = true;
      group.add(shelf);
    }
    
    return group;
  }
  
  private createCashierDeskMesh(obj: BoothObject): THREE.Object3D {
    const group = new THREE.Group();
    const color = this.colorRgbToHex(obj.color);
    
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.6,
      metalness: 0.2,
    });
    
    const counterMaterial = new THREE.MeshStandardMaterial({
      color: 0x222222,
      roughness: 0.3,
      metalness: 0.5,
    });
    
    const bodyGeometry = new THREE.BoxGeometry(obj.dimensions.x, obj.dimensions.y * 0.7, obj.dimensions.z);
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = obj.dimensions.y * 0.35;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);
    
    const counterGeometry = new THREE.BoxGeometry(obj.dimensions.x * 1.05, 0.08, obj.dimensions.z * 1.1);
    const counter = new THREE.Mesh(counterGeometry, counterMaterial);
    counter.position.y = obj.dimensions.y * 0.7 + 0.04;
    counter.castShadow = true;
    counter.receiveShadow = true;
    group.add(counter);
    
    return group;
  }
  
  private createPowerOutletMesh(obj: BoothObject): THREE.Object3D {
    const group = new THREE.Group();
    const color = this.colorRgbToHex(obj.color);
    
    const baseGeometry = new THREE.CylinderGeometry(obj.dimensions.x, obj.dimensions.x, obj.dimensions.y, 16);
    const baseMaterial = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.3,
      metalness: 0.6,
      emissive: color,
      emissiveIntensity: 0.2,
    });
    
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.castShadow = true;
    group.add(base);
    
    const glowGeometry = new THREE.CylinderGeometry(obj.dimensions.x * 0.6, obj.dimensions.x * 0.6, obj.dimensions.y * 1.2, 16);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0.3,
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    group.add(glow);
    
    return group;
  }
  
  private createPowerCableMesh(obj: BoothObject): THREE.Object3D {
    const color = this.colorRgbToHex(obj.color);
    
    const geometry = new THREE.BoxGeometry(obj.dimensions.x, obj.dimensions.y, obj.dimensions.z);
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.9,
      metalness: 0.1,
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    return mesh;
  }
  
  private createMarkerMesh(obj: BoothObject): THREE.Object3D {
    const group = new THREE.Group();
    const color = this.colorRgbToHex(obj.color);
    
    const baseGeometry = new THREE.BoxGeometry(obj.dimensions.x, obj.dimensions.y, obj.dimensions.z);
    const baseMaterial = new THREE.MeshStandardMaterial({
      color,
      transparent: true,
      opacity: 0.8,
    });
    
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.receiveShadow = true;
    group.add(base);
    
    const arrowHeight = 0.5;
    const arrowMaterial = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.3,
    });
    
    const arrowGeometry = new THREE.ConeGeometry(0.15, arrowHeight, 4);
    const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
    arrow.position.y = arrowHeight / 2 + obj.dimensions.y;
    arrow.rotation.y = Math.PI / 4;
    group.add(arrow);
    
    const edgeGeometry = new THREE.EdgesGeometry(baseGeometry);
    const edgeMaterial = new THREE.LineBasicMaterial({ color, linewidth: 2 });
    const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    group.add(edges);
    
    return group;
  }
  
  private createSafetyAisleMesh(obj: BoothObject): THREE.Object3D {
    const group = new THREE.Group();
    const color = this.colorRgbToHex(obj.color);
    
    const actualWidth = obj.dimensions.x > 0 ? obj.dimensions.x : 0.5;
    const actualDepth = obj.dimensions.z > 0 ? obj.dimensions.z : plan?.mainAisle.minWidth || 1.2;
    
    const geometry = new THREE.BoxGeometry(actualWidth, obj.dimensions.y, actualDepth);
    const material = new THREE.MeshStandardMaterial({
      color,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    group.add(mesh);
    
    const edgeGeometry = new THREE.EdgesGeometry(geometry);
    const edgeMaterial = new THREE.LineDashedMaterial({
      color,
      linewidth: 2,
      dashSize: 0.1,
      gapSize: 0.05,
    });
    const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    edges.computeLineDistances();
    group.add(edges);
    
    return group;
  }
  
  private createFeatureWallMesh(obj: BoothObject): THREE.Object3D {
    const group = new THREE.Group();
    const color = this.colorRgbToHex(obj.color);
    
    const wallGeometry = new THREE.BoxGeometry(obj.dimensions.x, obj.dimensions.y, obj.dimensions.z);
    const wallMaterial = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.5,
      metalness: 0.1,
    });
    
    const wall = new THREE.Mesh(wallGeometry, wallMaterial);
    wall.castShadow = true;
    wall.receiveShadow = true;
    group.add(wall);
    
    const frameGeometry = new THREE.EdgesGeometry(wallGeometry);
    const frameMaterial = new THREE.LineBasicMaterial({ color: 0x333333, linewidth: 2 });
    const frame = new THREE.LineSegments(frameGeometry, frameMaterial);
    group.add(frame);
    
    const logoGeometry = new THREE.BoxGeometry(obj.dimensions.x * 0.4, obj.dimensions.y * 0.15, 0.02);
    const logoMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.3,
      metalness: 0.5,
    });
    const logo = new THREE.Mesh(logoGeometry, logoMaterial);
    logo.position.set(0, 0, obj.dimensions.z / 2 + 0.011);
    group.add(logo);
    
    return group;
  }
  
  private createGenericBoxMesh(obj: BoothObject): THREE.Object3D {
    const color = this.colorRgbToHex(obj.color);
    
    const geometry = new THREE.BoxGeometry(obj.dimensions.x, obj.dimensions.y, obj.dimensions.z);
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.7,
      metalness: 0.1,
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    return mesh;
  }
  
  public updateObjectPosition(objId: string, position: Vector3D): void {
    const mesh = this.objectMeshes.get(objId);
    if (mesh) {
      mesh.position.set(position.x, position.y, position.z);
    }
  }
  
  public updateObjectRotation(objId: string, rotation: number): void {
    const mesh = this.objectMeshes.get(objId);
    if (mesh) {
      mesh.rotation.y = degToRad(rotation);
    }
  }
  
  public updateObjectDimensions(objId: string, dimensions: Vector3D, obj: BoothObject): void {
    this.removeObject(objId);
    this.createObjectMesh({ ...obj, dimensions });
  }
  
  public removeObject(objId: string): void {
    const mesh = this.objectMeshes.get(objId);
    if (mesh) {
      this.scene.remove(mesh);
      this.disposeObject(mesh);
      this.objectMeshes.delete(objId);
    }
  }
  
  public selectObject(objId: string): void {
    this.highlightObject(objId, true);
  }
  
  public deselectObject(objId: string): void {
    this.highlightObject(objId, false);
  }
  
  private highlightObject(objId: string, selected: boolean): void {
    const mesh = this.objectMeshes.get(objId);
    if (mesh) {
      mesh.traverse(child => {
        if (child instanceof THREE.Mesh) {
          if (child.material instanceof THREE.MeshStandardMaterial) {
            if (selected) {
              child.material.emissive = new THREE.Color(0x00ff00);
              child.material.emissiveIntensity = 0.3;
            } else {
              child.material.emissive = new THREE.Color(0x000000);
              child.material.emissiveIntensity = 0;
            }
          }
        }
      });
    }
  }
  
  public getObjectMesh(objId: string): THREE.Object3D | undefined {
    return this.objectMeshes.get(objId);
  }
  
  public getAllObjectIds(): string[] {
    return Array.from(this.objectMeshes.keys());
  }
  
  public setCameraView(view: 'top' | 'front' | 'side' | 'perspective'): void {
    const distance = Math.max(this.currentPlan?.floor.width || 6, this.currentPlan?.floor.depth || 4) * 1.5;
    
    switch (view) {
      case 'top':
        this.camera.position.set(0, distance, 0.001);
        this.camera.lookAt(0, 0, 0);
        break;
      case 'front':
        this.camera.position.set(0, distance * 0.5, distance);
        this.camera.lookAt(0, 0, 0);
        break;
      case 'side':
        this.camera.position.set(distance, distance * 0.5, 0);
        this.camera.lookAt(0, 0, 0);
        break;
      case 'perspective':
      default:
        this.camera.position.set(distance, distance, distance);
        this.camera.lookAt(0, 0, 0);
        break;
    }
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }
  
  public dispose(): void {
    this.clearScene();
    this.renderer.dispose();
    this.controls.dispose();
  }
}
