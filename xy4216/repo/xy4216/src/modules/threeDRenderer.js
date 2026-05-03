import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class ThreeDRenderer {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.clock = null;
    
    this.warehouse = null;
    this.forklift = null;
    this.pedestrian = null;
    this.forkliftTrajectory = null;
    this.pedestrianTrajectory = null;
    this.dangerZone = null;
    this.riskZone = null;
    
    this.racks = [];
    this.obstacles = [];
    
    this.data = {
      forklift: null,
      pedestrian: null,
      warehouse: null,
      riskPoints: []
    };
    
    this.currentView = 'free';
    this.viewPositions = {
      top: { position: new THREE.Vector3(0, 40, 0.1), target: new THREE.Vector3(0, 0, 0) },
      side: { position: new THREE.Vector3(0, 10, 50), target: new THREE.Vector3(0, 0, 0) },
      front: { position: new THREE.Vector3(50, 10, 0), target: new THREE.Vector3(0, 0, 0) },
      free: { position: new THREE.Vector3(25, 20, 25), target: new THREE.Vector3(0, 0, 0) }
    };
    
    this.animationCallbacks = [];
    this.isInitialized = false;
  }

  init() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a15);
    this.scene.fog = new THREE.Fog(0x0a0a15, 30, 100);

    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    
    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    this.camera.position.set(25, 20, 25);
    
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true 
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(window.devicePixelRatio);
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
    
    this.clock = new THREE.Clock();
    this._setupLights();
    this._createGrid();
    this._createDefaultWarehouse();
    this._createForklift();
    this._createPedestrian();
    this._createDangerZones();
    
    window.addEventListener('resize', () => this._onWindowResize());
    
    this.isInitialized = true;
    this.animate();
  }

  _setupLights() {
    const ambientLight = new THREE.AmbientLight(0x404060, 0.5);
    this.scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(20, 30, 20);
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
    
    const fillLight = new THREE.DirectionalLight(0x6060a0, 0.3);
    fillLight.position.set(-20, 10, -20);
    this.scene.add(fillLight);
  }

  _createGrid() {
    const gridHelper = new THREE.GridHelper(100, 100, 0x333366, 0x1a1a33);
    gridHelper.position.y = 0.01;
    this.scene.add(gridHelper);
  }

  _createDefaultWarehouse() {
    const defaultWarehouse = {
      name: '默认仓库',
      dimensions: { width: 50, depth: 30, height: 6 },
      racks: [],
      obstacles: [],
      safeZones: []
    };
    this._buildWarehouse(defaultWarehouse);
  }

  _buildWarehouse(warehouseData) {
    if (this.warehouse) {
      this.scene.remove(this.warehouse);
      this.racks.forEach(rack => this.scene.remove(rack));
      this.obstacles.forEach(obstacle => this.scene.remove(obstacle));
    }
    
    this.racks = [];
    this.obstacles = [];
    
    this.warehouse = new THREE.Group();
    
    const floorGeometry = new THREE.PlaneGeometry(
      warehouseData.dimensions.width,
      warehouseData.dimensions.depth
    );
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0x2a2a4a,
      roughness: 0.9,
      metalness: 0.1
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(
      warehouseData.dimensions.width / 2,
      0,
      warehouseData.dimensions.depth / 2
    );
    floor.receiveShadow = true;
    this.warehouse.add(floor);
    
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0x404060,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide
    });
    
    const wallHeight = warehouseData.dimensions.height;
    
    const backWall = new THREE.Mesh(
      new THREE.PlaneGeometry(warehouseData.dimensions.width, wallHeight),
      wallMaterial
    );
    backWall.position.set(
      warehouseData.dimensions.width / 2,
      wallHeight / 2,
      0
    );
    this.warehouse.add(backWall);
    
    const frontWall = new THREE.Mesh(
      new THREE.PlaneGeometry(warehouseData.dimensions.width, wallHeight),
      wallMaterial
    );
    frontWall.position.set(
      warehouseData.dimensions.width / 2,
      wallHeight / 2,
      warehouseData.dimensions.depth
    );
    frontWall.rotation.y = Math.PI;
    this.warehouse.add(frontWall);
    
    const leftWall = new THREE.Mesh(
      new THREE.PlaneGeometry(warehouseData.dimensions.depth, wallHeight),
      wallMaterial
    );
    leftWall.position.set(
      0,
      wallHeight / 2,
      warehouseData.dimensions.depth / 2
    );
    leftWall.rotation.y = Math.PI / 2;
    this.warehouse.add(leftWall);
    
    const rightWall = new THREE.Mesh(
      new THREE.PlaneGeometry(warehouseData.dimensions.depth, wallHeight),
      wallMaterial
    );
    rightWall.position.set(
      warehouseData.dimensions.width,
      wallHeight / 2,
      warehouseData.dimensions.depth / 2
    );
    rightWall.rotation.y = -Math.PI / 2;
    this.warehouse.add(rightWall);
    
    warehouseData.racks.forEach(rackData => {
      const rack = this._createRack(rackData);
      this.racks.push(rack);
      this.warehouse.add(rack);
    });
    
    warehouseData.obstacles.forEach(obstacleData => {
      const obstacle = this._createObstacle(obstacleData);
      this.obstacles.push(obstacle);
      this.warehouse.add(obstacle);
    });
    
    this.scene.add(this.warehouse);
  }

  _createRack(rackData) {
    const rackGroup = new THREE.Group();
    
    const rackMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(rackData.color || 0x4a6fa5),
      roughness: 0.7,
      metalness: 0.3
    });
    
    const frameMaterial = new THREE.MeshStandardMaterial({
      color: 0x666666,
      roughness: 0.5,
      metalness: 0.5
    });
    
    const uprightWidth = 0.1;
    const uprightGeometry = new THREE.BoxGeometry(
      uprightWidth,
      rackData.dimensions.height,
      uprightWidth
    );
    
    const positions = [
      { x: -rackData.dimensions.width / 2 + uprightWidth / 2, z: -rackData.dimensions.depth / 2 + uprightWidth / 2 },
      { x: rackData.dimensions.width / 2 - uprightWidth / 2, z: -rackData.dimensions.depth / 2 + uprightWidth / 2 },
      { x: -rackData.dimensions.width / 2 + uprightWidth / 2, z: rackData.dimensions.depth / 2 - uprightWidth / 2 },
      { x: rackData.dimensions.width / 2 - uprightWidth / 2, z: rackData.dimensions.depth / 2 - uprightWidth / 2 }
    ];
    
    positions.forEach(pos => {
      const upright = new THREE.Mesh(uprightGeometry, frameMaterial);
      upright.position.set(pos.x, rackData.dimensions.height / 2, pos.z);
      upright.castShadow = true;
      upright.receiveShadow = true;
      rackGroup.add(upright);
    });
    
    const levels = rackData.levels || 5;
    const levelSpacing = rackData.dimensions.height / (levels + 1);
    
    for (let i = 1; i <= levels; i++) {
      const shelfGeometry = new THREE.BoxGeometry(
        rackData.dimensions.width - 0.1,
        0.05,
        rackData.dimensions.depth - 0.1
      );
      const shelf = new THREE.Mesh(shelfGeometry, rackMaterial);
      shelf.position.y = levelSpacing * i;
      shelf.castShadow = true;
      shelf.receiveShadow = true;
      rackGroup.add(shelf);
    }
    
    rackGroup.position.set(
      rackData.position.x + rackData.dimensions.width / 2,
      rackData.position.y,
      rackData.position.z + rackData.dimensions.depth / 2
    );
    
    return rackGroup;
  }

  _createObstacle(obstacleData) {
    const obstacleGroup = new THREE.Group();
    
    let color;
    switch (obstacleData.type) {
      case 'pillar':
        color = 0x888888;
        break;
      case 'wall':
        color = 0x666666;
        break;
      case 'machine':
        color = 0xaa8844;
        break;
      default:
        color = 0x555555;
    }
    
    const material = new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.6,
      metalness: 0.2
    });
    
    const geometry = new THREE.BoxGeometry(
      obstacleData.dimensions.width,
      obstacleData.dimensions.height,
      obstacleData.dimensions.depth
    );
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(
      obstacleData.position.x + obstacleData.dimensions.width / 2,
      obstacleData.position.y + obstacleData.dimensions.height / 2,
      obstacleData.position.z + obstacleData.dimensions.depth / 2
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    obstacleGroup.add(mesh);
    
    return obstacleGroup;
  }

  _createForklift() {
    if (this.forklift) {
      this.scene.remove(this.forklift);
    }
    
    this.forklift = new THREE.Group();
    
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0xff6600,
      roughness: 0.5,
      metalness: 0.5
    });
    
    const wheelMaterial = new THREE.MeshStandardMaterial({
      color: 0x222222,
      roughness: 0.9,
      metalness: 0.1
    });
    
    const bodyGeometry = new THREE.BoxGeometry(2.5, 1.5, 1.2);
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.75;
    body.castShadow = true;
    this.forklift.add(body);
    
    const cabinGeometry = new THREE.BoxGeometry(1.0, 1.2, 1.0);
    const cabinMaterial = new THREE.MeshStandardMaterial({
      color: 0x444444,
      transparent: true,
      opacity: 0.7
    });
    const cabin = new THREE.Mesh(cabinGeometry, cabinMaterial);
    cabin.position.set(-0.5, 1.85, 0);
    cabin.castShadow = true;
    this.forklift.add(cabin);
    
    const mastGeometry = new THREE.BoxGeometry(0.1, 2.5, 1.0);
    const mast = new THREE.Mesh(mastGeometry, bodyMaterial);
    mast.position.set(1.25, 1.25, 0);
    mast.castShadow = true;
    this.forklift.add(mast);
    
    const forkGeometry = new THREE.BoxGeometry(0.8, 0.1, 0.08);
    const forkMaterial = new THREE.MeshStandardMaterial({
      color: 0x888888,
      metalness: 0.8,
      roughness: 0.2
    });
    
    const fork1 = new THREE.Mesh(forkGeometry, forkMaterial);
    fork1.position.set(1.65, 0.15, -0.3);
    fork1.castShadow = true;
    this.forklift.add(fork1);
    
    const fork2 = new THREE.Mesh(forkGeometry, forkMaterial);
    fork2.position.set(1.65, 0.15, 0.3);
    fork2.castShadow = true;
    this.forklift.add(fork2);
    
    const wheelGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 16);
    wheelGeometry.rotateZ(Math.PI / 2);
    
    const wheelPositions = [
      { x: -0.8, z: -0.5 },
      { x: -0.8, z: 0.5 },
      { x: 0.8, z: -0.5 },
      { x: 0.8, z: 0.5 }
    ];
    
    wheelPositions.forEach(pos => {
      const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
      wheel.position.set(pos.x, 0.4, pos.z);
      wheel.castShadow = true;
      this.forklift.add(wheel);
    });
    
    const lightGeometry = new THREE.SphereGeometry(0.1, 16, 16);
    const lightMaterial = new THREE.MeshBasicMaterial({ color: 0xffffaa });
    const headlight1 = new THREE.Mesh(lightGeometry, lightMaterial);
    headlight1.position.set(1.25, 0.8, -0.4);
    this.forklift.add(headlight1);
    
    const headlight2 = new THREE.Mesh(lightGeometry, lightMaterial);
    headlight2.position.set(1.25, 0.8, 0.4);
    this.forklift.add(headlight2);
    
    this.forklift.position.set(5, 0, 5);
    this.scene.add(this.forklift);
  }

  _createPedestrian() {
    if (this.pedestrian) {
      this.scene.remove(this.pedestrian);
    }
    
    this.pedestrian = new THREE.Group();
    
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x00aa00,
      roughness: 0.7
    });
    
    const safetyVestMaterial = new THREE.MeshStandardMaterial({
      color: 0xffcc00,
      roughness: 0.6,
      emissive: 0xffaa00,
      emissiveIntensity: 0.3
    });
    
    const headGeometry = new THREE.SphereGeometry(0.25, 16, 16);
    const head = new THREE.Mesh(headGeometry, bodyMaterial);
    head.position.y = 1.6;
    head.castShadow = true;
    this.pedestrian.add(head);
    
    const torsoGeometry = new THREE.CapsuleGeometry(0.25, 0.5, 8, 16);
    const torso = new THREE.Mesh(torsoGeometry, bodyMaterial);
    torso.position.y = 1.1;
    torso.castShadow = true;
    this.pedestrian.add(torso);
    
    const vestGeometry = new THREE.CylinderGeometry(0.3, 0.28, 0.5, 16);
    const vest = new THREE.Mesh(vestGeometry, safetyVestMaterial);
    vest.position.y = 1.1;
    vest.castShadow = true;
    this.pedestrian.add(vest);
    
    const legGeometry = new THREE.CylinderGeometry(0.12, 0.12, 0.6, 8);
    const legMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.8
    });
    
    const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
    leftLeg.position.set(-0.12, 0.3, 0);
    leftLeg.castShadow = true;
    this.pedestrian.add(leftLeg);
    
    const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
    rightLeg.position.set(0.12, 0.3, 0);
    rightLeg.castShadow = true;
    this.pedestrian.add(rightLeg);
    
    const hardHatGeometry = new THREE.SphereGeometry(0.28, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const hardHatMaterial = new THREE.MeshStandardMaterial({
      color: 0xff6600,
      roughness: 0.4,
      metalness: 0.2
    });
    const hardHat = new THREE.Mesh(hardHatGeometry, hardHatMaterial);
    hardHat.position.y = 1.75;
    hardHat.castShadow = true;
    this.pedestrian.add(hardHat);
    
    this.pedestrian.position.set(10, 0, 10);
    this.scene.add(this.pedestrian);
  }

  _createDangerZones() {
    const dangerZoneGeometry = new THREE.RingGeometry(0, 1.5, 32);
    const dangerZoneMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide
    });
    this.dangerZone = new THREE.Mesh(dangerZoneGeometry, dangerZoneMaterial);
    this.dangerZone.rotation.x = -Math.PI / 2;
    this.dangerZone.position.y = 0.02;
    this.dangerZone.visible = false;
    this.scene.add(this.dangerZone);
    
    const riskZoneGeometry = new THREE.RingGeometry(1.5, 3.0, 32);
    const riskZoneMaterial = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide
    });
    this.riskZone = new THREE.Mesh(riskZoneGeometry, riskZoneMaterial);
    this.riskZone.rotation.x = -Math.PI / 2;
    this.riskZone.position.y = 0.015;
    this.riskZone.visible = false;
    this.scene.add(this.riskZone);
  }

  _createTrajectories() {
    if (this.forkliftTrajectory) {
      this.scene.remove(this.forkliftTrajectory);
    }
    if (this.pedestrianTrajectory) {
      this.scene.remove(this.pedestrianTrajectory);
    }
    
    if (this.data.forklift && this.data.forklift.length > 0) {
      const forkliftPoints = this.data.forklift.map(p => 
        new THREE.Vector3(p.x, 0.05, p.z)
      );
      const forkliftCurve = new THREE.CatmullRomCurve3(forkliftPoints);
      const forkliftGeometry = new THREE.TubeGeometry(forkliftCurve, 100, 0.08, 8, false);
      const forkliftMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xff6600,
        transparent: true,
        opacity: 0.6
      });
      this.forkliftTrajectory = new THREE.Mesh(forkliftGeometry, forkliftMaterial);
      this.scene.add(this.forkliftTrajectory);
    }
    
    if (this.data.pedestrian && this.data.pedestrian.length > 0) {
      const pedestrianPoints = this.data.pedestrian.map(p => 
        new THREE.Vector3(p.x, 0.05, p.z)
      );
      const pedestrianCurve = new THREE.CatmullRomCurve3(pedestrianPoints);
      const pedestrianGeometry = new THREE.TubeGeometry(pedestrianCurve, 100, 0.06, 8, false);
      const pedestrianMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x00aa00,
        transparent: true,
        opacity: 0.6
      });
      this.pedestrianTrajectory = new THREE.Mesh(pedestrianGeometry, pedestrianMaterial);
      this.scene.add(this.pedestrianTrajectory);
    }
  }

  setData(data) {
    this.data = {
      forklift: data.forklift,
      pedestrian: data.pedestrian,
      warehouse: data.warehouse,
      riskPoints: data.riskPoints || []
    };
    
    if (this.data.warehouse) {
      this._buildWarehouse(this.data.warehouse);
    }
    
    this._createTrajectories();
  }

  updatePositions(forkliftPoint, pedestrianPoint) {
    if (forkliftPoint && this.forklift) {
      this.forklift.position.set(forkliftPoint.x, 0, forkliftPoint.z);
      if (forkliftPoint.heading !== undefined) {
        this.forklift.rotation.y = -forkliftPoint.heading;
      }
    }
    
    if (pedestrianPoint && this.pedestrian) {
      this.pedestrian.position.set(pedestrianPoint.x, 0, pedestrianPoint.z);
    }
    
    if (forkliftPoint && pedestrianPoint) {
      const distance = Math.sqrt(
        Math.pow(forkliftPoint.x - pedestrianPoint.x, 2) +
        Math.pow(forkliftPoint.z - pedestrianPoint.z, 2)
      );
      
      if (distance <= 3.0) {
        this.riskZone.visible = true;
        this.riskZone.position.set(forkliftPoint.x, 0.015, forkliftPoint.z);
        
        if (distance <= 1.5) {
          this.dangerZone.visible = true;
          this.dangerZone.position.set(forkliftPoint.x, 0.02, forkliftPoint.z);
        } else {
          this.dangerZone.visible = false;
        }
      } else {
        this.riskZone.visible = false;
        this.dangerZone.visible = false;
      }
    }
  }

  setView(viewName) {
    if (!this.viewPositions[viewName]) return;
    
    this.currentView = viewName;
    const view = this.viewPositions[viewName];
    
    if (viewName === 'free') {
      this.controls.enabled = true;
    } else {
      this.controls.enabled = false;
      this.camera.position.copy(view.position);
      this.controls.target.copy(view.target);
      this.controls.update();
    }
  }

  highlightRiskPoint(riskPoint) {
    if (riskPoint && riskPoint.forkliftPositions && riskPoint.forkliftPositions.start) {
      const midX = (riskPoint.forkliftPositions.start.x + riskPoint.pedestrianPositions.start.x) / 2;
      const midZ = (riskPoint.forkliftPositions.start.z + riskPoint.pedestrianPositions.start.z) / 2;
      
      if (this.currentView !== 'free') {
        this.camera.position.set(midX + 10, 15, midZ + 10);
        this.controls.target.set(midX, 0, midZ);
        this.controls.update();
      }
    }
  }

  addAnimationCallback(callback) {
    this.animationCallbacks.push(callback);
  }

  animate() {
    if (!this.isInitialized) return;
    
    requestAnimationFrame(() => this.animate());
    
    const delta = this.clock.getDelta();
    
    this.animationCallbacks.forEach(callback => callback(delta));
    
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  _onWindowResize() {
    if (!this.camera || !this.renderer) return;
    
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    
    this.renderer.setSize(width, height);
  }

  dispose() {
    window.removeEventListener('resize', () => this._onWindowResize());
    
    if (this.renderer) {
      this.renderer.dispose();
      if (this.container && this.renderer.domElement) {
        this.container.removeChild(this.renderer.domElement);
      }
    }
    
    this.isInitialized = false;
  }
}

export default ThreeDRenderer;
