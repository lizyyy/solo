import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { LayoutModel, LayoutElement, HeatZone, ElementType } from '../types';
import { getElementColor } from '../utils/layoutUtils';

export interface SceneRendererConfig {
  container: HTMLElement;
  hallWidth: number;
  hallDepth: number;
}

export class SceneRenderer {
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;
  private container: HTMLElement;
  private hallWidth: number;
  private hallDepth: number;
  private elementsMap: Map<string, THREE.Object3D> = new Map();
  private heatZoneMeshes: THREE.Mesh[] = [];
  private animationId: number | null = null;
  private onElementClick?: (elementId: string) => void;
  private onElementDrag?: (elementId: string, position: { x: number; z: number }) => void;
  private selectedElementId: string | null = null;
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  private isDragging: boolean = false;
  private dragPlane: THREE.Plane;
  private dragOffset: THREE.Vector3 = new THREE.Vector3();

  constructor(config: SceneRendererConfig) {
    this.container = config.container;
    this.hallWidth = config.hallWidth;
    this.hallDepth = config.hallDepth;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    this.init();
  }

  private init(): void {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf0f0f0);

    const aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
    
    const diagonal = Math.sqrt(this.hallWidth * this.hallWidth + this.hallDepth * this.hallDepth);
    const cameraHeight = diagonal * 1.2;
    this.camera.position.set(0, cameraHeight, 0);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2;
    this.controls.minPolarAngle = Math.PI / 6;
    this.controls.enablePan = false;

    this.setupLighting();
    this.createFloor();
    this.createWalls();
    this.setupEventListeners();
    this.animate();
  }

  private setupLighting(): void {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -this.hallWidth;
    directionalLight.shadow.camera.right = this.hallWidth;
    directionalLight.shadow.camera.top = this.hallDepth;
    directionalLight.shadow.camera.bottom = -this.hallDepth;
    this.scene.add(directionalLight);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight2.position.set(-10, 10, -10);
    this.scene.add(directionalLight2);
  }

  private createFloor(): void {
    const floorGeometry = new THREE.PlaneGeometry(this.hallWidth, this.hallDepth);
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0xe0e0e0,
      roughness: 0.8,
      metalness: 0.2,
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    floor.name = 'floor';
    this.scene.add(floor);

    const gridHelper = new THREE.GridHelper(
      Math.max(this.hallWidth, this.hallDepth),
      Math.max(this.hallWidth, this.hallDepth),
      0x888888,
      0xcccccc
    );
    gridHelper.position.y = 0.01;
    this.scene.add(gridHelper);
  }

  private createWalls(): void {
    const wallHeight = 3;
    const wallThickness = 0.2;
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
    });

    const frontWall = new THREE.Mesh(
      new THREE.BoxGeometry(this.hallWidth, wallHeight, wallThickness),
      wallMaterial
    );
    frontWall.position.set(0, wallHeight / 2, -this.hallDepth / 2);
    frontWall.castShadow = true;
    frontWall.receiveShadow = true;
    this.scene.add(frontWall);

    const backWall = new THREE.Mesh(
      new THREE.BoxGeometry(this.hallWidth, wallHeight, wallThickness),
      wallMaterial
    );
    backWall.position.set(0, wallHeight / 2, this.hallDepth / 2);
    backWall.castShadow = true;
    backWall.receiveShadow = true;
    this.scene.add(backWall);

    const leftWall = new THREE.Mesh(
      new THREE.BoxGeometry(wallThickness, wallHeight, this.hallDepth),
      wallMaterial
    );
    leftWall.position.set(-this.hallWidth / 2, wallHeight / 2, 0);
    leftWall.castShadow = true;
    leftWall.receiveShadow = true;
    this.scene.add(leftWall);

    const rightWall = new THREE.Mesh(
      new THREE.BoxGeometry(wallThickness, wallHeight, this.hallDepth),
      wallMaterial
    );
    rightWall.position.set(this.hallWidth / 2, wallHeight / 2, 0);
    rightWall.castShadow = true;
    rightWall.receiveShadow = true;
    this.scene.add(rightWall);
  }

  private setupEventListeners(): void {
    const canvas = this.renderer.domElement;

    canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
    canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
    canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
    canvas.addEventListener('click', this.onClick.bind(this));

    window.addEventListener('resize', this.onWindowResize.bind(this));
  }

  private onMouseDown(event: MouseEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    const interactableObjects: THREE.Object3D[] = [];
    this.elementsMap.forEach((obj) => {
      interactableObjects.push(obj);
    });

    const intersects = this.raycaster.intersectObjects(interactableObjects, true);

    if (intersects.length > 0) {
      let clickedObject: THREE.Object3D | null = intersects[0].object;
      
      while (clickedObject && !this.elementsMap.has(clickedObject.name)) {
        clickedObject = clickedObject.parent;
      }

      if (clickedObject && this.elementsMap.has(clickedObject.name)) {
        this.isDragging = true;
        this.selectedElementId = clickedObject.name;
        this.controls.enabled = false;

        const intersection = intersects[0];
        this.dragPlane.constant = -intersection.point.y;
        
        const planeIntersect = new THREE.Vector3();
        this.raycaster.ray.intersectPlane(this.dragPlane, planeIntersect);
        
        if (planeIntersect) {
          this.dragOffset.copy(clickedObject.position).sub(planeIntersect);
        }

        this.highlightElement(clickedObject.name);
      }
    }
  }

  private onMouseMove(event: MouseEvent): void {
    if (!this.isDragging || !this.selectedElementId) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    const intersectPoint = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(this.dragPlane, intersectPoint);

    if (intersectPoint) {
      const element = this.elementsMap.get(this.selectedElementId);
      if (element) {
        const newPosition = intersectPoint.add(this.dragOffset);
        element.position.x = Math.max(
          -this.hallWidth / 2 + 1,
          Math.min(this.hallWidth / 2 - 1, newPosition.x)
        );
        element.position.z = Math.max(
          -this.hallDepth / 2 + 1,
          Math.min(this.hallDepth / 2 - 1, newPosition.z)
        );

        if (this.onElementDrag) {
          this.onElementDrag(this.selectedElementId, {
            x: element.position.x,
            z: element.position.z,
          });
        }
      }
    }
  }

  private onMouseUp(): void {
    if (this.isDragging) {
      this.isDragging = false;
      this.controls.enabled = true;
    }
  }

  private onClick(event: MouseEvent): void {
    if (this.isDragging) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    const interactableObjects: THREE.Object3D[] = [];
    this.elementsMap.forEach((obj) => {
      interactableObjects.push(obj);
    });

    const intersects = this.raycaster.intersectObjects(interactableObjects, true);

    if (intersects.length > 0) {
      let clickedObject: THREE.Object3D | null = intersects[0].object;
      
      while (clickedObject && !this.elementsMap.has(clickedObject.name)) {
        clickedObject = clickedObject.parent;
      }

      if (clickedObject && this.elementsMap.has(clickedObject.name)) {
        this.selectedElementId = clickedObject.name;
        this.highlightElement(clickedObject.name);
        
        if (this.onElementClick) {
          this.onElementClick(clickedObject.name);
        }
      } else {
        this.clearSelection();
      }
    } else {
      this.clearSelection();
    }
  }

  private clearSelection(): void {
    this.elementsMap.forEach((_, id) => {
      this.unhighlightElement(id);
    });
    this.selectedElementId = null;
  }

  private highlightElement(elementId: string): void {
    const element = this.elementsMap.get(elementId);
    if (!element) return;

    element.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((mat) => {
          if ('emissive' in mat) {
            (mat as THREE.MeshStandardMaterial).emissive.setHex(0xffff00);
            (mat as THREE.MeshStandardMaterial).emissiveIntensity = 0.3;
          }
        });
      }
    });
  }

  private unhighlightElement(elementId: string): void {
    const element = this.elementsMap.get(elementId);
    if (!element) return;

    element.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((mat) => {
          if ('emissive' in mat) {
            (mat as THREE.MeshStandardMaterial).emissive.setHex(0x000000);
            (mat as THREE.MeshStandardMaterial).emissiveIntensity = 0;
          }
        });
      }
    });
  }

  private onWindowResize(): void {
    this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
  }

  private createElementMesh(element: LayoutElement): THREE.Object3D {
    const group = new THREE.Group();
    group.name = element.id;
    group.position.set(element.position.x, element.position.y, element.position.z);
    group.rotation.set(element.rotation.x, element.rotation.y, element.rotation.z);

    const color = element.color || getElementColor(element.type);

    switch (element.type) {
      case 'cabinet':
        this.createCabinetMesh(group, color, element.scale);
        break;
      case 'entrance':
        this.createEntranceMesh(group, color, element.scale);
        break;
      case 'exit':
        this.createExitMesh(group, color, element.scale);
        break;
      case 'interactive_screen':
        this.createInteractiveScreenMesh(group, color, element.scale);
        break;
      case 'fire_exit':
        this.createFireExitMesh(group, color, element.scale);
        break;
    }

    this.addLabel(group, element.name, element.type);

    return group;
  }

  private createCabinetMesh(group: THREE.Group, color: string, scale: { x: number; y: number; z: number }): void {
    const geometry = new THREE.BoxGeometry(1 * scale.x, 1 * scale.y, 0.6 * scale.z);
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.7,
      metalness: 0.2,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = 0.5 * scale.y;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    const topGeometry = new THREE.BoxGeometry(1.1 * scale.x, 0.05, 0.7 * scale.z);
    const topMaterial = new THREE.MeshStandardMaterial({
      color: 0x8B7355,
      roughness: 0.5,
      metalness: 0.3,
    });
    const topMesh = new THREE.Mesh(topGeometry, topMaterial);
    topMesh.position.y = 1.025 * scale.y;
    topMesh.castShadow = true;
    topMesh.receiveShadow = true;
    group.add(topMesh);
  }

  private createEntranceMesh(group: THREE.Group, color: string, scale: { x: number; y: number; z: number }): void {
    const baseGeometry = new THREE.BoxGeometry(2 * scale.x, 0.1, 1 * scale.z);
    const baseMaterial = new THREE.MeshStandardMaterial({
      color,
      transparent: true,
      opacity: 0.7,
    });
    const baseMesh = new THREE.Mesh(baseGeometry, baseMaterial);
    baseMesh.position.y = 0.05;
    group.add(baseMesh);

    const arrowShape = new THREE.Shape();
    arrowShape.moveTo(0, 0);
    arrowShape.lineTo(0.3, 0.3);
    arrowShape.lineTo(0.1, 0.3);
    arrowShape.lineTo(0.1, 0.6);
    arrowShape.lineTo(-0.1, 0.6);
    arrowShape.lineTo(-0.1, 0.3);
    arrowShape.lineTo(-0.3, 0.3);
    arrowShape.closePath();

    const extrudeSettings = { depth: 0.05, bevelEnabled: false };
    const arrowGeometry = new THREE.ExtrudeGeometry(arrowShape, extrudeSettings);
    const arrowMaterial = new THREE.MeshStandardMaterial({
      color: 0x006400,
    });
    const arrowMesh = new THREE.Mesh(arrowGeometry, arrowMaterial);
    arrowMesh.rotation.x = -Math.PI / 2;
    arrowMesh.position.y = 0.1;
    arrowMesh.scale.set(scale.x, scale.y, scale.z);
    group.add(arrowMesh);

    const pillarGeometry = new THREE.CylinderGeometry(0.1 * scale.x, 0.1 * scale.x, 2.5 * scale.y, 8);
    const pillarMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a4a4a,
      roughness: 0.6,
    });

    const leftPillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
    leftPillar.position.set(-0.9 * scale.x, 1.25 * scale.y, 0);
    leftPillar.castShadow = true;
    group.add(leftPillar);

    const rightPillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
    rightPillar.position.set(0.9 * scale.x, 1.25 * scale.y, 0);
    rightPillar.castShadow = true;
    group.add(rightPillar);

    const topGeometry = new THREE.BoxGeometry(2 * scale.x, 0.2 * scale.y, 0.2 * scale.z);
    const topMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a4a4a,
      roughness: 0.6,
    });
    const topMesh = new THREE.Mesh(topGeometry, topMaterial);
    topMesh.position.set(0, 2.6 * scale.y, 0);
    topMesh.castShadow = true;
    group.add(topMesh);
  }

  private createExitMesh(group: THREE.Group, color: string, scale: { x: number; y: number; z: number }): void {
    const baseGeometry = new THREE.BoxGeometry(2 * scale.x, 0.1, 1 * scale.z);
    const baseMaterial = new THREE.MeshStandardMaterial({
      color,
      transparent: true,
      opacity: 0.7,
    });
    const baseMesh = new THREE.Mesh(baseGeometry, baseMaterial);
    baseMesh.position.y = 0.05;
    group.add(baseMesh);

    const arrowShape = new THREE.Shape();
    arrowShape.moveTo(0, 0);
    arrowShape.lineTo(0.3, 0.3);
    arrowShape.lineTo(0.1, 0.3);
    arrowShape.lineTo(0.1, 0.6);
    arrowShape.lineTo(-0.1, 0.6);
    arrowShape.lineTo(-0.1, 0.3);
    arrowShape.lineTo(-0.3, 0.3);
    arrowShape.closePath();

    const extrudeSettings = { depth: 0.05, bevelEnabled: false };
    const arrowGeometry = new THREE.ExtrudeGeometry(arrowShape, extrudeSettings);
    const arrowMaterial = new THREE.MeshStandardMaterial({
      color: 0x8B0000,
    });
    const arrowMesh = new THREE.Mesh(arrowGeometry, arrowMaterial);
    arrowMesh.rotation.x = Math.PI / 2;
    arrowMesh.position.y = 0.1;
    arrowMesh.scale.set(scale.x, scale.y, scale.z);
    group.add(arrowMesh);

    const pillarGeometry = new THREE.CylinderGeometry(0.1 * scale.x, 0.1 * scale.x, 2.5 * scale.y, 8);
    const pillarMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a4a4a,
      roughness: 0.6,
    });

    const leftPillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
    leftPillar.position.set(-0.9 * scale.x, 1.25 * scale.y, 0);
    leftPillar.castShadow = true;
    group.add(leftPillar);

    const rightPillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
    rightPillar.position.set(0.9 * scale.x, 1.25 * scale.y, 0);
    rightPillar.castShadow = true;
    group.add(rightPillar);

    const topGeometry = new THREE.BoxGeometry(2 * scale.x, 0.2 * scale.y, 0.2 * scale.z);
    const topMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a4a4a,
      roughness: 0.6,
    });
    const topMesh = new THREE.Mesh(topGeometry, topMaterial);
    topMesh.position.set(0, 2.6 * scale.y, 0);
    topMesh.castShadow = true;
    group.add(topMesh);
  }

  private createInteractiveScreenMesh(group: THREE.Group, color: string, scale: { x: number; y: number; z: number }): void {
    const screenGeometry = new THREE.BoxGeometry(2 * scale.x, 1.2 * scale.y, 0.1 * scale.z);
    const screenMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1a2e,
      roughness: 0.3,
      metalness: 0.7,
    });
    const screenMesh = new THREE.Mesh(screenGeometry, screenMaterial);
    screenMesh.position.y = 1.1 * scale.y;
    screenMesh.castShadow = true;
    screenMesh.receiveShadow = true;
    group.add(screenMesh);

    const displayGeometry = new THREE.BoxGeometry(1.8 * scale.x, 1 * scale.y, 0.01 * scale.z);
    const displayMaterial = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.5,
      roughness: 0.2,
    });
    const displayMesh = new THREE.Mesh(displayGeometry, displayMaterial);
    displayMesh.position.set(0, 1.1 * scale.y, 0.06 * scale.z);
    group.add(displayMesh);

    const baseGeometry = new THREE.BoxGeometry(0.6 * scale.x, 0.2 * scale.y, 0.4 * scale.z);
    const baseMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.6,
      metalness: 0.4,
    });
    const baseMesh = new THREE.Mesh(baseGeometry, baseMaterial);
    baseMesh.position.y = 0.1 * scale.y;
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    group.add(baseMesh);

    const standGeometry = new THREE.BoxGeometry(0.1 * scale.x, 1 * scale.y, 0.1 * scale.z);
    const standMaterial = new THREE.MeshStandardMaterial({
      color: 0x555555,
      roughness: 0.6,
      metalness: 0.4,
    });
    const standMesh = new THREE.Mesh(standGeometry, standMaterial);
    standMesh.position.y = 0.7 * scale.y;
    standMesh.castShadow = true;
    group.add(standMesh);
  }

  private createFireExitMesh(group: THREE.Group, color: string, scale: { x: number; y: number; z: number }): void {
    const baseGeometry = new THREE.BoxGeometry(2 * scale.x, 0.1, 1.5 * scale.z);
    const baseMaterial = new THREE.MeshStandardMaterial({
      color,
      transparent: true,
      opacity: 0.5,
    });
    const baseMesh = new THREE.Mesh(baseGeometry, baseMaterial);
    baseMesh.position.y = 0.05;
    group.add(baseMesh);

    const edges = new THREE.EdgesGeometry(baseGeometry);
    const lineMaterial = new THREE.LineDashedMaterial({ 
      color: 0x000000,
      dashSize: 0.2,
      gapSize: 0.1,
    });
    const wireframe = new THREE.LineSegments(edges, lineMaterial);
    wireframe.position.y = 0.05;
    wireframe.computeLineDistances();
    group.add(wireframe);

    const signGeometry = new THREE.BoxGeometry(1.5 * scale.x, 0.8 * scale.y, 0.1 * scale.z);
    const signMaterial = new THREE.MeshStandardMaterial({
      color: 0x008000,
      emissive: 0x004000,
      emissiveIntensity: 0.3,
    });
    const signMesh = new THREE.Mesh(signGeometry, signMaterial);
    signMesh.position.set(0, 2 * scale.y, 0);
    signMesh.castShadow = true;
    group.add(signMesh);

    const runnerShape = new THREE.Shape();
    runnerShape.moveTo(-0.4, 0);
    runnerShape.lineTo(-0.3, 0.1);
    runnerShape.lineTo(-0.3, -0.1);
    runnerShape.closePath();

    const runnerGeometry = new THREE.ShapeGeometry(runnerShape);
    const runnerMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
    });
    const runnerMesh = new THREE.Mesh(runnerGeometry, runnerMaterial);
    runnerMesh.position.set(0, 2 * scale.y, 0.06 * scale.z);
    runnerMesh.scale.set(scale.x, scale.y, scale.z);
    group.add(runnerMesh);

    const doorGeometry = new THREE.BoxGeometry(1 * scale.x, 0.5 * scale.y, 0.05 * scale.z);
    const doorMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
    });
    const doorMesh = new THREE.Mesh(doorGeometry, doorMaterial);
    doorMesh.position.set(0.3 * scale.x, 2 * scale.y, 0.06 * scale.z);
    group.add(doorMesh);
  }

  private addLabel(group: THREE.Group, name: string, type: ElementType): void {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return;

    canvas.width = 256;
    canvas.height = 64;
    
    context.fillStyle = 'rgba(255, 255, 255, 0.9)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    context.strokeStyle = '#666666';
    context.lineWidth = 2;
    context.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);

    context.font = 'bold 24px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = getElementColor(type);
    context.fillText(name, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
    });
    const sprite = new THREE.Sprite(material);
    sprite.position.y = 3;
    sprite.scale.set(2, 0.5, 1);
    group.add(sprite);
  }

  public updateLayout(model: LayoutModel): void {
    this.elementsMap.forEach((obj) => {
      this.scene.remove(obj);
    });
    this.elementsMap.clear();

    model.elements.forEach((element) => {
      const mesh = this.createElementMesh(element);
      this.scene.add(mesh);
      this.elementsMap.set(element.id, mesh);
    });
  }

  public updateElementPosition(elementId: string, x: number, y: number, z: number): void {
    const element = this.elementsMap.get(elementId);
    if (element) {
      element.position.set(x, y, z);
    }
  }

  public updateElementRotation(elementId: string, x: number, y: number, z: number): void {
    const element = this.elementsMap.get(elementId);
    if (element) {
      element.rotation.set(x, y, z);
    }
  }

  public updateElementScale(elementId: string, x: number, y: number, z: number): void {
    const element = this.elementsMap.get(elementId);
    if (element) {
      element.scale.set(x, y, z);
    }
  }

  public showHeatZones(heatZones: HeatZone[]): void {
    this.heatZoneMeshes.forEach((mesh) => {
      this.scene.remove(mesh);
    });
    this.heatZoneMeshes = [];

    heatZones.forEach((zone) => {
      const geometry = new THREE.CircleGeometry(zone.radius, 32);
      const intensity = Math.min(zone.intensity, 1);
      const color = new THREE.Color();
      color.setHSL(0.1 * (1 - intensity), 1, 0.5);

      const material = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.3 + intensity * 0.3,
        side: THREE.DoubleSide,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(zone.position.x, 0.02, zone.position.z);
      
      this.scene.add(mesh);
      this.heatZoneMeshes.push(mesh);
    });
  }

  public setOnElementClick(callback: (elementId: string) => void): void {
    this.onElementClick = callback;
  }

  public setOnElementDrag(callback: (elementId: string, position: { x: number; z: number }) => void): void {
    this.onElementDrag = callback;
  }

  public rotateSelectedElement(deltaY: number): void {
    if (!this.selectedElementId) return;

    const element = this.elementsMap.get(this.selectedElementId);
    if (element) {
      element.rotation.y += deltaY;
    }
  }

  public getSelectedElementId(): string | null {
    return this.selectedElementId;
  }

  public selectElement(elementId: string): void {
    this.clearSelection();
    this.selectedElementId = elementId;
    this.highlightElement(elementId);
  }

  private animate(): void {
    this.animationId = requestAnimationFrame(this.animate.bind(this));
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  public dispose(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    this.controls.dispose();
    this.renderer.dispose();
    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
