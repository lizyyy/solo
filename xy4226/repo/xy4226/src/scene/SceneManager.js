import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

class SceneManager {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.animationId = null;
    this.vehicle = null;
    this.levelObjects = [];
    this.containerId = 'canvas-container';
  }

  async init() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB);
    this.scene.fog = new THREE.Fog(0x87CEEB, 50, 200);

    this.setupCamera();
    this.setupRenderer();
    this.setupLights();
    this.setupControls();
    this.createGround();
    this.createGrid();

    window.addEventListener('resize', this.onWindowResize.bind(this), false);
    
    console.log('场景管理器初始化完成');
  }

  setupCamera() {
    const container = document.getElementById(this.containerId);
    const aspect = container.clientWidth / container.clientHeight;
    
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
    this.camera.position.set(30, 25, 30);
    this.camera.lookAt(0, 0, 0);
  }

  setupRenderer() {
    const container = document.getElementById(this.containerId);
    
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    
    container.appendChild(this.renderer.domElement);
  }

  setupLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
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

    const hemisphereLight = new THREE.HemisphereLight(0x87CEEB, 0x3d5c5c, 0.3);
    this.scene.add(hemisphereLight);
  }

  setupControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.screenSpacePanning = true;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 150;
    this.controls.maxPolarAngle = Math.PI / 2.1;
    this.controls.target.set(0, 2, 0);
  }

  createGround() {
    const groundGeometry = new THREE.PlaneGeometry(200, 200);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a4a4a,
      roughness: 0.9,
      metalness: 0.1
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.name = 'ground';
    this.scene.add(ground);
  }

  createGrid() {
    const gridHelper = new THREE.GridHelper(200, 100, 0x333333, 0x222222);
    gridHelper.position.y = 0.01;
    this.scene.add(gridHelper);
  }

  buildLevel(levelData) {
    this.clearLevel();
    
    if (levelData.racks) {
      levelData.racks.forEach(rack => this.createRack(rack));
    }
    
    if (levelData.pedestrianZones) {
      levelData.pedestrianZones.forEach(zone => this.createPedestrianZone(zone));
    }
    
    if (levelData.speedLimitZones) {
      levelData.speedLimitZones.forEach(zone => this.createSpeedLimitZone(zone));
    }
    
    if (levelData.loadingDocks) {
      levelData.loadingDocks.forEach(dock => this.createLoadingDock(dock));
    }
    
    if (levelData.pallets) {
      levelData.pallets.forEach(pallet => this.createPallet(pallet));
    }
    
    if (levelData.obstacles) {
      levelData.obstacles.forEach(obstacle => this.createObstacle(obstacle));
    }
  }

  createRack(rack) {
    const group = new THREE.Group();
    group.name = `rack_${rack.id}`;
    
    const rackMaterial = new THREE.MeshStandardMaterial({
      color: 0x8B4513,
      roughness: 0.7,
      metalness: 0.2
    });
    
    const beamMaterial = new THREE.MeshStandardMaterial({
      color: 0xC0C0C0,
      roughness: 0.3,
      metalness: 0.8
    });

    const uprightWidth = 0.3;
    const uprightHeight = rack.height || 8;
    const uprightDepth = 0.3;
    
    const uprightGeometry = new THREE.BoxGeometry(uprightWidth, uprightHeight, uprightDepth);
    
    const positions = [
      { x: -rack.width / 2 + uprightWidth / 2, z: -rack.depth / 2 + uprightDepth / 2 },
      { x: rack.width / 2 - uprightWidth / 2, z: -rack.depth / 2 + uprightDepth / 2 },
      { x: -rack.width / 2 + uprightWidth / 2, z: rack.depth / 2 - uprightDepth / 2 },
      { x: rack.width / 2 - uprightWidth / 2, z: rack.depth / 2 - uprightDepth / 2 }
    ];
    
    positions.forEach(pos => {
      const upright = new THREE.Mesh(uprightGeometry, beamMaterial);
      upright.position.set(pos.x, uprightHeight / 2, pos.z);
      upright.castShadow = true;
      upright.receiveShadow = true;
      group.add(upright);
    });

    const beamGeometry = new THREE.BoxGeometry(rack.width, 0.3, 0.3);
    const beamCount = Math.floor(uprightHeight / 2);
    
    for (let i = 1; i < beamCount; i++) {
      const beamY = i * 2;
      
      const frontBeam = new THREE.Mesh(beamGeometry, beamMaterial);
      frontBeam.position.set(0, beamY, -rack.depth / 2 + uprightDepth / 2);
      frontBeam.castShadow = true;
      frontBeam.receiveShadow = true;
      group.add(frontBeam);
      
      const backBeam = new THREE.Mesh(beamGeometry, beamMaterial);
      backBeam.position.set(0, beamY, rack.depth / 2 - uprightDepth / 2);
      backBeam.castShadow = true;
      backBeam.receiveShadow = true;
      group.add(backBeam);
      
      const shelfGeometry = new THREE.BoxGeometry(rack.width - 0.5, 0.1, rack.depth - 0.5);
      const shelfMaterial = new THREE.MeshStandardMaterial({
        color: 0x654321,
        roughness: 0.8,
        metalness: 0.1
      });
      const shelf = new THREE.Mesh(shelfGeometry, shelfMaterial);
      shelf.position.set(0, beamY - 0.1, 0);
      shelf.receiveShadow = true;
      shelf.castShadow = true;
      group.add(shelf);
    }

    group.position.set(rack.position.x, rack.position.y || 0, rack.position.z);
    group.rotation.y = rack.rotation || 0;
    
    this.scene.add(group);
    this.levelObjects.push(group);
  }

  createPedestrianZone(zone) {
    const group = new THREE.Group();
    group.name = `pedestrianZone_${zone.id}`;
    
    const zoneGeometry = new THREE.BoxGeometry(zone.width, 0.1, zone.depth);
    const zoneMaterial = new THREE.MeshStandardMaterial({
      color: 0xFFFF00,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide
    });
    
    const zoneMesh = new THREE.Mesh(zoneGeometry, zoneMaterial);
    zoneMesh.position.set(0, 0.05, 0);
    zoneMesh.receiveShadow = true;
    group.add(zoneMesh);
    
    const borderGeometry = new THREE.EdgesGeometry(zoneGeometry);
    const borderMaterial = new THREE.LineBasicMaterial({ color: 0xFFFF00, linewidth: 2 });
    const border = new THREE.LineSegments(borderGeometry, borderMaterial);
    border.position.copy(zoneMesh.position);
    group.add(border);
    
    const signGeometry = new THREE.BoxGeometry(1, 1.5, 0.1);
    const signMaterial = new THREE.MeshStandardMaterial({
      color: 0xFFFF00,
      roughness: 0.5
    });
    const sign = new THREE.Mesh(signGeometry, signMaterial);
    sign.position.set(zone.width / 2 - 0.5, 1.5, zone.depth / 2 - 0.5);
    sign.castShadow = true;
    group.add(sign);
    
    const poleGeometry = new THREE.CylinderGeometry(0.05, 0.05, 2, 8);
    const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 });
    const pole = new THREE.Mesh(poleGeometry, poleMaterial);
    pole.position.set(sign.position.x, 1, sign.position.z);
    pole.castShadow = true;
    group.add(pole);

    group.position.set(zone.position.x, zone.position.y || 0, zone.position.z);
    group.userData = { type: 'pedestrianZone', ...zone };
    
    this.scene.add(group);
    this.levelObjects.push(group);
  }

  createSpeedLimitZone(zone) {
    const group = new THREE.Group();
    group.name = `speedLimitZone_${zone.id}`;
    
    const zoneGeometry = new THREE.BoxGeometry(zone.width, 0.1, zone.depth);
    const zoneMaterial = new THREE.MeshStandardMaterial({
      color: 0xFF0000,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide
    });
    
    const zoneMesh = new THREE.Mesh(zoneGeometry, zoneMaterial);
    zoneMesh.position.set(0, 0.05, 0);
    zoneMesh.receiveShadow = true;
    group.add(zoneMesh);
    
    const borderGeometry = new THREE.EdgesGeometry(zoneGeometry);
    const borderMaterial = new THREE.LineBasicMaterial({ color: 0xFF0000, linewidth: 2 });
    const border = new THREE.LineSegments(borderGeometry, borderMaterial);
    border.position.copy(zoneMesh.position);
    group.add(border);
    
    const signGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 32);
    const signMaterial = new THREE.MeshStandardMaterial({
      color: 0xFF0000,
      roughness: 0.5
    });
    const sign = new THREE.Mesh(signGeometry, signMaterial);
    sign.rotation.x = Math.PI / 2;
    sign.position.set(zone.width / 2 - 1, 2, zone.depth / 2 - 1);
    sign.castShadow = true;
    group.add(sign);
    
    const poleGeometry = new THREE.CylinderGeometry(0.05, 0.05, 2.5, 8);
    const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 });
    const pole = new THREE.Mesh(poleGeometry, poleMaterial);
    pole.position.set(sign.position.x, 1, sign.position.z);
    pole.castShadow = true;
    group.add(pole);

    group.position.set(zone.position.x, zone.position.y || 0, zone.position.z);
    group.userData = { type: 'speedLimitZone', ...zone };
    
    this.scene.add(group);
    this.levelObjects.push(group);
  }

  createLoadingDock(dock) {
    const group = new THREE.Group();
    group.name = `loadingDock_${dock.id}`;
    
    const dockGeometry = new THREE.BoxGeometry(dock.width, 1.2, dock.depth);
    const dockMaterial = new THREE.MeshStandardMaterial({
      color: 0x696969,
      roughness: 0.7,
      metalness: 0.3
    });
    const dockMesh = new THREE.Mesh(dockGeometry, dockMaterial);
    dockMesh.position.set(0, 0.6, 0);
    dockMesh.castShadow = true;
    dockMesh.receiveShadow = true;
    group.add(dockMesh);
    
    const rampGeometry = new THREE.BoxGeometry(dock.width - 0.5, 0.3, dock.depth * 0.6);
    const rampMaterial = new THREE.MeshStandardMaterial({
      color: 0x808080,
      roughness: 0.6,
      metalness: 0.4
    });
    const ramp = new THREE.Mesh(rampGeometry, rampMaterial);
    ramp.position.set(0, 0.15, dock.depth * 0.5);
    ramp.rotation.x = -Math.PI / 20;
    ramp.castShadow = true;
    ramp.receiveShadow = true;
    group.add(ramp);
    
    const bumperGeometry = new THREE.BoxGeometry(0.3, 0.5, dock.width);
    const bumperMaterial = new THREE.MeshStandardMaterial({
      color: 0x000000,
      roughness: 0.9
    });
    const bumper = new THREE.Mesh(bumperGeometry, bumperMaterial);
    bumper.position.set(0, 0.85, -dock.depth / 2);
    bumper.rotation.y = Math.PI / 2;
    bumper.castShadow = true;
    group.add(bumper);

    group.position.set(dock.position.x, dock.position.y || 0, dock.position.z);
    group.rotation.y = dock.rotation || 0;
    group.userData = { type: 'loadingDock', ...dock };
    
    this.scene.add(group);
    this.levelObjects.push(group);
  }

  createPallet(pallet) {
    const group = new THREE.Group();
    group.name = `pallet_${pallet.id}`;
    
    const palletGeometry = new THREE.BoxGeometry(1.2, 0.15, 1.0);
    const palletMaterial = new THREE.MeshStandardMaterial({
      color: 0x8B4513,
      roughness: 0.8,
      metalness: 0.1
    });
    const palletMesh = new THREE.Mesh(palletGeometry, palletMaterial);
    palletMesh.position.set(0, 0.075, 0);
    palletMesh.castShadow = true;
    palletMesh.receiveShadow = true;
    group.add(palletMesh);
    
    if (pallet.hasCargo) {
      const cargoHeight = pallet.cargoHeight || 1.5;
      const cargoGeometry = new THREE.BoxGeometry(1.1, cargoHeight, 0.9);
      const cargoMaterial = new THREE.MeshStandardMaterial({
        color: pallet.cargoColor || 0x4169E1,
        roughness: 0.5,
        metalness: 0.3
      });
      const cargo = new THREE.Mesh(cargoGeometry, cargoMaterial);
      cargo.position.set(0, 0.075 + cargoHeight / 2, 0);
      cargo.castShadow = true;
      cargo.receiveShadow = true;
      group.add(cargo);
    }

    group.position.set(pallet.position.x, pallet.position.y || 0, pallet.position.z);
    group.rotation.y = pallet.rotation || 0;
    group.userData = { type: 'pallet', ...pallet };
    
    this.scene.add(group);
    this.levelObjects.push(group);
  }

  createObstacle(obstacle) {
    const group = new THREE.Group();
    group.name = `obstacle_${obstacle.id}`;
    
    let geometry, material;
    
    switch (obstacle.type) {
      case 'box':
        geometry = new THREE.BoxGeometry(obstacle.width, obstacle.height, obstacle.depth);
        material = new THREE.MeshStandardMaterial({
          color: obstacle.color || 0x8B0000,
          roughness: 0.7,
          metalness: 0.2
        });
        break;
      case 'cylinder':
        geometry = new THREE.CylinderGeometry(obstacle.radius, obstacle.radius, obstacle.height, 16);
        material = new THREE.MeshStandardMaterial({
          color: obstacle.color || 0x006400,
          roughness: 0.6,
          metalness: 0.3
        });
        break;
      default:
        geometry = new THREE.BoxGeometry(1, 1, 1);
        material = new THREE.MeshStandardMaterial({ color: 0x808080 });
    }
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    group.position.set(obstacle.position.x, obstacle.position.y || 0, obstacle.position.z);
    group.rotation.y = obstacle.rotation || 0;
    group.userData = { type: 'obstacle', ...obstacle };
    
    this.scene.add(group);
    this.levelObjects.push(group);
  }

  addVehicle(vehicle) {
    this.vehicle = vehicle;
    this.scene.add(vehicle.mesh);
  }

  clearLevel() {
    this.levelObjects.forEach(obj => {
      this.scene.remove(obj);
      if (obj.traverse) {
        obj.traverse(child => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(m => m.dispose());
            } else {
              child.material.dispose();
            }
          }
        });
      }
    });
    this.levelObjects = [];
  }

  startAnimation(updateCallback) {
    const animate = () => {
      this.animationId = requestAnimationFrame(animate);
      
      this.controls.update();
      
      if (updateCallback) {
        updateCallback(1/60);
      }
      
      if (this.vehicle && this.camera) {
        const vehiclePos = this.vehicle.mesh.position;
        const offset = new THREE.Vector3(0, 15, 20);
        offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.vehicle.mesh.rotation.y);
        
        const targetCamPos = vehiclePos.clone().add(offset);
        this.camera.position.lerp(targetCamPos, 0.05);
        
        const lookAtTarget = vehiclePos.clone().add(new THREE.Vector3(0, 2, 0));
        this.controls.target.lerp(lookAtTarget, 0.1);
      }
      
      this.renderer.render(this.scene, this.camera);
    };
    
    animate();
  }

  stopAnimation() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  onWindowResize() {
    const container = document.getElementById(this.containerId);
    this.camera.aspect = container.clientWidth / container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(container.clientWidth, container.clientHeight);
  }

  dispose() {
    this.stopAnimation();
    this.clearLevel();
    
    if (this.vehicle) {
      this.vehicle.dispose();
    }
    
    if (this.renderer) {
      this.renderer.dispose();
    }
  }
}

export default SceneManager;
