import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class SceneManager {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.valveMeshes = new Map();
    this.zoneMeshes = [];
    this.particleSystems = [];
    this.clock = new THREE.Clock();
    
    this.init();
  }

  init() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a1628);
    this.scene.fog = new THREE.Fog(0x0a1628, 15, 40);

    const { clientWidth, clientHeight } = this.container;
    this.camera = new THREE.PerspectiveCamera(60, clientWidth / clientHeight, 0.1, 1000);
    this.camera.position.set(0, 8, 12);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(clientWidth, clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;

    this.setupLights();
    this.createTank();

    window.addEventListener('resize', () => this.onResize());
    this.animate();
  }

  setupLights() {
    const ambientLight = new THREE.AmbientLight(0x404060, 0.5);
    this.scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1);
    mainLight.position.set(10, 20, 10);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 50;
    mainLight.shadow.camera.left = -15;
    mainLight.shadow.camera.right = 15;
    mainLight.shadow.camera.top = 15;
    mainLight.shadow.camera.bottom = -15;
    this.scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0x6bcfff, 0.4);
    fillLight.position.set(-10, 10, -10);
    this.scene.add(fillLight);

    const waterLight = new THREE.PointLight(0x00c6fb, 0.8, 30);
    waterLight.position.set(0, 3, 0);
    this.scene.add(waterLight);
  }

  createTank() {
    const tankGroup = new THREE.Group();
    tankGroup.name = 'tank';

    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x88ccff,
      transparent: true,
      opacity: 0.15,
      roughness: 0.1,
      metalness: 0.1,
      transmission: 0.9,
      thickness: 0.5,
      side: THREE.DoubleSide
    });

    const waterMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x0066aa,
      transparent: true,
      opacity: 0.3,
      roughness: 0.1,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.1
    });

    const frameMaterial = new THREE.MeshStandardMaterial({
      color: 0x334455,
      metalness: 0.8,
      roughness: 0.3
    });

    const waterGeometry = new THREE.BoxGeometry(10, 4, 8);
    const water = new THREE.Mesh(waterGeometry, waterMaterial);
    water.position.y = 0;
    water.receiveShadow = true;
    tankGroup.add(water);

    const frameThickness = 0.2;
    const framePositions = [
      { pos: [0, 2.1, 0], size: [10.2, frameThickness, 8.2] },
      { pos: [0, -2.1, 0], size: [10.2, frameThickness, 8.2] },
      { pos: [5.1, 0, 0], size: [frameThickness, 4.2, 8.2] },
      { pos: [-5.1, 0, 0], size: [frameThickness, 4.2, 8.2] },
      { pos: [0, 0, 4.1], size: [10.2, 4.2, frameThickness] },
      { pos: [0, 0, -4.1], size: [10.2, 4.2, frameThickness] }
    ];

    framePositions.forEach(({ pos, size }) => {
      const frameGeo = new THREE.BoxGeometry(...size);
      const frame = new THREE.Mesh(frameGeo, frameMaterial);
      frame.position.set(...pos);
      frame.castShadow = true;
      tankGroup.add(frame);
    });

    const floorGeo = new THREE.BoxGeometry(9.8, 0.1, 7.8);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x224433,
      roughness: 0.9,
      metalness: 0.1
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.y = -1.95;
    floor.receiveShadow = true;
    tankGroup.add(floor);

    const gridHelper = new THREE.GridHelper(10, 10, 0x1a3a5c, 0x0d2137);
    gridHelper.position.y = -1.9;
    tankGroup.add(gridHelper);

    this.scene.add(tankGroup);
    this.tankGroup = tankGroup;
  }

  createValve(valveData) {
    const valveGroup = new THREE.Group();
    valveGroup.name = `valve-${valveData.id}`;
    valveGroup.userData = { ...valveData };

    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: valveData.type === 'inlet' ? 0x00ff88 : 
             valveData.type === 'outlet' ? 0xff6b6b : 0xffd700,
      metalness: 0.7,
      roughness: 0.3,
      emissive: valveData.active ? 
        (valveData.type === 'inlet' ? 0x003311 : 
         valveData.type === 'outlet' ? 0x331111 : 0x332200) : 0x000000
    });

    const bodyGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.6, 16);
    const body = new THREE.Mesh(bodyGeo, bodyMaterial);
    body.rotation.z = Math.PI / 2;
    body.castShadow = true;
    valveGroup.add(body);

    const handleGeo = new THREE.BoxGeometry(0.1, 0.8, 0.1);
    const handleMat = new THREE.MeshStandardMaterial({
      color: 0x888888,
      metalness: 0.9,
      roughness: 0.2
    });
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.position.x = 0.4;
    handle.rotation.z = (valveData.openDegree / 100) * Math.PI / 2;
    handle.castShadow = true;
    valveGroup.add(handle);

    const indicatorGeo = new THREE.SphereGeometry(0.15, 16, 16);
    const indicatorMat = new THREE.MeshBasicMaterial({
      color: valveData.active ? 0x00ff88 : 0xff6b6b
    });
    const indicator = new THREE.Mesh(indicatorGeo, indicatorMat);
    indicator.position.set(0, 0.4, 0);
    valveGroup.add(indicator);

    valveGroup.position.set(valveData.x, valveData.y, valveData.z);
    
    const dir = new THREE.Vector3(
      valveData.direction.x,
      valveData.direction.y,
      valveData.direction.z
    ).normalize();
    valveGroup.lookAt(valveGroup.position.clone().add(dir));

    this.scene.add(valveGroup);
    this.valveMeshes.set(valveData.id, { group: valveGroup, handle, indicator, body });

    if (valveData.active && valveData.flowRate > 0) {
      this.createParticleSystem(valveData);
    }
  }

  createParticleSystem(valveData) {
    const particleCount = Math.floor(valveData.flowRate * 100);
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = [];
    const lifetimes = new Float32Array(particleCount);

    const dir = new THREE.Vector3(
      valveData.direction.x,
      valveData.direction.y,
      valveData.direction.z
    ).normalize();

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = valveData.x + (Math.random() - 0.5) * 0.3;
      positions[i * 3 + 1] = valveData.y + (Math.random() - 0.5) * 0.3;
      positions[i * 3 + 2] = valveData.z + (Math.random() - 0.5) * 0.3;

      const velocity = dir.clone();
      velocity.x += (Math.random() - 0.5) * 0.3;
      velocity.y += (Math.random() - 0.5) * 0.3;
      velocity.z += (Math.random() - 0.5) * 0.3;
      velocity.normalize().multiplyScalar(valveData.flowRate * 0.5 + Math.random() * 0.5);
      velocities.push(velocity);

      lifetimes[i] = Math.random();
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('lifetime', new THREE.BufferAttribute(lifetimes, 1));

    const color = valveData.type === 'inlet' ? 0x00ff88 : 
                  valveData.type === 'outlet' ? 0xff6b6b : 0xffd700;

    const material = new THREE.PointsMaterial({
      color,
      size: 0.1,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    });

    const particles = new THREE.Points(geometry, material);
    this.scene.add(particles);

    this.particleSystems.push({
      mesh: particles,
      velocities,
      valveData,
      basePosition: new THREE.Vector3(valveData.x, valveData.y, valveData.z)
    });
  }

  createDisplayZone(zoneData) {
    const zoneGroup = new THREE.Group();
    zoneGroup.name = `zone-${zoneData.id}`;

    const geometry = new THREE.BoxGeometry(zoneData.width, zoneData.height, zoneData.depth);
    const edges = new THREE.EdgesGeometry(geometry);
    const lineMaterial = new THREE.LineBasicMaterial({ 
      color: zoneData.type === 'maintenance' ? 0x6bcfff : 0x8ad0ff,
      transparent: true,
      opacity: 0.8
    });
    const wireframe = new THREE.LineSegments(edges, lineMaterial);

    const fillMaterial = new THREE.MeshBasicMaterial({
      color: zoneData.type === 'maintenance' ? 0x6bcfff : 0x8ad0ff,
      transparent: true,
      opacity: 0.1,
      side: THREE.DoubleSide
    });
    const fill = new THREE.Mesh(geometry, fillMaterial);

    zoneGroup.add(wireframe);
    zoneGroup.add(fill);
    zoneGroup.position.set(zoneData.x, zoneData.y, zoneData.z);

    this.scene.add(zoneGroup);
    this.zoneMeshes.push(zoneGroup);
  }

  updateValve(valveId, updates) {
    const valveObj = this.valveMeshes.get(valveId);
    if (!valveObj) return;

    const { group, handle, indicator, body } = valveObj;
    const userData = group.userData;

    if (updates.active !== undefined) {
      userData.active = updates.active;
      indicator.material.color.setHex(updates.active ? 0x00ff88 : 0xff6b6b);
      body.material.emissive.setHex(updates.active ? 
        (userData.type === 'inlet' ? 0x003311 : 
         userData.type === 'outlet' ? 0x331111 : 0x332200) : 0x000000);
    }

    if (updates.openDegree !== undefined) {
      userData.openDegree = updates.openDegree;
      handle.rotation.z = (updates.openDegree / 100) * Math.PI / 2;
    }

    if (updates.flowRate !== undefined) {
      userData.flowRate = updates.flowRate;
    }
  }

  clearValves() {
    this.valveMeshes.forEach(({ group }) => {
      this.scene.remove(group);
    });
    this.valveMeshes.clear();
  }

  clearParticleSystems() {
    this.particleSystems.forEach(({ mesh }) => {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
    });
    this.particleSystems = [];
  }

  clearZones() {
    this.zoneMeshes.forEach(zone => {
      this.scene.remove(zone);
    });
    this.zoneMeshes = [];
  }

  clearAll() {
    this.clearValves();
    this.clearParticleSystems();
    this.clearZones();
  }

  updateParticles(delta) {
    this.particleSystems.forEach(system => {
      const positions = system.mesh.geometry.attributes.position.array;
      const lifetimes = system.mesh.geometry.attributes.lifetime.array;
      const particleCount = positions.length / 3;

      for (let i = 0; i < particleCount; i++) {
        lifetimes[i] += delta * 0.5;

        if (lifetimes[i] > 1) {
          lifetimes[i] = 0;
          positions[i * 3] = system.basePosition.x + (Math.random() - 0.5) * 0.3;
          positions[i * 3 + 1] = system.basePosition.y + (Math.random() - 0.5) * 0.3;
          positions[i * 3 + 2] = system.basePosition.z + (Math.random() - 0.5) * 0.3;
        } else {
          const vel = system.velocities[i];
          positions[i * 3] += vel.x * delta * system.valveData.flowRate;
          positions[i * 3 + 1] += vel.y * delta * system.valveData.flowRate;
          positions[i * 3 + 2] += vel.z * delta * system.valveData.flowRate;

          positions[i * 3 + 1] += Math.sin(Date.now() * 0.001 + i) * 0.01;
        }
      }

      system.mesh.geometry.attributes.position.needsUpdate = true;
      system.mesh.geometry.attributes.lifetime.needsUpdate = true;
      system.mesh.material.opacity = 0.6 + Math.sin(Date.now() * 0.003) * 0.2;
    });
  }

  setView(view) {
    const views = {
      front: { pos: [0, 3, 15], target: [0, 0, 0] },
      side: { pos: [15, 3, 0], target: [0, 0, 0] },
      top: { pos: [0, 15, 0.1], target: [0, 0, 0] },
      free: { pos: [8, 8, 12], target: [0, 0, 0] }
    };

    const viewConfig = views[view] || views.free;
    this.camera.position.set(...viewConfig.pos);
    this.controls.target.set(...viewConfig.target);
    this.controls.update();
  }

  onResize() {
    const { clientWidth, clientHeight } = this.container;
    this.camera.aspect = clientWidth / clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(clientWidth, clientHeight);
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    
    const delta = this.clock.getDelta();
    this.updateParticles(delta);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  getSnapshot() {
    return {
      camera: {
        position: this.camera.position.clone(),
        target: this.controls.target.clone()
      }
    };
  }

  restoreSnapshot(snapshot) {
    if (snapshot.camera) {
      this.camera.position.copy(snapshot.camera.position);
      this.controls.target.copy(snapshot.camera.target);
      this.controls.update();
    }
  }
}
