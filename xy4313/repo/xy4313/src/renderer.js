import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class SceneRenderer {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    
    this.shelvesGroup = null;
    this.forkliftMesh = null;
    this.trajectoryLine = null;
    this.blindSpotZones = [];
    this.noEntryZones = [];
    this.eventMarkers = [];
    this.cameraMarkers = [];
    this.obstacleMarkers = [];
    
    this.animationId = null;
    this.onForkliftMove = null;
    
    this.currentForkliftPosition = { x: 0, y: 0, z: 0 };
    this.currentForkliftRotation = 0;

    this.init();
  }

  init() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a1a);
    this.scene.fog = new THREE.Fog(0x0a0a1a, 50, 150);

    const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
    this.camera.position.set(40, 30, 40);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true
    });
    this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 100;

    this.setupLights();
    this.setupGround();
    this.setupGroups();

    window.addEventListener('resize', () => this.onResize());
  }

  setupLights() {
    const ambientLight = new THREE.AmbientLight(0x404060, 0.5);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(20, 40, 20);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 200;
    directionalLight.shadow.camera.left = -50;
    directionalLight.shadow.camera.right = 50;
    directionalLight.shadow.camera.top = 50;
    directionalLight.shadow.camera.bottom = -50;
    this.scene.add(directionalLight);

    const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x4a4a60, 0.4);
    this.scene.add(hemisphereLight);
  }

  setupGround() {
    const gridHelper = new THREE.GridHelper(100, 50, 0x1a4a7a, 0x0f3460);
    gridHelper.position.y = 0.01;
    this.scene.add(gridHelper);

    const groundGeometry = new THREE.PlaneGeometry(200, 200);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1a2e,
      roughness: 0.9,
      metalness: 0.1
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  setupGroups() {
    this.shelvesGroup = new THREE.Group();
    this.scene.add(this.shelvesGroup);

    this.trajectoryLine = new THREE.Group();
    this.scene.add(this.trajectoryLine);
  }

  loadShelves(shelvesData) {
    while (this.shelvesGroup.children.length > 0) {
      this.shelvesGroup.remove(this.shelvesGroup.children[0]);
    }

    this.blindSpotZones.forEach(zone => this.scene.remove(zone));
    this.blindSpotZones = [];

    this.noEntryZones.forEach(zone => this.scene.remove(zone));
    this.noEntryZones = [];

    this.obstacleMarkers.forEach(marker => this.scene.remove(marker));
    this.obstacleMarkers = [];

    if (!shelvesData || !shelvesData.shelves) return;

    shelvesData.shelves.forEach(shelf => {
      const shelfMesh = this.createShelfMesh(shelf);
      this.shelvesGroup.add(shelfMesh);

      if (shelf.isBlindSpot && shelf.blindSpotZone) {
        const blindZoneMesh = this.createBlindSpotZone(shelf);
        this.blindSpotZones.push(blindZoneMesh);
        this.scene.add(blindZoneMesh);
      }
    });

    if (shelvesData.noEntryZones) {
      shelvesData.noEntryZones.forEach(zone => {
        const zoneMesh = this.createNoEntryZone(zone);
        this.noEntryZones.push(zoneMesh);
        this.scene.add(zoneMesh);
      });
    }

    if (shelvesData.temporaryObstacles) {
      shelvesData.temporaryObstacles.forEach(obstacle => {
        const obstacleMesh = this.createObstacleMesh(obstacle);
        this.obstacleMarkers.push(obstacleMesh);
        this.scene.add(obstacleMesh);
      });
    }
  }

  createShelfMesh(shelf) {
    const group = new THREE.Group();

    const bodyGeometry = new THREE.BoxGeometry(
      shelf.size.width,
      shelf.size.height,
      shelf.size.depth
    );
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: shelf.isBlindSpot ? 0xf59e0b : 0x4a5568,
      metalness: 0.3,
      roughness: 0.7
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.set(
      shelf.position.x,
      shelf.size.height / 2,
      shelf.position.z
    );
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const levelHeight = 1;
    const numLevels = Math.floor(shelf.size.height / levelHeight);
    for (let i = 1; i < numLevels; i++) {
      const levelGeometry = new THREE.BoxGeometry(
        shelf.size.width + 0.1,
        0.05,
        shelf.size.depth + 0.1
      );
      const levelMaterial = new THREE.MeshStandardMaterial({
        color: 0x2d3748,
        metalness: 0.5,
        roughness: 0.5
      });
      const level = new THREE.Mesh(levelGeometry, levelMaterial);
      level.position.set(
        shelf.position.x,
        i * levelHeight,
        shelf.position.z
      );
      group.add(level);
    }

    group.userData = { type: 'shelf', shelfData: shelf };
    return group;
  }

  createBlindSpotZone(shelf) {
    const radius = shelf.blindSpotZone?.radius ?? 5;
    const angle = (shelf.blindSpotZone?.angle ?? 90) * (Math.PI / 180);

    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.arc(0, 0, radius, -angle / 2, angle / 2, false);
    shape.lineTo(0, 0);

    const geometry = new THREE.ShapeGeometry(shape);
    const material = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide
    });

    const zone = new THREE.Mesh(geometry, material);
    zone.rotation.x = -Math.PI / 2;
    zone.position.set(shelf.position.x, 0.02, shelf.position.z);

    const ringGeometry = new THREE.RingGeometry(radius * 0.95, radius, 32, 1, -angle / 2, angle);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(shelf.position.x, 0.03, shelf.position.z);

    const group = new THREE.Group();
    group.add(zone);
    group.add(ring);
    group.userData = { type: 'blindSpotZone', shelfId: shelf.id };

    return group;
  }

  createNoEntryZone(zone) {
    const group = new THREE.Group();
    let geometry, position;

    if (zone.type === 'circle' || zone.radius) {
      const radius = zone.radius ?? 5;
      geometry = new THREE.CylinderGeometry(radius, radius, 0.05, 32);
      position = new THREE.Vector3(
        zone.center?.x ?? zone.x ?? 0, 0.02, zone.center?.z ?? zone.z ?? 0
      );
    } else {
      const width = zone.width ?? 5;
      const depth = zone.depth ?? 5;
      geometry = new THREE.BoxGeometry(width, 0.05, depth);
      position = new THREE.Vector3(
        zone.position?.x ?? zone.x ?? 0, 0.02, zone.position?.z ?? zone.z ?? 0
      );
    }

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#8b5cf6';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    for (let i = 0; i < 8; i++) {
      const x = (i * 32) % 256;
      const y = Math.floor(i / 4) * 32 + 16;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 32, y + 32);
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 4);

    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.6
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    group.add(mesh);

    if (zone.type === 'circle' || zone.radius) {
      const radius = zone.radius ?? 5;
      const tubeGeometry = new THREE.TorusGeometry(radius, 0.1, 8, 32);
      const tubeMaterial = new THREE.MeshBasicMaterial({
        color: 0xff0000,
        transparent: true,
        opacity: 0.8
      });
      const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
      tube.rotation.x = Math.PI / 2;
      tube.position.copy(position);
      group.add(tube);
    }

    group.userData = { type: 'noEntryZone', zoneData: zone };
    return group;
  }

  createObstacleMesh(obstacle) {
    const group = new THREE.Group();

    const geometry = new THREE.BoxGeometry(
      obstacle.size?.width ?? 1.2,
      obstacle.size?.height ?? 1.1,
      obstacle.size?.depth ?? 1.2
    );

    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f97316';
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(20, 20);
    ctx.lineTo(108, 108);
    ctx.moveTo(108, 20);
    ctx.lineTo(20, 108);
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.7,
      metalness: 0.2
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(
      obstacle.position.x,
      (obstacle.size?.height ?? 1.1) / 2,
      obstacle.position.z
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    const pulseGeometry = new THREE.RingGeometry(1, 1.5, 32);
    const pulseMaterial = new THREE.MeshBasicMaterial({
      color: 0xf97316,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide
    });
    const pulse = new THREE.Mesh(pulseGeometry, pulseMaterial);
    pulse.rotation.x = -Math.PI / 2;
    pulse.position.set(obstacle.position.x, 0.05, obstacle.position.z);
    group.add(pulse);

    group.userData = { type: 'obstacle', obstacleData: obstacle };
    return group;
  }

  createForklift() {
    if (this.forkliftMesh) {
      this.scene.remove(this.forkliftMesh);
    }

    const group = new THREE.Group();

    const bodyGeometry = new THREE.BoxGeometry(2.5, 1.5, 1.8);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0xe94560,
      metalness: 0.6,
      roughness: 0.4
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.75;
    body.castShadow = true;
    group.add(body);

    const cabGeometry = new THREE.BoxGeometry(1.2, 1.5, 1.4);
    const cabMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a4a7a,
      transparent: true,
      opacity: 0.7,
      metalness: 0.3,
      roughness: 0.5
    });
    const cab = new THREE.Mesh(cabGeometry, cabMaterial);
    cab.position.set(-0.3, 1.5, 0);
    cab.castShadow = true;
    group.add(cab);

    const mastGeometry = new THREE.BoxGeometry(0.15, 2.5, 1.2);
    const mastMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a5568,
      metalness: 0.8,
      roughness: 0.2
    });
    const mast = new THREE.Mesh(mastGeometry, mastMaterial);
    mast.position.set(1.2, 1.25, 0);
    mast.castShadow = true;
    group.add(mast);

    const forkGeometry = new THREE.BoxGeometry(1.0, 0.1, 1.0);
    const forkMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a5568,
      metalness: 0.8,
      roughness: 0.2
    });
    const fork = new THREE.Mesh(forkGeometry, forkMaterial);
    fork.position.set(1.7, 0.3, 0);
    fork.castShadow = true;
    group.add(fork);

    const wheelGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 16);
    const wheelMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      roughness: 0.9
    });

    const wheelPositions = [
      [-0.8, 0.4, 0.8],
      [-0.8, 0.4, -0.8],
      [0.8, 0.4, 0.8],
      [0.8, 0.4, -0.8]
    ];

    wheelPositions.forEach(pos => {
      const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(pos[0], pos[1], pos[2]);
      wheel.castShadow = true;
      group.add(wheel);
    });

    const arrowGeometry = new THREE.ConeGeometry(0.3, 0.6, 8);
    const arrowMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.8
    });
    const directionArrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
    directionArrow.position.set(1.8, 0.5, 0);
    directionArrow.rotation.z = -Math.PI / 2;
    group.add(directionArrow);

    this.forkliftMesh = group;
    this.forkliftMesh.userData = { type: 'forklift' };
    this.scene.add(this.forkliftMesh);

    return group;
  }

  updateForkliftPosition(position, rotationY = 0, isReversing = false) {
    if (!this.forkliftMesh) {
      this.createForklift();
    }

    this.forkliftMesh.position.set(
      position.x,
      0,
      position.z
    );

    this.forkliftMesh.rotation.y = rotationY;

    const arrow = this.forkliftMesh.children.find(c => 
      c.material && c.material.color && c.material.color.getHex() === 0x00ff00
    );
    if (arrow) {
      arrow.material.color.setHex(isReversing ? 0xff0000 : 0x00ff00);
    }

    this.currentForkliftPosition = { ...position };
    this.currentForkliftRotation = rotationY;

    if (this.onForkliftMove) {
      this.onForkliftMove(position, rotationY, isReversing);
    }
  }

  createTrajectoryLine(trajectoryData) {
    while (this.trajectoryLine.children.length > 0) {
      this.trajectoryLine.remove(this.trajectoryLine.children[0]);
    }

    if (!trajectoryData || !trajectoryData.points || trajectoryData.points.length < 2) {
      return;
    }

    const points = trajectoryData.points;
    const geometry = new THREE.BufferGeometry();
    const vertices = [];

    points.forEach(point => {
      vertices.push(point.position.x, 0.1, point.position.z);
    });

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

    const material = new THREE.LineBasicMaterial({
      color: 0x4ade80,
      transparent: true,
      opacity: 0.6,
      linewidth: 2
    });

    const line = new THREE.Line(geometry, material);
    this.trajectoryLine.add(line);

    this.createTrajectoryPoints(points);
  }

  createTrajectoryPoints(points) {
    const pointGeometry = new THREE.SphereGeometry(0.08, 8, 8);
    const pointMaterial = new THREE.MeshBasicMaterial({ color: 0x4ade80 });

    for (let i = 0; i < points.length; i += Math.max(1, Math.floor(points.length / 50))) {
      const point = points[i];
      const sphere = new THREE.Mesh(pointGeometry, pointMaterial);
      sphere.position.set(point.position.x, 0.15, point.position.z);
      sphere.userData = { 
        type: 'trajectoryPoint', 
        index: i,
        pointData: point
      };
      this.trajectoryLine.add(sphere);
    }
  }

  createEventMarkers(events) {
    this.eventMarkers.forEach(marker => this.scene.remove(marker));
    this.eventMarkers = [];

    const colorMap = {
      'blind-spot': 0xf59e0b,
      'overspeed': 0xef4444,
      'no-entry': 0x8b5cf6,
      'near-miss': 0xf97316
    };

    events.forEach((event, index) => {
      const color = colorMap[event.type] || 0xffffff;
      
      const geometry = new THREE.ConeGeometry(0.5, 1.5, 6);
      const material = new THREE.MeshStandardMaterial({
        color: color,
        transparent: true,
        opacity: 0.8,
        emissive: color,
        emissiveIntensity: 0.3
      });

      const marker = new THREE.Mesh(geometry, material);
      marker.position.set(
        event.location.x ?? 0,
        2,
        event.location.z ?? 0
      );
      marker.rotation.x = Math.PI;
      marker.userData = { 
        type: 'eventMarker', 
        eventData: event,
        eventIndex: index
      };

      this.eventMarkers.push(marker);
      this.scene.add(marker);
    });
  }

  createCameraMarkers(cameraData) {
    this.cameraMarkers.forEach(marker => this.scene.remove(marker));
    this.cameraMarkers = [];

    if (!cameraData || !cameraData.cameras) return;

    cameraData.cameras.forEach(camera => {
      const group = new THREE.Group();

      const cameraGeometry = new THREE.BoxGeometry(0.5, 0.3, 0.3);
      const cameraMaterial = new THREE.MeshStandardMaterial({
        color: 0x3b82f6,
        metalness: 0.5,
        roughness: 0.5
      });
      const camMesh = new THREE.Mesh(cameraGeometry, cameraMaterial);
      camMesh.position.set(camera.position.x, camera.position.y, camera.position.z);
      group.add(camMesh);

      const coverageRadius = camera.coverageArea?.radius ?? 15;
      const coverageAngle = (camera.coverageArea?.angle ?? 120) * (Math.PI / 180);

      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.arc(0, 0, coverageRadius, -coverageAngle / 2, coverageAngle / 2, false);
      shape.lineTo(0, 0);

      const coverageGeometry = new THREE.ShapeGeometry(shape);
      const coverageMaterial = new THREE.MeshBasicMaterial({
        color: 0x3b82f6,
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide
      });
      const coverage = new THREE.Mesh(coverageGeometry, coverageMaterial);
      coverage.rotation.x = -Math.PI / 2;
      coverage.position.set(camera.position.x, 0.02, camera.position.z);
      group.add(coverage);

      group.userData = { type: 'cameraMarker', cameraData: camera };
      this.cameraMarkers.push(group);
      this.scene.add(group);
    });
  }

  highlightEvent(eventIndex) {
    this.eventMarkers.forEach((marker, index) => {
      if (index === eventIndex) {
        marker.scale.set(1.5, 1.5, 1.5);
        marker.material.emissiveIntensity = 0.6;
      } else {
        marker.scale.set(1, 1, 1);
        marker.material.emissiveIntensity = 0.3;
      }
    });
  }

  focusOnEvent(event) {
    if (!event) return;

    const targetPosition = new THREE.Vector3(
      event.location.x + 10,
      8,
      event.location.z + 10
    );

    this.camera.position.lerp(targetPosition, 0.5);
    this.controls.target.set(
      event.location.x,
      1,
      event.location.z
    );
    this.controls.update();
  }

  render() {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  startAnimation() {
    const animate = () => {
      this.animationId = requestAnimationFrame(animate);
      this.render();

      const time = Date.now() * 0.001;
      this.eventMarkers.forEach((marker, index) => {
        marker.position.y = 2 + Math.sin(time * 2 + index * 0.5) * 0.2;
      });
    };
    animate();
  }

  stopAnimation() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  onResize() {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
  }

  dispose() {
    this.stopAnimation();
    this.renderer.dispose();
  }
}

export default SceneRenderer;
