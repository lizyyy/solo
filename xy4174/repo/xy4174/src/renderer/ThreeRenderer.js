import { Vector3, sceneManager } from '../models/SceneModel.js';
import { loadCalculator } from '../engine/LoadCalculator.js';
import { collisionDetector } from '../engine/CollisionDetector.js';

class ThreeRenderer {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.container = null;
    this.objects = {};
    this.animating = false;
    this.animationId = null;
    this.clock = null;
    
    this.meshes = {
      stage: null,
      hangingPoints: [],
      trusses: [],
      devices: [],
      obstacles: [],
      counterweights: [],
      centerOfGravity: null,
      grid: null,
      loadIndicators: []
    };
  }

  init(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error('Container not found:', containerId);
      return false;
    }

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);

    const aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
    this.camera.position.set(20, 15, 20);
    this.camera.lookAt(0, 5, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    this.initControls();
    this.initLights();
    this.initGrid();
    this.initEventListeners();

    this.clock = new THREE.Clock();
    this.animating = true;
    this.animate();

    return true;
  }

  initControls() {
    if (THREE.OrbitControls) {
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
      this.controls.screenSpacePanning = false;
      this.controls.minDistance = 5;
      this.controls.maxDistance = 100;
      this.controls.maxPolarAngle = Math.PI / 2;
    }
  }

  initLights() {
    const ambientLight = new THREE.AmbientLight(0x404060, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 100;
    directionalLight.shadow.camera.left = -30;
    directionalLight.shadow.camera.right = 30;
    directionalLight.shadow.camera.top = 30;
    directionalLight.shadow.camera.bottom = -30;
    this.scene.add(directionalLight);

    const fillLight = new THREE.DirectionalLight(0x6688cc, 0.3);
    fillLight.position.set(-10, 10, -10);
    this.scene.add(fillLight);

    const hemiLight = new THREE.HemisphereLight(0x6688cc, 0x446633, 0.4);
    this.scene.add(hemiLight);
  }

  initGrid() {
    const gridHelper = new THREE.GridHelper(50, 50, 0x444466, 0x333355);
    gridHelper.position.y = 0.01;
    this.scene.add(gridHelper);
    this.meshes.grid = gridHelper;

    const axisHelper = new THREE.AxesHelper(5);
    axisHelper.position.y = 0.02;
    this.scene.add(axisHelper);
  }

  initEventListeners() {
    window.addEventListener('resize', () => this.onWindowResize());
  }

  onWindowResize() {
    if (!this.container) return;
    
    this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
  }

  renderScene(sceneData = null) {
    const targetScene = sceneData || sceneManager.currentScene;
    
    this.clearMeshes();
    
    this.renderStage(targetScene.stage);
    this.renderHangingPoints(targetScene.hangingPoints);
    this.renderTrusses(targetScene.trusses, targetScene);
    this.renderDevices(targetScene.devices);
    this.renderObstacles(targetScene.obstacles);
    this.renderCounterweights(targetScene.counterweights);
    
    this.updateLoadIndicators(targetScene);
    this.renderCenterOfGravity(targetScene);
    this.renderHangingLines(targetScene);
  }

  clearMeshes() {
    const meshesToRemove = [
      ...this.meshes.hangingPoints,
      ...this.meshes.trusses,
      ...this.meshes.devices,
      ...this.meshes.obstacles,
      ...this.meshes.counterweights,
      ...this.meshes.loadIndicators,
      this.meshes.stage,
      this.meshes.centerOfGravity
    ];

    for (const mesh of meshesToRemove) {
      if (mesh) {
        this.scene.remove(mesh);
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach(m => m.dispose());
          } else {
            mesh.material.dispose();
          }
        }
      }
    }

    this.meshes.hangingPoints = [];
    this.meshes.trusses = [];
    this.meshes.devices = [];
    this.meshes.obstacles = [];
    this.meshes.counterweights = [];
    this.meshes.loadIndicators = [];
    this.meshes.stage = null;
    this.meshes.centerOfGravity = null;
  }

  renderStage(stage) {
    const geometry = new THREE.BoxGeometry(stage.width, 0.3, stage.depth);
    const material = new THREE.MeshStandardMaterial({
      color: 0x556677,
      metalness: 0.1,
      roughness: 0.8,
      side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(
      stage.position.x,
      stage.position.y + 0.15,
      stage.position.z
    );
    mesh.receiveShadow = true;
    mesh.userData = { type: 'stage', id: stage.id, object: stage };
    
    this.scene.add(mesh);
    this.meshes.stage = mesh;

    const edgeGeometry = new THREE.EdgesGeometry(geometry);
    const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x8899aa });
    const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    edges.position.copy(mesh.position);
    this.scene.add(edges);
  }

  renderHangingPoints(hangingPoints) {
    const loadResult = loadCalculator.lastResult || loadCalculator.calculate();
    
    for (const point of hangingPoints) {
      const loadInfo = loadResult.hangingPointLoads[point.id];
      const isOverloaded = loadInfo ? loadInfo.isOverloaded : false;
      const percentage = loadInfo ? loadInfo.percentage : 0;

      let color = point.color;
      let emissive = 0x000000;
      
      if (isOverloaded) {
        color = 0xff3333;
        emissive = 0x331111;
      } else if (percentage > 80) {
        color = 0xffaa00;
        emissive = 0x332200;
      }

      const group = new THREE.Group();
      
      const bodyGeometry = new THREE.CylinderGeometry(0.15, 0.15, 0.4, 16);
      const bodyMaterial = new THREE.MeshStandardMaterial({
        color: color,
        metalness: 0.6,
        roughness: 0.3,
        emissive: emissive
      });
      const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
      bodyMesh.position.y = 0;
      bodyMesh.castShadow = true;
      group.add(bodyMesh);

      const hookGeometry = new THREE.CylinderGeometry(0.05, 0.02, 0.6, 8);
      const hookMaterial = new THREE.MeshStandardMaterial({
        color: 0x888888,
        metalness: 0.8,
        roughness: 0.2
      });
      const hookMesh = new THREE.Mesh(hookGeometry, hookMaterial);
      hookMesh.position.y = -0.5;
      hookMesh.castShadow = true;
      group.add(hookMesh);

      const topPlateGeometry = new THREE.CylinderGeometry(0.25, 0.2, 0.1, 16);
      const topPlateMaterial = new THREE.MeshStandardMaterial({
        color: 0x666666,
        metalness: 0.7,
        roughness: 0.3
      });
      const topPlateMesh = new THREE.Mesh(topPlateGeometry, topPlateMaterial);
      topPlateMesh.position.y = 0.25;
      topPlateMesh.castShadow = true;
      group.add(topPlateMesh);

      group.position.set(
        point.position.x,
        point.position.y,
        point.position.z
      );
      
      group.userData = { type: 'hangingPoint', id: point.id, object: point };
      
      this.scene.add(group);
      this.meshes.hangingPoints.push(group);
    }
  }

  renderTrusses(trusses, scene) {
    for (const truss of trusses) {
      const group = new THREE.Group();
      
      const trussType = truss.type;
      const length = truss.length;
      const width = truss.width;
      const height = truss.height;

      const tubeMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color(truss.color),
        metalness: 0.7,
        roughness: 0.3
      });

      const tubeRadius = 0.025;
      const tubeSegments = 12;

      const halfLen = length / 2;
      const halfW = width / 2;
      const halfH = height / 2;

      const corners = [
        new THREE.Vector3(-halfLen, -halfH, -halfW),
        new THREE.Vector3(-halfLen, -halfH, halfW),
        new THREE.Vector3(-halfLen, halfH, -halfW),
        new THREE.Vector3(-halfLen, halfH, halfW),
        new THREE.Vector3(halfLen, -halfH, -halfW),
        new THREE.Vector3(halfLen, -halfH, halfW),
        new THREE.Vector3(halfLen, halfH, -halfW),
        new THREE.Vector3(halfLen, halfH, halfW)
      ];

      const longEdges = [
        [0, 4], [1, 5], [2, 6], [3, 7]
      ];

      for (const [i, j] of longEdges) {
        const tube = this.createTube(corners[i], corners[j], tubeRadius, tubeMaterial);
        group.add(tube);
      }

      const shortEdges = [
        [0, 1], [0, 2], [1, 3], [2, 3],
        [4, 5], [4, 6], [5, 7], [6, 7],
        [0, 3], [4, 7], [1, 2], [5, 6]
      ];

      const tubeMaterialDark = new THREE.MeshStandardMaterial({
        color: 0x888888,
        metalness: 0.6,
        roughness: 0.4
      });

      for (const [i, j] of shortEdges) {
        const tube = this.createTube(corners[i], corners[j], tubeRadius * 0.8, tubeMaterialDark);
        group.add(tube);
      }

      const deviceIds = truss.devices || [];
      for (const deviceId of deviceIds) {
        const device = scene.getDeviceById(deviceId);
        if (device) {
          device.position.x = THREE.MathUtils.clamp(
            device.position.x,
            truss.position.x - length / 2 + 0.3,
            truss.position.x + length / 2 - 0.3
          );
          device.position.y = truss.position.y + truss.height / 2;
          device.position.z = truss.position.z;
        }
      }

      group.position.set(
        truss.position.x,
        truss.position.y,
        truss.position.z
      );
      group.rotation.set(
        truss.rotation.x,
        truss.rotation.y,
        truss.rotation.z
      );
      
      group.userData = { type: 'truss', id: truss.id, object: truss };
      
      this.scene.add(group);
      this.meshes.trusses.push(group);
    }
  }

  createTube(start, end, radius, material) {
    const direction = new THREE.Vector3().subVectors(end, start);
    const length = direction.length();
    
    const geometry = new THREE.CylinderGeometry(radius, radius, length, 8);
    geometry.rotateX(Math.PI / 2);
    geometry.translate(0, 0, length / 2);
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(start);
    mesh.lookAt(end);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    return mesh;
  }

  renderDevices(devices) {
    const collisionResult = collisionDetector.lastResult || collisionDetector.detect();
    const collidedIds = new Set();
    
    for (const collision of collisionResult.collisions) {
      collidedIds.add(collision.obj1Id);
      collidedIds.add(collision.obj2Id);
    }

    for (const device of devices) {
      const group = new THREE.Group();
      
      const isCollided = collidedIds.has(device.id);
      const deviceColor = isCollided ? 0xff3333 : device.color;
      
      const dimensions = device.dimensions;
      
      if (device.type === 'light') {
        this.renderLightDevice(group, device, dimensions, deviceColor);
      } else {
        this.renderGenericDevice(group, device, dimensions, deviceColor);
      }

      group.position.set(
        device.position.x,
        device.position.y,
        device.position.z
      );
      group.rotation.set(
        device.rotation.x,
        device.rotation.y,
        device.rotation.z
      );
      
      group.userData = { type: 'device', id: device.id, object: device };
      
      this.scene.add(group);
      this.meshes.devices.push(group);
    }
  }

  renderLightDevice(group, device, dimensions, color) {
    const bodyGeometry = new THREE.BoxGeometry(dimensions.x, dimensions.y * 0.7, dimensions.z);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      metalness: 0.5,
      roughness: 0.5
    });
    const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
    bodyMesh.position.y = dimensions.y * 0.15;
    bodyMesh.castShadow = true;
    group.add(bodyMesh);

    const lensColor = new THREE.Color(color);
    const lensGeometry = new THREE.CylinderGeometry(dimensions.x * 0.4, dimensions.x * 0.35, dimensions.y * 0.3, 16);
    const lensMaterial = new THREE.MeshStandardMaterial({
      color: lensColor,
      metalness: 0.3,
      roughness: 0.2,
      emissive: lensColor,
      emissiveIntensity: 0.5
    });
    const lensMesh = new THREE.Mesh(lensGeometry, lensMaterial);
    lensMesh.position.y = -dimensions.y * 0.35;
    lensMesh.castShadow = true;
    group.add(lensMesh);

    const yokeGeometry = new THREE.TorusGeometry(dimensions.z * 0.35, 0.03, 8, 16, Math.PI);
    const yokeMaterial = new THREE.MeshStandardMaterial({
      color: 0x444444,
      metalness: 0.6,
      roughness: 0.4
    });
    const yokeMesh = new THREE.Mesh(yokeGeometry, yokeMaterial);
    yokeMesh.rotation.x = Math.PI / 2;
    yokeMesh.position.y = dimensions.y * 0.5;
    group.add(yokeMesh);
  }

  renderGenericDevice(group, device, dimensions, color) {
    const geometry = new THREE.BoxGeometry(dimensions.x, dimensions.y, dimensions.z);
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      metalness: 0.3,
      roughness: 0.6
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    const edgeGeometry = new THREE.EdgesGeometry(geometry);
    const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x666666 });
    const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    group.add(edges);
  }

  renderObstacles(obstacles) {
    for (const obstacle of obstacles) {
      const group = new THREE.Group();
      
      const dimensions = obstacle.dimensions;
      const color = obstacle.color;

      if (obstacle.type === 'curtain') {
        const geometry = new THREE.PlaneGeometry(dimensions.x, dimensions.y);
        const material = new THREE.MeshStandardMaterial({
          color: new THREE.Color(color),
          transparent: true,
          opacity: 0.7,
          side: THREE.DoubleSide
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.y = Math.PI / 2;
        group.add(mesh);

        const wireGeometry = new THREE.WireframeGeometry(new THREE.BoxGeometry(
          dimensions.x, dimensions.y, dimensions.z
        ));
        const wireMaterial = new THREE.LineBasicMaterial({
          color: new THREE.Color(color),
          transparent: true,
          opacity: 0.5
        });
        const wireframe = new THREE.LineSegments(wireGeometry, wireMaterial);
        group.add(wireframe);
      } else if (obstacle.type === 'sprinkler') {
        const pipeGeometry = new THREE.CylinderGeometry(0.05, 0.05, dimensions.x, 8);
        const pipeMaterial = new THREE.MeshStandardMaterial({
          color: 0xcc4444,
          metalness: 0.6,
          roughness: 0.4
        });
        const pipeMesh = new THREE.Mesh(pipeGeometry, pipeMaterial);
        pipeMesh.rotation.z = Math.PI / 2;
        group.add(pipeMesh);
      } else {
        const geometry = new THREE.BoxGeometry(dimensions.x, dimensions.y, dimensions.z);
        const material = new THREE.MeshStandardMaterial({
          color: new THREE.Color(color),
          transparent: true,
          opacity: 0.6,
          wireframe: true
        });
        const mesh = new THREE.Mesh(geometry, material);
        group.add(mesh);

        const solidGeometry = new THREE.BoxGeometry(dimensions.x, dimensions.y, dimensions.z);
        const solidMaterial = new THREE.MeshStandardMaterial({
          color: new THREE.Color(color),
          transparent: true,
          opacity: 0.2,
          side: THREE.DoubleSide
        });
        const solidMesh = new THREE.Mesh(solidGeometry, solidMaterial);
        group.add(solidMesh);
      }

      group.position.set(
        obstacle.position.x,
        obstacle.position.y,
        obstacle.position.z
      );
      group.rotation.set(
        obstacle.rotation.x,
        obstacle.rotation.y,
        obstacle.rotation.z
      );
      
      group.userData = { type: 'obstacle', id: obstacle.id, object: obstacle };
      
      this.scene.add(group);
      this.meshes.obstacles.push(group);
    }
  }

  renderCounterweights(counterweights) {
    for (const cw of counterweights) {
      const group = new THREE.Group();
      
      const weightSize = Math.max(0.3, Math.min(1.0, cw.weight / 100));
      
      const geometry = new THREE.BoxGeometry(weightSize, weightSize, weightSize);
      const material = new THREE.MeshStandardMaterial({
        color: cw.isRecommended ? 0x00aa88 : 0x666666,
        metalness: 0.8,
        roughness: 0.2
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      group.add(mesh);

      if (cw.isRecommended) {
        const ringGeometry = new THREE.RingGeometry(weightSize * 0.6, weightSize * 0.8, 32);
        const ringMaterial = new THREE.MeshBasicMaterial({
          color: 0x00ffaa,
          transparent: true,
          opacity: 0.5,
          side: THREE.DoubleSide
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = -weightSize / 2 - 0.01;
        group.add(ring);
      }

      group.position.set(
        cw.position.x,
        cw.position.y + weightSize / 2,
        cw.position.z
      );
      
      group.userData = { type: 'counterweight', id: cw.id, object: cw };
      
      this.scene.add(group);
      this.meshes.counterweights.push(group);
    }
  }

  renderCenterOfGravity(scene) {
    const loadResult = loadCalculator.lastResult || loadCalculator.calculate(scene);
    const cog = loadResult.centerOfGravity;
    
    if (loadResult.totalWeight === 0) return;

    const group = new THREE.Group();
    
    const isBalanced = loadResult.isBalanced;
    const color = isBalanced ? 0x00ff88 : 0xff8800;

    const sphereGeometry = new THREE.SphereGeometry(0.3, 16, 16);
    const sphereMaterial = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.7
    });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    group.add(sphere);

    const ringGeometry = new THREE.RingGeometry(0.3, 0.45, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.01;
    group.add(ring);

    const crossMaterial = new THREE.LineBasicMaterial({ color: color });
    
    const crossXGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-0.5, 0, 0),
      new THREE.Vector3(0.5, 0, 0)
    ]);
    group.add(new THREE.Line(crossXGeometry, crossMaterial));
    
    const crossZGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, -0.5),
      new THREE.Vector3(0, 0, 0.5)
    ]);
    group.add(new THREE.Line(crossZGeometry, crossMaterial));

    group.position.set(cog.x, cog.y, cog.z);
    group.userData = { type: 'centerOfGravity' };
    
    this.scene.add(group);
    this.meshes.centerOfGravity = group;
  }

  renderHangingLines(scene) {
    const material = new THREE.LineDashedMaterial({
      color: 0x446688,
      dashSize: 0.2,
      gapSize: 0.1
    });

    for (const truss of scene.trusses) {
      for (const pointId of truss.hangingPoints) {
        const point = scene.getHangingPointById(pointId);
        if (!point) continue;

        const points = [
          new THREE.Vector3(
            point.position.x,
            point.position.y - 0.8,
            point.position.z
          ),
          new THREE.Vector3(
            truss.position.x,
            truss.position.y + truss.height / 2,
            truss.position.z
          )
        ];

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geometry, material);
        line.computeLineDistances();
        
        this.scene.add(line);
        this.meshes.loadIndicators.push(line);
      }
    }
  }

  updateLoadIndicators(scene) {
    const loadResult = loadCalculator.lastResult || loadCalculator.calculate(scene);
    
    for (const point of scene.hangingPoints) {
      const loadInfo = loadResult.hangingPointLoads[point.id];
      if (!loadInfo) continue;

      const percentage = Math.min(100, loadInfo.percentage);
      let color;
      
      if (loadInfo.isOverloaded) {
        color = 0xff3333;
      } else if (percentage > 80) {
        color = 0xffaa00;
      } else {
        color = 0x00aa44;
      }

      const barHeight = (percentage / 100) * 2;
      const barGeometry = new THREE.BoxGeometry(0.3, barHeight, 0.3);
      const barMaterial = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.8
      });
      const bar = new THREE.Mesh(barGeometry, barMaterial);
      bar.position.set(
        point.position.x + 0.5,
        point.position.y - 1 - barHeight / 2,
        point.position.z
      );
      
      this.scene.add(bar);
      this.meshes.loadIndicators.push(bar);
    }
  }

  animate() {
    if (!this.animating) return;

    this.animationId = requestAnimationFrame(() => this.animate());

    const delta = this.clock.getDelta();
    
    if (this.controls) {
      this.controls.update();
    }

    if (this.meshes.centerOfGravity) {
      const time = this.clock.elapsedTime;
      this.meshes.centerOfGravity.scale.setScalar(1 + Math.sin(time * 2) * 0.1);
    }

    this.renderer.render(this.scene, this.camera);
  }

  stop() {
    this.animating = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
  }

  resize(width, height) {
    if (this.camera) {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    }
    if (this.renderer) {
      this.renderer.setSize(width, height);
    }
  }

  setView(view) {
    switch (view) {
      case 'top':
        this.camera.position.set(0, 30, 0.01);
        this.camera.lookAt(0, 0, 0);
        break;
      case 'front':
        this.camera.position.set(0, 10, 25);
        this.camera.lookAt(0, 5, 0);
        break;
      case 'side':
        this.camera.position.set(25, 10, 0);
        this.camera.lookAt(0, 5, 0);
        break;
      case 'perspective':
        this.camera.position.set(20, 15, 20);
        this.camera.lookAt(0, 5, 0);
        break;
    }
    
    if (this.controls) {
      this.controls.target.set(0, 5, 0);
      this.controls.update();
    }
  }

  getObjectAtPixel(x, y) {
    if (!this.camera || !this.renderer) return null;

    const rect = this.renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((x - rect.left) / rect.width) * 2 - 1,
      -((y - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, this.camera);

    const allMeshes = [];
    
    for (const group of this.meshes.hangingPoints) {
      allMeshes.push(...group.children);
    }
    for (const group of this.meshes.trusses) {
      allMeshes.push(...group.children);
    }
    for (const group of this.meshes.devices) {
      allMeshes.push(...group.children);
    }
    for (const group of this.meshes.obstacles) {
      allMeshes.push(...group.children);
    }
    for (const group of this.meshes.counterweights) {
      allMeshes.push(...group.children);
    }

    const intersects = raycaster.intersectObjects(allMeshes);
    
    if (intersects.length > 0) {
      let obj = intersects[0].object;
      while (obj.parent && !obj.userData.type) {
        obj = obj.parent;
      }
      return obj.userData;
    }

    return null;
  }
}

const threeRenderer = new ThreeRenderer();

export {
  ThreeRenderer,
  threeRenderer
};
