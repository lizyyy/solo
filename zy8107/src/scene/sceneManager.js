import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class SceneManager {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.objects = new Map();
    this.isAnimating = false;
    
    this.init();
  }

  init() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0f0f23);
    this.scene.fog = new THREE.Fog(0x0f0f23, 100, 500);

    const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 2000);
    this.camera.position.set(80, 60, 80);
    this.camera.lookAt(0, 0, 0);

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
    this.controls.screenSpacePanning = false;
    this.controls.minDistance = 10;
    this.controls.maxDistance = 300;
    this.controls.maxPolarAngle = Math.PI / 2.1;

    this.setupLights();
    this.setupGround();
    this.setupGrid();
    this.setupEventListeners();
    
    this.animate();
  }

  setupLights() {
    const ambientLight = new THREE.AmbientLight(0x404060, 0.5);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(100, 100, 50);
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

    const hemisphereLight = new THREE.HemisphereLight(0x87CEEB, 0x3d3d5c, 0.4);
    this.scene.add(hemisphereLight);
  }

  setupGround() {
    const groundGeometry = new THREE.PlaneGeometry(500, 500);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x2d3436,
      roughness: 0.9,
      metalness: 0.1
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.name = 'ground';
    this.scene.add(ground);
  }

  setupGrid() {
    const gridHelper = new THREE.GridHelper(500, 50, 0x444466, 0x333355);
    gridHelper.position.y = 0.01;
    this.scene.add(gridHelper);

    const axesHelper = new THREE.AxesHelper(30);
    axesHelper.position.y = 0.1;
    this.scene.add(axesHelper);
  }

  setupEventListeners() {
    window.addEventListener('resize', () => {
      this.onResize();
    });
  }

  onResize() {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  addObject(id, object) {
    this.objects.set(id, object);
    this.scene.add(object);
  }

  removeObject(id) {
    const object = this.objects.get(id);
    if (object) {
      this.scene.remove(object);
      if (object.traverse) {
        object.traverse((child) => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(m => m.dispose());
            } else {
              child.material.dispose();
            }
          }
        });
      }
      this.objects.delete(id);
    }
  }

  getObject(id) {
    return this.objects.get(id);
  }

  clear() {
    this.objects.forEach((object, id) => {
      this.removeObject(id);
    });
  }

  animate() {
    this.isAnimating = true;
    requestAnimationFrame(() => this.animate());
    
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  stopAnimation() {
    this.isAnimating = false;
  }

  focusOnObject(objectId) {
    const object = this.objects.get(objectId);
    if (object) {
      const box = new THREE.Box3().setFromObject(object);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = this.camera.fov * (Math.PI / 180);
      let cameraZ = Math.abs(maxDim / Math.sin(fov / 2));
      
      this.camera.position.set(
        center.x + cameraZ * 0.8,
        center.y + cameraZ * 0.5,
        center.z + cameraZ * 0.8
      );
      this.controls.target.copy(center);
      this.controls.update();
    }
  }

  highlightObject(objectId, isHighlighted = true) {
    const object = this.objects.get(objectId);
    if (object) {
      object.traverse((child) => {
        if (child.isMesh) {
          if (isHighlighted) {
            child.userData.originalMaterial = child.material.clone();
            const highlightMaterial = new THREE.MeshStandardMaterial({
              color: 0xff4444,
              emissive: 0xff2222,
              emissiveIntensity: 0.5,
              transparent: true,
              opacity: 0.8
            });
            child.material = highlightMaterial;
          } else if (child.userData.originalMaterial) {
            child.material = child.userData.originalMaterial;
            delete child.userData.originalMaterial;
          }
        }
      });
    }
  }

  flashObject(objectId, duration = 500) {
    const object = this.objects.get(objectId);
    if (object) {
      let flashCount = 0;
      const maxFlashes = 3;
      const interval = setInterval(() => {
        if (flashCount >= maxFlashes) {
          clearInterval(interval);
          this.highlightObject(objectId, false);
          return;
        }
        this.highlightObject(objectId, flashCount % 2 === 0);
        flashCount++;
      }, duration / (maxFlashes * 2));
    }
  }
}
