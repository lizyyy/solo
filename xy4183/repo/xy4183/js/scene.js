import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class Scene3D {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error('容器元素未找到: ' + containerId);
    }

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    
    this.terrain = null;
    this.facilityMeshes = [];
    this.hazardMarkers = [];
    this.routeLines = [];
    
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    
    this.currentViewMode = 'slope';
    this.onTerrainClick = null;
    this.onMarkerClick = null;
    
    this.animationId = null;
  }

  init() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB);
    this.scene.fog = new THREE.Fog(0x87CEEB, 1000, 5000);

    const aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 10000);
    this.camera.position.set(500, 300, 500);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.screenSpacePanning = true;
    this.controls.minDistance = 10;
    this.controls.maxDistance = 2000;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.1;

    this._setupLights();
    this._setupEventListeners();
    this._addGridHelper();
    this._startAnimation();

    return this;
  }

  _setupLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
    sunLight.position.set(500, 800, 500);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 5000;
    sunLight.shadow.camera.left = -1000;
    sunLight.shadow.camera.right = 1000;
    sunLight.shadow.camera.top = 1000;
    sunLight.shadow.camera.bottom = -1000;
    this.scene.add(sunLight);

    const hemiLight = new THREE.HemisphereLight(0x87CEEB, 0x2d5016, 0.3);
    this.scene.add(hemiLight);
  }

  _setupEventListeners() {
    window.addEventListener('resize', () => this._onWindowResize());
    
    this.renderer.domElement.addEventListener('click', (event) => this._onMouseClick(event));
    this.renderer.domElement.addEventListener('mousemove', (event) => this._onMouseMove(event));
  }

  _addGridHelper() {
    const gridHelper = new THREE.GridHelper(2000, 100, 0xcccccc, 0xe0e0e0);
    gridHelper.position.y = -1;
    this.scene.add(gridHelper);
  }

  _onWindowResize() {
    if (!this.camera || !this.renderer) return;
    
    this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
  }

  _onMouseClick(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    const markerIntersects = this.raycaster.intersectObjects(this.hazardMarkers, true);
    if (markerIntersects.length > 0) {
      if (this.onMarkerClick) {
        const marker = markerIntersects[0].object;
        this.onMarkerClick(marker.userData);
      }
      return;
    }

    if (this.terrain) {
      const terrainIntersects = this.raycaster.intersectObject(this.terrain);
      if (terrainIntersects.length > 0) {
        const point = terrainIntersects[0].point;
        if (this.onTerrainClick) {
          this.onTerrainClick({
            x: point.x,
            y: point.y,
            z: point.z
          });
        }
      }
    }
  }

  _onMouseMove(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  _startAnimation() {
    const animate = () => {
      this.animationId = requestAnimationFrame(animate);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }

  renderTerrain(elevationData, riskCalculator) {
    if (this.terrain) {
      this.scene.remove(this.terrain);
      this.terrain.geometry.dispose();
      this.terrain.material.dispose();
    }

    const { points, gridSize, bounds } = elevationData;
    const { cols, rows, cellSize } = gridSize;

    const geometry = new THREE.PlaneGeometry(
      (cols - 1) * cellSize,
      (rows - 1) * cellSize,
      cols - 1,
      rows - 1
    );
    geometry.rotateX(-Math.PI / 2);

    const positions = geometry.attributes.position.array;
    
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      const localX = point.x - bounds.minX;
      const localY = point.y - bounds.minY;
      
      const index = (Math.round(localY / cellSize) * cols + Math.round(localX / cellSize)) * 3;
      if (index + 2 < positions.length) {
        positions[index + 2] = point.z;
      }
    }

    geometry.computeVertexNormals();

    const colors = [];
    for (let i = 0; i < points.length; i++) {
      const color = riskCalculator.getColorForPoint(points[i], this.currentViewMode);
      colors.push(color.r, color.g, color.b);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      roughness: 0.8,
      metalness: 0.1
    });

    this.terrain = new THREE.Mesh(geometry, material);
    this.terrain.receiveShadow = true;
    this.terrain.castShadow = true;
    
    this.terrain.position.set(
      -(bounds.maxX - bounds.minX) / 2,
      0,
      -(bounds.maxY - bounds.minY) / 2
    );
    
    this.scene.add(this.terrain);

    this._fitCameraToTerrain(bounds);
  }

  _fitCameraToTerrain(bounds) {
    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;
    const diagonal = Math.sqrt(width * width + height * height);
    
    const distance = diagonal * 1.2;
    const centerX = (bounds.minX + bounds.maxX) / 2 - (bounds.maxX - bounds.minX) / 2;
    const centerZ = (bounds.minY + bounds.maxY) / 2 - (bounds.maxY - bounds.minY) / 2;

    this.camera.position.set(centerX + distance * 0.5, distance * 0.6, centerZ + distance * 0.5);
    this.controls.target.set(centerX, 0, centerZ);
    this.controls.update();
  }

  renderFacilities(facilities, elevationData) {
    this.facilityMeshes.forEach(mesh => {
      this.scene.remove(mesh);
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(m => m.dispose());
        } else {
          mesh.material.dispose();
        }
      }
    });
    this.facilityMeshes = [];

    const { bounds } = elevationData;
    const offsetX = -(bounds.maxX - bounds.minX) / 2;
    const offsetZ = -(bounds.maxY - bounds.minY) / 2;

    facilities.cableCars.forEach(cableCar => {
      const points = cableCar.coordinates.map(coord => 
        new THREE.Vector3(
          coord.x - bounds.minX + offsetX,
          coord.z + 10,
          coord.y - bounds.minY + offsetZ
        )
      );

      const cableGeometry = new THREE.BufferGeometry().setFromPoints(points);
      const cableMaterial = new THREE.LineBasicMaterial({ 
        color: 0xff0000, 
        linewidth: 3 
      });
      const cableLine = new THREE.Line(cableGeometry, cableMaterial);
      this.scene.add(cableLine);
      this.facilityMeshes.push(cableLine);

      points.forEach((point, index) => {
        const towerGeometry = new THREE.CylinderGeometry(2, 4, 30, 8);
        const towerMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 });
        const tower = new THREE.Mesh(towerGeometry, towerMaterial);
        tower.position.copy(point);
        tower.position.y = 15;
        this.scene.add(tower);
        this.facilityMeshes.push(tower);
      });
    });

    facilities.guardrails.forEach(guardrail => {
      const points = guardrail.coordinates.map(coord => 
        new THREE.Vector3(
          coord.x - bounds.minX + offsetX,
          coord.z + 1,
          coord.y - bounds.minY + offsetZ
        )
      );

      const guardrailGeometry = new THREE.BufferGeometry().setFromPoints(points);
      const guardrailMaterial = new THREE.LineBasicMaterial({ 
        color: 0xffff00, 
        linewidth: 2 
      });
      const guardrailLine = new THREE.Line(guardrailGeometry, guardrailMaterial);
      this.scene.add(guardrailLine);
      this.facilityMeshes.push(guardrailLine);
    });
  }

  addHazardMarker(hazard, elevationData) {
    const { bounds } = elevationData;
    const offsetX = -(bounds.maxX - bounds.minX) / 2;
    const offsetZ = -(bounds.maxY - bounds.minY) / 2;

    const x = hazard.location.x - bounds.minX + offsetX;
    const z = hazard.location.y - bounds.minY + offsetZ;
    const y = hazard.location.z + 2;

    const colors = {
      low: 0x00ff00,
      medium: 0xffff00,
      high: 0xff0000,
      critical: 0xff00ff
    };

    const geometry = new THREE.SphereGeometry(hazard.radius || 5, 16, 16);
    const material = new THREE.MeshStandardMaterial({
      color: colors[hazard.severity] || 0xffff00,
      transparent: true,
      opacity: 0.7
    });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.set(x, y, z);
    sphere.userData = hazard;

    const ringGeometry = new THREE.RingGeometry(hazard.radius || 5, (hazard.radius || 5) + 2, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: colors[hazard.severity] || 0xffff00,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.5
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, hazard.location.z + 0.1, z);

    this.scene.add(sphere);
    this.scene.add(ring);
    this.hazardMarkers.push(sphere);
    this.hazardMarkers.push(ring);
  }

  renderRoute(routePoints, elevationData) {
    this.routeLines.forEach(line => {
      this.scene.remove(line);
      if (line.geometry) line.geometry.dispose();
      if (line.material) line.material.dispose();
    });
    this.routeLines = [];

    const { bounds } = elevationData;
    const offsetX = -(bounds.maxX - bounds.minX) / 2;
    const offsetZ = -(bounds.maxY - bounds.minY) / 2;

    if (routePoints.length < 2) return;

    const points = routePoints.map(point => 
      new THREE.Vector3(
        point.x - bounds.minX + offsetX,
        point.z + 0.5,
        point.y - bounds.minY + offsetZ
      )
    );

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineDashedMaterial({
      color: 0x0000ff,
      linewidth: 3,
      dashSize: 5,
      gapSize: 2
    });
    const line = new THREE.Line(geometry, material);
    line.computeLineDistances();

    this.scene.add(line);
    this.routeLines.push(line);

    points.forEach((point, index) => {
      const markerGeometry = new THREE.BufferGeometry();
      const positions = [
        point.x, point.y + 15, point.z,
        point.x - 3, point.y + 8, point.z,
        point.x + 3, point.y + 8, point.z
      ];
      markerGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      
      const markerMaterial = new THREE.MeshBasicMaterial({ 
        color: index === 0 ? 0x00ff00 : (index === points.length - 1 ? 0xff0000 : 0x0000ff) 
      });
      const marker = new THREE.Mesh(markerGeometry, markerMaterial);
      
      this.scene.add(marker);
      this.routeLines.push(marker);
    });
  }

  setViewMode(mode, riskCalculator, elevationData) {
    this.currentViewMode = mode;
    if (this.terrain && riskCalculator && elevationData) {
      const colors = [];
      for (const point of elevationData.points) {
        const color = riskCalculator.getColorForPoint(point, mode);
        colors.push(color.r, color.g, color.b);
      }
      this.terrain.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      this.terrain.geometry.attributes.color.needsUpdate = true;
    }
  }

  clearAllMarkers() {
    this.hazardMarkers.forEach(marker => {
      this.scene.remove(marker);
      if (marker.geometry) marker.geometry.dispose();
      if (marker.material) marker.material.dispose();
    });
    this.hazardMarkers = [];
  }

  destroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    
    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement && this.container) {
        this.container.removeChild(this.renderer.domElement);
      }
    }
  }
}
