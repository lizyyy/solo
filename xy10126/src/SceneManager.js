import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class SceneManager {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.selectedObject = null;
        this.isDragging = false;
        this.dragPlane = null;
        
        this.wireframeMode = false;
        this.showLabels = true;
        this.showBoundary = true;
        
        this.labelSprites = [];
        this.boundaryMesh = null;
        this.ground = null;
        
        this.pointMeshes = new Map();
        this.routeLine = null;
        this.animatedPoint = null;
        
        this.init();
    }
    
    init() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0a1a);
        this.scene.fog = new THREE.Fog(0x0a0a1a, 100, 500);
        
        const aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
        this.camera.position.set(50, 40, 50);
        this.camera.lookAt(0, 0, 0);
        
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);
        
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = true;
        this.controls.minDistance = 10;
        this.controls.maxDistance = 200;
        this.controls.maxPolarAngle = Math.PI / 2 - 0.1;
        
        this.setupLights();
        this.createGround();
        this.createBoundary();
        this.createGrid();
        
        this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        
        this.setupEventListeners();
        
        this.animate();
    }
    
    setupLights() {
        const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(50, 100, 50);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 500;
        directionalLight.shadow.camera.left = -100;
        directionalLight.shadow.camera.right = 100;
        directionalLight.shadow.camera.top = 100;
        directionalLight.shadow.camera.bottom = -100;
        this.scene.add(directionalLight);
        
        const pointLight1 = new THREE.PointLight(0x3498db, 0.5, 200);
        pointLight1.position.set(-50, 30, -50);
        this.scene.add(pointLight1);
        
        const pointLight2 = new THREE.PointLight(0x2ecc71, 0.3, 200);
        pointLight2.position.set(50, 30, 50);
        this.scene.add(pointLight2);
    }
    
    createGround() {
        const groundGeometry = new THREE.PlaneGeometry(200, 200);
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0x1a1a2e,
            roughness: 0.8,
            metalness: 0.2
        });
        this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
        this.ground.rotation.x = -Math.PI / 2;
        this.ground.receiveShadow = true;
        this.scene.add(this.ground);
    }
    
    createGrid() {
        const gridHelper = new THREE.GridHelper(200, 40, 0x3498db, 0x1a3a4a);
        gridHelper.position.y = 0.01;
        this.scene.add(gridHelper);
    }
    
    createBoundary() {
        const boundaryGeometry = new THREE.BoxGeometry(100, 20, 100);
        const edges = new THREE.EdgesGeometry(boundaryGeometry);
        const lineMaterial = new THREE.LineBasicMaterial({ 
            color: 0xff6b6b,
            transparent: true,
            opacity: 0.8,
            linewidth: 2
        });
        this.boundaryMesh = new THREE.LineSegments(edges, lineMaterial);
        this.boundaryMesh.position.y = 10;
        this.scene.add(this.boundaryMesh);
    }
    
    setupEventListeners() {
        window.addEventListener('resize', () => this.onWindowResize());
        
        const canvas = this.renderer.domElement;
        
        canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
    }
    
    onWindowResize() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }
    
    onMouseMove(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        if (this.isDragging && this.selectedObject && this.onDragCallback) {
            this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersection = new THREE.Vector3();
            this.raycaster.ray.intersectPlane(this.dragPlane, intersection);
            
            if (intersection) {
                const clamped = this.clampToBoundary(intersection);
                this.selectedObject.position.copy(clamped);
                this.onDragCallback(this.selectedObject.userData.pointId, clamped);
            }
        }
    }
    
    onMouseDown(event) {
        if (event.button !== 0) return;
        
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        const pointMeshList = Array.from(this.pointMeshes.values());
        const intersects = this.raycaster.intersectObjects(pointMeshList, false);
        
        if (intersects.length > 0) {
            this.selectedObject = intersects[0].object;
            this.isDragging = true;
            this.controls.enabled = false;
            
            this.dragPlane.setFromNormalAndCoplanarPoint(
                this.camera.up,
                this.selectedObject.position
            );
            
            if (this.onSelectCallback) {
                this.onSelectCallback(this.selectedObject.userData.pointId);
            }
        }
    }
    
    onMouseUp() {
        if (this.isDragging) {
            this.isDragging = false;
            this.controls.enabled = true;
            
            if (this.onDragEndCallback) {
                this.onDragEndCallback();
            }
        }
    }
    
    clampToBoundary(position) {
        const min = -50;
        const max = 50;
        return new THREE.Vector3(
            Math.max(min, Math.min(max, position.x)),
            Math.max(0, Math.min(20, position.y)),
            Math.max(min, Math.min(max, position.z))
        );
    }
    
    setOnSelectCallback(callback) {
        this.onSelectCallback = callback;
    }
    
    setOnDragCallback(callback) {
        this.onDragCallback = callback;
    }
    
    setOnDragEndCallback(callback) {
        this.onDragEndCallback = callback;
    }
    
    addPointMesh(point) {
        const geometry = new THREE.SphereGeometry(1.5, 16, 16);
        const material = new THREE.MeshStandardMaterial({
            color: point.isMarked ? 0xff6b6b : (point.isVisited ? 0x2ecc71 : 0x3498db),
            emissive: point.isMarked ? 0xff6b6b : (point.isVisited ? 0x2ecc71 : 0x3498db),
            emissiveIntensity: 0.3,
            metalness: 0.5,
            roughness: 0.3,
            wireframe: this.wireframeMode
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(point.x, point.y, point.z);
        mesh.userData.pointId = point.id;
        mesh.castShadow = true;
        
        this.scene.add(mesh);
        this.pointMeshes.set(point.id, mesh);
        
        this.createLabel(point);
        
        return mesh;
    }
    
    createLabel(point) {
        if (!this.showLabels) return;
        
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(point.name || `P${point.id}`, canvas.width / 2, canvas.height / 2);
        
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ 
            map: texture,
            transparent: true
        });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.position.set(point.x, point.y + 3, point.z);
        sprite.scale.set(8, 2, 1);
        
        this.scene.add(sprite);
        this.labelSprites.push({ id: point.id, sprite });
    }
    
    removePointMesh(pointId) {
        const mesh = this.pointMeshes.get(pointId);
        if (mesh) {
            this.scene.remove(mesh);
            mesh.geometry.dispose();
            mesh.material.dispose();
            this.pointMeshes.delete(pointId);
        }
        
        const labelIndex = this.labelSprites.findIndex(l => l.id === pointId);
        if (labelIndex !== -1) {
            const label = this.labelSprites[labelIndex];
            this.scene.remove(label.sprite);
            label.sprite.material.map.dispose();
            label.sprite.material.dispose();
            this.labelSprites.splice(labelIndex, 1);
        }
    }
    
    updatePointMesh(point) {
        const mesh = this.pointMeshes.get(point.id);
        if (mesh) {
            mesh.position.set(point.x, point.y, point.z);
            mesh.material.color.setHex(point.isMarked ? 0xff6b6b : (point.isVisited ? 0x2ecc71 : 0x3498db));
            mesh.material.emissive.setHex(point.isMarked ? 0xff6b6b : (point.isVisited ? 0x2ecc71 : 0x3498db));
        }
        
        const labelIndex = this.labelSprites.findIndex(l => l.id === point.id);
        if (labelIndex !== -1) {
            this.labelSprites[labelIndex].sprite.position.set(point.x, point.y + 3, point.z);
        }
    }
    
    drawRoute(points) {
        if (this.routeLine) {
            this.scene.remove(this.routeLine);
            this.routeLine.geometry.dispose();
            this.routeLine.material.dispose();
        }
        
        if (points.length < 2) return;
        
        const positions = [];
        points.forEach(point => {
            positions.push(point.x, point.y, point.z);
        });
        
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        
        const material = new THREE.LineBasicMaterial({
            color: 0xffcc00,
            linewidth: 3,
            transparent: true,
            opacity: 0.9
        });
        
        this.routeLine = new THREE.Line(geometry, material);
        this.scene.add(this.routeLine);
    }
    
    createAnimatedPoint(startPosition) {
        if (this.animatedPoint) {
            this.scene.remove(this.animatedPoint);
            this.animatedPoint.geometry.dispose();
            this.animatedPoint.material.dispose();
        }
        
        const geometry = new THREE.SphereGeometry(2, 16, 16);
        const material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0xffcc00,
            emissiveIntensity: 0.8,
            metalness: 0.8,
            roughness: 0.2
        });
        
        this.animatedPoint = new THREE.Mesh(geometry, material);
        this.animatedPoint.position.copy(startPosition);
        this.scene.add(this.animatedPoint);
    }
    
    updateAnimatedPoint(position) {
        if (this.animatedPoint) {
            this.animatedPoint.position.copy(position);
        }
    }
    
    removeAnimatedPoint() {
        if (this.animatedPoint) {
            this.scene.remove(this.animatedPoint);
            this.animatedPoint.geometry.dispose();
            this.animatedPoint.material.dispose();
            this.animatedPoint = null;
        }
    }
    
    toggleWireframe() {
        this.wireframeMode = !this.wireframeMode;
        this.pointMeshes.forEach(mesh => {
            mesh.material.wireframe = this.wireframeMode;
        });
        return this.wireframeMode;
    }
    
    toggleLabels() {
        this.showLabels = !this.showLabels;
        this.labelSprites.forEach(({ sprite }) => {
            sprite.visible = this.showLabels;
        });
        return this.showLabels;
    }
    
    toggleBoundary() {
        this.showBoundary = !this.showBoundary;
        if (this.boundaryMesh) {
            this.boundaryMesh.visible = this.showBoundary;
        }
        return this.showBoundary;
    }
    
    resetView() {
        this.camera.position.set(50, 40, 50);
        this.camera.lookAt(0, 0, 0);
        this.controls.reset();
    }
    
    clearAll() {
        for (const [pointId] of this.pointMeshes) {
            this.removePointMesh(pointId);
        }
        
        if (this.routeLine) {
            this.scene.remove(this.routeLine);
            this.routeLine.geometry.dispose();
            this.routeLine.material.dispose();
            this.routeLine = null;
        }
        
        this.removeAnimatedPoint();
    }
    
    clearRoute() {
        if (this.routeLine) {
            this.scene.remove(this.routeLine);
            this.routeLine.geometry.dispose();
            this.routeLine.material.dispose();
            this.routeLine = null;
        }
        this.removeAnimatedPoint();
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
    
    getBoundary() {
        return {
            min: { x: -50, y: 0, z: -50 },
            max: { x: 50, y: 20, z: 50 }
        };
    }
}