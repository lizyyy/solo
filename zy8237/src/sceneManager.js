import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CONFIG } from './config.js';

export class SceneManager {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    
    this.garageGroup = null;
    this.carsGroup = null;
    this.trajectoriesGroup = null;
    this.highlightsGroup = null;
    
    this.floorMeshes = new Map();
    this.slotMeshes = new Map();
    this.elevatorMeshes = new Map();
    this.carMeshes = new Map();
    this.labels = [];
    
    this.garageStructure = null;
    this.showLabels = true;
    this.showFloors = true;
    
    this.init();
  }

  init() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a1a);
    this.scene.fog = new THREE.Fog(0x0a0a1a, 50, 150);

    const aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    const defaultView = CONFIG.DEFAULT_VIEW.free;
    this.camera.position.set(...defaultView.position);
    this.camera.lookAt(...defaultView.target);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.screenSpacePanning = false;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 100;
    this.controls.maxPolarAngle = Math.PI / 2;

    this.setupLights();
    this.createGroups();
    this.createGrid();

    window.addEventListener('resize', () => this.onResize());
  }

  setupLights() {
    const ambientLight = new THREE.AmbientLight(0x404060, 0.6);
    this.scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
    mainLight.position.set(20, 30, 20);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 100;
    mainLight.shadow.camera.left = -50;
    mainLight.shadow.camera.right = 50;
    mainLight.shadow.camera.top = 50;
    mainLight.shadow.camera.bottom = -50;
    this.scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0x6080ff, 0.3);
    fillLight.position.set(-15, 20, -15);
    this.scene.add(fillLight);

    const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x444444, 0.3);
    this.scene.add(hemiLight);
  }

  createGroups() {
    this.garageGroup = new THREE.Group();
    this.scene.add(this.garageGroup);

    this.carsGroup = new THREE.Group();
    this.scene.add(this.carsGroup);

    this.trajectoriesGroup = new THREE.Group();
    this.scene.add(this.trajectoriesGroup);

    this.highlightsGroup = new THREE.Group();
    this.scene.add(this.highlightsGroup);
  }

  createGrid() {
    const gridHelper = new THREE.GridHelper(100, 50, 0x333355, 0x222244);
    gridHelper.position.y = -0.01;
    this.scene.add(gridHelper);
  }

  loadGarage(structure) {
    this.garageStructure = structure;
    this.clearGarage();

    if (!structure || !structure.floors) return;

    structure.floors.forEach((floor, floorIndex) => {
      this.createFloor(floor, floorIndex);
    });

    if (structure.elevators) {
      structure.elevators.forEach((elevator, index) => {
        this.createElevator(elevator, index);
      });
    }

    this.updateStats(structure);
  }

  createFloor(floor, floorIndex) {
    const floorY = floor.level * CONFIG.FLOOR_HEIGHT;
    
    const floorGroup = new THREE.Group();
    floorGroup.position.y = floorY;
    
    const floorSize = this.calculateFloorSize(floor);
    
    const floorGeometry = new THREE.BoxGeometry(floorSize.width, 0.3, floorSize.depth);
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: CONFIG.COLORS.FLOOR,
      roughness: 0.8,
      metalness: 0.1
    });
    const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
    floorMesh.position.y = -0.15;
    floorMesh.receiveShadow = true;
    floorGroup.add(floorMesh);

    const edgesGeometry = new THREE.EdgesGeometry(floorGeometry);
    const edgesMaterial = new THREE.LineBasicMaterial({ color: 0x533483, linewidth: 2 });
    const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
    edges.position.y = -0.15;
    floorGroup.add(edges);

    if (floor.slots) {
      floor.slots.forEach((slot, slotIndex) => {
        this.createSlot(slot, floorGroup, floor.level, slotIndex);
      });
    }

    if (floor.aisles) {
      floor.aisles.forEach((aisle) => {
        this.createAisle(aisle, floorGroup);
      });
    }

    this.createStructureColumns(floorSize, floorGroup);

    this.garageGroup.add(floorGroup);
    this.floorMeshes.set(floor.id, floorGroup);
  }

  calculateFloorSize(floor) {
    let minX = Infinity, maxX = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    if (floor.slots && floor.slots.length > 0) {
      floor.slots.forEach(slot => {
        const x = slot.position.x;
        const z = slot.position.z;
        const halfW = (slot.size?.width || 2.5) / 2;
        const halfD = (slot.size?.depth || 5.0) / 2;
        minX = Math.min(minX, x - halfW);
        maxX = Math.max(maxX, x + halfW);
        minZ = Math.min(minZ, z - halfD);
        maxZ = Math.max(maxZ, z + halfD);
      });
    }

    if (minX === Infinity) {
      minX = -20;
      maxX = 20;
      minZ = -15;
      maxZ = 15;
    }

    return {
      width: maxX - minX + 10,
      depth: maxZ - minZ + 10,
      centerX: (minX + maxX) / 2,
      centerZ: (minZ + maxZ) / 2
    };
  }

  createSlot(slot, floorGroup, floorLevel, slotIndex) {
    const slotSize = {
      width: slot.size?.width || CONFIG.SLOT_SIZE.width,
      depth: slot.size?.depth || CONFIG.SLOT_SIZE.depth,
      height: 0.1
    };

    const slotGeometry = new THREE.BoxGeometry(slotSize.width, slotSize.height, slotSize.depth);
    const slotMaterial = new THREE.MeshStandardMaterial({
      color: CONFIG.COLORS.SLOT_EMPTY,
      roughness: 0.7,
      metalness: 0.2
    });
    const slotMesh = new THREE.Mesh(slotGeometry, slotMaterial);
    slotMesh.position.set(slot.position.x, 0.05, slot.position.z);
    slotMesh.rotation.y = (slot.rotation || 0) * Math.PI / 180;
    slotMesh.receiveShadow = true;
    floorGroup.add(slotMesh);

    const borderGeometry = new THREE.EdgesGeometry(slotGeometry);
    const borderMaterial = new THREE.LineBasicMaterial({ 
      color: slot.type === 'charging' ? 0x00ff88 : 0x533483,
      linewidth: 2
    });
    const border = new THREE.LineSegments(borderGeometry, borderMaterial);
    border.position.copy(slotMesh.position);
    border.rotation.copy(slotMesh.rotation);
    floorGroup.add(border);

    this.slotMeshes.set(slot.id, {
      mesh: slotMesh,
      border: border,
      data: slot,
      floorLevel: floorLevel
    });
  }

  createAisle(aisle, floorGroup) {
    if (!aisle.path || aisle.path.length < 2) return;

    const points = aisle.path.map(p => new THREE.Vector3(p.x, 0.02, p.z));
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ 
      color: 0x444466,
      linewidth: 2,
      opacity: 0.5,
      transparent: true
    });
    const line = new THREE.Line(geometry, material);
    floorGroup.add(line);
  }

  createStructureColumns(floorSize, floorGroup) {
    const columnPositions = [
      { x: -floorSize.width/2 + 1, z: -floorSize.depth/2 + 1 },
      { x: floorSize.width/2 - 1, z: -floorSize.depth/2 + 1 },
      { x: -floorSize.width/2 + 1, z: floorSize.depth/2 - 1 },
      { x: floorSize.width/2 - 1, z: floorSize.depth/2 - 1 }
    ];

    const columnGeometry = new THREE.CylinderGeometry(0.3, 0.3, CONFIG.FLOOR_HEIGHT - 0.3, 8);
    const columnMaterial = new THREE.MeshStandardMaterial({
      color: CONFIG.COLORS.STRUCTURE,
      roughness: 0.6,
      metalness: 0.3
    });

    columnPositions.forEach(pos => {
      const column = new THREE.Mesh(columnGeometry, columnMaterial);
      column.position.set(pos.x, (CONFIG.FLOOR_HEIGHT - 0.3) / 2, pos.z);
      column.castShadow = true;
      column.receiveShadow = true;
      floorGroup.add(column);
    });
  }

  createElevator(elevator, index) {
    const elevatorGroup = new THREE.Group();
    
    const shaftGeometry = new THREE.BoxGeometry(4, CONFIG.FLOOR_HEIGHT * 10, 6);
    const shaftMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1a2e,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide
    });
    const shaft = new THREE.Mesh(shaftGeometry, shaftMaterial);
    shaft.position.y = CONFIG.FLOOR_HEIGHT * 5;
    elevatorGroup.add(shaft);

    const carGeometry = new THREE.BoxGeometry(3.5, 2.5, 5.5);
    const carMaterial = new THREE.MeshStandardMaterial({
      color: CONFIG.COLORS.ELEVATOR,
      roughness: 0.4,
      metalness: 0.6
    });
    const car = new THREE.Mesh(carGeometry, carMaterial);
    car.position.y = elevator.currentFloor * CONFIG.FLOOR_HEIGHT + 1.25;
    car.castShadow = true;
    car.receiveShadow = true;
    elevatorGroup.add(car);

    const indicatorGeometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    const indicatorMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ff00,
      emissive: 0x00ff00,
      emissiveIntensity: 0.5
    });
    const indicator = new THREE.Mesh(indicatorGeometry, indicatorMaterial);
    indicator.position.set(elevator.position.x, car.position.y + 2, elevator.position.z - 3);
    elevatorGroup.add(indicator);

    elevatorGroup.position.set(elevator.position.x, 0, elevator.position.z);
    this.garageGroup.add(elevatorGroup);

    this.elevatorMeshes.set(elevator.id, {
      group: elevatorGroup,
      car: car,
      indicator: indicator,
      data: elevator,
      currentFloor: elevator.currentFloor
    });
  }

  createCar(vehicleId, position, colorIndex = 0) {
    if (this.carMeshes.has(vehicleId)) {
      return this.carMeshes.get(vehicleId).mesh;
    }

    const carGroup = new THREE.Group();
    
    const color = CONFIG.COLORS.CAR[colorIndex % CONFIG.COLORS.CAR.length];
    
    const bodyGeometry = new THREE.BoxGeometry(1.8, 1.0, 4.0);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.3,
      metalness: 0.7
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.5;
    body.castShadow = true;
    body.receiveShadow = true;
    carGroup.add(body);

    const topGeometry = new THREE.BoxGeometry(1.6, 0.5, 2.0);
    const topMaterial = new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.2,
      metalness: 0.8
    });
    const top = new THREE.Mesh(topGeometry, topMaterial);
    top.position.set(0, 1.25, -0.5);
    top.castShadow = true;
    carGroup.add(top);

    const wheelGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 16);
    const wheelMaterial = new THREE.MeshStandardMaterial({
      color: 0x222222,
      roughness: 0.9
    });
    
    const wheelPositions = [
      { x: -0.85, z: 1.3 },
      { x: 0.85, z: 1.3 },
      { x: -0.85, z: -1.3 },
      { x: 0.85, z: -1.3 }
    ];
    
    wheelPositions.forEach(pos => {
      const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(pos.x, 0.3, pos.z);
      wheel.castShadow = true;
      carGroup.add(wheel);
    });

    const glassGeometry = new THREE.BoxGeometry(1.55, 0.45, 1.9);
    const glassMaterial = new THREE.MeshStandardMaterial({
      color: 0x87ceeb,
      transparent: true,
      opacity: 0.3,
      roughness: 0.1,
      metalness: 0.9
    });
    const glass = new THREE.Mesh(glassGeometry, glassMaterial);
    glass.position.set(0, 1.25, -0.5);
    carGroup.add(glass);

    carGroup.position.set(position.x, position.y || 0.1, position.z);
    this.carsGroup.add(carGroup);

    this.carMeshes.set(vehicleId, {
      mesh: carGroup,
      colorIndex: colorIndex,
      currentPosition: { ...position }
    });

    return carGroup;
  }

  updateCarPosition(vehicleId, position, rotation = 0) {
    const carData = this.carMeshes.get(vehicleId);
    if (!carData) return;

    carData.mesh.position.set(position.x, position.y || 0.1, position.z);
    if (rotation !== undefined) {
      carData.mesh.rotation.y = rotation;
    }
    carData.currentPosition = { ...position };
  }

  removeCar(vehicleId) {
    const carData = this.carMeshes.get(vehicleId);
    if (!carData) return;

    this.carsGroup.remove(carData.mesh);
    this.carMeshes.delete(vehicleId);
  }

  updateSlotStatus(slotId, status, vehicleId = null) {
    const slotData = this.slotMeshes.get(slotId);
    if (!slotData) return;

    const { mesh, border } = slotData;
    
    switch (status) {
      case 'occupied':
        mesh.material.color.setHex(CONFIG.COLORS.SLOT_OCCUPIED);
        border.material.color.setHex(0x2ecc71);
        break;
      case 'conflict':
        mesh.material.color.setHex(CONFIG.COLORS.SLOT_HIGHLIGHT);
        border.material.color.setHex(CONFIG.COLORS.CRITICAL);
        break;
      case 'highlight':
        mesh.material.color.setHex(0xffb86c);
        border.material.color.setHex(0xffb86c);
        break;
      default:
        mesh.material.color.setHex(CONFIG.COLORS.SLOT_EMPTY);
        border.material.color.setHex(0x533483);
    }
  }

  updateElevatorStatus(elevatorId, floor, status = 'idle') {
    const elevatorData = this.elevatorMeshes.get(elevatorId);
    if (!elevatorData) return;

    const { car, indicator } = elevatorData;
    const targetY = floor * CONFIG.FLOOR_HEIGHT + 1.25;
    
    car.position.y = targetY;
    indicator.position.y = targetY + 2;

    switch (status) {
      case 'moving':
        indicator.material.color.setHex(CONFIG.COLORS.ELEVATOR_MOVING);
        indicator.material.emissive.setHex(CONFIG.COLORS.ELEVATOR_MOVING);
        car.material.color.setHex(CONFIG.COLORS.ELEVATOR_MOVING);
        break;
      case 'conflict':
        indicator.material.color.setHex(CONFIG.COLORS.CRITICAL);
        indicator.material.emissive.setHex(CONFIG.COLORS.CRITICAL);
        car.material.color.setHex(CONFIG.COLORS.CRITICAL);
        break;
      default:
        indicator.material.color.setHex(0x00ff00);
        indicator.material.emissive.setHex(0x00ff00);
        car.material.color.setHex(CONFIG.COLORS.ELEVATOR);
    }

    elevatorData.currentFloor = floor;
  }

  showTrajectory(points, color = CONFIG.COLORS.TRAJECTORY) {
    this.clearTrajectories();

    if (!points || points.length < 2) return;

    const geometry = new THREE.BufferGeometry().setFromPoints(
      points.map(p => new THREE.Vector3(p.x, (p.y || 0.1) + 0.1, p.z))
    );
    const material = new THREE.LineBasicMaterial({ 
      color: color,
      linewidth: 3
    });
    const line = new THREE.Line(geometry, material);
    this.trajectoriesGroup.add(line);

    const arrowGeometry = new THREE.ConeGeometry(0.2, 0.4, 8);
    const arrowMaterial = new THREE.MeshBasicMaterial({ color: color });
    
    for (let i = 0; i < points.length - 1; i++) {
      const from = new THREE.Vector3(points[i].x, (points[i].y || 0.1) + 0.1, points[i].z);
      const to = new THREE.Vector3(points[i + 1].x, (points[i + 1].y || 0.1) + 0.1, points[i + 1].z);
      const mid = from.clone().lerp(to, 0.5);
      
      const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
      arrow.position.copy(mid);
      arrow.lookAt(to);
      arrow.rotateX(Math.PI / 2);
      this.trajectoriesGroup.add(arrow);
    }
  }

  clearTrajectories() {
    while (this.trajectoriesGroup.children.length > 0) {
      const child = this.trajectoriesGroup.children[0];
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
      this.trajectoriesGroup.remove(child);
    }
  }

  addHighlight(position, type = 'warning') {
    const color = type === 'critical' ? CONFIG.COLORS.CRITICAL : 
                  type === 'error' ? CONFIG.COLORS.ERROR : 
                  CONFIG.COLORS.WARNING;

    const highlightGeometry = new THREE.RingGeometry(1, 1.5, 32);
    const highlightMaterial = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide
    });
    const highlight = new THREE.Mesh(highlightGeometry, highlightMaterial);
    highlight.position.set(position.x, 0.2, position.z);
    highlight.rotation.x = -Math.PI / 2;
    this.highlightsGroup.add(highlight);

    return highlight;
  }

  clearHighlights() {
    while (this.highlightsGroup.children.length > 0) {
      const child = this.highlightsGroup.children[0];
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
      this.highlightsGroup.remove(child);
    }
  }

  setView(viewType) {
    const view = CONFIG.DEFAULT_VIEW[viewType];
    if (!view) return;

    if (viewType === 'free') {
      this.controls.enabled = true;
      return;
    }

    this.controls.enabled = false;
    
    const startPos = this.camera.position.clone();
    const endPos = new THREE.Vector3(...view.position);
    const target = new THREE.Vector3(...view.target);

    const animate = () => {
      const progress = Math.min(1, this.camera.position.distanceTo(endPos) / 10);
      if (progress > 0.01) {
        this.camera.position.lerpVectors(startPos, endPos, 0.05);
        this.camera.lookAt(target);
        requestAnimationFrame(animate);
      } else {
        this.controls.target.copy(target);
        this.controls.enabled = viewType === 'free';
      }
    };
    animate();
  }

  toggleLabels(show) {
    this.showLabels = show !== undefined ? show : !this.showLabels;
    this.labels.forEach(label => {
      label.visible = this.showLabels;
    });
  }

  toggleFloors(show) {
    this.showFloors = show !== undefined ? show : !this.showFloors;
    this.floorMeshes.forEach((mesh, id) => {
      mesh.visible = this.showFloors;
    });
  }

  updateStats(structure) {
    const statFloors = document.getElementById('stat-floors');
    const statSlots = document.getElementById('stat-slots');
    const statElevators = document.getElementById('stat-elevators');

    if (statFloors) statFloors.textContent = structure.floors?.length || 0;
    if (statSlots) statSlots.textContent = structure.totalSlots || 0;
    if (statElevators) statElevators.textContent = structure.elevators?.length || 0;
  }

  clearGarage() {
    while (this.garageGroup.children.length > 0) {
      this.garageGroup.remove(this.garageGroup.children[0]);
    }
    this.floorMeshes.clear();
    this.slotMeshes.clear();
    this.elevatorMeshes.clear();
    this.labels = [];
  }

  clearAll() {
    this.clearGarage();
    while (this.carsGroup.children.length > 0) {
      this.carsGroup.remove(this.carsGroup.children[0]);
    }
    this.carMeshes.clear();
    this.clearTrajectories();
    this.clearHighlights();
  }

  onResize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  render() {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
