
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ModelElement, CollisionPoint, Point3D } from '../types/model';
import { ElementChange } from '../types/version';
import { floorDimensions, elevationMarkers } from '../data/sampleModels';

export class SceneManager {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private container: HTMLElement;
  
  private elementMeshes: Map<string, THREE.Group> = new Map();
  private collisionMarkers: Map<string, THREE.Mesh> = new Map();
  private gridHelper: THREE.GridHelper | null = null;
  private axesHelper: THREE.AxesHelper | null = null;
  private elevationPlanes: THREE.Mesh[] = [];
  private animationId: number | null = null;
  private autoRotate: boolean = false;
  private wireframeMode: boolean = false;

  private onElementSelect: ((id: string | null) => void) | null = null;
  private onCollisionSelect: ((id: string | null) => void) | null = null;
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;

  constructor(container: HTMLElement) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0F172A');
    
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    
    this.camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    this.camera.position.set(25, 20, 25);
    
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);
    
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.target.set(0, 3, 0);
    
    this.setupLights();
    this.setupGrid();
    this.setupAxes();
    this.setupElevationPlanes();
    this.setupEventListeners();
    this.animate();
  }

  private setupLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(20, 30, 20);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    this.scene.add(directionalLight);

    const hemisphereLight = new THREE.HemisphereLight(0x87CEEB, 0x362d1f, 0.4);
    this.scene.add(hemisphereLight);
  }

  private setupGrid() {
    this.gridHelper = new THREE.GridHelper(
      floorDimensions.width,
      30,
      0x334155,
      0x1e293b
    );
    this.scene.add(this.gridHelper);
  }

  private setupAxes() {
    this.axesHelper = new THREE.AxesHelper(5);
    this.scene.add(this.axesHelper);
  }

  private setupElevationPlanes() {
    elevationMarkers.forEach(elevation => {
      const geometry = new THREE.PlaneGeometry(floorDimensions.width, floorDimensions.depth);
      const material = new THREE.MeshBasicMaterial({
        color: 0x3b82f6,
        transparent: true,
        opacity: 0.03,
        side: THREE.DoubleSide
      });
      const plane = new THREE.Mesh(geometry, material);
      plane.rotation.x = -Math.PI / 2;
      plane.position.y = elevation;
      plane.userData.elevation = elevation;
      this.elevationPlanes.push(plane);
      this.scene.add(plane);
    });
  }

  private setupEventListeners() {
    window.addEventListener('resize', this.onResize.bind(this));
    this.renderer.domElement.addEventListener('click', this.onClick.bind(this));
  }

  private onResize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    
    if (this.camera instanceof THREE.PerspectiveCamera) {
      this.camera.aspect = width / height;
    } else {
      const aspect = width / height;
      const frustumSize = 50;
      this.camera.left = -frustumSize * aspect / 2;
      this.camera.right = frustumSize * aspect / 2;
      this.camera.top = frustumSize / 2;
      this.camera.bottom = -frustumSize / 2;
    }
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private onClick(event: MouseEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    const allMeshes: THREE.Object3D[] = [];
    this.elementMeshes.forEach(group => {
      group.traverse(child => {
        if (child instanceof THREE.Mesh) {
          allMeshes.push(child);
        }
      });
    });
    
    const intersects = this.raycaster.intersectObjects(allMeshes);
    
    if (intersects.length > 0) {
      let selectedId: string | null = null;
      for (const intersect of intersects) {
        let obj: THREE.Object3D | null = intersect.object;
        while (obj) {
          if (obj.userData.elementId) {
            selectedId = obj.userData.elementId;
            break;
          }
          obj = obj.parent;
        }
        if (selectedId) break;
      }
      
      if (this.onElementSelect) {
        this.onElementSelect(selectedId);
      }
    } else {
      if (this.onElementSelect) {
        this.onElementSelect(null);
      }
    }
  }

  private animate() {
    this.animationId = requestAnimationFrame(this.animate.bind(this));
    
    if (this.autoRotate) {
      this.controls.autoRotate = true;
      this.controls.autoRotateSpeed = 0.5;
    } else {
      this.controls.autoRotate = false;
    }
    
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  setOnElementSelect(callback: (id: string | null) => void) {
    this.onElementSelect = callback;
  }

  setOnCollisionSelect(callback: (id: string | null) => void) {
    this.onCollisionSelect = callback;
  }

  loadElements(elements: ModelElement[]) {
    this.clearElements();
    
    elements.forEach(element => {
      const group = this.createElementMesh(element);
      this.elementMeshes.set(element.id, group);
      this.scene.add(group);
    });
  }

  private createElementMesh(element: ModelElement): THREE.Group {
    const group = new THREE.Group();
    group.userData.elementId = element.id;
    group.userData.element = element;

    const color = new THREE.Color(element.color);

    if (element.type === 'duct' || element.type === 'cable_tray') {
      const tubeGeometry = this.createRectangularTube(element.points, element.radius * 2);
      const material = new THREE.MeshPhongMaterial({
        color,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
        wireframe: this.wireframeMode
      });
      const mesh = new THREE.Mesh(tubeGeometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.elementId = element.id;
      group.add(mesh);

      const edges = new THREE.EdgesGeometry(tubeGeometry);
      const lineMaterial = new THREE.LineBasicMaterial({ color, linewidth: 2 });
      const line = new THREE.LineSegments(edges, lineMaterial);
      group.add(line);
    } else {
      const curve = new THREE.CatmullRomCurve3(
        element.points.map(p => new THREE.Vector3(p.x, p.y, p.z))
      );
      const tubeGeometry = new THREE.TubeGeometry(curve, 64, element.radius, 12, false);
      const material = new THREE.MeshPhongMaterial({
        color,
        transparent: true,
        opacity: 0.8,
        wireframe: this.wireframeMode
      });
      const mesh = new THREE.Mesh(tubeGeometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.elementId = element.id;
      group.add(mesh);
    }

    return group;
  }

  private createRectangularTube(points: Point3D[], width: number): THREE.BufferGeometry {
    const vertices: number[] = [];
    const indices: number[] = [];
    const halfWidth = width / 2;
    const height = width * 0.6;
    const halfHeight = height / 2;

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = new THREE.Vector3(points[i].x, points[i].y, points[i].z);
      const p2 = new THREE.Vector3(points[i + 1].x, points[i + 1].y, points[i + 1].z);
      const direction = new THREE.Vector3().subVectors(p2, p1).normalize();
      
      let up = new THREE.Vector3(0, 1, 0);
      if (Math.abs(direction.y) > 0.9) {
        up = new THREE.Vector3(1, 0, 0);
      }
      const right = new THREE.Vector3().crossVectors(up, direction).normalize();
      const actualUp = new THREE.Vector3().crossVectors(direction, right).normalize();

      const cornerOffset = [
        new THREE.Vector3().addScaledVector(right, -halfWidth).addScaledVector(actualUp, halfHeight),
        new THREE.Vector3().addScaledVector(right, halfWidth).addScaledVector(actualUp, halfHeight),
        new THREE.Vector3().addScaledVector(right, halfWidth).addScaledVector(actualUp, -halfHeight),
        new THREE.Vector3().addScaledVector(right, -halfWidth).addScaledVector(actualUp, -halfHeight)
      ];

      const baseIndex = i * 8;
      
      cornerOffset.forEach(offset => {
        const v = new THREE.Vector3().addVectors(p1, offset);
        vertices.push(v.x, v.y, v.z);
      });
      cornerOffset.forEach(offset => {
        const v = new THREE.Vector3().addVectors(p2, offset);
        vertices.push(v.x, v.y, v.z);
      });

      const faces = [
        [0, 1, 5], [0, 5, 4],
        [1, 2, 6], [1, 6, 5],
        [2, 3, 7], [2, 7, 6],
        [3, 0, 4], [3, 4, 7],
        [0, 3, 2], [0, 2, 1],
        [4, 5, 6], [4, 6, 7]
      ];

      faces.forEach(face => {
        indices.push(baseIndex + face[0], baseIndex + face[1], baseIndex + face[2]);
      });
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    
    return geometry;
  }

  private clearElements() {
    this.elementMeshes.forEach(group => {
      this.scene.remove(group);
      group.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    });
    this.elementMeshes.clear();
  }

  loadCollisions(collisions: CollisionPoint[]) {
    this.clearCollisions();
    
    collisions.forEach(collision => {
      const marker = this.createCollisionMarker(collision);
      this.collisionMarkers.set(collision.id, marker);
      this.scene.add(marker);
    });
  }

  private createCollisionMarker(collision: CollisionPoint): THREE.Mesh {
    const geometry = new THREE.SphereGeometry(0.3, 16, 16);
    const color = collision.type === 'hard' ? 0xFF7D00 : 0xFFAA00;
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: collision.resolved ? 0.2 : 0.8
    });
    const marker = new THREE.Mesh(geometry, material);
    marker.position.set(collision.position.x, collision.position.y, collision.position.z);
    marker.userData.collisionId = collision.id;
    
    return marker;
  }

  private clearCollisions() {
    this.collisionMarkers.forEach(marker => {
      this.scene.remove(marker);
      marker.geometry.dispose();
      (marker.material as THREE.Material).dispose();
    });
    this.collisionMarkers.clear();
  }

  highlightElement(elementId: string | null) {
    this.elementMeshes.forEach((group, id) => {
      group.traverse(child => {
        if (child instanceof THREE.Mesh) {
          const material = child.material as THREE.MeshPhongMaterial;
          if (id === elementId) {
            material.emissive = new THREE.Color(0xffff00);
            material.emissiveIntensity = 0.3;
          } else {
            material.emissive = new THREE.Color(0x000000);
            material.emissiveIntensity = 0;
          }
        }
      });
    });
  }

  focusOnCollision(collision: CollisionPoint) {
    const target = new THREE.Vector3(
      collision.position.x,
      collision.position.y,
      collision.position.z
    );
    
    const offset = new THREE.Vector3(8, 6, 8);
    const newPosition = new THREE.Vector3().addVectors(target, offset);
    
    this.camera.position.copy(newPosition);
    this.controls.target.copy(target);
    this.controls.update();
  }

  setCameraPosition(position: Point3D, target: Point3D) {
    this.camera.position.set(position.x, position.y, position.z);
    this.controls.target.set(target.x, target.y, target.z);
    this.controls.update();
  }

  setOrthographic(orthographic: boolean) {
    const position = this.camera.position.clone();
    const target = this.controls.target.clone();
    
    if (orthographic && this.camera instanceof THREE.PerspectiveCamera) {
      const aspect = this.container.clientWidth / this.container.clientHeight;
      const frustumSize = 50;
      this.camera = new THREE.OrthographicCamera(
        -frustumSize * aspect / 2,
        frustumSize * aspect / 2,
        frustumSize / 2,
        -frustumSize / 2,
        0.1,
        1000
      );
    } else if (!orthographic && this.camera instanceof THREE.OrthographicCamera) {
      this.camera = new THREE.PerspectiveCamera(
        60,
        this.container.clientWidth / this.container.clientHeight,
        0.1,
        1000
      );
    }
    
    this.camera.position.copy(position);
    this.controls.object = this.camera;
    this.controls.target.copy(target);
    this.controls.update();
  }

  setShowGrid(show: boolean) {
    if (this.gridHelper) {
      this.gridHelper.visible = show;
    }
  }

  setShowAxes(show: boolean) {
    if (this.axesHelper) {
      this.axesHelper.visible = show;
    }
  }

  setShowElevationLines(show: boolean) {
    this.elevationPlanes.forEach(plane => {
      plane.visible = show;
    });
  }

  setWireframeMode(wireframe: boolean) {
    this.wireframeMode = wireframe;
    this.elementMeshes.forEach(group => {
      group.traverse(child => {
        if (child instanceof THREE.Mesh) {
          const material = child.material as THREE.MeshPhongMaterial;
          material.wireframe = wireframe;
        }
      });
    });
  }

  setAutoRotate(auto: boolean) {
    this.autoRotate = auto;
  }

  resetCamera() {
    this.camera.position.set(25, 20, 25);
    this.controls.target.set(0, 3, 0);
    this.controls.update();
  }

  applyDiffHighlight(changes: ElementChange[]) {
    const changeMap = new Map<string, ElementChange>();
    changes.forEach(change => {
      changeMap.set(change.elementId, change);
    });

    this.elementMeshes.forEach((group, elementId) => {
      const change = changeMap.get(elementId);
      if (change) {
        let color: THREE.Color;
        switch (change.type) {
          case 'added':
            color = new THREE.Color('#00B42A');
            break;
          case 'removed':
            color = new THREE.Color('#F53F3F');
            break;
          case 'modified':
            color = new THREE.Color('#FF7D00');
            break;
          default:
            const element = group.userData.element as ModelElement;
            color = new THREE.Color(element.color);
        }
        
        group.traverse(child => {
          if (child instanceof THREE.Mesh) {
            const material = child.material as THREE.MeshPhongMaterial;
            if (!material.userData.originalColor) {
              material.userData.originalColor = material.color.clone();
            }
            material.color.copy(color);
            
            if (change.type !== 'unchanged') {
              material.emissive = color.clone();
              material.emissiveIntensity = 0.2;
            } else {
              material.emissive = new THREE.Color(0x000000);
              material.emissiveIntensity = 0;
            }
          }
          if (child instanceof THREE.LineSegments) {
            const lineMaterial = child.material as THREE.LineBasicMaterial;
            lineMaterial.color.copy(color);
          }
        });
      }
    });
  }

  clearDiffHighlight() {
    this.elementMeshes.forEach((group) => {
      group.traverse(child => {
        if (child instanceof THREE.Mesh) {
          const material = child.material as THREE.MeshPhongMaterial;
          if (material.userData.originalColor) {
            material.color.copy(material.userData.originalColor);
          }
          material.emissive = new THREE.Color(0x000000);
          material.emissiveIntensity = 0;
        }
        const element = group.userData.element as ModelElement;
        if (element && child instanceof THREE.LineSegments) {
          const lineMaterial = child.material as THREE.LineBasicMaterial;
          lineMaterial.color = new THREE.Color(element.color);
        }
      });
    });
  }

  getCameraState() {
    return {
      position: {
        x: this.camera.position.x,
        y: this.camera.position.y,
        z: this.camera.position.z
      },
      target: {
        x: this.controls.target.x,
        y: this.controls.target.y,
        z: this.controls.target.z
      }
    };
  }

  setCameraState(state: { position: Point3D; target: Point3D }) {
    this.camera.position.set(state.position.x, state.position.y, state.position.z);
    this.controls.target.set(state.target.x, state.target.y, state.target.z);
    this.controls.update();
  }

  onCameraChange(callback: () => void) {
    this.controls.addEventListener('change', callback);
  }

  getRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }

  getScene(): THREE.Scene {
    return this.scene;
  }

  getCamera(): THREE.Camera {
    return this.camera;
  }

  dispose() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    
    this.clearElements();
    this.clearCollisions();
    
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
    
    window.removeEventListener('resize', this.onResize.bind(this));
  }
}
