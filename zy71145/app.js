class SafetyInspectionSystem {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.objects = {};
        this.risks = [];
        this.isPlaying = false;
        this.animationProgress = 0;
        this.animationId = null;
        this.sweepPoints = [];
        
        this.thresholds = {
            robotPlatform: 1.5,
            robotDoor: 2.0,
            passage: 1.2
        };
        
        this.filters = {
            robot: true,
            platform: true,
            door: true,
            passage: true,
            sweep: true
        };

        this.init();
        this.loadState();
    }

    init() {
        this.setupThreeJS();
        this.setupControls();
        this.setupEventListeners();
        this.createWorkshop();
        this.animate();
    }

    setupThreeJS() {
        const canvas = document.getElementById('scene-canvas');
        const viewport = document.querySelector('.viewport');
        
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0a1a);
        
        this.camera = new THREE.PerspectiveCamera(
            60,
            viewport.clientWidth / viewport.clientHeight,
            0.1,
            1000
        );
        this.camera.position.set(15, 12, 15);
        
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: canvas, 
            antialias: true 
        });
        this.renderer.setSize(viewport.clientWidth, viewport.clientHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        const ambientLight = new THREE.AmbientLight(0x404050, 0.6);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 20, 10);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);
        
        const gridHelper = new THREE.GridHelper(30, 30, 0x333355, 0x222244);
        this.scene.add(gridHelper);
    }

    setupControls() {
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 5;
        this.controls.maxDistance = 50;
    }

    createWorkshop() {
        const floorGeometry = new THREE.PlaneGeometry(30, 25);
        const floorMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x1a1a2e,
            roughness: 0.8
        });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);

        const wallMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x2a2a4e,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide
        });

        const backWall = new THREE.Mesh(
            new THREE.PlaneGeometry(30, 6),
            wallMaterial
        );
        backWall.position.set(0, 3, -12.5);
        this.scene.add(backWall);

        const leftWall = new THREE.Mesh(
            new THREE.PlaneGeometry(25, 6),
            wallMaterial
        );
        leftWall.position.set(-15, 3, 0);
        leftWall.rotation.y = Math.PI / 2;
        this.scene.add(leftWall);

        this.createRobotArm();
        this.createPlatforms();
        this.createSafetyDoors();
        this.createPassages();
        
        this.updateDeviceCount();
    }

    createRobotArm() {
        const robotGroup = new THREE.Group();
        robotGroup.name = 'robot';
        
        const baseMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x3498db,
            metalness: 0.7,
            roughness: 0.3
        });
        const armMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xe94560,
            metalness: 0.8,
            roughness: 0.2
        });
        
        const base = new THREE.Mesh(
            new THREE.CylinderGeometry(0.8, 1, 0.5, 32),
            baseMaterial
        );
        base.position.y = 0.25;
        base.castShadow = true;
        robotGroup.add(base);
        
        const arm1Group = new THREE.Group();
        arm1Group.position.y = 0.5;
        robotGroup.add(arm1Group);
        
        const arm1 = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, 2.5, 0.5),
            armMaterial
        );
        arm1.position.y = 1.25;
        arm1.castShadow = true;
        arm1Group.add(arm1);
        
        const arm2Group = new THREE.Group();
        arm2Group.position.y = 2.5;
        arm1Group.add(arm2Group);
        
        const arm2 = new THREE.Mesh(
            new THREE.BoxGeometry(0.4, 2, 0.4),
            armMaterial
        );
        arm2.position.y = 1;
        arm2.castShadow = true;
        arm2Group.add(arm2);
        
        const endEffector = new THREE.Mesh(
            new THREE.SphereGeometry(0.3, 16, 16),
            new THREE.MeshStandardMaterial({ 
                color: 0xf39c12,
                emissive: 0xf39c12,
                emissiveIntensity: 0.3
            })
        );
        endEffector.position.y = 2;
        arm2Group.add(endEffector);
        
        robotGroup.position.set(-5, 0, 0);
        this.scene.add(robotGroup);
        
        this.objects.robot = {
            group: robotGroup,
            arm1: arm1Group,
            arm2: arm2Group,
            endEffector: endEffector
        };
        
        this.createSweepArea();
    }

    createSweepArea() {
        const sweepGroup = new THREE.Group();
        sweepGroup.name = 'sweep';
        
        const sweepMaterial = new THREE.MeshBasicMaterial({
            color: 0xe94560,
            transparent: true,
            opacity: 0.15,
            side: THREE.DoubleSide
        });
        
        const sweepLineMaterial = new THREE.LineBasicMaterial({
            color: 0xe94560,
            transparent: true,
            opacity: 0.4
        });
        
        this.sweepPoints = [];
        for (let i = 0; i <= 36; i++) {
            const angle = (i / 36) * Math.PI * 2;
            const x = -5 + Math.cos(angle) * 3.5;
            const z = Math.sin(angle) * 3.5;
            this.sweepPoints.push(new THREE.Vector3(x, 2, z));
        }
        
        const sweepGeometry = new THREE.BufferGeometry().setFromPoints(this.sweepPoints);
        const sweepLine = new THREE.Line(sweepGeometry, sweepLineMaterial);
        sweepGroup.add(sweepLine);
        
        const cylinderPoints = [];
        for (let i = 0; i <= 36; i++) {
            const angle = (i / 36) * Math.PI * 2;
            const x = -5 + Math.cos(angle) * 3.5;
            const z = Math.sin(angle) * 3.5;
            cylinderPoints.push(new THREE.Vector3(x, 0, z));
        }
        for (let i = 36; i >= 0; i--) {
            const angle = (i / 36) * Math.PI * 2;
            const x = -5 + Math.cos(angle) * 3.5;
            const z = Math.sin(angle) * 3.5;
            cylinderPoints.push(new THREE.Vector3(x, 3, z));
        }
        cylinderPoints.push(cylinderPoints[0]);
        
        const cylinderGeometry = new THREE.BufferGeometry().setFromPoints(cylinderPoints);
        const cylinderMesh = new THREE.Mesh(cylinderGeometry, sweepMaterial);
        sweepGroup.add(cylinderMesh);
        
        const topPoints = this.sweepPoints.map(p => new THREE.Vector3(p.x, 3, p.z));
        const topGeometry = new THREE.BufferGeometry().setFromPoints(topPoints);
        const topLine = new THREE.Line(topGeometry, sweepLineMaterial);
        sweepGroup.add(topLine);
        
        this.scene.add(sweepGroup);
        this.objects.sweep = sweepGroup;
    }

    createPlatforms() {
        const platforms = [];
        
        const platformMaterial = new THREE.MeshStandardMaterial({
            color: 0x95a5a6,
            metalness: 0.3,
            roughness: 0.7
        });
        
        const platform1 = new THREE.Group();
        platform1.name = 'platform-1';
        
        const table1 = new THREE.Mesh(
            new THREE.BoxGeometry(3, 0.2, 2),
            platformMaterial
        );
        table1.position.y = 0.8;
        table1.castShadow = true;
        table1.receiveShadow = true;
        platform1.add(table1);
        
        const legMaterial = new THREE.MeshStandardMaterial({ color: 0x7f8c8d });
        for (let i = -1; i <= 1; i += 2) {
            for (let j = -1; j <= 1; j += 2) {
                const leg = new THREE.Mesh(
                    new THREE.BoxGeometry(0.1, 0.8, 0.1),
                    legMaterial
                );
                leg.position.set(i * 1.4, 0.4, j * 0.9);
                leg.castShadow = true;
                platform1.add(leg);
            }
        }
        
        platform1.position.set(0, 0, 0);
        this.scene.add(platform1);
        platforms.push(platform1);
        
        const platform2 = platform1.clone();
        platform2.position.set(5, 0, 0);
        platform2.name = 'platform-2';
        this.scene.add(platform2);
        platforms.push(platform2);
        
        const workpiece = new THREE.Mesh(
            new THREE.BoxGeometry(0.8, 0.3, 0.6),
            new THREE.MeshStandardMaterial({ color: 0x1abc9c })
        );
        workpiece.position.set(0, 1.05, 0);
        workpiece.castShadow = true;
        platform1.add(workpiece);
        
        this.objects.platforms = platforms;
    }

    createSafetyDoors() {
        const doors = [];
        
        const frameMaterial = new THREE.MeshStandardMaterial({
            color: 0x2c3e50,
            metalness: 0.5,
            roughness: 0.5
        });
        
        const doorMaterial = new THREE.MeshStandardMaterial({
            color: 0xf39c12,
            transparent: true,
            opacity: 0.6,
            emissive: 0xf39c12,
            emissiveIntensity: 0.1
        });
        
        const door1 = new THREE.Group();
        door1.name = 'door-1';
        
        const leftPost = new THREE.Mesh(
            new THREE.BoxGeometry(0.2, 3, 0.2),
            frameMaterial
        );
        leftPost.position.set(-1.1, 1.5, 0);
        leftPost.castShadow = true;
        door1.add(leftPost);
        
        const rightPost = new THREE.Mesh(
            new THREE.BoxGeometry(0.2, 3, 0.2),
            frameMaterial
        );
        rightPost.position.set(1.1, 1.5, 0);
        rightPost.castShadow = true;
        door1.add(rightPost);
        
        const topBeam = new THREE.Mesh(
            new THREE.BoxGeometry(2.4, 0.2, 0.2),
            frameMaterial
        );
        topBeam.position.set(0, 3, 0);
        topBeam.castShadow = true;
        door1.add(topBeam);
        
        const doorPanel = new THREE.Mesh(
            new THREE.BoxGeometry(2, 2.8, 0.1),
            doorMaterial
        );
        doorPanel.position.set(0, 1.5, 0);
        doorPanel.castShadow = true;
        door1.add(doorPanel);
        
        door1.position.set(0, 0, -10);
        this.scene.add(door1);
        doors.push(door1);
        
        const door2 = door1.clone();
        door2.position.set(-8, 0, 5);
        door2.rotation.y = Math.PI / 2;
        door2.name = 'door-2';
        this.scene.add(door2);
        doors.push(door2);
        
        const warningSign = new THREE.Mesh(
            new THREE.CircleGeometry(0.3, 32),
            new THREE.MeshBasicMaterial({
                color: 0xe94560,
                side: THREE.DoubleSide
            })
        );
        warningSign.position.set(0, 2.2, 0.1);
        door1.add(warningSign);
        
        this.objects.doors = doors;
    }

    createPassages() {
        const passages = [];
        
        const passageMaterial = new THREE.MeshStandardMaterial({
            color: 0x27ae60,
            transparent: true,
            opacity: 0.3,
            emissive: 0x27ae60,
            emissiveIntensity: 0.1
        });
        
        const lineMaterial = new THREE.LineBasicMaterial({
            color: 0x27ae60,
            linewidth: 2
        });
        
        const passage1 = new THREE.Group();
        passage1.name = 'passage-1';
        
        const passageArea = new THREE.Mesh(
            new THREE.PlaneGeometry(1.5, 4),
            passageMaterial
        );
        passageArea.rotation.x = -Math.PI / 2;
        passageArea.position.y = 0.01;
        passage1.add(passageArea);
        
        const edgePoints = [
            new THREE.Vector3(-0.75, 0.02, -2),
            new THREE.Vector3(-0.75, 0.02, 2),
            new THREE.Vector3(0.75, 0.02, 2),
            new THREE.Vector3(0.75, 0.02, -2),
            new THREE.Vector3(-0.75, 0.02, -2)
        ];
        const edgeGeometry = new THREE.BufferGeometry().setFromPoints(edgePoints);
        const edgeLine = new THREE.Line(edgeGeometry, lineMaterial);
        passage1.add(edgeLine);
        
        const arrowShape = new THREE.Shape();
        arrowShape.moveTo(0, 0.3);
        arrowShape.lineTo(-0.2, -0.1);
        arrowShape.lineTo(0, 0);
        arrowShape.lineTo(0.2, -0.1);
        arrowShape.lineTo(0, 0.3);
        
        const arrowGeometry = new THREE.ShapeGeometry(arrowShape);
        const arrowMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x27ae60,
            side: THREE.DoubleSide
        });
        
        for (let z = -1.5; z <= 1.5; z += 1) {
            const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
            arrow.rotation.x = -Math.PI / 2;
            arrow.position.set(0, 0.02, z);
            passage1.add(arrow);
        }
        
        passage1.position.set(8, 0, 0);
        this.scene.add(passage1);
        passages.push(passage1);
        
        const passage2 = passage1.clone();
        passage2.position.set(0, 0, 10);
        passage2.rotation.y = Math.PI / 2;
        passage2.name = 'passage-2';
        this.scene.add(passage2);
        passages.push(passage2);
        
        this.objects.passages = passages;
    }

    animateRobotArm(progress) {
        if (!this.objects.robot) return;
        
        const { arm1, arm2 } = this.objects.robot;
        
        arm1.rotation.z = Math.sin(progress * Math.PI * 2) * 0.5;
        arm1.rotation.y = progress * Math.PI * 2;
        arm2.rotation.x = Math.sin(progress * Math.PI * 3) * 0.4 + 0.3;
    }

    checkDistances() {
        this.risks = [];
        
        if (!this.objects.robot || !this.objects.platforms) return;
        
        const robotPos = this.objects.robot.group.position;
        
        this.objects.platforms.forEach((platform, index) => {
            const distance = robotPos.distanceTo(platform.position);
            if (distance < this.thresholds.robotPlatform) {
                this.risks.push({
                    type: 'high',
                    title: '机器人扫掠越界',
                    detail: `机器人与操作台 ${index + 1} 距离仅 ${distance.toFixed(2)}m（阈值: ${this.thresholds.robotPlatform}m）`
                });
                
                this.highlightObject(platform, 0xe94560);
            } else if (distance < this.thresholds.robotPlatform + 0.5) {
                this.risks.push({
                    type: 'medium',
                    title: '接近安全距离',
                    detail: `机器人与操作台 ${index + 1} 距离 ${distance.toFixed(2)}m，接近阈值`
                });
            }
        });
        
        if (this.objects.doors) {
            this.objects.doors.forEach((door, index) => {
                const distance = robotPos.distanceTo(door.position);
                if (distance < this.thresholds.robotDoor) {
                    this.risks.push({
                        type: 'high',
                        title: '安全门被挡风险',
                        detail: `机器人与安全门 ${index + 1} 距离仅 ${distance.toFixed(2)}m（阈值: ${this.thresholds.robotDoor}m）`
                    });
                    
                    this.highlightObject(door, 0xe94560);
                }
            });
        }
        
        if (this.objects.passages) {
            this.objects.passages.forEach((passage, index) => {
                const passageWidth = 1.5;
                if (passageWidth < this.thresholds.passage) {
                    this.risks.push({
                        type: 'medium',
                        title: '通道宽度不足',
                        detail: `人员通道 ${index + 1} 宽度 ${passageWidth}m（建议: ${this.thresholds.passage}m）`
                    });
                }
            });
        }
        
        this.updateRiskList();
        this.updateSceneStatus();
    }

    highlightObject(object, color) {
        object.traverse((child) => {
            if (child.isMesh && child.material) {
                if (!child.userData.originalEmissive) {
                    child.userData.originalEmissive = child.material.emissive ? child.material.emissive.getHex() : 0;
                }
                if (child.material.emissive) {
                    child.material.emissive.setHex(color);
                }
            }
        });
    }

    clearHighlights() {
        [
            ...(this.objects.platforms || []),
            ...(this.objects.doors || [])
        ].forEach(object => {
            object.traverse((child) => {
                if (child.isMesh && child.material && child.userData.originalEmissive !== undefined) {
                    if (child.material.emissive) {
                        child.material.emissive.setHex(child.userData.originalEmissive);
                    }
                }
            });
        });
    }

    updateRiskList() {
        const riskList = document.getElementById('risk-list');
        
        if (this.risks.length === 0) {
            riskList.innerHTML = '<p class="no-risk">✅ 未检测到安全风险</p>';
            return;
        }
        
        riskList.innerHTML = this.risks.map(risk => `
            <div class="risk-item ${risk.type}">
                <div class="risk-type">${risk.title}</div>
                <div class="risk-detail">${risk.detail}</div>
            </div>
        `).join('');
    }

    updateSceneStatus() {
        const statusEl = document.getElementById('scene-status');
        const highRisks = this.risks.filter(r => r.type === 'high').length;
        const mediumRisks = this.risks.filter(r => r.type === 'medium').length;
        
        if (highRisks > 0) {
            statusEl.textContent = '有风险';
            statusEl.className = 'status-danger';
        } else if (mediumRisks > 0) {
            statusEl.textContent = '注意';
            statusEl.className = 'status-warning';
        } else {
            statusEl.textContent = '正常';
            statusEl.className = 'status-ok';
        }
    }

    updateDeviceCount() {
        let count = 0;
        if (this.objects.robot) count++;
        if (this.objects.platforms) count += this.objects.platforms.length;
        if (this.objects.doors) count += this.objects.doors.length;
        if (this.objects.passages) count += this.objects.passages.length;
        
        document.getElementById('device-count').textContent = count;
    }

    setView(viewType) {
        const positions = {
            top: { x: 0, y: 30, z: 0.01 },
            front: { x: 0, y: 10, z: 25 },
            side: { x: 25, y: 10, z: 0 },
            perspective: { x: 15, y: 12, z: 15 }
        };
        
        const pos = positions[viewType];
        if (pos) {
            this.camera.position.set(pos.x, pos.y, pos.z);
            this.controls.target.set(0, 2, 0);
            this.controls.update();
        }
    }

    toggleFilter(type, visible) {
        this.filters[type] = visible;
        
        switch (type) {
            case 'robot':
                if (this.objects.robot) {
                    this.objects.robot.group.visible = visible;
                }
                break;
            case 'platform':
                if (this.objects.platforms) {
                    this.objects.platforms.forEach(p => p.visible = visible);
                }
                break;
            case 'door':
                if (this.objects.doors) {
                    this.objects.doors.forEach(d => d.visible = visible);
                }
                break;
            case 'passage':
                if (this.objects.passages) {
                    this.objects.passages.forEach(p => p.visible = visible);
                }
                break;
            case 'sweep':
                if (this.objects.sweep) {
                    this.objects.sweep.visible = visible;
                }
                break;
        }
        
        this.saveState();
    }

    exportReport() {
        const now = new Date();
        const timestamp = now.toLocaleString('zh-CN');
        
        const report = {
            title: '生产线安全距离检查报告',
            generatedAt: timestamp,
            thresholds: { ...this.thresholds },
            risks: [...this.risks],
            summary: {
                totalRisks: this.risks.length,
                highRisks: this.risks.filter(r => r.type === 'high').length,
                mediumRisks: this.risks.filter(r => r.type === 'medium').length,
                lowRisks: this.risks.filter(r => r.type === 'low').length
            }
        };
        
        const htmlReport = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>${report.title}</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 900px;
            margin: 40px auto;
            padding: 0 20px;
            line-height: 1.6;
            color: #333;
        }
        h1 { color: #e94560; border-bottom: 2px solid #eee; padding-bottom: 10px; }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
        .summary { 
            display: grid; 
            grid-template-columns: repeat(4, 1fr); 
            gap: 15px;
            margin: 30px 0;
        }
        .summary-item {
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            background: #f8f9fa;
        }
        .summary-item.high { background: #fee; border-left: 4px solid #e94560; }
        .summary-item.medium { background: #fff8e1; border-left: 4px solid #f39c12; }
        .summary-item.total { background: #e8f5e9; border-left: 4px solid #2ecc71; }
        .summary-item .number { font-size: 32px; font-weight: bold; margin: 10px 0; }
        .risk-item {
            padding: 15px;
            margin: 10px 0;
            border-radius: 6px;
            border-left: 4px solid;
            background: #f9f9f9;
        }
        .risk-item.high { border-color: #e94560; background: #fff5f5; }
        .risk-item.medium { border-color: #f39c12; background: #fffcf5; }
        .risk-title { font-weight: bold; margin-bottom: 5px; }
        .risk-detail { color: #666; font-size: 14px; }
        .thresholds {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
        }
        .thresholds h3 { margin-top: 0; color: #555; }
        .threshold-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
        .status {
            padding: 10px 20px;
            border-radius: 6px;
            font-weight: bold;
        }
        .status.ok { background: #2ecc71; color: white; }
        .status.warning { background: #f39c12; color: white; }
        .status.danger { background: #e94560; color: white; }
    </style>
</head>
<body>
    <div class="header">
        <h1>${report.title}</h1>
        <div class="status ${report.summary.highRisks > 0 ? 'danger' : report.summary.mediumRisks > 0 ? 'warning' : 'ok'}">
            ${report.summary.highRisks > 0 ? '⚠️ 需立即整改' : report.summary.mediumRisks > 0 ? '⚡ 建议关注' : '✅ 安全达标'}
        </div>
    </div>
    
    <p><strong>生成时间:</strong> ${report.generatedAt}</p>
    
    <h2>📊 检查概要</h2>
    <div class="summary">
        <div class="summary-item total">
            <div class="number">${report.summary.totalRisks}</div>
            <div>总风险数</div>
        </div>
        <div class="summary-item high">
            <div class="number">${report.summary.highRisks}</div>
            <div>高风险</div>
        </div>
        <div class="summary-item medium">
            <div class="number">${report.summary.mediumRisks}</div>
            <div>中风险</div>
        </div>
        <div class="summary-item">
            <div class="number">${report.summary.lowRisks}</div>
            <div>低风险</div>
        </div>
    </div>
    
    <h2>📐 安全阈值设置</h2>
    <div class="thresholds">
        <div class="threshold-item">
            <span>机器人与操作台安全距离</span>
            <strong>${report.thresholds.robotPlatform} m</strong>
        </div>
        <div class="threshold-item">
            <span>机器人与安全门安全距离</span>
            <strong>${report.thresholds.robotDoor} m</strong>
        </div>
        <div class="threshold-item">
            <span>人员通道最小宽度</span>
            <strong>${report.thresholds.passage} m</strong>
        </div>
    </div>
    
    <h2>⚠️ 风险详情</h2>
    ${report.risks.length === 0 ? 
        '<p style="color: #2ecc71; padding: 20px; text-align: center;">🎉 未检测到安全风险</p>' :
        report.risks.map(risk => `
            <div class="risk-item ${risk.type}">
                <div class="risk-title">${risk.title}</div>
                <div class="risk-detail">${risk.detail}</div>
            </div>
        `).join('')
    }
    
    <footer style="margin-top: 50px; padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 12px;">
        本报告由生产线安全距离检查系统自动生成
    </footer>
</body>
</html>`;

        const blob = new Blob([htmlReport], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `安全检查报告_${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}.html`;
        a.click();
        URL.revokeObjectURL(url);
    }

    resetState() {
        this.clearHighlights();
        
        if (this.objects.robot) {
            this.objects.robot.arm1.rotation.set(0, 0, 0);
            this.objects.robot.arm2.rotation.set(0, 0, 0);
        }
        
        this.animationProgress = 0;
        document.getElementById('timeline-slider').value = 0;
        document.getElementById('time-display').textContent = '0%';
        
        this.stopAnimation();
        this.risks = [];
        this.updateRiskList();
        this.updateSceneStatus();
        
        document.getElementById('filter-robot').checked = true;
        document.getElementById('filter-platform').checked = true;
        document.getElementById('filter-door').checked = true;
        document.getElementById('filter-passage').checked = true;
        document.getElementById('filter-sweep').checked = true;
        
        Object.keys(this.filters).forEach(key => {
            this.filters[key] = true;
            this.toggleFilter(key, true);
        });
        
        document.getElementById('threshold-robot-platform').value = 1.5;
        document.getElementById('threshold-robot-door').value = 2.0;
        document.getElementById('threshold-passage').value = 1.2;
        
        this.thresholds = {
            robotPlatform: 1.5,
            robotDoor: 2.0,
            passage: 1.2
        };
        
        localStorage.removeItem('safetyInspectionState');
        
        this.setView('perspective');
    }

    startAnimation() {
        this.isPlaying = true;
    }

    stopAnimation() {
        this.isPlaying = false;
    }

    loadSampleData() {
        this.resetState();
        this.checkDistances();
    }

    saveState() {
        const state = {
            filters: { ...this.filters },
            thresholds: { ...this.thresholds },
            animationProgress: this.animationProgress
        };
        localStorage.setItem('safetyInspectionState', JSON.stringify(state));
    }

    loadState() {
        const saved = localStorage.getItem('safetyInspectionState');
        if (!saved) return;
        
        try {
            const state = JSON.parse(saved);
            
            if (state.filters) {
                Object.keys(state.filters).forEach(key => {
                    const checkbox = document.getElementById(`filter-${key}`);
                    if (checkbox) {
                        checkbox.checked = state.filters[key];
                        this.toggleFilter(key, state.filters[key]);
                    }
                });
            }
            
            if (state.thresholds) {
                this.thresholds = { ...state.thresholds };
                document.getElementById('threshold-robot-platform').value = state.thresholds.robotPlatform;
                document.getElementById('threshold-robot-door').value = state.thresholds.robotDoor;
                document.getElementById('threshold-passage').value = state.thresholds.passage;
            }
            
            if (state.animationProgress !== undefined) {
                this.animationProgress = state.animationProgress;
                document.getElementById('timeline-slider').value = state.animationProgress * 100;
                document.getElementById('time-display').textContent = Math.round(state.animationProgress * 100) + '%';
                this.animateRobotArm(state.animationProgress);
            }
            
            this.checkDistances();
        } catch (e) {
            console.error('Failed to load state:', e);
        }
    }

    setupEventListeners() {
        window.addEventListener('resize', () => {
            const viewport = document.querySelector('.viewport');
            this.camera.aspect = viewport.clientWidth / viewport.clientHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(viewport.clientWidth, viewport.clientHeight);
        });

        document.getElementById('filter-robot').addEventListener('change', (e) => {
            this.toggleFilter('robot', e.target.checked);
        });
        document.getElementById('filter-platform').addEventListener('change', (e) => {
            this.toggleFilter('platform', e.target.checked);
        });
        document.getElementById('filter-door').addEventListener('change', (e) => {
            this.toggleFilter('door', e.target.checked);
        });
        document.getElementById('filter-passage').addEventListener('change', (e) => {
            this.toggleFilter('passage', e.target.checked);
        });
        document.getElementById('filter-sweep').addEventListener('change', (e) => {
            this.toggleFilter('sweep', e.target.checked);
        });

        document.getElementById('threshold-robot-platform').addEventListener('change', (e) => {
            this.thresholds.robotPlatform = parseFloat(e.target.value);
            this.checkDistances();
            this.saveState();
        });
        document.getElementById('threshold-robot-door').addEventListener('change', (e) => {
            this.thresholds.robotDoor = parseFloat(e.target.value);
            this.checkDistances();
            this.saveState();
        });
        document.getElementById('threshold-passage').addEventListener('change', (e) => {
            this.thresholds.passage = parseFloat(e.target.value);
            this.checkDistances();
            this.saveState();
        });

        document.getElementById('timeline-slider').addEventListener('input', (e) => {
            this.animationProgress = e.target.value / 100;
            document.getElementById('time-display').textContent = e.target.value + '%';
            this.animateRobotArm(this.animationProgress);
            this.clearHighlights();
            this.checkDistances();
            this.saveState();
        });

        document.getElementById('btn-play').addEventListener('click', () => this.startAnimation());
        document.getElementById('btn-pause').addEventListener('click', () => this.stopAnimation());

        document.querySelectorAll('[data-view]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.setView(btn.dataset.view);
            });
        });

        document.getElementById('btn-import').addEventListener('click', () => {
            this.loadSampleData();
        });
        document.getElementById('btn-reset').addEventListener('click', () => {
            this.resetState();
        });
        document.getElementById('btn-export').addEventListener('click', () => {
            this.exportReport();
        });
    }

    animate() {
        this.animationId = requestAnimationFrame(() => this.animate());
        
        if (this.isPlaying) {
            this.animationProgress += 0.003;
            if (this.animationProgress > 1) {
                this.animationProgress = 0;
            }
            
            document.getElementById('timeline-slider').value = this.animationProgress * 100;
            document.getElementById('time-display').textContent = Math.round(this.animationProgress * 100) + '%';
            
            this.animateRobotArm(this.animationProgress);
            
            if (Math.floor(this.animationProgress * 100) % 10 === 0) {
                this.clearHighlights();
                this.checkDistances();
                this.saveState();
            }
        }
        
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new SafetyInspectionSystem();
});
