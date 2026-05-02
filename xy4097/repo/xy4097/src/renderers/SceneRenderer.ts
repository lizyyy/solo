import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ExhibitionConfig, ExhibitionElement, HeatZone, RiskLevel } from '../types';
import { 
  createElementMesh, 
  createFloor, 
  createGrid, 
  VisualElement,
  updateElementPosition,
  highlightElement,
  createVisitorMarker
} from './ObjectFactory';
import { createHeatmap, HeatmapMesh, updateHeatmap, disposeHeatmap } from './HeatmapRenderer';

export interface SceneRendererOptions {
  containerId: string;
  gridSize: number;
}

export type ElementDragEvent = {
  element: ExhibitionElement;
  oldPosition: { x: number; z: number };
  newPosition: { x: number; z: number };
};

export type ElementSelectEvent = {
  element: ExhibitionElement | null;
};

export type ClickEvent = {
  element: ExhibitionElement | null;
  position: { x: number; z: number } | null;
};

export class SceneRenderer {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private container: HTMLElement;
  private gridSize: number;
  
  private visualElements: Map<string, VisualElement> = new Map();
  private floor: THREE.Mesh | null = null;
  private gridGroup: THREE.Group | null = null;
  private heatmapMesh: HeatmapMesh | null = null;
  private visitorMarkers: Map<string, THREE.Mesh> = new Map();
  
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  private isDragging: boolean = false;
  private draggedElement: VisualElement | null = null;
  private dragStartPosition: { x: number; z: number } | null = null;
  
  private onElementDrag: ((event: ElementDragEvent) => void) | null = null;
  private onElementSelect: ((event: ElementSelectEvent) => void = () => {};
  private onFloorClick: ((event: ClickEvent) => void) | null = null;
  
  private selectedElement: string | null = null;
  private animationFrameId: number | null = null;
  
  constructor(options: SceneRendererOptions) {
    this.container = document.getElementById(options.containerId) || document.body;
    this.gridSize = options.gridSize;
    
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);
    this.scene.fog = new THREE.Fog(0x1a1a2e, 50, 150);
    
    const aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
    this.camera.position.set(15, 15, 15);
    
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.screenSpacePanning = false;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 50;
    this.controls.maxPolarAngle = Math.PI / 2.1;
    
    this.setupLights();
    this.setupEventListeners();
    
    this.container.appendChild(this.renderer.domElement);
    this.animate();
  }
  
  private setupLights(): void {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
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
    
    const hemisphereLight = new THREE.HemisphereLight(0x87CEEB, 0x3d5c5c, 0.3);
    this.scene.add(hemisphereLight);
  }
  
  private setupEventListeners(): void {
    window.addEventListener('resize', this.onWindowResize.bind(this));
    
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown.bind(this));
    this.renderer.domElement.addEventListener('pointermove', this.onPointerMove.bind(this));
    this.renderer.domElement.addEventListener('pointerup', this.onPointerUp.bind(this));
    this.renderer.domElement.addEventListener('pointerleave', this.onPointerUp.bind(this));
  }
  
  private onWindowResize(): void {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    
    this.renderer.setSize(width, height);
  }
  
  private updateMouse(event: PointerEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = (event.clientX - rect.left) / rect.width * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height * 2 - 1);
  }
  
  private getIntersectingElements(): THREE.Intersection[] {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    const meshes: THREE.Object3D[] = [];
    this.visualElements.forEach(ve => meshes.push(ve.group));
    
    return this.raycaster.intersectObjects(meshes, true);
  }
  
  private getFloorIntersection(): THREE.Intersection | null {
    if (!this.floor) return null;
    
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObject(this.floor);
    
    return intersects.length > 0 ? intersects[0] : null;
  }
  
  private onPointerDown(event: PointerEvent): void {
    this.updateMouse(event);
    
    const intersects = this.getIntersectingElements();
    
    if (intersects.length > 0) {
      const intersect = intersects[0];
      let element: ExhibitionElement | null = null;
      
      if (intersect.object.userData?.element) {
        element = intersect.object.userData.element as ExhibitionElement;
      } else {
        let parent: THREE.Object3D | null = intersect.object.parent;
        while (parent) {
          if (parent.userData?.element) {
            element = parent.userData.element as ExhibitionElement;
            break;
          }
          parent = parent.parent;
        }
      }
      
      if (element && element.type === 'exhibit') {
        const visualElement = this.visualElements.get(element.id);
        if (visualElement) {
          this.isDragging = true;
          this.draggedElement = visualElement;
          this.dragStartPosition = { x: element.position.x, z: element.position.z };
          
          this.controls.enabled = false;
          this.selectElement(element.id);
          return;
        }
      }
      
      if (element) {
        this.selectElement(element.id);
      } else {
        this.selectElement(null);
      }
    } else {
      const floorIntersect = this.getFloorIntersection();
      if (floorIntersect) {
        this.selectElement(null);
        if (this.onFloorClick) {
          this.onFloorClick({
            element: null,
            position: {
              x: floorIntersect.point.x,
              z: floorIntersect.point.z,
            },
          });
        }
      }
    }
  }
  
  private onPointerMove(event: PointerEvent): void {
    if (!this.isDragging || !this.draggedElement) {
      return;
    }
    
    this.updateMouse(event);
    
    const floorIntersect = this.getFloorIntersection();
    if (!floorIntersect) return;
    
    const newX = Math.round(floorIntersect.point.x / this.gridSize) * this.gridSize;
    const newZ = Math.round(floorIntersect.point.z / this.gridSize) * this.gridSize;
    
    updateElementPosition(this.draggedElement, { x: newX, z: newZ });
  }
  
  private onPointerUp(): void {
    if (this.isDragging && this.draggedElement && this.dragStartPosition) {
      const element = this.draggedElement.element;
      const newPosition = { x: element.position.x, z: element.position.z };
      
      if (newPosition.x !== this.dragStartPosition.x || 
          newPosition.z !== this.dragStartPosition.z) {
        if (this.onElementDrag) {
          this.onElementDrag({
            element: element,
            oldPosition: this.dragStartPosition,
            newPosition: newPosition,
          });
        }
      }
    }
    
    this.isDragging = false;
    this.draggedElement = null;
    this.dragStartPosition = null;
    this.controls.enabled = true;
  }
  
  private selectElement(elementId: string | null): void {
    if (this.selectedElement) {
      const oldElement = this.visualElements.get(this.selectedElement);
      if (oldElement) {
        highlightElement(oldElement, false);
      }
    }
    
    this.selectedElement = elementId;
    
    if (elementId) {
      const element = this.visualElements.get(elementId);
      if (element) {
        highlightElement(element, true);
      }
    }
    
    const selectedVisualElement = elementId ? this.visualElements.get(elementId) : null;
    this.onElementSelect({
      element: selectedVisualElement?.element || null,
    });
  }
  
  setOnElementDrag(callback: (event: ElementDragEvent) => void): void {
    this.onElementDrag = callback;
  }
  
  setOnElementSelect(callback: (event: ElementSelectEvent) => void): void {
    this.onElementSelect = callback;
  }
  
  setOnFloorClick(callback: (event: ClickEvent) => void): void {
    this.onFloorClick = callback;
  }
  
  loadConfig(config: ExhibitionConfig): void {
    this.clearScene();
    
    this.floor = createFloor(config.floor.width, config.floor.depth);
    this.scene.add(this.floor);
    
    this.gridGroup = createGrid(config.floor.width, config.floor.depth, this.gridSize);
    this.scene.add(this.gridGroup);
    
    for (const element of config.elements) {
      const visualElement = createElementMesh(element);
      this.visualElements.set(element.id, visualElement);
      this.scene.add(visualElement.group);
    }
    
    this.camera.position.set(
      config.floor.width * 0.8,
      Math.max(config.floor.width, config.floor.depth) * 0.6,
      config.floor.depth * 0.8
    );
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }
  
  private clearScene(): void {
    this.visualElements.forEach(ve => {
      this.scene.remove(ve.group);
      ve.group.traverse((child) => {
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
    this.visualElements.clear();
    
    if (this.floor) {
      this.scene.remove(this.floor);
      this.floor.geometry.dispose();
      if (Array.isArray(this.floor.material)) {
        this.floor.material.forEach(m => m.dispose());
      } else {
        this.floor.material.dispose();
      }
      this.floor = null;
    }
    
    if (this.gridGroup) {
      this.scene.remove(this.gridGroup);
      this.gridGroup = null;
    }
    
    this.clearHeatmap();
    this.clearVisitorMarkers();
    
    this.selectedElement = null;
  }
  
  updateHeatmap(heatZones: HeatZone[], maxDensity: number): void {
    if (!this.heatmapMesh) {
      this.heatmapMesh = createHeatmap(heatZones, this.gridSize, maxDensity);
      this.scene.add(this.heatmapMesh.group);
    } else {
      updateHeatmap(this.heatmapMesh, heatZones, this.gridSize, maxDensity);
    }
  }
  
  clearHeatmap(): void {
    if (this.heatmapMesh) {
      this.scene.remove(this.heatmapMesh.group);
      disposeHeatmap(this.heatmapMesh);
      this.heatmapMesh = null;
    }
  }
  
  updateVisitorPositions(visitors: Array<{ id: string; x: number; z: number }>): void {
    const existingIds = new Set(this.visitorMarkers.keys());
    
    for (const visitor of visitors) {
      existingIds.delete(visitor.id);
      
      let marker = this.visitorMarkers.get(visitor.id);
      if (!marker) {
        marker = createVisitorMarker();
        this.visitorMarkers.set(visitor.id, marker);
        this.scene.add(marker);
      }
      
      marker.position.set(visitor.x, 0.3, visitor.z);
    }
    
    for (const id of existingIds) {
      const marker = this.visitorMarkers.get(id);
      if (marker) {
        this.scene.remove(marker);
        marker.geometry.dispose();
        if (Array.isArray(marker.material)) {
          marker.material.forEach(m => m.dispose());
        } else {
          marker.material.dispose();
        }
        this.visitorMarkers.delete(id);
      }
    }
  }
  
  clearVisitorMarkers(): void {
    for (const [id, marker] of this.visitorMarkers) {
      this.scene.remove(marker);
      marker.geometry.dispose();
      if (Array.isArray(marker.material)) {
        marker.material.forEach(m => m.dispose());
      } else {
        marker.material.dispose();
      }
    }
    this.visitorMarkers.clear();
  }
  
  takeScreenshot(): string {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }
  
  getScene(): THREE.Scene {
    return this.scene;
  }
  
  getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }
  
  getRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }
  
  getControls(): OrbitControls {
    return this.controls;
  }
  
  private animate(): void {
    this.animationFrameId = requestAnimationFrame(this.animate.bind(this));
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
  
  dispose(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    
    window.removeEventListener('resize', this.onWindowResize.bind(this));
    
    this.clearScene();
    
    this.renderer.dispose();
  }
}
