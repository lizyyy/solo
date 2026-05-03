/**
 * 3D渲染模块
 * 负责使用Three.js渲染3D展厅场景
 */

const Renderer3D = {
    container: null,
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    raycaster: null,
    mouse: null,
    
    objects: {
        floor: null,
        walls: [],
        exhibits: [],
        visitors: [],
        entrances: [],
        exits: [],
        fireExits: [],
        accessibilityPaths: [],
        riskZones: []
    },

    hoverObject: null,
    animationId: null,
    lastTime: 0,

    /**
     * 初始化3D渲染器
     */
    init(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            throw new Error(`未找到容器元素: ${containerId}`);
        }

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a2e);
        this.scene.fog = new THREE.Fog(0x1a1a2e, 50, 200);

        const aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
        this.camera.position.set(20, 25, 20);
        this.camera.lookAt(0, 0, 0);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);

        this.setupLights();
        this.setupControls();
        this.setupEventListeners();

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        return this;
    },

    /**
     * 设置灯光
     */
    setupLights() {
        const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(20, 40, 20);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 100;
        directionalLight.shadow.camera.left = -50;
        directionalLight.shadow.camera.right = 50;
        directionalLight.shadow.camera.top = 50;
        directionalLight.shadow.camera.bottom = -50;
        this.scene.add(directionalLight);

        const fillLight = new THREE.DirectionalLight(0x8888ff, 0.3);
        fillLight.position.set(-20, 20, -20);
        this.scene.add(fillLight);
    },

    /**
     * 设置控制
     */
    setupControls() {
        let isDragging = false;
        let previousMousePosition = { x: 0, y: 0 };
        let cameraDistance = 35;
        let cameraTheta = Math.PI / 4;
        let cameraPhi = Math.PI / 4;

        const updateCamera = () => {
            this.camera.position.x = cameraDistance * Math.sin(cameraPhi) * Math.cos(cameraTheta);
            this.camera.position.y = cameraDistance * Math.cos(cameraPhi);
            this.camera.position.z = cameraDistance * Math.sin(cameraPhi) * Math.sin(cameraTheta);
            this.camera.lookAt(0, 0, 0);
        };

        this.renderer.domElement.addEventListener('mousedown', (e) => {
            isDragging = true;
            previousMousePosition = { x: e.clientX, y: e.clientY };
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const deltaX = e.clientX - previousMousePosition.x;
                const deltaY = e.clientY - previousMousePosition.y;

                cameraTheta -= deltaX * 0.005;
                cameraPhi = Math.max(0.1, Math.min(Math.PI / 2 - 0.1, cameraPhi - deltaY * 0.005));

                updateCamera();
                previousMousePosition = { x: e.clientX, y: e.clientY };
            }
        });

        this.renderer.domElement.addEventListener('wheel', (e) => {
            e.preventDefault();
            cameraDistance = Math.max(10, Math.min(100, cameraDistance + e.deltaY * 0.05));
            updateCamera();
        }, { passive: false });

        this.renderer.domElement.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });

        this.controls = {
            reset: () => {
                cameraDistance = 35;
                cameraTheta = Math.PI / 4;
                cameraPhi = Math.PI / 4;
                updateCamera();
            }
        };
    },

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        window.addEventListener('resize', () => this.onResize());

        this.renderer.domElement.addEventListener('mousemove', (e) => {
            const rect = this.renderer.domElement.getBoundingClientRect();
            this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        });
    },

    /**
     * 窗口大小调整
     */
    onResize() {
        if (!this.container) return;
        this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    },

    /**
     * 清空场景
     */
    clear() {
        if (this.objects.floor) {
            this.scene.remove(this.objects.floor);
        }
        
        this.objects.walls.forEach(wall => this.scene.remove(wall));
        this.objects.exhibits.forEach(exhibit => this.scene.remove(exhibit.mesh));
        this.objects.visitors.forEach(visitor => this.scene.remove(visitor.mesh));
        this.objects.entrances.forEach(entrance => this.scene.remove(entrance.mesh));
        this.objects.exits.forEach(exit => this.scene.remove(exit.mesh));
        this.objects.fireExits.forEach(fireExit => this.scene.remove(fireExit.mesh));
        this.objects.accessibilityPaths.forEach(path => this.scene.remove(path.mesh));
        this.objects.riskZones.forEach(zone => this.scene.remove(zone.mesh));

        this.objects = {
            floor: null,
            walls: [],
            exhibits: [],
            visitors: [],
            entrances: [],
            exits: [],
            fireExits: [],
            accessibilityPaths: [],
            riskZones: []
        };
    },

    /**
     * 构建场景
     */
    buildScene() {
        this.clear();

        const floorplan = SpaceModel.getFloorplan();
        if (!floorplan) return;

        this.buildFloor(floorplan);
        this.buildWalls(floorplan);
        this.buildEntrances(floorplan);
        this.buildExits(floorplan);
        this.buildFireExits(floorplan);
        this.buildAccessibilityPaths(floorplan);
        this.buildExhibits();
    },

    /**
     * 构建地板
     */
    buildFloor(floorplan) {
        const geometry = new THREE.PlaneGeometry(floorplan.width, floorplan.height);
        const material = new THREE.MeshStandardMaterial({
            color: 0x2d3436,
            roughness: 0.8,
            metalness: 0.1
        });
        
        const floor = new THREE.Mesh(geometry, material);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        floor.userData = { type: 'floor' };
        
        this.scene.add(floor);
        this.objects.floor = floor;

        const gridHelper = new THREE.GridHelper(
            Math.max(floorplan.width, floorplan.height),
            20,
            0x4a5568,
            0x2d3748
        );
        this.scene.add(gridHelper);
    },

    /**
     * 构建墙体
     */
    buildWalls(floorplan) {
        floorplan.walls.forEach(wall => {
            const start = new THREE.Vector3(wall.start.x, 0, wall.start.y);
            const end = new THREE.Vector3(wall.end.x, 0, wall.end.y);
            const direction = end.clone().sub(start);
            const length = direction.length();

            const geometry = new THREE.BoxGeometry(length, wall.height, wall.thickness);
            const material = new THREE.MeshStandardMaterial({
                color: 0x636e72,
                roughness: 0.7,
                metalness: 0.1
            });

            const wallMesh = new THREE.Mesh(geometry, material);
            wallMesh.castShadow = true;
            wallMesh.receiveShadow = true;

            const center = start.clone().add(direction.multiplyScalar(0.5));
            wallMesh.position.copy(center);
            wallMesh.position.y = wall.height / 2;

            const angle = Math.atan2(end.z - start.z, end.x - start.x);
            wallMesh.rotation.y = -angle;

            wallMesh.userData = { type: 'wall', data: wall };
            
            this.scene.add(wallMesh);
            this.objects.walls.push(wallMesh);
        });
    },

    /**
     * 构建入口
     */
    buildEntrances(floorplan) {
        floorplan.entrances.forEach(entrance => {
            const geometry = new THREE.BoxGeometry(entrance.width, 0.1, entrance.width);
            const material = new THREE.MeshStandardMaterial({
                color: 0x4ecdc4,
                transparent: true,
                opacity: 0.7
            });

            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(entrance.position.x, 0.05, entrance.position.y);
            mesh.userData = { type: 'entrance', data: entrance };

            this.scene.add(mesh);
            this.objects.entrances.push({ mesh, data: entrance });

            const arrowGeometry = new THREE.ConeGeometry(0.3, 0.8, 4);
            const arrowMaterial = new THREE.MeshStandardMaterial({ color: 0x4ecdc4 });
            const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
            arrow.position.set(entrance.position.x, 1, entrance.position.y);
            arrow.rotation.x = Math.PI / 2;
            this.scene.add(arrow);
        });
    },

    /**
     * 构建出口
     */
    buildExits(floorplan) {
        floorplan.exits.forEach(exit => {
            const geometry = new THREE.BoxGeometry(exit.width, 0.1, exit.width);
            const material = new THREE.MeshStandardMaterial({
                color: 0xff6b6b,
                transparent: true,
                opacity: 0.7
            });

            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(exit.position.x, 0.05, exit.position.y);
            mesh.userData = { type: 'exit', data: exit };

            this.scene.add(mesh);
            this.objects.exits.push({ mesh, data: exit });
        });
    },

    /**
     * 构建消防通道
     */
    buildFireExits(floorplan) {
        const fireExits = floorplan.fireExits || [];
        fireExits.forEach(fireExit => {
            const geometry = new THREE.RingGeometry(fireExit.clearZone * 0.8, fireExit.clearZone, 32);
            const material = new THREE.MeshStandardMaterial({
                color: 0x2196f3,
                transparent: true,
                opacity: 0.3,
                side: THREE.DoubleSide
            });

            const mesh = new THREE.Mesh(geometry, material);
            mesh.rotation.x = -Math.PI / 2;
            mesh.position.set(fireExit.position.x, 0.02, fireExit.position.y);
            mesh.userData = { type: 'fire_exit', data: fireExit };

            this.scene.add(mesh);
            this.objects.fireExits.push({ mesh, data: fireExit });
        });
    },

    /**
     * 构建无障碍路径
     */
    buildAccessibilityPaths(floorplan) {
        const accessibilityPaths = floorplan.accessibilityPaths || [];
        accessibilityPaths.forEach(path => {
            const start = new THREE.Vector3(path.start.x, 0.03, path.start.y);
            const end = new THREE.Vector3(path.end.x, 0.03, path.end.y);
            const direction = end.clone().sub(start);
            const length = direction.length();

            const geometry = new THREE.PlaneGeometry(length, path.width);
            const material = new THREE.MeshStandardMaterial({
                color: 0x9c27b0,
                transparent: true,
                opacity: 0.4
            });

            const mesh = new THREE.Mesh(geometry, material);
            mesh.rotation.x = -Math.PI / 2;

            const center = start.clone().add(direction.multiplyScalar(0.5));
            mesh.position.copy(center);

            const angle = Math.atan2(end.z - start.z, end.x - start.x);
            mesh.rotation.z = -angle;

            mesh.userData = { type: 'accessibility_path', data: path };

            this.scene.add(mesh);
            this.objects.accessibilityPaths.push({ mesh, data: path });
        });
    },

    /**
     * 构建展品
     */
    buildExhibits() {
        const exhibits = SpaceModel.getExhibits();
        
        exhibits.forEach(exhibit => {
            const group = new THREE.Group();

            const baseGeometry = new THREE.BoxGeometry(
                exhibit.dimensions.width,
                0.1,
                exhibit.dimensions.depth
            );
            const baseMaterial = new THREE.MeshStandardMaterial({
                color: 0x4a5568,
                roughness: 0.6
            });
            const base = new THREE.Mesh(baseGeometry, baseMaterial);
            base.position.y = 0.05;
            base.receiveShadow = true;
            group.add(base);

            const bodyGeometry = new THREE.BoxGeometry(
                exhibit.dimensions.width * 0.8,
                exhibit.dimensions.height,
                exhibit.dimensions.depth * 0.8
            );
            
            const popularityColor = this.getPopularityColor(exhibit.popularity);
            const bodyMaterial = new THREE.MeshStandardMaterial({
                color: popularityColor,
                roughness: 0.4,
                metalness: 0.3
            });
            const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
            body.position.y = exhibit.dimensions.height / 2 + 0.1;
            body.castShadow = true;
            body.receiveShadow = true;
            group.add(body);

            group.position.set(exhibit.position.x, 0, exhibit.position.y);
            group.userData = { type: 'exhibit', data: exhibit };

            this.scene.add(group);
            this.objects.exhibits.push({ mesh: group, data: exhibit });
        });
    },

    /**
     * 根据热度获取颜色
     */
    getPopularityColor(popularity) {
        if (popularity > 0.8) return 0xff4757;
        if (popularity > 0.6) return 0xffa502;
        if (popularity > 0.4) return 0xffd93d;
        return 0x6bcb77;
    },

    /**
     * 更新观众
     */
    updateVisitors() {
        const visitors = SimulationEngine.getVisitors();

        this.objects.visitors.forEach(v => this.scene.remove(v.mesh));
        this.objects.visitors = [];

        visitors.forEach(visitor => {
            if (visitor.state === 'finished') return;

            const geometry = new THREE.CylinderGeometry(0.15, 0.15, 1.6, 8);
            const color = visitor.isAccessibilityNeed ? 0x9c27b0 : 0xffffff;
            const material = new THREE.MeshStandardMaterial({
                color: color,
                roughness: 0.5
            });

            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(visitor.position.x, 0.8, visitor.position.y);
            mesh.castShadow = true;

            if (visitor.state === 'viewing') {
                mesh.material.emissive = new THREE.Color(0x00ff00);
                mesh.material.emissiveIntensity = 0.3;
            }

            mesh.userData = { type: 'visitor', data: visitor };

            this.scene.add(mesh);
            this.objects.visitors.push({ mesh, data: visitor });
        });
    },

    /**
     * 更新风险区域
     */
    updateRiskZones() {
        this.objects.riskZones.forEach(z => this.scene.remove(z.mesh));
        this.objects.riskZones = [];

        const risks = SimulationEngine.getRisks();

        risks.forEach(risk => {
            let color, opacity;
            
            switch (risk.severity) {
                case 'high':
                    color = 0xf44336;
                    opacity = 0.5;
                    break;
                case 'medium':
                    color = 0xff9800;
                    opacity = 0.4;
                    break;
                case 'low':
                    color = 0x4caf50;
                    opacity = 0.3;
                    break;
                default:
                    color = 0x9e9e9e;
                    opacity = 0.3;
            }

            const geometry = new THREE.CylinderGeometry(1.5, 1.5, 0.1, 16);
            const material = new THREE.MeshStandardMaterial({
                color: color,
                transparent: true,
                opacity: opacity
            });

            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(risk.position.x, 0.05, risk.position.y);
            mesh.userData = { type: 'risk_zone', data: risk };

            this.scene.add(mesh);
            this.objects.riskZones.push({ mesh, data: risk });
        });
    },

    /**
     * 检查鼠标悬停
     */
    checkHover() {
        const allObjects = [
            ...this.objects.exhibits.map(e => e.mesh),
            ...this.objects.visitors.map(v => v.mesh),
            ...this.objects.walls,
            ...this.objects.entrances.map(e => e.mesh),
            ...this.objects.exits.map(e => e.mesh),
            ...this.objects.fireExits.map(f => f.mesh)
        ];

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(allObjects, true);

        const hoverInfo = document.getElementById('hover-info');
        
        if (intersects.length > 0) {
            const object = intersects[0].object;
            let parentObject = object;
            while (parentObject.parent && !parentObject.userData.type) {
                parentObject = parentObject.parent;
            }

            if (parentObject.userData.type) {
                this.hoverObject = parentObject;
                let info = '';
                
                switch (parentObject.userData.type) {
                    case 'exhibit':
                        const exhibit = parentObject.userData.data;
                        info = `展品: ${exhibit.name} | 热度: ${(exhibit.popularity * 100).toFixed(0)}% | 观展时间: ${exhibit.viewingTime}秒`;
                        break;
                    case 'visitor':
                        const visitor = parentObject.userData.data;
                        info = `观众 | 状态: ${visitor.state === 'viewing' ? '观展中' : '移动中'} | ${visitor.isAccessibilityNeed ? '需要无障碍' : ''}`;
                        break;
                    case 'entrance':
                        const entrance = parentObject.userData.data;
                        info = `入口: ${entrance.name} | 宽度: ${entrance.width}m`;
                        break;
                    case 'exit':
                        const exit = parentObject.userData.data;
                        info = `出口: ${exit.name} | 宽度: ${exit.width}m`;
                        break;
                    case 'fire_exit':
                        const fireExit = parentObject.userData.data;
                        info = `消防通道: ${fireExit.name} | 禁停区: ${fireExit.clearZone}m`;
                        break;
                    case 'wall':
                        const wall = parentObject.userData.data;
                        info = `墙体 | 类型: ${wall.type}`;
                        break;
                }
                
                if (hoverInfo && info) {
                    hoverInfo.textContent = info;
                }
                return;
            }
        }

        if (hoverInfo) {
            hoverInfo.textContent = '将鼠标悬停在物体上查看详情';
        }
        this.hoverObject = null;
    },

    /**
     * 渲染循环
     */
    animate(time) {
        this.animationId = requestAnimationFrame((t) => this.animate(t));

        const deltaTime = (time - this.lastTime) / 1000;
        this.lastTime = time;

        if (SimulationEngine.isRunning && !SimulationEngine.isPaused) {
            SimulationEngine.update(deltaTime);
            this.updateVisitors();
            this.updateRiskZones();
            this.updateUI();
        }

        this.checkHover();
        this.renderer.render(this.scene, this.camera);
    },

    /**
     * 更新UI
     */
    updateUI() {
        const stats = SimulationEngine.getStats();
        
        document.getElementById('totalVisitors').textContent = stats.totalVisitors;
        document.getElementById('movingVisitors').textContent = stats.movingVisitors;
        document.getElementById('congestedAreas').textContent = stats.congestedAreas;
        document.getElementById('accessDetours').textContent = stats.accessDetours;

        this.updateRiskList();
    },

    /**
     * 更新风险列表
     */
    updateRiskList() {
        const riskListEl = document.getElementById('riskList');
        const risks = SimulationEngine.getRisks();

        if (risks.length === 0) {
            riskListEl.innerHTML = '<p>暂无风险点</p>';
            return;
        }

        const sortedRisks = [...risks].sort((a, b) => {
            const priority = { high: 0, medium: 1, low: 2 };
            return priority[a.severity] - priority[b.severity];
        });

        riskListEl.innerHTML = sortedRisks.map(risk => `
            <div class="risk-item ${risk.severity}">
                <h4>${this.getRiskTypeLabel(risk.type)}</h4>
                <p>${risk.description}</p>
            </div>
        `).join('');
    },

    /**
     * 获取风险类型标签
     */
    getRiskTypeLabel(type) {
        const labels = {
            'congestion': '拥堵',
            'fire_exit_blocked': '消防通道占用',
            'view_obstruction': '视线遮挡',
            'accessibility_detour': '无障碍绕行'
        };
        return labels[type] || type;
    },

    /**
     * 开始渲染
     */
    start() {
        this.buildScene();
        this.animate(0);
    },

    /**
     * 停止渲染
     */
    stop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    },

    /**
     * 刷新场景
     */
    refresh() {
        this.buildScene();
    }
};

// 导出为全局变量
window.Renderer3D = Renderer3D;
