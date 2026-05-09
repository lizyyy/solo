import { SceneManager } from './SceneManager.js';
import { PointManager } from './PointManager.js';
import { RouteManager } from './RouteManager.js';
import { AnalysisManager } from './AnalysisManager.js';
import { StorageManager } from './StorageManager.js';

class App {
    constructor() {
        this.sceneManager = new SceneManager('canvas-container');
        this.pointManager = new PointManager();
        this.routeManager = new RouteManager(this.pointManager, this.sceneManager);
        this.analysisManager = new AnalysisManager(this.pointManager, this.routeManager, this.sceneManager);
        this.storageManager = new StorageManager();
        
        this.selectedPointId = null;
        this.lastAnalysisData = null;
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.loadSavedSchemes();
        this.generateDemo();
    }
    
    setupEventListeners() {
        this.sceneManager.setOnSelectCallback((pointId) => this.onPointSelect(pointId));
        this.sceneManager.setOnDragCallback((pointId, position) => this.onPointDrag(pointId, position));
        this.sceneManager.setOnDragEndCallback(() => this.onPointDragEnd());
        
        this.routeManager.setOnPointVisitCallback((pointId) => this.onPointVisit(pointId));
        this.routeManager.setOnPlaybackEndCallback(() => this.onPlaybackEnd());
        
        this.bindUIEvents();
    }
    
    bindUIEvents() {
        document.getElementById('btn-reset-view').addEventListener('click', () => {
            this.sceneManager.resetView();
            this.updateStatus('视角已重置');
        });
        
        document.getElementById('btn-toggle-wireframe').addEventListener('click', () => {
            const enabled = this.sceneManager.toggleWireframe();
            this.updateStatus(enabled ? '线框模式已开启' : '线框模式已关闭');
        });
        
        document.getElementById('show-labels').addEventListener('change', (e) => {
            this.sceneManager.showLabels = e.target.checked;
            this.sceneManager.toggleLabels();
            this.updateStatus(e.target.checked ? '显示标签' : '隐藏标签');
        });
        
        document.getElementById('show-boundary').addEventListener('change', (e) => {
            this.sceneManager.showBoundary = e.target.checked;
            this.sceneManager.toggleBoundary();
            this.updateStatus(e.target.checked ? '显示边界' : '隐藏边界');
        });
        
        document.getElementById('btn-add-point').addEventListener('click', () => {
            const point = this.pointManager.addRandomPoint();
            this.sceneManager.addPointMesh(point);
            this.updatePointList();
            this.updateRouteInfo();
            this.updateStatus(`已添加点: ${point.name}`);
        });
        
        document.getElementById('btn-clear-points').addEventListener('click', () => {
            this.pointManager.clearAllPoints();
            this.sceneManager.clearAll();
            this.selectedPointId = null;
            this.updatePointList();
            this.updateRouteInfo();
            this.updateMarkList();
            this.updateStatus('所有点位已清除');
        });
        
        document.getElementById('btn-generate-demo').addEventListener('click', () => {
            this.generateDemo();
        });
        
        document.getElementById('btn-auto-route').addEventListener('click', () => {
            const route = this.routeManager.autoPlanRoute();
            this.updateRouteInfo();
            if (route.length > 0) {
                this.updateStatus(`自动规划路线完成，共 ${route.length} 个点位`);
            } else {
                this.updateStatus('点位不足，无法规划路线');
            }
        });
        
        document.getElementById('btn-clear-route').addEventListener('click', () => {
            this.routeManager.clearRoute();
            this.pointManager.getAllPoints().forEach(p => {
                this.sceneManager.updatePointMesh(p);
            });
            this.updateRouteInfo();
            this.updateStatus('路线已清除');
        });
        
        document.getElementById('btn-play').addEventListener('click', () => {
            const info = this.routeManager.getRouteInfo();
            if (info.isPaused) {
                this.routeManager.resumePlayback();
                this.updateStatus('继续播放');
            } else if (!info.isPlaying) {
                this.routeManager.startPlayback(30);
                this.updateStatus('开始播放巡检路线');
            }
        });
        
        document.getElementById('btn-pause').addEventListener('click', () => {
            this.routeManager.pausePlayback();
            this.updateStatus('已暂停');
        });
        
        document.getElementById('btn-stop').addEventListener('click', () => {
            this.routeManager.stopPlayback();
            this.updateStatus('已停止');
        });
        
        document.getElementById('btn-analyze').addEventListener('click', () => {
            this.runAnalysis();
        });
        
        document.getElementById('btn-save').addEventListener('click', () => {
            this.saveScheme();
        });
        
        document.getElementById('btn-load').addEventListener('click', () => {
            this.loadSelectedScheme();
        });
        
        document.getElementById('btn-export').addEventListener('click', () => {
            this.exportReport();
        });
        
        document.getElementById('btn-mark-current').addEventListener('click', () => {
            this.markSelectedPoint();
        });
        
        document.getElementById('btn-clear-marks').addEventListener('click', () => {
            this.pointManager.clearMarks();
            this.pointManager.getAllPoints().forEach(p => {
                this.sceneManager.updatePointMesh(p);
            });
            this.updateMarkList();
            this.updateStatus('所有异常标记已清除');
        });
    }
    
    generateDemo() {
        this.pointManager.clearAllPoints();
        this.sceneManager.clearAll();
        this.routeManager.clearRoute();
        
        const points = this.pointManager.generateDemoData();
        points.forEach(point => {
            this.sceneManager.addPointMesh(point);
        });
        
        this.routeManager.autoPlanRoute();
        
        this.updatePointList();
        this.updateRouteInfo();
        this.updateStatus('示例数据已生成，包含3条管线共15个点位');
    }
    
    onPointSelect(pointId) {
        this.selectedPointId = pointId;
        this.routeManager.addPointToRoute(pointId);
        this.updatePointList();
        this.updateRouteInfo();
        
        const point = this.pointManager.getPoint(pointId);
        this.updateStatus(`选中点: ${point.name} (${point.x.toFixed(1)}, ${point.y.toFixed(1)}, ${point.z.toFixed(1)})`);
    }
    
    onPointDrag(pointId, position) {
        const point = this.pointManager.updatePointPosition(
            pointId,
            position.x,
            position.y,
            position.z
        );
        this.routeManager.updateRouteDisplay();
    }
    
    onPointDragEnd() {
        this.updatePointList();
        this.updateStatus('点位位置已更新');
    }
    
    onPointVisit(pointId) {
        const point = this.pointManager.getPoint(pointId);
        if (point) {
            this.sceneManager.updatePointMesh(point);
        }
        this.updateRouteInfo();
    }
    
    onPlaybackEnd() {
        this.updateStatus('巡检路线播放完成');
        const coverage = this.analysisManager.calculateCoverage();
        if (coverage.unvisitedCount > 0) {
            this.updateStatus(`播放完成，但有 ${coverage.unvisitedCount} 个点位未覆盖`);
        }
    }
    
    runAnalysis() {
        const result = this.analysisManager.runFullAnalysis();
        this.lastAnalysisData = result;
        
        const collisionEl = document.getElementById('collision-status');
        const boundaryEl = document.getElementById('boundary-status');
        const coverageEl = document.getElementById('coverage-rate');
        
        if (result.pointCollisions.valid && result.routeCollisions.valid) {
            collisionEl.textContent = '无碰撞';
            collisionEl.className = 'info-value status-ok';
        } else {
            collisionEl.textContent = `发现 ${result.pointCollisions.collisionCount + result.routeCollisions.collisionCount} 个问题`;
            collisionEl.className = 'info-value status-error';
        }
        
        if (result.boundary.valid) {
            boundaryEl.textContent = '在范围内';
            boundaryEl.className = 'info-value status-ok';
        } else {
            boundaryEl.textContent = '超出边界';
            boundaryEl.className = 'info-value status-error';
        }
        
        coverageEl.textContent = `${result.coverage.coverageRate}%`;
        coverageEl.className = result.coverage.coverageRate === 100
            ? 'info-value status-ok'
            : 'info-value status-warning';
        
        this.updateStatus(result.valid
            ? '分析完成：路线合格'
            : `分析完成：发现 ${result.totalIssues} 个问题`);
    }
    
    saveScheme() {
        const name = prompt('请输入方案名称:', `方案 ${new Date().toLocaleString()}`);
        if (!name) return;
        
        const pointData = this.pointManager.exportData();
        const routeData = this.routeManager.exportRoute();
        
        const scheme = this.storageManager.saveScheme(name, pointData, routeData, this.lastAnalysisData);
        this.loadSavedSchemes();
        this.updateStatus(`方案 "${name}" 已保存`);
    }
    
    loadSavedSchemes() {
        const schemes = this.storageManager.loadAllSchemes();
        const container = document.getElementById('saved-schemes');
        container.innerHTML = '';
        
        if (schemes.length === 0) {
            container.innerHTML = '<div style="color:#a0a0a0;font-size:12px;padding:10px;">暂无保存的方案</div>';
            return;
        }
        
        schemes.forEach(scheme => {
            const div = document.createElement('div');
            div.className = 'list-item';
            div.innerHTML = `
                <strong>${scheme.name}</strong><br>
                <small>${new Date(scheme.createdAt).toLocaleString()}</small>
            `;
            div.addEventListener('click', () => {
                container.querySelectorAll('.list-item').forEach(el => el.classList.remove('active'));
                div.classList.add('active');
                div.dataset.schemeId = scheme.id;
            });
            container.appendChild(div);
        });
    }
    
    loadSelectedScheme() {
        const activeItem = document.querySelector('#saved-schemes .list-item.active');
        if (!activeItem) {
            this.updateStatus('请先选择一个方案');
            return;
        }
        
        const schemeId = parseInt(activeItem.dataset.schemeId);
        const scheme = this.storageManager.loadScheme(schemeId);
        
        if (scheme) {
            this.pointManager.clearAllPoints();
            this.sceneManager.clearAll();
            this.routeManager.clearRoute();
            
            this.pointManager.importData(scheme.points);
            this.routeManager.importRoute(scheme.route);
            this.lastAnalysisData = scheme.analysis;
            
            this.pointManager.getAllPoints().forEach(p => {
                this.sceneManager.addPointMesh(p);
            });
            
            this.updatePointList();
            this.updateRouteInfo();
            this.updateMarkList();
            this.updateStatus(`已加载方案: ${scheme.name}`);
        }
    }
    
    exportReport() {
        const pointData = this.pointManager.exportData();
        const routeData = this.routeManager.exportRoute();
        
        const report = this.storageManager.exportReport(this.lastAnalysisData, pointData, routeData);
        const filename = `巡检报告_${new Date().toISOString().slice(0, 10)}.txt`;
        this.storageManager.downloadReport(filename, report);
        
        this.storageManager.exportJSON({
            points: pointData,
            route: routeData,
            analysis: this.lastAnalysisData,
            exportDate: new Date().toISOString()
        }, `巡检数据_${new Date().toISOString().slice(0, 10)}.json`);
        
        this.updateStatus('报告和数据已导出');
    }
    
    markSelectedPoint() {
        if (!this.selectedPointId) {
            this.updateStatus('请先选择一个点位');
            return;
        }
        
        const reason = prompt('请输入异常原因:', '');
        const point = this.pointManager.markPoint(this.selectedPointId, reason);
        
        if (point) {
            this.sceneManager.updatePointMesh(point);
            this.updateMarkList();
            this.updateStatus(`已标记点位: ${point.name}`);
        }
    }
    
    updatePointList() {
        const points = this.pointManager.getAllPoints();
        const container = document.getElementById('point-list');
        const totalEl = document.getElementById('total-points');
        
        totalEl.textContent = points.length;
        container.innerHTML = '';
        
        points.forEach(point => {
            const div = document.createElement('div');
            div.className = 'list-item';
            if (point.id === this.selectedPointId) {
                div.classList.add('active');
            }
            
            const route = this.routeManager.getRoute();
            const inRoute = route.includes(point.id);
            
            div.innerHTML = `
                <strong>${point.name}</strong>
                ${point.isMarked ? '<span style="color:#e74c3c;"> ⚠</span>' : ''}
                ${inRoute ? '<span style="color:#27ae60;"> ✓</span>' : ''}
                <br>
                <small>(${point.x.toFixed(1)}, ${point.y.toFixed(1)}, ${point.z.toFixed(1)})</small>
            `;
            
            div.addEventListener('click', () => {
                this.selectedPointId = point.id;
                this.updatePointList();
            });
            
            container.appendChild(div);
        });
    }
    
    updateRouteInfo() {
        const info = this.routeManager.getRouteInfo();
        
        document.getElementById('route-length').textContent = `${info.totalDistance.toFixed(2)} 米`;
        document.getElementById('route-points').textContent = info.totalPoints;
        document.getElementById('missing-points').textContent = this.routeManager.getMissingPointIds().length;
    }
    
    updateMarkList() {
        const marked = this.pointManager.getMarkedPoints();
        const container = document.getElementById('mark-list');
        container.innerHTML = '';
        
        if (marked.length === 0) {
            container.innerHTML = '<div style="color:#a0a0a0;font-size:12px;padding:10px;">暂无异常标记</div>';
            return;
        }
        
        marked.forEach(point => {
            const div = document.createElement('div');
            div.className = 'list-item';
            div.innerHTML = `
                <span style="color:#e74c3c;">⚠</span>
                <strong>${point.name}</strong><br>
                <small>${point.markReason || '异常'}</small>
            `;
            container.appendChild(div);
        });
    }
    
    updateStatus(message) {
        document.getElementById('status-message').textContent = message;
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new App();
});