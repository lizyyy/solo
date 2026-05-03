/**
 * 场景管理器
 * 管理 Three.js 场景、相机、渲染器等
 */

class SceneManager {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            throw new Error(`容器元素 #${containerId} 不存在`);
        }
        
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.raycaster = null;
        this.mouse = null;
        
        this.warehouse = null;
        this.objectMeshes = new Map();
        this.routeMeshes = [];
        
        this.animationId = null;
        this.isRunning = false;
        
        this.currentView = Constants.VIEWS.PERSPECTIVE;
        this.cameraPositions = {
            [Constants.VIEWS.PERSPECTIVE]: { x: 15, y: 20, z: 15 },
            [Constants.VIEWS.TOP]: { x: 0, y: 30, z: 0 },
            [Constants.VIEWS.FRONT]: { x: 0, y: 10, z: 20 },
            [Constants.VIEWS.LEFT]: { x: 20, y: 10, z: 0 }
        };
        
        this.init();
    }
    
    init() {
        console.log('SceneManager.init() 开始执行...');
        
        this.createScene();
        console.log('Scene 已创建');
        
        this.createCamera();
        console.log('Camera 已创建');
        
        this.createRenderer();
        console.log('Renderer 已创建:', this.renderer);
        console.log('Renderer domElement:', this.renderer ? this.renderer.domElement : 'null');
        
        this.createControls();
        console.log('Controls 已创建');
        
        this.createLights();
        console.log('Lights 已创建');
        
        this.createRaycaster();
        console.log('Raycaster 已创建');
        
        this.setupEventListeners();
        this.onResize();
        
        console.log('SceneManager.init() 完成');
    }
    
    createScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0a1a);
        
        const fogColor = 0x0a0a1a;
        this.scene.fog = new THREE.Fog(fogColor, 30, 100);
    }
    
    createCamera() {
        const aspect = this.container.clientWidth / this.container.clientHeight;
        
        this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
        this.setCameraView(Constants.VIEWS.PERSPECTIVE);
    }
    
    createRenderer() {
        try {
            this.renderer = new THREE.WebGLRenderer({
                antialias: true,
                alpha: true
            });
        } catch (e) {
            throw new Error(`无法创建 WebGL 渲染器: ${e.message}。请检查浏览器是否支持 WebGL。`);
        }
        
        if (!this.renderer) {
            throw new Error('WebGL 渲染器创建失败，请检查浏览器是否支持 WebGL。');
        }
        
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        this.container.appendChild(this.renderer.domElement);
    }
    
    createControls() {
        const OrbitControlsClass = window.OrbitControls || THREE.OrbitControls;
        this.controls = new OrbitControlsClass(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = true;
        this.controls.minDistance = 5;
        this.controls.maxDistance = 100;
        this.controls.maxPolarAngle = Math.PI / 2;
    }
    
    createLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 20, 10);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 100;
        directionalLight.shadow.camera.left = -30;
        directionalLight.shadow.camera.right = 30;
        directionalLight.shadow.camera.top = 30;
        directionalLight.shadow.camera.bottom = -30;
        this.scene.add(directionalLight);
        
        const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.3);
        this.scene.add(hemisphereLight);
    }
    
    createRaycaster() {
        this.raycaster = new THREE.Raycaster();
        this.raycaster.params.Line.threshold = 0.1;
        this.mouse = new THREE.Vector2();
    }
    
    setWarehouse(warehouse) {
        this.warehouse = warehouse;
        this.clearScene();
        this.createWarehouseFloor();
        this.createGrid();
        this.renderObjects();
        
        eventBus.emit(Constants.EVENTS.VIEW_CHANGED);
    }
    
    clearScene() {
        const toRemove = [];
        
        this.scene.traverse(obj => {
            if (obj.userData.isWarehouseObject || 
                obj.userData.isFloor || 
                obj.userData.isGrid ||
                obj.userData.isRoute) {
                toRemove.push(obj);
            }
        });
        
        toRemove.forEach(obj => this.scene.remove(obj));
        
        this.objectMeshes.clear();
        this.routeMeshes = [];
    }
    
    createWarehouseFloor() {
        if (!this.warehouse) return;
        
        const geometry = new THREE.PlaneGeometry(
            this.warehouse.length,
            this.warehouse.width
        );
        const material = new THREE.MeshStandardMaterial({
            color: this.warehouse.groundColor,
            roughness: 0.8,
            metalness: 0.2
        });
        
        const floor = new THREE.Mesh(geometry, material);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        floor.userData.isFloor = true;
        
        this.scene.add(floor);
        
        const borderGeometry = new THREE.EdgesGeometry(
            new THREE.BoxGeometry(
                this.warehouse.length,
                0.1,
                this.warehouse.width
            )
        );
        const borderMaterial = new THREE.LineBasicMaterial({ 
            color: 0x666688,
            linewidth: 2
        });
        const border = new THREE.LineSegments(borderGeometry, borderMaterial);
        border.position.y = 0.05;
        border.userData.isFloor = true;
        this.scene.add(border);
    }
    
    createGrid() {
        if (!this.warehouse || !this.warehouse.showGrid) return;
        
        const gridSize = this.warehouse.gridSize;
        const gridHelper = new THREE.GridHelper(
            Math.max(this.warehouse.length, this.warehouse.width),
            Math.floor(Math.max(this.warehouse.length, this.warehouse.width) / gridSize),
            0x444466,
            0x222244
        );
        gridHelper.position.y = 0.01;
        gridHelper.userData.isGrid = true;
        
        this.scene.add(gridHelper);
    }
    
    renderObjects() {
        if (!this.warehouse) return;
        
        this.warehouse.objects.forEach(obj => {
            this.renderObject(obj);
        });
    }
    
    renderObject(obj) {
        const mesh = ObjectRenderer.createMesh(obj);
        if (mesh) {
            this.objectMeshes.set(obj.id, mesh);
            this.scene.add(mesh);
            obj.mesh = mesh;
        }
        return mesh;
    }
    
    updateObject(obj) {
        const mesh = this.objectMeshes.get(obj.id);
        if (mesh) {
            ObjectRenderer.updateMesh(mesh, obj);
        }
    }
    
    removeObject(objId) {
        const mesh = this.objectMeshes.get(objId);
        if (mesh) {
            this.scene.remove(mesh);
            this.objectMeshes.delete(objId);
        }
    }
    
    highlightObject(objId, highlight = true) {
        const mesh = this.objectMeshes.get(objId);
        if (mesh) {
            ObjectRenderer.highlightMesh(mesh, highlight);
        }
    }
    
    selectObject(objId) {
        this.warehouse.objects.forEach(obj => {
            this.highlightObject(obj.id, false);
        });
        
        if (objId) {
            this.highlightObject(objId, true);
        }
    }
    
    renderRoute(route) {
        this.clearRoute();
        
        if (!route || !route.points || route.points.length < 2) return;
        
        const meshes = RouteRenderer.createRoute(route, this.warehouse);
        if (meshes) {
            this.routeMeshes = meshes;
            meshes.forEach(mesh => {
                mesh.userData.isRoute = true;
                this.scene.add(mesh);
            });
        }
        
        return this.routeMeshes;
    }
    
    clearRoute() {
        this.routeMeshes.forEach(mesh => {
            this.scene.remove(mesh);
        });
        this.routeMeshes = [];
    }
    
    setCameraView(viewType) {
        this.currentView = viewType;
        const pos = this.cameraPositions[viewType];
        
        if (viewType === Constants.VIEWS.PERSPECTIVE) {
            this.camera = new THREE.PerspectiveCamera(
                60,
                this.container.clientWidth / this.container.clientHeight,
                0.1,
                1000
            );
        } else {
            const size = 20;
            const aspect = this.container.clientWidth / this.container.clientHeight;
            this.camera = new THREE.OrthographicCamera(
                -size * aspect,
                size * aspect,
                size,
                -size,
                0.1,
                1000
            );
        }
        
        this.camera.position.set(pos.x, pos.y, pos.z);
        this.camera.lookAt(0, 0, 0);
        
        if (this.controls) {
            this.controls.dispose();
        }
        this.createControls();
        
        eventBus.emit(Constants.EVENTS.VIEW_CHANGED, viewType);
    }
    
    resetCamera() {
        this.setCameraView(Constants.VIEWS.PERSPECTIVE);
    }
    
    getIntersects(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        const meshes = Array.from(this.objectMeshes.values());
        return this.raycaster.intersectObjects(meshes, true);
    }
    
    setupEventListeners() {
        window.addEventListener('resize', () => this.onResize());
    }
    
    onResize() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        
        if (this.camera.isPerspectiveCamera) {
            this.camera.aspect = width / height;
        } else {
            const size = 20;
            const aspect = width / height;
            this.camera.left = -size * aspect;
            this.camera.right = size * aspect;
            this.camera.top = size;
            this.camera.bottom = -size;
        }
        
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }
    
    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.animate();
    }
    
    stop() {
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }
    
    animate() {
        if (!this.isRunning) return;
        
        this.animationId = requestAnimationFrame(() => this.animate());
        
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
        
        if (this.onUpdate) {
            this.onUpdate();
        }
    }
    
    getObjectById(id) {
        return this.objectMeshes.get(id);
    }
    
    getAllObjects() {
        return Array.from(this.objectMeshes.entries());
    }
}
