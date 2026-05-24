class ShelterLayoutApp {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.is3DMode = false;
        this.objects = [];
        this.selectedObject = null;
        this.draggingObject = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.gridHelper = null;
        this.venue = null;
        this.passages = [];
        this.isDragging = false;
        this.dragStartPos = new THREE.Vector2();
        this.currentStep = 0;
        this.isPlaying = false;
        this.playInterval = null;
        this.schemes = { 1: [], 2: [], 3: [] };
        this.activeScheme = 1;
        this.filters = {
            bed: true,
            isolation: true,
            volunteer: true,
            passage: true
        };
        this.objectConfigs = {
            bed: { width: 0.9, depth: 2, height: 0.5, color: 0x1890ff, name: '标准床位', capacity: 1 },
            'bed-double': { width: 1.2, depth: 2, height: 0.5, color: 0x722ed1, name: '加宽床位', capacity: 2 },
            isolation: { width: 4, depth: 4, height: 0.1, color: 0xfaad14, name: '隔离区', capacity: 0 },
            volunteer: { width: 1.5, depth: 1.5, height: 0.3, color: 0x52c41a, name: '志愿者岗', capacity: 0 },
            entrance: { width: 2, depth: 0.5, height: 0.1, color: 0x13c2c2, name: '出入口', capacity: 0 },
            'fire-exit': { width: 1.5, depth: 0.5, height: 0.1, color: 0xff4d4f, name: '消防出口', capacity: 0 }
        };
        this.venueConfig = { width: 30, depth: 20 };
        this.init();
    }

    init() {
        this.initThreeJS();
        this.initEventListeners();
        this.createVenue();
        this.createPassages();
        this.createGrid();
        this.animate();
        this.updateStats();
        this.validateAll();
    }

    initThreeJS() {
        const container = document.getElementById('canvasContainer');
        if (!container) {
            console.error('canvasContainer not found, retrying...');
            setTimeout(() => this.initThreeJS(), 100);
            return;
        }

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a2e);

        const width = container.clientWidth || 800;
        const height = container.clientHeight || 600;

        this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
        this.setCameraView('top');

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(this.renderer.domElement);

        if (typeof THREE.OrbitControls !== 'undefined') {
            this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.05;
            this.controls.maxPolarAngle = Math.PI / 2;
        }

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 20, 10);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);

        window.addEventListener('resize', () => this.onWindowResize());
    }

    setCameraView(view) {
        const { width, depth } = this.venueConfig;
        const distance = Math.max(width, depth) * 1.2;

        switch (view) {
            case 'top':
                this.camera.position.set(0, distance, 0);
                this.camera.lookAt(0, 0, 0);
                break;
            case 'front':
                this.camera.position.set(0, distance * 0.5, distance);
                this.camera.lookAt(0, 0, 0);
                break;
            case 'iso':
                this.camera.position.set(distance * 0.7, distance * 0.7, distance * 0.7);
                this.camera.lookAt(0, 0, 0);
                break;
        }
    }

    createVenue() {
        const { width, depth } = this.venueConfig;
        
        const floorGeometry = new THREE.PlaneGeometry(width, depth);
        const floorMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x2d3436,
            roughness: 0.8
        });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        floor.name = 'venue_floor';
        this.scene.add(floor);
        this.venue = floor;

        const wallMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x636e72,
            transparent: true,
            opacity: 0.8
        });
        const wallHeight = 3;
        const wallThickness = 0.3;

        const walls = [
            { w: width, h: wallHeight, d: wallThickness, x: 0, y: wallHeight / 2, z: -depth / 2 },
            { w: width, h: wallHeight, d: wallThickness, x: 0, y: wallHeight / 2, z: depth / 2 },
            { w: wallThickness, h: wallHeight, d: depth, x: -width / 2, y: wallHeight / 2, z: 0 },
            { w: wallThickness, h: wallHeight, d: depth, x: width / 2, y: wallHeight / 2, z: 0 }
        ];

        walls.forEach(w => {
            const wallGeo = new THREE.BoxGeometry(w.w, w.h, w.d);
            const wall = new THREE.Mesh(wallGeo, wallMaterial);
            wall.position.set(w.x, w.y, w.z);
            wall.receiveShadow = true;
            this.scene.add(wall);
        });
    }

    createPassages() {
        this.passages.forEach(p => this.scene.remove(p));
        this.passages = [];

        const { width, depth } = this.venueConfig;
        const passageMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x74b9ff,
            transparent: true,
            opacity: 0.3
        });

        const mainPassages = [
            { x: 0, z: 0, w: width, d: 2 },
            { x: 0, z: -depth / 4, w: 2, d: depth / 2 - 1 },
            { x: 0, z: depth / 4, w: 2, d: depth / 2 - 1 }
        ];

        mainPassages.forEach(p => {
            const geo = new THREE.PlaneGeometry(p.w, p.d);
            const passage = new THREE.Mesh(geo, passageMaterial.clone());
            passage.rotation.x = -Math.PI / 2;
            passage.position.set(p.x, 0.01, p.z);
            passage.name = 'passage';
            passage.userData = { type: 'passage', width: p.w, depth: p.d };
            this.scene.add(passage);
            this.passages.push(passage);
        });
    }

    createGrid() {
        const { width, depth } = this.venueConfig;
        const size = Math.max(width, depth);
        this.gridHelper = new THREE.GridHelper(size, size, 0x444444, 0x333333);
        this.gridHelper.position.y = 0.02;
        this.scene.add(this.gridHelper);
    }

    createObject(type, x = 0, z = 0) {
        const config = this.objectConfigs[type];
        if (!config) return null;

        const geometry = new THREE.BoxGeometry(config.width, config.height, config.depth);
        const material = new THREE.MeshStandardMaterial({ 
            color: config.color,
            roughness: 0.5,
            metalness: 0.1
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(x, config.height / 2, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.name = config.name;
        mesh.userData = {
            type: type,
            config: config,
            id: Date.now() + Math.random()
        };

        const edges = new THREE.EdgesGeometry(geometry);
        const line = new THREE.LineSegments(
            edges,
            new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 })
        );
        mesh.add(line);

        this.scene.add(mesh);
        this.objects.push(mesh);
        
        this.updateStats();
        this.validateAll();
        
        return mesh;
    }

    deleteObject(obj) {
        const index = this.objects.indexOf(obj);
        if (index > -1) {
            this.objects.splice(index, 1);
            this.scene.remove(obj);
            this.selectedObject = null;
            this.updateSelectedInfo();
            this.updateStats();
            this.validateAll();
        }
    }

    selectObject(obj) {
        if (this.selectedObject) {
            this.selectedObject.material.emissive = new THREE.Color(0x000000);
        }
        
        this.selectedObject = obj;
        
        if (obj) {
            obj.material.emissive = new THREE.Color(0x222222);
        }
        
        this.updateSelectedInfo();
    }

    updateSelectedInfo() {
        const container = document.getElementById('selectedInfo');
        
        if (!this.selectedObject) {
            container.innerHTML = '<p class="empty-hint">点击场景中的元素查看详情</p>';
            return;
        }

        const data = this.selectedObject.userData;
        const config = data.config;
        
        container.innerHTML = `
            <div class="info-row">
                <span class="info-label">类型</span>
                <span class="info-value">${config.name}</span>
            </div>
            <div class="info-row">
                <span class="info-label">尺寸</span>
                <span class="info-value">${config.width}m × ${config.depth}m</span>
            </div>
            <div class="info-row">
                <span class="info-label">位置</span>
                <span class="info-value">(${this.selectedObject.position.x.toFixed(1)}, ${this.selectedObject.position.z.toFixed(1)})</span>
            </div>
            <div class="info-actions">
                <button class="btn-small" id="rotateBtn">旋转90°</button>
                <button class="btn-small" id="deleteBtn" style="background: #fff1f0; color: #ff4d4f; border-color: #ffa39e;">删除</button>
            </div>
        `;

        document.getElementById('rotateBtn')?.addEventListener('click', () => {
            this.selectedObject.rotation.y += Math.PI / 2;
            this.updateSelectedInfo();
            this.validateAll();
        });

        document.getElementById('deleteBtn')?.addEventListener('click', () => {
            this.deleteObject(this.selectedObject);
        });
    }

    updateStats() {
        const stats = {
            beds: 0,
            isolation: 0,
            volunteers: 0,
            capacity: 0
        };

        this.objects.forEach(obj => {
            const type = obj.userData.type;
            const config = obj.userData.config;
            
            if (type === 'bed' || type === 'bed-double') {
                stats.beds++;
                stats.capacity += config.capacity;
            } else if (type === 'isolation') {
                stats.isolation++;
            } else if (type === 'volunteer') {
                stats.volunteers++;
            }
        });

        document.getElementById('statBeds').textContent = stats.beds;
        document.getElementById('statIsolation').textContent = stats.isolation;
        document.getElementById('statVolunteers').textContent = stats.volunteers;
        document.getElementById('statCapacity').textContent = stats.capacity;
    }

    validateAll() {
        const results = {
            firePassage: true,
            bedSpacing: true,
            isolationDistance: true,
            mainPassage: true
        };

        const fireExits = this.objects.filter(o => o.userData.type === 'fire-exit');
        const entrances = this.objects.filter(o => o.userData.type === 'entrance');
        
        this.objects.forEach(obj => {
            const type = obj.userData.type;
            if (type === 'bed' || type === 'bed-double' || type === 'isolation') {
                this.passages.forEach(passage => {
                    if (this.checkCollision(obj, passage)) {
                        results.firePassage = false;
                    }
                });
            }
        });

        const beds = this.objects.filter(o => o.userData.type === 'bed' || o.userData.type === 'bed-double');
        for (let i = 0; i < beds.length; i++) {
            for (let j = i + 1; j < beds.length; j++) {
                const dist = beds[i].position.distanceTo(beds[j].position);
                const minDist = (beds[i].userData.config.width + beds[j].userData.config.width) / 2 + 0.5;
                if (dist < minDist) {
                    results.bedSpacing = false;
                }
            }
        }

        const isolations = this.objects.filter(o => o.userData.type === 'isolation');
        isolations.forEach(iso => {
            entrances.forEach(entrance => {
                const dist = iso.position.distanceTo(entrance.position);
                if (dist < 5) {
                    results.isolationDistance = false;
                }
            });
        });

        results.mainPassage = this.passages.length > 0;

        this.updateValidationUI(results);
    }

    checkCollision(obj1, obj2) {
        const box1 = new THREE.Box3().setFromObject(obj1);
        const box2 = new THREE.Box3().setFromObject(obj2);
        return box1.intersectsBox(box2);
    }

    updateValidationUI(results) {
        const items = document.querySelectorAll('.validation-item');
        const badge = document.getElementById('validationBadge');
        
        const validations = [
            { key: 'firePassage', text: '消防通道畅通' },
            { key: 'bedSpacing', text: '床位间距 ≥ 0.5m' },
            { key: 'isolationDistance', text: '隔离区远离入口' },
            { key: 'mainPassage', text: '主通道 ≥ 2m' }
        ];

        let allPass = true;
        
        items.forEach((item, index) => {
            const result = results[validations[index].key];
            item.className = `validation-item ${result ? 'pass' : 'fail'}`;
            item.querySelector('.val-icon').textContent = result ? '✓' : '✗';
            item.querySelector('.val-text').textContent = validations[index].text;
            
            if (!result) allPass = false;
        });

        badge.className = `validation-badge ${allPass ? '' : 'error'}`;
        badge.querySelector('.badge-icon').textContent = allPass ? '✓' : '⚠';
        badge.querySelector('.badge-text').textContent = allPass ? '合规' : '违规';
    }

    initEventListeners() {
        const canvas = this.renderer.domElement;

        canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        canvas.addEventListener('click', (e) => this.onClick(e));

        document.querySelectorAll('.item').forEach(item => {
            item.addEventListener('dragstart', (e) => this.onDragStart(e));
        });

        canvas.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });

        canvas.addEventListener('drop', (e) => this.onDrop(e));

        document.getElementById('view2D').addEventListener('click', () => this.setViewMode(false));
        document.getElementById('view3D').addEventListener('click', () => this.setViewMode(true));

        document.querySelectorAll('[data-view]').forEach(btn => {
            btn.addEventListener('click', () => this.setCameraView(btn.dataset.view));
        });

        document.getElementById('resetBtn').addEventListener('click', () => this.resetAll());
        document.getElementById('exportBtn').addEventListener('click', () => this.showReport());

        document.querySelectorAll('.filter-item input').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => this.toggleFilter(e.target.dataset.filter, e.target.checked));
        });

        document.querySelectorAll('.scheme-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.classList.contains('save-scheme')) {
                    this.switchScheme(parseInt(item.dataset.scheme));
                }
            });
        });

        document.querySelectorAll('.save-scheme').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const schemeId = parseInt(btn.closest('.scheme-item').dataset.scheme);
                this.saveScheme(schemeId);
            });
        });

        document.getElementById('prevStep').addEventListener('click', () => this.setStep(this.currentStep - 1));
        document.getElementById('nextStep').addEventListener('click', () => this.setStep(this.currentStep + 1));
        document.getElementById('playTimeline').addEventListener('click', () => this.togglePlay());

        document.querySelectorAll('.step').forEach(step => {
            step.addEventListener('click', () => this.setStep(parseInt(step.dataset.step)));
        });

        document.getElementById('zoomIn').addEventListener('click', () => this.zoom(0.8));
        document.getElementById('zoomOut').addEventListener('click', () => this.zoom(1.25));
        document.getElementById('zoomReset').addEventListener('click', () => this.setCameraView('top'));

        document.getElementById('sampleSelect').addEventListener('change', (e) => {
            if (e.target.value) {
                this.loadSample(e.target.value);
                e.target.value = '';
            }
        });

        document.querySelectorAll('.close-modal, .close-modal-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById('reportModal').classList.remove('show');
            });
        });

        document.getElementById('downloadPDF').addEventListener('click', () => this.downloadPDF());
    }

    onMouseDown(e) {
        this.updateMouse(e);
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        const intersects = this.raycaster.intersectObjects(this.objects);
        
        if (intersects.length > 0) {
            this.isDragging = true;
            this.draggingObject = intersects[0].object;
            this.selectObject(this.draggingObject);
            this.dragStartPos.copy(this.mouse);
            
            if (this.controls) {
                this.controls.enabled = false;
            }
        }
    }

    onMouseMove(e) {
        this.updateMouse(e);
        
        if (this.isDragging && this.draggingObject) {
            const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
            const intersectPoint = new THREE.Vector3();
            this.raycaster.setFromCamera(this.mouse, this.camera);
            this.raycaster.ray.intersectPlane(plane, intersectPoint);
            
            if (intersectPoint) {
                const { width, depth } = this.venueConfig;
                const halfW = width / 2 - this.draggingObject.userData.config.width / 2;
                const halfD = depth / 2 - this.draggingObject.userData.config.depth / 2;
                
                intersectPoint.x = Math.max(-halfW, Math.min(halfW, intersectPoint.x));
                intersectPoint.z = Math.max(-halfD, Math.min(halfD, intersectPoint.z));
                
                intersectPoint.y = this.draggingObject.position.y;
                this.draggingObject.position.copy(intersectPoint);
                
                this.updateSelectedInfo();
            }
        }
    }

    onMouseUp(e) {
        this.isDragging = false;
        this.draggingObject = null;
        
        if (this.controls) {
            this.controls.enabled = true;
        }
        
        this.validateAll();
    }

    onClick(e) {
        if (this.isDragging) return;
        
        this.updateMouse(e);
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        const intersects = this.raycaster.intersectObjects(this.objects);
        
        if (intersects.length > 0) {
            this.selectObject(intersects[0].object);
        } else {
            this.selectObject(null);
        }
    }

    updateMouse(e) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    }

    onDragStart(e) {
        e.dataTransfer.setData('text/plain', e.target.closest('.item').dataset.type);
        e.dataTransfer.effectAllowed = 'copy';
    }

    onDrop(e) {
        e.preventDefault();
        const type = e.dataTransfer.getData('text/plain');
        
        this.updateMouse(e);
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const intersectPoint = new THREE.Vector3();
        this.raycaster.setFromCamera(this.mouse, this.camera);
        this.raycaster.ray.intersectPlane(plane, intersectPoint);
        
        if (intersectPoint && type) {
            const { width, depth } = this.venueConfig;
            const config = this.objectConfigs[type];
            const halfW = width / 2 - config.width / 2;
            const halfD = depth / 2 - config.depth / 2;
            
            intersectPoint.x = Math.max(-halfW, Math.min(halfW, intersectPoint.x));
            intersectPoint.z = Math.max(-halfD, Math.min(halfD, intersectPoint.z));
            
            const obj = this.createObject(type, intersectPoint.x, intersectPoint.z);
            if (obj) {
                this.selectObject(obj);
            }
        }
    }

    setViewMode(is3D) {
        this.is3DMode = is3D;
        
        document.getElementById('view2D').classList.toggle('active', !is3D);
        document.getElementById('view3D').classList.toggle('active', is3D);
        
        if (this.controls) {
            this.controls.enableRotate = is3D;
        }
        
        if (!is3D) {
            this.setCameraView('top');
        } else {
            this.setCameraView('iso');
        }
    }

    toggleFilter(type, enabled) {
        this.filters[type] = enabled;
        
        this.objects.forEach(obj => {
            const objType = obj.userData.type;
            let shouldShow = true;
            
            if (objType === 'bed' || objType === 'bed-double') {
                shouldShow = this.filters.bed;
            } else if (objType === 'isolation') {
                shouldShow = this.filters.isolation;
            } else if (objType === 'volunteer') {
                shouldShow = this.filters.volunteer;
            }
            
            obj.visible = shouldShow;
        });

        this.passages.forEach(p => {
            p.visible = this.filters.passage;
        });
    }

    setStep(step) {
        if (step < 0 || step > 3) return;
        
        this.currentStep = step;
        
        document.querySelectorAll('.step').forEach((s, i) => {
            s.classList.toggle('active', i <= step);
        });
        
        document.getElementById('timelineProgress').style.width = `${(step / 3) * 100}%`;
        
        this.applyStepVisibility();
    }

    applyStepVisibility() {
        this.objects.forEach(obj => {
            const type = obj.userData.type;
            let visible = true;
            
            switch (this.currentStep) {
                case 0:
                    visible = (type === 'entrance' || type === 'fire-exit');
                    break;
                case 1:
                    visible = (type === 'isolation' || type === 'entrance' || type === 'fire-exit');
                    break;
                case 2:
                    visible = true;
                    break;
                case 3:
                    visible = true;
                    break;
            }
            
            obj.visible = visible && this.filters[type.replace('-double', '')] !== false;
        });
    }

    togglePlay() {
        this.isPlaying = !this.isPlaying;
        const btn = document.getElementById('playTimeline');
        btn.textContent = this.isPlaying ? '⏸' : '▶';
        
        if (this.isPlaying) {
            this.playInterval = setInterval(() => {
                if (this.currentStep >= 3) {
                    this.setStep(0);
                } else {
                    this.setStep(this.currentStep + 1);
                }
            }, 2000);
        } else {
            clearInterval(this.playInterval);
        }
    }

    saveScheme(id) {
        this.schemes[id] = this.objects.map(obj => ({
            type: obj.userData.type,
            position: {
                x: obj.position.x,
                y: obj.position.y,
                z: obj.position.z
            },
            rotation: {
                x: obj.rotation.x,
                y: obj.rotation.y,
                z: obj.rotation.z
            }
        }));
        
        alert(`方案 ${String.fromCharCode(64 + id)} 已保存`);
    }

    switchScheme(id) {
        this.saveScheme(this.activeScheme);
        
        this.objects.forEach(obj => this.scene.remove(obj));
        this.objects = [];
        this.selectedObject = null;
        
        const scheme = this.schemes[id];
        scheme.forEach(data => {
            const obj = this.createObject(data.type, data.position.x, data.position.z);
            if (obj) {
                obj.position.y = data.position.y;
                obj.rotation.set(data.rotation.x, data.rotation.y, data.rotation.z);
            }
        });
        
        this.activeScheme = id;
        
        document.querySelectorAll('.scheme-item').forEach(item => {
            item.classList.toggle('active', parseInt(item.dataset.scheme) === id);
        });
        
        this.updateStats();
        this.updateSelectedInfo();
        this.validateAll();
    }

    resetAll() {
        this.objects.forEach(obj => this.scene.remove(obj));
        this.objects = [];
        this.selectedObject = null;
        this.currentStep = 0;
        this.setStep(0);
        this.updateStats();
        this.updateSelectedInfo();
        this.validateAll();
    }

    loadSample(type) {
        this.resetAll();
        
        const samples = {
            gymnasium: () => {
                this.createObject('entrance', -12, 10);
                this.createObject('entrance', 12, 10);
                this.createObject('fire-exit', -12, -9);
                this.createObject('fire-exit', 12, -9);
                this.createObject('fire-exit', 0, -9);
                
                this.createObject('isolation', -10, -5);
                this.createObject('isolation', 10, -5);
                
                this.createObject('volunteer', 0, 8);
                this.createObject('volunteer', -8, 0);
                this.createObject('volunteer', 8, 0);
                
                for (let row = 0; row < 3; row++) {
                    for (let col = 0; col < 4; col++) {
                        this.createObject('bed', -7 + col * 3.5, -2 + row * 3);
                        this.createObject('bed', 3.5 + col * 3.5, -2 + row * 3);
                    }
                }
            },
            auditorium: () => {
                this.createObject('entrance', 0, 9);
                this.createObject('fire-exit', -14, 0);
                this.createObject('fire-exit', 14, 0);
                
                this.createObject('isolation', -12, -7);
                this.createObject('volunteer', 0, 6);
                
                for (let row = 0; row < 4; row++) {
                    for (let col = 0; col < 6; col++) {
                        this.createObject('bed', -10 + col * 3, -6 + row * 3);
                    }
                }
            },
            classroom: () => {
                this.createObject('entrance', 8, 8);
                this.createObject('fire-exit', -8, 8);
                
                this.createObject('isolation', -6, -6);
                this.createObject('volunteer', 0, 6);
                
                for (let row = 0; row < 2; row++) {
                    for (let col = 0; col < 3; col++) {
                        this.createObject('bed', -4 + col * 3, -2 + row * 3);
                    }
                }
            }
        };
        
        if (samples[type]) {
            samples[type]();
            this.setStep(3);
        }
    }

    zoom(factor) {
        this.camera.position.multiplyScalar(factor);
    }

    showReport() {
        const modal = document.getElementById('reportModal');
        const content = document.getElementById('reportContent');
        
        const stats = {
            beds: 0,
            isolation: 0,
            volunteers: 0,
            capacity: 0,
            entrances: 0,
            fireExits: 0
        };

        this.objects.forEach(obj => {
            const type = obj.userData.type;
            const config = obj.userData.config;
            
            if (type === 'bed' || type === 'bed-double') {
                stats.beds++;
                stats.capacity += config.capacity;
            } else if (type === 'isolation') {
                stats.isolation++;
            } else if (type === 'volunteer') {
                stats.volunteers++;
            } else if (type === 'entrance') {
                stats.entrances++;
            } else if (type === 'fire-exit') {
                stats.fireExits++;
            }
        });

        const validationResults = [];
        document.querySelectorAll('.validation-item').forEach(item => {
            validationResults.push({
                pass: item.classList.contains('pass'),
                text: item.querySelector('.val-text').textContent
            });
        });

        const now = new Date();
        const timeStr = now.toLocaleString('zh-CN');

        content.innerHTML = `
            <div class="report-section">
                <h3>基本信息</h3>
                <div style="display: flex; gap: 20px; font-size: 13px; color: #595959;">
                    <span>生成时间：${timeStr}</span>
                    <span>场馆尺寸：${this.venueConfig.width}m × ${this.venueConfig.depth}m</span>
                    <span>方案：方案 ${String.fromCharCode(64 + this.activeScheme)}</span>
                </div>
            </div>
            
            <div class="report-section">
                <h3>排布统计</h3>
                <div class="report-grid">
                    <div class="report-stat">
                        <div class="report-stat-value">${stats.beds}</div>
                        <div class="report-stat-label">床位总数</div>
                    </div>
                    <div class="report-stat">
                        <div class="report-stat-value">${stats.capacity}</div>
                        <div class="report-stat-label">容纳人数</div>
                    </div>
                    <div class="report-stat">
                        <div class="report-stat-value">${stats.isolation}</div>
                        <div class="report-stat-label">隔离区域</div>
                    </div>
                    <div class="report-stat">
                        <div class="report-stat-value">${stats.volunteers}</div>
                        <div class="report-stat-label">志愿者岗</div>
                    </div>
                </div>
            </div>
            
            <div class="report-section">
                <h3>出入口配置</h3>
                <div class="report-grid">
                    <div class="report-stat">
                        <div class="report-stat-value">${stats.entrances}</div>
                        <div class="report-stat-label">主出入口</div>
                    </div>
                    <div class="report-stat">
                        <div class="report-stat-value">${stats.fireExits}</div>
                        <div class="report-stat-label">消防出口</div>
                    </div>
                    <div class="report-stat">
                        <div class="report-stat-value">3</div>
                        <div class="report-stat-label">主通道数</div>
                    </div>
                    <div class="report-stat">
                        <div class="report-stat-value">2m</div>
                        <div class="report-stat-label">通道宽度</div>
                    </div>
                </div>
            </div>
            
            <div class="report-section">
                <h3>规则校验结果</h3>
                <div class="report-validation">
                    ${validationResults.map(v => `
                        <div class="report-val-item ${v.pass ? 'pass' : 'fail'}">
                            <span style="color: ${v.pass ? '#52c41a' : '#ff4d4f'}; font-weight: bold;">${v.pass ? '✓' : '✗'}</span>
                            <span>${v.text}</span>
                            <span style="margin-left: auto; color: ${v.pass ? '#52c41a' : '#ff4d4f'};">${v.pass ? '通过' : '不通过'}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="report-section">
                <h3>详细排布清单</h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                    <thead>
                        <tr style="background: #f5f5f5;">
                            <th style="padding: 8px; text-align: left; border: 1px solid #d9d9d9;">序号</th>
                            <th style="padding: 8px; text-align: left; border: 1px solid #d9d9d9;">类型</th>
                            <th style="padding: 8px; text-align: left; border: 1px solid #d9d9d9;">尺寸</th>
                            <th style="padding: 8px; text-align: left; border: 1px solid #d9d9d9;">位置 (X, Z)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.objects.map((obj, i) => `
                            <tr>
                                <td style="padding: 8px; border: 1px solid #d9d9d9;">${i + 1}</td>
                                <td style="padding: 8px; border: 1px solid #d9d9d9;">${obj.userData.config.name}</td>
                                <td style="padding: 8px; border: 1px solid #d9d9d9;">${obj.userData.config.width}m × ${obj.userData.config.depth}m</td>
                                <td style="padding: 8px; border: 1px solid #d9d9d9;">(${obj.position.x.toFixed(1)}, ${obj.position.z.toFixed(1)})</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        modal.classList.add('show');
    }

    async downloadPDF() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 14;
        let y = margin + 10;
        
        const addPageIfNeeded = (neededSpace) => {
            if (y + neededSpace > pageHeight - margin) {
                doc.addPage();
                y = margin + 10;
                return true;
            }
            return false;
        };
        
        const addSection = (title, fontSize = 14) => {
            addPageIfNeeded(15);
            doc.setFontSize(fontSize);
            doc.setFont(undefined, 'bold');
            doc.text(title, margin, y);
            y += 8;
            doc.setFont(undefined, 'normal');
        };
        
        const addText = (text, fontSize = 10, indent = 0) => {
            doc.setFontSize(fontSize);
            doc.text(text, margin + indent, y);
            y += 6;
        };
        
        const addRow = (columns, widths, fontSize = 9) => {
            doc.setFontSize(fontSize);
            let x = margin;
            columns.forEach((col, i) => {
                doc.text(String(col || ''), x, y);
                x += widths[i];
            });
            y += 6;
        };

        doc.setFontSize(20);
        doc.setFont(undefined, 'bold');
        doc.text('应急安置床位排布报告', pageWidth / 2, y, { align: 'center' });
        doc.setFont(undefined, 'normal');
        y += 15;

        addSection('基本信息', 12);
        addText(`生成时间: ${new Date().toLocaleString('zh-CN')}`);
        addText(`场馆尺寸: ${this.venueConfig.width}m × ${this.venueConfig.depth}m`);
        addText(`方案: 方案 ${String.fromCharCode(64 + this.activeScheme)}`);
        y += 4;

        const stats = {
            beds: 0,
            isolation: 0,
            volunteers: 0,
            capacity: 0,
            entrances: 0,
            fireExits: 0
        };

        this.objects.forEach(obj => {
            const type = obj.userData.type;
            const config = obj.userData.config;
            
            if (type === 'bed' || type === 'bed-double') {
                stats.beds++;
                stats.capacity += config.capacity;
            } else if (type === 'isolation') {
                stats.isolation++;
            } else if (type === 'volunteer') {
                stats.volunteers++;
            } else if (type === 'entrance') {
                stats.entrances++;
            } else if (type === 'fire-exit') {
                stats.fireExits++;
            }
        });

        addSection('排布统计', 12);
        addText(`床位总数: ${stats.beds}     容纳人数: ${stats.capacity}     隔离区域: ${stats.isolation}     志愿者岗: ${stats.volunteers}`);
        y += 4;

        addSection('出入口配置', 12);
        addText(`主出入口: ${stats.entrances} 个     消防出口: ${stats.fireExits} 个     主通道数: 3 条     通道宽度: 2m`);
        y += 4;

        addSection('规则校验结果', 12);
        const validationResults = [];
        document.querySelectorAll('.validation-item').forEach(item => {
            validationResults.push({
                pass: item.classList.contains('pass'),
                text: item.querySelector('.val-text').textContent
            });
        });
        validationResults.forEach(v => {
            addPageIfNeeded(8);
            const status = v.pass ? '✓ 通过' : '✗ 不通过';
            doc.setTextColor(v.pass ? 0 : 200, v.pass ? 150 : 0, v.pass ? 0 : 0);
            addText(`${status} - ${v.text}`);
            doc.setTextColor(0, 0, 0);
        });
        y += 4;

        addSection('详细排布清单', 12);
        addPageIfNeeded(10);
        
        doc.setFontSize(9);
        doc.setFont(undefined, 'bold');
        addRow(['序号', '类型', '尺寸', '位置 (X, Z)'], [12, 40, 35, 50]);
        doc.setFont(undefined, 'normal');
        
        doc.setDrawColor(200);
        doc.line(margin, y - 2, pageWidth - margin, y - 2);
        y += 2;

        this.objects.forEach((obj, i) => {
            addPageIfNeeded(8);
            addRow([
                `${i + 1}`,
                obj.userData.config.name,
                `${obj.userData.config.width}m × ${obj.userData.config.depth}m`,
                `(${obj.position.x.toFixed(1)}, ${obj.position.z.toFixed(1)})`
            ], [12, 40, 35, 50]);
        });

        const totalPages = doc.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`第 ${i} / ${totalPages} 页`, pageWidth - margin, pageHeight - 8, { align: 'right' });
            doc.setTextColor(0, 0, 0);
        }

        doc.save('应急安置床位排布报告.pdf');
    }

    onWindowResize() {
        const container = document.getElementById('canvasContainer');
        const width = container.clientWidth;
        const height = container.clientHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(width, height);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        if (this.controls) {
            this.controls.update();
        }
        
        this.renderer.render(this.scene, this.camera);
    }
}

const initApp = () => {
    if (document.getElementById('canvasContainer')) {
        new ShelterLayoutApp();
    } else {
        setTimeout(initApp, 50);
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
