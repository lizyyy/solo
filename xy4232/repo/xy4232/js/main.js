/**
 * 主入口文件
 * 负责应用初始化和事件绑定
 */

const App = {
    /**
     * 初始化应用
     */
    init() {
        console.log('展线拥堵预演台正在初始化...');

        SpaceModel.init();
        SimulationEngine.init();
        StateStore.init();

        Renderer3D.init('canvas-container');
        Renderer3D.start();

        this.bindEvents();
        this.loadExampleData();

        console.log('展线拥堵预演台初始化完成');
    },

    /**
     * 绑定事件
     */
    bindEvents() {
        const floorplanInput = document.getElementById('floorplanInput');
        floorplanInput.addEventListener('change', async (e) => {
            if (e.target.files.length > 0) {
                const result = await ImportExport.importFloorplan(e.target.files[0]);
                if (result.success) {
                    Renderer3D.refresh();
                    this.updateTimeSlotSelect();
                    alert('展厅平面图导入成功');
                } else {
                    alert('导入失败: ' + result.error);
                }
            }
        });

        const exhibitsInput = document.getElementById('exhibitsInput');
        exhibitsInput.addEventListener('change', async (e) => {
            if (e.target.files.length > 0) {
                const result = await ImportExport.importExhibits(e.target.files[0]);
                if (result.success) {
                    Renderer3D.refresh();
                    alert(`展品清单导入成功，共 ${result.data.length} 个展品`);
                } else {
                    alert('导入失败: ' + result.error);
                }
            }
        });

        const crowdInput = document.getElementById('crowdInput');
        crowdInput.addEventListener('change', async (e) => {
            if (e.target.files.length > 0) {
                const result = await ImportExport.importCrowdSchedule(e.target.files[0]);
                if (result.success) {
                    this.updateTimeSlotSelect();
                    alert(`客流时段表导入成功，共 ${result.data.length} 个时段`);
                } else {
                    alert('导入失败: ' + result.error);
                }
            }
        });

        const accessibilityInput = document.getElementById('accessibilityInput');
        accessibilityInput.addEventListener('change', async (e) => {
            if (e.target.files.length > 0) {
                const result = await ImportExport.importAccessibilityRules(e.target.files[0]);
                if (result.success) {
                    Renderer3D.refresh();
                    alert('无障碍规则导入成功');
                } else {
                    alert('导入失败: ' + result.error);
                }
            }
        });

        document.getElementById('loadExampleBtn').addEventListener('click', () => {
            this.loadExampleData();
            alert('示例数据已加载');
        });

        document.getElementById('importBtn').addEventListener('click', () => {
            document.getElementById('sceneInput').click();
        });

        const sceneInput = document.getElementById('sceneInput');
        sceneInput.addEventListener('change', async (e) => {
            if (e.target.files.length > 0) {
                const result = await ImportExport.importScene(e.target.files[0]);
                if (result.success) {
                    Renderer3D.refresh();
                    this.updateTimeSlotSelect();
                    alert('场景导入成功');
                } else {
                    alert('导入失败: ' + result.error);
                }
            }
        });

        document.getElementById('saveBtn').addEventListener('click', () => {
            ImportExport.saveScheme();
        });

        document.getElementById('exportReportBtn').addEventListener('click', () => {
            if (!SimulationEngine.isRunning && SimulationEngine.getRisks().length === 0) {
                alert('请先运行仿真以生成报告数据');
                return;
            }
            ImportExport.exportMarkdownReport();
        });

        document.getElementById('exportRiskBtn').addEventListener('click', () => {
            ImportExport.exportRiskCSV();
        });

        document.getElementById('exportSceneBtn').addEventListener('click', () => {
            if (!SpaceModel.isComplete()) {
                alert('请先导入展厅平面图和展品清单');
                return;
            }
            ImportExport.exportScene();
        });

        document.getElementById('startSimBtn').addEventListener('click', () => {
            const timeSlotSelect = document.getElementById('timeSlotSelect');
            const selectedTimeSlot = timeSlotSelect.value;

            if (!selectedTimeSlot) {
                alert('请选择一个时段');
                return;
            }

            if (!SpaceModel.isComplete()) {
                alert('请先导入展厅平面图和展品清单');
                return;
            }

            try {
                SimulationEngine.start(selectedTimeSlot);
                document.getElementById('startSimBtn').disabled = true;
                document.getElementById('pauseSimBtn').disabled = false;
                document.getElementById('resetSimBtn').disabled = false;
            } catch (error) {
                alert('启动仿真失败: ' + error.message);
            }
        });

        document.getElementById('pauseSimBtn').addEventListener('click', () => {
            if (SimulationEngine.isPaused) {
                SimulationEngine.resume();
                document.getElementById('pauseSimBtn').textContent = '暂停';
            } else {
                SimulationEngine.pause();
                document.getElementById('pauseSimBtn').textContent = '继续';
            }
        });

        document.getElementById('resetSimBtn').addEventListener('click', () => {
            SimulationEngine.reset();
            Renderer3D.updateVisitors();
            Renderer3D.updateRiskZones();
            document.getElementById('startSimBtn').disabled = false;
            document.getElementById('pauseSimBtn').disabled = true;
            document.getElementById('pauseSimBtn').textContent = '暂停';
            document.getElementById('resetSimBtn').disabled = true;
            this.updateStats();
        });

        const simSpeed = document.getElementById('simSpeed');
        const speedValue = document.getElementById('speedValue');
        
        simSpeed.addEventListener('input', (e) => {
            const speed = parseFloat(e.target.value);
            SimulationEngine.setSpeed(speed);
            speedValue.textContent = `${speed}x`;
        });
    },

    /**
     * 更新时段选择下拉框
     */
    updateTimeSlotSelect() {
        const timeSlotSelect = document.getElementById('timeSlotSelect');
        const timeSlots = SpaceModel.getTimeSlots();

        timeSlotSelect.innerHTML = '<option value="">请选择时段</option>';
        
        timeSlots.forEach(timeSlot => {
            const option = document.createElement('option');
            option.value = timeSlot.id;
            option.textContent = `${timeSlot.name} (${timeSlot.startTime}-${timeSlot.endTime}, ${timeSlot.visitorCount}人)`;
            timeSlotSelect.appendChild(option);
        });
    },

    /**
     * 更新统计数据
     */
    updateStats() {
        const stats = SimulationEngine.getStats();
        
        document.getElementById('totalVisitors').textContent = stats.totalVisitors;
        document.getElementById('movingVisitors').textContent = stats.movingVisitors;
        document.getElementById('congestedAreas').textContent = stats.congestedAreas;
        document.getElementById('accessDetours').textContent = stats.accessDetours;

        const riskListEl = document.getElementById('riskList');
        riskListEl.innerHTML = '<p>暂无风险点</p>';
    },

    /**
     * 加载示例数据
     */
    loadExampleData() {
        const exampleFloorplan = {
            id: 'example_hall',
            name: '示例展厅',
            width: 40,
            height: 30,
            walls: [
                { id: 'wall_1', start: { x: -20, y: -15 }, end: { x: 20, y: -15 }, height: 3, thickness: 0.2 },
                { id: 'wall_2', start: { x: 20, y: -15 }, end: { x: 20, y: 15 }, height: 3, thickness: 0.2 },
                { id: 'wall_3', start: { x: 20, y: 15 }, end: { x: -20, y: 15 }, height: 3, thickness: 0.2 },
                { id: 'wall_4', start: { x: -20, y: 15 }, end: { x: -20, y: -15 }, height: 3, thickness: 0.2 },
                { id: 'wall_5', start: { x: -10, y: -5 }, end: { x: -10, y: 10 }, height: 3, thickness: 0.2 },
                { id: 'wall_6', start: { x: 10, y: -10 }, end: { x: 10, y: 5 }, height: 3, thickness: 0.2 }
            ],
            entrances: [
                { id: 'entrance_1', name: '主入口', position: { x: 0, y: -14 }, width: 3, capacity: 100 }
            ],
            exits: [
                { id: 'exit_1', name: '主出口', position: { x: 0, y: 14 }, width: 3 },
                { id: 'exit_2', name: '侧出口', position: { x: 19, y: 0 }, width: 2 }
            ],
            fireExits: [
                { id: 'fire_1', name: '消防通道A', position: { x: -15, y: 10 }, width: 1.5, clearZone: 2 },
                { id: 'fire_2', name: '消防通道B', position: { x: 15, y: -10 }, width: 1.5, clearZone: 2 }
            ],
            accessibilityPaths: [
                { id: 'access_1', name: '无障碍主通道', start: { x: 0, y: -12 }, end: { x: 0, y: 12 }, width: 1.8, hasRamp: false, slope: 0 }
            ]
        };

        const exampleExhibits = [
            {
                id: 'exhibit_1',
                name: '镇馆之宝',
                x: 0, y: 0,
                width: 3, depth: 3, height: 2.5,
                popularity: 0.95,
                viewingTime: 60,
                category: '国宝级',
                description: '最受欢迎的展品'
            },
            {
                id: 'exhibit_2',
                name: '恐龙化石',
                x: -15, y: -5,
                width: 5, depth: 2, height: 3,
                popularity: 0.85,
                viewingTime: 45,
                category: '古生物',
                description: '大型化石展品'
            },
            {
                id: 'exhibit_3',
                name: '古代瓷器',
                x: 15, y: 5,
                width: 2, depth: 2, height: 1.5,
                popularity: 0.7,
                viewingTime: 30,
                category: '文物',
                description: '精美瓷器展柜'
            },
            {
                id: 'exhibit_4',
                name: '现代艺术',
                x: -5, y: 10,
                width: 2.5, depth: 2.5, height: 2,
                popularity: 0.6,
                viewingTime: 25,
                category: '艺术',
                description: '现代艺术装置'
            },
            {
                id: 'exhibit_5',
                name: '历史文献',
                x: 5, y: -10,
                width: 2, depth: 1.5, height: 1.2,
                popularity: 0.5,
                viewingTime: 20,
                category: '文献',
                description: '珍贵历史文献'
            }
        ];

        const exampleTimeSlots = [
            {
                id: 'slot_1',
                name: '早高峰',
                startTime: '09:00',
                endTime: '10:00',
                visitorCount: 80,
                entrance: 'entrance_1',
                description: '开馆第一小时'
            },
            {
                id: 'slot_2',
                name: '午间时段',
                startTime: '11:00',
                endTime: '12:00',
                visitorCount: 50,
                entrance: 'entrance_1',
                description: '午间人流相对较少'
            },
            {
                id: 'slot_3',
                name: '下午高峰',
                startTime: '14:00',
                endTime: '15:00',
                visitorCount: 120,
                entrance: 'entrance_1',
                description: '全天最繁忙时段'
            },
            {
                id: 'slot_4',
                name: '晚间时段',
                startTime: '17:00',
                endTime: '18:00',
                visitorCount: 40,
                entrance: 'entrance_1',
                description: '闭馆前最后一小时'
            }
        ];

        const exampleAccessibilityRules = {
            maxDetourDistance: 50,
            preferredPathWidth: 1.5,
            maxSlope: 0.083,
            requiredClearZone: 1.5,
            priorityZones: [
                {
                    id: 'priority_1',
                    name: '无障碍观展区',
                    center: { x: 0, y: 0 },
                    radius: 5
                }
            ],
            avoidZones: []
        };

        SpaceModel.setFloorplan(exampleFloorplan);
        SpaceModel.setExhibits(exampleExhibits);
        SpaceModel.setTimeSlots(exampleTimeSlots);
        SpaceModel.setAccessibilityRules(exampleAccessibilityRules);

        Renderer3D.refresh();
        this.updateTimeSlotSelect();
        StateStore.saveSpaceModel();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
