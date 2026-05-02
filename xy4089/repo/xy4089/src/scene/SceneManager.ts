import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  Project,
  Truss,
  HoistPoint,
  Equipment,
  StageBoundary,
  ValidationResult,
} from '../models';

export interface SceneObject {
  id: string;
  type: 'truss' | 'hoistPoint' | 'equipment' | 'boundary' | 'grid' | 'ground';
  threeObject: THREE.Object3D;
  data: Truss | HoistPoint | Equipment | StageBoundary | null;
}

export class SceneManager {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private sceneObjects: Map<string, SceneObject> = new Map();
  private selectedObjectId: string | null = null;
  private onObjectClick?: (objectId: string, type: string) => void;
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  private animationFrameId: number | null = null;
  private gridHelper: THREE.GridHelper | null = null;
  private ground: THREE.Mesh | null = null;
  private axesHelper: THREE.AxesHelper | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    const aspect = container.clientWidth / container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    this.camera.position.set(10, 8, 15);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.screenSpacePanning = true;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 100;
    this.controls.maxPolarAngle = Math.PI / 2;

    this.setupLights();
    this.setupGround();
    this.setupGrid();
    this.setupAxes();
    this.setupEventListeners();

    this.scene.background = new THREE.Color(0x1a1a2e);
    this.startAnimation();
  }

  private setupLights(): void {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -20;
    directionalLight.shadow.camera.right = 20;
    directionalLight.shadow.camera.top = 20;
    directionalLight.shadow.camera.bottom = -20;
    this.scene.add(directionalLight);

    const fillLight = new THREE.DirectionalLight(0x8888ff, 0.3);
    fillLight.position.set(-10, 10, -10);
    this.scene.add(fillLight);
  }

  private setupGround(): void {
    const geometry = new THREE.PlaneGeometry(100, 100);
    const material = new THREE.MeshStandardMaterial({
      color: 0x2a2a3e,
      roughness: 0.8,
      metalness: 0.2,
    });
    this.ground = new THREE.Mesh(geometry, material);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = 0;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    this.sceneObjects.set('ground', {
      id: 'ground',
      type: 'ground',
      threeObject: this.ground,
      data: null,
    });
  }

  private setupGrid(): void {
    this.gridHelper = new THREE.GridHelper(50, 50, 0x444466, 0x333355);
    this.gridHelper.position.y = 0.01;
    this.scene.add(this.gridHelper);

    this.sceneObjects.set('grid', {
      id: 'grid',
      type: 'grid',
      threeObject: this.gridHelper,
      data: null,
    });
  }

  private setupAxes(): void {
    this.axesHelper = new THREE.AxesHelper(5);
    this.scene.add(this.axesHelper);
  }

  private setupEventListeners(): void {
    window.addEventListener('resize', this.onWindowResize.bind(this));
    this.renderer.domElement.addEventListener('click', this.onMouseClick.bind(this));
    this.renderer.domElement.addEventListener('mousemove', this.onMouseMove.bind(this));
  }

  private onWindowResize(): void {
    const { clientWidth, clientHeight } = this.container;
    this.camera.aspect = clientWidth / clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(clientWidth, clientHeight);
  }

  private onMouseClick(event: MouseEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    const selectableObjects: THREE.Object3D[] = [];
    this.sceneObjects.forEach(obj => {
      if (obj.type !== 'grid' && obj.type !== 'ground') {
        selectableObjects.push(obj.threeObject);
      }
    });

    const intersects = this.raycaster.intersectObjects(selectableObjects, true);

    if (intersects.length > 0) {
      let clickedObject = intersects[0].object;
      while (clickedObject.parent && !this.sceneObjects.has(clickedObject.uuid)) {
        clickedObject = clickedObject.parent;
      }

      const sceneObj = this.sceneObjects.get(clickedObject.uuid);
      if (sceneObj && this.onObjectClick) {
        this.onObjectClick(sceneObj.id, sceneObj.type);
      }
    }
  }

  private onMouseMove(event: MouseEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private startAnimation(): void {
    const animate = () => {
      this.animationFrameId = requestAnimationFrame(animate);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }

  setOnObjectClick(callback: (objectId: string, type: string) => void): void {
    this.onObjectClick = callback;
  }

  clearScene(): void {
    const toRemove: string[] = [];
    this.sceneObjects.forEach((obj, id) => {
      if (obj.type !== 'grid' && obj.type !== 'ground') {
        this.scene.remove(obj.threeObject);
        toRemove.push(id);
      }
    });
    toRemove.forEach(id => this.sceneObjects.delete(id));
  }

  loadProject(project: Project): void {
    this.clearScene();

    project.trusses.forEach(truss => this.addTruss(truss));
    project.hoistPoints.forEach(hp => this.addHoistPoint(hp));
    project.equipment.forEach(eq => this.addEquipment(eq));
    project.boundaries.forEach(boundary => this.addBoundary(boundary));
  }

  updateValidation(_validation: ValidationResult): void {
  }

  selectObject(objectId: string | null): void {
    if (this.selectedObjectId) {
      const prevObj = this.sceneObjects.get(this.selectedObjectId);
      if (prevObj) {
        this.setObjectOutline(prevObj.threeObject, false);
      }
    }

    this.selectedObjectId = objectId;

    if (objectId) {
      const obj = this.sceneObjects.get(objectId);
      if (obj) {
        this.setObjectOutline(obj.threeObject, true);
      }
    }
  }

  private setObjectOutline(object: THREE.Object3D, selected: boolean): void {
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const material = child.material as THREE.MeshStandardMaterial;
        if (material.emissive) {
          material.emissive.setHex(selected ? 0x444400 : 0x000000);
        }
      }
    });
  }

  addTruss(truss: Truss): string {
    const group = new THREE.Group();

    const boxGeometry = new THREE.BoxGeometry(truss.length, truss.height, truss.width);
    const material = new THREE.MeshStandardMaterial({
      color: truss.color,
      metalness: 0.3,
      roughness: 0.7,
      transparent: true,
      opacity: 0.8,
    });

    const trussMesh = new THREE.Mesh(boxGeometry, material);
    trussMesh.position.set(truss.position.x, truss.position.y + truss.height / 2, truss.position.z);
    trussMesh.castShadow = true;
    trussMesh.receiveShadow = true;
    group.add(trussMesh);

    const edgeGeometry = new THREE.EdgesGeometry(boxGeometry);
    const edgeMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 1 });
    const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    edges.position.copy(trussMesh.position);
    group.add(edges);

    const tubeGeometry = new THREE.CylinderGeometry(0.02, 0.02, truss.length, 8);
    const tubeMaterial = new THREE.MeshStandardMaterial({
      color: 0x888888,
      metalness: 0.6,
      roughness: 0.4,
    });

    const tubeRotations = [
      { x: 0, y: 0, z: Math.PI / 2 },
      { x: 0, y: 0, z: Math.PI / 2 },
      { x: 0, y: 0, z: Math.PI / 2 },
      { x: 0, y: 0, z: Math.PI / 2 },
    ];

    const offsets = [
      { x: truss.position.x, y: truss.position.y + truss.height, z: truss.position.z + truss.width / 2 },
      { x: truss.position.x, y: truss.position.y + truss.height, z: truss.position.z - truss.width / 2 },
      { x: truss.position.x, y: truss.position.y, z: truss.position.z + truss.width / 2 },
      { x: truss.position.x, y: truss.position.y, z: truss.position.z - truss.width / 2 },
    ];

    tubeRotations.forEach((rot, i) => {
      const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
      tube.position.copy(offsets[i]);
      tube.rotation.set(rot.x, rot.y, rot.z);
      tube.castShadow = true;
      group.add(tube);
    });

    this.scene.add(group);

    const sceneObject: SceneObject = {
      id: truss.id,
      type: 'truss',
      threeObject: group,
      data: truss,
    };
    this.sceneObjects.set(group.uuid, sceneObject);
    this.sceneObjects.set(truss.id, sceneObject);

    return truss.id;
  }

  addHoistPoint(hoistPoint: HoistPoint): string {
    const group = new THREE.Group();

    const pointGeometry = new THREE.SphereGeometry(0.15, 16, 16);
    const pointMaterial = new THREE.MeshStandardMaterial({
      color: hoistPoint.color,
      emissive: 0x222200,
      metalness: 0.5,
      roughness: 0.5,
    });
    const pointMesh = new THREE.Mesh(pointGeometry, pointMaterial);
    pointMesh.position.copy(hoistPoint.position);
    pointMesh.castShadow = true;
    group.add(pointMesh);

    const coneGeometry = new THREE.ConeGeometry(0.1, 0.3, 8);
    const coneMaterial = new THREE.MeshStandardMaterial({
      color: hoistPoint.color,
      metalness: 0.4,
      roughness: 0.6,
    });
    const cone = new THREE.Mesh(coneGeometry, coneMaterial);
    cone.position.set(hoistPoint.position.x, hoistPoint.position.y - 0.35, hoistPoint.position.z);
    cone.rotation.x = Math.PI;
    cone.castShadow = true;
    group.add(cone);

    if (hoistPoint.trussId) {
      const truss = this.sceneObjects.get(hoistPoint.trussId);
      if (truss) {
        const curve = new THREE.LineCurve3(
          new THREE.Vector3(hoistPoint.position.x, hoistPoint.position.y, hoistPoint.position.z),
          new THREE.Vector3(hoistPoint.position.x, hoistPoint.position.y - 1.5, hoistPoint.position.z)
        );
        const lineGeometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(10));
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0x666666, linewidth: 1 });
        const line = new THREE.Line(lineGeometry, lineMaterial);
        group.add(line);
      }
    }

    this.scene.add(group);

    const sceneObject: SceneObject = {
      id: hoistPoint.id,
      type: 'hoistPoint',
      threeObject: group,
      data: hoistPoint,
    };
    this.sceneObjects.set(group.uuid, sceneObject);
    this.sceneObjects.set(hoistPoint.id, sceneObject);

    return hoistPoint.id;
  }

  addEquipment(equipment: Equipment): string {
    const group = new THREE.Group();

    let geometry: THREE.BufferGeometry;
    let color = equipment.color;

    switch (equipment.type) {
      case 'light':
        geometry = new THREE.CylinderGeometry(0.15, 0.2, equipment.dimensions.y, 16);
        break;
      case 'speaker':
        geometry = new THREE.BoxGeometry(
          equipment.dimensions.x,
          equipment.dimensions.y,
          equipment.dimensions.z
        );
        break;
      case 'led':
        geometry = new THREE.BoxGeometry(
          equipment.dimensions.x,
          equipment.dimensions.y,
          equipment.dimensions.z
        );
        color = 0x333333;
        break;
      default:
        geometry = new THREE.BoxGeometry(
          equipment.dimensions.x,
          equipment.dimensions.y,
          equipment.dimensions.z
        );
    }

    const material = new THREE.MeshStandardMaterial({
      color,
      metalness: 0.3,
      roughness: 0.7,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(equipment.position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    if (equipment.type === 'light') {
      const lightGeometry = new THREE.SphereGeometry(0.08, 8, 8);
      const lightMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffaa,
        emissive: 0x444400,
      });
      const lightMesh = new THREE.Mesh(lightGeometry, lightMaterial);
      lightMesh.position.set(equipment.position.x, equipment.position.y - 0.15, equipment.position.z);
      group.add(lightMesh);
    }

    if (equipment.type === 'led') {
      const screenGeometry = new THREE.PlaneGeometry(
        equipment.dimensions.x * 0.9,
        equipment.dimensions.y * 0.9
      );
      const screenMaterial = new THREE.MeshStandardMaterial({
        color: 0x1155aa,
        emissive: 0x002244,
        side: THREE.DoubleSide,
      });
      const screen = new THREE.Mesh(screenGeometry, screenMaterial);
      screen.position.set(
        equipment.position.x,
        equipment.position.y,
        equipment.position.z + equipment.dimensions.z / 2 + 0.01
      );
      group.add(screen);
    }

    this.scene.add(group);

    const sceneObject: SceneObject = {
      id: equipment.id,
      type: 'equipment',
      threeObject: group,
      data: equipment,
    };
    this.sceneObjects.set(group.uuid, sceneObject);
    this.sceneObjects.set(equipment.id, sceneObject);

    return equipment.id;
  }

  addBoundary(boundary: StageBoundary): string {
    const group = new THREE.Group();

    if (boundary.vertices.length >= 2) {
      const points = boundary.vertices.map(v => new THREE.Vector3(v.x, v.y, v.z));
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineDashedMaterial({
        color: boundary.color,
        dashSize: 0.2,
        gapSize: 0.1,
        linewidth: 2,
      });

      const line = new THREE.LineLoop(geometry, material);
      line.computeLineDistances();
      group.add(line);

      if (boundary.vertices.length >= 4) {
        const shape = new THREE.Shape();
        shape.moveTo(boundary.vertices[0].x, boundary.vertices[0].y);
        for (let i = 1; i < boundary.vertices.length; i++) {
          shape.lineTo(boundary.vertices[i].x, boundary.vertices[i].y);
        }
        shape.closePath();

        const fillGeometry = new THREE.ShapeGeometry(shape);
        const fillMaterial = new THREE.MeshBasicMaterial({
          color: boundary.color,
          transparent: true,
          opacity: 0.15,
          side: THREE.DoubleSide,
        });

        const fillMesh = new THREE.Mesh(fillGeometry, fillMaterial);
        if (boundary.vertices[0].z === boundary.vertices[1].z) {
          fillMesh.rotation.y = Math.PI / 2;
          fillMesh.position.z = boundary.vertices[0].z;
        } else {
          fillMesh.rotation.x = -Math.PI / 2;
          fillMesh.position.y = boundary.vertices[0].y;
        }
        group.add(fillMesh);
      }
    }

    this.scene.add(group);

    const sceneObject: SceneObject = {
      id: boundary.id,
      type: 'boundary',
      threeObject: group,
      data: boundary,
    };
    this.sceneObjects.set(group.uuid, sceneObject);
    this.sceneObjects.set(boundary.id, sceneObject);

    return boundary.id;
  }

  getSelectedObjectId(): string | null {
    return this.selectedObjectId;
  }

  getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  getControls(): OrbitControls {
    return this.controls;
  }

  getRaycaster(): THREE.Raycaster {
    return this.raycaster;
  }

  getMouse(): THREE.Vector2 {
    return this.mouse;
  }

  getScene(): THREE.Scene {
    return this.scene;
  }

  getRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }

  getSceneObjects(): Map<string, SceneObject> {
    return this.sceneObjects;
  }

  setGridVisibility(visible: boolean): void {
    if (this.gridHelper) {
      this.gridHelper.visible = visible;
    }
  }

  setAxesVisibility(visible: boolean): void {
    if (this.axesHelper) {
      this.axesHelper.visible = visible;
    }
  }

  fitViewToScene(): void {
    const box = new THREE.Box3();
    
    this.sceneObjects.forEach(obj => {
      if (obj.type !== 'grid' && obj.type !== 'ground') {
        box.expandByObject(obj.threeObject);
      }
    });

    if (box.isEmpty()) {
      this.camera.position.set(10, 8, 15);
      this.controls.target.set(0, 3, 0);
    } else {
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());

      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = this.camera.fov * (Math.PI / 180);
      const cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));

      this.camera.position.set(
        center.x + cameraZ * 0.7,
        center.y + cameraZ * 0.5,
        center.z + cameraZ * 1.0
      );
      this.controls.target = center;
    }

    this.controls.update();
  }

  dispose(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }

    window.removeEventListener('resize', this.onWindowResize.bind(this));
    this.renderer.domElement.removeEventListener('click', this.onMouseClick.bind(this));
    this.renderer.domElement.removeEventListener('mousemove', this.onMouseMove.bind(this));

    this.controls.dispose();
    this.renderer.dispose();

    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
