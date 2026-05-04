const Scene3D = {
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    objects: {
        trusses: [],
        hoists: [],
        equipment: [],
        points: [],
        ropes: [],
    },
    selectedObject: null,
    hoveredObject: null,
    raycaster: null,
    mouse: null,
    gridHelper: null,
    gridVisible: true,
    
    init(canvasId) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.error('Canvas element not found');
            return false;
        }
        
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a2e);
        
        const container = canvas.parentElement;
        const aspect = container.clientWidth / container.clientHeight;
        
        this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
        this.camera.position.set(
            APP_CONFIG.SCENE.DEFAULT_CAMERA_POSITION.x,
            APP_CONFIG.SCENE.DEFAULT_CAMERA_POSITION.y,
            APP_CONFIG.SCENE.DEFAULT_CAMERA_POSITION.z
        );
        this.camera.lookAt(
            APP_CONFIG.SCENE.DEFAULT_CAMERA_TARGET.x,
            APP_CONFIG.SCENE.DEFAULT_CAMERA_TARGET.y,
            APP_CONFIG.SCENE.DEFAULT_CAMERA_TARGET.z
        );
        
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: canvas,
            antialias: true,
            alpha: true,
        });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        this.setupLights();
        this.setupGrid();
        this.setupControls();
        this.setupEventListeners(canvas);
        
        this.animate();
        
        return true;
    },
    
    setupLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 20, 10);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);
        
        const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
        backLight.position.set(-10, 10, -10);
        this.scene.add(backLight);
    },
    
    setupGrid() {
        const size = APP_CONFIG.SCENE.GRID_SIZE;
        const divisions = APP_CONFIG.SCENE.GRID_DIVISIONS;
        
        this.gridHelper = new THREE.GridHelper(size, divisions, 0x444444, 0x333333);
        this.scene.add(this.gridHelper);
        
        const axesHelper = new THREE.AxesHelper(5);
        this.scene.add(axesHelper);
    },
    
    setupControls() {
        let isDragging = false;
        let previousMousePosition = {
            x: 0,
            y: 0
        };
        
        let targetLookAt = new THREE.Vector3(0, 0, 0);
        let spherical = new THREE.Spherical(
            Math.sqrt(
                Math.pow(APP_CONFIG.SCENE.DEFAULT_CAMERA_POSITION.x, 2) +
                Math.pow(APP_CONFIG.SCENE.DEFAULT_CAMERA_POSITION.y, 2) +
                Math.pow(APP_CONFIG.SCENE.DEFAULT_CAMERA_POSITION.z, 2)
            ),
            Math.acos(APP_CONFIG.SCENE.DEFAULT_CAMERA_POSITION.y / 
                Math.sqrt(
                    Math.pow(APP_CONFIG.SCENE.DEFAULT_CAMERA_POSITION.x, 2) +
                    Math.pow(APP_CONFIG.SCENE.DEFAULT_CAMERA_POSITION.y, 2) +
                    Math.pow(APP_CONFIG.SCENE.DEFAULT_CAMERA_POSITION.z, 2)
                )),
            Math.atan2(APP_CONFIG.SCENE.DEFAULT_CAMERA_POSITION.z, APP_CONFIG.SCENE.DEFAULT_CAMERA_POSITION.x)
        );
        
        this.controls = {
            targetLookAt: targetLookAt,
            spherical: spherical,
            updateCamera: function() {
                const offset = new THREE.Vector3().setFromSpherical(spherical);
                Scene3D.camera.position.copy(targetLookAt).add(offset);
                Scene3D.camera.lookAt(targetLookAt);
            }
        };
        
        this.controls.updateCamera();
    },
    
    setupEventListeners(canvas) {
        let isDragging = false;
        let isRightDragging = false;
        let previousMousePosition = { x: 0, y: 0 };
        
        canvas.addEventListener('mousedown', (e) => {
            if (e.button === 0) {
                isDragging = true;
            } else if (e.button === 2) {
                isRightDragging = true;
            }
            previousMousePosition = { x: e.clientX, y: e.clientY };
        });
        
        canvas.addEventListener('mousemove', (e) => {
            const deltaX = e.clientX - previousMousePosition.x;
            const deltaY = e.clientY - previousMousePosition.y;
            
            if (isDragging && !e.shiftKey) {
                this.controls.spherical.theta -= deltaX * 0.01;
                this.controls.spherical.phi -= deltaY * 0.01;
                this.controls.spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, this.controls.spherical.phi));
                this.controls.updateCamera();
            } else if (isDragging && e.shiftKey) {
                const right = new THREE.Vector3();
                const up = new THREE.Vector3(0, 1, 0);
                this.camera.getWorldDirection(right);
                right.cross(up).normalize();
                
                this.controls.targetLookAt.addScaledVector(right, -deltaX * 0.02);
                this.controls.targetLookAt.y += deltaY * 0.02;
                this.controls.updateCamera();
            } else if (isRightDragging) {
                const right = new THREE.Vector3();
                const forward = new THREE.Vector3();
                this.camera.getWorldDirection(forward);
                forward.y = 0;
                forward.normalize();
                right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
                
                this.controls.targetLookAt.addScaledVector(right, -deltaX * 0.02);
                this.controls.targetLookAt.addScaledVector(forward, deltaY * 0.02);
                this.controls.updateCamera();
            }
            
            previousMousePosition = { x: e.clientX, y: e.clientY };
            
            this.updateMousePosition(e, canvas);
            this.checkHover();
        });
        
        canvas.addEventListener('mouseup', (e) => {
            isDragging = false;
            isRightDragging = false;
        });
        
        canvas.addEventListener('mouseleave', () => {
            isDragging = false;
            isRightDragging = false;
        });
        
        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
            this.controls.spherical.radius *= zoomFactor;
            this.controls.spherical.radius = Math.max(2, Math.min(100, this.controls.spherical.radius));
            this.controls.updateCamera();
        }, { passive: false });
        
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        
        canvas.addEventListener('click', (e) => {
            this.updateMousePosition(e, canvas);
            this.checkClick();
        });
        
        window.addEventListener('resize', () => {
            const container = canvas.parentElement;
            this.camera.aspect = container.clientWidth / container.clientHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(container.clientWidth, container.clientHeight);
        });
        
        document.addEventListener('keydown', (e) => {
            this.handleKeyboard(e);
        });
    },
    
    updateMousePosition(e, canvas) {
        const rect = canvas.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    },
    
    checkHover() {
        const allObjects = [
            ...this.objects.equipment,
            ...this.objects.hoists,
            ...this.objects.trusses,
        ];
        
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(allObjects, true);
        
        if (intersects.length > 0) {
            let obj = intersects[0].object;
            while (obj.parent && !obj.userData.dataId) {
                obj = obj.parent;
            }
            
            if (obj.userData.dataId) {
                if (this.hoveredObject !== obj) {
                    if (this.hoveredObject && this.hoveredObject !== this.selectedObject) {
                        this.restoreObjectMaterial(this.hoveredObject);
                    }
                    this.hoveredObject = obj;
                    if (obj !== this.selectedObject) {
                        this.highlightObject(obj, 0xffff00);
                    }
                    this.updateSceneInfo(obj);
                }
            }
        } else {
            if (this.hoveredObject && this.hoveredObject !== this.selectedObject) {
                this.restoreObjectMaterial(this.hoveredObject);
            }
            this.hoveredObject = null;
            this.updateSceneInfo(null);
        }
    },
    
    checkClick() {
        const allObjects = [
            ...this.objects.equipment,
            ...this.objects.hoists,
            ...this.objects.trusses,
        ];
        
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(allObjects, true);
        
        if (intersects.length > 0) {
            let obj = intersects[0].object;
            while (obj.parent && !obj.userData.dataId) {
                obj = obj.parent;
            }
            
            if (obj.userData.dataId) {
                if (this.selectedObject) {
                    this.restoreObjectMaterial(this.selectedObject);
                }
                this.selectedObject = obj;
                this.highlightObject(obj, 0x00ff00);
                this.onObjectSelected(obj);
            }
        } else {
            if (this.selectedObject) {
                this.restoreObjectMaterial(this.selectedObject);
            }
            this.selectedObject = null;
            this.onObjectSelected(null);
        }
    },
    
    highlightObject(obj, color) {
        if (!obj.userData.originalMaterial) {
            obj.userData.originalMaterial = [];
            obj.traverse((child) => {
                if (child.isMesh) {
                    obj.userData.originalMaterial.push({
                        mesh: child,
                        color: child.material.color.clone(),
                    });
                }
            });
        }
        
        obj.traverse((child) => {
            if (child.isMesh) {
                child.material.emissive = child.material.emissive || new THREE.Color(0x000000);
                child.material.emissive.setHex(color);
            }
        });
    },
    
    restoreObjectMaterial(obj) {
        if (obj.userData.originalMaterial) {
            obj.traverse((child) => {
                if (child.isMesh && child.material.emissive) {
                    child.material.emissive.setHex(0x000000);
                }
            });
        }
    },
    
    updateSceneInfo(obj) {
        const infoElement = document.getElementById('scene-info-text');
        if (!infoElement) return;
        
        if (obj) {
            const dataType = obj.userData.dataType;
            const dataId = obj.userData.dataId;
            let info = '';
            
            if (dataType === 'equipment') {
                const eq = this.findEquipmentById(dataId);
                if (eq) {
                    info = `${eq.name} - 重量: ${eq.weight}kg`;
                }
            } else if (dataType === 'hoist') {
                const hoist = this.findHoistById(dataId);
                if (hoist) {
                    info = `${hoist.name} - 额定载荷: ${hoist.ratedLoad}kg`;
                }
            } else if (dataType === 'truss') {
                const truss = this.findTrussById(dataId);
                if (truss) {
                    info = `${truss.name} - 长度: ${truss.length}m`;
                }
            }
            
            if (info) {
                infoElement.textContent = info;
            }
        } else {
            infoElement.textContent = '提示: 从左侧拖拽设备到桁架上，或选中设备后使用键盘调整位置';
        }
    },
    
    onObjectSelected(obj) {
        if (window.App && window.App.onSceneObjectSelected) {
            window.App.onSceneObjectSelected(obj);
        }
    },
    
    handleKeyboard(e) {
        if (!this.selectedObject) return;
        
        const moveDistance = APP_CONFIG.SCENE.SNAP_GRID_SIZE;
        const dataType = this.selectedObject.userData.dataType;
        
        if (dataType !== 'equipment') return;
        
        let dx = 0, dy = 0, dz = 0;
        
        switch (e.key) {
            case 'ArrowUp':
            case 'w':
            case 'W':
                dz = -moveDistance;
                break;
            case 'ArrowDown':
            case 's':
            case 'S':
                dz = moveDistance;
                break;
            case 'ArrowLeft':
            case 'a':
            case 'A':
                dx = -moveDistance;
                break;
            case 'ArrowRight':
            case 'd':
            case 'D':
                dx = moveDistance;
                break;
            case 'PageUp':
            case 'q':
            case 'Q':
                dy = moveDistance;
                break;
            case 'PageDown':
            case 'e':
            case 'E':
                dy = -moveDistance;
                break;
            case 'Delete':
            case 'Backspace':
                this.deleteSelectedObject();
                return;
        }
        
        if (dx !== 0 || dy !== 0 || dz !== 0) {
            e.preventDefault();
            this.moveSelectedObject(dx, dy, dz);
        }
    },
    
    moveSelectedObject(dx, dy, dz) {
        if (!this.selectedObject) return;
        
        const dataId = this.selectedObject.userData.dataId;
        const dataType = this.selectedObject.userData.dataType;
        
        if (dataType === 'equipment') {
            const eq = this.findEquipmentById(dataId);
            if (eq) {
                eq.position.x = Utils.snapToGrid(eq.position.x + dx, APP_CONFIG.SCENE.SNAP_GRID_SIZE);
                eq.position.y = Utils.clamp(eq.position.y + dy, 0, 20);
                eq.position.z = Utils.snapToGrid(eq.position.z + dz, APP_CONFIG.SCENE.SNAP_GRID_SIZE);
                eq.mountedOn = true;
                
                this.selectedObject.position.set(eq.position.x, eq.position.y, eq.position.z);
                
                if (window.App && window.App.onEquipmentMoved) {
                    window.App.onEquipmentMoved(eq);
                }
            }
        }
    },
    
    deleteSelectedObject() {
        if (!this.selectedObject) return;
        
        const dataId = this.selectedObject.userData.dataId;
        const dataType = this.selectedObject.userData.dataType;
        
        if (window.App && window.App.onDeleteObject) {
            window.App.onDeleteObject(dataType, dataId);
        }
    },
    
    findEquipmentById(id) {
        if (window.App && window.App.currentData) {
            return window.App.currentData.equipment.find(e => e.id === id);
        }
        return null;
    },
    
    findHoistById(id) {
        if (window.App && window.App.currentData) {
            return window.App.currentData.hoists.find(h => h.id === id);
        }
        return null;
    },
    
    findTrussById(id) {
        if (window.App && window.App.currentData) {
            return window.App.currentData.trusses.find(t => t.id === id);
        }
        return null;
    },
    
    clearScene() {
        this.objects.trusses.forEach(t => this.scene.remove(t));
        this.objects.hoists.forEach(h => this.scene.remove(h));
        this.objects.equipment.forEach(e => this.scene.remove(e));
        this.objects.points.forEach(p => this.scene.remove(p));
        this.objects.ropes.forEach(r => this.scene.remove(r));
        
        this.objects = {
            trusses: [],
            hoists: [],
            equipment: [],
            points: [],
            ropes: [],
        };
        
        this.selectedObject = null;
        this.hoveredObject = null;
    },
    
    loadData(data) {
        this.clearScene();
        
        if (!data) return;
        
        if (data.trusses && data.trusses.length > 0) {
            data.trusses.forEach(truss => this.createTruss(truss));
        }
        
        if (data.hoists && data.hoists.length > 0) {
            data.hoists.forEach(hoist => this.createHoist(hoist));
        }
        
        if (data.equipment && data.equipment.length > 0) {
            data.equipment.forEach(eq => this.createEquipment(eq));
        }
    },
    
    createTruss(trussData) {
        const group = new THREE.Group();
        group.userData.dataId = trussData.id;
        group.userData.dataType = 'truss';
        
        const geometry = new THREE.BoxGeometry(trussData.length, trussData.height, trussData.width);
        const material = new THREE.MeshPhongMaterial({
            color: APP_CONFIG.COLORS.TRUSS,
            wireframe: false,
            transparent: true,
            opacity: 0.7,
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
        
        const wireframe = new THREE.WireframeGeometry(geometry);
        const line = new THREE.LineSegments(
            wireframe,
            new THREE.LineBasicMaterial({ color: 0x666666, linewidth: 1 })
        );
        group.add(line);
        
        if (trussData.points) {
            trussData.points.forEach((point, index) => {
                this.createPoint(point, trussData, group);
            });
        }
        
        group.position.set(trussData.position.x, trussData.position.y, trussData.position.z);
        group.rotation.set(trussData.rotation.x, trussData.rotation.y, trussData.rotation.z);
        
        this.scene.add(group);
        this.objects.trusses.push(group);
        
        return group;
    },
    
    createPoint(pointData, trussData, parentGroup) {
        const group = new THREE.Group();
        group.userData.dataId = pointData.id;
        group.userData.dataType = 'point';
        
        const sphereGeometry = new THREE.SphereGeometry(0.15, 16, 16);
        const sphereMaterial = new THREE.MeshPhongMaterial({
            color: 0xffffff,
            emissive: 0x333333,
        });
        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        group.add(sphere);
        
        const torusGeometry = new THREE.TorusGeometry(0.2, 0.03, 8, 16);
        const torusMaterial = new THREE.MeshPhongMaterial({
            color: 0xffff00,
        });
        const torus = new THREE.Mesh(torusGeometry, torusMaterial);
        torus.rotation.x = Math.PI / 2;
        group.add(torus);
        
        const relativeX = pointData.position.x - trussData.position.x;
        group.position.set(relativeX, 0, pointData.position.z - trussData.position.z);
        
        parentGroup.add(group);
        this.objects.points.push(group);
        
        return group;
    },
    
    createHoist(hoistData) {
        const group = new THREE.Group();
        group.userData.dataId = hoistData.id;
        group.userData.dataType = 'hoist';
        
        const bodyGeometry = new THREE.CylinderGeometry(0.2, 0.25, 0.8, 8);
        const bodyMaterial = new THREE.MeshPhongMaterial({
            color: hoistData.hasSafetyRope ? APP_CONFIG.COLORS.HOIST_SAFE : APP_CONFIG.COLORS.NO_SAFETY_ROPE,
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = -0.4;
        group.add(body);
        
        const hookGeometry = new THREE.TorusGeometry(0.15, 0.03, 8, 16, Math.PI);
        const hookMaterial = new THREE.MeshPhongMaterial({
            color: 0x888888,
        });
        const hook = new THREE.Mesh(hookGeometry, hookMaterial);
        hook.rotation.z = Math.PI;
        hook.position.y = -0.9;
        group.add(hook);
        
        const ropeGeometry = new THREE.CylinderGeometry(0.02, 0.02, 3, 8);
        const ropeMaterial = new THREE.MeshPhongMaterial({
            color: 0x555555,
        });
        const rope = new THREE.Mesh(ropeGeometry, ropeMaterial);
        rope.position.y = 1.5;
        group.add(rope);
        
        if (!hoistData.hasSafetyRope) {
            const indicatorGeometry = new THREE.SphereGeometry(0.1, 8, 8);
            const indicatorMaterial = new THREE.MeshPhongMaterial({
                color: 0xff0000,
                emissive: 0x330000,
            });
            const indicator = new THREE.Mesh(indicatorGeometry, indicatorMaterial);
            indicator.position.set(0.4, 0, 0);
            group.add(indicator);
        }
        
        group.position.set(hoistData.position.x, hoistData.position.y, hoistData.position.z);
        
        this.scene.add(group);
        this.objects.hoists.push(group);
        
        return group;
    },
    
    createEquipment(equipmentData) {
        const group = new THREE.Group();
        group.userData.dataId = equipmentData.id;
        group.userData.dataType = 'equipment';
        
        let color = APP_CONFIG.COLORS.EQUIPMENT_OTHER;
        if (equipmentData.type === 'fixture') {
            color = APP_CONFIG.COLORS.EQUIPMENT_FIXTURE;
        } else if (equipmentData.type === 'speaker') {
            color = APP_CONFIG.COLORS.EQUIPMENT_SPEAKER;
        }
        
        let baseGeometry;
        const scale = Math.min(Math.max(equipmentData.weight / 50, 0.3), 1.5);
        
        if (equipmentData.type === 'fixture') {
            baseGeometry = new THREE.BoxGeometry(0.4 * scale, 0.3 * scale, 0.4 * scale);
        } else if (equipmentData.type === 'speaker') {
            baseGeometry = new THREE.BoxGeometry(0.3 * scale, 0.6 * scale, 0.3 * scale);
        } else {
            baseGeometry = new THREE.BoxGeometry(0.5 * scale, 0.25 * scale, 0.5 * scale);
        }
        
        const material = new THREE.MeshPhongMaterial({
            color: color,
        });
        
        const mesh = new THREE.Mesh(baseGeometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
        
        if (!equipmentData.hasSafetyRope) {
            const warningGeometry = new THREE.SphereGeometry(0.08, 8, 8);
            const warningMaterial = new THREE.MeshPhongMaterial({
                color: 0xff0000,
                emissive: 0x330000,
            });
            const warning = new THREE.Mesh(warningGeometry, warningMaterial);
            warning.position.set(0, 0.3 * scale + 0.1, 0);
            group.add(warning);
        }
        
        group.position.set(equipmentData.position.x, equipmentData.position.y, equipmentData.position.z);
        
        this.scene.add(group);
        this.objects.equipment.push(group);
        
        return group;
    },
    
    updateEquipmentPosition(equipmentData) {
        const obj = this.objects.equipment.find(o => o.userData.dataId === equipmentData.id);
        if (obj) {
            obj.position.set(equipmentData.position.x, equipmentData.position.y, equipmentData.position.z);
        }
    },
    
    removeEquipment(equipmentId) {
        const index = this.objects.equipment.findIndex(o => o.userData.dataId === equipmentId);
        if (index !== -1) {
            this.scene.remove(this.objects.equipment[index]);
            this.objects.equipment.splice(index, 1);
        }
    },
    
    updateHoistStatus(hoistData, riskLevel) {
        const obj = this.objects.hoists.find(o => o.userData.dataId === hoistData.id);
        if (!obj) return;
        
        let color = APP_CONFIG.COLORS.HOIST_SAFE;
        if (riskLevel === 'critical') {
            color = APP_CONFIG.COLORS.HOIST_CRITICAL;
        } else if (riskLevel === 'warning') {
            color = APP_CONFIG.COLORS.HOIST_WARNING;
        }
        
        if (!hoistData.hasSafetyRope) {
            color = APP_CONFIG.COLORS.NO_SAFETY_ROPE;
        }
        
        obj.traverse((child) => {
            if (child.isMesh && child.geometry.type === 'CylinderGeometry' && 
                child.geometry.parameters.radiusTop >= 0.2) {
                child.material.color.setHex(color);
            }
        });
    },
    
    setView(viewType) {
        const radius = this.controls.spherical.radius;
        const target = this.controls.targetLookAt;
        
        switch (viewType) {
            case 'top':
                this.controls.spherical.phi = 0.1;
                this.controls.spherical.theta = 0;
                break;
            case 'front':
                this.controls.spherical.phi = Math.PI / 2;
                this.controls.spherical.theta = Math.PI / 2;
                break;
            case 'side':
                this.controls.spherical.phi = Math.PI / 2;
                this.controls.spherical.theta = 0;
                break;
            case 'reset':
                this.controls.spherical.phi = Math.acos(APP_CONFIG.SCENE.DEFAULT_CAMERA_POSITION.y / 
                    Math.sqrt(
                        Math.pow(APP_CONFIG.SCENE.DEFAULT_CAMERA_POSITION.x, 2) +
                        Math.pow(APP_CONFIG.SCENE.DEFAULT_CAMERA_POSITION.y, 2) +
                        Math.pow(APP_CONFIG.SCENE.DEFAULT_CAMERA_POSITION.z, 2)
                    ));
                this.controls.spherical.theta = Math.atan2(
                    APP_CONFIG.SCENE.DEFAULT_CAMERA_POSITION.z, 
                    APP_CONFIG.SCENE.DEFAULT_CAMERA_POSITION.x
                );
                this.controls.spherical.radius = Math.sqrt(
                    Math.pow(APP_CONFIG.SCENE.DEFAULT_CAMERA_POSITION.x, 2) +
                    Math.pow(APP_CONFIG.SCENE.DEFAULT_CAMERA_POSITION.y, 2) +
                    Math.pow(APP_CONFIG.SCENE.DEFAULT_CAMERA_POSITION.z, 2)
                );
                this.controls.targetLookAt.set(0, 0, 0);
                break;
        }
        
        this.controls.updateCamera();
    },
    
    toggleGrid() {
        this.gridVisible = !this.gridVisible;
        this.gridHelper.visible = this.gridVisible;
    },
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    },
};
