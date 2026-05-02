import { JobConfig, Workpiece } from '../types';
import { CanvasRenderer } from '../renderer';
import { RenderOptions } from '../renderer';
export interface InteractiveState {
 selectedWorkpiece: Workpiece | null;
 isDragging: boolean;
 dragOffset: { x: number; y: number };
 options: RenderOptions;
}
export class InteractiveController {
 private renderer: CanvasRenderer;
 private config: JobConfig;
 private state: InteractiveState;
 private onUpdate: () => void;
 constructor(renderer: CanvasRenderer, config: JobConfig, onUpdate: () => void) {
 this.renderer = renderer;
 this.config = config;
 this.onUpdate = onUpdate;
 this.state = {
 selectedWorkpiece: null,
 isDragging: false,
 dragOffset: { x: 0, y: 0 },
 options: {
 scale: renderer.getScale(),
 showBleed: true,
 showSafeMargin: true,
 showGrid: true,
 showLabels: true
 }
 };
 this.setupEventListeners();
 }
 private setupEventListeners(): void {
 const canvas = this.renderer['canvas'];
 canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
 canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
 canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
 canvas.addEventListener('mouseleave', this.handleMouseUp.bind(this));
 canvas.addEventListener('wheel', this.handleWheel.bind(this), { passive: true });
 }
 private handleMouseDown(e: MouseEvent): void {
 const rect = this.renderer['canvas'].getBoundingClientRect();
 const canvasX = e.clientX - rect.left;
 const canvasY = e.clientY - rect.top;
 const workpiece = this.renderer.getWorkpieceAtPosition(canvasX, canvasY, this.config);
 if (workpiece) {
 this.state.selectedWorkpiece = workpiece;
 this.state.isDragging = true;
 const mmCoords = this.renderer.getMMCoordinates(canvasX, canvasY);
 this.state.dragOffset = {
 x: mmCoords.x - workpiece.x,
 y: mmCoords.y - workpiece.y
 };
 }
 else {
 this.state.selectedWorkpiece = null;
 }
 this.onUpdate();
 }
 private handleMouseMove(e: MouseEvent): void {
 if (!this.state.isDragging || !this.state.selectedWorkpiece)
 return;
 const rect = this.renderer['canvas'].getBoundingClientRect();
 const canvasX = e.clientX - rect.left;
 const canvasY = e.clientY - rect.top;
 const mmCoords = this.renderer.getMMCoordinates(canvasX, canvasY);
 this.state.selectedWorkpiece.x = mmCoords.x - this.state.dragOffset.x;
 this.state.selectedWorkpiece.y = mmCoords.y - this.state.dragOffset.y;
 this.onUpdate();
 }
 private handleMouseUp(): void {
 this.state.isDragging = false;
 }
 private handleWheel(e: WheelEvent): void {
 e.preventDefault();
 const delta = e.deltaY > 0 ? 0.9 : 1.1;
 const newScale = Math.max(1, Math.min(20, this.state.options.scale * delta));
 this.state.options.scale = newScale;
 this.renderer.setScale(newScale);
 this.onUpdate();
 }
 setOptions(options: Partial<RenderOptions>): void {
 this.state.options = { ...this.state.options, ...options };
 this.onUpdate();
 }
 getOptions(): RenderOptions {
 return { ...this.state.options };
 }
 getSelectedWorkpiece(): Workpiece | null {
 return this.state.selectedWorkpiece;
 }
 selectWorkpiece(workpiece: Workpiece | null): void {
 this.state.selectedWorkpiece = workpiece;
 this.onUpdate();
 }
 rotateSelectedWorkpiece(degrees: number): void {
 if (this.state.selectedWorkpiece) {
 this.state.selectedWorkpiece.rotation = (this.state.selectedWorkpiece.rotation + degrees) % 360;
 this.onUpdate();
 }
 }
 updateConfig(config: JobConfig): void {
 this.config = config;
 this.onUpdate();
 }
 render(): void {
 this.renderer.render(this.config, this.state.options);
 }
}
