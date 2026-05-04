class ClimbingVisualizer {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.raycaster = null;
    this.mouse = null;
    
    this.wallMeshes = new Map();
    this.holdMeshes = new Map();
    this.routeLines = new Map();
    this.holdDataMap = new Map();
    
    this.isDragging = false;
    this.previousMousePosition = { x: 0, y: 0 };
    
    this.init();
  }

  init() {
    const canvas = document.getElementById('threeCanvas');
    const container = canvas.parentElement;
    
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0f172a);

    this.camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 2, 8);
    this.camera.lookAt(0, 2, 0);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.addLights();
    this.addGrid();
    
    this.setupEventListeners();
    
    this.render();
    this.animate();
  }

  addLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    this.scene.add(directionalLight);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
    directionalLight2.position.set(-5, 5, -5);
    this.scene.add(directionalLight2);
  }

  addGrid() {
    const gridHelper = new THREE.GridHelper(20, 20, 0x334155, 0x1e293b);
    gridHelper.position.y = -0.1;
    this.scene.add(gridHelper);
  }

  setupEventListeners() {
    const canvas = this.renderer.domElement;
    const container = canvas.parentElement;

    window.addEventListener('resize', () => this.onWindowResize());

    canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    canvas.addEventListener('mouseup', () => this.onMouseUp());
    canvas.addEventListener('wheel', (e) => this.onWheel(e));

    canvas.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
    canvas.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
    canvas.addEventListener('touchend', () => this.onTouchEnd());
  }

  onWindowResize() {
    const container = this.renderer.domElement.parentElement;
    this.camera.aspect = container.clientWidth / container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(container.clientWidth, container.clientHeight);
  }

  getCanvasMousePosition(event) {
    const canvas = this.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
      y: -((event.clientY - rect.top) / rect.height) * 2 + 1
    };
  }

  onMouseDown(event) {
    this.isDragging = true;
    this.previousMousePosition = {
      x: event.clientX,
      y: event.clientY
    };
  }

  onMouseMove(event) {
    const pos = this.getCanvasMousePosition(event);
    this.mouse.x = pos.x;
    this.mouse.y = pos.y;

    if (this.isDragging) {
      const deltaX = event.clientX - this.previousMousePosition.x;
      const deltaY = event.clientY - this.previousMousePosition.y;

      const spherical = new THREE.Spherical();
      spherical.setFromVector3(this.camera.position);
      spherical.theta -= deltaX * 0.01;
      spherical.phi += deltaY * 0.01;
      spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));

      this.camera.position.setFromSpherical(spherical);
      this.camera.lookAt(0, 2, 0);

      this.previousMousePosition = {
        x: event.clientX,
        y: event.clientY
      };
    }
  }

  onMouseUp() {
    if (!this.isDragging) return;
    this.isDragging = false;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    const holdMeshes = Array.from(this.holdMeshes.values());
    const intersects = this.raycaster.intersectObjects(holdMeshes, true);

    if (intersects.length > 0) {
      let selectedMesh = intersects[0].object;
      while (selectedMesh.parent && !this.holdDataMap.has(selectedMesh)) {
        selectedMesh = selectedMesh.parent;
      }

      if (this.holdDataMap.has(selectedMesh)) {
        const holdData = this.holdDataMap.get(selectedMesh);
        if (app) {
          app.selectHold(holdData);
        }
        this.highlightHold(selectedMesh);
      }
    } else {
      this.clearHighlight();
    }
  }

  onWheel(event) {
    event.preventDefault();
    const delta = event.deltaY > 0 ? 1 : -1;
    const distance = this.camera.position.length();
    const newDistance = Math.max(2, Math.min(20, distance + delta * 0.5));
    
    const direction = this.camera.position.clone().normalize();
    this.camera.position.copy(direction.multiplyScalar(newDistance));
  }

  onTouchStart(event) {
    event.preventDefault();
    if (event.touches.length === 1) {
      this.isDragging = true;
      this.previousMousePosition = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY
      };
    }
  }

  onTouchMove(event) {
    event.preventDefault();
    if (this.isDragging && event.touches.length === 1) {
      const deltaX = event.touches[0].clientX - this.previousMousePosition.x;
      const deltaY = event.touches[0].clientY - this.previousMousePosition.y;

      const spherical = new THREE.Spherical();
      spherical.setFromVector3(this.camera.position);
      spherical.theta -= deltaX * 0.01;
      spherical.phi += deltaY * 0.01;
      spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));

      this.camera.position.setFromSpherical(spherical);
      this.camera.lookAt(0, 2, 0);

      this.previousMousePosition = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY
      };
    }
  }

  onTouchEnd() {
    this.isDragging = false;
  }

  highlightHold(mesh) {
    this.clearHighlight();
    if (mesh.userData.originalMaterial) {
      mesh.material = new THREE.MeshStandardMaterial({
        color: 0x6366f1,
        emissive: 0x6366f1,
        emissiveIntensity: 0.5
      });
    }
  }

  clearHighlight() {
    this.holdMeshes.forEach((mesh) => {
      if (mesh.userData.originalMaterial) {
        mesh.material = mesh.userData.originalMaterial.clone();
      }
    });
  }

  createWall(wall) {
    const { width, height, depth = 0.2, position, rotation, isKidsArea } = wall;
    
    const geometry = new THREE.BoxGeometry(width, height, depth);
    
    const material = new THREE.MeshStandardMaterial({
      color: isKidsArea ? 0x3b82f6 : 0x475569,
      roughness: 0.8,
      metalness: 0.1
    });

    const wallMesh = new THREE.Mesh(geometry, material);
    wallMesh.receiveShadow = true;
    wallMesh.position.set(
      position?.x || 0,
      (position?.y || 0) + height / 2,
      position?.z || 0
    );

    if (rotation) {
      wallMesh.rotation.set(rotation.x || 0, rotation.y || 0, rotation.z || 0);
    }

    if (isKidsArea) {
      const edges = new THREE.EdgesGeometry(geometry);
      const lineMaterial = new THREE.LineBasicMaterial({ color: 0x60a5fa, linewidth: 2 });
      const wireframe = new THREE.LineSegments(edges, lineMaterial);
      wallMesh.add(wireframe);
    }

    this.scene.add(wallMesh);
    this.wallMeshes.set(wall.id, wallMesh);

    return wallMesh;
  }

  createHold(hold, wall) {
    const { position, color, size = 'medium', type = 'jug' } = hold;
    
    let holdSize = 0.15;
    if (size === 'small') holdSize = 0.1;
    else if (size === 'large') holdSize = 0.2;

    let geometry;
    switch (type) {
      case 'jug':
        geometry = new THREE.SphereGeometry(holdSize, 16, 16);
        break;
      case 'crimp':
        geometry = new THREE.BoxGeometry(holdSize, holdSize * 0.6, holdSize * 0.5);
        break;
      case 'sloper':
        geometry = new THREE.SphereGeometry(holdSize, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
        break;
      case 'pocket':
        geometry = new THREE.CylinderGeometry(holdSize * 0.5, holdSize * 0.7, holdSize * 0.8, 8);
        break;
      default:
        geometry = new THREE.SphereGeometry(holdSize, 16, 16);
    }

    const material = new THREE.MeshStandardMaterial({
      color: color || 0xffffff,
      roughness: 0.5,
      metalness: 0.2
    });

    const holdMesh = new THREE.Mesh(geometry, material);
    holdMesh.castShadow = true;
    holdMesh.receiveShadow = true;
    
    const wallOffset = (wall?.depth || 0.2) / 2 + 0.05;
    
    holdMesh.position.set(
      position?.x || 0,
      position?.y || 0,
      (position?.z || 0) + wallOffset
    );

    holdMesh.userData.originalMaterial = material.clone();

    this.scene.add(holdMesh);
    this.holdMeshes.set(hold.id, holdMesh);
    this.holdDataMap.set(holdMesh, hold);

    return holdMesh;
  }

  createRouteLine(route) {
    if (!route.holdIds || route.holdIds.length < 2) return null;

    const points = [];
    
    for (const holdId of route.holdIds) {
      const holdMesh = this.holdMeshes.get(holdId);
      if (holdMesh) {
        points.push(holdMesh.position.clone());
      }
    }

    if (points.length < 2) return null;

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: route.color || 0xff4444,
      linewidth: 3,
      transparent: true,
      opacity: 0.8
    });

    const line = new THREE.Line(geometry, material);
    this.scene.add(line);
    this.routeLines.set(route.id, line);

    return line;
  }

  clearScene() {
    this.holdMeshes.forEach((mesh) => {
      this.scene.remove(mesh);
    });
    this.holdMeshes.clear();
    this.holdDataMap.clear();

    this.wallMeshes.forEach((mesh) => {
      this.scene.remove(mesh);
    });
    this.wallMeshes.clear();

    this.routeLines.forEach((line) => {
      this.scene.remove(line);
    });
    this.routeLines.clear();
  }

  render() {
    this.clearScene();

    if (!app) return;

    app.state.walls.forEach((wall) => {
      this.createWall(wall);
    });

    let holdsToRender = app.state.holds;
    if (app.state.selectedWall) {
      holdsToRender = holdsToRender.filter(h => h.wallId === app.state.selectedWall.id);
    }

    holdsToRender.forEach((hold) => {
      const wall = app.state.walls.find(w => w.id === hold.wallId);
      this.createHold(hold, wall);
    });

    let routesToRender = app.state.routes;
    if (app.state.selectedWall) {
      routesToRender = routesToRender.filter(r => r.wallId === app.state.selectedWall.id);
    }

    routesToRender.forEach((route) => {
      this.createRouteLine(route);
    });

    if (app.state.routeCreationHolds && app.state.routeCreationHolds.length > 0) {
      app.state.routeCreationHolds.forEach((hold, index) => {
        let holdMesh = this.holdMeshes.get(hold.id);
        if (holdMesh && holdMesh.userData.originalMaterial) {
          holdMesh.material = new THREE.MeshStandardMaterial({
            color: 0x6366f1,
            emissive: 0x6366f1,
            emissiveIntensity: 0.3
          });
        }
      });

      if (app.state.routeCreationHolds.length >= 2) {
        const points = app.state.routeCreationHolds.map(hold => {
          const mesh = this.holdMeshes.get(hold.id);
          return mesh ? mesh.position.clone() : new THREE.Vector3();
        });
        
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineDashedMaterial({
          color: 0x6366f1,
          linewidth: 2,
          dashSize: 0.2,
          gapSize: 0.1
        });
        
        const previewLine = new THREE.Line(geometry, material);
        previewLine.computeLineDistances();
        this.scene.add(previewLine);
      }
    }

    if (app.state.selectedRoute) {
      const line = this.routeLines.get(app.state.selectedRoute.id);
      if (line) {
        line.material = new THREE.LineBasicMaterial({
          color: 0x6366f1,
          linewidth: 4,
          transparent: true,
          opacity: 1
        });
      }
    }

    this.animate();
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    this.renderer.render(this.scene, this.camera);
  }
}

const visualizer = new ClimbingVisualizer();
if (app) {
  app.visualizer = visualizer;
}
