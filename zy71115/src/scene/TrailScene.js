import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import TWEEN from '@tweenjs/tween.js';

export class TrailScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    
    this.trailData = null;
    this.currentWeather = 'sunny';
    this.currentView = 'overview';
    this.progress = 0;
    
    this.trailLine = null;
    this.progressMarker = null;
    this.terrain = null;
    this.supplyMarkers = [];
    this.riskSegments = [];
    this.elevationMarkers = [];
    
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.hoveredObject = null;
    
    this.filters = {
      supply: true,
      risk: true,
      elevation: true,
      riskLevel: 'all'
    };
    
    this.init();
  }
  
  init() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0f172a);
    this.scene.fog = new THREE.Fog(0x0f172a, 500, 3000);
    
    this.camera = new THREE.PerspectiveCamera(60, rect.width / rect.height, 0.1, 10000);
    this.camera.position.set(800, 800, 800);
    
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true
    });
    this.renderer.setSize(rect.width, rect.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 100;
    this.controls.maxDistance = 3000;
    
    this.addLights();
    this.addSkyDome();
    this.addGround();
    
    window.addEventListener('resize', () => this.onResize());
    this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    
    this.animate();
  }
  
  addLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);
    
    this.sunLight = new THREE.DirectionalLight(0xffffff, 1);
    this.sunLight.position.set(500, 1000, 300);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 3000;
    this.sunLight.shadow.camera.left = -1500;
    this.sunLight.shadow.camera.right = 1500;
    this.sunLight.shadow.camera.top = 1500;
    this.sunLight.shadow.camera.bottom = -1500;
    this.scene.add(this.sunLight);
    
    const fillLight = new THREE.DirectionalLight(0x8888ff, 0.3);
    fillLight.position.set(-500, 500, -500);
    this.scene.add(fillLight);
  }
  
  addSkyDome() {
    const skyGeometry = new THREE.SphereGeometry(5000, 32, 32);
    const skyMaterial = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(0x0077ff) },
        bottomColor: { value: new THREE.Color(0x1a1a2e) },
        offset: { value: 33 },
        exponent: { value: 0.6 }
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + offset).y;
          gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
        }
      `,
      side: THREE.BackSide
    });
    this.sky = new THREE.Mesh(skyGeometry, skyMaterial);
    this.scene.add(this.sky);
  }
  
  addGround() {
    const groundGeometry = new THREE.PlaneGeometry(5000, 5000, 50, 50);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a472a,
      roughness: 0.8,
      metalness: 0.1
    });
    
    const positions = groundGeometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getY(i);
      const noise = Math.sin(x * 0.01) * Math.cos(z * 0.01) * 20 + 
                    Math.sin(x * 0.02 + 1) * Math.cos(z * 0.02) * 10;
      positions.setZ(i, noise);
    }
    groundGeometry.computeVertexNormals();
    
    this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -50;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);
  }
  
  loadTrailData(trailData) {
    this.trailData = trailData;
    this.clearTrailObjects();
    this.createTerrain();
    this.createTrailLine();
    this.createSupplyMarkers();
    this.createRiskSegments();
    this.createElevationMarkers();
    this.createProgressMarker();
    this.fitCameraToTrail();
  }
  
  clearTrailObjects() {
    if (this.trailLine) {
      this.scene.remove(this.trailLine);
      this.trailLine.geometry.dispose();
      this.trailLine.material.dispose();
    }
    
    if (this.progressMarker) {
      this.scene.remove(this.progressMarker);
    }
    
    if (this.terrain) {
      this.scene.remove(this.terrain);
      this.terrain.geometry.dispose();
      this.terrain.material.dispose();
    }
    
    this.supplyMarkers.forEach(m => {
      this.scene.remove(m);
      m.geometry?.dispose();
      m.material?.dispose();
    });
    this.supplyMarkers = [];
    
    this.riskSegments.forEach(r => {
      this.scene.remove(r);
      r.geometry?.dispose();
      r.material?.dispose();
    });
    this.riskSegments = [];
    
    this.elevationMarkers.forEach(e => {
      this.scene.remove(e);
      e.geometry?.dispose();
      e.material?.dispose();
    });
    this.elevationMarkers = [];
  }
  
  createTerrain() {
    if (!this.trailData?.trailPoints) return;
    
    const points = this.trailData.trailPoints;
    const terrainSize = 3000;
    const segments = 100;
    
    const geometry = new THREE.PlaneGeometry(terrainSize, terrainSize, segments, segments);
    const positions = geometry.attributes.position;
    
    const trailHeights = {};
    points.forEach(p => {
      const key = `${Math.round(p.x / 50)}_${Math.round(p.z / 50)}`;
      trailHeights[key] = p.elevation;
    });
    
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getY(i);
      
      let height = 0;
      let minDist = Infinity;
      
      points.forEach(p => {
        const dist = Math.sqrt(Math.pow(x - p.x, 2) + Math.pow(z - p.z, 2));
        if (dist < minDist) {
          minDist = dist;
        }
        const influence = Math.max(0, 1 - dist / 500);
        height += p.elevation * influence * 0.3;
      });
      
      const baseNoise = Math.sin(x * 0.005) * Math.cos(z * 0.005) * 50;
      const detailNoise = Math.sin(x * 0.02) * Math.cos(z * 0.02) * 20;
      
      positions.setZ(i, height + baseNoise + detailNoise - 100);
    }
    
    geometry.computeVertexNormals();
    
    const material = new THREE.MeshStandardMaterial({
      color: 0x2d5a27,
      roughness: 0.9,
      metalness: 0.0,
      flatShading: true,
      side: THREE.DoubleSide
    });
    
    this.terrain = new THREE.Mesh(geometry, material);
    this.terrain.rotation.x = -Math.PI / 2;
    this.terrain.receiveShadow = true;
    this.scene.add(this.terrain);
  }
  
  createTrailLine() {
    if (!this.trailData?.trailPoints) return;
    
    const points = this.trailData.trailPoints;
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    const colors = [];
    
    const minElev = Math.min(...points.map(p => p.elevation));
    const maxElev = Math.max(...points.map(p => p.elevation));
    
    points.forEach((p, i) => {
      vertices.push(p.x, p.elevation, p.z);
      
      const t = (p.elevation - minElev) / (maxElev - minElev);
      const color = new THREE.Color().setHSL(0.6 - t * 0.4, 0.8, 0.5);
      colors.push(color.r, color.g, color.b);
    });
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    
    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      linewidth: 4,
      transparent: true,
      opacity: 0.9
    });
    
    this.trailLine = new THREE.Line(geometry, material);
    this.scene.add(this.trailLine);
  }
  
  createSupplyMarkers() {
    if (!this.trailData?.supplyStations) return;
    
    const supplyColors = {
      water: 0x00aaff,
      full: 0x00ff88,
      snack: 0xffaa00,
      view: 0xff66ff
    };
    
    this.trailData.supplyStations.forEach(station => {
      const point = this.getPointAtDistance(station.distance);
      if (!point) return;
      
      const geometry = new THREE.ConeGeometry(15, 40, 8);
      const material = new THREE.MeshStandardMaterial({
        color: supplyColors[station.type] || 0x00ff00,
        emissive: supplyColors[station.type] || 0x00ff00,
        emissiveIntensity: 0.3,
        metalness: 0.5,
        roughness: 0.3
      });
      
      const marker = new THREE.Mesh(geometry, material);
      marker.position.set(point.x, point.elevation + 30, point.z);
      marker.castShadow = true;
      marker.userData = { type: 'supply', data: station };
      
      const ringGeometry = new THREE.RingGeometry(20, 25, 32);
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: supplyColors[station.type] || 0x00ff00,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide
      });
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 2;
      marker.add(ring);
      
      this.supplyMarkers.push(marker);
      this.scene.add(marker);
    });
  }
  
  createRiskSegments() {
    if (!this.trailData?.riskSegments) return;
    
    const riskColors = {
      low: 0xffff00,
      medium: 0xff8800,
      high: 0xff0000
    };
    
    this.trailData.riskSegments.forEach(risk => {
      const startPoint = this.getPointAtDistance(risk.startDist);
      const endPoint = this.getPointAtDistance(risk.endDist);
      
      if (!startPoint || !endPoint) return;
      
      const points = [];
      const step = 0.05;
      for (let d = risk.startDist; d <= risk.endDist; d += step) {
        const p = this.getPointAtDistance(d);
        if (p) {
          points.push(new THREE.Vector3(p.x, p.elevation + 5, p.z));
        }
      }
      
      if (points.length < 2) return;
      
      const curve = new THREE.CatmullRomCurve3(points);
      const tubeGeometry = new THREE.TubeGeometry(curve, points.length * 2, 8, 8, false);
      const material = new THREE.MeshStandardMaterial({
        color: riskColors[risk.level] || 0xff0000,
        transparent: true,
        opacity: 0.6,
        emissive: riskColors[risk.level] || 0xff0000,
        emissiveIntensity: 0.2
      });
      
      const segment = new THREE.Mesh(tubeGeometry, material);
      segment.userData = { type: 'risk', data: risk };
      this.riskSegments.push(segment);
      this.scene.add(segment);
    });
  }
  
  createElevationMarkers() {
    if (!this.trailData?.elevationMarkers) return;
    
    this.trailData.elevationMarkers.forEach(marker => {
      const point = this.getPointAtDistance(marker.distance);
      if (!point) return;
      
      const group = new THREE.Group();
      
      const poleGeometry = new THREE.CylinderGeometry(2, 3, marker.elevation * 0.1 + 20, 8);
      const poleMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        metalness: 0.8,
        roughness: 0.2
      });
      const pole = new THREE.Mesh(poleGeometry, poleMaterial);
      pole.position.y = (marker.elevation * 0.1 + 20) / 2;
      group.add(pole);
      
      const flagGeometry = new THREE.BoxGeometry(30, 15, 2);
      const flagMaterial = new THREE.MeshStandardMaterial({
        color: 0x00d4ff,
        emissive: 0x00d4ff,
        emissiveIntensity: 0.3
      });
      const flag = new THREE.Mesh(flagGeometry, flagMaterial);
      flag.position.set(15, marker.elevation * 0.1 + 20, 0);
      group.add(flag);
      
      group.position.set(point.x, point.elevation, point.z);
      group.userData = { type: 'elevation', data: marker };
      
      this.elevationMarkers.push(group);
      this.scene.add(group);
    });
  }
  
  createProgressMarker() {
    if (!this.trailData?.trailPoints?.length) return;
    
    const group = new THREE.Group();
    
    const bodyGeometry = new THREE.SphereGeometry(20, 16, 16);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x00d4ff,
      emissive: 0x00d4ff,
      emissiveIntensity: 0.5,
      metalness: 0.5,
      roughness: 0.3,
      transparent: true,
      opacity: 0.9
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    group.add(body);
    
    const glowGeometry = new THREE.RingGeometry(25, 35, 32);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0x00d4ff,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.rotation.x = -Math.PI / 2;
    group.add(glow);
    
    const point = this.trailData.trailPoints[0];
    group.position.set(point.x, point.elevation + 25, point.z);
    
    this.progressMarker = group;
    this.scene.add(this.progressMarker);
  }
  
  getPointAtDistance(distance) {
    if (!this.trailData?.trailPoints) return null;
    
    const points = this.trailData.trailPoints;
    for (let i = 0; i < points.length - 1; i++) {
      if (points[i].distance <= distance && points[i + 1].distance >= distance) {
        const t = (distance - points[i].distance) / (points[i + 1].distance - points[i].distance);
        return {
          x: points[i].x + (points[i + 1].x - points[i].x) * t,
          elevation: points[i].elevation + (points[i + 1].elevation - points[i].elevation) * t,
          z: points[i].z + (points[i + 1].z - points[i].z) * t
        };
      }
    }
    return points[points.length - 1];
  }
  
  setProgress(progress) {
    this.progress = progress;
    if (!this.progressMarker || !this.trailData?.trailPoints) return;
    
    const maxDist = this.trailData.trailPoints[this.trailData.trailPoints.length - 1].distance;
    const distance = progress * maxDist;
    const point = this.getPointAtDistance(distance);
    
    if (point) {
      new TWEEN.Tween(this.progressMarker.position)
        .to({ x: point.x, y: point.elevation + 25, z: point.z }, 300)
        .easing(TWEEN.Easing.Quadratic.Out)
        .start();
    }
  }
  
  setWeather(weather) {
    this.currentWeather = weather;
    
    const fogDensities = { sunny: 0.0002, cloudy: 0.0005, rainy: 0.001, stormy: 0.002 };
    this.scene.fog.density = fogDensities[weather] || 0.0002;
    
    const lightIntensities = { sunny: 1.0, cloudy: 0.7, rainy: 0.4, stormy: 0.2 };
    this.sunLight.intensity = lightIntensities[weather] || 1.0;
    
    this.updateRiskVisibility();
  }
  
  setView(view) {
    this.currentView = view;
    
    if (!this.trailData?.trailPoints) return;
    
    const points = this.trailData.trailPoints;
    const centerX = (Math.min(...points.map(p => p.x)) + Math.max(...points.map(p => p.x))) / 2;
    const centerZ = (Math.min(...points.map(p => p.z)) + Math.max(...points.map(p => p.z))) / 2;
    const maxElev = Math.max(...points.map(p => p.elevation));
    
    let targetPos, targetLookAt;
    
    switch (view) {
      case 'overview':
        targetPos = { x: centerX + 800, y: maxElev + 600, z: centerZ + 800 };
        targetLookAt = { x: centerX, y: maxElev / 2, z: centerZ };
        break;
      case 'top':
        targetPos = { x: centerX, y: 1500, z: centerZ };
        targetLookAt = { x: centerX, y: 0, z: centerZ };
        break;
      case 'side':
        targetPos = { x: centerX + 1000, y: maxElev / 2 + 200, z: centerZ };
        targetLookAt = { x: centerX, y: maxElev / 2, z: centerZ };
        break;
      case 'follow':
        const maxDist = points[points.length - 1].distance;
        const dist = this.progress * maxDist;
        const point = this.getPointAtDistance(dist);
        targetPos = { x: point.x + 100, y: point.elevation + 80, z: point.z + 100 };
        targetLookAt = { x: point.x, y: point.elevation, z: point.z };
        break;
    }
    
    if (targetPos && targetLookAt) {
      new TWEEN.Tween(this.camera.position)
        .to(targetPos, 1000)
        .easing(TWEEN.Easing.Quadratic.InOut)
        .start();
      
      new TWEEN.Tween(this.controls.target)
        .to(targetLookAt, 1000)
        .easing(TWEEN.Easing.Quadratic.InOut)
        .start();
    }
  }
  
  fitCameraToTrail() {
    if (!this.trailData?.trailPoints) return;
    this.setView('overview');
  }
  
  setFilters(filters) {
    this.filters = { ...this.filters, ...filters };
    this.applyFilters();
  }
  
  applyFilters() {
    this.supplyMarkers.forEach(m => {
      m.visible = this.filters.supply;
    });
    
    this.updateRiskVisibility();
    
    this.elevationMarkers.forEach(e => {
      e.visible = this.filters.elevation;
    });
  }
  
  updateRiskVisibility() {
    const isRainy = this.currentWeather === 'rainy' || this.currentWeather === 'stormy';
    
    this.riskSegments.forEach(r => {
      const risk = r.userData.data;
      const levelMatch = this.filters.riskLevel === 'all' || risk.level === this.filters.riskLevel;
      const notClosed = !(isRainy && risk.closedInRain);
      r.visible = this.filters.risk && levelMatch && notClosed;
    });
  }
  
  onResize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.camera.aspect = rect.width / rect.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(rect.width, rect.height);
  }
  
  onMouseMove(event) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }
  
  checkHover() {
    if (!this.trailData) return null;
    
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    const allObjects = [
      ...this.supplyMarkers.filter(m => m.visible),
      ...this.riskSegments.filter(r => r.visible),
      ...this.elevationMarkers.flatMap(g => g.children).filter(c => c.visible)
    ];
    
    const intersects = this.raycaster.intersectObjects(allObjects, true);
    
    if (intersects.length > 0) {
      let obj = intersects[0].object;
      while (obj.parent && !obj.userData.type) {
        obj = obj.parent;
      }
      return obj.userData;
    }
    
    return null;
  }
  
  animate() {
    requestAnimationFrame(() => this.animate());
    
    TWEEN.update();
    this.controls.update();
    
    const time = Date.now() * 0.001;
    if (this.progressMarker) {
      this.progressMarker.children[1].rotation.z = time * 2;
      this.progressMarker.position.y += Math.sin(time * 3) * 0.3;
    }
    
    this.supplyMarkers.forEach((m, i) => {
      m.rotation.y = time * 0.5 + i;
    });
    
    this.renderer.render(this.scene, this.camera);
  }
  
  dispose() {
    this.renderer.dispose();
  }
}
