class UIManager {
    constructor(sceneManager, robotController, reportGenerator, pathfinding) {
        this.sceneManager = sceneManager;
        this.robotController = robotController;
        this.reportGenerator = reportGenerator;
        this.pathfinding = pathfinding;
        
        this.initEventListeners();
    }

    initEventListeners() {
        document.getElementById('btn-load-sample').addEventListener('click', () => {
            this.loadSampleData();
        });

        document.getElementById('btn-import').addEventListener('click', () => {
            document.getElementById('file-import').click();
        });

        document.getElementById('file-import').addEventListener('change', (e) => {
            this.importData(e.target.files[0]);
        });

        document.getElementById('btn-add-point').addEventListener('click', () => {
            this.sceneManager.setAddMode('inspectionPoint');
        });

        document.getElementById('btn-add-obstacle').addEventListener('click', () => {
            this.sceneManager.setAddMode('obstacle');
        });

        document.getElementById('btn-add-charger').addEventListener('click', () => {
            this.sceneManager.setAddMode('charger');
        });

        document.getElementById('filter-points').addEventListener('change', (e) => {
            this.sceneManager.setFilter('points', e.target.checked);
        });

        document.getElementById('filter-obstacles').addEventListener('change', (e) => {
            this.sceneManager.setFilter('obstacles', e.target.checked);
        });

        document.getElementById('filter-path').addEventListener('change', (e) => {
            this.sceneManager.setFilter('path', e.target.checked);
        });

        document.getElementById('btn-start').addEventListener('click', () => {
            this.startInspection();
        });

        document.getElementById('btn-pause').addEventListener('click', () => {
            this.robotController.pause();
        });

        document.getElementById('btn-reset').addEventListener('click', () => {
            this.robotController.reset();
            this.resetPointColors();
        });

        document.getElementById('speed-slider').addEventListener('input', (e) => {
            const speed = parseFloat(e.target.value);
            document.getElementById('speed-value').textContent = speed.toFixed(1);
            this.robotController.setPlaybackSpeed(speed);
        });

        document.getElementById('btn-view-top').addEventListener('click', () => {
            this.sceneManager.setViewMode('top');
        });

        document.getElementById('btn-view-3d').addEventListener('click', () => {
            this.sceneManager.setViewMode('3d');
        });

        document.getElementById('btn-view-follow').addEventListener('click', () => {
            this.sceneManager.setViewMode('follow');
        });

        document.getElementById('timeline-slider').addEventListener('input', (e) => {
            if (!this.robotController.isRunning) {
                this.robotController.seekTo(parseFloat(e.target.value));
            }
        });

        document.getElementById('btn-delete').addEventListener('click', () => {
            this.sceneManager.deleteSelected();
        });

        document.getElementById('btn-export').addEventListener('click', () => {
            this.exportReport();
        });

        window.addEventListener('sceneChanged', () => {
            this.updatePathfinding();
        });

        this.robotController.onComplete = (report) => {
            this.showNotification('巡检完成！', 'success');
        };

        this.robotController.onLowBattery = (battery) => {
            this.showNotification(`低电量警告！当前电量: ${battery.toFixed(1)}%`, 'warning');
        };
    }

    loadSampleData() {
        const sampleData = this.getSampleData();
        this.loadData(sampleData);
        this.sceneManager.updateStatus('已加载样例楼层数据');
        this.showNotification('样例数据加载成功', 'success');
    }

    getSampleData() {
        return {
            floor: {
                width: 40,
                depth: 30
            },
            inspectionPoints: [
                { id: 1, name: '前台区域', x: -12, z: -8, priority: 'high', duration: 5 },
                { id: 2, name: '会议室A', x: -5, z: 5, priority: 'normal', duration: 8 },
                { id: 3, name: '会议室B', x: 5, z: 5, priority: 'normal', duration: 8 },
                { id: 4, name: '办公区1', x: -10, z: 10, priority: 'low', duration: 3 },
                { id: 5, name: '办公区2', x: 0, z: 12, priority: 'low', duration: 3 },
                { id: 6, name: '办公区3', x: 10, z: 10, priority: 'low', duration: 3 },
                { id: 7, name: '机房', x: 12, z: -8, priority: 'high', duration: 10 },
                { id: 8, name: '茶水间', x: 0, z: -10, priority: 'normal', duration: 5 }
            ],
            obstacles: [
                { id: 1, name: '承重柱1', x: -8, z: 0, width: 2, depth: 2, height: 3 },
                { id: 2, name: '承重柱2', x: 8, z: 0, width: 2, depth: 2, height: 3 },
                { id: 3, name: '储物柜', x: -15, z: -5, width: 3, depth: 1.5, height: 2.5 },
                { id: 4, name: '文件柜', x: 15, z: -5, width: 3, depth: 1.5, height: 2.5 },
                { id: 5, name: '隔断墙', x: 0, z: 8, width: 8, depth: 0.5, height: 2 }
            ],
            chargers: [
                { id: 1, x: -15, z: -12 }
            ]
        };
    }

    loadData(data) {
        this.sceneManager.clearAll();
        
        this.sceneManager.createFloor(data.floor);
        
        data.inspectionPoints.forEach(p => {
            this.sceneManager.addInspectionPoint(p);
        });
        
        data.obstacles.forEach(o => {
            this.sceneManager.addObstacle(o);
        });
        
        data.chargers.forEach(c => {
            this.sceneManager.addCharger(c);
        });
        
        this.updatePathfinding();
        
        if (data.chargers.length > 0) {
            this.robotController.setChargerPosition(data.chargers[0]);
        }
    }

    updatePathfinding() {
        const sceneData = this.sceneManager.getSceneData();
        
        if (!sceneData.floor) return;
        
        if (sceneData.chargers.length > 0) {
            const newChargerPos = sceneData.chargers[0];
            this.robotController.setChargerPosition(newChargerPos);
            
            if (!this.robotController.isRunning && !this.robotController.isPaused) {
                this.robotController.position = { ...newChargerPos };
                this.sceneManager.updateRobotPosition(this.robotController.position, 0);
            }
        }
        
        const obstacles = sceneData.obstacles.map(o => ({
            x: o.x,
            z: o.z,
            width: o.width,
            depth: o.depth
        }));
        
        this.pathfinding.buildGrid(sceneData.floor, obstacles);
        
        const inspectionPoints = sceneData.inspectionPoints.map(p => ({
            ...p,
            mesh: this.sceneManager.inspectionPoints.find(ip => ip.id === p.id)?.mesh
        }));
        
        if (inspectionPoints.length > 0 && this.robotController.chargerPosition) {
            if (!this.robotController.isRunning && !this.robotController.isPaused) {
                const result = this.robotController.planRoute(inspectionPoints);
            }
        }
    }

    startInspection() {
        const sceneData = this.sceneManager.getSceneData();
        
        if (sceneData.inspectionPoints.length === 0) {
            this.showNotification('请先添加巡检点', 'error');
            return;
        }
        
        if (!this.robotController.chargerPosition) {
            this.showNotification('请先设置充电桩位置', 'error');
            return;
        }
        
        const inspectionPoints = sceneData.inspectionPoints.map(p => ({
            ...p,
            mesh: this.sceneManager.inspectionPoints.find(ip => ip.id === p.id)?.mesh
        }));
        
        this.resetPointColors();
        
        this.robotController.planRoute(inspectionPoints);
        this.robotController.start();
    }

    resetPointColors() {
        this.sceneManager.inspectionPoints.forEach(p => {
            p.mesh.material.color.setHex(0x2196F3);
        });
    }

    importData(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                this.loadData(data);
                this.showNotification('数据导入成功', 'success');
            } catch (err) {
                this.showNotification('数据格式错误', 'error');
            }
        };
        reader.readAsText(file);
    }

    exportReport() {
        const reportData = this.robotController.getReport();
        const sceneData = this.sceneManager.getSceneData();
        
        if (reportData.events.length === 0) {
            this.showNotification('请先运行巡检任务', 'warning');
            return;
        }
        
        this.reportGenerator.downloadReport(reportData, sceneData);
        this.showNotification('报告导出成功', 'success');
    }

    showNotification(message, type = 'info') {
        const colors = {
            success: '#48bb78',
            warning: '#ed8936',
            error: '#f56565',
            info: '#4299e1'
        };
        
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            padding: 12px 24px;
            background: ${colors[type]};
            color: white;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            animation: slideDown 0.3s ease;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideUp 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 2500);
    }
}

const style = document.createElement('style');
style.textContent = `
    @keyframes slideDown {
        from { transform: translateX(-50%) translateY(-100%); opacity: 0; }
        to { transform: translateX(-50%) translateY(0); opacity: 1; }
    }
    @keyframes slideUp {
        from { transform: translateX(-50%) translateY(0); opacity: 1; }
        to { transform: translateX(-50%) translateY(-100%); opacity: 0; }
    }
`;
document.head.appendChild(style);