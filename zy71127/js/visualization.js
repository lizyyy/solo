class Visualization {
    constructor(canvas) {
        this.canvas = canvas;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.is2D = false;
        this.showHeatmap = false;
        this.heatmapMesh = null;
        this.peopleMeshes = [];
        this.gateMeshes = [];
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.draggedObject = null;
        this.init();
    }

    init() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0f0f1a);

        this.camera = new THREE.PerspectiveCamera(
            60,
            this.canvas.clientWidth / this.canvas.clientHeight,
            0.1,
            1000
        );
        this.camera.position.set(0, 40, 40);
        this.camera.lookAt(0, 0, 0);

        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true
        });
        this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);
        this.renderer.shadowMap.enabled = true;

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 20, 10);
        directionalLight.castShadow = true;
        this.scene.add(directionalLight);

        this.createArena();
        this.setupControls();
    }

    createArena() {
        const floorGeometry = new THREE.PlaneGeometry(
            CONFIG.ARENA.WIDTH,
            CONFIG.ARENA.HEIGHT
        );
        const floorMaterial = new THREE.MeshStandardMaterial({
            color: CONFIG.COLORS.FLOOR,
            roughness: 0.8
        });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);

        const gridHelper = new THREE.GridHelper(
            Math.max(CONFIG.ARENA.WIDTH, CONFIG.ARENA.HEIGHT),
            20,
            0x4a5568,
            0x2d3748
        );
        this.scene.add(gridHelper);

        const wallMaterial = new THREE.MeshStandardMaterial({
            color: CONFIG.COLORS.WALL
        });

        const backWall = new THREE.Mesh(
            new THREE.BoxGeometry(CONFIG.ARENA.WIDTH, 5, 1),
            wallMaterial
        );
        backWall.position.set(0, 2.5, -CONFIG.ARENA.HEIGHT / 2);
        this.scene.add(backWall);

        const entranceLine = new THREE.Mesh(
            new THREE.BoxGeometry(CONFIG.ARENA.WIDTH, 0.1, 0.5),
            new THREE.MeshStandardMaterial({ color: 0x00d4ff })
        );
        entranceLine.position.set(0, 0.05, -10);
        this.scene.add(entranceLine);

        this.createHeatmapLayer();
    }

    createHeatmapLayer() {
        const segments = 30;
        const heatmapGeometry = new THREE.PlaneGeometry(
            CONFIG.ARENA.WIDTH,
            CONFIG.ARENA.HEIGHT,
            segments,
            segments
        );
        const heatmapMaterial = new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 0.6,
            vertexColors: true
        });
        this.heatmapMesh = new THREE.Mesh(heatmapGeometry, heatmapMaterial);
        this.heatmapMesh.rotation.x = -Math.PI / 2;
        this.heatmapMesh.position.y = 0.02;
        this.heatmapMesh.visible = false;
        this.scene.add(this.heatmapMesh);
    }

    updateHeatmap() {
        if (!this.showHeatmap) return;

        const heatmap = simulation.heatmap;
        const geometry = this.heatmapMesh.geometry;
        const positions = geometry.attributes.position.array;
        const colors = new Float32Array(positions.length);

        for (let i = 0; i < positions.length; i += 3) {
            const x = positions[i];
            const z = -positions[i + 2];
            const color = new THREE.Color(heatmap.getColor(x, z));
            colors[i] = color.r;
            colors[i + 1] = color.g;
            colors[i + 2] = color.b;
        }

        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.attributes.color.needsUpdate = true;
    }

    toggleHeatmap() {
        this.showHeatmap = !this.showHeatmap;
        this.heatmapMesh.visible = this.showHeatmap;
        return this.showHeatmap;
    }

    createGates() {
        this.gateMeshes.forEach(m => this.scene.remove(m));
        this.gateMeshes = [];

        simulation.gates.forEach(gate => {
            const gateGroup = new THREE.Group();

            const gateBody = new THREE.Mesh(
                new THREE.BoxGeometry(3, 3, 0.5),
                new THREE.MeshStandardMaterial({
                    color: gate.open ? CONFIG.COLORS.GATE_OPEN : CONFIG.COLORS.GATE_CLOSED
                })
            );
            gateBody.position.set(gate.x, 1.5, gate.z);
            gateBody.castShadow = true;
            gateBody.userData = { type: 'gate', id: gate.id };
            gateGroup.add(gateBody);

            const gateLabel = this.createTextSprite(`闸机${gate.id}`, 0xffffff);
            gateLabel.position.set(gate.x, 3.5, gate.z);
            gateGroup.add(gateLabel);

            this.scene.add(gateGroup);
            this.gateMeshes.push(gateGroup);
            gate.mesh = gateBody;
        });
    }

    createClosedAreas() {
        simulation.closedAreas.forEach(area => {
            const areaMesh = new THREE.Mesh(
                new THREE.BoxGeometry(area.width, 0.1, area.height),
                new THREE.MeshStandardMaterial({
                    color: 0xf56565,
                    transparent: true,
                    opacity: 0.5
                })
            );
            areaMesh.position.set(area.x, 0.05, area.z);
            this.scene.add(areaMesh);
            area.mesh = areaMesh;
        });
    }

    createPerson(person) {
        const geometry = new THREE.CylinderGeometry(0.3, 0.3, 1.5, 8);
        const material = new THREE.MeshStandardMaterial({
            color: person.color
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(person.x, 0.75, person.z);
        mesh.castShadow = true;
        mesh.userData = { type: 'person', id: person.id };
        this.scene.add(mesh);
        this.peopleMeshes.push(mesh);
        person.mesh = mesh;
    }

    updatePeople() {
        const currentIds = new Set(simulation.people.map(p => p.id));
        
        this.peopleMeshes = this.peopleMeshes.filter(mesh => {
            if (!currentIds.has(mesh.userData.id)) {
                this.scene.remove(mesh);
                return false;
            }
            return true;
        });

        simulation.people.forEach(person => {
            if (!person.mesh) {
                this.createPerson(person);
            }
        });
    }

    createTextSprite(text, color) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 128;
        canvas.height = 64;
        context.fillStyle = 'rgba(0, 0, 0, 0)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.font = 'bold 24px Arial';
        context.fillStyle = '#' + color.toString(16).padStart(6, '0');
        context.textAlign = 'center';
        context.fillText(text, 64, 40);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({
            map: texture,
            transparent: true
        });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(4, 2, 1);
        return sprite;
    }

    setView2D() {
        this.is2D = true;
        this.camera.position.set(0, 60, 0.1);
        this.camera.lookAt(0, 0, 0);
    }

    setView3D() {
        this.is2D = false;
        this.camera.position.set(0, 40, 40);
        this.camera.lookAt(0, 0, 0);
    }

    setViewFront() {
        this.camera.position.set(0, 15, 50);
        this.camera.lookAt(0, 0, 0);
    }

    setViewSide() {
        this.camera.position.set(50, 20, 0);
        this.camera.lookAt(0, 0, 0);
    }

    setupControls() {
        let isDragging = false;
        let previousMousePosition = { x: 0, y: 0 };
        let cameraAngle = { theta: Math.PI / 4, phi: Math.PI / 4 };
        let cameraDistance = 50;

        const updateCamera = () => {
            if (this.is2D) return;
            
            this.camera.position.x = cameraDistance * Math.sin(cameraAngle.theta) * Math.cos(cameraAngle.phi);
            this.camera.position.y = cameraDistance * Math.sin(cameraAngle.phi);
            this.camera.position.z = cameraDistance * Math.cos(cameraAngle.theta) * Math.cos(cameraAngle.phi);
            this.camera.lookAt(0, 0, 0);
        };

        this.canvas.addEventListener('mousedown', (e) => {
            if (e.button === 0) {
                isDragging = true;
                previousMousePosition = { x: e.clientX, y: e.clientY };

                const rect = this.canvas.getBoundingClientRect();
                this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
                this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

                this.raycaster.setFromCamera(this.mouse, this.camera);
                const intersects = this.raycaster.intersectObjects(this.gateMeshes, true);
                
                if (intersects.length > 0) {
                    const obj = intersects[0].object;
                    if (obj.userData.type === 'gate') {
                        this.draggedObject = obj;
                    }
                }
            }
        });

        this.canvas.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const deltaX = e.clientX - previousMousePosition.x;
                const deltaY = e.clientY - previousMousePosition.y;

                if (this.draggedObject) {
                    const rect = this.canvas.getBoundingClientRect();
                    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
                    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

                    this.raycaster.setFromCamera(this.mouse, this.camera);
                    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
                    const intersectPoint = new THREE.Vector3();
                    this.raycaster.ray.intersectPlane(plane, intersectPoint);

                    if (intersectPoint) {
                        this.draggedObject.position.x = Math.max(-25, Math.min(25, intersectPoint.x));
                        const gate = simulation.gates.find(g => g.id === this.draggedObject.userData.id);
                        if (gate) {
                            gate.x = this.draggedObject.position.x;
                        }
                    }
                } else if (!this.is2D) {
                    cameraAngle.theta -= deltaX * 0.01;
                    cameraAngle.phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.1, cameraAngle.phi - deltaY * 0.01));
                    updateCamera();
                }

                previousMousePosition = { x: e.clientX, y: e.clientY };
            }
        });

        this.canvas.addEventListener('mouseup', () => {
            isDragging = false;
            this.draggedObject = null;
        });

        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            cameraDistance = Math.max(20, Math.min(100, cameraDistance + e.deltaY * 0.1));
            updateCamera();
        });

        this.canvas.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

            this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersects = this.raycaster.intersectObjects(this.gateMeshes, true);

            if (intersects.length > 0) {
                const obj = intersects[0].object;
                if (obj.userData.type === 'gate') {
                    const gate = simulation.gates.find(g => g.id === obj.userData.id);
                    if (gate) {
                        gate.toggle();
                        ui.updateGateList();
                        simulation.addEvent('闸机操作', `闸机 ${gate.id} ${gate.open ? '开启' : '关闭'}`);
                    }
                }
            }
        });

        updateCamera();
    }

    resize() {
        this.camera.aspect = this.canvas.clientWidth / this.canvas.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);
    }

    clear() {
        this.peopleMeshes.forEach(m => this.scene.remove(m));
        this.peopleMeshes = [];
        this.gateMeshes.forEach(m => this.scene.remove(m));
        this.gateMeshes = [];
    }

    render() {
        this.updatePeople();
        if (this.showHeatmap) {
            this.updateHeatmap();
        }
        this.renderer.render(this.scene, this.camera);
    }
}
