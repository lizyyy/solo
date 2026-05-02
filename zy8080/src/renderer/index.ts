import { JobConfig, Workpiece } from '../types';
import { toMM } from '../parser/unit';
import { calculateBoundingBox, calculateSafeArea } from '../geometry';
export interface RenderOptions {
 scale: number;
 showBleed: boolean;
 showSafeMargin: boolean;
 showGrid: boolean;
 showLabels: boolean;
}
export class CanvasRenderer {
 private canvas: HTMLCanvasElement;
 private ctx: CanvasRenderingContext2D;
 private scale: number = 5;
 private offsetX: number = 20;
 private offsetY: number = 20;
 constructor(canvas: HTMLCanvasElement) {
 this.canvas = canvas;
 const ctx = canvas.getContext('2d');
 if (!ctx)
 throw new Error('无法获取 Canvas 上下文');
 this.ctx = ctx;
 }
 setScale(scale: number): void {
 this.scale = scale;
 }
 getScale(): number {
 return this.scale;
 }
 private toCanvasX(mm: number): number {
 return this.offsetX + mm * this.scale;
 }
 private toCanvasY(mm: number): number {
 return this.offsetY + mm * this.scale;
 }
 clear(): void {
 this.ctx.fillStyle = '#f5f5f5';
 this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
 }
 render(config: JobConfig, options: RenderOptions): void {
 this.clear();
 const paperWidth = toMM(config.paper.width);
 const paperHeight = toMM(config.paper.height);
 const canvasWidth = this.toCanvasX(paperWidth) + 40;
 const canvasHeight = this.toCanvasY(paperHeight) + 40;
 this.canvas.width = canvasWidth;
 this.canvas.height = canvasHeight;
 this.ctx.fillStyle = '#f5f5f5';
 this.ctx.fillRect(0, 0, canvasWidth, canvasHeight);
 this.renderPaper(paperWidth, paperHeight);
 if (options.showGrid) {
 this.renderGrid(paperWidth, paperHeight);
 }
 config.workpieces.forEach(workpiece => {
 this.renderWorkpiece(workpiece, config, options);
 });
 }
 private renderPaper(width: number, height: number): void {
 this.ctx.fillStyle = '#fffef0';
 this.ctx.strokeStyle = '#333';
 this.ctx.lineWidth = 2;
 this.ctx.fillRect(this.toCanvasX(0), this.toCanvasY(0), width * this.scale, height * this.scale);
 this.ctx.strokeRect(this.toCanvasX(0), this.toCanvasY(0), width * this.scale, height * this.scale);
 }
 private renderGrid(width: number, height: number): void {
 this.ctx.strokeStyle = '#e0e0e0';
 this.ctx.lineWidth = 0.5;
 const gridSize = 50;
 for (let x = 0; x <= width; x += gridSize) {
 this.ctx.beginPath();
 this.ctx.moveTo(this.toCanvasX(x), this.toCanvasY(0));
 this.ctx.lineTo(this.toCanvasX(x), this.toCanvasY(height));
 this.ctx.stroke();
 }
 for (let y = 0; y <= height; y += gridSize) {
 this.ctx.beginPath();
 this.ctx.moveTo(this.toCanvasX(0), this.toCanvasY(y));
 this.ctx.lineTo(this.toCanvasX(width), this.toCanvasY(y));
 this.ctx.stroke();
 }
 }
 private renderWorkpiece(workpiece: Workpiece, config: JobConfig, options: RenderOptions): void {
 const width = toMM(workpiece.width);
 const height = toMM(workpiece.height);
 const bleed = toMM(workpiece.bleed || config.bleed);
 const safeMargin = toMM(workpiece.safeMargin || config.safeMargin);
 const centerX = workpiece.x;
 const centerY = workpiece.y;
 this.ctx.save();
 this.ctx.translate(this.toCanvasX(centerX), this.toCanvasY(centerY));
 this.ctx.rotate((workpiece.rotation * Math.PI) / 180);
 const halfW = width / 2;
 const halfH = height / 2;
 if (options.showBleed) {
 this.ctx.fillStyle = 'rgba(255, 150, 150, 0.3)';
 this.ctx.strokeStyle = '#ff6b6b';
 this.ctx.lineWidth = 1;
 this.ctx.fillRect(-halfW - bleed, -halfH - bleed, (width + bleed * 2) * this.scale, (height + bleed * 2) * this.scale);
 this.ctx.strokeRect(-halfW - bleed, -halfH - bleed, (width + bleed * 2) * this.scale, (height + bleed * 2) * this.scale);
 }
 this.ctx.fillStyle = '#a8d8ea';
 this.ctx.strokeStyle = '#318ce7';
 this.ctx.lineWidth = 2;
 this.ctx.fillRect(-halfW * this.scale, -halfH * this.scale, width * this.scale, height * this.scale);
 this.ctx.strokeRect(-halfW * this.scale, -halfH * this.scale, width * this.scale, height * this.scale);
 if (options.showSafeMargin) {
 this.ctx.fillStyle = 'rgba(255, 255, 150, 0.3)';
 this.ctx.strokeStyle = '#ffd700';
 this.ctx.lineWidth = 1;
 this.ctx.setLineDash([5, 3]);
 this.ctx.strokeRect((-halfW + safeMargin) * this.scale, (-halfH + safeMargin) * this.scale, (width - safeMargin * 2) * this.scale, (height - safeMargin * 2) * this.scale);
 this.ctx.setLineDash([]);
 }
 this.ctx.restore();
 if (options.showLabels) {
 const bb = calculateBoundingBox(workpiece);
 const labelX = this.toCanvasX(bb.x);
 const labelY = this.toCanvasY(bb.y) - 5;
 this.ctx.fillStyle = '#333';
 this.ctx.font = '12px Arial';
 this.ctx.fillText(workpiece.name, labelX, labelY);
 }
 }
 getWorkpieceAtPosition(canvasX: number, canvasY: number, config: JobConfig): Workpiece | null {
 for (let i = config.workpieces.length - 1; i >= 0; i--) {
 const wp = config.workpieces[i];
 const bb = calculateBoundingBox(wp);
 if (canvasX >= this.toCanvasX(bb.x) &&
 canvasX <= this.toCanvasX(bb.x + bb.width) &&
 canvasY >= this.toCanvasY(bb.y) &&
 canvasY <= this.toCanvasY(bb.y + bb.height)) {
 return wp;
 }
 }
 return null;
 }
 getCanvasCoordinates(mmX: number, mmY: number): {
 x: number;
 y: number;
 } {
 return {
 x: this.toCanvasX(mmX),
 y: this.toCanvasY(mmY)
 };
 }
 getMMCoordinates(canvasX: number, canvasY: number): {
 x: number;
 y: number;
 } {
 return {
 x: (canvasX - this.offsetX) / this.scale,
 y: (canvasY - this.offsetY) / this.scale
 };
 }
}
