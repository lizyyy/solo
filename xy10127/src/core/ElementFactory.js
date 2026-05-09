import * as THREE from 'three';

class StageElement {
  constructor(options) {
    this.id = options.id;
    this.name = options.name;
    this.type = options.type;
    this.size = options.size;
    this.mesh = null;
    this.originalMaterial = null;
    this.collisionMaterial = null;
    this.boundaryMaterial = null;
  }

  getData() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      position: {
        x: this.mesh.position.x,
        y: this.mesh.position.y,
        z: this.mesh.position.z
      },
      size: this.size
    };
  }
}

class LightRig extends StageElement {
  constructor(options) {
    super({ ...options, type: 'light-rig' });
    
    const geometry = new THREE.BoxGeometry(
      options.size.width,
      options.size.height,
      options.size.depth
    );
    
    const material = new THREE.MeshStandardMaterial({
      color: 0x888888,
      metalness: 0.8,
      roughness: 0.2
    });
    
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.set(
      options.position.x,
      options.position.y,
      options.position.z
    );
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    
    this.originalMaterial = material;
    
    this.addLightSources(options.position, options.size);
  }

  addLightSources(position, size) {
    const lightCount = Math.max(1, Math.floor(size.width / 1.5));
    const spacing = size.width / (lightCount + 1);
    
    for (let i = 0; i < lightCount; i++) {
      const lightOffset = -size.width / 2 + spacing * (i + 1);
      
      const bulbGeometry = new THREE.SphereGeometry(0.15, 16, 16);
      const bulbMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const bulb = new THREE.Mesh(bulbGeometry, bulbMaterial);
      
      bulb.position.set(lightOffset, -size.height / 2 - 0.1, 0);
      this.mesh.add(bulb);
      
      const light = new THREE.PointLight(0xffffff, 0.5, 10);
      light.position.copy(bulb.position);
      this.mesh.add(light);
    }
  }
}

class Curtain extends StageElement {
  constructor(options) {
    super({ ...options, type: 'curtain' });
    
    const geometry = new THREE.BoxGeometry(
      options.size.width,
      options.size.height,
      options.size.depth
    );
    
    const material = new THREE.MeshStandardMaterial({
      color: 0x8b0000,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      roughness: 0.9
    });
    
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.set(
      options.position.x,
      options.position.y,
      options.position.z
    );
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    
    this.originalMaterial = material;
    
    this.addCurtainLines(options.size);
  }

  addCurtainLines(size) {
    const lineCount = 10;
    const lineSpacing = size.width / (lineCount + 1);
    
    for (let i = 0; i < lineCount; i++) {
      const lineGeometry = new THREE.BufferGeometry();
      const x = -size.width / 2 + lineSpacing * (i + 1);
      
      const points = [
        new THREE.Vector3(x, size.height / 2, 0),
        new THREE.Vector3(x + 0.1, -size.height / 2, 0)
      ];
      
      lineGeometry.setFromPoints(points);
      
      const lineMaterial = new THREE.LineBasicMaterial({
        color: 0x660000,
        transparent: true,
        opacity: 0.3
      });
      
      const line = new THREE.Line(lineGeometry, lineMaterial);
      this.mesh.add(line);
    }
  }
}

class Camera extends StageElement {
  constructor(options) {
    super({ ...options, type: 'camera' });
    
    const geometry = new THREE.BoxGeometry(
      options.size.width,
      options.size.height,
      options.size.depth
    );
    
    const material = new THREE.MeshStandardMaterial({
      color: 0x333333,
      metalness: 0.5,
      roughness: 0.5
    });
    
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.set(
      options.position.x,
      options.position.y,
      options.position.z
    );
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    
    this.originalMaterial = material;
    
    this.addCameraDetails(options.size);
  }

  addCameraDetails(size) {
    const lensGeometry = new THREE.CylinderGeometry(0.15, 0.15, 0.3, 32);
    const lensMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      metalness: 0.9,
      roughness: 0.1
    });
    const lens = new THREE.Mesh(lensGeometry, lensMaterial);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(0, 0, size.depth / 2 + 0.15);
    this.mesh.add(lens);
    
    const viewfinderGeometry = new THREE.BoxGeometry(0.2, 0.1, 0.1);
    const viewfinderMaterial = new THREE.MeshStandardMaterial({
      color: 0x666666
    });
    const viewfinder = new THREE.Mesh(viewfinderGeometry, viewfinderMaterial);
    viewfinder.position.set(0, size.height / 2 + 0.1, -size.depth / 2 + 0.1);
    this.mesh.add(viewfinder);
  }
}

class ElementFactory {
  createLightRig(options) {
    return new LightRig(options);
  }

  createCurtain(options) {
    return new Curtain(options);
  }

  createCamera(options) {
    return new Camera(options);
  }

  createFromData(data) {
    switch (data.type) {
      case 'light-rig':
        return this.createLightRig(data);
      case 'curtain':
        return this.createCurtain(data);
      case 'camera':
        return this.createCamera(data);
      default:
        throw new Error(`Unknown element type: ${data.type}`);
    }
  }
}

export default ElementFactory;
