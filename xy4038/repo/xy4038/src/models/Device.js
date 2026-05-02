import * as THREE from 'three';

export const DeviceTypes = {
  LIGHT: 'light',
  SPEAKER: 'speaker',
  SCREEN: 'screen',
  PROP: 'prop',
  CUSTOM: 'custom'
};

export const MountingModes = {
  HOIST_DIRECT: 'hoist_direct',
  BAR_ATTACHED: 'bar_attached',
  FLOOR_STANDING: 'floor_standing'
};

export class Device extends THREE.Group {
  constructor(options = {}) {
    super();
    
    this.userData.type = 'device';
    this.userData.deviceType = options.deviceType || DeviceTypes.CUSTOM;
    this.userData.id = options.id || `device-${Date.now()}`;
    this.userData.name = options.name || '设备';
    this.userData.manufacturer = options.manufacturer || '';
    this.userData.model = options.model || '';
    
    this.userData.weight = options.weight || 10;
    this.userData.dimensions = {
      width: options.width || 0.5,
      height: options.height || 0.5,
      depth: options.depth || 0.5
    };
    
    this.userData.centerOfGravity = {
      x: options.centerOfGravityX || 0,
      y: options.centerOfGravityY || 0,
      z: options.centerOfGravityZ || 0
    };
    
    this.userData.safetyClearance = options.safetyClearance || 0.3;
    this.userData.mountingMode = options.mountingMode || MountingModes.HOIST_DIRECT;
    
    this.userData.position = { x: 0, y: 5, z: 0 };
    this.userData.rotation = { x: 0, y: 0, z: 0 };
    
    this.userData.attachedTo = null;
    this.userData.attachType = null;
    
    this.userData.notes = options.notes || '';
    
    this.createGeometry();
    this.setupInteraction();
  }
  
  createGeometry() {
    const { width, height, depth } = this.userData.dimensions;
    
    const deviceGeometry = new THREE.BoxGeometry(width, height, depth);
    const deviceMaterial = new THREE.MeshStandardMaterial({
      color: this.getDeviceColor(),
      roughness: 0.5,
      metalness: 0.3
    });
    
    this.deviceMesh = new THREE.Mesh(deviceGeometry, deviceMaterial);
    this.deviceMesh.castShadow = true;
    this.deviceMesh.receiveShadow = true;
    
    this.add(this.deviceMesh);
    
    const wireframeGeometry = new THREE.BoxGeometry(
      width + this.userData.safetyClearance * 2,
      height + this.userData.safetyClearance * 2,
      depth + this.userData.safetyClearance * 2
    );
    const wireframeMaterial = new THREE.MeshBasicMaterial({
      color: 0x3498db,
      wireframe: true,
      transparent: true,
      opacity: 0
    });
    
    this.clearanceWireframe = new THREE.Mesh(wireframeGeometry, wireframeMaterial);
    this.add(this.clearanceWireframe);
    
    const highlightGeometry = new THREE.BoxGeometry(
      width + 0.05,
      height + 0.05,
      depth + 0.05
    );
    const highlightMaterial = new THREE.MeshBasicMaterial({
      color: 0x3498db,
      transparent: true,
      opacity: 0
    });
    
    this.highlight = new THREE.Mesh(highlightGeometry, highlightMaterial);
    this.add(this.highlight);
    
    this.addTypeSpecificGeometry();
  }
  
  getDeviceColor() {
    switch (this.userData.deviceType) {
      case DeviceTypes.LIGHT:
        return 0xf39c12;
      case DeviceTypes.SPEAKER:
        return 0x2c3e50;
      case DeviceTypes.SCREEN:
        return 0x7f8c8d;
      case DeviceTypes.PROP:
        return 0x9b59b6;
      default:
        return 0x95a5a6;
    }
  }
  
  addTypeSpecificGeometry() {
    switch (this.userData.deviceType) {
      case DeviceTypes.LIGHT:
        this.addLightGeometry();
        break;
      case DeviceTypes.SPEAKER:
        this.addSpeakerGeometry();
        break;
      case DeviceTypes.SCREEN:
        this.addScreenGeometry();
        break;
    }
  }
  
  addLightGeometry() {
    const lensGeometry = new THREE.SphereGeometry(0.15, 8, 8);
    const lensMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xf39c12,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.8
    });
    const lens = new THREE.Mesh(lensGeometry, lensMaterial);
    lens.position.y = -this.userData.dimensions.height / 2 - 0.05;
    this.add(lens);
    
    const lightConeGeometry = new THREE.ConeGeometry(1.5, 3, 16);
    const lightConeMaterial = new THREE.MeshBasicMaterial({
      color: 0xf39c12,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide
    });
    this.lightCone = new THREE.Mesh(lightConeGeometry, lightConeMaterial);
    this.lightCone.position.y = -this.userData.dimensions.height / 2 - 1.5 - 0.1;
    this.lightCone.rotation.x = Math.PI;
    this.add(this.lightCone);
  }
  
  addSpeakerGeometry() {
    const driverGeometry = new THREE.CircleGeometry(0.12, 16);
    const driverMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      roughness: 0.3
    });
    
    const frontDriver = new THREE.Mesh(driverGeometry, driverMaterial);
    frontDriver.position.z = this.userData.dimensions.depth / 2 + 0.01;
    this.add(frontDriver);
    
    const backDriver = new THREE.Mesh(driverGeometry, driverMaterial);
    backDriver.position.z = -this.userData.dimensions.depth / 2 - 0.01;
    backDriver.rotation.y = Math.PI;
    this.add(backDriver);
  }
  
  addScreenGeometry() {
    const screenGeometry = new THREE.PlaneGeometry(
      this.userData.dimensions.width * 0.9,
      this.userData.dimensions.height * 0.9
    );
    const screenMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.1,
      metalness: 0.5
    });
    
    const screen = new THREE.Mesh(screenGeometry, screenMaterial);
    screen.position.z = this.userData.dimensions.depth / 2 + 0.01;
    this.add(screen);
  }
  
  setupInteraction() {
    this.userData.onMouseEnter = () => {
      this.highlight.material.opacity = 0.5;
      this.clearanceWireframe.material.opacity = 0.5;
    };
    
    this.userData.onMouseLeave = () => {
      this.highlight.material.opacity = 0;
      this.clearanceWireframe.material.opacity = 0;
    };
    
    this.userData.onSelect = () => {
      this.highlight.material.color.setHex(0x2ecc71);
      this.highlight.material.opacity = 0.7;
      this.clearanceWireframe.material.opacity = 0.8;
    };
    
    this.userData.onDeselect = () => {
      this.highlight.material.color.setHex(0x3498db);
      this.highlight.material.opacity = 0;
      this.clearanceWireframe.material.opacity = 0;
    };
  }
  
  updatePosition(x, y, z) {
    this.userData.position = { x, y, z };
    this.position.set(x, y, z);
  }
  
  updateRotation(x, y, z) {
    this.userData.rotation = { x, y, z };
    this.rotation.set(x, y, z);
  }
  
  attachTo(attachedTo, attachType) {
    this.userData.attachedTo = attachedTo;
    this.userData.attachType = attachType;
  }
  
  detach() {
    this.userData.attachedTo = null;
    this.userData.attachType = null;
  }
  
  getBoundingBox() {
    const box = new THREE.Box3().setFromObject(this);
    return box;
  }
  
  getSafetyBoundingBox() {
    const box = new THREE.Box3().setFromObject(this.clearanceWireframe);
    return box;
  }
  
  setHighlightColor(color) {
    this.highlight.material.color.setHex(color);
  }
  
  serialize() {
    return {
      type: 'device',
      deviceType: this.userData.deviceType,
      id: this.userData.id,
      name: this.userData.name,
      manufacturer: this.userData.manufacturer,
      model: this.userData.model,
      weight: this.userData.weight,
      width: this.userData.dimensions.width,
      height: this.userData.dimensions.height,
      depth: this.userData.dimensions.depth,
      centerOfGravityX: this.userData.centerOfGravity.x,
      centerOfGravityY: this.userData.centerOfGravity.y,
      centerOfGravityZ: this.userData.centerOfGravity.z,
      safetyClearance: this.userData.safetyClearance,
      mountingMode: this.userData.mountingMode,
      position: { ...this.userData.position },
      rotation: { ...this.userData.rotation },
      attachedTo: this.userData.attachedTo,
      attachType: this.userData.attachType,
      notes: this.userData.notes
    };
  }
  
  deserialize(data) {
    Object.assign(this.userData, {
      ...data,
      dimensions: {
        width: data.width || 0.5,
        height: data.height || 0.5,
        depth: data.depth || 0.5
      },
      centerOfGravity: {
        x: data.centerOfGravityX || 0,
        y: data.centerOfGravityY || 0,
        z: data.centerOfGravityZ || 0
      }
    });
    
    if (data.position) {
      this.updatePosition(data.position.x, data.position.y, data.position.z);
    }
    if (data.rotation) {
      this.updateRotation(data.rotation.x, data.rotation.y, data.rotation.z);
    }
  }
}

export class DeviceLibrary {
  constructor() {
    this.devices = [];
    this.initializeDefaultDevices();
  }
  
  initializeDefaultDevices() {
    this.devices = [
      {
        id: 'light-par64',
        name: 'PAR 64 聚光灯',
        deviceType: DeviceTypes.LIGHT,
        manufacturer: 'Generic',
        model: 'PAR-64',
        weight: 5,
        width: 0.3,
        height: 0.4,
        depth: 0.3,
        centerOfGravityX: 0,
        centerOfGravityY: 0,
        centerOfGravityZ: 0,
        safetyClearance: 0.2,
        mountingMode: MountingModes.HOIST_DIRECT,
        notes: '标准 PAR 64 聚光灯'
      },
      {
        id: 'light-moving-head',
        name: '摇头灯 250W',
        deviceType: DeviceTypes.LIGHT,
        manufacturer: 'Generic',
        model: 'MH-250',
        weight: 18,
        width: 0.4,
        height: 0.5,
        depth: 0.4,
        centerOfGravityX: 0,
        centerOfGravityY: 0.1,
        centerOfGravityZ: 0,
        safetyClearance: 0.3,
        mountingMode: MountingModes.HOIST_DIRECT,
        notes: '250W 摇头电脑灯'
      },
      {
        id: 'light-led-panel',
        name: 'LED 平板灯',
        deviceType: DeviceTypes.LIGHT,
        manufacturer: 'Generic',
        model: 'LED-PANEL',
        weight: 3,
        width: 0.6,
        height: 0.1,
        depth: 0.4,
        centerOfGravityX: 0,
        centerOfGravityY: 0,
        centerOfGravityZ: 0,
        safetyClearance: 0.15,
        mountingMode: MountingModes.HOIST_DIRECT,
        notes: 'LED 平板柔光灯'
      },
      {
        id: 'speaker-15inch',
        name: '15寸 全频音箱',
        deviceType: DeviceTypes.SPEAKER,
        manufacturer: 'Generic',
        model: 'SPK-15',
        weight: 25,
        width: 0.45,
        height: 0.7,
        depth: 0.4,
        centerOfGravityX: 0,
        centerOfGravityY: -0.1,
        centerOfGravityZ: 0,
        safetyClearance: 0.25,
        mountingMode: MountingModes.BAR_ATTACHED,
        notes: '15寸两分频全频音箱'
      },
      {
        id: 'speaker-sub',
        name: '18寸 低音炮',
        deviceType: DeviceTypes.SPEAKER,
        manufacturer: 'Generic',
        model: 'SUB-18',
        weight: 45,
        width: 0.5,
        height: 0.6,
        depth: 0.6,
        centerOfGravityX: 0,
        centerOfGravityY: -0.05,
        centerOfGravityZ: 0,
        safetyClearance: 0.3,
        mountingMode: MountingModes.FLOOR_STANDING,
        notes: '18寸超低频扬声器'
      },
      {
        id: 'screen-motorized',
        name: '电动幕布 4:3',
        deviceType: DeviceTypes.SCREEN,
        manufacturer: 'Generic',
        model: 'SCR-43',
        weight: 15,
        width: 3,
        height: 2.25,
        depth: 0.2,
        centerOfGravityX: 0,
        centerOfGravityY: 0,
        centerOfGravityZ: 0,
        safetyClearance: 0.5,
        mountingMode: MountingModes.HOIST_DIRECT,
        notes: '4:3 比例电动投影幕布'
      },
      {
        id: 'screen-wide',
        name: '宽幅幕布 16:9',
        deviceType: DeviceTypes.SCREEN,
        manufacturer: 'Generic',
        model: 'SCR-169',
        weight: 22,
        width: 4,
        height: 2.25,
        depth: 0.2,
        centerOfGravityX: 0,
        centerOfGravityY: 0,
        centerOfGravityZ: 0,
        safetyClearance: 0.5,
        mountingMode: MountingModes.HOIST_DIRECT,
        notes: '16:9 比例宽幅投影幕布'
      },
      {
        id: 'prop-truss',
        name: '三角桁架 2m',
        deviceType: DeviceTypes.PROP,
        manufacturer: 'Generic',
        model: 'TRUSS-2M',
        weight: 12,
        width: 2,
        height: 0.3,
        depth: 0.3,
        centerOfGravityX: 0,
        centerOfGravityY: 0,
        centerOfGravityZ: 0,
        safetyClearance: 0.2,
        mountingMode: MountingModes.HOIST_DIRECT,
        notes: '2米铝合金三角桁架'
      },
      {
        id: 'prop-scaffold',
        name: '脚手架平台',
        deviceType: DeviceTypes.PROP,
        manufacturer: 'Generic',
        model: 'SCAFFOLD',
        weight: 80,
        width: 2,
        height: 3,
        depth: 1.5,
        centerOfGravityX: 0,
        centerOfGravityY: -0.5,
        centerOfGravityZ: 0,
        safetyClearance: 0.5,
        mountingMode: MountingModes.FLOOR_STANDING,
        notes: '可移动脚手架平台'
      }
    ];
  }
  
  getDevices() {
    return [...this.devices];
  }
  
  getDeviceById(id) {
    return this.devices.find(d => d.id === id);
  }
  
  addDevice(deviceTemplate) {
    const newDevice = {
      ...deviceTemplate,
      id: deviceTemplate.id || `custom-${Date.now()}`
    };
    this.devices.push(newDevice);
    return newDevice;
  }
  
  removeDevice(id) {
    const index = this.devices.findIndex(d => d.id === id);
    if (index > -1) {
      this.devices.splice(index, 1);
      return true;
    }
    return false;
  }
  
  createDeviceInstance(templateId, options = {}) {
    const template = this.getDeviceById(templateId);
    if (!template) {
      throw new Error(`Device template not found: ${templateId}`);
    }
    
    const instance = new Device({
      ...template,
      ...options,
      id: options.id || `${template.id}-${Date.now()}`
    });
    
    return instance;
  }
}
