import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { 
  Booth, 
  Exit, 
  Zone, 
  EvacuationPath, 
  Position,
  ThreeDObjectData 
} from '../types';

export class SceneManager {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private container: HTMLElement;
  
  private boothMeshes: Map<string, THREE.Mesh> = new Map();
  private exitMeshes: Map<string, THREE.Mesh> = new Map();
  private zoneMeshes: Map<string, THREE.Mesh> = new Map();
  private pathLines: Map<string, THREE.Line> = new Map();
  
  private hallDimensions: { width: number; depth: number };
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  
  private animationId: number | null = null;
  private onObjectSelect?: (data: ThreeDObjectData | null) => void;
  private onObjectMove?: (data: ThreeDObjectData, position: Position) => void;
  private isDragging: boolean = false;
  private dragPlane: THREE.Plane;
  private dragOffset: THREE.Vector3;
  private draggedObject: THREE.Object3D | null = null;
  
  constructor(container: HTMLElement) {
    this.container = container;
    this.hallDimensions = { width: 40, depth: 30 };
    
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.dragOffset = new THREE.Vector3();
    
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf5f7fa);
    
    const aspect = container.clientWidth / container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
    this.camera.position.set(30, 35, 30);
    this.camera.lookAt(0, 0, 0);
    
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true 
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    container.appendChild(this.renderer.domElement);
    
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2.2;
    this.controls.minDistance = 10;
    this.controls.maxDistance = 100;
    
    this.setupLights();
    this.setupEventListeners();
    this.animate();
  }
  
  private setupLights(): void {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(20, 40, 20);
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
    
    const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.3);
    this.scene.add(hemisphereLight);
  }
  
  private setupEventListeners(): void {
    window.addEventListener('resize', this.onWindowResize.bind(this));
    this.renderer.domElement.addEventListener('mousedown', this.onMouseDown.bind(this));
    this.renderer.domElement.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.renderer.domElement.addEventListener('mouseup', this.onMouseUp.bind(this));
    this.renderer.domElement.addEventListener('click', this.onClick.bind(this));
  }
  
  private onWindowResize(): void {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }
  
  private getIntersects(event: MouseEvent): THREE.Intersection[] {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    const allMeshes: THREE.Object3D[] = [];
    this.boothMeshes.forEach(mesh => allMeshes.push(mesh));
    this.exitMeshes.forEach(mesh => allMeshes.push(mesh));
    this.zoneMeshes.forEach(mesh => allMeshes.push(mesh));
    
    return this.raycaster.intersectObjects(allMeshes);
  }
  
  private onMouseDown(event: MouseEvent): void {
    const intersects = this.getIntersects(event);
    
    if (intersects.length > 0) {
      this.controls.enabled = false;
      this.isDragging = true;
      this.draggedObject = intersects[0].object;
      
      const dragPlaneNormal = new THREE.Vector3(0, 1, 0);
      this.dragPlane = new THREE.Plane(dragPlaneNormal, 0);
      
      const planeIntersect = new THREE.Vector3();
      this.raycaster.ray.intersectPlane(this.dragPlane, planeIntersect);
      
      if (this.draggedObject) {
        this.dragOffset.copy(planeIntersect).sub(this.draggedObject.position);
      }
    }
  }
  
  private onMouseMove(event: MouseEvent): void {
    if (!this.isDragging || !this.draggedObject) return;
    
    this.getIntersects(event);
    
    const intersectionPoint = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(this.dragPlane, intersectionPoint);
    
    const newPosition = intersectionPoint.sub(this.dragOffset);
    
    const halfWidth = this.hallDimensions.width / 2;
    const halfDepth = this.hallDimensions.depth / 2;
    
    newPosition.x = Math.max(-halfWidth + 1, Math.min(halfWidth - 1, newPosition.x));
    newPosition.z = Math.max(-halfDepth + 1, Math.min(halfDepth - 1, newPosition.z));
    newPosition.y = this.draggedObject.position.y;
    
    this.draggedObject.position.copy(newPosition);
    
    const userData = this.draggedObject.userData as ThreeDObjectData;
    if (userData && this.onObjectMove) {
      this.onObjectMove(userData, {
        x: newPosition.x + halfWidth,
        z: newPosition.z + halfDepth
      });
    }
  }
  
  private onMouseUp(): void {
    if (this.isDragging) {
      this.isDragging = false;
      this.draggedObject = null;
      this.controls.enabled = true;
    }
  }
  
  private onClick(event: MouseEvent): void {
    if (this.isDragging) return;
    
    const intersects = this.getIntersects(event);
    
    if (intersects.length > 0 && this.onObjectSelect) {
      const userData = intersects[0].object.userData as ThreeDObjectData;
      this.highlightObject(intersects[0].object);
      this.onObjectSelect(userData);
    } else if (this.onObjectSelect) {
      this.clearHighlight();
      this.onObjectSelect(null);
    }
  }
  
  private highlightObject(object: THREE.Object3D): void {
    this.clearHighlight();
    
    if (object instanceof THREE.Mesh) {
      const material = object.material as THREE.MeshStandardMaterial;
      material.emissive = new THREE.Color(0x4fc3f7);
      material.emissiveIntensity = 0.5;
    }
  }
  
  private clearHighlight(): void {
    this.boothMeshes.forEach(mesh => {
      const material = mesh.material as THREE.MeshStandardMaterial;
      material.emissive = new THREE.Color(0x000000);
      material.emissiveIntensity = 0;
    });
    this.exitMeshes.forEach(mesh => {
      const material = mesh.material as THREE.MeshStandardMaterial;
      material.emissive = new THREE.Color(0x000000);
      material.emissiveIntensity = 0;
    });
    this.zoneMeshes.forEach(mesh => {
      const material = mesh.material as THREE.MeshStandardMaterial;
      material.emissive = new THREE.Color(0x000000);
      material.emissiveIntensity = 0;
    });
  }
  
  private animate(): void {
    this.animationId = requestAnimationFrame(this.animate.bind(this));
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
  
  public setHallDimensions(width: number, depth: number): void {
    this.hallDimensions = { width, depth };
    this.createFloor();
  }
  
  public createFloor(): void {
    const existingFloor = this.scene.getObjectByName('floor');
    if (existingFloor) {
      this.scene.remove(existingFloor);
    }
    
    const halfWidth = this.hallDimensions.width / 2;
    const halfDepth = this.hallDimensions.depth / 2;
    
    const floorGeometry = new THREE.PlaneGeometry(this.hallDimensions.width, this.hallDimensions.depth);
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0xe8eaf0,
      roughness: 0.8,
      metalness: 0.1
    });
    
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    floor.name = 'floor';
    this.scene.add(floor);
    
    const gridHelper = new THREE.GridHelper(
      Math.max(this.hallDimensions.width, this.hallDimensions.depth),
      Math.max(this.hallDimensions.width, this.hallDimensions.depth),
      0xcccccc,
      0xe0e0e0
    );
    gridHelper.position.y = 0.01;
    gridHelper.name = 'grid';
    this.scene.add(gridHelper);
    
    const wallsGroup = new THREE.Group();
    wallsGroup.name = 'walls';
    
    const wallHeight = 3;
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0xf8f9fa,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide
    });
    
    const backWall = new THREE.Mesh(
      new THREE.PlaneGeometry(this.hallDimensions.width, wallHeight),
      wallMaterial
    );
    backWall.position.set(0, wallHeight / 2, -halfDepth);
    wallsGroup.add(backWall);
    
    const leftWall = new THREE.Mesh(
      new THREE.PlaneGeometry(this.hallDimensions.depth, wallHeight),
      wallMaterial
    );
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-halfWidth, wallHeight / 2, 0);
    wallsGroup.add(leftWall);
    
    const rightWall = new THREE.Mesh(
      new THREE.PlaneGeometry(this.hallDimensions.depth, wallHeight),
      wallMaterial
    );
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.set(halfWidth, wallHeight / 2, 0);
    wallsGroup.add(rightWall);
    
    this.scene.add(wallsGroup);
  }
  
  public addBooth(booth: Booth): void {
    const halfWidth = this.hallDimensions.width / 2;
    const halfDepth = this.hallDimensions.depth / 2;
    
    const centerX = booth.position.x + booth.dimension.width / 2 - halfWidth;
    const centerZ = booth.position.z + booth.dimension.depth / 2 - halfDepth;
    
    const height = 2;
    
    const geometry = new THREE.BoxGeometry(
      booth.dimension.width,
      height,
      booth.dimension.depth
    );
    
    const material = new THREE.MeshStandardMaterial({
      color: booth.color,
      roughness: 0.7,
      metalness: 0.1
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(centerX, height / 2, centerZ);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { type: 'booth', id: booth.id } as ThreeDObjectData;
    
    const edgesGeometry = new THREE.EdgesGeometry(geometry);
    const edgesMaterial = new THREE.LineBasicMaterial({ color: 0x555555 });
    const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
    mesh.add(edges);
    
    this.boothMeshes.set(booth.id, mesh);
    this.scene.add(mesh);
  }
  
  public updateBooth(booth: Booth): void {
    const mesh = this.boothMeshes.get(booth.id);
    if (mesh) {
      this.scene.remove(mesh);
      this.boothMeshes.delete(booth.id);
      this.addBooth(booth);
    }
  }
  
  public removeBooth(id: string): void {
    const mesh = this.boothMeshes.get(id);
    if (mesh) {
      this.scene.remove(mesh);
      this.boothMeshes.delete(id);
    }
  }
  
  public addExit(exit: Exit): void {
    const halfWidth = this.hallDimensions.width / 2;
    const halfDepth = this.hallDimensions.depth / 2;
    
    const x = exit.position.x - halfWidth;
    const z = exit.position.z - halfDepth;
    
    const baseGeometry = new THREE.CylinderGeometry(1, 1.2, 0.3, 16);
    const baseMaterial = new THREE.MeshStandardMaterial({
      color: 0x27ae60,
      emissive: 0x1e8449,
      emissiveIntensity: 0.3
    });
    
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.set(x, 0.15, z);
    base.castShadow = true;
    base.receiveShadow = true;
    base.userData = { type: 'exit', id: exit.id } as ThreeDObjectData;
    
    const signGeometry = new THREE.ConeGeometry(0.6, 1.5, 4);
    const signMaterial = new THREE.MeshStandardMaterial({
      color: 0xf1c40f,
      emissive: 0xf39c12,
      emissiveIntensity: 0.4
    });
    
    const sign = new THREE.Mesh(signGeometry, signMaterial);
    sign.position.set(x, 1.2, z);
    sign.rotation.y = Math.PI / 4;
    sign.castShadow = true;
    
    base.add(sign);
    
    this.exitMeshes.set(exit.id, base);
    this.scene.add(base);
  }
  
  public updateExit(exit: Exit): void {
    const mesh = this.exitMeshes.get(exit.id);
    if (mesh) {
      this.scene.remove(mesh);
      this.exitMeshes.delete(exit.id);
      this.addExit(exit);
    }
  }
  
  public removeExit(id: string): void {
    const mesh = this.exitMeshes.get(id);
    if (mesh) {
      this.scene.remove(mesh);
      this.exitMeshes.delete(id);
    }
  }
  
  public addZone(zone: Zone): void {
    const halfWidth = this.hallDimensions.width / 2;
    const halfDepth = this.hallDimensions.depth / 2;
    
    const centerX = zone.position.x + zone.dimension.width / 2 - halfWidth;
    const centerZ = zone.position.z + zone.dimension.depth / 2 - halfDepth;
    
    const geometry = new THREE.PlaneGeometry(zone.dimension.width, zone.dimension.depth);
    
    const color = new THREE.Color(zone.color);
    const material = new THREE.MeshStandardMaterial({
      color: color,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(centerX, 0.02, centerZ);
    mesh.userData = { type: 'zone', id: zone.id } as ThreeDObjectData;
    
    const edgesGeometry = new THREE.EdgesGeometry(geometry);
    const edgesMaterial = new THREE.LineBasicMaterial({ 
      color: zone.color,
      linewidth: 2
    });
    const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
    edges.rotation.x = -Math.PI / 2;
    edges.position.set(centerX, 0.03, centerZ);
    this.scene.add(edges);
    
    this.zoneMeshes.set(zone.id, mesh);
    this.scene.add(mesh);
  }
  
  public updateZone(zone: Zone): void {
    const mesh = this.zoneMeshes.get(zone.id);
    if (mesh) {
      this.scene.remove(mesh);
      this.zoneMeshes.delete(zone.id);
      this.addZone(zone);
    }
  }
  
  public removeZone(id: string): void {
    const mesh = this.zoneMeshes.get(id);
    if (mesh) {
      this.scene.remove(mesh);
      this.zoneMeshes.delete(id);
    }
  }
  
  public drawEvacuationPath(path: EvacuationPath, color: number = 0x3498db): void {
    this.clearEvacuationPath(path.fromZone);
    
    if (path.waypoints.length < 2) return;
    
    const halfWidth = this.hallDimensions.width / 2;
    const halfDepth = this.hallDimensions.depth / 2;
    
    const points = path.waypoints.map(wp => 
      new THREE.Vector3(
        wp.x - halfWidth,
        0.1,
        wp.z - halfDepth
      )
    );
    
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ 
      color: path.isBlocked ? 0xe74c3c : color,
      linewidth: 3
    });
    
    const line = new THREE.Line(geometry, material);
    line.name = `path-${path.fromZone}`;
    
    this.pathLines.set(path.fromZone, line);
    this.scene.add(line);
    
    for (let i = 0; i < points.length; i++) {
      const sphereGeometry = new THREE.SphereGeometry(0.15, 16, 16);
      const sphereMaterial = new THREE.MeshBasicMaterial({ 
        color: path.isBlocked ? 0xe74c3c : color 
      });
      const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
      sphere.position.copy(points[i]);
      sphere.name = `path-${path.fromZone}-point-${i}`;
      this.scene.add(sphere);
    }
  }
  
  public clearEvacuationPath(zoneId: string): void {
    const line = this.pathLines.get(zoneId);
    if (line) {
      this.scene.remove(line);
      this.pathLines.delete(zoneId);
    }
    
    const objectsToRemove: THREE.Object3D[] = [];
    this.scene.traverse(obj => {
      if (obj.name.startsWith(`path-${zoneId}`)) {
        objectsToRemove.push(obj);
      }
    });
    
    objectsToRemove.forEach(obj => this.scene.remove(obj));
  }
  
  public clearAllPaths(): void {
    this.pathLines.forEach((_, zoneId) => {
      this.clearEvacuationPath(zoneId);
    });
  }
  
  public clearAll(): void {
    this.boothMeshes.forEach(mesh => this.scene.remove(mesh));
    this.exitMeshes.forEach(mesh => this.scene.remove(mesh));
    this.zoneMeshes.forEach(mesh => this.scene.remove(mesh));
    this.clearAllPaths();
    
    this.boothMeshes.clear();
    this.exitMeshes.clear();
    this.zoneMeshes.clear();
  }
  
  public setOnObjectSelect(callback: (data: ThreeDObjectData | null) => void): void {
    this.onObjectSelect = callback;
  }
  
  public setOnObjectMove(callback: (data: ThreeDObjectData, position: Position) => void): void {
    this.onObjectMove = callback;
  }
  
  public focusOnObject(type: 'booth' | 'exit' | 'zone', id: string): void {
    let mesh: THREE.Mesh | undefined;
    
    switch (type) {
      case 'booth':
        mesh = this.boothMeshes.get(id);
        break;
      case 'exit':
        mesh = this.exitMeshes.get(id);
        break;
      case 'zone':
        mesh = this.zoneMeshes.get(id);
        break;
    }
    
    if (mesh) {
      const targetPosition = mesh.position.clone();
      const distance = 15;
      const angle = Math.PI / 4;
      
      this.camera.position.set(
        targetPosition.x + distance * Math.cos(angle),
        targetPosition.y + distance * 0.8,
        targetPosition.z + distance * Math.sin(angle)
      );
      
      this.controls.target.copy(targetPosition);
      this.controls.update();
    }
  }
  
  public dispose(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    
    this.clearAll();
    this.controls.dispose();
    this.renderer.dispose();
    
    window.removeEventListener('resize', this.onWindowResize.bind(this));
  }
}
