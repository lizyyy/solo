import * as THREE from 'three';
import type { Plan, BoothObject, Vector3D } from '../models/types';
import { SceneManager } from '../renderer/SceneManager';
import { roundToGrid, snapAngleTo90, normalizeAngle } from '../utils/geometry';

type EditMode = 'select' | 'move' | 'rotate' | 'scale';
type SnapMode = 'grid' | 'free';

export interface EditEvent {
  type: 'select' | 'move' | 'rotate' | 'scale' | 'delete' | 'deselect';
  objectId?: string;
  object?: BoothObject;
}

export interface EditEventListener {
  (event: EditEvent): void;
}

export class InteractionManager {
  private sceneManager: SceneManager;
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  private plane: THREE.Plane;
  
  private editMode: EditMode = 'select';
  private snapMode: SnapMode = 'grid';
  private gridSize: number = 0.5;
  
  private selectedObjectId: string | null = null;
  private isDragging: boolean = false;
  private dragStart: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 };
  private initialPosition: Vector3D = { x: 0, y: 0, z: 0 };
  private initialRotation: number = 0;
  private initialDimensions: Vector3D = { x: 0, y: 0, z: 0 };
  
  private currentPlan: Plan | null = null;
  private listeners: EditEventListener[] = [];
  
  private moveArrow: THREE.ArrowHelper | null = null;
  private rotationCircle: THREE.Mesh | null = null;
  
  constructor(sceneManager: SceneManager) {
    this.sceneManager = sceneManager;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    
    this.setupEventListeners();
  }
  
  public setPlan(plan: Plan): void {
    this.currentPlan = plan;
    this.gridSize = plan.floor.gridSize;
  }
  
  public addEventListener(listener: EditEventListener): void {
    this.listeners.push(listener);
  }
  
  public removeEventListener(listener: EditEventListener): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }
  
  private fireEvent(event: EditEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
  
  private setupEventListeners(): void {
    const canvas = this.sceneManager.renderer.domElement;
    
    canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
    canvas.addEventListener('wheel', (e) => this.onWheel(e));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    
    document.addEventListener('keydown', (e) => this.onKeyDown(e));
  }
  
  private getMousePosition(event: MouseEvent): { x: number; y: number } {
    const canvas = this.sceneManager.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    
    return {
      x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
      y: -((event.clientY - rect.top) / rect.height) * 2 + 1,
    };
  }
  
  private onMouseDown(event: MouseEvent): void {
    if (event.button === 2) {
      this.deselectAll();
      return;
    }
    
    const pos = this.getMousePosition(event);
    this.mouse.set(pos.x, pos.y);
    
    const intersects = this.raycast();
    
    if (intersects.length > 0) {
      const obj = intersects[0].object;
      const objectId = this.findObjectIdFromMesh(obj);
      
      if (objectId) {
        if (this.selectedObjectId !== objectId) {
          this.selectObject(objectId);
        }
        
        const intersection = intersects[0];
        this.dragStart = {
          x: intersection.point.x,
          y: intersection.point.y,
          z: intersection.point.z,
        };
        
        const selectedObj = this.getSelectedObject();
        if (selectedObj) {
          this.initialPosition = { ...selectedObj.position };
          this.initialRotation = selectedObj.rotation;
          this.initialDimensions = { ...selectedObj.dimensions };
        }
        
        this.isDragging = true;
        this.sceneManager.controls.enabled = false;
      }
    } else if (!event.shiftKey) {
      this.deselectAll();
    }
  }
  
  private onMouseMove(event: MouseEvent): void {
    const pos = this.getMousePosition(event);
    this.mouse.set(pos.x, pos.y);
    
    if (this.isDragging && this.selectedObjectId && this.currentPlan) {
      const obj = this.currentPlan.objects.find(o => o.id === this.selectedObjectId);
      if (!obj) return;
      
      if (this.editMode === 'move' || this.editMode === 'select') {
        this.handleMove(event);
      } else if (this.editMode === 'rotate') {
        this.handleRotate(event);
      } else if (this.editMode === 'scale') {
        this.handleScale(event);
      }
    }
  }
  
  private handleMove(event: MouseEvent): void {
    const obj = this.getSelectedObject();
    if (!obj) return;
    
    const camera = this.sceneManager.camera;
    
    this.raycaster.setFromCamera(this.mouse, camera);
    const targetPoint = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(this.plane, targetPoint);
    
    if (targetPoint) {
      let newX = this.initialPosition.x + (targetPoint.x - this.dragStart.x);
      let newZ = this.initialPosition.z + (targetPoint.z - this.dragStart.z);
      
      if (this.snapMode === 'grid') {
        newX = roundToGrid(newX, this.gridSize);
        newZ = roundToGrid(newZ, this.gridSize);
      }
      
      obj.position.x = newX;
      obj.position.z = newZ;
      
      this.sceneManager.updateObjectPosition(obj.id, obj.position);
      this.fireEvent({ type: 'move', objectId: obj.id, object: obj });
    }
  }
  
  private handleRotate(event: MouseEvent): void {
    const obj = this.getSelectedObject();
    if (!obj) return;
    
    const canvas = this.sceneManager.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    const angleDelta = (event.clientX - centerX) * 0.5;
    let newRotation = this.initialRotation + angleDelta;
    
    if (this.snapMode === 'grid') {
      newRotation = snapAngleTo90(newRotation);
    }
    
    obj.rotation = normalizeAngle(newRotation);
    this.sceneManager.updateObjectRotation(obj.id, obj.rotation);
    this.fireEvent({ type: 'rotate', objectId: obj.id, object: obj });
  }
  
  private handleScale(event: MouseEvent): void {
    const obj = this.getSelectedObject();
    if (!obj) return;
    
    const canvas = this.sceneManager.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    const centerX = rect.width / 2;
    
    const scaleFactor = 1 + (event.clientX - centerX) / rect.width * 0.5;
    
    let newX = this.initialDimensions.x * scaleFactor;
    let newZ = this.initialDimensions.z * scaleFactor;
    
    if (this.snapMode === 'grid') {
      newX = Math.max(0.2, roundToGrid(newX, this.gridSize));
      newZ = Math.max(0.2, roundToGrid(newZ, this.gridSize));
    }
    
    newX = Math.max(0.1, newX);
    newZ = Math.max(0.1, newZ);
    
    obj.dimensions.x = newX;
    obj.dimensions.z = newZ;
    
    this.sceneManager.updateObjectDimensions(obj.id, obj.dimensions, obj);
    this.fireEvent({ type: 'scale', objectId: obj.id, object: obj });
  }
  
  private onMouseUp(_event: MouseEvent): void {
    if (this.isDragging) {
      this.isDragging = false;
      this.sceneManager.controls.enabled = true;
    }
  }
  
  private onWheel(_event: WheelEvent): void {
  }
  
  private onKeyDown(event: KeyboardEvent): void {
    const obj = this.getSelectedObject();
    
    switch (event.key.toLowerCase()) {
      case 'delete':
      case 'backspace':
        if (obj && !event.metaKey && !event.ctrlKey) {
          this.deleteSelectedObject();
        }
        break;
      
      case 'escape':
        this.deselectAll();
        break;
      
      case 'q':
        if (obj) {
          this.rotateSelected(-45);
        }
        break;
      
      case 'e':
        if (obj) {
          this.rotateSelected(45);
        }
        break;
      
      case 'r':
        this.setEditMode('rotate');
        break;
      
      case 's':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
        } else {
          this.setEditMode('scale');
        }
        break;
      
      case 'g':
        this.setEditMode('move');
        break;
      
      case '1':
        this.sceneManager.setCameraView('top');
        break;
      case '2':
        this.sceneManager.setCameraView('front');
        break;
      case '3':
        this.sceneManager.setCameraView('side');
        break;
      case '4':
        this.sceneManager.setCameraView('perspective');
        break;
    }
  }
  
  private raycast(): THREE.Intersection[] {
    const camera = this.sceneManager.camera;
    this.raycaster.setFromCamera(this.mouse, camera);
    
    const meshes: THREE.Object3D[] = [];
    for (const id of this.sceneManager.getAllObjectIds()) {
      const mesh = this.sceneManager.getObjectMesh(id);
      if (mesh) {
        meshes.push(mesh);
      }
    }
    
    return this.raycaster.intersectObjects(meshes, true);
  }
  
  private findObjectIdFromMesh(mesh: THREE.Object3D): string | null {
    let current: THREE.Object3D | null = mesh;
    while (current) {
      if (current.userData && current.userData.objectId) {
        return current.userData.objectId;
      }
      current = current.parent;
    }
    return null;
  }
  
  public selectObject(objectId: string): void {
    if (this.selectedObjectId) {
      this.sceneManager.deselectObject(this.selectedObjectId);
    }
    
    this.selectedObjectId = objectId;
    this.sceneManager.selectObject(objectId);
    
    const obj = this.getSelectedObject();
    this.fireEvent({ type: 'select', objectId, object: obj || undefined });
  }
  
  public deselectAll(): void {
    if (this.selectedObjectId) {
      this.sceneManager.deselectObject(this.selectedObjectId);
      const oldId = this.selectedObjectId;
      this.selectedObjectId = null;
      this.fireEvent({ type: 'deselect', objectId: oldId });
    }
  }
  
  public deleteSelectedObject(): void {
    if (!this.selectedObjectId || !this.currentPlan) return;
    
    const obj = this.getSelectedObject();
    this.sceneManager.removeObject(this.selectedObjectId);
    
    const index = this.currentPlan.objects.findIndex(o => o.id === this.selectedObjectId);
    if (index > -1) {
      this.currentPlan.objects.splice(index, 1);
    }
    
    const oldId = this.selectedObjectId;
    this.selectedObjectId = null;
    this.fireEvent({ type: 'delete', objectId: oldId, object: obj || undefined });
  }
  
  private rotateSelected(degrees: number): void {
    const obj = this.getSelectedObject();
    if (!obj) return;
    
    let newRotation = obj.rotation + degrees;
    if (this.snapMode === 'grid') {
      newRotation = snapAngleTo90(newRotation);
    }
    
    obj.rotation = normalizeAngle(newRotation);
    this.sceneManager.updateObjectRotation(obj.id, obj.rotation);
    this.fireEvent({ type: 'rotate', objectId: obj.id, object: obj });
  }
  
  public getSelectedObject(): BoothObject | null {
    if (!this.selectedObjectId || !this.currentPlan) return null;
    return this.currentPlan.objects.find(o => o.id === this.selectedObjectId) || null;
  }
  
  public getSelectedObjectId(): string | null {
    return this.selectedObjectId;
  }
  
  public setEditMode(mode: EditMode): void {
    this.editMode = mode;
  }
  
  public getEditMode(): EditMode {
    return this.editMode;
  }
  
  public setSnapMode(mode: SnapMode): void {
    this.snapMode = mode;
  }
  
  public getSnapMode(): SnapMode {
    return this.snapMode;
  }
  
  public toggleSnapMode(): SnapMode {
    this.snapMode = this.snapMode === 'grid' ? 'free' : 'grid';
    return this.snapMode;
  }
}
