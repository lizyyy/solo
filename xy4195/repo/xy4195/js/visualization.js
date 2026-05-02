// 可视化画布模块
const Visualization = {
    canvas: null,
    ctx: null,
    width: 0,
    height: 0,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    viewMode: 'plan', // 'plan' 或 'section'
    
    // 颜色配置
    colors: {
        case: '#3498db',
        caseGlass: 'rgba(52, 152, 219, 0.3)',
        light: '#f39c12',
        lightBeam: 'rgba(243, 156, 18, 0.3)',
        glareHigh: 'rgba(231, 76, 60, 0.5)',
        glareMedium: 'rgba(243, 156, 18, 0.5)',
        glareLow: 'rgba(52, 152, 219, 0.5)',
        visibilityGood: 'rgba(46, 204, 113, 0.4)',
        visibilityBad: 'rgba(231, 76, 60, 0.4)',
        path: '#9b59b6',
        pathPoint: '#8e44ad',
        infoPanel: '#1abc9c',
        artifact: '#e67e22',
        grid: 'rgba(0, 0, 0, 0.1)',
        axis: 'rgba(0, 0, 0, 0.3)'
    },
    
    // 初始化画布
    init: function(canvasElement) {
        this.canvas = canvasElement;
        this.ctx = this.canvas.getContext('2d');
        this.resize();
    },
    
    // 调整画布大小
    resize: function() {
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
        this.width = this.canvas.width;
        this.height = this.canvas.height;
    },
    
    // 设置视图模式
    setViewMode: function(mode) {
        this.viewMode = mode;
    },
    
    // 计算缩放和偏移以适应数据
    calculateFit: function(data) {
        if (!data || !data.cases || data.cases.length === 0) {
            this.scale = 50; // 默认缩放：1米 = 50像素
            this.offsetX = this.width / 2;
            this.offsetY = this.height / 2;
            return;
        }
        
        // 找到所有数据的边界
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        
        // 展柜
        for (const caseItem of data.cases) {
            minX = Math.min(minX, caseItem.position.x);
            maxX = Math.max(maxX, caseItem.position.x + caseItem.width);
            minY = Math.min(minY, caseItem.position.y);
            maxY = Math.max(maxY, caseItem.position.y + caseItem.height);
        }
        
        // 灯具
        if (data.lights) {
            for (const light of data.lights) {
                minX = Math.min(minX, light.position.x - 2);
                maxX = Math.max(maxX, light.position.x + 2);
                minY = Math.min(minY, light.position.y - 2);
                maxY = Math.max(maxY, light.position.y + 2);
            }
        }
        
        // 动线
        if (data.paths) {
            for (const path of data.paths) {
                for (const point of path.points) {
                    minX = Math.min(minX, point.x - 1);
                    maxX = Math.max(maxX, point.x + 1);
                    minY = Math.min(minY, point.y - 1);
                    maxY = Math.max(maxY, point.y + 1);
                }
            }
        }
        
        // 添加边距
        const margin = 2;
        minX -= margin;
        maxX += margin;
        minY -= margin;
        maxY += margin;
        
        // 计算缩放
        const dataWidth = maxX - minX;
        const dataHeight = maxY - minY;
        
        const scaleX = (this.width - 40) / dataWidth;
        const scaleY = (this.height - 40) / dataHeight;
        
        this.scale = Math.min(scaleX, scaleY);
        
        // 计算偏移（居中）
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        
        this.offsetX = this.width / 2 - centerX * this.scale;
        this.offsetY = this.height / 2 - centerY * this.scale;
    },
    
    // 坐标转换：世界坐标到画布坐标
    worldToCanvas: function(x, y) {
        if (this.viewMode === 'plan') {
            // 平面图：直接使用X,Y
            return {
                x: x * this.scale + this.offsetX,
                y: y * this.scale + this.offsetY
            };
        } else {
            // 侧视图：使用X,Z
            // 注意：Y轴在画布上向下为正，但在3D中Z向上为正
            return {
                x: x * this.scale + this.offsetX,
                y: this.height - (y * this.scale + this.offsetY) // 翻转Y轴
            };
        }
    },
    
    // 坐标转换：画布坐标到世界坐标
    canvasToWorld: function(x, y) {
        if (this.viewMode === 'plan') {
            return {
                x: (x - this.offsetX) / this.scale,
                y: (y - this.offsetY) / this.scale
            };
        } else {
            return {
                x: (x - this.offsetX) / this.scale,
                y: (this.height - y - this.offsetY) / this.scale
            };
        }
    },
    
    // 绘制网格
    drawGrid: function() {
        const ctx = this.ctx;
        ctx.strokeStyle = this.colors.grid;
        ctx.lineWidth = 1;
        
        // 网格间隔（1米）
        const gridSize = this.scale;
        
        // 绘制垂直线
        const startX = Math.floor(-this.offsetX / gridSize) * gridSize + this.offsetX;
        for (let x = startX; x < this.width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.height);
            ctx.stroke();
        }
        
        // 绘制水平线
        const startY = Math.floor(-this.offsetY / gridSize) * gridSize + this.offsetY;
        for (let y = startY; y < this.height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(this.width, y);
            ctx.stroke();
        }
        
        // 绘制坐标轴
        ctx.strokeStyle = this.colors.axis;
        ctx.lineWidth = 2;
        
        // X轴
        const origin = this.worldToCanvas(0, 0);
        ctx.beginPath();
        ctx.moveTo(0, origin.y);
        ctx.lineTo(this.width, origin.y);
        ctx.stroke();
        
        // Y轴
        ctx.beginPath();
        ctx.moveTo(origin.x, 0);
        ctx.lineTo(origin.x, this.height);
        ctx.stroke();
    },
    
    // 绘制展柜
    drawCases: function(cases) {
        const ctx = this.ctx;
        
        for (const caseItem of cases) {
            const pos = this.worldToCanvas(caseItem.position.x, caseItem.position.y);
            const width = caseItem.width * this.scale;
            const height = caseItem.height * this.scale;
            
            // 绘制展柜主体
            ctx.fillStyle = this.colors.case + '20';
            ctx.fillRect(pos.x, pos.y, width, height);
            
            ctx.strokeStyle = this.colors.case;
            ctx.lineWidth = 2;
            ctx.strokeRect(pos.x, pos.y, width, height);
            
            // 绘制玻璃（如果有）
            if (caseItem.glass && caseItem.glass.front) {
                ctx.fillStyle = this.colors.caseGlass;
                // 假设玻璃在前表面（Y轴较小的一侧）
                ctx.fillRect(pos.x, pos.y, width, 5);
            }
            
            // 绘制说明牌
            if (caseItem.infoPanel) {
                const panelPos = this.worldToCanvas(
                    caseItem.position.x + caseItem.infoPanel.position.x,
                    caseItem.position.y + caseItem.infoPanel.position.y
                );
                const panelWidth = caseItem.infoPanel.width * this.scale;
                const panelHeight = caseItem.infoPanel.height * this.scale;
                
                ctx.fillStyle = this.colors.infoPanel;
                ctx.fillRect(
                    panelPos.x - panelWidth / 2,
                    panelPos.y - panelHeight / 2,
                    panelWidth,
                    panelHeight
                );
                
                // 说明牌标签
                ctx.fillStyle = 'white';
                ctx.font = '10px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('说明牌', panelPos.x, panelPos.y + 3);
            }
            
            // 展柜标签
            ctx.fillStyle = this.colors.case;
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(caseItem.id, pos.x + width / 2, pos.y - 5);
        }
    },
    
    // 绘制灯具
    drawLights: function(lights, settings) {
        const ctx = this.ctx;
        
        for (const light of lights) {
            // 计算灯束
            const beam = Geometry.calculateLightBeam(light, this.viewMode);
            
            if (settings.showBeams) {
                this.drawLightBeam(beam, light);
            }
            
            // 绘制灯具位置
            const pos;
            if (this.viewMode === 'plan') {
                pos = this.worldToCanvas(light.position.x, light.position.y);
            } else {
                pos = this.worldToCanvas(light.position.x, light.position.z);
            }
            
            ctx.fillStyle = this.colors.light;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 8, 0, Math.PI * 2);
            ctx.fill();
            
            // 灯具标签
            ctx.fillStyle = 'white';
            ctx.font = 'bold 8px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(light.id, pos.x, pos.y + 3);
            
            // 绘制方向指示
            const angleRad;
            if (this.viewMode === 'plan') {
                angleRad = Utils.degToRad(light.angle.y);
            } else {
                angleRad = Utils.degToRad(-light.angle.x); // 侧视图角度
            }
            
            ctx.strokeStyle = this.colors.light;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);
            ctx.lineTo(
                pos.x + Math.cos(angleRad) * 20,
                pos.y + Math.sin(angleRad) * 20
            );
            ctx.stroke();
        }
    },
    
    // 绘制灯束
    drawLightBeam: function(beam, light) {
        const ctx = this.ctx;
        
        // 转换多边形顶点
        const canvasPolygon = beam.polygon.map(p => this.worldToCanvas(p.x, p.y));
        
        // 绘制填充
        ctx.fillStyle = this.colors.lightBeam;
        ctx.beginPath();
        ctx.moveTo(canvasPolygon[0].x, canvasPolygon[0].y);
        for (let i = 1; i < canvasPolygon.length; i++) {
            ctx.lineTo(canvasPolygon[i].x, canvasPolygon[i].y);
        }
        ctx.closePath();
        ctx.fill();
        
        // 绘制边界
        ctx.strokeStyle = this.colors.light;
        ctx.lineWidth = 1;
        ctx.stroke();
    },
    
    // 绘制眩光风险区
    drawGlareRisks: function(risks, data) {
        const ctx = this.ctx;
        
        const glareRisks = risks.filter(r => r.type === 'reflection' || r.type === 'direct');
        
        for (const risk of glareRisks) {
            let color;
            switch (risk.severity) {
                case 'high':
                    color = this.colors.glareHigh;
                    break;
                case 'medium':
                    color = this.colors.glareMedium;
                    break;
                case 'low':
                    color = this.colors.glareLow;
                    break;
            }
            
            // 找到相关的展柜或灯具
            if (risk.type === 'reflection' && risk.caseId) {
                const caseItem = data.cases?.find(c => c.id === risk.caseId);
                if (caseItem) {
                    const pos = this.worldToCanvas(caseItem.position.x, caseItem.position.y);
                    const width = caseItem.width * this.scale;
                    const height = caseItem.height * this.scale;
                    
                    // 绘制半透明覆盖层
                    ctx.fillStyle = color;
                    ctx.fillRect(pos.x, pos.y, width, height);
                    
                    // 绘制警告图标
                    ctx.fillStyle = 'white';
                    ctx.font = 'bold 16px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText('⚠', pos.x + width / 2, pos.y + height / 2 + 5);
                }
            }
            
            if (risk.type === 'direct' && risk.lightId) {
                const light = data.lights?.find(l => l.id === risk.lightId);
                if (light) {
                    const pos = this.worldToCanvas(light.position.x, light.position.y);
                    
                    // 绘制警告圆圈
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.arc(pos.x, pos.y, 20, 0, Math.PI * 2);
                    ctx.stroke();
                }
            }
        }
    },
    
    // 绘制可见区
    drawVisibilityZones: function(data, settings) {
        if (!settings.showVisibility) return;
        
        const ctx = this.ctx;
        
        for (const caseItem of data.cases || []) {
            if (!caseItem.infoPanel) continue;
            
            const visibilityZones = Geometry.calculateInfoPanelVisibility(caseItem, data.paths || []);
            
            for (const zone of visibilityZones) {
                // 绘制可见点
                for (const point of zone.visiblePoints) {
                    const pos = this.worldToCanvas(point.x, point.y);
                    ctx.fillStyle = this.colors.visibilityGood;
                    ctx.beginPath();
                    ctx.arc(pos.x, pos.y, 6, 0, Math.PI * 2);
                    ctx.fill();
                }
                
                // 绘制不可见点
                for (const point of zone.blockedPoints) {
                    const pos = this.worldToCanvas(point.x, point.y);
                    ctx.fillStyle = this.colors.visibilityBad;
                    ctx.beginPath();
                    ctx.arc(pos.x, pos.y, 6, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
    },
    
    // 绘制观众动线
    drawPaths: function(paths, settings) {
        if (!settings.showPaths || !paths) return;
        
        const ctx = this.ctx;
        
        for (const path of paths) {
            if (path.points.length < 2) continue;
            
            // 绘制动线
            ctx.strokeStyle = this.colors.path;
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            
            const firstPoint = this.worldToCanvas(path.points[0].x, path.points[0].y);
            ctx.moveTo(firstPoint.x, firstPoint.y);
            
            for (let i = 1; i < path.points.length; i++) {
                const point = this.worldToCanvas(path.points[i].x, path.points[i].y);
                ctx.lineTo(point.x, point.y);
            }
            ctx.stroke();
            ctx.setLineDash([]);
            
            // 绘制点
            for (const point of path.points) {
                const pos = this.worldToCanvas(point.x, point.y);
                ctx.fillStyle = this.colors.pathPoint;
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);
                ctx.fill();
            }
            
            // 动线标签
            if (path.points.length > 0) {
                const startPoint = this.worldToCanvas(path.points[0].x, path.points[0].y);
                ctx.fillStyle = this.colors.path;
                ctx.font = '10px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(path.id, startPoint.x, startPoint.y - 10);
            }
        }
    },
    
    // 绘制文物
    drawArtifacts: function(artifacts) {
        if (!artifacts) return;
        
        const ctx = this.ctx;
        
        for (const artifact of artifacts) {
            const pos = this.worldToCanvas(
                artifact.position?.x || 0,
                artifact.position?.y || 0
            );
            
            ctx.fillStyle = this.colors.artifact;
            ctx.beginPath();
            ctx.rect(pos.x - 6, pos.y - 6, 12, 12);
            ctx.fill();
            
            ctx.fillStyle = 'white';
            ctx.font = '8px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('文', pos.x, pos.y + 3);
        }
    },
    
    // 主绘制函数
    draw: function(data, settings, risks) {
        // 清空画布
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        // 绘制背景网格
        this.drawGrid();
        
        if (!data) return;
        
        // 计算合适的缩放
        this.calculateFit(data);
        
        // 绘制图层（从底层到顶层）
        this.drawPaths(data.paths, settings);
        this.drawCases(data.cases);
        this.drawArtifacts(data.artifacts);
        this.drawVisibilityZones(data, settings);
        
        if (settings.showGlare && risks) {
            this.drawGlareRisks(risks, data);
        }
        
        this.drawLights(data.lights, settings);
    },
    
    // 绘制对比视图
    drawComparison: function(canvasA, canvasB, dataA, dataB, settings) {
        // 暂时保存当前状态
        const originalCanvas = this.canvas;
        const originalCtx = this.ctx;
        const originalWidth = this.width;
        const originalHeight = this.height;
        
        // 绘制方案A
        this.canvas = canvasA;
        this.ctx = canvasA.getContext('2d');
        this.width = canvasA.width;
        this.height = canvasA.height;
        this.calculateFit(dataA);
        this.draw(dataA, settings, null);
        
        // 绘制方案B
        this.canvas = canvasB;
        this.ctx = canvasB.getContext('2d');
        this.width = canvasB.width;
        this.height = canvasB.height;
        this.calculateFit(dataB);
        this.draw(dataB, settings, null);
        
        // 恢复原始状态
        this.canvas = originalCanvas;
        this.ctx = originalCtx;
        this.width = originalWidth;
        this.height = originalHeight;
    },
    
    // 获取鼠标下的元素
    getElementAtPosition: function(x, y, data) {
        const worldPos = this.canvasToWorld(x, y);
        
        // 检查灯具
        if (data.lights) {
            for (const light of data.lights) {
                let lightPos;
                if (this.viewMode === 'plan') {
                    lightPos = { x: light.position.x, y: light.position.y };
                } else {
                    lightPos = { x: light.position.x, y: light.position.z };
                }
                
                const distance = Utils.distance(
                    worldPos.x, worldPos.y,
                    lightPos.x, lightPos.y
                );
                
                // 点击阈值（0.2米）
                if (distance < 0.2) {
                    return {
                        type: 'light',
                        element: light,
                        distance: distance
                    };
                }
            }
        }
        
        return null;
    }
};
