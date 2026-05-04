import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GeoUtils } from '../utils/geoUtils.js';

export class Scene3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    
    this.scale = 1;
    this.centerCoords = { lat: 0, lon: 0 };
    
    this.standsGroup = null;
    this.vehiclesGroup = null;
    this.tracksGroup = null;
    this.riskZonesGroup = null;
    this.taxiwaysGroup = null;
    
    this.vehicleMeshes = new Map();
    this.standMeshes = new Map();
    this.trackLines = new Map();
    
    this.animationId = null;
    this.clock = new THREE.Clock();
    
    this.init();
  }

  init() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a1a);
    this.scene.fog = new THREE.Fog(0x0a0a1a, 500, 2000);
    
    const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 5000);
    this.camera.position.set(0, 300, 200);
    
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true
    });
    this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.screenSpacePanning = true;
    this.controls.minDistance = 50;
    this.controls.maxDistance = 1000;
    this.controls.maxPolarAngle = Math.PI / 2;
    
    this.setupLighting();
    this.createGround();
    this.createGroups();
    
    window.addEventListener('resize', () => this.onResize());
    this.animate();
  }

  setupLighting() {
    const ambientLight = new THREE.AmbientLight(0x404080, 0.6);
    this.scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(200, 400, 200);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 1000;
    directionalLight.shadow.camera.left = -500;
    directionalLight.shadow.camera.right = 500;
    directionalLight.shadow.camera.top = 500;
    directionalLight.shadow.camera.bottom = -500;
    this.scene.add(directionalLight);
    
    const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x2d2d2d, 0.4);
    this.scene.add(hemisphereLight);
  }

  createGround() {
    const groundGeometry = new THREE.PlaneGeometry(2000, 2000);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a2a3a,
      roughness: 0.9,
      metalness: 0.1
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
    
    const gridHelper = new THREE.GridHelper(2000, 100, 0x0066aa, 0x003355);
    gridHelper.position.y = 0.01;
    this.scene.add(gridHelper);
  }

  createGroups() {
    this.standsGroup = new THREE.Group();
    this.standsGroup.name = 'Stands';
    this.scene.add(this.standsGroup);
    
    this.taxiwaysGroup = new THREE.Group();
    this.taxiwaysGroup.name = 'Taxiways';
    this.scene.add(this.taxiwaysGroup);
    
    this.vehiclesGroup = new THREE.Group();
    this.vehiclesGroup.name = 'Vehicles';
    this.scene.add(this.vehiclesGroup);
    
    this.tracksGroup = new THREE.Group();
    this.tracksGroup.name = 'Tracks';
    this.scene.add(this.tracksGroup);
    
    this.riskZonesGroup = new THREE.Group();
    this.riskZonesGroup.name = 'RiskZones';
    this.scene.add(this.riskZonesGroup);
  }

  setCenterCoords(lat, lon) {
    this.centerCoords = { lat, lon };
  }

  latLonToXY(lat, lon) {
    const pos = GeoUtils.latLonToXY(lat, lon, this.centerCoords.lat, this.centerCoords.lon, this.scale);
    return { x: pos.x, z: -pos.y };
  }

  clear() {
    while (this.standsGroup.children.length > 0) {
      const child = this.standsGroup.children[0];
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
      this.standsGroup.remove(child);
    }
    
    while (this.vehiclesGroup.children.length > 0) {
      const child = this.vehiclesGroup.children[0];
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
      this.vehiclesGroup.remove(child);
    }
    
    while (this.tracksGroup.children.length > 0) {
      const child = this.tracksGroup.children[0];
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
      this.tracksGroup.remove(child);
    }
    
    while (this.riskZonesGroup.children.length > 0) {
      const child = this.riskZonesGroup.children[0];
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
      this.riskZonesGroup.remove(child);
    }
    
    this.vehicleMeshes.clear();
    this.standMeshes.clear();
    this.trackLines.clear();
  }

  createStand(stand) {
    const pos = this.latLonToXY(stand.latitude, stand.longitude);
    
    const standGroup = new THREE.Group();
    standGroup.userData = { type: 'stand', ...stand };
    
    const standGeometry = new THREE.CylinderGeometry(15, 15, 0.5, 8);
    const standMaterial = new THREE.MeshStandardMaterial({
      color: stand.restricted ? 0xff4444 : 0x3366aa,
      transparent: true,
      opacity: 0.6,
      roughness: 0.8
    });
    const standMesh = new THREE.Mesh(standGeometry, standMaterial);
    standMesh.position.set(pos.x, 0.25, pos.z);
    standMesh.receiveShadow = true;
    standGroup.add(standMesh);
    
    const borderGeometry = new THREE.RingGeometry(14, 15, 32);
    const borderMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ccff,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide
    });
    const borderMesh = new THREE.Mesh(borderGeometry, borderMaterial);
    borderMesh.rotation.x = -Math.PI / 2;
    borderMesh.position.set(pos.x, 0.3, pos.z);
    standGroup.add(borderMesh);
    
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#00ccff';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(stand.name || stand.id, 64, 40);
    
    const texture = new THREE.CanvasTexture(canvas);
    const labelMaterial = new THREE.SpriteMaterial({ 
      map: texture,
      transparent: true
    });
    const labelSprite = new THREE.Sprite(labelMaterial);
    labelSprite.position.set(pos.x, 5, pos.z);
    labelSprite.scale.set(30, 15, 1);
    standGroup.add(labelSprite);
    
    if (stand.polygon && stand.polygon.length >= 3) {
      const shape = new THREE.Shape();
      const firstPoint = this.latLonToXY(stand.polygon[0].latitude || stand.polygon[0].lat,
                                         stand.polygon[0].longitude || stand.polygon[0].lon);
      shape.moveTo(firstPoint.x - pos.x, firstPoint.z - pos.z);
      
      for (let i = 1; i < stand.polygon.length; i++) {
        const p = this.latLonToXY(stand.polygon[i].latitude || stand.polygon[i].lat,
                                   stand.polygon[i].longitude || stand.polygon[i].lon);
        shape.lineTo(p.x - pos.x, p.z - pos.z);
      }
      shape.closePath();
      
      const extrudeSettings = {
        steps: 1,
        depth: 0.2,
        bevelEnabled: false
      };
      
      const polyGeometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      const polyMaterial = new THREE.MeshStandardMaterial({
        color: stand.restricted ? 0xff6666 : 0x4488cc,
        transparent: true,
        opacity: 0.4
      });
      const polyMesh = new THREE.Mesh(polyGeometry, polyMaterial);
      polyMesh.rotation.x = Math.PI / 2;
      polyMesh.position.set(pos.x, 0, pos.z);
      standGroup.add(polyMesh);
    }
    
    this.standsGroup.add(standGroup);
    this.standMeshes.set(stand.id, standGroup);
    
    return standGroup;
  }

  createVehicle(vehicle) {
    const vehicleGroup = new THREE.Group();
    vehicleGroup.userData = { type: 'vehicle', ...vehicle };
    
    const vehicleColors = {
      'fuel_truck': 0xff6600,
      'passenger_bridge': 0x00cc99,
      'cargo_loader': 0x9966ff,
      'bus': 0x0099ff,
      'tug': 0xffff00,
      'belt_loader': 0xff99cc,
      'unknown': 0x888888
    };
    
    const color = vehicleColors[vehicle.type] || vehicleColors['unknown'];
    
    const bodyGeometry = new THREE.BoxGeometry(4, 2, 8);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.7,
      metalness: 0.1
    });
    const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
    bodyMesh.position.y = 1;
    bodyMesh.castShadow = true;
    vehicleGroup.add(bodyMesh);
    
    const cabinGeometry = new THREE.BoxGeometry(3, 1.5, 3);
    const cabinMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.5,
      metalness: 0.3
    });
    const cabinMesh = new THREE.Mesh(cabinGeometry, cabinMaterial);
    cabinMesh.position.set(0, 2.75, -2);
    cabinMesh.castShadow = true;
    vehicleGroup.add(cabinMesh);
    
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${vehicle.type}: ${vehicle.id}`, 64, 22);
    
    const texture = new THREE.CanvasTexture(canvas);
    const labelMaterial = new THREE.SpriteMaterial({ 
      map: texture,
      transparent: true
    });
    const labelSprite = new THREE.Sprite(labelMaterial);
    labelSprite.position.set(0, 4, 0);
    labelSprite.scale.set(20, 5, 1);
    vehicleGroup.add(labelSprite);
    
    if (vehicle.tracks && vehicle.tracks.length > 0) {
      const firstTrack = vehicle.tracks[0];
      const pos = this.latLonToXY(firstTrack.latitude, firstTrack.longitude);
      vehicleGroup.position.set(pos.x, 0, pos.z);
    }
    
    this.vehiclesGroup.add(vehicleGroup);
    this.vehicleMeshes.set(vehicle.id, vehicleGroup);
    
    return vehicleGroup;
  }

  createTrackLine(vehicle, color = 0x00ff00, opacity = 0.5) {
    if (!vehicle.tracks || vehicle.tracks.length < 2) return null;
    
    const points = [];
    vehicle.tracks.forEach(track => {
      const pos = this.latLonToXY(track.latitude, track.longitude);
      points.push(new THREE.Vector3(pos.x, 0.1, pos.z));
    });
    
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: color,
      transparent: true,
      opacity: opacity
    });
    const line = new THREE.Line(geometry, material);
    line.userData = { vehicleId: vehicle.id };
    
    this.tracksGroup.add(line);
    this.trackLines.set(vehicle.id, line);
    
    return line;
  }

  createTaxiway(taxiway) {
    if (!taxiway.points || taxiway.points.length < 2) return null;
    
    const points = taxiway.points.map(p => {
      const pos = this.latLonToXY(p.latitude || p.lat, p.longitude || p.lon);
      return new THREE.Vector3(pos.x, 0.05, pos.z);
    });
    
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: 0x6699ff,
      transparent: true,
      opacity: 0.7,
      linewidth: 3
    });
    const line = new THREE.Line(geometry, material);
    
    this.taxiwaysGroup.add(line);
    return line;
  }

  createRiskZone(risk, color = 0xff0000) {
    const zoneGroup = new THREE.Group();
    zoneGroup.userData = { type: 'risk', ...risk };
    
    const startTime = risk.startTime;
    const positions = [];
    
    if (risk.metadata && risk.metadata.vehicleId) {
      const vehicle = { id: risk.metadata.vehicleId };
      if (vehicle) {
        const pos = new THREE.Vector3(0, 0, 0);
        
        const radiusGeometry = new THREE.RingGeometry(8, 10, 32);
        const radiusMaterial = new THREE.MeshBasicMaterial({
          color: color,
          transparent: true,
          opacity: 0.4,
          side: THREE.DoubleSide
        });
        const radiusMesh = new THREE.Mesh(radiusGeometry, radiusMaterial);
        radiusMesh.rotation.x = -Math.PI / 2;
        radiusMesh.position.y = 0.1;
        zoneGroup.add(radiusMesh);
        
        const pulseMaterial = new THREE.MeshBasicMaterial({
          color: color,
          transparent: true,
          opacity: 0.6
        });
        const pulseMesh = new THREE.Mesh(radiusGeometry.clone(), pulseMaterial);
        pulseMesh.rotation.x = -Math.PI / 2;
        pulseMesh.position.y = 0.15;
        pulseMesh.userData = { pulse: true, startTime: Date.now() };
        zoneGroup.add(pulseMesh);
      }
    }
    
    if (risk.metadata && risk.metadata.vehicleId1 && risk.metadata.vehicleId2) {
      const v1 = { id: risk.metadata.vehicleId1 };
      const v2 = { id: risk.metadata.vehicleId2 };
      
      if (v1 && v2) {
        const lineMaterial = new THREE.LineDashedMaterial({
          color: 0xff0000,
          dashSize: 2,
          gapSize: 1,
          transparent: true,
          opacity: 0.8
        });
        const lineGeometry = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(-10, 1, 0),
          new THREE.Vector3(10, 1, 0)
        ]);
        const line = new THREE.Line(lineGeometry, lineMaterial);
        line.computeLineDistances();
        zoneGroup.add(line);
      }
    }
    
    this.riskZonesGroup.add(zoneGroup);
    return zoneGroup;
  }

  updateVehiclePosition(vehicleId, position, heading = 0) {
    const mesh = this.vehicleMeshes.get(vehicleId);
    if (!mesh) return;
    
    const pos = this.latLonToXY(position.latitude, position.longitude);
    mesh.position.set(pos.x, 0, pos.z);
    
    if (heading !== undefined && heading !== null) {
      mesh.rotation.y = -THREE.MathUtils.degToRad(heading);
    }
  }

  updateVehicleVisibility(vehicleId, visible) {
    const mesh = this.vehicleMeshes.get(vehicleId);
    if (mesh) {
      mesh.visible = visible;
    }
  }

  updateTrackVisibility(vehicleId, visible) {
    const line = this.trackLines.get(vehicleId);
    if (line) {
      line.visible = visible;
    }
  }

  highlightVehicle(vehicleId, highlight = true) {
    const mesh = this.vehicleMeshes.get(vehicleId);
    if (!mesh) return;
    
    mesh.traverse(child => {
      if (child.isMesh && child.material) {
        if (highlight) {
          child.material.emissive = new THREE.Color(0xffffff);
          child.material.emissiveIntensity = 0.5;
        } else {
          if (child.material.emissive) {
            child.material.emissive = new THREE.Color(0x000000);
            child.material.emissiveIntensity = 0;
          }
        }
      }
    });
  }

  focusOnPosition(x, z, distance = 100) {
    this.controls.target.set(x, 0, z);
    this.camera.position.set(x, distance * 0.6, z + distance * 0.4);
    this.controls.update();
  }

  focusOnVehicle(vehicleId) {
    const mesh = this.vehicleMeshes.get(vehicleId);
    if (mesh) {
      this.focusOnPosition(mesh.position.x, mesh.position.z);
      this.highlightVehicle(vehicleId, true);
    }
  }

  focusOnStand(standId) {
    const mesh = this.standMeshes.get(standId);
    if (mesh) {
      this.focusOnPosition(mesh.position.x, mesh.position.z, 80);
    }
  }

  setCameraTopView() {
    const box = new THREE.Box3().setFromObject(this.standsGroup);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    
    this.camera.position.set(center.x, Math.max(size.x, size.z) * 1.5, center.z);
    this.camera.lookAt(center);
    this.controls.target.set(center.x, 0, center.z);
    this.controls.update();
  }

  onResize() {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  animate() {
    this.animationId = requestAnimationFrame(() => this.animate());
    
    const delta = this.clock.getDelta();
    this.controls.update();
    
    this.riskZonesGroup.traverse(child => {
      if (child.userData && child.userData.pulse) {
        const elapsed = (Date.now() - child.userData.startTime) / 1000;
        const scale = 1 + Math.sin(elapsed * 3) * 0.3;
        child.scale.set(scale, scale, 1);
        child.material.opacity = 0.3 + Math.sin(elapsed * 3) * 0.2;
      }
    });
    
    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    
    window.removeEventListener('resize', () => this.onResize());
    
    this.clear();
    
    if (this.renderer) {
      this.renderer.dispose();
    }
  }
}

export default Scene3D;
