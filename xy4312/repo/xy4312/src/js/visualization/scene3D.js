/**
 * 3D场景渲染模块
 * 使用Three.js进行仓库地图、车辆轨迹和风险点的3D可视化
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import store from '../state/store.js';

export class Scene3D {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            backgroundColor: options.backgroundColor || 0xf0f0f0,
            gridSize: options.gridSize || 100,
            gridDivisions: options.gridDivisions || 100,
            showGrid: options.showGrid !== false,
            showAxes: options.showAxes !== false,
            enableControls: options.enableControls !== false,
            vehicleColors: options.vehicleColors || [
                0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6,
                0x1abc9c, 0xe67e22, 0x34495e, 0x95a5a6, 0xd35400
            ],
            ...options
        };

        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.raycaster = null;
        this.mouse = null;

        this.mapGroup = null;
        this.vehiclesGroup = null;
        this.risksGroup = null;
        this.trajectoryGroup = null;

        this.vehicleMeshes = new Map();
        this.riskMeshes = new Map();
        this.vehicleColors = new Map();
        this.nextColorIndex = 0;

        this.animationId = null;
        this.isInitialized = false;

        this.stateListenerId = null;
        this.selectedObject = null;
        this.hoveredObject = null;

        this.onRiskClick = options.onRiskClick || null;
        this.onVehicleClick = options.onVehicleClick || null;
    }

    init() {
        if (this.isInitialized) return;

        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(this.options.backgroundColor);

        this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
        this.camera.position.set(50, 50, 50);
        this.camera.lookAt(0, 0, 0);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);

        if (this.options.enableControls) {
            this.controls = new OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.05;
            this.controls.screenSpacePanning = false;
            this.controls.minDistance = 5;
            this.controls.maxDistance = 200;
            this.controls.maxPolarAngle = Math.PI / 2;
        }

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.setupLights();
        this.setupGroups();

        if (this.options.showGrid) {
            this.addGrid();
        }

        if (this.options.showAxes) {
            const axesHelper = new THREE.AxesHelper(10);
            this.scene.add(axesHelper);
        }

        this.setupEventListeners();
        this.subscribeToStore();

        this.isInitialized = true;
        this.animate();
    }

    setupLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
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

        const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.3);
        this.scene.add(hemisphereLight);
    }

    setupGroups() {
        this.mapGroup = new THREE.Group();
        this.mapGroup.name = 'mapGroup';
        this.scene.add(this.mapGroup);

        this.vehiclesGroup = new THREE.Group();
        this.vehiclesGroup.name = 'vehiclesGroup';
        this.scene.add(this.vehiclesGroup);

        this.risksGroup = new THREE.Group();
        this.risksGroup.name = 'risksGroup';
        this.scene.add(this.risksGroup);

        this.trajectoryGroup = new THREE.Group();
        this.trajectoryGroup.name = 'trajectoryGroup';
        this.scene.add(this.trajectoryGroup);
    }

    addGrid() {
        const gridHelper = new THREE.GridHelper(
            this.options.gridSize,
            this.options.gridDivisions,
            0x888888,
            0xcccccc
        );
        gridHelper.position.y = 0.01;
        this.scene.add(gridHelper);
    }

    setupEventListeners() {
        window.addEventListener('resize', () => this.onWindowResize());
        
        this.renderer.domElement.addEventListener('click', (event) => this.onMouseClick(event));
        this.renderer.domElement.addEventListener('mousemove', (event) => this.onMouseMove(event));
    }

    subscribeToStore() {
        this.stateListenerId = store.subscribe((state, changeType) => {
            this.handleStateChange(state, changeType);
        }, ['all']);
        
        this.handleStateChange(store.getState(), 'all');
    }

    handleStateChange(state, changeType) {
        if (!this.isInitialized) return;

        switch (changeType) {
            case 'mapData':
            case 'all':
                this.updateMap(state.mapData);
                break;
            case 'trajectoryData':
            case 'all':
                this.updateTrajectories(state.trajectoryData);
                break;
            case 'playback':
            case 'all':
                this.updateVehiclesAtTime(state.playback.currentTime);
                break;
            case 'risks':
            case 'all':
                this.updateRisks(state.risks);
                break;
            case 'filters':
            case 'all':
                this.updateFilters(state.filters);
                break;
            case 'selectedRisk':
            case 'all':
                this.updateSelectedRisk(state.selectedRisk);
                break;
        }
    }

    updateMap(mapData) {
        while (this.mapGroup.children.length > 0) {
            const child = this.mapGroup.children[0];
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material.dispose();
                }
            }
            this.mapGroup.remove(child);
        }

        if (!mapData) return;

        if (mapData.zones && mapData.zones.length > 0) {
            mapData.zones.forEach(zone => {
                this.createZone(zone);
            });
        }

        if (mapData.aisles && mapData.aisles.length > 0) {
            mapData.aisles.forEach(aisle => {
                this.createAisle(aisle);
            });
        }

        if (mapData.racks && mapData.racks.length > 0) {
            mapData.racks.forEach(rack => {
                this.createRack(rack);
            });
        }

        if (mapData.restrictedAreas && mapData.restrictedAreas.length > 0) {
            mapData.restrictedAreas.forEach(area => {
                this.createRestrictedArea(area);
            });
        }

        if (mapData.bounds) {
            this.createBoundary(mapData.bounds);
        }
    }

    createZone(zone) {
        const group = new THREE.Group();
        group.name = `zone_${zone.id}`;
        group.userData = { type: 'zone', data: zone };

        const color = zone.color ? new THREE.Color(zone.color) : new THREE.Color(0x66bb6a);

        if (zone.polygon && zone.polygon.length >= 3) {
            const shape = new THREE.Shape();
            const firstPoint = zone.polygon[0];
            shape.moveTo(firstPoint.x, firstPoint.y);
            
            for (let i = 1; i < zone.polygon.length; i++) {
                shape.lineTo(zone.polygon[i].x, zone.polygon[i].y);
            }
            shape.closePath();

            const geometry = new THREE.ShapeGeometry(shape);
            geometry.rotateX(-Math.PI / 2);

            const material = new THREE.MeshStandardMaterial({
                color: color,
                transparent: true,
                opacity: 0.3,
                side: THREE.DoubleSide
            });

            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.y = 0.02;
            mesh.receiveShadow = true;
            group.add(mesh);
        } else if (zone.bounds) {
            const width = zone.bounds.maxX - zone.bounds.minX;
            const depth = zone.bounds.maxY - zone.bounds.minY;

            const geometry = new THREE.PlaneGeometry(width, depth);
            geometry.rotateX(-Math.PI / 2);

            const material = new THREE.MeshStandardMaterial({
                color: color,
                transparent: true,
                opacity: 0.3,
                side: THREE.DoubleSide
            });

            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(
                (zone.bounds.minX + zone.bounds.maxX) / 2,
                0.02,
                (zone.bounds.minY + zone.bounds.maxY) / 2
            );
            mesh.receiveShadow = true;
            group.add(mesh);
        }

        this.mapGroup.add(group);
    }

    createAisle(aisle) {
        const group = new THREE.Group();
        group.name = `aisle_${aisle.id}`;
        group.userData = { type: 'aisle', data: aisle };

        const color = aisle.color ? new THREE.Color(aisle.color) : new THREE.Color(0x4a90d9);

        if (aisle.bounds) {
            const width = aisle.bounds.maxX - aisle.bounds.minX;
            const depth = aisle.bounds.maxY - aisle.bounds.minY;

            const geometry = new THREE.PlaneGeometry(width, depth);
            geometry.rotateX(-Math.PI / 2);

            const material = new THREE.MeshStandardMaterial({
                color: color,
                transparent: true,
                opacity: 0.2,
                side: THREE.DoubleSide
            });

            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(
                (aisle.bounds.minX + aisle.bounds.maxX) / 2,
                0.015,
                (aisle.bounds.minY + aisle.bounds.maxY) / 2
            );
            mesh.receiveShadow = true;
            group.add(mesh);

            const edgeGeometry = new THREE.EdgesGeometry(
                new THREE.BoxGeometry(width, 0.01, depth)
            );
            const edgeMaterial = new THREE.LineBasicMaterial({ color: color, linewidth: 2 });
            const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
            edges.position.copy(mesh.position);
            edges.position.y = 0.02;
            group.add(edges);
        }

        this.mapGroup.add(group);
    }

    createRack(rack) {
        const group = new THREE.Group();
        group.name = `rack_${rack.id}`;
        group.userData = { type: 'rack', data: rack };

        const color = rack.color ? new THREE.Color(rack.color) : new THREE.Color(0x8b7355);

        if (rack.bounds) {
            const width = rack.bounds.maxX - rack.bounds.minX;
            const depth = rack.bounds.maxY - rack.bounds.minY;
            const height = rack.height || 5;

            const geometry = new THREE.BoxGeometry(width, height, depth);

            const material = new THREE.MeshStandardMaterial({
                color: color,
                transparent: true,
                opacity: 0.7
            });

            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(
                (rack.bounds.minX + rack.bounds.maxX) / 2,
                height / 2,
                (rack.bounds.minY + rack.bounds.maxY) / 2
            );
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            group.add(mesh);

            const levels = rack.levels || 5;
            const levelHeight = height / levels;

            for (let i = 1; i < levels; i++) {
                const shelfGeometry = new THREE.BoxGeometry(width * 0.9, 0.05, depth * 0.9);
                const shelfMaterial = new THREE.MeshStandardMaterial({
                    color: 0x654321,
                    transparent: true,
                    opacity: 0.8
                });

                const shelf = new THREE.Mesh(shelfGeometry, shelfMaterial);
                shelf.position.set(
                    (rack.bounds.minX + rack.bounds.maxX) / 2,
                    levelHeight * i,
                    (rack.bounds.minY + rack.bounds.maxY) / 2
                );
                shelf.castShadow = true;
                shelf.receiveShadow = true;
                group.add(shelf);
            }
        }

        this.mapGroup.add(group);
    }

    createRestrictedArea(area) {
        const group = new THREE.Group();
        group.name = `restricted_${area.id}`;
        group.userData = { type: 'restricted', data: area };

        const color = area.color ? new THREE.Color(area.color) : new THREE.Color(0xff4444);

        if (area.polygon && area.polygon.length >= 3) {
            const shape = new THREE.Shape();
            const firstPoint = area.polygon[0];
            shape.moveTo(firstPoint.x, firstPoint.y);
            
            for (let i = 1; i < area.polygon.length; i++) {
                shape.lineTo(area.polygon[i].x, area.polygon[i].y);
            }
            shape.closePath();

            const extrudeSettings = {
                steps: 1,
                depth: 0.5,
                bevelEnabled: false
            };

            const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
            geometry.rotateX(-Math.PI / 2);

            const material = new THREE.MeshStandardMaterial({
                color: color,
                transparent: true,
                opacity: 0.4,
                side: THREE.DoubleSide
            });

            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.y = 0;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            group.add(mesh);

            const edgeGeometry = new THREE.EdgesGeometry(geometry);
            const edgeMaterial = new THREE.LineBasicMaterial({ 
                color: color, 
                linewidth: 2,
                dashSize: 0.5,
                gapSize: 0.25
            });
            const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
            edges.computeLineDistances();
            edges.position.y = 0.5;
            group.add(edges);
        } else if (area.bounds) {
            const width = area.bounds.maxX - area.bounds.minX;
            const depth = area.bounds.maxY - area.bounds.minY;

            const geometry = new THREE.BoxGeometry(width, 0.5, depth);

            const material = new THREE.MeshStandardMaterial({
                color: color,
                transparent: true,
                opacity: 0.4
            });

            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(
                (area.bounds.minX + area.bounds.maxX) / 2,
                0.25,
                (area.bounds.minY + area.bounds.maxY) / 2
            );
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            group.add(mesh);

            const edgeGeometry = new THREE.EdgesGeometry(geometry);
            const edgeMaterial = new THREE.LineBasicMaterial({ 
                color: color, 
                linewidth: 2
            });
            const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
            edges.position.copy(mesh.position);
            group.add(edges);
        }

        this.mapGroup.add(group);
    }

    createBoundary(bounds) {
        const group = new THREE.Group();
        group.name = 'boundary';

        const width = bounds.maxX - bounds.minX;
        const depth = bounds.maxY - bounds.minY;

        const floorGeometry = new THREE.PlaneGeometry(width, depth);
        floorGeometry.rotateX(-Math.PI / 2);

        const floorMaterial = new THREE.MeshStandardMaterial({
            color: 0xdddddd,
            transparent: true,
            opacity: 0.5
        });

        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.position.set(
            (bounds.minX + bounds.maxX) / 2,
            0,
            (bounds.minY + bounds.maxY) / 2
        );
        floor.receiveShadow = true;
        group.add(floor);

        const wallHeight = 2;
        const wallThickness = 0.1;

        const wallMaterial = new THREE.MeshStandardMaterial({
            color: 0x999999,
            transparent: true,
            opacity: 0.3
        });

        const northWallGeometry = new THREE.BoxGeometry(width, wallHeight, wallThickness);
        const northWall = new THREE.Mesh(northWallGeometry, wallMaterial);
        northWall.position.set(
            (bounds.minX + bounds.maxX) / 2,
            wallHeight / 2,
            bounds.maxY
        );
        northWall.castShadow = true;
        northWall.receiveShadow = true;
        group.add(northWall);

        const southWallGeometry = new THREE.BoxGeometry(width, wallHeight, wallThickness);
        const southWall = new THREE.Mesh(southWallGeometry, wallMaterial);
        southWall.position.set(
            (bounds.minX + bounds.maxX) / 2,
            wallHeight / 2,
            bounds.minY
        );
        southWall.castShadow = true;
        southWall.receiveShadow = true;
        group.add(southWall);

        const eastWallGeometry = new THREE.BoxGeometry(wallThickness, wallHeight, depth);
        const eastWall = new THREE.Mesh(eastWallGeometry, wallMaterial);
        eastWall.position.set(
            bounds.maxX,
            wallHeight / 2,
            (bounds.minY + bounds.maxY) / 2
        );
        eastWall.castShadow = true;
        eastWall.receiveShadow = true;
        group.add(eastWall);

        const westWallGeometry = new THREE.BoxGeometry(wallThickness, wallHeight, depth);
        const westWall = new THREE.Mesh(westWallGeometry, wallMaterial);
        westWall.position.set(
            bounds.minX,
            wallHeight / 2,
            (bounds.minY + bounds.maxY) / 2
        );
        westWall.castShadow = true;
        westWall.receiveShadow = true;
        group.add(westWall);

        this.mapGroup.add(group);
    }

    updateTrajectories(trajectoryData) {
        while (this.trajectoryGroup.children.length > 0) {
            const child = this.trajectoryGroup.children[0];
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material.dispose();
                }
            }
            this.trajectoryGroup.remove(child);
        }

        if (!trajectoryData || trajectoryData.length === 0) return;

        const vehicleGroups = {};
        trajectoryData.forEach(point => {
            if (!vehicleGroups[point.vehicleId]) {
                vehicleGroups[point.vehicleId] = [];
            }
            vehicleGroups[point.vehicleId].push(point);
        });

        Object.keys(vehicleGroups).forEach(vehicleId => {
            const points = vehicleGroups[vehicleId];
            points.sort((a, b) => a.timestamp - b.timestamp);

            if (points.length < 2) return;

            const positions = [];
            points.forEach(point => {
                positions.push(point.x, (point.z || 0) + 0.1, point.y);
            });

            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

            const color = this.getVehicleColor(vehicleId);
            const material = new THREE.LineBasicMaterial({
                color: color,
                linewidth: 2,
                transparent: true,
                opacity: 0.6
            });

            const line = new THREE.Line(geometry, material);
            line.name = `trajectory_${vehicleId}`;
            line.userData = { type: 'trajectory', vehicleId: vehicleId };
            this.trajectoryGroup.add(line);
        });
    }

    updateVehiclesAtTime(currentTime) {
        const vehiclesAtTime = store.getVehiclesAtTime(currentTime);
        
        vehiclesAtTime.forEach(vehicle => {
            this.updateVehicle(vehicle);
        });

        this.vehicleMeshes.forEach((mesh, vehicleId) => {
            const exists = vehiclesAtTime.some(v => v.vehicleId === vehicleId);
            mesh.visible = exists;
        });
    }

    updateVehicle(vehicleData) {
        const vehicleId = vehicleData.vehicleId;
        let mesh = this.vehicleMeshes.get(vehicleId);

        if (!mesh) {
            mesh = this.createVehicleMesh(vehicleId);
            this.vehiclesGroup.add(mesh);
            this.vehicleMeshes.set(vehicleId, mesh);
        }

        mesh.position.set(
            vehicleData.x,
            1,
            vehicleData.y
        );

        const color = this.getVehicleColor(vehicleId);
        
        if (vehicleData.speed !== undefined) {
            const speedFactor = Math.min(vehicleData.speed / 15, 1);
            const r = Math.floor(255 * speedFactor);
            const g = Math.floor(255 * (1 - speedFactor));
            mesh.material.color.setRGB(r / 255, g / 255, 0.2);
        }

        if (mesh.userData.label) {
            const canvas = mesh.userData.labelCanvas;
            const context = canvas.getContext('2d');
            context.clearRect(0, 0, canvas.width, canvas.height);
            
            context.font = 'bold 24px Arial';
            context.fillStyle = '#ffffff';
            context.textAlign = 'center';
            context.fillText(vehicleId, canvas.width / 2, canvas.height / 2 + 8);
            
            context.fillStyle = '#333333';
            context.font = '14px Arial';
            context.fillText(
                `${vehicleData.speed ? vehicleData.speed.toFixed(1) : '0'} km/h`,
                canvas.width / 2,
                canvas.height / 2 + 28
            );

            mesh.userData.labelTexture.needsUpdate = true;
        }
    }

    createVehicleMesh(vehicleId) {
        const group = new THREE.Group();
        group.name = `vehicle_${vehicleId}`;
        group.userData = { type: 'vehicle', vehicleId: vehicleId };

        const color = this.getVehicleColor(vehicleId);

        const bodyGeometry = new THREE.BoxGeometry(2, 1, 1.5);
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: color,
            metalness: 0.3,
            roughness: 0.7
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 0.5;
        body.castShadow = true;
        body.receiveShadow = true;
        group.add(body);

        const topGeometry = new THREE.BoxGeometry(1.2, 0.6, 1.2);
        const topMaterial = new THREE.MeshStandardMaterial({
            color: color,
            metalness: 0.3,
            roughness: 0.7
        });
        const top = new THREE.Mesh(topGeometry, topMaterial);
        top.position.set(0, 1.3, 0);
        top.castShadow = true;
        group.add(top);

        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 64;
        const context = canvas.getContext('2d');
        
        context.fillStyle = 'rgba(0, 0, 0, 0.7)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        context.font = 'bold 24px Arial';
        context.fillStyle = '#ffffff';
        context.textAlign = 'center';
        context.fillText(vehicleId, canvas.width / 2, canvas.height / 2 + 8);

        const texture = new THREE.CanvasTexture(canvas);
        const labelMaterial = new THREE.SpriteMaterial({ 
            map: texture,
            transparent: true
        });
        const label = new THREE.Sprite(labelMaterial);
        label.position.y = 2.5;
        label.scale.set(3, 1.5, 1);
        
        group.userData.labelCanvas = canvas;
        group.userData.labelTexture = texture;
        group.userData.label = label;
        group.add(label);

        return group;
    }

    updateRisks(risks) {
        while (this.risksGroup.children.length > 0) {
            const child = this.risksGroup.children[0];
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material.dispose();
                }
            }
            this.risksGroup.remove(child);
        }
        this.riskMeshes.clear();

        if (!risks) return;

        const allRisks = [
            ...(risks.collisions || []).map(r => ({ ...r, displayType: 'collision' })),
            ...(risks.suddenStops || []).map(r => ({ ...r, displayType: 'suddenStop' })),
            ...(risks.restrictedAreaApproaches || []).map(r => ({ ...r, displayType: 'restrictedArea' })),
            ...(risks.speeding || []).map(r => ({ ...r, displayType: 'speeding' })),
            ...(risks.nearMisses || []).map(r => ({ ...r, displayType: 'nearMiss' }))
        ];

        allRisks.forEach(risk => {
            this.createRiskMarker(risk);
        });
    }

    createRiskMarker(risk) {
        const group = new THREE.Group();
        group.name = `risk_${risk.id}`;
        group.userData = { type: 'risk', risk: risk };

        let position;
        if (risk.position) {
            position = risk.position;
        } else if (risk.positions && risk.positions.length > 0) {
            position = risk.positions[0];
        } else {
            position = { x: 0, y: 0, z: 0 };
        }

        const colors = {
            'collision': 0xff0000,
            'suddenStop': 0xff8800,
            'restrictedArea': 0xff0088,
            'speeding': 0xffff00,
            'nearMiss': 0xffaa00
        };

        const color = colors[risk.displayType] || 0xff0000;

        const sizeBySeverity = {
            'high': 2,
            'medium': 1.5,
            'low': 1
        };

        const size = sizeBySeverity[risk.severity] || 1;

        const geometry = new THREE.RingGeometry(size * 0.5, size, 32);
        const material = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide
        });

        const ring = new THREE.Mesh(geometry, material);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(position.x, 0.05, position.y);
        group.add(ring);

        const coneGeometry = new THREE.ConeGeometry(size * 0.3, size * 1.5, 8);
        const coneMaterial = new THREE.MeshStandardMaterial({
            color: color,
            transparent: true,
            opacity: 0.8
        });

        const cone = new THREE.Mesh(coneGeometry, coneMaterial);
        cone.position.set(position.x, size * 0.75, position.y);
        cone.castShadow = true;
        group.add(cone);

        group.position.set(position.x, 0, position.y);

        this.risksGroup.add(group);
        this.riskMeshes.set(risk.id, group);
    }

    updateFilters(filters) {
        this.vehicleMeshes.forEach((mesh, vehicleId) => {
            if (filters.vehicles.length > 0) {
                mesh.visible = filters.vehicles.includes(vehicleId);
            }
        });

        this.riskMeshes.forEach((mesh, riskId) => {
            const risk = mesh.userData.risk;
            if (!risk) return;

            let visible = true;

            if (filters.severities && filters.severities.length > 0) {
                visible = visible && filters.severities.includes(risk.severity);
            }

            if (filters.vehicles && filters.vehicles.length > 0) {
                if (risk.vehicles) {
                    visible = visible && risk.vehicles.some(v => filters.vehicles.includes(v));
                } else if (risk.vehicleId) {
                    visible = visible && filters.vehicles.includes(risk.vehicleId);
                }
            }

            mesh.visible = visible;
        });
    }

    updateSelectedRisk(selectedRisk) {
        this.riskMeshes.forEach((mesh, riskId) => {
            const isSelected = selectedRisk && selectedRisk.id === riskId;
            
            mesh.children.forEach(child => {
                if (child.material) {
                    if (isSelected) {
                        child.material.emissive = new THREE.Color(0xffffff);
                        child.material.emissiveIntensity = 0.5;
                    } else {
                        child.material.emissive = new THREE.Color(0x000000);
                        child.material.emissiveIntensity = 0;
                    }
                }
            });
        });

        if (selectedRisk && this.controls) {
            let position;
            if (selectedRisk.position) {
                position = selectedRisk.position;
            } else if (selectedRisk.positions && selectedRisk.positions.length > 0) {
                position = selectedRisk.positions[0];
            }

            if (position) {
                const target = new THREE.Vector3(position.x, 3, position.y);
                this.camera.position.lerp(target, 0.5);
                this.controls.target.set(position.x, 0, position.y);
                this.controls.update();
            }
        }
    }

    getVehicleColor(vehicleId) {
        if (!this.vehicleColors.has(vehicleId)) {
            const colorIndex = this.nextColorIndex % this.options.vehicleColors.length;
            this.vehicleColors.set(vehicleId, this.options.vehicleColors[colorIndex]);
            this.nextColorIndex++;
        }
        return this.vehicleColors.get(vehicleId);
    }

    onWindowResize() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(width, height);
    }

    onMouseClick(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);

        const allRisks = [];
        this.risksGroup.traverse((child) => {
            if (child.userData && child.userData.type === 'risk') {
                allRisks.push(child);
            }
        });

        const allVehicles = [];
        this.vehiclesGroup.traverse((child) => {
            if (child.userData && child.userData.type === 'vehicle') {
                allVehicles.push(child);
            }
        });

        const riskIntersects = this.raycaster.intersectObjects(allRisks, true);
        if (riskIntersects.length > 0) {
            const riskGroup = this.findParentWithType(riskIntersects[0].object, 'risk');
            if (riskGroup && this.onRiskClick) {
                this.onRiskClick(riskGroup.userData.risk);
            }
            return;
        }

        const vehicleIntersects = this.raycaster.intersectObjects(allVehicles, true);
        if (vehicleIntersects.length > 0) {
            const vehicleGroup = this.findParentWithType(vehicleIntersects[0].object, 'vehicle');
            if (vehicleGroup && this.onVehicleClick) {
                this.onVehicleClick(vehicleGroup.userData.vehicleId);
            }
        }
    }

    onMouseMove(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);

        const allRisks = [];
        this.risksGroup.traverse((child) => {
            if (child.userData && child.userData.type === 'risk') {
                allRisks.push(child);
            }
        });

        const intersects = this.raycaster.intersectObjects(allRisks, true);
        
        if (intersects.length > 0) {
            const riskGroup = this.findParentWithType(intersects[0].object, 'risk');
            if (riskGroup !== this.hoveredObject) {
                if (this.hoveredObject) {
                    this.hoveredObject.children.forEach(child => {
                        if (child.material) {
                            child.material.scale = 1;
                        }
                    });
                }
                
                this.hoveredObject = riskGroup;
                this.renderer.domElement.style.cursor = 'pointer';
            }
        } else {
            if (this.hoveredObject) {
                this.renderer.domElement.style.cursor = 'default';
                this.hoveredObject = null;
            }
        }
    }

    findParentWithType(object, type) {
        let current = object;
        while (current) {
            if (current.userData && current.userData.type === type) {
                return current;
            }
            current = current.parent;
        }
        return null;
    }

    animate() {
        this.animationId = requestAnimationFrame(() => this.animate());

        if (this.controls) {
            this.controls.update();
        }

        const time = Date.now() * 0.001;
        this.riskMeshes.forEach((mesh, riskId) => {
            mesh.children.forEach(child => {
                if (child.material && child.material.opacity !== undefined) {
                    child.material.opacity = 0.4 + Math.sin(time * 3) * 0.3;
                }
            });
        });

        this.renderer.render(this.scene, this.camera);
    }

    dispose() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }

        if (this.stateListenerId !== null) {
            store.unsubscribe(this.stateListenerId);
        }

        while (this.scene.children.length > 0) {
            const child = this.scene.children[0];
            this.disposeObject(child);
            this.scene.remove(child);
        }

        if (this.renderer) {
            this.renderer.dispose();
            if (this.container.contains(this.renderer.domElement)) {
                this.container.removeChild(this.renderer.domElement);
            }
        }

        this.isInitialized = false;
    }

    disposeObject(object) {
        if (object.geometry) {
            object.geometry.dispose();
        }
        if (object.material) {
            if (Array.isArray(object.material)) {
                object.material.forEach(m => m.dispose());
            } else {
                object.material.dispose();
            }
        }

        while (object.children.length > 0) {
            const child = object.children[0];
            this.disposeObject(child);
            object.remove(child);
        }
    }

    getCameraPosition() {
        return {
            x: this.camera.position.x,
            y: this.camera.position.y,
            z: this.camera.position.z
        };
    }

    setCameraPosition(x, y, z) {
        this.camera.position.set(x, y, z);
        if (this.controls) {
            this.controls.update();
        }
    }

    resetCamera() {
        const mapData = store.getMapData();
        if (mapData && mapData.bounds) {
            const centerX = (mapData.bounds.minX + mapData.bounds.maxX) / 2;
            const centerY = (mapData.bounds.minY + mapData.bounds.maxY) / 2;
            const width = mapData.bounds.maxX - mapData.bounds.minX;
            const depth = mapData.bounds.maxY - mapData.bounds.minY;
            const maxDim = Math.max(width, depth);

            this.camera.position.set(centerX + maxDim * 0.7, maxDim * 0.7, centerY + maxDim * 0.7);
            this.controls.target.set(centerX, 0, centerY);
            this.controls.update();
        } else {
            this.camera.position.set(50, 50, 50);
            this.controls.target.set(0, 0, 0);
            this.controls.update();
        }
    }
}

export default Scene3D;
