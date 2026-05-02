import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Borehole, Layer, StratumSurface, MarkType } from '../types';
import { getSoilColor } from '../config/soilColors';

interface LayerMeshData {
  mesh: THREE.Mesh;
  layerId: string;
  boreholeId: string;
}

export class SceneManager {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;

  private boreholeGroup: THREE.Group;
  private surfaceGroup: THREE.Group;
  private waterLevelGroup: THREE.Group;
  private gridHelper: THREE.GridHelper;
  
  private layerMeshes: Map<string, LayerMeshData>;
  private selectedLayerMesh: THREE.Mesh | null;
  private onLayerSelect: ((layerId: string | null) => void) | null;

  private scaleFactor: number;

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);
    this.layerMeshes = new Map();
    this.selectedLayerMesh = null;
    this.onLayerSelect = null;
    this.scaleFactor = 1;

    const width = container.clientWidth;
    const height = container.clientHeight;

    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 10000);
    this.camera.position.set(50, 80, 50);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.screenSpacePanning = false;
    this.controls.minDistance = 10;
    this.controls.maxDistance = 500;

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.boreholeGroup = new THREE.Group();
    this.surfaceGroup = new THREE.Group();
    this.waterLevelGroup = new THREE.Group();

    this.scene.add(this.boreholeGroup);
    this.scene.add(this.surfaceGroup);
    this.scene.add(this.waterLevelGroup);

    this.gridHelper = new THREE.GridHelper(200, 20, 0x444444, 0x333333);
    this.scene.add(this.gridHelper);

    this.setupLighting();
    this.setupEventListeners(container);
    this.animate();
  }

  private setupLighting(): void {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 100, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    this.scene.add(directionalLight);

    const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x362d1f, 0.3);
    this.scene.add(hemisphereLight);
  }

  private setupEventListeners(container: HTMLElement): void {
    const onMouseMove = (event: MouseEvent) => {
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const onClick = () => {
      this.handleClick();
    };

    const onResize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    };

    container.addEventListener('mousemove', onMouseMove);
    container.addEventListener('click', onClick);
    window.addEventListener('resize', onResize);
  }

  private handleClick(): void {
    const allMeshes: THREE.Object3D[] = [];
    this.boreholeGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        allMeshes.push(obj);
      }
    });

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(allMeshes);

    if (intersects.length > 0) {
      const clickedMesh = intersects[0].object as THREE.Mesh;
      const layerId = clickedMesh.userData.layerId;
      
      if (layerId) {
        this.selectLayer(layerId);
        if (this.onLayerSelect) {
          this.onLayerSelect(layerId);
        }
      }
    } else {
      this.clearSelection();
      if (this.onLayerSelect) {
        this.onLayerSelect(null);
      }
    }
  }

  setOnLayerSelect(callback: (layerId: string | null) => void): void {
    this.onLayerSelect = callback;
  }

  clearSelection(): void {
    if (this.selectedLayerMesh) {
      const originalColor = this.selectedLayerMesh.userData.originalColor;
      if (originalColor) {
        (this.selectedLayerMesh.material as THREE.MeshStandardMaterial).color.set(originalColor);
      }
      this.selectedLayerMesh.scale.setScalar(1);
      this.selectedLayerMesh = null;
    }
  }

  selectLayer(layerId: string): void {
    this.clearSelection();
    const meshData = this.layerMeshes.get(layerId);
    if (meshData) {
      this.selectedLayerMesh = meshData.mesh;
      meshData.mesh.userData.originalColor = (meshData.mesh.material as THREE.MeshStandardMaterial).color.getHex();
      (meshData.mesh.material as THREE.MeshStandardMaterial).color.set(0x00ffff);
      meshData.mesh.scale.setScalar(1.1);
    }
  }

  updateLayerMark(layerId: string, markType: MarkType): void {
    const meshData = this.layerMeshes.get(layerId);
    if (!meshData) return;

    if (this.selectedLayerMesh === meshData.mesh) {
      return;
    }

    let colorHex: number;
    switch (markType) {
      case 'suspicious':
        colorHex = 0xffc107;
        break;
      case 'danger':
        colorHex = 0xff4757;
        break;
      case 'confirmed':
        colorHex = 0x2ed573;
        break;
      default:
        colorHex = parseInt(getSoilColor(meshData.mesh.userData.soilType).replace('#', ''), 16);
    }

    (meshData.mesh.material as THREE.MeshStandardMaterial).color.setHex(colorHex);
  }

  renderBoreholes(boreholes: Borehole[]): void {
    this.clearBoreholes();
    
    if (boreholes.length === 0) return;

    const bounds = this.calculateBounds(boreholes);
    this.scaleFactor = this.calculateScaleFactor(bounds);

    boreholes.forEach(borehole => {
      this.renderSingleBorehole(borehole);
    });

    this.adjustCamera(bounds);
  }

  private calculateBounds(boreholes: Borehole[]): {
    minX: number; maxX: number;
    minY: number; maxY: number;
    minZ: number; maxZ: number;
  } {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    boreholes.forEach(b => {
      minX = Math.min(minX, b.x);
      maxX = Math.max(maxX, b.x);
      minY = Math.min(minY, b.y);
      maxY = Math.max(maxY, b.y);
      minZ = Math.min(minZ, b.groundElevation - b.totalDepth);
      maxZ = Math.max(maxZ, b.groundElevation);
    });

    return { minX, maxX, minY, maxY, minZ, maxZ };
  }

  private calculateScaleFactor(bounds: {
    minX: number; maxX: number;
    minY: number; maxY: number;
    minZ: number; maxZ: number;
  }): number {
    const dx = bounds.maxX - bounds.minX;
    const dy = bounds.maxY - bounds.minY;
    const dz = bounds.maxZ - bounds.minZ;
    
    const maxDim = Math.max(dx, dy, dz, 10);
    return 20 / maxDim;
  }

  private adjustCamera(bounds: {
    minX: number; maxX: number;
    minY: number; maxY: number;
    minZ: number; maxZ: number;
  }): void {
    const centerX = (bounds.minX + bounds.maxX) / 2 * this.scaleFactor;
    const centerY = (bounds.minZ + bounds.maxZ) / 2 * this.scaleFactor;
    const centerZ = (bounds.minY + bounds.maxY) / 2 * this.scaleFactor;

    const size = Math.max(
      (bounds.maxX - bounds.minX) * this.scaleFactor,
      (bounds.maxY - bounds.minY) * this.scaleFactor,
      (bounds.maxZ - bounds.minZ) * this.scaleFactor
    );

    this.controls.target.set(centerX, centerY, centerZ);
    this.camera.position.set(
      centerX + size,
      centerY + size * 1.2,
      centerZ + size
    );
    this.controls.update();
  }

  private renderSingleBorehole(borehole: Borehole): void {
    const x = borehole.x * this.scaleFactor;
    const z = borehole.y * this.scaleFactor;
    const baseElevation = borehole.groundElevation * this.scaleFactor;

    const boreholeGroup = new THREE.Group();
    boreholeGroup.name = `borehole_${borehole.id}`;

    borehole.layers.forEach(layer => {
      const mesh = this.createLayerMesh(layer, x, z, baseElevation);
      boreholeGroup.add(mesh);
      
      this.layerMeshes.set(layer.id, {
        mesh,
        layerId: layer.id,
        boreholeId: borehole.id,
      });
    });

    this.boreholeGroup.add(boreholeGroup);

    if (borehole.waterLevel !== undefined) {
      this.addWaterLevelIndicator(borehole, x, z, baseElevation);
    }

    this.addBoreholeLabel(borehole, x, z, baseElevation);
  }

  private createLayerMesh(
    layer: Layer,
    x: number,
    z: number,
    baseElevation: number
  ): THREE.Mesh {
    const topDepth = layer.topDepth * this.scaleFactor;
    const bottomDepth = layer.bottomDepth * this.scaleFactor;
    const thickness = bottomDepth - topDepth;
    const radius = 0.8;

    const geometry = new THREE.CylinderGeometry(radius, radius, thickness, 8);
    const color = getSoilColor(layer.soilType);
    
    const material = new THREE.MeshStandardMaterial({
      color: parseInt(color.replace('#', ''), 16),
      metalness: 0.1,
      roughness: 0.8,
      transparent: true,
      opacity: 0.9,
    });

    const mesh = new THREE.Mesh(geometry, material);
    
    const centerY = baseElevation - topDepth - thickness / 2;
    mesh.position.set(x, centerY, z);
    
    mesh.userData.layerId = layer.id;
    mesh.userData.soilType = layer.soilType;
    mesh.userData.boreholeId = layer.boreholeId;

    const edges = new THREE.EdgesGeometry(geometry);
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1 });
    const wireframe = new THREE.LineSegments(edges, lineMaterial);
    wireframe.position.copy(mesh.position);
    this.boreholeGroup.add(wireframe);

    return mesh;
  }

  private addWaterLevelIndicator(
    borehole: Borehole,
    x: number,
    z: number,
    baseElevation: number
  ): void {
    if (borehole.waterLevel === undefined) return;

    const waterY = baseElevation - borehole.waterLevel * this.scaleFactor;
    const radius = 2;

    const geometry = new THREE.RingGeometry(radius - 0.1, radius, 16);
    const material = new THREE.MeshBasicMaterial({
      color: 0x4169e1,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, waterY, z);
    mesh.name = `water_${borehole.id}`;

    this.waterLevelGroup.add(mesh);
  }

  private addBoreholeLabel(
    borehole: Borehole,
    x: number,
    z: number,
    baseElevation: number
  ): void {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return;

    canvas.width = 256;
    canvas.height = 64;
    context.fillStyle = 'rgba(233, 69, 96, 0.9)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.font = 'bold 32px Arial';
    context.fillStyle = 'white';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(borehole.id, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(material);
    
    sprite.position.set(x, baseElevation + 5, z);
    sprite.scale.set(8, 2, 1);
    sprite.name = `label_${borehole.id}`;

    this.boreholeGroup.add(sprite);
  }

  renderSurfaces(surfaces: StratumSurface[]): void {
    this.clearSurfaces();

    surfaces.forEach(surface => {
      this.renderSingleSurface(surface);
    });
  }

  private renderSingleSurface(surface: StratumSurface): void {
    if (surface.points.length < 3 || surface.triangles.length === 0) return;

    const geometry = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const indices: number[] = [];

    surface.points.forEach(point => {
      vertices.push(
        point.x * this.scaleFactor,
        point.elevation * this.scaleFactor,
        point.y * this.scaleFactor
      );
    });

    surface.triangles.forEach(tri => {
      indices.push(...tri.indices);
    });

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    const color = getSoilColor(surface.soilType);
    const material = new THREE.MeshStandardMaterial({
      color: parseInt(color.replace('#', ''), 16),
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6,
      metalness: 0.1,
      roughness: 0.8,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `surface_${surface.id}`;
    this.surfaceGroup.add(mesh);

    const edges = new THREE.EdgesGeometry(geometry);
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1, transparent: true, opacity: 0.3 });
    const wireframe = new THREE.LineSegments(edges, lineMaterial);
    wireframe.name = `surface_wire_${surface.id}`;
    this.surfaceGroup.add(wireframe);
  }

  clearBoreholes(): void {
    while (this.boreholeGroup.children.length > 0) {
      const child = this.boreholeGroup.children[0];
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
      this.boreholeGroup.remove(child);
    }
    this.layerMeshes.clear();
    this.selectedLayerMesh = null;
  }

  clearSurfaces(): void {
    while (this.surfaceGroup.children.length > 0) {
      const child = this.surfaceGroup.children[0];
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
      this.surfaceGroup.remove(child);
    }
  }

  toggleBoreholes(visible: boolean): void {
    this.boreholeGroup.visible = visible;
  }

  toggleSurfaces(visible: boolean): void {
    this.surfaceGroup.visible = visible;
  }

  toggleWaterLevel(visible: boolean): void {
    this.waterLevelGroup.visible = visible;
  }

  toggleGrid(visible: boolean): void {
    this.gridHelper.visible = visible;
  }

  resetView(): void {
    this.controls.reset();
  }

  private animate(): void {
    requestAnimationFrame(() => this.animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.renderer.dispose();
  }
}
