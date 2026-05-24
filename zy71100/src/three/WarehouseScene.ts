import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Warehouse, Shelf, Aisle, PickingOrder, HeatmapCell } from '../data/types';

export class WarehouseScene {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private container: HTMLElement;
  private animationId: number | null = null;

  private shelfMeshes: THREE.InstancedMesh | null = null;
  private pathLines: THREE.Line[] = [];
  private vehicleMarkers: THREE.Mesh[] = [];
  private heatmapMesh: THREE.Mesh | null = null;
  private groundGrid: THREE.GridHelper | null = null;
  private aisleMarkers: THREE.Mesh[] = [];

  private warehouse: Warehouse;
  private shelves: Shelf[];
  private aisles: Aisle[];
  private orders: PickingOrder[];

  constructor(container: HTMLElement, warehouse: Warehouse, shelves: Shelf[], aisles: Aisle[], orders: PickingOrder[]) {
    this.container = container;
    this.warehouse = warehouse;
    this.shelves = shelves;
    this.aisles = aisles;
    this.orders = orders;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0f172a);
    this.scene.fog = new THREE.Fog(0x0f172a, 100, 200);

    this.camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    this.camera.position.set(60, 50, 80);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2.1;
    this.controls.minDistance = 20;
    this.controls.maxDistance = 150;
    this.controls.target.set(warehouse.width / 2, 0, warehouse.depth / 2);

    this.setupLighting();
    this.createGround();
    this.createWarehouseBounds();
    this.createShelves();
    this.createAisleMarkers();

    window.addEventListener('resize', this.onResize);
  }

  private setupLighting() {
    const ambientLight = new THREE.AmbientLight(0x404060, 0.6);
    this.scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1);
    mainLight.position.set(50, 80, 50);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 500;
    mainLight.shadow.camera.left = -50;
    mainLight.shadow.camera.right = 100;
    mainLight.shadow.camera.top = 100;
    mainLight.shadow.camera.bottom = -50;
    this.scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0x6080ff, 0.3);
    fillLight.position.set(-30, 40, -30);
    this.scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xff8060, 0.2);
    rimLight.position.set(80, 30, 80);
    this.scene.add(rimLight);
  }

  private createGround() {
    const groundGeometry = new THREE.PlaneGeometry(this.warehouse.width + 20, this.warehouse.depth + 20);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.9,
      metalness: 0.1,
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(this.warehouse.width / 2, -0.01, this.warehouse.depth / 2);
    ground.receiveShadow = true;
    this.scene.add(ground);

    this.groundGrid = new THREE.GridHelper(
      this.warehouse.width + 20,
      (this.warehouse.width + 20) / 2,
      0x334155,
      0x1e293b
    );
    this.groundGrid.position.set(this.warehouse.width / 2, 0.01, this.warehouse.depth / 2);
    this.scene.add(this.groundGrid);
  }

  private createWarehouseBounds() {
    const points: THREE.Vector3[] = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(this.warehouse.width, 0, 0),
      new THREE.Vector3(this.warehouse.width, 0, this.warehouse.depth),
      new THREE.Vector3(0, 0, this.warehouse.depth),
      new THREE.Vector3(0, 0, 0),
    ];

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0x475569, linewidth: 2 });
    const boundary = new THREE.Line(geometry, material);
    this.scene.add(boundary);
  }

  private createShelves() {
    const shelfGeometry = new THREE.BoxGeometry(1, 1, 1);
    const shelfMaterial = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.7,
      metalness: 0.3,
    });

    const count = this.shelves.length * 5;
    this.shelfMeshes = new THREE.InstancedMesh(shelfGeometry, shelfMaterial, count);
    this.shelfMeshes.castShadow = true;
    this.shelfMeshes.receiveShadow = true;

    const dummy = new THREE.Object3D();
    let index = 0;

    for (const shelf of this.shelves) {
      for (let level = 0; level < shelf.levels; level++) {
        dummy.position.set(
          shelf.x,
          shelf.y + level * (shelf.height / shelf.levels) + shelf.height / shelf.levels / 2,
          shelf.z
        );
        dummy.scale.set(shelf.width, shelf.height / shelf.levels - 0.1, shelf.depth);
        dummy.updateMatrix();
        this.shelfMeshes.setMatrixAt(index, dummy.matrix);
        this.shelfMeshes.setColorAt(index, new THREE.Color(level % 2 === 0 ? 0x64748b : 0x475569));
        index++;
      }
    }

    this.shelfMeshes.instanceMatrix.needsUpdate = true;
    this.scene.add(this.shelfMeshes);
  }

  private createAisleMarkers() {
    for (const aisle of this.aisles) {
      const length = aisle.orientation === 'z'
        ? Math.abs(aisle.z2 - aisle.z1)
        : Math.abs(aisle.x2 - aisle.x1);

      const geometry = new THREE.BoxGeometry(
        aisle.orientation === 'z' ? aisle.width : length,
        0.05,
        aisle.orientation === 'z' ? length : aisle.width
      );

      const material = new THREE.MeshStandardMaterial({
        color: aisle.isNarrow ? 0x7c3aed : 0x0ea5e9,
        transparent: true,
        opacity: 0.3,
      });

      const marker = new THREE.Mesh(geometry, material);
      marker.position.set(
        (aisle.x1 + aisle.x2) / 2,
        0.02,
        (aisle.z1 + aisle.z2) / 2
      );
      marker.receiveShadow = true;
      this.aisleMarkers.push(marker);
      this.scene.add(marker);
    }
  }

  public updatePaths(selectedOrders: string[], currentTime: number, showPaths: boolean) {
    for (const line of this.pathLines) {
      this.scene.remove(line);
      line.geometry.dispose();
    }
    this.pathLines = [];

    for (const marker of this.vehicleMarkers) {
      this.scene.remove(marker);
      marker.geometry.dispose();
    }
    this.vehicleMarkers = [];

    if (!showPaths) return;

    const ordersToShow = selectedOrders.length === 0
      ? this.orders
      : this.orders.filter(o => selectedOrders.includes(o.id));

    for (const order of ordersToShow) {
      const visiblePoints = order.path.filter(p => p.timestamp <= currentTime);
      if (visiblePoints.length < 2) continue;

      const points = visiblePoints.map(p => new THREE.Vector3(p.x, p.y, p.z));
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({
        color: new THREE.Color(order.color),
        linewidth: 2,
        transparent: true,
        opacity: 0.8,
      });
      const line = new THREE.Line(geometry, material);
      this.pathLines.push(line);
      this.scene.add(line);

      if (visiblePoints.length > 0) {
        const lastPoint = visiblePoints[visiblePoints.length - 1];
        const markerGeometry = new THREE.ConeGeometry(0.5, 1.5, 8);
        const markerMaterial = new THREE.MeshStandardMaterial({
          color: new THREE.Color(order.color),
          emissive: new THREE.Color(order.color),
          emissiveIntensity: 0.5,
        });
        const marker = new THREE.Mesh(markerGeometry, markerMaterial);
        marker.position.set(lastPoint.x, lastPoint.y + 1, lastPoint.z);
        marker.rotation.x = Math.PI;
        marker.castShadow = true;
        this.vehicleMarkers.push(marker);
        this.scene.add(marker);
      }
    }
  }

  public updateHeatmap(heatmapData: HeatmapCell[], showHeatmap: boolean, maxValue: number) {
    if (this.heatmapMesh) {
      this.scene.remove(this.heatmapMesh);
      this.heatmapMesh.geometry.dispose();
      (this.heatmapMesh.material as THREE.Material).dispose();
      this.heatmapMesh = null;
    }

    if (!showHeatmap || heatmapData.length === 0) return;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const scaleX = canvas.width / this.warehouse.width;
    const scaleZ = canvas.height / this.warehouse.depth;

    for (const cell of heatmapData) {
      const intensity = Math.min(cell.value / maxValue, 1);
      const radius = 20 + intensity * 40;

      const gradient = ctx.createRadialGradient(
        cell.x * scaleX,
        cell.z * scaleZ,
        0,
        cell.x * scaleX,
        cell.z * scaleZ,
        radius
      );

      const color = this.getHeatColor(intensity);
      gradient.addColorStop(0, color.replace(')', `, ${intensity * 0.8})`).replace('rgb', 'rgba'));
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(cell.x * scaleX, cell.z * scaleZ, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    const geometry = new THREE.PlaneGeometry(this.warehouse.width, this.warehouse.depth);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    });

    this.heatmapMesh = new THREE.Mesh(geometry, material);
    this.heatmapMesh.rotation.x = -Math.PI / 2;
    this.heatmapMesh.position.set(this.warehouse.width / 2, 0.1, this.warehouse.depth / 2);
    this.scene.add(this.heatmapMesh);
  }

  private getHeatColor(value: number): string {
    if (value < 0.25) {
      const t = value / 0.25;
      return this.interpolateColor('rgb(30, 64, 175)', 'rgb(8, 145, 178)', t);
    } else if (value < 0.5) {
      const t = (value - 0.25) / 0.25;
      return this.interpolateColor('rgb(8, 145, 178)', 'rgb(5, 150, 105)', t);
    } else if (value < 0.75) {
      const t = (value - 0.5) / 0.25;
      return this.interpolateColor('rgb(5, 150, 105)', 'rgb(217, 119, 6)', t);
    } else {
      const t = (value - 0.75) / 0.25;
      return this.interpolateColor('rgb(217, 119, 6)', 'rgb(220, 38, 38)', t);
    }
  }

  private interpolateColor(c1: string, c2: string, t: number): string {
    const r1 = parseInt(c1.match(/\d+/)?.[0] || '0');
    const g1 = parseInt(c1.match(/\d+,\s*(\d+)/)?.[1] || '0');
    const b1 = parseInt(c1.match(/\d+,\s*\d+,\s*(\d+)/)?.[1] || '0');

    const r2 = parseInt(c2.match(/\d+/)?.[0] || '0');
    const g2 = parseInt(c2.match(/\d+,\s*(\d+)/)?.[1] || '0');
    const b2 = parseInt(c2.match(/\d+,\s*\d+,\s*(\d+)/)?.[1] || '0');

    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);

    return `rgb(${r}, ${g}, ${b})`;
  }

  public setShelvesVisible(visible: boolean) {
    if (this.shelfMeshes) {
      this.shelfMeshes.visible = visible;
    }
  }

  public setCameraPosition(position: [number, number, number], target: [number, number, number]) {
    this.camera.position.set(...position);
    this.controls.target.set(...target);
    this.controls.update();
  }

  public getCameraState(): { position: [number, number, number]; target: [number, number, number] } {
    return {
      position: [this.camera.position.x, this.camera.position.y, this.camera.position.z],
      target: [this.controls.target.x, this.controls.target.y, this.controls.target.z],
    };
  }

  public getCanvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  public startAnimation(callback?: () => void) {
    const animate = () => {
      this.animationId = requestAnimationFrame(animate);
      this.controls.update();

      for (let i = 0; i < this.vehicleMarkers.length; i++) {
        this.vehicleMarkers[i].rotation.z += 0.02;
      }

      if (callback) callback();
      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }

  public stopAnimation() {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  private onResize = () => {
    this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
  };

  public dispose() {
    this.stopAnimation();
    window.removeEventListener('resize', this.onResize);
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
  }
}
