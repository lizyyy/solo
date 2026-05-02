import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GeometryCalculator } from '../geometry/index.js';

export class SceneRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.geometryCalculator = new GeometryCalculator();
    
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    
    this.objects = {
      walls: [],
      pillars: [],
      cameras: [],
      parkings: [],
      passages: []
    };
    
    this.meshes = [];
    this.heatMapMesh = null;
    this.selectedObject = null;
    this.animationId = null;
    
    this.materials = this.createMaterials();
    
    this.init();
  }

  createMaterials() {
    return {
      ground: new THREE.MeshStandardMaterial({ 
        color: 0x2a2a3e,
        roughness: 0.9,
        metalness: 0.1
      }),
      wall: new THREE.MeshStandardMaterial({ 
        color: 0x666688,
        roughness: 0.8,
        metalness: 0.2
      }),
      wallSelected: new THREE.MeshStandardMaterial({ 
        color: 0x8888ff,
        roughness: 0.8,
        metalness: 0.2,
        emissive: 0x222244
      }),
      pillar: new THREE.MeshStandardMaterial({ 
        color: 0x886644,
        roughness: 0.7,
        metalness: 0.3
      }),
      pillarSelected: new THREE.MeshStandardMaterial({ 
        color: 0xaa8866,
        roughness: 0.7,
        metalness: 0.3,
        emissive: 0x221100
      }),
      parking: new THREE.MeshStandardMaterial({ 
        color: 0x335544,
        roughness: 0.9,
        metalness: 0.1
      }),
      parkingSelected: new THREE.MeshStandardMaterial({ 
        color: 0x447766,
        roughness: 0.9,
        metalness: 0.1,
        emissive: 0x112211
      }),
      passage: new THREE.MeshStandardMaterial({ 
        color: 0x444466,
        roughness: 0.9,
        metalness: 0.1
      }),
      passageSelected: new THREE.MeshStandardMaterial({ 
        color: 0x555577,
        roughness: 0.9,
        metalness: 0.1,
        emissive: 0x111122
      }),
      camera: new THREE.MeshStandardMaterial({ 
        color: 0xffffff,
        roughness: 0.5,
        metalness: 0.8
      }),
      cameraSelected: new THREE.MeshStandardMaterial({ 
        color: 0xffaa00,
        roughness: 0.5,
        metalness: 0.8,
        emissive: 0x332200
      }),
      frustum: new THREE.MeshBasicMaterial({
        color: 0x00aaff,
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide
      }),
      frustumLine: new THREE.LineBasicMaterial({
        color: 0x00aaff,
        transparent: true,
        opacity: 0.8
      }),
      grid: new THREE.GridHelper(100, 100, 0x444444, 0x222222)
    };
  }

  init() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a1a);
    this.scene.fog = new THREE.Fog(0x0a0a1a, 50, 150);

    this.camera = new THREE.PerspectiveCamera(
      60,
      rect.width / rect.height,
      0.1,
      1000
    );
    this.camera.position.set(30, 40, 30);

    this.renderer = new THREE.WebGLRenderer({ 
      canvas: this.canvas, 
      antialias: true 
    });
    this.renderer.setSize(rect.width, rect.height);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.screenSpacePanning = false;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 200;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.1;

    this.setupLighting();
    this.createGround();
    this.createGrid();

    window.addEventListener('resize', () => this.onWindowResize());
    
    this.animate();
  }

  setupLighting() {
    const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    this.scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
    mainLight.position.set(50, 100, 50);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 500;
    mainLight.shadow.camera.left = -100;
    mainLight.shadow.camera.right = 100;
    mainLight.shadow.camera.top = 100;
    mainLight.shadow.camera.bottom = -100;
    this.scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0x6688cc, 0.3);
    fillLight.position.set(-50, 50, -50);
    this.scene.add(fillLight);

    const hemiLight = new THREE.HemisphereLight(0x888899, 0x222233, 0.3);
    this.scene.add(hemiLight);
  }

  createGround() {
    const groundGeometry = new THREE.PlaneGeometry(200, 200);
    const ground = new THREE.Mesh(groundGeometry, this.materials.ground);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.userData.type = 'ground';
    this.scene.add(ground);
  }

  createGrid() {
    const grid = this.materials.grid;
    this.scene.add(grid);
  }

  createWall(data) {
    const { id, position, width, height, depth, rotation = 0 } = data;
    
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const mesh = new THREE.Mesh(geometry, this.materials.wall);
    
    mesh.position.set(position.x, height / 2, position.z);
    mesh.rotation.y = rotation;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    mesh.userData = {
      id,
      type: 'wall',
      data: { ...data },
      originalMaterial: this.materials.wall,
      selectedMaterial: this.materials.wallSelected
    };

    this.scene.add(mesh);
    this.meshes.push(mesh);
    this.objects.walls.push({ id, mesh, data: { ...data } });

    return mesh;
  }

  createPillar(data) {
    const { id, position, radius, height } = data;
    
    const geometry = new THREE.CylinderGeometry(radius, radius, height, 8);
    const mesh = new THREE.Mesh(geometry, this.materials.pillar);
    
    mesh.position.set(position.x, height / 2, position.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    mesh.userData = {
      id,
      type: 'pillar',
      data: { ...data },
      originalMaterial: this.materials.pillar,
      selectedMaterial: this.materials.pillarSelected
    };

    this.scene.add(mesh);
    this.meshes.push(mesh);
    this.objects.pillars.push({ id, mesh, data: { ...data } });

    return mesh;
  }

  createCamera(data) {
    const { id, position, rotation = { x: 0, y: 0, z: 0 }, fov = 60, far = 50, height = 3 } = data;
    
    const group = new THREE.Group();
    
    const bodyGeometry = new THREE.BoxGeometry(0.6, 0.4, 1.0);
    const body = new THREE.Mesh(bodyGeometry, this.materials.camera);
    body.position.set(0, 0, 0);
    body.castShadow = true;
    group.add(body);
    
    const lensGeometry = new THREE.CylinderGeometry(0.15, 0.15, 0.2, 16);
    const lens = new THREE.Mesh(lensGeometry, this.materials.camera);
    lens.position.set(0, 0, -0.6);
    lens.rotation.x = Math.PI / 2;
    lens.castShadow = true;
    group.add(lens);
    
    const indicatorGeometry = new THREE.SphereGeometry(0.05, 8, 8);
    const indicatorMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const indicator = new THREE.Mesh(indicatorGeometry, indicatorMaterial);
    indicator.position.set(0, 0.25, 0.3);
    group.add(indicator);
    
    group.position.set(position.x, height, position.z);
    group.rotation.set(rotation.x, rotation.y, rotation.z);
    
    group.userData = {
      id,
      type: 'camera',
      data: { ...data, height },
      originalMaterial: this.materials.camera,
      selectedMaterial: this.materials.cameraSelected,
      frustumMesh: null,
      frustumLine: null
    };

    this.scene.add(group);
    this.meshes.push(group);
    this.objects.cameras.push({ id, mesh: group, data: { ...data, height } });
    
    this.createCameraFrustum(group, fov, far);

    return group;
  }

  createCameraFrustum(cameraGroup, fov, far) {
    const data = cameraGroup.userData.data;
    const viewFrustum = this.geometryCalculator.calculateViewFrustum(
      cameraGroup.position,
      cameraGroup.rotation,
      fov,
      data.aspect || 16/9,
      data.near || 0.1,
      far
    );

    if (cameraGroup.userData.frustumMesh) {
      this.scene.remove(cameraGroup.userData.frustumMesh);
    }
    if (cameraGroup.userData.frustumLine) {
      this.scene.remove(cameraGroup.userData.frustumLine);
    }

    const vertices = viewFrustum.vertices;
    const positions = new Float32Array(vertices.length * 3);
    
    for (let i = 0; i < vertices.length; i++) {
      positions[i * 3] = vertices[i].x;
      positions[i * 3 + 1] = vertices[i].y;
      positions[i * 3 + 2] = vertices[i].z;
    }

    const faces = [
      0, 1, 2, 0, 2, 3,
      4, 6, 5, 4, 7, 6,
      0, 4, 5, 0, 5, 1,
      2, 6, 7, 2, 7, 3,
      0, 3, 7, 0, 7, 4,
      1, 5, 6, 1, 6, 2
    ];

    const frustumGeometry = new THREE.BufferGeometry();
    frustumGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    frustumGeometry.setIndex(faces);
    frustumGeometry.computeVertexNormals();

    const frustumMesh = new THREE.Mesh(frustumGeometry, this.materials.frustum);
    this.scene.add(frustumMesh);

    const lineIndices = [
      0, 1, 1, 2, 2, 3, 3, 0,
      4, 5, 5, 6, 6, 7, 7, 4,
      0, 4, 1, 5, 2, 6, 3, 7
    ];
    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    lineGeometry.setIndex(lineIndices);

    const frustumLine = new THREE.LineSegments(lineGeometry, this.materials.frustumLine);
    this.scene.add(frustumLine);

    cameraGroup.userData.frustumMesh = frustumMesh;
    cameraGroup.userData.frustumLine = frustumLine;
  }

  createParking(data) {
    const { id, position, width, depth, rotation = 0, label = '' } = data;
    
    const geometry = new THREE.BoxGeometry(width, 0.2, depth);
    const mesh = new THREE.Mesh(geometry, this.materials.parking);
    
    mesh.position.set(position.x, 0.1, position.z);
    mesh.rotation.y = rotation;
    mesh.receiveShadow = true;
    
    mesh.userData = {
      id,
      type: 'parking',
      data: { ...data, label },
      originalMaterial: this.materials.parking,
      selectedMaterial: this.materials.parkingSelected
    };

    this.scene.add(mesh);
    this.meshes.push(mesh);
    this.objects.parkings.push({ id, mesh, data: { ...data, label } });

    return mesh;
  }

  createPassage(data) {
    const { id, position, width, depth, rotation = 0, isCritical = false } = data;
    
    const geometry = new THREE.BoxGeometry(width, 0.15, depth);
    const material = isCritical 
      ? new THREE.MeshStandardMaterial({ color: 0x554433, roughness: 0.9, metalness: 0.1 })
      : this.materials.passage;
    
    const mesh = new THREE.Mesh(geometry, material);
    
    mesh.position.set(position.x, 0.075, position.z);
    mesh.rotation.y = rotation;
    mesh.receiveShadow = true;
    
    mesh.userData = {
      id,
      type: 'passage',
      data: { ...data, isCritical },
      originalMaterial: material,
      selectedMaterial: this.materials.passageSelected
    };

    this.scene.add(mesh);
    this.meshes.push(mesh);
    this.objects.passages.push({ id, mesh, data: { ...data, isCritical } });

    return mesh;
  }

  updateCameraFrustum(cameraMesh) {
    const data = cameraMesh.userData.data;
    this.createCameraFrustum(
      cameraMesh,
      data.fov || 60,
      data.far || 50
    );
  }

  updateAllCameraFrustums() {
    for (const cameraObj of this.objects.cameras) {
      this.updateCameraFrustum(cameraObj.mesh);
    }
  }

  createHeatMap(heatMapData) {
    if (this.heatMapMesh) {
      this.scene.remove(this.heatMapMesh);
    }

    const { heatData, gridSize, bounds, maxCoverage } = heatMapData;
    const width = bounds.maxX - bounds.minX;
    const depth = bounds.maxZ - bounds.minZ;

    const canvas = document.createElement('canvas');
    canvas.width = gridSize;
    canvas.height = gridSize;
    const ctx = canvas.getContext('2d');

    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        const data = heatData[i * gridSize + j];
        const color = this.getHeatColor(data.coverageCount, maxCoverage);
        ctx.fillStyle = color;
        ctx.fillRect(i, j, 1, 1);
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    const geometry = new THREE.PlaneGeometry(width, depth);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.6,
      depthWrite: false
    });

    const heatMapMesh = new THREE.Mesh(geometry, material);
    heatMapMesh.rotation.x = -Math.PI / 2;
    heatMapMesh.position.set(
      (bounds.minX + bounds.maxX) / 2,
      0.3,
      (bounds.minZ + bounds.maxZ) / 2
    );

    this.scene.add(heatMapMesh);
    this.heatMapMesh = heatMapMesh;

    return heatMapMesh;
  }

  getHeatColor(count, maxCount) {
    if (count === 0) {
      return 'rgba(255, 0, 0, 0.7)';
    }
    
    const ratio = count / Math.max(maxCount, 1);
    
    if (ratio < 0.3) {
      return `rgba(255, ${Math.floor(255 * ratio / 0.3)}, 0, 0.5)`;
    } else if (ratio < 0.6) {
      const g = Math.floor(255 * (ratio - 0.3) / 0.3);
      return `rgba(255, 255, ${g}, 0.5)`;
    } else {
      const r = Math.floor(255 * (1 - (ratio - 0.6) / 0.4));
      return `rgba(${r}, 255, 0, 0.5)`;
    }
  }

  clearHeatMap() {
    if (this.heatMapMesh) {
      this.scene.remove(this.heatMapMesh);
      this.heatMapMesh = null;
    }
  }

  selectObject(mesh) {
    if (this.selectedObject) {
      if (this.selectedObject.userData.type === 'camera') {
        this.selectedObject.traverse((child) => {
          if (child.isMesh && child.material !== this.selectedObject.userData.indicatorMaterial) {
            child.material = child.userData?.originalMaterial || this.selectedObject.userData.originalMaterial;
          }
        });
      } else if (this.selectedObject.isMesh) {
        this.selectedObject.material = this.selectedObject.userData.originalMaterial;
      }
    }

    this.selectedObject = mesh;

    if (mesh) {
      if (mesh.userData.type === 'camera') {
        mesh.traverse((child) => {
          if (child.isMesh && child.material !== mesh.userData.indicatorMaterial) {
            child.material = child.userData?.selectedMaterial || mesh.userData.selectedMaterial;
          }
        });
      } else if (mesh.isMesh) {
        mesh.material = mesh.userData.selectedMaterial;
      }
    }
  }

  deleteObject(mesh) {
    const type = mesh.userData.type;
    const id = mesh.userData.id;

    if (type === 'camera') {
      if (mesh.userData.frustumMesh) {
        this.scene.remove(mesh.userData.frustumMesh);
      }
      if (mesh.userData.frustumLine) {
        this.scene.remove(mesh.userData.frustumLine);
      }
    }

    this.scene.remove(mesh);
    this.meshes = this.meshes.filter(m => m !== mesh);

    if (this.objects[type + 's']) {
      this.objects[type + 's'] = this.objects[type + 's'].filter(o => o.id !== id);
    }

    if (this.selectedObject === mesh) {
      this.selectedObject = null;
    }
  }

  clearScene() {
    for (const type in this.objects) {
      for (const obj of this.objects[type]) {
        if (obj.mesh.userData.type === 'camera') {
          if (obj.mesh.userData.frustumMesh) {
            this.scene.remove(obj.mesh.userData.frustumMesh);
          }
          if (obj.mesh.userData.frustumLine) {
            this.scene.remove(obj.mesh.userData.frustumLine);
          }
        }
        this.scene.remove(obj.mesh);
      }
    }

    this.objects = {
      walls: [],
      pillars: [],
      cameras: [],
      parkings: [],
      passages: []
    };
    this.meshes = [];
    this.selectedObject = null;

    this.clearHeatMap();
  }

  onWindowResize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.camera.aspect = rect.width / rect.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(rect.width, rect.height);
  }

  animate() {
    this.animationId = requestAnimationFrame(() => this.animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    this.renderer.dispose();
  }

  getObjectByTypeAndId(type, id) {
    const typePlural = type + 's';
    if (this.objects[typePlural]) {
      return this.objects[typePlural].find(o => o.id === id);
    }
    return null;
  }
}

export default SceneRenderer;
