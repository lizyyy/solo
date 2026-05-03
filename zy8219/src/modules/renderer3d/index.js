import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class Renderer3D {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    
    this.warehouseGroup = null;
    this.forkliftGroup = null;
    this.pedestrianGroup = null;
    this.riskGroup = null;
    this.trajectoryLine = null;
    
    this.trajectoryData = [];
    this.pedestrianEvents = [];
    this.risks = [];
    this.rules = null;
    
    this.isPlaying = false;
    this.currentTimestamp = 0;
    this.startTimestamp = 0;
    this.endTimestamp = 0;
    this.playbackSpeed = 1.0;
    this.lastFrameTime = 0;
    
    this.onTimeUpdate = null;
    this.onRiskHighlight = null;
    
    this.init();
  }

  init() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);

    const aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
    this.camera.position.set(30, 25, 30);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;

    this.setupLighting();
    this.createGroups();
    this.createGround();

    window.addEventListener('resize', () => this.onWindowResize());
    this.animate();
  }

  setupLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(20, 30, 20);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    this.scene.add(directionalLight);

    const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.3);
    this.scene.add(hemisphereLight);
  }

  createGroups() {
    this.warehouseGroup = new THREE.Group();
    this.scene.add(this.warehouseGroup);

    this.forkliftGroup = new THREE.Group();
    this.scene.add(this.forkliftGroup);

    this.pedestrianGroup = new THREE.Group();
    this.scene.add(this.pedestrianGroup);

    this.riskGroup = new THREE.Group();
    this.scene.add(this.riskGroup);
  }

  createGround() {
    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x2d3436,
      roughness: 0.8
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const gridHelper = new THREE.GridHelper(100, 20, 0x636e72, 0x2d3436);
    this.scene.add(gridHelper);
  }

  loadWarehouseLayout(layout) {
    this.clearGroup(this.warehouseGroup);

    if (layout.dimensions) {
      const { width, height, depth } = layout.dimensions;
      const wallMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x636e72,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide
      });

      const floorGeometry = new THREE.PlaneGeometry(width, depth);
      const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x4a4a4a });
      const floor = new THREE.Mesh(floorGeometry, floorMaterial);
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(width / 2, 0, depth / 2);
      floor.receiveShadow = true;
      this.warehouseGroup.add(floor);
    }

    if (layout.racks && Array.isArray(layout.racks)) {
      layout.racks.forEach(rack => {
        this.createRack(rack);
      });
    }

    if (layout.aisles && Array.isArray(layout.aisles)) {
      layout.aisles.forEach(aisle => {
        this.createAisleIndicator(aisle);
      });
    }
  }

  createRack(rack) {
    const rackGroup = new THREE.Group();
    
    const position = rack.position || { x: 0, z: 0 };
    const dimensions = rack.dimensions || { width: 2, height: 4, depth: 1 };
    
    const rackMaterial = new THREE.MeshStandardMaterial({ 
      color: rack.color || 0x74b9ff,
      metalness: 0.3,
      roughness: 0.7
    });

    const frameWidth = 0.1;
    
    const leftPostGeometry = new THREE.BoxGeometry(frameWidth, dimensions.height, frameWidth);
    const leftPost = new THREE.Mesh(leftPostGeometry, rackMaterial);
    leftPost.position.set(-dimensions.width / 2 + frameWidth / 2, dimensions.height / 2, 0);
    leftPost.castShadow = true;
    rackGroup.add(leftPost);

    const rightPostGeometry = new THREE.BoxGeometry(frameWidth, dimensions.height, frameWidth);
    const rightPost = new THREE.Mesh(rightPostGeometry, rackMaterial);
    rightPost.position.set(dimensions.width / 2 - frameWidth / 2, dimensions.height / 2, 0);
    rightPost.castShadow = true;
    rackGroup.add(rightPost);

    const shelfLevels = rack.levels || 4;
    for (let i = 0; i < shelfLevels; i++) {
      const shelfY = (i + 1) * (dimensions.height / shelfLevels);
      const shelfGeometry = new THREE.BoxGeometry(dimensions.width, 0.05, dimensions.depth);
      const shelf = new THREE.Mesh(shelfGeometry, rackMaterial);
      shelf.position.set(0, shelfY, 0);
      shelf.castShadow = true;
      rackGroup.add(shelf);
    }

    rackGroup.position.set(position.x, 0, position.z);
    
    if (rack.rotation) {
      rackGroup.rotation.y = rack.rotation * Math.PI / 180;
    }

    this.warehouseGroup.add(rackGroup);
  }

  createAisleIndicator(aisle) {
    if (!aisle.bounds) return;

    const { minX, maxX, minZ, maxZ } = aisle.bounds;
    const width = maxX - minX;
    const depth = maxZ - minZ;
    const centerX = (minX + maxX) / 2;
    const centerZ = (minZ + maxZ) / 2;

    const aisleMaterial = new THREE.MeshStandardMaterial({
      color: 0x0984e3,
      transparent: true,
      opacity: 0.2
    });

    const aisleGeometry = new THREE.PlaneGeometry(width, depth);
    const aislePlane = new THREE.Mesh(aisleGeometry, aisleMaterial);
    aislePlane.rotation.x = -Math.PI / 2;
    aislePlane.position.set(centerX, 0.01, centerZ);
    this.warehouseGroup.add(aislePlane);

    const edgesGeometry = new THREE.EdgesGeometry(
      new THREE.BoxGeometry(width, 0.1, depth)
    );
    const edgesMaterial = new THREE.LineBasicMaterial({ color: 0x74b9ff, linewidth: 2 });
    const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
    edges.position.set(centerX, 0.05, centerZ);
    this.warehouseGroup.add(edges);
  }

  loadTrajectoryData(trajectoryData) {
    this.trajectoryData = trajectoryData;
    
    if (trajectoryData.length > 0) {
      this.startTimestamp = trajectoryData[0].timestamp;
      this.endTimestamp = trajectoryData[trajectoryData.length - 1].timestamp;
      this.currentTimestamp = this.startTimestamp;
    }

    this.createTrajectoryLine();
    this.createForklift();
  }

  createTrajectoryLine() {
    if (this.trajectoryLine) {
      this.scene.remove(this.trajectoryLine);
    }

    const points = this.trajectoryData
      .filter(p => p.x !== null && p.z !== null)
      .map(p => new THREE.Vector3(p.x, 0.1, p.z));

    if (points.length < 2) return;

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ 
      color: 0xfdcb6e, 
      linewidth: 2,
      opacity: 0.8,
      transparent: true
    });
    
    this.trajectoryLine = new THREE.Line(geometry, material);
    this.scene.add(this.trajectoryLine);
  }

  createForklift() {
    this.clearGroup(this.forkliftGroup);

    const forkliftGroup = new THREE.Group();

    const bodyGeometry = new THREE.BoxGeometry(1.5, 0.8, 2.5);
    const bodyMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xe17055,
      metalness: 0.5,
      roughness: 0.5
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.4;
    body.castShadow = true;
    forkliftGroup.add(body);

    const mastGeometry = new THREE.BoxGeometry(0.2, 2, 0.1);
    const mastMaterial = new THREE.MeshStandardMaterial({ color: 0x636e72 });
    const mast = new THREE.Mesh(mastGeometry, mastMaterial);
    mast.position.set(0, 1, 1.3);
    mast.castShadow = true;
    forkliftGroup.add(mast);

    const forksGeometry = new THREE.BoxGeometry(1, 0.1, 1);
    const forksMaterial = new THREE.MeshStandardMaterial({ color: 0x2d3436 });
    const forks = new THREE.Mesh(forksGeometry, forksMaterial);
    forks.position.set(0, 0.1, 1.8);
    forks.castShadow = true;
    forkliftGroup.add(forks);

    const directionIndicatorGeometry = new THREE.ConeGeometry(0.3, 0.5, 4);
    const directionIndicatorMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x00b894,
      emissive: 0x00b894,
      emissiveIntensity: 0.3
    });
    const directionIndicator = new THREE.Mesh(directionIndicatorGeometry, directionIndicatorMaterial);
    directionIndicator.rotation.x = Math.PI / 2;
    directionIndicator.position.set(0, 1.5, 1.5);
    forkliftGroup.add(directionIndicator);

    this.forkliftGroup.add(forkliftGroup);
  }

  loadPedestrianEvents(events) {
    this.pedestrianEvents = events;
    this.createPedestrians();
  }

  createPedestrians() {
    this.clearGroup(this.pedestrianGroup);

    this.pedestrianEvents.forEach((pedestrian, index) => {
      const pedestrianGroup = new THREE.Group();

      const bodyGeometry = new THREE.CapsuleGeometry(0.2, 1, 4, 8);
      const bodyMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x00cec9,
        transparent: true,
        opacity: 0.8
      });
      const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
      body.position.y = 0.7;
      pedestrianGroup.add(body);

      const headGeometry = new THREE.SphereGeometry(0.15, 8, 8);
      const headMaterial = new THREE.MeshStandardMaterial({ color: 0xffeaa7 });
      const head = new THREE.Mesh(headGeometry, headMaterial);
      head.position.y = 1.5;
      pedestrianGroup.add(head);

      pedestrianGroup.position.set(pedestrian.x, 0, pedestrian.z);
      pedestrianGroup.userData = { 
        pedestrianId: pedestrian.id || pedestrian.pedestrian_id,
        index: index
      };

      this.pedestrianGroup.add(pedestrianGroup);
    });
  }

  loadRisks(risks, rules) {
    this.risks = risks;
    this.rules = rules;
    this.createRiskIndicators();
  }

  createRiskIndicators() {
    this.clearGroup(this.riskGroup);

    this.risks.forEach((risk, index) => {
      const riskGroup = new THREE.Group();
      
      let color;
      let size;
      
      switch (risk.severity) {
        case 'critical':
          color = 0xd63031;
          size = 1.5;
          break;
        case 'warning':
          color = 0xfdcb6e;
          size = 1.0;
          break;
        default:
          color = 0x74b9ff;
          size = 0.8;
      }

      const ringGeometry = new THREE.RingGeometry(size * 0.8, size, 16);
      const ringMaterial = new THREE.MeshBasicMaterial({ 
        color: color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.6
      });
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.02;
      riskGroup.add(ring);

      const pillarGeometry = new THREE.CylinderGeometry(size * 0.1, size * 0.1, 3, 8);
      const pillarMaterial = new THREE.MeshBasicMaterial({ 
        color: color,
        transparent: true,
        opacity: 0.4
      });
      const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
      pillar.position.y = 1.5;
      riskGroup.add(pillar);

      riskGroup.position.set(risk.location.x, 0, risk.location.z);
      riskGroup.userData = { 
        riskIndex: index,
        risk: risk
      };
      riskGroup.visible = false;

      this.riskGroup.add(riskGroup);
    });
  }

  updatePlayback(timestamp) {
    this.currentTimestamp = timestamp;
    this.updateForkliftPosition();
    this.updateVisibleRisks();
    this.updatePedestrianVisibility();
    
    if (this.onTimeUpdate) {
      this.onTimeUpdate(timestamp);
    }
  }

  updateForkliftPosition() {
    if (this.trajectoryData.length === 0) return;

    const currentPoint = this.getInterpolatedPosition(this.currentTimestamp);
    if (!currentPoint) return;

    const forklift = this.forkliftGroup.children[0];
    if (forklift) {
      forklift.position.set(currentPoint.x, 0, currentPoint.z);
      
      if (currentPoint.direction !== undefined) {
        forklift.rotation.y = currentPoint.direction * Math.PI / 180;
      }
    }
  }

  getInterpolatedPosition(timestamp) {
    if (this.trajectoryData.length === 0) return null;

    for (let i = 0; i < this.trajectoryData.length - 1; i++) {
      const current = this.trajectoryData[i];
      const next = this.trajectoryData[i + 1];

      if (timestamp >= current.timestamp && timestamp <= next.timestamp) {
        const ratio = (timestamp - current.timestamp) / (next.timestamp - current.timestamp);
        
        return {
          x: current.x + (next.x - current.x) * ratio,
          y: current.y + (next.y - current.y) * ratio,
          z: current.z + (next.z - current.z) * ratio,
          direction: current.direction
        };
      }
    }

    const lastPoint = this.trajectoryData[this.trajectoryData.length - 1];
    return {
      x: lastPoint.x,
      y: lastPoint.y,
      z: lastPoint.z,
      direction: lastPoint.direction
    };
  }

  updateVisibleRisks() {
    const timeWindow = 1000;

    this.riskGroup.children.forEach((riskGroup, index) => {
      const risk = this.risks[index];
      if (!risk) return;

      const isVisible = Math.abs(risk.timestamp - this.currentTimestamp) < timeWindow;
      riskGroup.visible = isVisible;

      if (isVisible && this.onRiskHighlight) {
        this.onRiskHighlight(risk);
      }
    });
  }

  updatePedestrianVisibility() {
    const timeWindow = 5000;

    this.pedestrianGroup.children.forEach(pedestrianGroup => {
      const pedestrianIndex = pedestrianGroup.userData.index;
      const pedestrian = this.pedestrianEvents[pedestrianIndex];
      
      if (pedestrian) {
        const isVisible = Math.abs(pedestrian.timestamp - this.currentTimestamp) < timeWindow;
        pedestrianGroup.visible = isVisible;
      }
    });
  }

  togglePlay() {
    this.isPlaying = !this.isPlaying;
    return this.isPlaying;
  }

  setPlaybackSpeed(speed) {
    this.playbackSpeed = speed;
  }

  jumpToTimestamp(timestamp) {
    this.currentTimestamp = Math.max(
      this.startTimestamp,
      Math.min(this.endTimestamp, timestamp)
    );
    this.updatePlayback(this.currentTimestamp);
  }

  clearGroup(group) {
    if (!group) return;
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    }
  }

  clearAll() {
    this.clearGroup(this.warehouseGroup);
    this.clearGroup(this.forkliftGroup);
    this.clearGroup(this.pedestrianGroup);
    this.clearGroup(this.riskGroup);
    
    if (this.trajectoryLine) {
      this.scene.remove(this.trajectoryLine);
      this.trajectoryLine = null;
    }

    this.trajectoryData = [];
    this.pedestrianEvents = [];
    this.risks = [];
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    
    const currentTime = performance.now();
    
    if (this.isPlaying && this.lastFrameTime > 0) {
      const deltaTime = (currentTime - this.lastFrameTime) * this.playbackSpeed;
      this.currentTimestamp += deltaTime;
      
      if (this.currentTimestamp > this.endTimestamp) {
        this.currentTimestamp = this.startTimestamp;
        this.isPlaying = false;
      }
      
      this.updatePlayback(this.currentTimestamp);
    }
    
    this.lastFrameTime = currentTime;
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  onWindowResize() {
    this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
  }

  getTimeRange() {
    return {
      start: this.startTimestamp,
      end: this.endTimestamp
    };
  }

  getCurrentTime() {
    return this.currentTimestamp;
  }

  dispose() {
    this.isPlaying = false;
    this.clearAll();
    
    if (this.renderer) {
      this.renderer.dispose();
      this.container.removeChild(this.renderer.domElement);
    }
    
    window.removeEventListener('resize', () => this.onWindowResize());
  }
}

export default Renderer3D;
