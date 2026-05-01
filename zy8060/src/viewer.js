import * as THREE from 'three';

export class Viewer3D {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf0f0f0);
    
    const aspect = container.clientWidth / container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 10000);
    this.camera.position.set(600, 600, 600);
    this.camera.lookAt(0, 0, 0);
    
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    container.appendChild(this.renderer.domElement);
    
    this.addLights();
    this.addGrid();
    
    this.trayMesh = null;
    this.instrumentMeshes = new Map();
    
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.selectedMesh = null;
    this.isDragging = false;
    this.isRotating = false;
    this.dragPlane = null;
    this.offset = new THREE.Vector3();
    
    this.orbitEnabled = true;
    this.orbitStart = new THREE.Vector2();
    this.orbitAngle = 0;
    this.orbitPhi = Math.PI / 4;
    
    this.state = null;
    
    this.bindEvents();
    this.animate();
  }
  
  addLights() {
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambient);
    
    const directional = new THREE.DirectionalLight(0xffffff, 0.8);
    directional.position.set(500, 800, 500);
    directional.castShadow = true;
    this.scene.add(directional);
  }
  
  addGrid() {
    const grid = new THREE.GridHelper(1000, 20, 0xcccccc, 0xe0e0e0);
    this.scene.add(grid);
  }
  
  setTray(tray) {
    if (this.trayMesh) {
      this.scene.remove(this.trayMesh);
    }
    
    const geometry = new THREE.BoxGeometry(tray.width, tray.depth, 10);
    const material = new THREE.MeshStandardMaterial({
      color: 0x888888,
      metalness: 0.3,
      roughness: 0.7
    });
    this.trayMesh = new THREE.Mesh(geometry, material);
    this.trayMesh.position.set(0, 0, -5);
    this.trayMesh.receiveShadow = true;
    this.scene.add(this.trayMesh);
    
    const edgeGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(tray.width, tray.depth, tray.maxHeight));
    const edgeMaterial = new THREE.LineBasicMaterial({ color: 0xff0000, opacity: 0.3, transparent: true });
    const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    edges.position.set(0, 0, tray.maxHeight / 2);
    this.scene.add(edges);
  }
  
  setInstruments(instruments) {
    this.instrumentMeshes.forEach(mesh => this.scene.remove(mesh));
    this.instrumentMeshes.clear();
    
    instruments.forEach(inst => {
      this.addInstrument(inst);
    });
  }
  
  addInstrument(inst) {
    const geometry = new THREE.BoxGeometry(inst.width, inst.depth, inst.height);
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(inst.color),
      metalness: 0.2,
      roughness: 0.6,
      transparent: true,
      opacity: 0.9
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.instrumentId = inst.id;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    this.updateInstrumentMesh(mesh, inst);
    this.scene.add(mesh);
    this.instrumentMeshes.set(inst.id, mesh);
    
    const edges = new THREE.EdgesGeometry(geometry);
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1 });
    const wireframe = new THREE.LineSegments(edges, lineMaterial);
    mesh.add(wireframe);
  }
  
  updateInstrumentMesh(mesh, inst) {
    mesh.position.set(inst.position.x, inst.position.y, inst.position.z + inst.height / 2);
    mesh.rotation.set(inst.rotation.x, inst.rotation.y, inst.rotation.z);
  }
  
  updateInstrument(id, inst) {
    const mesh = this.instrumentMeshes.get(id);
    if (mesh) {
      this.updateInstrumentMesh(mesh, inst);
    }
  }
  
  setSelectedInstrument(id) {
    this.instrumentMeshes.forEach((mesh, instId) => {
      mesh.material.emissive = new THREE.Color(instId === id ? 0xffff00 : 0x000000);
    });
    this.selectedMesh = id ? this.instrumentMeshes.get(id) : null;
  }
  
  bindEvents() {
    const canvas = this.renderer.domElement;
    
    canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
    canvas.addEventListener('wheel', (e) => this.onWheel(e));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    
    window.addEventListener('resize', () => this.onResize());
  }
  
  onMouseDown(event) {
    event.preventDefault();
    
    this.mouse.x = (event.offsetX / this.container.clientWidth) * 2 - 1;
    this.mouse.y = -(event.offsetY / this.container.clientHeight) * 2 + 1;
    
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    const meshes = Array.from(this.instrumentMeshes.values());
    const intersects = this.raycaster.intersectObjects(meshes);
    
    if (intersects.length > 0 && event.button === 0) {
      this.selectedMesh = intersects[0].object;
      if (this.state) {
        this.state.setSelectedInstrument(this.selectedMesh.userData.instrumentId);
      }
      this.orbitEnabled = false;
      this.isDragging = true;
      
      this.dragPlane = new THREE.Plane();
      const normal = new THREE.Vector3();
      this.camera.getWorldDirection(normal);
      normal.z = -1;
      normal.normalize();
      this.dragPlane.setFromNormalAndCoplanarPoint(normal, this.selectedMesh.position);
      
      const intersection = new THREE.Vector3();
      this.raycaster.ray.intersectPlane(this.dragPlane, intersection);
      this.offset.copy(this.selectedMesh.position).sub(intersection);
    } else if (event.button === 2) {
      this.orbitEnabled = false;
      this.isRotating = true;
      this.orbitStart.set(event.offsetX, event.offsetY);
    } else {
      this.orbitEnabled = true;
      this.orbitStart.set(event.offsetX, event.offsetY);
    }
  }
  
  onMouseMove(event) {
    this.mouse.x = (event.offsetX / this.container.clientWidth) * 2 - 1;
    this.mouse.y = -(event.offsetY / this.container.clientHeight) * 2 + 1;
    
    if (this.isDragging && this.selectedMesh) {
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersection = new THREE.Vector3();
      this.raycaster.ray.intersectPlane(this.dragPlane, intersection);
      
      const newPos = intersection.add(this.offset);
      const instId = this.selectedMesh.userData.instrumentId;
      if (this.state) {
        this.state.updateInstrumentPosition(instId, { x: newPos.x, y: newPos.y });
      }
      this.selectedMesh.position.x = newPos.x;
      this.selectedMesh.position.y = newPos.y;
    } else if (this.orbitEnabled) {
      const deltaX = event.offsetX - this.orbitStart.x;
      const deltaY = event.offsetY - this.orbitStart.y;
      
      this.orbitAngle -= deltaX * 0.01;
      this.orbitPhi = Math.max(0.1, Math.min(Math.PI - 0.1, this.orbitPhi - deltaY * 0.01));
      
      const radius = 1000;
      this.camera.position.x = radius * Math.sin(this.orbitPhi) * Math.cos(this.orbitAngle);
      this.camera.position.y = radius * Math.sin(this.orbitPhi) * Math.sin(this.orbitAngle);
      this.camera.position.z = radius * Math.cos(this.orbitPhi);
      this.camera.lookAt(0, 0, 100);
      
      this.orbitStart.set(event.offsetX, event.offsetY);
    }
  }
  
  onMouseUp() {
    this.isDragging = false;
    this.isRotating = false;
    this.orbitEnabled = true;
  }
  
  onWheel(event) {
    event.preventDefault();
    const delta = event.deltaY * 0.001;
    this.camera.position.multiplyScalar(1 + delta);
  }
  
  onResize() {
    const aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
  }
  
  resetView() {
    this.camera.position.set(600, 600, 600);
    this.camera.lookAt(0, 0, 0);
    this.orbitAngle = 0;
    this.orbitPhi = Math.PI / 4;
  }
  
  animate() {
    requestAnimationFrame(() => this.animate());
    this.renderer.render(this.scene, this.camera);
  }
}
