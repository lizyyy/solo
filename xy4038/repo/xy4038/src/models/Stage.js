import * as THREE from 'three';

export class Stage extends THREE.Group {
  constructor(settings = {}) {
    super();
    
    this.userData.type = 'stage';
    this.userData.id = 'stage';
    this.userData.name = '舞台';
    this.userData.settings = {
      width: 16,
      depth: 10,
      height: 8,
      gridXSpacing: 2,
      gridZSpacing: 2,
      hoistMaxLoad: 500,
      barDefaultDiameter: 0.05,
      barWeightPerMeter: 5,
      ...settings
    };
    
    this.hoistPoints = [];
    this.bars = [];
    this.devices = [];
    
    this.createStage();
    this.createHoistGrid();
  }
  
  createStage() {
    const { width, depth, height } = this.userData.settings;
    
    const stageGeometry = new THREE.BoxGeometry(width, 0.3, depth);
    const stageMaterial = new THREE.MeshStandardMaterial({
      color: 0x2c3e50,
      roughness: 0.8,
      metalness: 0.2
    });
    this.stageFloor = new THREE.Mesh(stageGeometry, stageMaterial);
    this.stageFloor.position.y = -0.15;
    this.stageFloor.receiveShadow = true;
    this.stageFloor.userData.parent = this;
    this.add(this.stageFloor);
    
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0x34495e,
      roughness: 0.6,
      metalness: 0.1,
      side: THREE.DoubleSide
    });
    
    const backWall = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      wallMaterial
    );
    backWall.position.set(0, height / 2, -depth / 2);
    backWall.receiveShadow = true;
    backWall.userData.parent = this;
    this.add(backWall);
    
    const leftWall = new THREE.Mesh(
      new THREE.PlaneGeometry(depth, height),
      wallMaterial
    );
    leftWall.position.set(-width / 2, height / 2, 0);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.receiveShadow = true;
    leftWall.userData.parent = this;
    this.add(leftWall);
    
    const rightWall = new THREE.Mesh(
      new THREE.PlaneGeometry(depth, height),
      wallMaterial
    );
    rightWall.position.set(width / 2, height / 2, 0);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.receiveShadow = true;
    rightWall.userData.parent = this;
    this.add(rightWall);
    
    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(width, depth),
      wallMaterial
    );
    ceiling.position.set(0, height, 0);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.receiveShadow = true;
    ceiling.userData.parent = this;
    this.add(ceiling);
  }
  
  createHoistGrid() {
    const { width, depth, gridXSpacing, gridZSpacing, height, hoistMaxLoad } = this.userData.settings;
    
    for (let i = 0; i < this.hoistPoints.length; i++) {
      this.remove(this.hoistPoints[i]);
    }
    this.hoistPoints = [];
    
    const startX = -width / 2 + gridXSpacing / 2;
    const startZ = -depth / 2 + gridZSpacing / 2;
    
    const countX = Math.floor(width / gridXSpacing);
    const countZ = Math.floor(depth / gridZSpacing);
    
    for (let x = 0; x < countX; x++) {
      for (let z = 0; z < countZ; z++) {
        const worldX = startX + x * gridXSpacing;
        const worldZ = startZ + z * gridZSpacing;
        
        const hoistPoint = new HoistPoint({
          id: `hoist-${x}-${z}`,
          x: worldX,
          z: worldZ,
          maxLoad: hoistMaxLoad,
          gridX: x,
          gridZ: z
        });
        hoistPoint.position.set(worldX, height - 0.5, worldZ);
        hoistPoint.userData.parent = this;
        
        this.hoistPoints.push(hoistPoint);
        this.add(hoistPoint);
      }
    }
  }
  
  updateSettings(settings) {
    Object.assign(this.userData.settings, settings);
    
    this.remove(this.stageFloor);
    this.createStage();
    this.createHoistGrid();
  }
  
  addBar(bar) {
    if (!bar.userData || bar.userData.type !== 'bar') {
      throw new Error('Invalid bar object');
    }
    
    this.bars.push(bar);
    this.add(bar);
    
    return bar;
  }
  
  removeBar(bar) {
    const index = this.bars.indexOf(bar);
    if (index > -1) {
      this.bars.splice(index, 1);
      this.remove(bar);
    }
  }
  
  addDevice(device) {
    if (!device.userData || device.userData.type !== 'device') {
      throw new Error('Invalid device object');
    }
    
    this.devices.push(device);
    this.add(device);
    
    return device;
  }
  
  removeDevice(device) {
    const index = this.devices.indexOf(device);
    if (index > -1) {
      this.devices.splice(index, 1);
      this.remove(device);
    }
  }
  
  getHoistPointById(id) {
    return this.hoistPoints.find(hp => hp.userData.id === id);
  }
  
  getBarById(id) {
    return this.bars.find(bar => bar.userData.id === id);
  }
  
  getDeviceById(id) {
    return this.devices.find(device => device.userData.id === id);
  }
  
  getObjectById(id) {
    if (id === 'stage') return this;
    return this.getHoistPointById(id) || 
           this.getBarById(id) || 
           this.getDeviceById(id);
  }
  
  serialize() {
    return {
      type: 'stage',
      id: 'stage',
      settings: { ...this.userData.settings },
      bars: this.bars.map(bar => bar.serialize()),
      devices: this.devices.map(device => device.serialize())
    };
  }
  
  deserialize(data) {
    if (data.settings) {
      this.updateSettings(data.settings);
    }
  }
}

export class HoistPoint extends THREE.Group {
  constructor(options = {}) {
    super();
    
    this.userData.type = 'hoistPoint';
    this.userData.id = options.id || 'hoist-unknown';
    this.userData.name = `吊点 ${options.id || '未知'}`;
    this.userData.x = options.x || 0;
    this.userData.z = options.z || 0;
    this.userData.maxLoad = options.maxLoad || 500;
    this.userData.currentLoad = 0;
    this.userData.gridX = options.gridX || 0;
    this.userData.gridZ = options.gridZ || 0;
    this.userData.attachedDevices = [];
    this.userData.attachedBars = [];
    
    this.createGeometry();
    this.setupInteraction();
  }
  
  createGeometry() {
    const ringGeometry = new THREE.RingGeometry(0.15, 0.2, 8);
    const ringMaterial = new THREE.MeshStandardMaterial({
      color: 0x7f8c8d,
      side: THREE.DoubleSide,
      roughness: 0.5,
      metalness: 0.8
    });
    this.ring = new THREE.Mesh(ringGeometry, ringMaterial);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0;
    this.add(this.ring);
    
    const hookGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8);
    const hookMaterial = new THREE.MeshStandardMaterial({
      color: 0x95a5a6,
      roughness: 0.3,
      metalness: 0.9
    });
    this.hook = new THREE.Mesh(hookGeometry, hookMaterial);
    this.hook.position.y = -0.4;
    this.add(this.hook);
    
    const highlightGeometry = new THREE.RingGeometry(0.25, 0.3, 16);
    const highlightMaterial = new THREE.MeshBasicMaterial({
      color: 0x3498db,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0
    });
    this.highlight = new THREE.Mesh(highlightGeometry, highlightMaterial);
    this.highlight.rotation.x = -Math.PI / 2;
    this.highlight.position.y = 0.01;
    this.add(this.highlight);
    
    const loadIndicatorGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.02, 16);
    this.loadIndicatorMaterial = new THREE.MeshBasicMaterial({
      color: 0x2ecc71
    });
    this.loadIndicator = new THREE.Mesh(loadIndicatorGeometry, this.loadIndicatorMaterial);
    this.loadIndicator.position.y = 0.05;
    this.add(this.loadIndicator);
  }
  
  setupInteraction() {
    this.userData.onMouseEnter = () => {
      this.highlight.material.opacity = 0.8;
    };
    
    this.userData.onMouseLeave = () => {
      this.highlight.material.opacity = 0;
    };
    
    this.userData.onSelect = () => {
      this.highlight.material.color.setHex(0x2ecc71);
      this.highlight.material.opacity = 1;
    };
    
    this.userData.onDeselect = () => {
      this.highlight.material.color.setHex(0x3498db);
      this.highlight.material.opacity = 0;
    };
  }
  
  updateLoad(load) {
    this.userData.currentLoad = load;
    
    const ratio = load / this.userData.maxLoad;
    
    if (ratio < 0.7) {
      this.loadIndicatorMaterial.color.setHex(0x2ecc71);
    } else if (ratio < 0.9) {
      this.loadIndicatorMaterial.color.setHex(0xf39c12);
    } else {
      this.loadIndicatorMaterial.color.setHex(0xe74c3c);
    }
    
    if (ratio > 1) {
      this.highlight.material.color.setHex(0xe74c3c);
      this.highlight.material.opacity = 0.5;
    }
  }
  
  attachDevice(device) {
    if (!this.userData.attachedDevices.includes(device)) {
      this.userData.attachedDevices.push(device);
    }
  }
  
  detachDevice(device) {
    const index = this.userData.attachedDevices.indexOf(device);
    if (index > -1) {
      this.userData.attachedDevices.splice(index, 1);
    }
  }
  
  attachBar(bar) {
    if (!this.userData.attachedBars.includes(bar)) {
      this.userData.attachedBars.push(bar);
    }
  }
  
  detachBar(bar) {
    const index = this.userData.attachedBars.indexOf(bar);
    if (index > -1) {
      this.userData.attachedBars.splice(index, 1);
    }
  }
  
  serialize() {
    return {
      type: 'hoistPoint',
      id: this.userData.id,
      name: this.userData.name,
      x: this.userData.x,
      z: this.userData.z,
      maxLoad: this.userData.maxLoad,
      gridX: this.userData.gridX,
      gridZ: this.userData.gridZ
    };
  }
  
  deserialize(data) {
    Object.assign(this.userData, data);
  }
}

export class Bar extends THREE.Group {
  constructor(options = {}) {
    super();
    
    this.userData.type = 'bar';
    this.userData.id = options.id || `bar-${Date.now()}`;
    this.userData.name = options.name || '横杆';
    this.userData.length = options.length || 6;
    this.userData.diameter = options.diameter || 0.05;
    this.userData.weightPerMeter = options.weightPerMeter || 5;
    this.userData.height = options.height || 6;
    this.userData.startX = options.startX || -3;
    this.userData.startZ = options.startZ || 0;
    this.userData.endX = options.endX || 3;
    this.userData.endZ = options.endZ || 0;
    this.userData.supportHoistPoints = options.supportHoistPoints || [];
    this.userData.attachedDevices = [];
    this.userData.segmentLoads = [];
    
    this.createGeometry();
    this.setupInteraction();
  }
  
  createGeometry() {
    const { startX, startZ, endX, endZ, height, diameter } = this.userData;
    
    const dx = endX - startX;
    const dz = endZ - startZ;
    const length = Math.sqrt(dx * dx + dz * dz);
    
    const barGeometry = new THREE.CylinderGeometry(diameter / 2, diameter / 2, length, 8);
    const barMaterial = new THREE.MeshStandardMaterial({
      color: 0x95a5a6,
      roughness: 0.4,
      metalness: 0.8
    });
    this.barMesh = new THREE.Mesh(barGeometry, barMaterial);
    this.barMesh.castShadow = true;
    this.barMesh.receiveShadow = true;
    
    const angle = Math.atan2(dx, dz);
    this.barMesh.rotation.z = Math.PI / 2;
    this.barMesh.rotation.y = -angle;
    
    this.barMesh.position.set(
      (startX + endX) / 2,
      height,
      (startZ + endZ) / 2
    );
    
    this.add(this.barMesh);
    
    const startCapGeometry = new THREE.SphereGeometry(diameter / 2, 8, 8);
    const startCap = new THREE.Mesh(startCapGeometry, barMaterial);
    startCap.position.set(startX, height, startZ);
    this.add(startCap);
    
    const endCap = new THREE.Mesh(startCapGeometry, barMaterial);
    endCap.position.set(endX, height, endZ);
    this.add(endCap);
    
    const highlightGeometry = new THREE.TubeGeometry(
      new THREE.LineCurve3(
        new THREE.Vector3(startX, height + 0.01, startZ),
        new THREE.Vector3(endX, height + 0.01, endZ)
      ),
      8,
      diameter / 2 + 0.02,
      8,
      false
    );
    const highlightMaterial = new THREE.MeshBasicMaterial({
      color: 0x3498db,
      transparent: true,
      opacity: 0
    });
    this.highlight = new THREE.Mesh(highlightGeometry, highlightMaterial);
    this.add(this.highlight);
  }
  
  setupInteraction() {
    this.userData.onMouseEnter = () => {
      this.highlight.material.opacity = 0.6;
    };
    
    this.userData.onMouseLeave = () => {
      this.highlight.material.opacity = 0;
    };
    
    this.userData.onSelect = () => {
      this.highlight.material.color.setHex(0x2ecc71);
      this.highlight.material.opacity = 0.8;
    };
    
    this.userData.onDeselect = () => {
      this.highlight.material.color.setHex(0x3498db);
      this.highlight.material.opacity = 0;
    };
  }
  
  attachDevice(device) {
    if (!this.userData.attachedDevices.includes(device)) {
      this.userData.attachedDevices.push(device);
    }
  }
  
  detachDevice(device) {
    const index = this.userData.attachedDevices.indexOf(device);
    if (index > -1) {
      this.userData.attachedDevices.splice(index, 1);
    }
  }
  
  getWeight() {
    return this.userData.length * this.userData.weightPerMeter;
  }
  
  serialize() {
    return {
      type: 'bar',
      id: this.userData.id,
      name: this.userData.name,
      length: this.userData.length,
      diameter: this.userData.diameter,
      weightPerMeter: this.userData.weightPerMeter,
      height: this.userData.height,
      startX: this.userData.startX,
      startZ: this.userData.startZ,
      endX: this.userData.endX,
      endZ: this.userData.endZ,
      supportHoistPoints: [...this.userData.supportHoistPoints]
    };
  }
  
  deserialize(data) {
    Object.assign(this.userData, data);
  }
}
