import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { YardConfig, PathWaypoint, PathPlan, ValidationError, ValidationWarning, PathAnimationState } from '../types';
import { lerp } from '../utils/geometry';

type OnClickHandler = (position: THREE.Vector3 | null, object: THREE.Object3D | null) => void;
type OnDragHandler = (waypointId: string, position: THREE.Vector3) => void;

export class YardScene {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;

  private yardGroup: THREE.Group;
  private pathGroup: THREE.Group;
  private markersGroup: THREE.Group;

  private groundPlane: THREE.Mesh | null = null;
  private slotMeshes: Map<string, THREE.Mesh> = new Map();
  private forbiddenZoneMeshes: Map<string, THREE.Mesh> = new Map();
  private waypointMeshes: Map<string, THREE.Mesh> = new Map();
  private pathLine: THREE.Line | null = null;
  private forkliftMesh: THREE.Group | null = null;

  private animationId: number = 0;
  private animationState: PathAnimationState = {
    isPlaying: false,
    currentSegment: 0,
    progress: 0,
    speed: 1
  };

  private currentPlan: PathPlan | null = null;
  private onClickHandler: OnClickHandler | null = null;
  private onDragHandler: OnDragHandler | null = null;
  private selectedWaypoint: string | null = null;
  private isDragging: boolean = false;
  private dragPlane: THREE.Plane;

  private drawMode: boolean = false;

  constructor(container: HTMLElement) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);
    this.scene.fog = new THREE.Fog(0x1a1a2e, 50, 150);

    this.camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    this.camera.position.set(40, 50, 40);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 10;
    this.controls.maxDistance = 150;
    this.controls.maxPolarAngle = Math.PI / 2.1;

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.yardGroup = new THREE.Group();
    this.pathGroup = new THREE.Group();
    this.markersGroup = new THREE.Group();
    this.scene.add(this.yardGroup, this.pathGroup, this.markersGroup);

    this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    this.setupLights();
    this.setupEventListeners();
    this.animate();
  }

  private setupLights(): void {
    const ambientLight = new THREE.AmbientLight(0x404060, 0.6);
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

    const hemisphereLight = new THREE.HemisphereLight(0x606080, 0x404020, 0.4);
    this.scene.add(hemisphereLight);
  }

  private setupEventListeners(): void {
    this.renderer.domElement.addEventListener('mousedown', this.onMouseDown);
    this.renderer.domElement.addEventListener('mousemove', this.onMouseMove);
    this.renderer.domElement.addEventListener('mouseup', this.onMouseUp);
    this.renderer.domElement.addEventListener('click', this.onClick);
    window.addEventListener('resize', this.onResize);
  }

  private onMouseDown = (e: MouseEvent): void => {
    if (!this.drawMode) return;
    
    const result = this.intersectGround(e);
    if (!result) return;

    const waypointResult = this.intersectWaypoint(e);
    if (waypointResult) {
      this.selectedWaypoint = waypointResult.id;
      this.isDragging = true;
      this.controls.enabled = false;
    }
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (this.isDragging && this.selectedWaypoint) {
      const rect = this.container.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersection = new THREE.Vector3();
      this.raycaster.ray.intersectPlane(this.dragPlane, intersection);
      
      if (intersection && this.onDragHandler) {
        this.onDragHandler(this.selectedWaypoint, intersection);
      }
    }
  };

  private onMouseUp = (): void => {
    this.isDragging = false;
    this.selectedWaypoint = null;
    this.controls.enabled = true;
  };

  private onClick = (e: MouseEvent): void => {
    if (!this.onClickHandler) return;

    const rect = this.container.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    const waypointResult = this.intersectWaypoint(e);
    if (waypointResult) {
      this.onClickHandler(waypointResult.position, waypointResult.object);
      return;
    }

    const groundPos = this.intersectGround(e);
    this.onClickHandler(groundPos, null);
  };

  private intersectGround(e: MouseEvent): THREE.Vector3 | null {
    const rect = this.container.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersection = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(this.dragPlane, intersection);
    
    return intersection;
  }

  private intersectWaypoint(e: MouseEvent): { id: string; position: THREE.Vector3; object: THREE.Object3D } | null {
    const rect = this.container.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    const waypointObjects = Array.from(this.waypointMeshes.values());
    const intersects = this.raycaster.intersectObjects(waypointObjects, true);
    
    if (intersects.length > 0) {
      const obj = intersects[0].object;
      let parent = obj.parent;
      while (parent && !Array.from(this.waypointMeshes.values()).includes(parent as THREE.Mesh)) {
        parent = parent.parent;
      }
      
      if (parent) {
        for (const [id, mesh] of this.waypointMeshes) {
          if (mesh === parent) {
            return {
              id,
              position: mesh.position.clone(),
              object: mesh
            };
          }
        }
      }
    }
    
    return null;
  }

  private onResize = (): void => {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);
    this.controls.update();

    if (this.animationState.isPlaying && this.currentPlan) {
      this.updateForkliftAnimation();
    }

    this.renderer.render(this.scene, this.camera);
  };

  private updateForkliftAnimation(): void {
    if (!this.currentPlan || !this.forkliftMesh) return;

    const { segments, waypoints } = this.currentPlan;
    if (segments.length === 0 || waypoints.length < 2) return;

    this.animationState.progress += this.animationState.speed * 0.02;

    while (this.animationState.progress >= 1) {
      this.animationState.progress -= 1;
      this.animationState.currentSegment++;
      
      if (this.animationState.currentSegment >= segments.length) {
        this.animationState.isPlaying = false;
        this.animationState.currentSegment = 0;
        return;
      }
    }

    const segment = segments[this.animationState.currentSegment];
    const from = waypoints.find(w => w.id === segment.from);
    const to = waypoints.find(w => w.id === segment.to);
    
    if (from && to) {
      const pos = lerp(from.position, to.position, this.animationState.progress);
      this.forkliftMesh.position.set(pos.x, pos.y, pos.z);

      const dir = new THREE.Vector3(
        to.position.x - from.position.x,
        0,
        to.position.z - from.position.z
      );
      if (dir.length() > 0.001) {
        this.forkliftMesh.lookAt(
          this.forkliftMesh.position.x + dir.x,
          this.forkliftMesh.position.y,
          this.forkliftMesh.position.z + dir.z
        );
      }
    }
  }

  setOnClickHandler(handler: OnClickHandler | null): void {
    this.onClickHandler = handler;
  }

  setOnDragHandler(handler: OnDragHandler | null): void {
    this.onDragHandler = handler;
  }

  setDrawMode(enabled: boolean): void {
    this.drawMode = enabled;
  }

  setYard(config: YardConfig): void {
    while (this.yardGroup.children.length > 0) {
      const child = this.yardGroup.children[0];
      this.yardGroup.remove(child);
    }
    this.slotMeshes.clear();
    this.forbiddenZoneMeshes.clear();

    if (this.groundPlane) {
      this.scene.remove(this.groundPlane);
      this.groundPlane.geometry.dispose();
      (this.groundPlane.material as THREE.Material).dispose();
    }

    const groundGeometry = new THREE.PlaneGeometry(config.width, config.length);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x2d3436,
      roughness: 0.9,
      metalness: 0.1
    });
    this.groundPlane = new THREE.Mesh(groundGeometry, groundMaterial);
    this.groundPlane.rotation.x = -Math.PI / 2;
    this.groundPlane.receiveShadow = true;
    this.scene.add(this.groundPlane);

    const gridHelper = new THREE.GridHelper(
      Math.max(config.width, config.length),
      20,
      0x4a5568,
      0x2d3748
    );
    gridHelper.position.y = 0.01;
    this.yardGroup.add(gridHelper);

    const boundaryGeometry = new THREE.BoxGeometry(config.width, 0.3, config.length);
    const boundaryEdges = new THREE.EdgesGeometry(boundaryGeometry);
    const boundaryLine = new THREE.LineSegments(
      boundaryEdges,
      new THREE.LineBasicMaterial({ color: 0x667eea, linewidth: 2 })
    );
    boundaryLine.position.y = 0.15;
    this.yardGroup.add(boundaryLine);

    config.slots.forEach(slot => {
      const geometry = new THREE.BoxGeometry(slot.width, slot.height, slot.length);
      const material = new THREE.MeshStandardMaterial({
        color: slot.occupied ? 0xe17055 : 0x00b894,
        transparent: true,
        opacity: slot.occupied ? 0.8 : 0.5,
        roughness: 0.7,
        metalness: 0.2
      });
      
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(slot.position.x, slot.position.y, slot.position.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { slotId: slot.id };
      
      const edges = new THREE.EdgesGeometry(geometry);
      const edgeLine = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({ color: 0x2d3436, linewidth: 1 })
      );
      mesh.add(edgeLine);
      
      this.yardGroup.add(mesh);
      this.slotMeshes.set(slot.id, mesh);
    });

    config.forbiddenZones.forEach(zone => {
      const geometry = new THREE.BoxGeometry(zone.width, zone.height, zone.length);
      const material = new THREE.MeshStandardMaterial({
        color: 0xd63031,
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide
      });
      
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(zone.position.x, zone.position.y, zone.position.z);
      mesh.userData = { zoneId: zone.id };
      
      const edges = new THREE.EdgesGeometry(geometry);
      const edgeLine = new THREE.LineSegments(
        edges,
        new THREE.LineDashedMaterial({ color: 0xd63031, dashSize: 0.5, gapSize: 0.3 })
      );
      mesh.add(edgeLine);
      
      this.yardGroup.add(mesh);
      this.forbiddenZoneMeshes.set(zone.id, mesh);
    });
  }

  setPath(plan: PathPlan | null): void {
    this.currentPlan = plan;
    this.animationState.currentSegment = 0;
    this.animationState.progress = 0;
    
    while (this.pathGroup.children.length > 0) {
      const child = this.pathGroup.children[0];
      this.pathGroup.remove(child);
    }
    this.waypointMeshes.clear();

    if (!plan || plan.waypoints.length === 0) return;

    const points = plan.waypoints.map(wp => 
      new THREE.Vector3(wp.position.x, wp.position.y + 0.1, wp.position.z)
    );
    
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ 
      color: 0x0984e3, 
      linewidth: 3 
    });
    this.pathLine = new THREE.Line(geometry, material);
    this.pathGroup.add(this.pathLine);

    plan.waypoints.forEach((wp, index) => {
      const waypointGroup = this.createWaypoint(wp, index, plan.waypoints.length);
      this.pathGroup.add(waypointGroup);
      this.waypointMeshes.set(wp.id, waypointGroup);
    });

    this.createForklift();
  }

  private createWaypoint(wp: PathWaypoint, index: number, total: number): THREE.Mesh {
    let color = 0x74b9ff;
    if (wp.type === 'start') color = 0x00b894;
    else if (wp.type === 'end') color = 0xe17055;

    const group = new THREE.Group();

    const sphereGeometry = new THREE.SphereGeometry(0.6, 16, 16);
    const sphereMaterial = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.3,
      metalness: 0.8,
      roughness: 0.2
    });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    sphere.position.set(wp.position.x, wp.position.y + 0.6, wp.position.z);
    sphere.castShadow = true;
    group.add(sphere);

    const ringGeometry = new THREE.RingGeometry(0.8, 1.0, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({ 
      color, 
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(wp.position.x, 0.05, wp.position.z);
    group.add(ring);

    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.arc(32, 32, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(index + 1), 32, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const labelMaterial = new THREE.SpriteMaterial({ 
      map: texture,
      transparent: true
    });
    const label = new THREE.Sprite(labelMaterial);
    label.position.set(wp.position.x, wp.position.y + 2, wp.position.z);
    label.scale.set(2, 2, 1);
    group.add(label);

    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1.2, 8, 8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    mesh.position.set(wp.position.x, wp.position.y + 0.6, wp.position.z);
    group.add(mesh);

    (group as any).position = sphere.position;
    return group as unknown as THREE.Mesh;
  }

  private createForklift(): void {
    if (this.forkliftMesh) {
      this.scene.remove(this.forkliftMesh);
    }

    const forklift = new THREE.Group();

    const bodyGeometry = new THREE.BoxGeometry(2, 1.2, 3);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0xfdcb6e,
      metalness: 0.6,
      roughness: 0.3
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.8;
    body.castShadow = true;
    forklift.add(body);

    const wheelGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 16);
    const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x2d3436 });
    
    const wheelPositions = [
      [-0.9, 0.4, -1.2], [0.9, 0.4, -1.2],
      [-0.9, 0.4, 1.2], [0.9, 0.4, 1.2]
    ];
    
    wheelPositions.forEach(pos => {
      const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(pos[0], pos[1], pos[2]);
      wheel.castShadow = true;
      forklift.add(wheel);
    });

    const cabinGeometry = new THREE.BoxGeometry(1.2, 1, 1.2);
    const cabinMaterial = new THREE.MeshStandardMaterial({
      color: 0x74b9ff,
      transparent: true,
      opacity: 0.7
    });
    const cabin = new THREE.Mesh(cabinGeometry, cabinMaterial);
    cabin.position.set(0, 1.9, -0.5);
    cabin.castShadow = true;
    forklift.add(cabin);

    const mastGeometry = new THREE.BoxGeometry(0.2, 2, 0.8);
    const mastMaterial = new THREE.MeshStandardMaterial({
      color: 0x636e72,
      metalness: 0.8,
      roughness: 0.2
    });
    const mast = new THREE.Mesh(mastGeometry, mastMaterial);
    mast.position.set(0, 1.5, 1.4);
    mast.castShadow = true;
    forklift.add(mast);

    const forkGeometry = new THREE.BoxGeometry(0.8, 0.15, 1.2);
    const forkMaterial = new THREE.MeshStandardMaterial({
      color: 0xb2bec3,
      metalness: 0.9,
      roughness: 0.1
    });
    const fork = new THREE.Mesh(forkGeometry, forkMaterial);
    fork.position.set(0, 0.5, 2);
    fork.castShadow = true;
    forklift.add(fork);

    this.forkliftMesh = forklift;
    this.scene.add(forklift);

    if (this.currentPlan && this.currentPlan.waypoints.length > 0) {
      const start = this.currentPlan.waypoints[0];
      forklift.position.set(start.position.x, 0, start.position.z);
    }
  }

  updateWaypointPosition(waypointId: string, position: THREE.Vector3): void {
    const mesh = this.waypointMeshes.get(waypointId);
    if (mesh) {
      mesh.position.set(position.x, position.y + 0.6, position.z);
    }
  }

  highlightErrors(errors: ValidationError[], warnings: ValidationWarning[]): void {
    while (this.markersGroup.children.length > 0) {
      const child = this.markersGroup.children[0];
      this.markersGroup.remove(child);
    }

    errors.forEach(error => {
      if (error.position) {
        this.createErrorMarker(error.position, 0xd63031);
      }
    });

    warnings.forEach(warning => {
      if (warning.position) {
        this.createErrorMarker(warning.position, 0xfdcb6e);
      }
    });
  }

  private createErrorMarker(position: { x: number; y: number; z: number }, color: number): void {
    const group = new THREE.Group();
    
    const geometry = new THREE.ConeGeometry(0.5, 1.5, 4);
    const material = new THREE.MeshStandardMaterial({
      color,
      transparent: true,
      opacity: 0.8,
      emissive: color,
      emissiveIntensity: 0.4
    });
    const cone = new THREE.Mesh(geometry, material);
    cone.position.set(position.x, position.y + 3, position.z);
    cone.rotation.x = Math.PI;
    group.add(cone);

    const ringGeometry = new THREE.RingGeometry(0.5, 0.8, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({ 
      color, 
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.5
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(position.x, position.y + 0.1, position.z);
    group.add(ring);

    this.markersGroup.add(group);
  }

  playAnimation(speed: number = 1): void {
    if (!this.currentPlan || this.currentPlan.segments.length === 0) return;
    
    this.animationState.isPlaying = true;
    this.animationState.speed = speed;
    this.animationState.currentSegment = 0;
    this.animationState.progress = 0;

    if (this.forkliftMesh && this.currentPlan.waypoints.length > 0) {
      const start = this.currentPlan.waypoints[0];
      this.forkliftMesh.position.set(start.position.x, 0, start.position.z);
    }
  }

  pauseAnimation(): void {
    this.animationState.isPlaying = false;
  }

  stopAnimation(): void {
    this.animationState.isPlaying = false;
    this.animationState.currentSegment = 0;
    this.animationState.progress = 0;
    
    if (this.forkliftMesh && this.currentPlan && this.currentPlan.waypoints.length > 0) {
      const start = this.currentPlan.waypoints[0];
      this.forkliftMesh.position.set(start.position.x, 0, start.position.z);
    }
  }

  getAnimationState(): PathAnimationState {
    return { ...this.animationState };
  }

  dispose(): void {
    cancelAnimationFrame(this.animationId);
    this.renderer.domElement.removeEventListener('mousedown', this.onMouseDown);
    this.renderer.domElement.removeEventListener('mousemove', this.onMouseMove);
    this.renderer.domElement.removeEventListener('mouseup', this.onMouseUp);
    this.renderer.domElement.removeEventListener('click', this.onClick);
    window.removeEventListener('resize', this.onResize);
    this.controls.dispose();
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
  }
}
