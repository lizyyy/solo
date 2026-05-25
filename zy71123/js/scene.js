class SceneManager {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        this.inspectionPoints = [];
        this.obstacles = [];
        this.chargers = [];
        this.pathLines = [];
        this.robot = null;
        this.floor = null;
        this.walls = [];
        
        this.selectedObject = null;
        this.isDragging = false;
        this.dragPlane = null;
        this.addMode = null;
        
        this.filters = {
            points: true,
            obstacles: true,
            path: true
        };
        
        this.init();
    }
    
    init() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a2e);
        
        this.camera = new THREE.PerspectiveCamera(
            60,
            this.container.clientWidth / this.container.clientHeight,
            0.1,
            1000
        );
        this.camera.position.set(25, 30, 25);
        this.camera.lookAt(0, 0, 0);
        
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);
        
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 5;
        this.controls.maxDistance = 100;
        
        this.setupLighting();
        this.setupEventListeners();
        this.animate();
    }
    
    setupLighting() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
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
        
        const pointLight1 = new THREE.PointLight(0x667eea, 0.5, 50);
        pointLight1.position.set(-20, 15, -20);
        this.scene.add(pointLight1);
        
        const pointLight2 = new THREE.PointLight(0x764ba2, 0.5, 50);
        pointLight2.position.set(20, 15, 20);
        this.scene.add(pointLight2);
    }
    
    setupEventListeners() {
        window.addEventListener('resize', () => this.onWindowResize());
        
        this.renderer.domElement.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.renderer.domElement.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.renderer.domElement.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.renderer.domElement.addEventListener('click', (e) => this.onClick(e));
        
        this.renderer.domElement.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.addMode = null;
            this.updateStatus('已取消添加模式');
        });
    }
    
    onWindowResize() {
        this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }
    
    onMouseDown(event) {
        if (this.addMode) return;
        
        this.mouse.x = (event.clientX / this.renderer.domElement.clientWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / this.renderer.domElement.clientHeight) * 2 + 1;
        
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        const selectableObjects = [
            ...this.inspectionPoints.map(p => p.mesh),
            ...this.obstacles.map(o => o.mesh),
            ...this.chargers.map(c => c.mesh)
        ];
        
        const intersects = this.raycaster.intersectObjects(selectableObjects);
        
        if (intersects.length > 0) {
            this.controls.enabled = false;
            this.isDragging = true;
            this.selectedObject = intersects[0].object;
            this.selectedObject.material.emissive = new THREE.Color(0x444444);
            
            this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
            const intersectPoint = new THREE.Vector3();
            this.raycaster.ray.intersectPlane(this.dragPlane, intersectPoint);
            this.dragOffset = new THREE.Vector3().subVectors(
                this.selectedObject.position,
                intersectPoint
            );
            
            this.updateSelectedInfo(this.selectedObject);
        }
    }
    
    onMouseMove(event) {
        this.mouse.x = (event.clientX / this.renderer.domElement.clientWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / this.renderer.domElement.clientHeight) * 2 + 1;
        
        if (this.isDragging && this.selectedObject && this.dragPlane) {
            this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersectPoint = new THREE.Vector3();
            this.raycaster.ray.intersectPlane(this.dragPlane, intersectPoint);
            this.selectedObject.position.copy(intersectPoint.add(this.dragOffset));
            this.selectedObject.position.y = this.selectedObject.userData.baseY || 0.5;
            
            this.updateObjectData(this.selectedObject);
        }
        
        if (this.addMode) {
            this.raycaster.setFromCamera(this.mouse, this.camera);
            const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
            const intersectPoint = new THREE.Vector3();
            this.raycaster.ray.intersectPlane(groundPlane, intersectPoint);
            
            if (this.previewMesh) {
                this.previewMesh.position.x = Math.round(intersectPoint.x);
                this.previewMesh.position.z = Math.round(intersectPoint.z);
            }
        }
    }
    
    onMouseUp() {
        if (this.isDragging && this.selectedObject) {
            this.selectedObject.material.emissive = new THREE.Color(0x000000);
            window.dispatchEvent(new CustomEvent('sceneChanged'));
        }
        this.isDragging = false;
        this.controls.enabled = true;
    }
    
    onClick(event) {
        if (this.addMode) {
            this.mouse.x = (event.clientX / this.renderer.domElement.clientWidth) * 2 - 1;
            this.mouse.y = -(event.clientY / this.renderer.domElement.clientHeight) * 2 + 1;
            
            this.raycaster.setFromCamera(this.mouse, this.camera);
            const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
            const intersectPoint = new THREE.Vector3();
            this.raycaster.ray.intersectPlane(groundPlane, intersectPoint);
            
            const x = Math.round(intersectPoint.x);
            const z = Math.round(intersectPoint.z);
            
            this.addNewObject(this.addMode, x, z);
            return;
        }
        
        this.mouse.x = (event.clientX / this.renderer.domElement.clientWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / this.renderer.domElement.clientHeight) * 2 + 1;
        
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        const selectableObjects = [
            ...this.inspectionPoints.map(p => p.mesh),
            ...this.obstacles.map(o => o.mesh),
            ...this.chargers.map(c => c.mesh)
        ];
        
        const intersects = this.raycaster.intersectObjects(selectableObjects);
        
        if (intersects.length > 0) {
            this.selectObject(intersects[0].object);
        } else {
            this.deselectObject();
        }
    }
    
    selectObject(obj) {
        if (this.selectedObject && this.selectedObject !== obj) {
            this.selectedObject.material.emissive = new THREE.Color(0x000000);
        }
        this.selectedObject = obj;
        this.selectedObject.material.emissive = new THREE.Color(0x222222);
        this.updateSelectedInfo(obj);
        document.getElementById('btn-delete').style.display = 'block';
    }
    
    deselectObject() {
        if (this.selectedObject) {
            this.selectedObject.material.emissive = new THREE.Color(0x000000);
        }
        this.selectedObject = null;
        document.getElementById('selected-info').innerHTML = '<p>点击场景中的元素查看详情</p>';
        document.getElementById('btn-delete').style.display = 'none';
    }
    
    updateSelectedInfo(obj) {
        const infoDiv = document.getElementById('selected-info');
        const userData = obj.userData;
        
        let html = '';
        switch (userData.type) {
            case 'inspectionPoint':
                html = `
                    <p><strong>类型：</strong>巡检点</p>
                    <p><strong>名称：</strong>${userData.name}</p>
                    <p><strong>位置：</strong>(${userData.x}, ${userData.z})</p>
                    <p><strong>优先级：</strong>${userData.priority}</p>
                    <p><strong>停留时间：</strong>${userData.duration}秒</p>
                `;
                break;
            case 'obstacle':
                html = `
                    <p><strong>类型：</strong>障碍物</p>
                    <p><strong>名称：</strong>${userData.name}</p>
                    <p><strong>位置：</strong>(${userData.x}, ${userData.z})</p>
                    <p><strong>尺寸：</strong>${userData.width}x${userData.depth}</p>
                `;
                break;
            case 'charger':
                html = `
                    <p><strong>类型：</strong>充电桩</p>
                    <p><strong>位置：</strong>(${userData.x}, ${userData.z})</p>
                `;
                break;
        }
        
        infoDiv.innerHTML = html;
        document.getElementById('btn-delete').style.display = 'block';
    }
    
    updateObjectData(obj) {
        const userData = obj.userData;
        const newX = Math.round(obj.position.x);
        const newZ = Math.round(obj.position.z);
        
        userData.x = newX;
        userData.z = newZ;
        
        if (userData.type === 'inspectionPoint') {
            const point = this.inspectionPoints.find(p => p.id === userData.id);
            if (point) {
                point.x = newX;
                point.z = newZ;
            }
        } else if (userData.type === 'obstacle') {
            const obstacle = this.obstacles.find(o => o.id === userData.id);
            if (obstacle) {
                obstacle.x = newX;
                obstacle.z = newZ;
            }
        } else if (userData.type === 'charger') {
            const charger = this.chargers.find(c => c.id === userData.id);
            if (charger) {
                charger.x = newX;
                charger.z = newZ;
            }
        }
        
        this.updateSelectedInfo(obj);
    }
    
    addNewObject(type, x, z) {
        if (type === 'inspectionPoint') {
            const id = this.inspectionPoints.length + 1;
            this.addInspectionPoint({
                id: id,
                name: `巡检点${id}`,
                x: x,
                z: z,
                priority: 'normal',
                duration: 5
            });
            this.updateStatus(`已添加巡检点到 (${x}, ${z})`);
        } else if (type === 'obstacle') {
            const id = this.obstacles.length + 1;
            this.addObstacle({
                id: id,
                name: `障碍物${id}`,
                x: x,
                z: z,
                width: 2,
                depth: 2,
                height: 2
            });
            this.updateStatus(`已添加障碍物到 (${x}, ${z})`);
        } else if (type === 'charger') {
            this.chargers.forEach(c => this.scene.remove(c.mesh));
            this.chargers = [];
            this.addCharger({
                id: 1,
                x: x,
                z: z
            });
            this.updateStatus(`已设置充电桩到 (${x}, ${z})`);
        }
        
        if (this.previewMesh) {
            this.scene.remove(this.previewMesh);
            this.previewMesh = null;
        }
        this.addMode = null;
        window.dispatchEvent(new CustomEvent('sceneChanged'));
    }
    
    setAddMode(mode) {
        this.addMode = mode;
        this.deselectObject();
        
        if (this.previewMesh) {
            this.scene.remove(this.previewMesh);
        }
        
        if (mode === 'inspectionPoint') {
            const geometry = new THREE.SphereGeometry(0.5, 16, 16);
            const material = new THREE.MeshLambertMaterial({ 
                color: 0x2196F3, 
                transparent: true, 
                opacity: 0.5 
            });
            this.previewMesh = new THREE.Mesh(geometry, material);
            this.updateStatus('点击地面添加巡检点，右键取消');
        } else if (mode === 'obstacle') {
            const geometry = new THREE.BoxGeometry(2, 2, 2);
            const material = new THREE.MeshLambertMaterial({ 
                color: 0xFF5722, 
                transparent: true, 
                opacity: 0.5 
            });
            this.previewMesh = new THREE.Mesh(geometry, material);
            this.previewMesh.position.y = 1;
            this.updateStatus('点击地面添加障碍物，右键取消');
        } else if (mode === 'charger') {
            const geometry = new THREE.CylinderGeometry(0.8, 0.8, 0.3, 16);
            const material = new THREE.MeshLambertMaterial({ 
                color: 0x4CAF50, 
                transparent: true, 
                opacity: 0.5 
            });
            this.previewMesh = new THREE.Mesh(geometry, material);
            this.previewMesh.position.y = 0.15;
            this.updateStatus('点击地面设置充电桩，右键取消');
        }
        
        if (this.previewMesh) {
            this.scene.add(this.previewMesh);
        }
    }
    
    deleteSelected() {
        if (!this.selectedObject) return;
        
        const userData = this.selectedObject.userData;
        
        if (userData.type === 'inspectionPoint') {
            this.inspectionPoints = this.inspectionPoints.filter(p => p.id !== userData.id);
        } else if (userData.type === 'obstacle') {
            this.obstacles = this.obstacles.filter(o => o.id !== userData.id);
        } else if (userData.type === 'charger') {
            this.chargers = this.chargers.filter(c => c.id !== userData.id);
        }
        
        this.scene.remove(this.selectedObject);
        this.deselectObject();
        this.updateStatus('已删除选中元素');
        window.dispatchEvent(new CustomEvent('sceneChanged'));
    }
    
    createFloor(data) {
        if (this.floor) {
            this.scene.remove(this.floor);
            this.walls.forEach(w => this.scene.remove(w));
            this.walls = [];
        }
        
        const floorGeometry = new THREE.PlaneGeometry(data.width, data.depth);
        const floorMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x2d3748,
            side: THREE.DoubleSide
        });
        this.floor = new THREE.Mesh(floorGeometry, floorMaterial);
        this.floor.rotation.x = -Math.PI / 2;
        this.floor.receiveShadow = true;
        this.scene.add(this.floor);
        
        const gridHelper = new THREE.GridHelper(
            Math.max(data.width, data.depth),
            Math.max(data.width, data.depth),
            0x4a5568,
            0x2d3748
        );
        this.scene.add(gridHelper);
        
        const wallMaterial = new THREE.MeshLambertMaterial({ color: 0x4a5568 });
        const wallHeight = 3;
        
        const wallN = new THREE.Mesh(
            new THREE.BoxGeometry(data.width, wallHeight, 0.3),
            wallMaterial
        );
        wallN.position.set(0, wallHeight / 2, -data.depth / 2);
        wallN.castShadow = true;
        wallN.receiveShadow = true;
        this.scene.add(wallN);
        this.walls.push(wallN);
        
        const wallS = wallN.clone();
        wallS.position.set(0, wallHeight / 2, data.depth / 2);
        this.scene.add(wallS);
        this.walls.push(wallS);
        
        const wallW = new THREE.Mesh(
            new THREE.BoxGeometry(0.3, wallHeight, data.depth),
            wallMaterial
        );
        wallW.position.set(-data.width / 2, wallHeight / 2, 0);
        wallW.castShadow = true;
        wallW.receiveShadow = true;
        this.scene.add(wallW);
        this.walls.push(wallW);
        
        const wallE = wallW.clone();
        wallE.position.set(data.width / 2, wallHeight / 2, 0);
        this.scene.add(wallE);
        this.walls.push(wallE);
        
        this.floorData = data;
    }
    
    addInspectionPoint(data) {
        const geometry = new THREE.SphereGeometry(0.5, 16, 16);
        const material = new THREE.MeshLambertMaterial({ color: 0x2196F3 });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(data.x, 0.5, data.z);
        mesh.castShadow = true;
        mesh.userData = {
            type: 'inspectionPoint',
            ...data,
            baseY: 0.5
        };
        
        this.scene.add(mesh);
        this.inspectionPoints.push({
            id: data.id,
            mesh: mesh,
            ...data
        });
        
        return mesh;
    }
    
    addObstacle(data) {
        const geometry = new THREE.BoxGeometry(data.width, data.height, data.depth);
        const material = new THREE.MeshLambertMaterial({ color: 0xFF5722 });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(data.x, data.height / 2, data.z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = {
            type: 'obstacle',
            ...data,
            baseY: data.height / 2
        };
        
        this.scene.add(mesh);
        this.obstacles.push({
            id: data.id,
            mesh: mesh,
            ...data
        });
        
        return mesh;
    }
    
    addCharger(data) {
        const geometry = new THREE.CylinderGeometry(0.8, 0.8, 0.3, 16);
        const material = new THREE.MeshLambertMaterial({ color: 0x4CAF50 });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(data.x, 0.15, data.z);
        mesh.receiveShadow = true;
        mesh.userData = {
            type: 'charger',
            ...data,
            baseY: 0.15
        };
        
        const markerGeometry = new THREE.TorusGeometry(0.5, 0.1, 8, 16);
        const markerMaterial = new THREE.MeshLambertMaterial({ color: 0x81C784 });
        const marker = new THREE.Mesh(markerGeometry, markerMaterial);
        marker.rotation.x = Math.PI / 2;
        marker.position.set(data.x, 0.35, data.z);
        this.scene.add(marker);
        
        this.scene.add(mesh);
        this.chargers.push({
            id: data.id,
            mesh: mesh,
            marker: marker,
            ...data
        });
        
        return mesh;
    }
    
    clearAll() {
        this.inspectionPoints.forEach(p => this.scene.remove(p.mesh));
        this.obstacles.forEach(o => this.scene.remove(o.mesh));
        this.chargers.forEach(c => {
            this.scene.remove(c.mesh);
            if (c.marker) this.scene.remove(c.marker);
        });
        this.pathLines.forEach(l => this.scene.remove(l));
        
        this.inspectionPoints = [];
        this.obstacles = [];
        this.chargers = [];
        this.pathLines = [];
        
        if (this.robot) {
            this.scene.remove(this.robot);
            this.robot = null;
        }
        
        this.deselectObject();
    }
    
    drawPath(path, color = 0x9C27B0) {
        this.pathLines.forEach(l => this.scene.remove(l));
        this.pathLines = [];
        
        if (path.length < 2) return;
        
        const points = path.map(p => new THREE.Vector3(p.x, 0.1, p.z));
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ 
            color: color, 
            linewidth: 3,
            transparent: true,
            opacity: 0.8
        });
        const line = new THREE.Line(geometry, material);
        this.scene.add(line);
        this.pathLines.push(line);
        
        for (let i = 0; i < path.length - 1; i++) {
            const mid = {
                x: (path[i].x + path[i + 1].x) / 2,
                z: (path[i].z + path[i + 1].z) / 2
            };
            const angle = Math.atan2(
                path[i + 1].z - path[i].z,
                path[i + 1].x - path[i].x
            );
            
            const arrowGeom = new THREE.ConeGeometry(0.2, 0.4, 8);
            const arrowMat = new THREE.MeshLambertMaterial({ color: color });
            const arrow = new THREE.Mesh(arrowGeom, arrowMat);
            arrow.position.set(mid.x, 0.3, mid.z);
            arrow.rotation.z = -Math.PI / 2;
            arrow.rotation.y = angle;
            this.scene.add(arrow);
            this.pathLines.push(arrow);
        }
    }
    
    createRobot(startPosition) {
        if (this.robot) {
            this.scene.remove(this.robot);
        }
        
        const robotGroup = new THREE.Group();
        
        const bodyGeometry = new THREE.CylinderGeometry(0.6, 0.6, 0.8, 16);
        const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0xFFC107 });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 0.4;
        body.castShadow = true;
        robotGroup.add(body);
        
        const headGeometry = new THREE.SphereGeometry(0.3, 16, 16);
        const headMaterial = new THREE.MeshLambertMaterial({ color: 0xFF9800 });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.y = 1;
        head.castShadow = true;
        robotGroup.add(head);
        
        const eyeGeometry = new THREE.SphereGeometry(0.08, 8, 8);
        const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const eye1 = new THREE.Mesh(eyeGeometry, eyeMaterial);
        eye1.position.set(0.2, 1, 0.3);
        robotGroup.add(eye1);
        const eye2 = eye1.clone();
        eye2.position.set(-0.2, 1, 0.3);
        robotGroup.add(eye2);
        
        const antennaGeom = new THREE.CylinderGeometry(0.03, 0.03, 0.4, 8);
        const antennaMat = new THREE.MeshLambertMaterial({ color: 0x757575 });
        const antenna = new THREE.Mesh(antennaGeom, antennaMat);
        antenna.position.set(0, 1.4, 0);
        robotGroup.add(antenna);
        
        const lightGeom = new THREE.SphereGeometry(0.08, 8, 8);
        const lightMat = new THREE.MeshBasicMaterial({ color: 0x4CAF50 });
        const statusLight = new THREE.Mesh(lightGeom, lightMat);
        statusLight.position.set(0, 1.65, 0);
        statusLight.name = 'statusLight';
        robotGroup.add(statusLight);
        
        robotGroup.position.set(startPosition.x, 0, startPosition.z);
        robotGroup.userData = { type: 'robot' };
        
        this.robot = robotGroup;
        this.scene.add(robotGroup);
        
        return robotGroup;
    }
    
    updateRobotPosition(position, rotation = 0) {
        if (this.robot) {
            this.robot.position.set(position.x, 0, position.z);
            this.robot.rotation.y = rotation;
        }
    }
    
    setRobotStatus(status) {
        if (!this.robot) return;
        
        const statusLight = this.robot.getObjectByName('statusLight');
        if (!statusLight) return;
        
        const colors = {
            idle: 0x4CAF50,
            moving: 0x2196F3,
            inspecting: 0xFFC107,
            charging: 0x9C27B0,
            lowBattery: 0xF44336
        };
        
        statusLight.material.color.setHex(colors[status] || colors.idle);
    }
    
    setFilter(type, enabled) {
        this.filters[type] = enabled;
        
        if (type === 'points') {
            this.inspectionPoints.forEach(p => {
                p.mesh.visible = enabled;
            });
        } else if (type === 'obstacles') {
            this.obstacles.forEach(o => {
                o.mesh.visible = enabled;
            });
        } else if (type === 'path') {
            this.pathLines.forEach(l => {
                l.visible = enabled;
            });
        }
    }
    
    setViewMode(mode) {
        const duration = 1000;
        const startPos = this.camera.position.clone();
        const startTarget = this.controls.target.clone();
        
        let endPos, endTarget;
        
        if (mode === 'top') {
            endPos = new THREE.Vector3(0, 50, 0.1);
            endTarget = new THREE.Vector3(0, 0, 0);
        } else if (mode === '3d') {
            endPos = new THREE.Vector3(25, 30, 25);
            endTarget = new THREE.Vector3(0, 0, 0);
        } else if (mode === 'follow' && this.robot) {
            const robotPos = this.robot.position;
            endPos = new THREE.Vector3(robotPos.x - 5, 8, robotPos.z - 5);
            endTarget = new THREE.Vector3(robotPos.x, 0, robotPos.z);
            this.followMode = true;
        }
        
        if (mode !== 'follow') {
            this.followMode = false;
        }
        
        if (!endPos) return;
        
        const startTime = Date.now();
        
        const animateCamera = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            
            this.camera.position.lerpVectors(startPos, endPos, eased);
            this.controls.target.lerpVectors(startTarget, endTarget, eased);
            this.controls.update();
            
            if (progress < 1) {
                requestAnimationFrame(animateCamera);
            }
        };
        
        animateCamera();
    }
    
    updateFollowView() {
        if (!this.followMode || !this.robot) return;
        
        const robotPos = this.robot.position;
        const targetPos = new THREE.Vector3(robotPos.x - 5, 8, robotPos.z - 5);
        
        this.camera.position.lerp(targetPos, 0.05);
        this.controls.target.lerp(new THREE.Vector3(robotPos.x, 0, robotPos.z), 0.05);
        this.controls.update();
    }
    
    updateStatus(message) {
        document.getElementById('status-message').textContent = message;
    }
    
    getSceneData() {
        return {
            floor: this.floorData,
            inspectionPoints: this.inspectionPoints.map(p => ({
                id: p.id,
                name: p.name,
                x: p.x,
                z: p.z,
                priority: p.priority,
                duration: p.duration
            })),
            obstacles: this.obstacles.map(o => ({
                id: o.id,
                name: o.name,
                x: o.x,
                z: o.z,
                width: o.width,
                depth: o.depth,
                height: o.height
            })),
            chargers: this.chargers.map(c => ({
                id: c.id,
                x: c.x,
                z: c.z
            }))
        };
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        this.controls.update();
        this.updateFollowView();
        
        const time = Date.now() * 0.001;
        this.chargers.forEach(c => {
            if (c.marker) {
                c.marker.rotation.z = time;
            }
        });
        
        this.renderer.render(this.scene, this.camera);
    }
}