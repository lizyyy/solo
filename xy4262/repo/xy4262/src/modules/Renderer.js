import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class Renderer {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    
    this.simulation = null;
    this.droneMeshes = new Map();
    this.trajectoryLines = new Map();
    this.noFlyZoneMeshes = [];
    this.groundPlane = null;
    this.groundGrid = null;
    
    this.animationId = null;
    this.container = null;
  }

  async init() {
    this.container = document.getElementById('canvas-container');
    
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a1a);
    this.scene.fog = new THREE.Fog(0x0a0a1a, 200, 800);

    this.camera = new THREE.PerspectiveCamera(
      60,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      2000
    );
    this.camera.position.set(100, 80, 100);

    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true 
    });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.screenSpacePanning = false;
    this.controls.maxPolarAngle = Math.PI * 0.9;
    this.controls.minDistance = 10;
    this.controls.maxDistance = 1000;

    this.setupLights();
    this.setupGround();
    this.setupAxesHelper();
    this.setupEventListeners();
    
    this.animate();
  }

  setupLights() {
    const ambientLight = new THREE.AmbientLight(0x404060, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(100, 200, 100);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.camera.left = -200;
    directionalLight.shadow.camera.right = 200;
    directionalLight.shadow.camera.top = 200;
    directionalLight.shadow.camera.bottom = -200;
    this.scene.add(directionalLight);

    const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x3d5c3d, 0.4);
    this.scene.add(hemisphereLight);
  }

  setupGround() {
    const groundGeometry = new THREE.PlaneGeometry(1000, 1000);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1a2e,
      roughness: 0.9,
      metalness: 0.1
    });
    this.groundPlane = new THREE.Mesh(groundGeometry, groundMaterial);
    this.groundPlane.rotation.x = -Math.PI / 2;
    this.groundPlane.receiveShadow = true;
    this.scene.add(this.groundPlane);

    this.groundGrid = new THREE.GridHelper(1000, 100, 0x334455, 0x223344);
    this.groundGrid.position.y = 0.01;
    this.scene.add(this.groundGrid);
  }

  setupAxesHelper() {
    const axesHelper = new THREE.AxesHelper(50);
    this.scene.add(axesHelper);
  }

  setupEventListeners() {
    window.addEventListener('resize', () => this.onWindowResize());
  }

  onWindowResize() {
    if (!this.container) return;
    
    this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
  }

  setSimulation(simulation) {
    this.simulation = simulation;
    this.clearScene();
    this.createNoFlyZones();
    this.createTrajectories();
    this.createDrones();
  }

  clearScene() {
    this.droneMeshes.forEach(mesh => this.scene.remove(mesh));
    this.droneMeshes.clear();

    this.trajectoryLines.forEach(line => this.scene.remove(line));
    this.trajectoryLines.clear();

    this.noFlyZoneMeshes.forEach(mesh => this.scene.remove(mesh));
    this.noFlyZoneMeshes = [];
  }

  createNoFlyZones() {
    if (!this.simulation) return;

    this.simulation.noFlyZones.forEach(zone => {
      const zoneGroup = new THREE.Group();

      if (zone.shape === 'circle') {
        const geometry = new THREE.CylinderGeometry(
          zone.radius,
          zone.radius,
          zone.maxAltitude - zone.minAltitude,
          32
        );
        
        const material = new THREE.MeshStandardMaterial({
          color: 0xff4444,
          transparent: true,
          opacity: 0.15,
          side: THREE.DoubleSide
        });

        const cylinder = new THREE.Mesh(geometry, material);
        cylinder.position.y = (zone.maxAltitude + zone.minAltitude) / 2;
        cylinder.position.x = zone.center.x;
        cylinder.position.z = zone.center.y;
        cylinder.castShadow = true;
        cylinder.receiveShadow = true;
        zoneGroup.add(cylinder);

        const edgeGeometry = new THREE.EdgesGeometry(geometry);
        const edgeMaterial = new THREE.LineBasicMaterial({ 
          color: 0xff6666,
          transparent: true,
          opacity: 0.6
        });
        const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
        edges.position.copy(cylinder.position);
        zoneGroup.add(edges);

      } else if (zone.shape === 'polygon' && zone.coordinates.length >= 3) {
        const shape = new THREE.Shape();
        
        const coords = zone.coordinates;
        shape.moveTo(coords[0].x, coords[0].y);
        for (let i = 1; i < coords.length; i++) {
          shape.lineTo(coords[i].x, coords[i].y);
        }

        const extrudeSettings = {
          steps: 1,
          depth: zone.maxAltitude - zone.minAltitude,
          bevelEnabled: false
        };

        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        
        geometry.rotateX(-Math.PI / 2);
        geometry.translate(0, zone.minAltitude, 0);

        const material = new THREE.MeshStandardMaterial({
          color: 0xff4444,
          transparent: true,
          opacity: 0.15,
          side: THREE.DoubleSide
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        zoneGroup.add(mesh);

        const edgeGeometry = new THREE.EdgesGeometry(geometry);
        const edgeMaterial = new THREE.LineBasicMaterial({ 
          color: 0xff6666,
          transparent: true,
          opacity: 0.6
        });
        const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
        zoneGroup.add(edges);
      }

      if (zone.name) {
        zoneGroup.userData = { name: zone.name };
      }

      this.scene.add(zoneGroup);
      this.noFlyZoneMeshes.push(zoneGroup);
    });
  }

  createTrajectories() {
    if (!this.simulation) return;

    this.simulation.drones.forEach(drone => {
      if (drone.waypoints.length < 2) return;

      const points = drone.waypoints.map(wp => 
        new THREE.Vector3(wp.x, wp.z, wp.y)
      );

      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      
      const color = new THREE.Color(drone.color);
      const material = new THREE.LineBasicMaterial({ 
        color: color,
        transparent: true,
        opacity: 0.3
      });

      const line = new THREE.Line(geometry, material);
      this.scene.add(line);
      this.trajectoryLines.set(drone.id, line);
    });
  }

  createDrones() {
    if (!this.simulation) return;

    const droneGeometry = new THREE.SphereGeometry(1.5, 16, 16);
    const glowGeometry = new THREE.SphereGeometry(2.5, 16, 16);

    this.simulation.drones.forEach(drone => {
      const droneGroup = new THREE.Group();

      const color = new THREE.Color(drone.color);
      
      const material = new THREE.MeshStandardMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: 0.5,
        metalness: 0.3,
        roughness: 0.4
      });

      const droneMesh = new THREE.Mesh(droneGeometry, material);
      droneMesh.castShadow = true;
      droneGroup.add(droneMesh);

      const glowMaterial = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.2
      });
      const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
      droneGroup.add(glowMesh);

      const light = new THREE.PointLight(color, 2, 30);
      droneGroup.add(light);

      if (drone.waypoints.length > 0) {
        const firstWp = drone.waypoints[0];
        droneGroup.position.set(firstWp.x, firstWp.z, firstWp.y);
      }

      droneGroup.visible = false;
      droneGroup.userData = { 
        droneId: drone.id,
        originalColor: color
      };

      this.scene.add(droneGroup);
      this.droneMeshes.set(drone.id, droneGroup);
    });
  }

  updateScene() {
    if (!this.simulation) return;

    const droneStates = this.simulation.getDroneStates();
    
    droneStates.forEach(state => {
      const mesh = this.droneMeshes.get(state.id);
      if (!mesh) return;

      if (state.isActive && state.position) {
        mesh.visible = true;
        mesh.position.set(state.position.x, state.position.z, state.position.y);

        const originalColor = mesh.userData.originalColor;
        if (state.batteryLevel < 10) {
          mesh.children[0].material.color.setHex(0xff0000);
          mesh.children[0].material.emissive.setHex(0xff0000);
          mesh.children[1].material.color.setHex(0xff0000);
          mesh.children[2].color.setHex(0xff0000);
        } else if (state.batteryLevel < 20) {
          mesh.children[0].material.color.setHex(0xffaa00);
          mesh.children[0].material.emissive.setHex(0xffaa00);
          mesh.children[1].material.color.setHex(0xffaa00);
          mesh.children[2].color.setHex(0xffaa00);
        } else {
          mesh.children[0].material.color.copy(originalColor);
          mesh.children[0].material.emissive.copy(originalColor);
          mesh.children[1].material.color.copy(originalColor);
          mesh.children[2].color.copy(originalColor);
        }

        const scale = 1 + Math.sin(Date.now() * 0.005) * 0.1;
        mesh.children[0].scale.setScalar(scale);

      } else {
        mesh.visible = false;
      }
    });
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
    if (this.renderer) {
      this.renderer.dispose();
    }
    window.removeEventListener('resize', () => this.onWindowResize());
  }
}
