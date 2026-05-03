// 游戏渲染模块 - Canvas 渲染

import { Point, ElementType } from '../models/level.js';

export class GameRenderer {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.options = {
            gridSize: options.gridSize || 50,
            showGrid: options.showGrid || false,
            scale: options.scale || 1
        };
        
        this.colors = {
            background: '#f0f4f8',
            grid: '#e2e8f0',
            startPoint: '#27ae60',
            rescuePoint: '#e74c3c',
            noFlyZone: 'rgba(155, 89, 182, 0.4)',
            noFlyZoneBorder: '#9b59b6',
            windZone: 'rgba(52, 152, 219, 0.3)',
            windZoneBorder: '#3498db',
            mountain: 'rgba(127, 140, 141, 0.8)',
            mountainBorder: '#7f8c8d',
            path: '#f39c12',
            pathPoint: '#e67e22',
            drone: '#3498db',
            visitedRescuePoint: '#27ae60',
            windArrow: '#2980b9'
        };
        
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }
    
    resize() {
        const container = this.canvas.parentElement;
        if (container) {
            this.canvas.width = container.clientWidth;
            this.canvas.height = container.clientHeight;
        }
    }
    
    clear() {
        this.ctx.fillStyle = this.colors.background;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        if (this.options.showGrid) {
            this.drawGrid();
        }
    }
    
    drawGrid() {
        this.ctx.strokeStyle = this.colors.grid;
        this.ctx.lineWidth = 1;
        
        const gridSize = this.options.gridSize;
        
        for (let x = 0; x < this.canvas.width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        
        for (let y = 0; y < this.canvas.height; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
    }
    
    drawLevel(level) {
        this.drawMountains(level.mountains);
        this.drawNoFlyZones(level.noFlyZones);
        this.drawWindZones(level.windZones);
        this.drawRescuePoints(level.rescuePoints);
        if (level.startPoint) {
            this.drawStartPoint(level.startPoint);
        }
    }
    
    drawStartPoint(point) {
        const pos = point.position;
        const radius = 15;
        
        this.ctx.fillStyle = this.colors.startPoint;
        this.ctx.beginPath();
        this.ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.strokeStyle = '#1e8449';
        this.ctx.lineWidth = 3;
        this.ctx.stroke();
        
        this.ctx.fillStyle = 'white';
        this.ctx.font = 'bold 12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('起点', pos.x, pos.y);
    }
    
    drawRescuePoints(points, visitedIds = new Set()) {
        for (const point of points) {
            const pos = point.position;
            const radius = 12;
            const isVisited = visitedIds.has(point.id);
            
            this.ctx.fillStyle = isVisited ? this.colors.visitedRescuePoint : this.colors.rescuePoint;
            this.ctx.beginPath();
            this.ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
            this.ctx.fill();
            
            this.ctx.strokeStyle = isVisited ? '#1e8449' : '#c0392b';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
            
            this.ctx.fillStyle = 'white';
            this.ctx.font = 'bold 10px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText('🆘', pos.x, pos.y);
        }
    }
    
    drawNoFlyZones(zones) {
        for (const zone of zones) {
            this.ctx.fillStyle = this.colors.noFlyZone;
            this.ctx.strokeStyle = this.colors.noFlyZoneBorder;
            this.ctx.lineWidth = 2;
            
            this.ctx.beginPath();
            this.ctx.moveTo(zone.position[0].x, zone.position[0].y);
            for (let i = 1; i < zone.position.length; i++) {
                this.ctx.lineTo(zone.position[i].x, zone.position[i].y);
            }
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.stroke();
            
            const center = this.getPolygonCenter(zone.position);
            this.ctx.fillStyle = '#9b59b6';
            this.ctx.font = 'bold 14px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText('🚫', center.x, center.y);
        }
    }
    
    drawWindZones(zones) {
        for (const zone of zones) {
            this.ctx.fillStyle = this.colors.windZone;
            this.ctx.strokeStyle = this.colors.windZoneBorder;
            this.ctx.lineWidth = 2;
            
            this.ctx.beginPath();
            this.ctx.moveTo(zone.position[0].x, zone.position[0].y);
            for (let i = 1; i < zone.position.length; i++) {
                this.ctx.lineTo(zone.position[i].x, zone.position[i].y);
            }
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.stroke();
            
            const center = this.getPolygonCenter(zone.position);
            const direction = zone.options.direction || 0;
            const speed = zone.options.speed || 1.0;
            
            this.drawWindArrow(center, direction, speed);
        }
    }
    
    drawWindArrow(center, direction, speed) {
        const arrowLength = 25 + speed * 5;
        const angleRad = direction * Math.PI / 180;
        
        const endX = center.x + Math.cos(angleRad) * arrowLength;
        const endY = center.y + Math.sin(angleRad) * arrowLength;
        
        this.ctx.strokeStyle = this.colors.windArrow;
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.moveTo(center.x, center.y);
        this.ctx.lineTo(endX, endY);
        this.ctx.stroke();
        
        const arrowHeadLength = 8;
        const arrowHeadAngle = Math.PI / 6;
        
        this.ctx.fillStyle = this.colors.windArrow;
        this.ctx.beginPath();
        this.ctx.moveTo(endX, endY);
        this.ctx.lineTo(
            endX - arrowHeadLength * Math.cos(angleRad - arrowHeadAngle),
            endY - arrowHeadLength * Math.sin(angleRad - arrowHeadAngle)
        );
        this.ctx.lineTo(
            endX - arrowHeadLength * Math.cos(angleRad + arrowHeadAngle),
            endY - arrowHeadLength * Math.sin(angleRad + arrowHeadAngle)
        );
        this.ctx.closePath();
        this.ctx.fill();
    }
    
    drawMountains(mountains) {
        for (const mountain of mountains) {
            this.ctx.fillStyle = this.colors.mountain;
            this.ctx.strokeStyle = this.colors.mountainBorder;
            this.ctx.lineWidth = 2;
            
            this.ctx.beginPath();
            this.ctx.moveTo(mountain.position[0].x, mountain.position[0].y);
            for (let i = 1; i < mountain.position.length; i++) {
                this.ctx.lineTo(mountain.position[i].x, mountain.position[i].y);
            }
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.stroke();
            
            const center = this.getPolygonCenter(mountain.position);
            this.ctx.fillStyle = 'white';
            this.ctx.font = 'bold 14px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText('⛰️', center.x, center.y);
        }
    }
    
    drawPath(path, isPlanning = true) {
        if (!path || path.length < 2) return;
        
        this.ctx.strokeStyle = isPlanning ? this.colors.path : '#3498db';
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash(isPlanning ? [5, 5] : []);
        
        this.ctx.beginPath();
        this.ctx.moveTo(path[0].x, path[0].y);
        for (let i = 1; i < path.length; i++) {
            this.ctx.lineTo(path[i].x, path[i].y);
        }
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        
        for (let i = 1; i < path.length - 1; i++) {
            this.ctx.fillStyle = this.colors.pathPoint;
            this.ctx.beginPath();
            this.ctx.arc(path[i].x, path[i].y, 5, 0, Math.PI * 2);
            this.ctx.fill();
            
            this.ctx.fillStyle = 'white';
            this.ctx.font = 'bold 10px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(i.toString(), path[i].x, path[i].y);
        }
    }
    
    drawDrone(position, rotation = 0) {
        const size = 15;
        
        this.ctx.save();
        this.ctx.translate(position.x, position.y);
        this.ctx.rotate(rotation);
        
        this.ctx.fillStyle = this.colors.drone;
        this.ctx.beginPath();
        this.ctx.moveTo(size, 0);
        this.ctx.lineTo(-size / 2, -size / 2);
        this.ctx.lineTo(-size / 3, 0);
        this.ctx.lineTo(-size / 2, size / 2);
        this.ctx.closePath();
        this.ctx.fill();
        
        this.ctx.strokeStyle = '#2980b9';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        
        this.ctx.restore();
    }
    
    drawEnergyInfo(path, level, physicsEngine) {
        if (!path || path.length < 2) return;
        
        const energy = physicsEngine.calculatePathEnergy(path, level.windZones);
        const maxBattery = level.settings.initialBattery;
        
        const barWidth = 200;
        const barHeight = 20;
        const startX = 20;
        const startY = 20;
        
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(startX - 5, startY - 5, barWidth + 10, barHeight + 50);
        
        this.ctx.fillStyle = 'white';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'top';
        this.ctx.fillText(`预估能耗: ${energy.toFixed(1)}%`, startX, startY);
        
        const percentage = Math.min(energy / maxBattery, 1);
        this.ctx.fillStyle = '#34495e';
        this.ctx.fillRect(startX, startY + 20, barWidth, barHeight);
        
        let barColor = '#27ae60';
        if (percentage > 0.7) barColor = '#e74c3c';
        else if (percentage > 0.5) barColor = '#f39c12';
        
        this.ctx.fillStyle = barColor;
        this.ctx.fillRect(startX, startY + 20, barWidth * percentage, barHeight);
        
        this.ctx.fillStyle = 'white';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(
            `${(percentage * 100).toFixed(0)}%`,
            startX + barWidth / 2,
            startY + 23
        );
    }
    
    getPolygonCenter(points) {
        let cx = 0, cy = 0;
        for (const point of points) {
            cx += point.x;
            cy += point.y;
        }
        return new Point(cx / points.length, cy / points.length);
    }
    
    setOptions(options) {
        this.options = { ...this.options, ...options };
    }
}

export class EditorRenderer extends GameRenderer {
    constructor(canvas, options = {}) {
        super(canvas, options);
        this.previewElement = null;
        this.selectedTool = null;
    }
    
    setPreviewElement(element, mousePos) {
        this.previewElement = { element, mousePos };
    }
    
    clearPreview() {
        this.previewElement = null;
    }
    
    drawPreview() {
        if (!this.previewElement) return;
        
        const { element, mousePos } = this.previewElement;
        
        this.ctx.globalAlpha = 0.5;
        
        switch (element.type) {
            case ElementType.START_POINT:
            case ElementType.RESCUE_POINT:
                const radius = 12;
                this.ctx.fillStyle = element.type === ElementType.START_POINT ? 
                    this.colors.startPoint : this.colors.rescuePoint;
                this.ctx.beginPath();
                this.ctx.arc(mousePos.x, mousePos.y, radius, 0, Math.PI * 2);
                this.ctx.fill();
                break;
                
            case ElementType.NO_FLY_ZONE:
            case ElementType.WIND_ZONE:
            case ElementType.MOUNTAIN:
                if (element.position && element.position.length > 0) {
                    let fillColor;
                    switch (element.type) {
                        case ElementType.NO_FLY_ZONE:
                            fillColor = this.colors.noFlyZone;
                            break;
                        case ElementType.WIND_ZONE:
                            fillColor = this.colors.windZone;
                            break;
                        case ElementType.MOUNTAIN:
                            fillColor = this.colors.mountain;
                            break;
                    }
                    
                    this.ctx.fillStyle = fillColor;
                    this.ctx.beginPath();
                    this.ctx.moveTo(element.position[0].x, element.position[0].y);
                    for (let i = 1; i < element.position.length; i++) {
                        this.ctx.lineTo(element.position[i].x, element.position[i].y);
                    }
                    this.ctx.lineTo(mousePos.x, mousePos.y);
                    this.ctx.closePath();
                    this.ctx.fill();
                    
                    for (const point of element.position) {
                        this.ctx.fillStyle = '#fff';
                        this.ctx.beginPath();
                        this.ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
                        this.ctx.fill();
                    }
                }
                break;
        }
        
        this.ctx.globalAlpha = 1;
    }
    
    render(level, path = []) {
        this.clear();
        this.drawLevel(level);
        if (path.length > 0) {
            this.drawPath(path);
        }
        this.drawPreview();
    }
}
