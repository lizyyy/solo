/**
 * 渲染器模块
 */

(function() {
    const OBJECT_TYPE = window.constants.OBJECT_TYPE;
    const COLORS = window.constants.COLORS;
    const RENDER = window.constants.RENDER;

// 渲染器类
class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;
        this.camera = { x: 0, y: 0, zoom: 1 };
        this.objects = [];
    }
    
    // 添加对象到渲染队列
    addObject(obj) {
        this.objects.push(obj);
    }
    
    // 移除对象
    removeObject(obj) {
        const index = this.objects.indexOf(obj);
        if (index > -1) {
            this.objects.splice(index, 1);
        }
    }
    
    // 清空渲染队列
    clearObjects() {
        this.objects = [];
    }
    
    // 渲染所有对象
    render() {
        // 清空画布
        this.clear();
        
        // 保存上下文状态
        this.ctx.save();
        
        // 应用相机变换
        this.ctx.translate(this.camera.x, this.camera.y);
        this.ctx.scale(this.camera.zoom, this.camera.zoom);
        
        // 按类型排序并渲染
        const sortedObjects = this.sortObjectsByType();
        
        // 渲染河流
        for (const obj of sortedObjects.rivers) {
            this.renderRiver(obj);
        }
        
        // 渲染浅滩
        for (const obj of sortedObjects.shallows) {
            this.renderShallow(obj);
        }
        
        // 渲染安全区
        for (const obj of sortedObjects.safeZones) {
            this.renderSafeZone(obj);
        }
        
        // 渲染救援绳
        for (const obj of sortedObjects.ropes) {
            this.renderRope(obj);
        }
        
        // 渲染学员
        for (const obj of sortedObjects.students) {
            this.renderStudent(obj);
        }
        
        // 渲染救援艇
        for (const obj of sortedObjects.boats) {
            this.renderBoat(obj);
        }
        
        // 渲染路径预览
        for (const obj of sortedObjects.boats) {
            if (obj.path && obj.path.length > 0) {
                this.renderPath(obj);
            }
        }
        
        // 恢复上下文状态
        this.ctx.restore();
    }
    
    // 按类型排序对象
    sortObjectsByType() {
        const sorted = {
            rivers: [],
            shallows: [],
            safeZones: [],
            ropes: [],
            students: [],
            boats: []
        };
        
        for (const obj of this.objects) {
            switch (obj.type) {
                case OBJECT_TYPE.RIVER:
                    sorted.rivers.push(obj);
                    break;
                case OBJECT_TYPE.SHALLOW:
                    sorted.shallows.push(obj);
                    break;
                case OBJECT_TYPE.SAFE_ZONE:
                    sorted.safeZones.push(obj);
                    break;
                case OBJECT_TYPE.ROPE:
                    sorted.ropes.push(obj);
                    break;
                case OBJECT_TYPE.STUDENT:
                    sorted.students.push(obj);
                    break;
                case OBJECT_TYPE.BOAT:
                    sorted.boats.push(obj);
                    break;
            }
        }
        
        return sorted;
    }
    
    // 清空画布
    clear() {
        this.ctx.fillStyle = '#ecf0f1';
        this.ctx.fillRect(0, 0, this.width, this.height);
    }
    
    // 渲染河流
    renderRiver(river) {
        // 渲染河流背景
        this.ctx.fillStyle = COLORS.RIVER;
        this.ctx.fillRect(river.x, river.y, river.width, river.height);
        
        // 渲染河流边界
        this.ctx.strokeStyle = COLORS.RIVER_DEEP;
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(river.x, river.y, river.width, river.height);
        
        // 渲染水流方向箭头
        this.renderWaterFlow(river);
    }
    
    // 渲染水流方向
    renderWaterFlow(river) {
        const { TILE_SIZE } = RENDER;
        const flowRad = window.utils.degToRad(river.flowDirection);
        
        // 计算箭头位置
        const centerX = river.x + river.width / 2;
        const centerY = river.y + river.height / 2;
        
        // 渲染多个箭头
        const arrowSpacing = TILE_SIZE * 3;
        const startX = river.x + TILE_SIZE;
        const startY = river.y + TILE_SIZE;
        const endX = river.x + river.width - TILE_SIZE;
        const endY = river.y + river.height - TILE_SIZE;
        
        this.ctx.fillStyle = COLORS.WATER_FLOW;
        this.ctx.strokeStyle = COLORS.WATER_FLOW;
        this.ctx.lineWidth = 1.5;
        
        for (let x = startX; x <= endX; x += arrowSpacing) {
            for (let y = startY; y <= endY; y += arrowSpacing) {
                this.renderArrow(x, y, flowRad, river.flowSpeed);
            }
        }
    }
    
    // 渲染单个箭头
    renderArrow(x, y, angle, speed) {
        const arrowLength = 15 + speed * 3;
        const arrowHeadLength = 6;
        const arrowHeadAngle = Math.PI / 6;
        
        const endX = x + Math.cos(angle) * arrowLength;
        const endY = y + Math.sin(angle) * arrowLength;
        
        // 渲染线
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
        this.ctx.lineTo(endX, endY);
        this.ctx.stroke();
        
        // 渲染箭头
        this.ctx.beginPath();
        this.ctx.moveTo(endX, endY);
        this.ctx.lineTo(
            endX - Math.cos(angle - arrowHeadAngle) * arrowHeadLength,
            endY - Math.sin(angle - arrowHeadAngle) * arrowHeadLength
        );
        this.ctx.lineTo(
            endX - Math.cos(angle + arrowHeadAngle) * arrowHeadLength,
            endY - Math.sin(angle + arrowHeadAngle) * arrowHeadLength
        );
        this.ctx.closePath();
        this.ctx.fill();
    }
    
    // 渲染浅滩
    renderShallow(shallow) {
        // 渲染浅滩背景
        this.ctx.fillStyle = COLORS.SHALLOW;
        this.ctx.fillRect(shallow.x, shallow.y, shallow.width, shallow.height);
        
        // 渲染浅滩边界
        this.ctx.strokeStyle = COLORS.SHALLOW_BORDER;
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.strokeRect(shallow.x, shallow.y, shallow.width, shallow.height);
        this.ctx.setLineDash([]);
        
        // 渲染浅滩文字
        this.ctx.fillStyle = '#555';
        this.ctx.font = `${RENDER.FONT_SIZE}px ${RENDER.FONT_FAMILY}`;
        this.ctx.textAlign = 'center';
        this.ctx.fillText('浅滩', shallow.x + shallow.width / 2, shallow.y + shallow.height / 2);
    }
    
    // 渲染安全区
    renderSafeZone(safeZone) {
        // 渲染安全区背景
        this.ctx.fillStyle = 'rgba(155, 89, 182, 0.3)';
        this.ctx.beginPath();
        this.ctx.arc(safeZone.centerX, safeZone.centerY, safeZone.radius, 0, Math.PI * 2);
        this.ctx.fill();
        
        // 渲染安全区边界
        this.ctx.strokeStyle = COLORS.SAFE_ZONE;
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.arc(safeZone.centerX, safeZone.centerY, safeZone.radius, 0, Math.PI * 2);
        this.ctx.stroke();
        
        // 渲染安全区文字
        this.ctx.fillStyle = COLORS.SAFE_ZONE;
        this.ctx.font = `bold ${RENDER.FONT_SIZE + 2}px ${RENDER.FONT_FAMILY}`;
        this.ctx.textAlign = 'center';
        this.ctx.fillText('安全区', safeZone.centerX, safeZone.centerY);
    }
    
    // 渲染救援绳
    renderRope(rope) {
        // 渲染绳子
        this.ctx.strokeStyle = COLORS.ROPE;
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.moveTo(rope.startX, rope.startY);
        this.ctx.lineTo(rope.endX, rope.endY);
        this.ctx.stroke();
        
        // 渲染绳子起点和终点
        this.ctx.fillStyle = COLORS.ROPE;
        this.ctx.beginPath();
        this.ctx.arc(rope.startX, rope.startY, 5, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.beginPath();
        this.ctx.arc(rope.endX, rope.endY, 5, 0, Math.PI * 2);
        this.ctx.fill();
    }
    
    // 渲染学员
    renderStudent(student) {
        const centerX = student.getCenterX();
        const centerY = student.getCenterY();
        const radius = student.width / 2;
        
        // 渲染学员背景
        if (student.isRescued) {
            this.ctx.fillStyle = COLORS.STUDENT_RESCUED;
        } else if (student.isInDanger) {
            this.ctx.fillStyle = '#e74c3c';
        } else {
            this.ctx.fillStyle = COLORS.STUDENT;
        }
        
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        this.ctx.fill();
        
        // 渲染学员边界
        this.ctx.strokeStyle = student.isSelected ? RENDER.SELECTION_COLOR : '#333';
        this.ctx.lineWidth = student.isSelected ? 3 : 1;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        this.ctx.stroke();
        
        // 渲染学员名字
        this.ctx.fillStyle = '#fff';
        this.ctx.font = `bold ${RENDER.FONT_SIZE}px ${RENDER.FONT_FAMILY}`;
        this.ctx.textAlign = 'center';
        this.ctx.fillText(student.name, centerX, centerY + 5);
        
        // 渲染健康条
        if (!student.isRescued) {
            const healthBarWidth = 30;
            const healthBarHeight = 4;
            const healthBarX = centerX - healthBarWidth / 2;
            const healthBarY = centerY - radius - 10;
            
            // 健康条背景
            this.ctx.fillStyle = '#555';
            this.ctx.fillRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);
            
            // 健康条前景
            const healthPercent = student.health / student.maxHealth;
            this.ctx.fillStyle = healthPercent > 0.5 ? '#27ae60' : 
                                  healthPercent > 0.3 ? '#f39c12' : '#e74c3c';
            this.ctx.fillRect(healthBarX, healthBarY, healthBarWidth * healthPercent, healthBarHeight);
        }
    }
    
    // 渲染救援艇
    renderBoat(boat) {
        const centerX = boat.getCenterX();
        const centerY = boat.getCenterY();
        const width = boat.width;
        const height = boat.height;
        
        // 保存上下文
        this.ctx.save();
        
        // 应用旋转
        this.ctx.translate(centerX, centerY);
        this.ctx.rotate(boat.rotation);
        
        // 渲染救援艇背景
        this.ctx.fillStyle = COLORS.BOAT;
        this.ctx.beginPath();
        this.ctx.roundRect(-width/2, -height/2, width, height, 5);
        this.ctx.fill();
        
        // 渲染救援艇边界
        this.ctx.strokeStyle = boat.isSelected ? RENDER.SELECTION_COLOR : '#333';
        this.ctx.lineWidth = boat.isSelected ? 3 : 1;
        this.ctx.beginPath();
        this.ctx.roundRect(-width/2, -height/2, width, height, 5);
        this.ctx.stroke();
        
        // 渲染救援艇名字
        this.ctx.fillStyle = '#fff';
        this.ctx.font = `bold ${RENDER.FONT_SIZE}px ${RENDER.FONT_FAMILY}`;
        this.ctx.textAlign = 'center';
        this.ctx.fillText(boat.name, 0, 5);
        
        // 渲染乘客数量
        if (boat.passengers.length > 0) {
            this.ctx.fillStyle = '#fff';
            this.ctx.font = `bold ${RENDER.FONT_SIZE - 2}px ${RENDER.FONT_FAMILY}`;
            this.ctx.textAlign = 'right';
            this.ctx.fillText(`乘客: ${boat.passengers.length}/${boat.maxPassengers}`, width/2 - 5, -height/2 - 5);
        }
        
        // 恢复上下文
        this.ctx.restore();
        
        // 渲染能量条
        const energyBarWidth = 40;
        const energyBarHeight = 4;
        const energyBarX = centerX - energyBarWidth / 2;
        const energyBarY = centerY - height/2 - 10;
        
        // 能量条背景
        this.ctx.fillStyle = '#555';
        this.ctx.fillRect(energyBarX, energyBarY, energyBarWidth, energyBarHeight);
        
        // 能量条前景
        const energyPercent = boat.energy / boat.maxEnergy;
        this.ctx.fillStyle = energyPercent > 0.5 ? '#3498db' : 
                              energyPercent > 0.3 ? '#f39c12' : '#e74c3c';
        this.ctx.fillRect(energyBarX, energyBarY, energyBarWidth * energyPercent, energyBarHeight);
    }
    
    // 渲染路径
    renderPath(boat) {
        if (boat.path.length === 0) return;
        
        this.ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        
        // 渲染路径线
        this.ctx.beginPath();
        this.ctx.moveTo(boat.getCenterX(), boat.getCenterY());
        
        for (const point of boat.path) {
            this.ctx.lineTo(point.x, point.y);
        }
        
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        
        // 渲染路径点
        this.ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
        for (let i = 0; i < boat.path.length; i++) {
            const point = boat.path[i];
            this.ctx.beginPath();
            this.ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
            this.ctx.fill();
            
            // 渲染序号
            this.ctx.fillStyle = '#fff';
            this.ctx.font = `bold ${RENDER.FONT_SIZE - 2}px ${RENDER.FONT_FAMILY}`;
            this.ctx.textAlign = 'center';
            this.ctx.fillText(i + 1, point.x, point.y + 5);
            this.ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
        }
    }
    
    // 渲染网格
    renderGrid() {
        const { TILE_SIZE, GRID_COLOR } = RENDER;
        
        this.ctx.strokeStyle = GRID_COLOR;
        this.ctx.lineWidth = 1;
        
        // 垂直线
        for (let x = 0; x <= this.width; x += TILE_SIZE) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.height);
            this.ctx.stroke();
        }
        
        // 水平线
        for (let y = 0; y <= this.height; y += TILE_SIZE) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.width, y);
            this.ctx.stroke();
        }
    }
    
    // 渲染高亮区域
    renderHighlight(x, y, width, height) {
        this.ctx.fillStyle = RENDER.HIGHLIGHT_COLOR;
        this.ctx.fillRect(x, y, width, height);
    }
    
    // 设置相机
    setCamera(x, y, zoom) {
        this.camera = { x, y, zoom };
    }
    
    // 重置相机
    resetCamera() {
        this.camera = { x: 0, y: 0, zoom: 1 };
    }
}

// 导出模块
window.renderer = {
    Renderer
};
})();