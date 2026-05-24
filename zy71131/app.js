const LabSafetyVR = (function() {
    let scene, camera, renderer, controls;
    let raycaster, mouse;
    let interactiveObjects = [];
    let pathLines = [];
    let forbiddenZones = [];
    let playerMarker;

    const state = {
        currentStepIndex: 0,
        isPlaying: false,
        isPaused: false,
        startTime: null,
        elapsedTime: 0,
        timerInterval: null,
        score: 0,
        errorCount: 0,
        violations: [],
        completedSteps: [],
        stepHistory: [],
        playerPosition: { x: 0, z: 0 },
        filters: {
            hazards: true,
            equipment: true,
            path: true,
            forbidden: true
        },
        currentView: 'overview',
        sceneObjects: {
            hazards: [],
            equipment: [],
            path: [],
            forbidden: []
        }
    };

    const sampleScenario = {
        name: "化学实验室泄漏应急处置演练",
        description: "模拟实验室化学品泄漏场景，练习正确的应急处置顺序",
        steps: [
            { id: 1, name: "发现泄漏，保持冷静", target: "leak_area", type: "identify", points: 10, hint: "仔细观察实验室，发现化学品泄漏位置" },
            { id: 2, name: "切断电源开关", target: "e1", type: "action", points: 15, hint: "优先切断电源，防止电气火花引发爆炸 - 这是关键的第一步！" },
            { id: 3, name: "关闭通风设备", target: "e2", type: "action", points: 10, hint: "关闭通风防止有害气体扩散" },
            { id: 4, name: "穿戴防护装备", target: "ppe_area", type: "action", points: 15, hint: "在处理泄漏前必须穿戴适当防护装备" },
            { id: 5, name: "使用吸收棉处理泄漏", target: "leak_area", type: "action", points: 20, hint: "使用专用吸收材料处理泄漏物" },
            { id: 6, name: "沿安全路线撤离", target: "exit", type: "move", points: 20, hint: "按照指定安全路线撤离到安全区域" }
        ],
        hazards: [
            { id: 'h1', name: '化学品泄漏点', type: 'danger', position: { x: 2, z: 2 }, status: 'active' },
            { id: 'h2', name: '高压气瓶', type: 'warning', position: { x: -3, z: 1 }, status: 'warning' },
            { id: 'h3', name: '易燃溶剂柜', type: 'danger', position: { x: -4, z: -2 }, status: 'active' }
        ],
        equipment: [
            { id: 'e1', name: '总电源开关', position: { x: 4, z: -3 }, status: 'on', action: 'toggle' },
            { id: 'e2', name: '通风系统开关', position: { x: 4, z: -1 }, status: 'on', action: 'toggle' },
            { id: 'e3', name: '紧急冲淋装置', position: { x: 0, z: -4 }, status: 'ready', action: 'use' },
            { id: 'e4', name: '消防灭火器', position: { x: -4, z: 3 }, status: 'ready', action: 'use' }
        ],
        safePath: [
            { x: 0, z: 0 },
            { x: 2, z: 0 },
            { x: 2, z: -3 },
            { x: 4, z: -3 },
            { x: 4, z: -5 }
        ],
        forbiddenZones: [
            { name: '高压危险区', x: -3, z: 1, radius: 1.5 },
            { name: '泄漏扩散区', x: 2, z: 2, radius: 2 }
        ],
        exitPoint: { x: 4, z: -5 },
        startPoint: { x: 0, z: 0 }
    };

    function init() {
        initScene();
        initControls();
        loadScenario(sampleScenario);
        setupEventListeners();
        updateUI();
        animate();
    }

    function initScene() {
        const container = document.getElementById('scene3d');
        
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0a0a1a);
        scene.fog = new THREE.Fog(0x0a0a1a, 10, 50);

        camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);
        camera.position.set(8, 10, 8);
        camera.lookAt(0, 0, 0);

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(renderer.domElement);

        const ambientLight = new THREE.AmbientLight(0x404050, 0.5);
        scene.add(ambientLight);

        const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
        mainLight.position.set(10, 15, 10);
        mainLight.castShadow = true;
        mainLight.shadow.mapSize.width = 2048;
        mainLight.shadow.mapSize.height = 2048;
        scene.add(mainLight);

        const fillLight = new THREE.DirectionalLight(0x00d4ff, 0.3);
        fillLight.position.set(-5, 5, -5);
        scene.add(fillLight);

        raycaster = new THREE.Raycaster();
        mouse = new THREE.Vector2();

        createLabFloor();
        createLabWalls();
    }

    function createLabFloor() {
        const floorGeometry = new THREE.PlaneGeometry(12, 12);
        const floorMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x2d3a5a,
            roughness: 0.8,
            metalness: 0.2
        });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        scene.add(floor);

        const gridHelper = new THREE.GridHelper(12, 12, 0x1a2744, 0x1a2744);
        gridHelper.position.y = 0.01;
        scene.add(gridHelper);
    }

    function createLabWalls() {
        const wallMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x1a2744,
            roughness: 0.9,
            metalness: 0.1
        });

        const backWall = new THREE.Mesh(new THREE.BoxGeometry(12, 4, 0.2), wallMaterial);
        backWall.position.set(0, 2, -6);
        backWall.receiveShadow = true;
        scene.add(backWall);

        const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4, 12), wallMaterial);
        leftWall.position.set(-6, 2, 0);
        leftWall.receiveShadow = true;
        scene.add(leftWall);

        const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4, 12), wallMaterial);
        rightWall.position.set(6, 2, 0);
        rightWall.receiveShadow = true;
        scene.add(rightWall);

        const doorMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff88, emissive: 0x00ff88, emissiveIntensity: 0.3 });
        const door = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.5, 0.3), doorMaterial);
        door.position.set(4, 1.25, -5.9);
        scene.add(door);

        const exitSign = createTextSprite('EXIT', 0x00ff88);
        exitSign.position.set(4, 3.2, -5.8);
        exitSign.scale.set(1.5, 0.8, 1);
        scene.add(exitSign);
    }

    function createTextSprite(text, color) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 128;
        
        context.fillStyle = 'transparent';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        context.font = 'bold 48px Arial';
        context.fillStyle = '#' + color.toString(16).padStart(6, '0');
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, 128, 64);

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
        return new THREE.Sprite(material);
    }

    function initControls() {
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.minDistance = 3;
        controls.maxDistance = 20;
        controls.maxPolarAngle = Math.PI / 2.1;
    }

    function loadScenario(scenario) {
        clearScenarioObjects();
        
        state.currentStepIndex = 0;
        state.score = 0;
        state.errorCount = 0;
        state.violations = [];
        state.completedSteps = [];
        state.stepHistory = [];
        state.elapsedTime = 0;
        state.isPlaying = false;
        state.isPaused = false;
        
        scenario.hazards.forEach(hazard => createHazard(hazard));
        scenario.equipment.forEach(equip => createEquipment(equip));
        createSafePath(scenario.safePath);
        scenario.forbiddenZones.forEach(zone => createForbiddenZone(zone));
        createPlayerMarker(scenario.startPoint);
        createFurniture();
        
        updateStepsList(scenario.steps);
        updateHazardsList(scenario.hazards);
        updateEquipmentList(scenario.equipment);
        updateTimelineMarkers(scenario.steps);
        resetTimer();
        updateUI();
    }

    function clearScenarioObjects() {
        interactiveObjects.forEach(obj => {
            if (obj.mesh) scene.remove(obj.mesh);
        });
        interactiveObjects = [];
        
        pathLines.forEach(line => scene.remove(line));
        pathLines = [];
        
        forbiddenZones.forEach(zone => scene.remove(zone.mesh));
        forbiddenZones = [];
        
        if (playerMarker) {
            scene.remove(playerMarker);
            playerMarker = null;
        }
        
        state.sceneObjects = {
            hazards: [],
            equipment: [],
            path: [],
            forbidden: []
        };
    }

    function createHazard(hazard) {
        const geometry = new THREE.CylinderGeometry(0.4, 0.4, 0.1, 16);
        const color = hazard.type === 'danger' ? 0xff4444 : 0xff9500;
        const material = new THREE.MeshStandardMaterial({ 
            color: color,
            emissive: color,
            emissiveIntensity: 0.3,
            transparent: true,
            opacity: 0.8
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(hazard.position.x, 0.05, hazard.position.z);
        mesh.castShadow = true;
        scene.add(mesh);

        const pulseGeometry = new THREE.RingGeometry(0.4, 0.6, 32);
        const pulseMaterial = new THREE.MeshBasicMaterial({ 
            color: color, 
            transparent: true, 
            opacity: 0.5,
            side: THREE.DoubleSide
        });
        const pulse = new THREE.Mesh(pulseGeometry, pulseMaterial);
        pulse.rotation.x = -Math.PI / 2;
        pulse.position.set(hazard.position.x, 0.02, hazard.position.z);
        scene.add(pulse);

        const sign = createTextSprite('⚠️', hazard.type === 'danger' ? 0xff4444 : 0xff9500);
        sign.position.set(hazard.position.x, 1.2, hazard.position.z);
        sign.scale.set(0.8, 0.8, 1);
        scene.add(sign);

        const objData = {
            ...hazard,
            mesh: mesh,
            pulse: pulse,
            sign: sign,
            type: 'hazard',
            originalColor: color
        };
        
        interactiveObjects.push(objData);
        state.sceneObjects.hazards.push(objData);
    }

    function createEquipment(equip) {
        const geometry = new THREE.BoxGeometry(0.6, 0.8, 0.2);
        const color = equip.status === 'on' ? 0x00ff88 : 0x666666;
        const material = new THREE.MeshStandardMaterial({ 
            color: color,
            emissive: equip.status === 'on' ? color : 0x000000,
            emissiveIntensity: equip.status === 'on' ? 0.3 : 0
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(equip.position.x, 0.5, equip.position.z);
        mesh.castShadow = true;
        scene.add(mesh);

        const label = createTextSprite(equip.name, 0xffffff);
        label.position.set(equip.position.x, 1.2, equip.position.z);
        label.scale.set(1.2, 0.5, 1);
        scene.add(label);

        const objData = {
            ...equip,
            mesh: mesh,
            label: label,
            type: 'equipment',
            originalColor: color
        };
        
        interactiveObjects.push(objData);
        state.sceneObjects.equipment.push(objData);
    }

    function createSafePath(points) {
        const material = new THREE.LineDashedMaterial({
            color: 0x00ff88,
            linewidth: 3,
            dashSize: 0.3,
            gapSize: 0.2,
            transparent: true,
            opacity: 0.8
        });

        for (let i = 0; i < points.length - 1; i++) {
            const geometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(points[i].x, 0.02, points[i].z),
                new THREE.Vector3(points[i + 1].x, 0.02, points[i + 1].z)
            ]);
            
            const line = new THREE.Line(geometry, material);
            line.computeLineDistances();
            scene.add(line);
            pathLines.push(line);
            state.sceneObjects.path.push(line);
        }

        points.forEach((point, index) => {
            const markerGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.05, 8);
            const markerMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
            const marker = new THREE.Mesh(markerGeometry, markerMaterial);
            marker.position.set(point.x, 0.02, point.z);
            scene.add(marker);
            pathLines.push(marker);
            state.sceneObjects.path.push(marker);
        });
    }

    function createForbiddenZone(zone) {
        const geometry = new THREE.RingGeometry(zone.radius - 0.1, zone.radius, 32);
        const material = new THREE.MeshBasicMaterial({ 
            color: 0xff4444, 
            transparent: true, 
            opacity: 0.3,
            side: THREE.DoubleSide
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(zone.x, 0.01, zone.z);
        scene.add(mesh);

        const borderGeometry = new THREE.RingGeometry(zone.radius - 0.05, zone.radius, 32);
        const borderMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xff4444, 
            transparent: true, 
            opacity: 0.8,
            side: THREE.DoubleSide
        });
        const border = new THREE.Mesh(borderGeometry, borderMaterial);
        border.rotation.x = -Math.PI / 2;
        border.position.set(zone.x, 0.03, zone.z);
        scene.add(border);

        const sign = createTextSprite('🚫 禁区', 0xff4444);
        sign.position.set(zone.x, 0.8, zone.z);
        sign.scale.set(1, 0.6, 1);
        scene.add(sign);

        const zoneData = {
            ...zone,
            mesh: mesh,
            border: border,
            sign: sign
        };
        
        forbiddenZones.push(zoneData);
        state.sceneObjects.forbidden.push(zoneData);
    }

    function createPlayerMarker(startPoint) {
        const geometry = new THREE.ConeGeometry(0.3, 0.8, 8);
        const material = new THREE.MeshStandardMaterial({ 
            color: 0x00d4ff,
            emissive: 0x00d4ff,
            emissiveIntensity: 0.5
        });
        
        playerMarker = new THREE.Mesh(geometry, material);
        playerMarker.position.set(startPoint.x, 0.6, startPoint.z);
        playerMarker.rotation.x = Math.PI;
        playerMarker.castShadow = true;
        scene.add(playerMarker);

        state.playerPosition = { x: startPoint.x, z: startPoint.z };
    }

    function createFurniture() {
        const deskMaterial = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.8 });
        
        const desk1 = new THREE.Mesh(new THREE.BoxGeometry(2, 0.8, 1), deskMaterial);
        desk1.position.set(-3, 0.4, 2);
        desk1.castShadow = true;
        desk1.receiveShadow = true;
        scene.add(desk1);

        const desk2 = new THREE.Mesh(new THREE.BoxGeometry(2, 0.8, 1), deskMaterial);
        desk2.position.set(-3, 0.4, -1);
        desk2.castShadow = true;
        desk2.receiveShadow = true;
        scene.add(desk2);

        const shelfMaterial = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.6 });
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2, 0.5), shelfMaterial);
        shelf.position.set(-4, 1, -3);
        shelf.castShadow = true;
        shelf.receiveShadow = true;
        scene.add(shelf);

        const ppeMaterial = new THREE.MeshStandardMaterial({ color: 0xffaa00, emissive: 0xffaa00, emissiveIntensity: 0.2 });
        const ppe = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.4), ppeMaterial);
        ppe.position.set(3, 0.25, 3);
        scene.add(ppe);

        const ppeSign = createTextSprite('PPE', 0xffaa00);
        ppeSign.position.set(3, 0.8, 3);
        ppeSign.scale.set(0.6, 0.4, 1);
        scene.add(ppeSign);

        const ppeObj = {
            id: 'ppe_area',
            name: '防护装备区',
            mesh: ppe,
            sign: ppeSign,
            type: 'ppe',
            position: { x: 3, z: 3 }
        };
        interactiveObjects.push(ppeObj);

        const exitGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 16);
        const exitMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x00ff88,
            emissive: 0x00ff88,
            emissiveIntensity: 0.3,
            transparent: true,
            opacity: 0.8
        });
        const exitMesh = new THREE.Mesh(exitGeometry, exitMaterial);
        exitMesh.position.set(4, 0.05, -5);
        scene.add(exitMesh);

        const exitObj = {
            id: 'exit',
            name: '安全出口',
            mesh: exitMesh,
            type: 'exit',
            position: { x: 4, z: -5 }
        };
        interactiveObjects.push(exitObj);
    }

    function setupEventListeners() {
        window.addEventListener('resize', onWindowResize);
        renderer.domElement.addEventListener('click', onMouseClick);
        renderer.domElement.addEventListener('mousemove', onMouseMove);

        document.getElementById('importBtn').addEventListener('click', importScenario);
        document.getElementById('resetBtn').addEventListener('click', resetScenario);
        document.getElementById('reportBtn').addEventListener('click', showReport);

        document.getElementById('playBtn').addEventListener('click', startPlayback);
        document.getElementById('pauseBtn').addEventListener('click', pausePlayback);
        document.getElementById('prevStepBtn').addEventListener('click', prevStep);
        document.getElementById('nextStepBtn').addEventListener('click', nextStep);
        document.getElementById('timelineSlider').addEventListener('input', onTimelineChange);

        document.querySelectorAll('.cam-btn').forEach(btn => {
            btn.addEventListener('click', () => switchCameraView(btn.dataset.view));
        });

        document.querySelectorAll('.filter').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => toggleFilter(e.target.value, e.target.checked));
        });

        document.getElementById('closeModal').addEventListener('click', () => {
            document.getElementById('reportModal').classList.add('hidden');
        });
        document.getElementById('downloadPDF').addEventListener('click', downloadPDFReport);
        document.getElementById('downloadJSON').addEventListener('click', downloadJSONReport);
    }

    function onWindowResize() {
        const container = document.getElementById('scene3d');
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    }

    function onMouseClick(event) {
        const container = document.getElementById('scene3d');
        const rect = container.getBoundingClientRect();
        
        mouse.x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        
        const meshes = interactiveObjects.map(obj => obj.mesh).filter(Boolean);
        const intersects = raycaster.intersectObjects(meshes);

        if (intersects.length > 0) {
            const clickedMesh = intersects[0].object;
            const clickedObject = interactiveObjects.find(obj => obj.mesh === clickedMesh);
            
            if (clickedObject) {
                handleObjectClick(clickedObject);
            }
        }
    }

    function onMouseMove(event) {
        const container = document.getElementById('scene3d');
        const rect = container.getBoundingClientRect();
        
        mouse.x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        
        const meshes = interactiveObjects.map(obj => obj.mesh).filter(Boolean);
        const intersects = raycaster.intersectObjects(meshes);

        container.style.cursor = intersects.length > 0 ? 'pointer' : 'grab';
    }

    function handleObjectClick(obj) {
        if (!state.isPlaying) {
            startTimer();
            state.isPlaying = true;
        }

        const currentStep = sampleScenario.steps[state.currentStepIndex];
        
        if (obj.type === 'equipment') {
            handleEquipmentInteraction(obj, currentStep);
        } else if (obj.type === 'hazard') {
            handleHazardInteraction(obj, currentStep);
        } else if (obj.type === 'ppe') {
            handlePPEInteraction(obj, currentStep);
        } else if (obj.type === 'exit') {
            handleExitInteraction(obj, currentStep);
        }
    }

    function handlePPEInteraction(ppe, currentStep) {
        if (currentStep && currentStep.target === 'ppe_area') {
            completeStep(currentStep);
            showHint(`✅ ${currentStep.name} - 完成!`, 'success');
        } else {
            recordViolation('wrong_order', `过早操作: ${ppe.name}`);
            showHint(`❌ 请按顺序完成步骤`, 'error');
        }
    }

    function handleExitInteraction(exit, currentStep) {
        if (currentStep && currentStep.target === 'exit') {
            completeStep(currentStep);
            showHint(`✅ ${currentStep.name} - 完成!`, 'success');
        } else {
            recordViolation('early_evacuation', '过早撤离！请先完成所有处置步骤');
            showHint(`❌ 警告：过早撤离！泄漏未处理完前不能离开`, 'error');
        }
    }

    function handleEquipmentInteraction(equip, currentStep) {
        const equipElement = document.querySelector(`[data-equip-id="${equip.id}"]`);
        
        if (currentStep && currentStep.target === equip.id) {
            equip.status = equip.status === 'on' ? 'off' : 'on';
            const color = equip.status === 'on' ? 0x00ff88 : 0x666666;
            equip.mesh.material.color.setHex(color);
            equip.mesh.material.emissive.setHex(equip.status === 'on' ? color : 0x000000);
            
            completeStep(currentStep);
            showHint(`✅ ${currentStep.name} - 完成!`, 'success');
            
            if (equipElement) {
                equipElement.querySelector('.item-status').textContent = `状态: ${equip.status === 'on' ? '开启' : '关闭'}`;
                equipElement.classList.remove('warning', 'safe');
                equipElement.classList.add(equip.status === 'on' ? 'warning' : 'safe');
            }
        } else {
            recordViolation('wrong_order', `错误操作: ${equip.name}`);
            showHint(`❌ 操作顺序错误，请先完成当前步骤`, 'error');
        }
    }

    function handleHazardInteraction(hazard, currentStep) {
        if (currentStep && currentStep.target === hazard.id) {
            completeStep(currentStep);
            showHint(`✅ ${currentStep.name} - 完成!`, 'success');
        } else if (currentStep && currentStep.target === 'leak_area' && hazard.id === 'h1') {
            completeStep(currentStep);
            showHint(`✅ ${currentStep.name} - 完成!`, 'success');
        } else {
            checkForbiddenZone(hazard.position.x, hazard.position.z);
        }
    }

    function completeStep(step) {
        state.completedSteps.push(step.id);
        state.score += step.points;
        state.stepHistory.push({
            stepId: step.id,
            stepName: step.name,
            timestamp: Date.now(),
            elapsed: state.elapsedTime,
            correct: true
        });

        if (state.currentStepIndex < sampleScenario.steps.length - 1) {
            state.currentStepIndex++;
        } else {
            finishScenario();
        }

        updateUI();
        updateStepsList(sampleScenario.steps);
        updateTimeline();
    }

    function recordViolation(type, description) {
        state.errorCount++;
        state.score = Math.max(0, state.score - 5);
        state.violations.push({
            type: type,
            description: description,
            timestamp: Date.now(),
            elapsed: state.elapsedTime
        });

        const violationsList = document.getElementById('violationsList');
        const timeStr = formatTime(state.elapsedTime);
        
        if (violationsList.querySelector('.empty-text')) {
            violationsList.innerHTML = '';
        }

        const item = document.createElement('div');
        item.className = 'violation-item';
        item.innerHTML = `
            <div class="violation-time">[${timeStr}]</div>
            <div class="violation-desc">${description}</div>
        `;
        violationsList.appendChild(item);
        violationsList.scrollTop = violationsList.scrollHeight;

        updateUI();
    }

    function checkForbiddenZone(x, z) {
        forbiddenZones.forEach(zone => {
            const dx = x - zone.x;
            const dz = z - zone.z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            
            if (distance < zone.radius) {
                recordViolation('forbidden_zone', `进入禁区: ${zone.name}`);
                showHint(`🚫 警告: 进入禁区 ${zone.name}`, 'error');
            }
        });
    }

    function showHint(text, type = 'info') {
        const hintPanel = document.getElementById('hintPanel');
        const hintText = document.getElementById('hintText');
        
        hintText.textContent = text;
        hintPanel.className = 'hint-panel';
        
        if (type === 'error') {
            hintPanel.style.background = 'rgba(255, 68, 68, 0.9)';
        } else if (type === 'success') {
            hintPanel.style.background = 'rgba(0, 255, 136, 0.9)';
        } else {
            hintPanel.style.background = 'rgba(0, 212, 255, 0.9)';
        }

        setTimeout(() => {
            hintPanel.classList.add('hidden');
        }, 2500);
    }

    function startTimer() {
        state.startTime = Date.now();
        state.timerInterval = setInterval(() => {
            if (!state.isPaused) {
                state.elapsedTime = Math.floor((Date.now() - state.startTime) / 1000);
                updateUI();
            }
        }, 1000);
    }

    function resetTimer() {
        if (state.timerInterval) {
            clearInterval(state.timerInterval);
            state.timerInterval = null;
        }
        state.startTime = null;
        state.elapsedTime = 0;
    }

    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    function updateStepsList(steps) {
        const stepsList = document.getElementById('stepsList');
        stepsList.innerHTML = '';

        steps.forEach((step, index) => {
            const isCompleted = state.completedSteps.includes(step.id);
            const isActive = index === state.currentStepIndex;
            
            const item = document.createElement('div');
            item.className = `step-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`;
            item.innerHTML = `
                <span class="step-number">${index + 1}</span>
                ${step.name}
                <span style="float: right; font-size: 10px; opacity: 0.7;">+${step.points}分</span>
            `;
            item.addEventListener('click', () => {
                showHint(`💡 ${step.hint}`, 'info');
            });
            stepsList.appendChild(item);
        });
    }

    function updateHazardsList(hazards) {
        const list = document.getElementById('hazardsList');
        list.innerHTML = '';

        hazards.forEach(hazard => {
            const item = document.createElement('div');
            item.className = `item-card ${hazard.type}`;
            item.innerHTML = `
                <div class="item-name">${hazard.name}</div>
                <div class="item-status">状态: ${hazard.status === 'active' ? '激活' : '警告'}</div>
            `;
            list.appendChild(item);
        });
    }

    function updateEquipmentList(equipment) {
        const list = document.getElementById('equipmentList');
        list.innerHTML = '';

        equipment.forEach(equip => {
            const item = document.createElement('div');
            item.className = `item-card ${equip.status === 'on' ? 'warning' : 'safe'}`;
            item.dataset.equipId = equip.id;
            item.innerHTML = `
                <div class="item-name">${equip.name}</div>
                <div class="item-status">状态: ${equip.status === 'on' ? '开启' : '关闭'}</div>
            `;
            list.appendChild(item);
        });
    }

    function updateTimelineMarkers(steps) {
        const markersContainer = document.getElementById('timelineMarkers');
        markersContainer.innerHTML = '';

        steps.forEach((step, index) => {
            const position = (index / (steps.length - 1)) * 100;
            const marker = document.createElement('div');
            marker.className = 'timeline-marker';
            marker.style.left = `${position}%`;
            marker.title = step.name;
            markersContainer.appendChild(marker);
        });

        const slider = document.getElementById('timelineSlider');
        slider.max = steps.length - 1;
    }

    function updateTimeline() {
        const slider = document.getElementById('timelineSlider');
        slider.value = state.currentStepIndex;

        document.querySelectorAll('.timeline-marker').forEach((marker, index) => {
            marker.classList.remove('completed', 'error');
            if (state.completedSteps.includes(sampleScenario.steps[index].id)) {
                marker.classList.add('completed');
            }
        });
    }

    function updateUI() {
        document.getElementById('currentStep').textContent = 
            state.currentStepIndex < sampleScenario.steps.length 
                ? sampleScenario.steps[state.currentStepIndex].name 
                : '已完成';
        document.getElementById('elapsedTime').textContent = formatTime(state.elapsedTime);
        document.getElementById('errorCount').textContent = state.errorCount;
        document.getElementById('currentScore').textContent = state.score;
    }

    function switchCameraView(view) {
        state.currentView = view;
        
        const positions = {
            overview: { pos: [8, 10, 8], target: [0, 0, 0] },
            entrance: { pos: [0, 8, 6], target: [0, 0, 0] },
            center: { pos: [0, 8, 0], target: [0, 0, 0] },
            exit: { pos: [4, 6, -3], target: [4, 0, -5] }
        };

        const viewConfig = positions[view];
        if (viewConfig) {
            animateCamera(viewConfig.pos, viewConfig.target);
        }

        document.querySelectorAll('.cam-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });
    }

    function animateCamera(targetPos, lookAt) {
        const startPos = camera.position.clone();
        const startTarget = controls.target.clone();
        const endPos = new THREE.Vector3(...targetPos);
        const endTarget = new THREE.Vector3(...lookAt);
        
        const duration = 1000;
        const startTime = Date.now();

        function animate() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);

            camera.position.lerpVectors(startPos, endPos, eased);
            controls.target.lerpVectors(startTarget, endTarget, eased);
            controls.update();

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        }
        animate();
    }

    function toggleFilter(filterName, enabled) {
        state.filters[filterName] = enabled;
        
        const objects = state.sceneObjects[filterName];
        if (objects) {
            objects.forEach(obj => {
                if (obj.mesh) obj.mesh.visible = enabled;
                if (obj.pulse) obj.pulse.visible = enabled;
                if (obj.sign) obj.sign.visible = enabled;
                if (obj.border) obj.border.visible = enabled;
                if (obj.label) obj.label.visible = enabled;
                if (obj instanceof THREE.Line || obj instanceof THREE.Mesh) {
                    obj.visible = enabled;
                }
            });
        }
    }

    function startPlayback() {
        if (!state.isPlaying) {
            startTimer();
            state.isPlaying = true;
        }
        state.isPaused = false;
        
        const currentStep = sampleScenario.steps[state.currentStepIndex];
        if (currentStep) {
            showHint(`💡 ${currentStep.hint}`, 'info');
        }
    }

    function pausePlayback() {
        state.isPaused = true;
        showHint('⏸️ 演练已暂停', 'info');
    }

    function prevStep() {
        if (state.currentStepIndex > 0) {
            state.currentStepIndex--;
            updateUI();
            updateStepsList(sampleScenario.steps);
            updateTimeline();
        }
    }

    function nextStep() {
        if (state.currentStepIndex < sampleScenario.steps.length - 1) {
            state.currentStepIndex++;
            updateUI();
            updateStepsList(sampleScenario.steps);
            updateTimeline();
        }
    }

    function onTimelineChange(e) {
        state.currentStepIndex = parseInt(e.target.value);
        updateUI();
        updateStepsList(sampleScenario.steps);
        updateTimeline();
    }

    function resetScenario() {
        loadScenario(sampleScenario);
        showHint('🔄 场景已重置', 'success');
    }

    function importScenario() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const scenario = JSON.parse(event.target.result);
                        loadScenario(scenario);
                        showHint('✅ 场景导入成功', 'success');
                    } catch (err) {
                        showHint('❌ 文件格式错误', 'error');
                    }
                };
                reader.readAsText(file);
            }
        };
        input.click();
    }

    function finishScenario() {
        state.isPlaying = false;
        if (state.timerInterval) {
            clearInterval(state.timerInterval);
        }
        showHint('🎉 演练完成！请查看报告', 'success');
        setTimeout(() => showReport(), 1500);
    }

    function calculateScore() {
        const totalPossible = sampleScenario.steps.reduce((sum, s) => sum + s.points, 0);
        const percentage = Math.round((state.score / totalPossible) * 100);
        
        let grade = 'A';
        if (percentage < 60) grade = 'D';
        else if (percentage < 75) grade = 'C';
        else if (percentage < 90) grade = 'B';
        
        return {
            score: state.score,
            totalPossible,
            percentage,
            grade
        };
    }

    function showReport() {
        const scoreData = calculateScore();
        const reportContent = document.getElementById('reportContent');
        
        reportContent.innerHTML = `
            <div class="report-section">
                <h3>📊 演练概览</h3>
                <div class="report-grid">
                    <div class="report-card">
                        <div class="label">总得分</div>
                        <div class="value ${scoreData.percentage >= 80 ? 'excellent' : scoreData.percentage < 60 ? 'bad' : ''}">
                            ${scoreData.score}/${scoreData.totalPossible}
                        </div>
                    </div>
                    <div class="report-card">
                        <div class="label">评级</div>
                        <div class="value ${scoreData.percentage >= 80 ? 'excellent' : scoreData.percentage < 60 ? 'bad' : ''}">
                            ${scoreData.grade}
                        </div>
                    </div>
                    <div class="report-card">
                        <div class="label">用时</div>
                        <div class="value">${formatTime(state.elapsedTime)}</div>
                    </div>
                    <div class="report-card">
                        <div class="label">错误次数</div>
                        <div class="value ${state.errorCount > 0 ? 'bad' : 'excellent'}">${state.errorCount}</div>
                    </div>
                </div>
            </div>

            <div class="report-section">
                <h3>📋 步骤详情</h3>
                <div class="report-steps">
                    ${sampleScenario.steps.map((step, idx) => {
                        const completed = state.completedSteps.includes(step.id);
                        const history = state.stepHistory.find(h => h.stepId === step.id);
                        return `
                            <div class="report-step ${completed ? 'correct' : 'incorrect'}">
                                <span class="step-num">${idx + 1}</span>
                                <span class="step-name">${step.name}</span>
                                <span class="step-time">${completed ? formatTime(history?.elapsed || 0) : '未完成'}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>

            ${state.violations.length > 0 ? `
                <div class="report-section">
                    <h3>🚫 违规记录</h3>
                    <div class="report-steps">
                        ${state.violations.map((v, idx) => `
                            <div class="report-step incorrect">
                                <span class="step-num">${idx + 1}</span>
                                <span class="step-name">${v.description}</span>
                                <span class="step-time">${formatTime(v.elapsed)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}

            <div class="report-section">
                <h3>💡 总结评价</h3>
                <p style="line-height: 1.8; color: #ccc;">
                    ${scoreData.percentage >= 90 ? '优秀！你完全掌握了实验室安全应急处置流程。' :
                      scoreData.percentage >= 75 ? '良好！基本掌握了处置流程，建议加强细节练习。' :
                      scoreData.percentage >= 60 ? '及格！需要加强对操作顺序的理解。' :
                      '不及格！请认真学习安全规范后重新演练。'}
                    <br><br>
                    <strong>关键要点：</strong>发生泄漏时，应先切断电源，再关闭通风，穿戴防护装备后处理泄漏，最后撤离。
                    注意避开危险区域，按照指定路线撤离。
                </p>
            </div>

            <div class="report-section">
                <h3>📝 元数据</h3>
                <div style="font-size: 12px; color: #888;">
                    <p>场景名称: ${sampleScenario.name}</p>
                    <p>演练时间: ${new Date().toLocaleString()}</p>
                    <p>当前视角: ${state.currentView}</p>
                    <p>时间轴位置: 步骤 ${state.currentStepIndex + 1}/${sampleScenario.steps.length}</p>
                </div>
            </div>
        `;

        document.getElementById('reportModal').classList.remove('hidden');
    }

    function downloadPDFReport() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        doc.setFontSize(20);
        doc.setTextColor(0, 100, 150);
        doc.text('实验室安全演练报告', 20, 25);
        
        doc.setFontSize(12);
        doc.setTextColor(100);
        doc.text(`生成时间: ${new Date().toLocaleString()}`, 20, 35);
        doc.text(`场景: ${sampleScenario.name}`, 20, 42);
        
        doc.setFontSize(14);
        doc.setTextColor(50);
        doc.text('演练结果', 20, 55);
        
        const scoreData = calculateScore();
        doc.setFontSize(11);
        doc.text(`总得分: ${scoreData.score}/${scoreData.totalPossible}`, 25, 65);
        doc.text(`评级: ${scoreData.grade}`, 25, 72);
        doc.text(`用时: ${formatTime(state.elapsedTime)}`, 25, 79);
        doc.text(`错误次数: ${state.errorCount}`, 25, 86);
        
        doc.setFontSize(14);
        doc.text('步骤完成情况', 20, 100);
        
        let y = 110;
        sampleScenario.steps.forEach((step, idx) => {
            const completed = state.completedSteps.includes(step.id);
            doc.setFontSize(10);
            doc.text(`${idx + 1}. ${step.name} - ${completed ? '✓ 完成' : '✗ 未完成'}`, 25, y);
            y += 8;
        });

        doc.save('lab-safety-report.pdf');
        showHint('✅ PDF报告已下载', 'success');
    }

    function downloadJSONReport() {
        const reportData = {
            scenario: sampleScenario.name,
            generatedAt: new Date().toISOString(),
            score: calculateScore(),
            elapsedTime: state.elapsedTime,
            errorCount: state.errorCount,
            completedSteps: state.completedSteps,
            violations: state.violations,
            stepHistory: state.stepHistory,
            metadata: {
                currentView: state.currentView,
                timelinePosition: state.currentStepIndex,
                filters: state.filters
            }
        };

        const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'lab-safety-report.json';
        a.click();
        URL.revokeObjectURL(url);
        
        showHint('✅ JSON报告已下载', 'success');
    }

    function animate() {
        requestAnimationFrame(animate);
        controls.update();
        
        const time = Date.now() * 0.001;
        interactiveObjects.forEach((obj, index) => {
            if (obj.pulse) {
                const scale = 1 + Math.sin(time * 2 + index) * 0.2;
                obj.pulse.scale.set(scale, scale, 1);
            }
            if (obj.sign) {
                obj.sign.position.y = 1.2 + Math.sin(time * 3 + index) * 0.1;
            }
        });

        if (playerMarker) {
            playerMarker.position.y = 0.6 + Math.sin(time * 2) * 0.05;
        }

        renderer.render(scene, camera);
    }

    return {
        init,
        resetScenario,
        showReport
    };
})();

document.addEventListener('DOMContentLoaded', () => {
    LabSafetyVR.init();
});
