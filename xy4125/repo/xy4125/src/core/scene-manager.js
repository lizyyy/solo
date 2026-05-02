import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GeometryCalculator } from './geometry-calculator.js';

export const ViewMode = {
  BOTH: 'both',
  MAXILLARY_ONLY: 'maxillary',
  MANDIBULAR_ONLY: 'mandibular'
};

export class SceneManager {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error(`Container element with id "${containerId}" not found`);
    }

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.maxillaryMesh = null;
    this.mandibularMesh = null;
    this.attachmentMeshes = [];
    this.toothMeshes = [];
    
    this.selectionHighlight = null;
    this.gridHelper = null;
    this.axisHelper = null;

    this.viewMode = ViewMode.BOTH;
    this.isAnimating = false;
    this.animationId = null;

    this.geometryCalculator = new GeometryCalculator();

    this.listeners = [];
    
    this._init();
  }

  _init() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);

    const aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    this.camera.position.set(0, 50, 100);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.screenSpacePanning = true;
    this.controls.minDistance = 10;
    this.controls.maxDistance = 500;

    this._setupLights();
    this._setupHelpers();
    this._setupEventListeners();
  }

  _setupLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 100, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.camera.left = -100;
    directionalLight.shadow.camera.right = 100;
    directionalLight.shadow.camera.top = 100;
    directionalLight.shadow.camera.bottom = -100;
    this.scene.add(directionalLight);

    const fillLight = new THREE.DirectionalLight(0x8888ff, 0.3);
    fillLight.position.set(-50, 50, -50);
    this.scene.add(fillLight);
  }

  _setupHelpers() {
    this.gridHelper = new THREE.GridHelper(200, 20, 0x444444, 0x222222);
    this.gridHelper.position.y = -20;
    this.scene.add(this.gridHelper);

    this.axisHelper = new THREE.AxesHelper(50);
    this.scene.add(this.axisHelper);
  }

  _setupEventListeners() {
    window.addEventListener('resize', () => this._onWindowResize());
    
    this.renderer.domElement.addEventListener('click', (e) => this._onClick(e));
    this.renderer.domElement.addEventListener('mousemove', (e) => this._onMouseMove(e));
  }

  _onWindowResize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    
    this.renderer.setSize(width, height);
  }

  _onClick(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    const selectableObjects = [...this.attachmentMeshes, ...this.toothMeshes];
    const intersects = this.raycaster.intersectObjects(selectableObjects, false);

    if (intersects.length > 0) {
      const selectedObject = intersects[0].object;
      this._handleSelection(selectedObject);
    }
  }

  _onMouseMove(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  _handleSelection(object) {
    if (this.selectionHighlight) {
      this.scene.remove(this.selectionHighlight);
      this.selectionHighlight = null;
    }

    const selectionData = object.userData;
    
    if (object.geometry) {
      const highlightMaterial = new THREE.MeshBasicMaterial({
        color: 0xffff00,
        wireframe: true,
        transparent: true,
        opacity: 0.5
      });
      this.selectionHighlight = new THREE.Mesh(object.geometry.clone(), highlightMaterial);
      this.selectionHighlight.position.copy(object.position);
      this.selectionHighlight.rotation.copy(object.rotation);
      this.selectionHighlight.scale.copy(object.scale);
      this.scene.add(this.selectionHighlight);
    }

    this.notify('objectSelected', {
      object,
      userData: selectionData
    });
  }

  loadMaxillaryModel(geometry, color = 0x88ccff) {
    if (this.maxillaryMesh) {
      this.scene.remove(this.maxillaryMesh);
    }

    const material = new THREE.MeshPhongMaterial({
      color: color,
      shininess: 100,
      specular: 0x111111,
      transparent: true,
      opacity: 0.9
    });

    this.maxillaryMesh = new THREE.Mesh(geometry, material);
    this.maxillaryMesh.castShadow = true;
    this.maxillaryMesh.receiveShadow = true;
    this.maxillaryMesh.userData = { type: 'arch', position: 'maxillary' };
    
    this.scene.add(this.maxillaryMesh);
    this._fitCameraToScene();

    return this.maxillaryMesh;
  }

  loadMandibularModel(geometry, color = 0xffaa88) {
    if (this.mandibularMesh) {
      this.scene.remove(this.mandibularMesh);
    }

    const material = new THREE.MeshPhongMaterial({
      color: color,
      shininess: 100,
      specular: 0x111111,
      transparent: true,
      opacity: 0.9
    });

    this.mandibularMesh = new THREE.Mesh(geometry, material);
    this.mandibularMesh.castShadow = true;
    this.mandibularMesh.receiveShadow = true;
    this.mandibularMesh.userData = { type: 'arch', position: 'mandibular' };
    
    this.scene.add(this.mandibularMesh);
    this._fitCameraToScene();

    return this.mandibularMesh;
  }

  addAttachment(attachmentData, toothData, color = 0xff4444) {
    const geometry = new THREE.BoxGeometry(
      attachmentData.size.x,
      attachmentData.size.y,
      attachmentData.size.z
    );

    const material = new THREE.MeshPhongMaterial({
      color: color,
      shininess: 50,
      specular: 0x222222
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(attachmentData.position);
    mesh.rotation.z = attachmentData.rotation * Math.PI / 180;
    mesh.castShadow = true;
    mesh.userData = {
      type: 'attachment',
      toothId: toothData.id,
      fdiNumber: toothData.fdiNumber,
      toothName: toothData.name,
      attachmentData: { ...attachmentData }
    };

    this.scene.add(mesh);
    this.attachmentMeshes.push(mesh);

    return mesh;
  }

  addToothMesh(geometry, toothData, color = null) {
    const material = new THREE.MeshPhongMaterial({
      color: color || (toothData.fdiNumber > 30 ? 0xffddcc : 0xaaddff),
      shininess: 80,
      specular: 0x111111
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = {
      type: 'tooth',
      toothId: toothData.id,
      fdiNumber: toothData.fdiNumber,
      toothName: toothData.name,
      toothData: { ...toothData }
    };

    this.scene.add(mesh);
    this.toothMeshes.push(mesh);

    return mesh;
  }

  clearAttachments() {
    this.attachmentMeshes.forEach(mesh => {
      this.scene.remove(mesh);
    });
    this.attachmentMeshes = [];
  }

  clearTeeth() {
    this.toothMeshes.forEach(mesh => {
      this.scene.remove(mesh);
    });
    this.toothMeshes = [];
  }

  clearAll() {
    if (this.maxillaryMesh) {
      this.scene.remove(this.maxillaryMesh);
      this.maxillaryMesh = null;
    }
    if (this.mandibularMesh) {
      this.scene.remove(this.mandibularMesh);
      this.mandibularMesh = null;
    }
    this.clearAttachments();
    this.clearTeeth();
    
    if (this.selectionHighlight) {
      this.scene.remove(this.selectionHighlight);
      this.selectionHighlight = null;
    }
  }

  setViewMode(mode) {
    this.viewMode = mode;

    if (this.maxillaryMesh) {
      this.maxillaryMesh.visible = mode === ViewMode.BOTH || mode === ViewMode.MAXILLARY_ONLY;
    }
    if (this.mandibularMesh) {
      this.mandibularMesh.visible = mode === ViewMode.BOTH || mode === ViewMode.MANDIBULAR_ONLY;
    }

    this.attachmentMeshes.forEach(mesh => {
      const position = mesh.userData.fdiNumber > 30 ? 'mandibular' : 'maxillary';
      mesh.visible = mode === ViewMode.BOTH || 
        (mode === ViewMode.MAXILLARY_ONLY && position === 'maxillary') ||
        (mode === ViewMode.MANDIBULAR_ONLY && position === 'mandibular');
    });

    this.toothMeshes.forEach(mesh => {
      const position = mesh.userData.fdiNumber > 30 ? 'mandibular' : 'maxillary';
      mesh.visible = mode === ViewMode.BOTH || 
        (mode === ViewMode.MAXILLARY_ONLY && position === 'maxillary') ||
        (mode === ViewMode.MANDIBULAR_ONLY && position === 'mandibular');
    });
  }

  _fitCameraToScene() {
    const box = new THREE.Box3();
    
    if (this.maxillaryMesh) {
      box.expandByObject(this.maxillaryMesh);
    }
    if (this.mandibularMesh) {
      box.expandByObject(this.mandibularMesh);
    }

    if (!box.isEmpty()) {
      const center = new THREE.Vector3();
      const size = new THREE.Vector3();
      box.getCenter(center);
      box.getSize(size);

      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = this.camera.fov * (Math.PI / 180);
      const cameraZ = Math.abs(maxDim / (2 * Math.tan(fov / 2)));

      this.camera.position.set(center.x, center.y + cameraZ * 0.5, center.z + cameraZ);
      this.camera.lookAt(center);
      this.controls.target.copy(center);
      this.controls.update();
    }
  }

  startAnimation() {
    if (this.isAnimating) return;
    this.isAnimating = true;
    this._animate();
  }

  stopAnimation() {
    this.isAnimating = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  _animate() {
    if (!this.isAnimating) return;

    this.animationId = requestAnimationFrame(() => this._animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  getAttachmentMeshByToothId(toothId) {
    return this.attachmentMeshes.find(mesh => mesh.userData.toothId === toothId);
  }

  getToothMeshByToothId(toothId) {
    return this.toothMeshes.find(mesh => mesh.userData.toothId === toothId);
  }

  updateAttachmentPosition(toothId, newPosition) {
    const mesh = this.getAttachmentMeshByToothId(toothId);
    if (mesh) {
      mesh.position.copy(newPosition);
      if (mesh.userData.attachmentData) {
        mesh.userData.attachmentData.position = newPosition.clone();
      }
    }
  }

  showCollisionHighlight(object1, object2) {
    const highlightMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      wireframe: true,
      transparent: true,
      opacity: 0.8
    });

    if (object1.geometry) {
      const highlight1 = new THREE.Mesh(object1.geometry.clone(), highlightMaterial);
      highlight1.position.copy(object1.position);
      highlight1.rotation.copy(object1.rotation);
      highlight1.userData = { type: 'collision_highlight', target: object1 };
      this.scene.add(highlight1);
    }

    if (object2 && object2.geometry) {
      const highlight2 = new THREE.Mesh(object2.geometry.clone(), highlightMaterial);
      highlight2.position.copy(object2.position);
      highlight2.rotation.copy(object2.rotation);
      highlight2.userData = { type: 'collision_highlight', target: object2 };
      this.scene.add(highlight2);
    }
  }

  addEventListener(type, callback) {
    this.listeners.push({ type, callback });
  }

  removeEventListener(type, callback) {
    this.listeners = this.listeners.filter(
      l => !(l.type === type && l.callback === callback)
    );
  }

  notify(type, data) {
    this.listeners
      .filter(l => l.type === type)
      .forEach(l => l.callback(data));
  }

  getSceneBounds() {
    const box = new THREE.Box3();
    
    if (this.maxillaryMesh) {
      box.expandByObject(this.maxillaryMesh);
    }
    if (this.mandibularMesh) {
      box.expandByObject(this.mandibularMesh);
    }

    return box;
  }

  dispose() {
    this.stopAnimation();
    
    this.clearAll();
    
    if (this.gridHelper) {
      this.scene.remove(this.gridHelper);
      this.gridHelper.geometry.dispose();
      this.gridHelper.material.dispose();
    }
    
    if (this.axisHelper) {
      this.scene.remove(this.axisHelper);
    }

    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement && this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
    }

    this.listeners = [];
  }
}

export default SceneManager;
