import * as THREE from 'three';
import { SceneManager, SceneObject } from './SceneManager';
import { Equipment, Vector3 } from '../models';
import { createVector3 } from '../models';

export interface DragStartEvent {
  objectId: string;
  objectType: string;
  startPosition: Vector3;
}

export interface DragMoveEvent {
  objectId: string;
  objectType: string;
  currentPosition: Vector3;
  delta: Vector3;
}

export interface DragEndEvent {
  objectId: string;
  objectType: string;
  startPosition: Vector3;
  endPosition: Vector3;
  hasMoved: boolean;
}

export class InteractiveControls {
  private sceneManager: SceneManager;
  private container: HTMLElement;
  
  private isDragging: boolean = false;
  private draggedObjectId: string | null = null;
  private draggedObjectType: string | null = null;
  private dragStartPosition: THREE.Vector3 = new THREE.Vector3();
  private dragStartScreenPosition: { x: number; y: number } = { x: 0, y: 0 };
  
  private dragPlane: THREE.Plane;
  private dragPlaneNormal: THREE.Vector3 = new THREE.Vector3(0, 1, 0);
  
  private onDragStart?: (event: DragStartEvent) => void;
  private onDragMove?: (event: DragMoveEvent) => void;
  private onDragEnd?: (event: DragEndEvent) => void;
  
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  
  private isEnabled: boolean = true;
  private snapToGrid: boolean = true;
  private gridSize: number = 0.1;
  private restrictY: boolean = true;

  constructor(sceneManager: SceneManager) {
    this.sceneManager = sceneManager;
    this.container = sceneManager.getRenderer().domElement;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.container.addEventListener('mousedown', this.onMouseDown.bind(this));
    this.container.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.container.addEventListener('mouseup', this.onMouseUp.bind(this));
    this.container.addEventListener('mouseleave', this.onMouseUp.bind(this));
    
    this.container.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
    this.container.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
    this.container.addEventListener('touchend', this.onTouchEnd.bind(this));
  }

  private updateMousePosition(clientX: number, clientY: number): void {
    const rect = this.container.getBoundingClientRect();
    this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  }

  private onMouseDown(event: MouseEvent): void {
    if (!this.isEnabled) return;
    if (event.button !== 0) return;
    
    this.updateMousePosition(event.clientX, event.clientY);
    this.handlePointerDown(event.clientX, event.clientY);
  }

  private onMouseMove(event: MouseEvent): void {
    if (!this.isEnabled) return;
    
    this.updateMousePosition(event.clientX, event.clientY);
    this.handlePointerMove(event.clientX, event.clientY);
  }

  private onMouseUp(_event: MouseEvent): void {
    if (!this.isEnabled) return;
    this.handlePointerUp();
  }

  private onTouchStart(event: TouchEvent): void {
    if (!this.isEnabled) return;
    event.preventDefault();
    
    const touch = event.touches[0];
    this.updateMousePosition(touch.clientX, touch.clientY);
    this.handlePointerDown(touch.clientX, touch.clientY);
  }

  private onTouchMove(event: TouchEvent): void {
    if (!this.isEnabled) return;
    event.preventDefault();
    
    const touch = event.touches[0];
    this.updateMousePosition(touch.clientX, touch.clientY);
    this.handlePointerMove(touch.clientX, touch.clientY);
  }

  private onTouchEnd(_event: TouchEvent): void {
    if (!this.isEnabled) return;
    this.handlePointerUp();
  }

  private handlePointerDown(clientX: number, clientY: number): void {
    const camera = this.sceneManager.getCamera();
    const sceneObjects = this.sceneManager.getSceneObjects();
    
    const selectableObjects: THREE.Object3D[] = [];
    sceneObjects.forEach(obj => {
      if (obj.type === 'equipment' || obj.type === 'truss') {
        selectableObjects.push(obj.threeObject);
      }
    });

    this.raycaster.setFromCamera(this.mouse, camera);
    const intersects = this.raycaster.intersectObjects(selectableObjects, true);

    if (intersects.length > 0) {
      let clickedObject = intersects[0].object;
      let sceneObj: SceneObject | undefined;
      
      while (clickedObject.parent) {
        sceneObj = sceneObjects.get(clickedObject.uuid);
        if (sceneObj) break;
        clickedObject = clickedObject.parent;
      }
      
      if (!sceneObj && clickedObject) {
        sceneObj = sceneObjects.get(clickedObject.uuid);
      }

      if (sceneObj && (sceneObj.type === 'equipment' || sceneObj.type === 'truss')) {
        this.isDragging = true;
        this.draggedObjectId = sceneObj.id;
        this.draggedObjectType = sceneObj.type;
        
        const worldPosition = new THREE.Vector3();
        sceneObj.threeObject.getWorldPosition(worldPosition);
        this.dragStartPosition.copy(worldPosition);
        this.dragStartScreenPosition = { x: clientX, y: clientY };
        
        const cameraPosition = camera.position;
        const objectPosition = worldPosition.clone();
        const viewDirection = objectPosition.clone().sub(cameraPosition).normalize();
        
        if (this.restrictY && sceneObj.type === 'equipment') {
          this.dragPlaneNormal.set(0, 1, 0);
          this.dragPlane = new THREE.Plane(this.dragPlaneNormal, -objectPosition.y);
        } else {
          this.dragPlaneNormal.copy(viewDirection).negate();
          this.dragPlane = new THREE.Plane(this.dragPlaneNormal, -viewDirection.dot(objectPosition));
        }

        if (this.onDragStart) {
          this.onDragStart({
            objectId: sceneObj.id,
            objectType: sceneObj.type,
            startPosition: {
              x: worldPosition.x,
              y: worldPosition.y,
              z: worldPosition.z,
            },
          });
        }

        const controls = this.sceneManager.getControls();
        controls.enabled = false;
      }
    }
  }

  private handlePointerMove(_clientX: number, _clientY: number): void {
    if (!this.isDragging || !this.draggedObjectId) return;

    const camera = this.sceneManager.getCamera();
    const sceneObjects = this.sceneManager.getSceneObjects();
    const sceneObj = sceneObjects.get(this.draggedObjectId);
    
    if (!sceneObj) return;

    this.raycaster.setFromCamera(this.mouse, camera);
    const intersection = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(this.dragPlane, intersection);

    if (!intersection) return;

    let newPosition = intersection.clone();
    
    if (this.snapToGrid) {
      newPosition.x = Math.round(newPosition.x / this.gridSize) * this.gridSize;
      newPosition.z = Math.round(newPosition.z / this.gridSize) * this.gridSize;
      if (!this.restrictY) {
        newPosition.y = Math.round(newPosition.y / this.gridSize) * this.gridSize;
      }
    }

    if (this.restrictY && sceneObj.type === 'equipment') {
      newPosition.y = this.dragStartPosition.y;
    }

    const currentWorldPosition = new THREE.Vector3();
    sceneObj.threeObject.getWorldPosition(currentWorldPosition);

    const delta = new THREE.Vector3().subVectors(newPosition, currentWorldPosition);
    
    sceneObj.threeObject.position.add(delta);

    if (this.onDragMove) {
      this.onDragMove({
        objectId: this.draggedObjectId,
        objectType: this.draggedObjectType || '',
        currentPosition: {
          x: newPosition.x,
          y: newPosition.y,
          z: newPosition.z,
        },
        delta: {
          x: delta.x,
          y: delta.y,
          z: delta.z,
        },
      });
    }
  }

  private handlePointerUp(): void {
    if (!this.isDragging || !this.draggedObjectId) return;

    const sceneObjects = this.sceneManager.getSceneObjects();
    const sceneObj = sceneObjects.get(this.draggedObjectId);
    
    if (sceneObj && this.onDragEnd) {
      const endWorldPosition = new THREE.Vector3();
      sceneObj.threeObject.getWorldPosition(endWorldPosition);

      const hasMoved = !this.dragStartPosition.equals(endWorldPosition);

      this.onDragEnd({
        objectId: this.draggedObjectId,
        objectType: this.draggedObjectType || '',
        startPosition: {
          x: this.dragStartPosition.x,
          y: this.dragStartPosition.y,
          z: this.dragStartPosition.z,
        },
        endPosition: {
          x: endWorldPosition.x,
          y: endWorldPosition.y,
          z: endWorldPosition.z,
        },
        hasMoved,
      });
    }

    const controls = this.sceneManager.getControls();
    controls.enabled = true;

    this.isDragging = false;
    this.draggedObjectId = null;
    this.draggedObjectType = null;
  }

  setOnDragStart(callback: (event: DragStartEvent) => void): void {
    this.onDragStart = callback;
  }

  setOnDragMove(callback: (event: DragMoveEvent) => void): void {
    this.onDragMove = callback;
  }

  setOnDragEnd(callback: (event: DragEndEvent) => void): void {
    this.onDragEnd = callback;
  }

  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  isEnabled(): boolean {
    return this.isEnabled;
  }

  setSnapToGrid(enabled: boolean): void {
    this.snapToGrid = enabled;
  }

  getSnapToGrid(): boolean {
    return this.snapToGrid;
  }

  setGridSize(size: number): void {
    this.gridSize = Math.max(0.01, size);
  }

  getGridSize(): number {
    return this.gridSize;
  }

  setRestrictY(enabled: boolean): void {
    this.restrictY = enabled;
  }

  getRestrictY(): boolean {
    return this.restrictY;
  }

  isDraggingObject(): boolean {
    return this.isDragging;
  }

  getDraggedObjectId(): string | null {
    return this.draggedObjectId;
  }

  updateObjectPosition(objectId: string, position: Vector3): void {
    const sceneObjects = this.sceneManager.getSceneObjects();
    const sceneObj = sceneObjects.get(objectId);
    
    if (sceneObj) {
      sceneObj.threeObject.position.set(position.x, position.y, position.z);
    }
  }

  dispose(): void {
    this.container.removeEventListener('mousedown', this.onMouseDown.bind(this));
    this.container.removeEventListener('mousemove', this.onMouseMove.bind(this));
    this.container.removeEventListener('mouseup', this.onMouseUp.bind(this));
    this.container.removeEventListener('mouseleave', this.onMouseUp.bind(this));
    
    this.container.removeEventListener('touchstart', this.onTouchStart.bind(this));
    this.container.removeEventListener('touchmove', this.onTouchMove.bind(this));
    this.container.removeEventListener('touchend', this.onTouchEnd.bind(this));
  }
}

export function createInteractiveControls(sceneManager: SceneManager): InteractiveControls {
  return new InteractiveControls(sceneManager);
}
