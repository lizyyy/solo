import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { COLORS, GALLERY_DIMENSIONS, VIEW_MODES } from '../utils/constants.js';

export class SceneManager {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.animationId = null;
    this.objects = {
      gallery: null,
      artworks: new Map(),
      paths: new Map(),
      heatmap: null,
      visitors: new Map(),
      labels: new Map(),
      grid: null
    };
    this.viewMode = VIEW_MODES.PERSPECTIVE;
    this.onAnimationFrame = null;
    this.clock = new THREE.Clock();
    
    this.cameraPositions = {
      [VIEW_MODES.PERSPECTIVE]: { pos: new THREE.Vector3(50, 40, 50), target: new THREE.Vector3(0, 0, 0) },
      [VIEW_MODES.TOP]: { pos: new THREE.Vector3(0, 80, 0.1), target: new THREE.Vector3(0, 0, 0) },
      [VIEW_MODES.FRONT]: { pos: new THREE.Vector3(0, 15, 60), target: new THREE.Vector3(0, 0, 0) },
      [VIEW_MODES.SIDE]: { pos: new THREE.Vector3(60, 15, 0), target: new THREE.Vector3(0, 0, 0) }
    };
    
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.hoveredObject = null;
    this.onObjectHover = null;
    this.onObjectClick = null;
  }

  init() {
    this.createScene();
    this.createCamera();
    this.createRenderer();
    this.createControls();
    this.setViewMode(VIEW_MODES.PERSPECTIVE);
    this.createLighting();
    this.createGallery();
    this.setupEventListeners();
    this.animate();
  }

  createScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0f0f1a);
    this.scene.fog = new THREE.Fog(0x0f0f1a, 80, 150);
  }

  createCamera() {
    const { clientWidth, clientHeight } = this.container;
    this.camera = new THREE.PerspectiveCamera(
      60,
      clientWidth / clientHeight,
      0.1,
      1000
    );
  }

  createRenderer() {
    const { clientWidth, clientHeight } = this.container;
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true
    });
    this.renderer.setSize(clientWidth, clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.container.appendChild(this.renderer.domElement);
  }

  createControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 150;
    this.controls.maxPolarAngle = Math.PI / 2.1;
    this.controls.target.set(0, 0, 0);
  }

  createLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
    mainLight.position.set(30, 50, 30);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 200;
    mainLight.shadow.camera.left = -60;
    mainLight.shadow.camera.right = 60;
    mainLight.shadow.camera.top = 60;
    mainLight.shadow.camera.bottom = -60;
    this.scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0x8888ff, 0.3);
    fillLight.position.set(-30, 20, -30);
    this.scene.add(fillLight);

    const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x2a2a3e, 0.3);
    this.scene.add(hemisphereLight);
  }

  createGallery() {
    const galleryGroup = new THREE.Group();
    galleryGroup.name = 'gallery';

    const { width, height, depth, wallThickness, floorCount } = GALLERY_DIMENSIONS;

    for (let floor = 0; floor < floorCount; floor++) {
      const floorY = floor * height;

      const floorGeometry = new THREE.PlaneGeometry(width, depth);
      const floorMaterial = new THREE.MeshStandardMaterial({
        color: COLORS.floor,
        roughness: 0.8,
        metalness: 0.1
      });
      const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
      floorMesh.rotation.x = -Math.PI / 2;
      floorMesh.position.y = floorY;
      floorMesh.receiveShadow = true;
      floorMesh.userData.floor = floor + 1;
      floorMesh.name = `floor_${floor + 1}`;
      galleryGroup.add(floorMesh);

      const gridHelper = new THREE.GridHelper(Math.max(width, depth), Math.max(width, depth) / 2, 0x444466, 0x333355);
      gridHelper.position.y = floorY + 0.01;
      gridHelper.userData.floor = floor + 1;
      gridHelper.name = `grid_${floor + 1}`;
      galleryGroup.add(gridHelper);
      this.objects.grid = gridHelper;

      const wallMaterial = new THREE.MeshStandardMaterial({
        color: COLORS.wall,
        roughness: 0.9,
        metalness: 0.1
      });

      const backWall = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, wallThickness),
        wallMaterial
      );
      backWall.position.set(0, floorY + height / 2, -depth / 2);
      backWall.castShadow = true;
      backWall.receiveShadow = true;
      backWall.userData.floor = floor + 1;
      galleryGroup.add(backWall);

      const frontWallLeft = new THREE.Mesh(
        new THREE.BoxGeometry(width / 3, height, wallThickness),
        wallMaterial
      );
      frontWallLeft.position.set(-width / 3, floorY + height / 2, depth / 2);
      frontWallLeft.castShadow = true;
      frontWallLeft.receiveShadow = true;
      frontWallLeft.userData.floor = floor + 1;
      galleryGroup.add(frontWallLeft);

      const frontWallRight = new THREE.Mesh(
        new THREE.BoxGeometry(width / 3, height, wallThickness),
        wallMaterial
      );
      frontWallRight.position.set(width / 3, floorY + height / 2, depth / 2);
      frontWallRight.castShadow = true;
      frontWallRight.receiveShadow = true;
      frontWallRight.userData.floor = floor + 1;
      galleryGroup.add(frontWallRight);

      const leftWall = new THREE.Mesh(
        new THREE.BoxGeometry(wallThickness, height, depth),
        wallMaterial
      );
      leftWall.position.set(-width / 2, floorY + height / 2, 0);
      leftWall.castShadow = true;
      leftWall.receiveShadow = true;
      leftWall.userData.floor = floor + 1;
      galleryGroup.add(leftWall);

      const rightWall = new THREE.Mesh(
        new THREE.BoxGeometry(wallThickness, height, depth),
        wallMaterial
      );
      rightWall.position.set(width / 2, floorY + height / 2, 0);
      rightWall.castShadow = true;
      rightWall.receiveShadow = true;
      rightWall.userData.floor = floor + 1;
      galleryGroup.add(rightWall);

      const entranceMarker = this.createEntranceMarker(floorY);
      galleryGroup.add(entranceMarker);
    }

    this.objects.gallery = galleryGroup;
    this.scene.add(galleryGroup);
  }

  createEntranceMarker(floorY) {
    const group = new THREE.Group();
    
    const arrowGeometry = new THREE.ConeGeometry(1, 2, 4);
    const arrowMaterial = new THREE.MeshStandardMaterial({
      color: COLORS.accent,
      emissive: COLORS.accent,
      emissiveIntensity: 0.3
    });
    const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
    arrow.rotation.x = Math.PI / 2;
    arrow.position.y = floorY + 1;
    arrow.position.z = GALLERY_DIMENSIONS.depth / 2 + 2;
    group.add(arrow);

    const ringGeometry = new THREE.RingGeometry(1.5, 2, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: COLORS.accent,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = floorY + 0.02;
    ring.position.z = GALLERY_DIMENSIONS.depth / 2 + 2;
    group.add(ring);

    group.userData.isEntrance = true;
    return group;
  }

  setupEventListeners() {
    this.renderer.domElement.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.renderer.domElement.addEventListener('click', (e) => this.onMouseClick(e));
  }

  onMouseMove(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    const interactiveObjects = [];
    this.objects.artworks.forEach(artwork => interactiveObjects.push(artwork.mesh));
    
    const intersects = this.raycaster.intersectObjects(interactiveObjects);

    if (intersects.length > 0) {
      const object = intersects[0].object;
      if (this.hoveredObject !== object) {
        if (this.hoveredObject) {
          this.restoreObjectMaterial(this.hoveredObject);
        }
        this.hoveredObject = object;
        this.highlightObject(object);
        if (this.onObjectHover && object.userData.artworkData) {
          this.onObjectHover(object.userData.artworkData);
        }
      }
    } else if (this.hoveredObject) {
      this.restoreObjectMaterial(this.hoveredObject);
      this.hoveredObject = null;
      if (this.onObjectHover) {
        this.onObjectHover(null);
      }
    }
  }

  onMouseClick(event) {
    if (!this.hoveredObject) return;
    
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const interactiveObjects = [];
    this.objects.artworks.forEach(artwork => interactiveObjects.push(artwork.mesh));
    
    const intersects = this.raycaster.intersectObjects(interactiveObjects);

    if (intersects.length > 0 && this.onObjectClick) {
      this.onObjectClick(intersects[0].object.userData.artworkData);
    }
  }

  highlightObject(object) {
    object.material.emissive = new THREE.Color(COLORS.accent);
    object.material.emissiveIntensity = 0.3;
    document.body.style.cursor = 'pointer';
  }

  restoreObjectMaterial(object) {
    object.material.emissive = new THREE.Color(0x000000);
    object.material.emissiveIntensity = 0;
    document.body.style.cursor = 'default';
  }

  setViewMode(mode) {
    this.viewMode = mode;
    const camConfig = this.cameraPositions[mode];
    
    if (camConfig) {
      if (mode === VIEW_MODES.ORBIT) {
        this.controls.enabled = true;
        return;
      }
      
      this.camera.position.copy(camConfig.pos);
      this.controls.target.copy(camConfig.target);
      this.controls.update();
      
      if (mode === VIEW_MODES.TOP) {
        this.controls.enabled = false;
      } else {
        this.controls.enabled = true;
      }
    }
  }

  setFloorVisibility(floor, visible) {
    if (this.objects.gallery) {
      this.objects.gallery.traverse((child) => {
        if (child.userData.floor !== undefined && child.userData.floor !== null) {
          if (child.userData.floor === floor || child.userData.floor < floor) {
            child.visible = visible;
          }
        }
      });
    }

    this.objects.artworks.forEach((artwork) => {
      if (artwork.data.floor === floor) {
        artwork.mesh.visible = visible;
        artwork.label.visible = visible;
      }
    });
  }

  setFloorOpacity(floor, opacity) {
    this.objects.gallery.traverse((child) => {
      if (child.userData.floor !== undefined && child.userData.floor !== null) {
        if (child.userData.floor > floor && child.material) {
          child.material.transparent = true;
          child.material.opacity = opacity;
        }
      }
    });
  }

  addArtwork(artworkData) {
    const group = new THREE.Group();
    
    const frameGeometry = new THREE.BoxGeometry(
      artworkData.width || 3,
      artworkData.height || 2,
      0.2
    );
    const frameMaterial = new THREE.MeshStandardMaterial({
      color: 0x8b4513,
      roughness: 0.7,
      metalness: 0.3
    });
    const frame = new THREE.Mesh(frameGeometry, frameMaterial);
    frame.castShadow = true;
    frame.receiveShadow = true;

    const canvasGeometry = new THREE.PlaneGeometry(
      (artworkData.width || 3) - 0.3,
      (artworkData.height || 2) - 0.3
    );
    
    const canvasColor = artworkData.color || COLORS.artwork;
    const canvasMaterial = new THREE.MeshStandardMaterial({
      color: canvasColor,
      roughness: 0.9,
      metalness: 0.1,
      emissive: canvasColor,
      emissiveIntensity: 0.1
    });
    const canvas = new THREE.Mesh(canvasGeometry, canvasMaterial);
    canvas.position.z = 0.11;
    frame.add(canvas);

    const baseMaterial = new THREE.MeshStandardMaterial({
      color: 0x000000,
      emissive: canvasColor,
      emissiveIntensity: 0.4
    });

    const { width, height, depth } = GALLERY_DIMENSIONS;
    const floorY = ((artworkData.floor || 1) - 1) * height;
    
    group.position.set(
      artworkData.x || 0,
      floorY + (artworkData.height || 2) / 2 + 1,
      artworkData.z || 0
    );
    group.rotation.y = artworkData.rotation || 0;

    frame.userData.artworkData = artworkData;
    canvas.userData.artworkData = artworkData;
    group.userData.artworkData = artworkData;

    const label = this.createLabel(artworkData.name, new THREE.Vector3(0, (artworkData.height || 2) / 2 + 0.5, 0));
    group.add(label);

    this.objects.artworks.set(artworkData.id, {
      mesh: canvas,
      frame: frame,
      data: artworkData,
      label: label,
      group: group
    });

    this.objects.gallery.add(group);
    
    return group;
  }

  createLabel(text, position) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 64;
    
    context.fillStyle = 'rgba(0, 0, 0, 0)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    context.font = 'bold 24px Arial';
    context.fillStyle = '#ffffff';
    context.textAlign = 'center';
    context.fillText(text, canvas.width / 2, canvas.height / 2 + 8);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      transparent: true
    });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.position.copy(position);
    sprite.scale.set(4, 1, 1);
    sprite.userData.isLabel = true;

    return sprite;
  }

  clearArtworks() {
    this.objects.artworks.forEach((artwork) => {
      this.objects.gallery.remove(artwork.group);
    });
    this.objects.artworks.clear();
  }

  addVisitorPath(visitorId, color = 0xff0000) {
    const geometry = new THREE.SphereGeometry(0.4, 16, 16);
    const material = new THREE.MeshStandardMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 0.5
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    this.scene.add(mesh);

    const trailGeometry = new THREE.BufferGeometry();
    const trailMaterial = new THREE.LineBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.6
    });
    const trail = new THREE.Line(trailGeometry, trailMaterial);
    this.scene.add(trail);

    this.objects.visitors.set(visitorId, {
      mesh: mesh,
      trail: trail,
      trailPoints: [],
      path: [],
      currentIndex: 0,
      color: color
    });

    return { mesh, trail };
  }

  updateVisitorPosition(visitorId, position, addToTrail = true) {
    const visitor = this.objects.visitors.get(visitorId);
    if (!visitor) return;

    visitor.mesh.position.copy(position);

    if (addToTrail) {
      visitor.trailPoints.push(position.clone());
      
      const positions = new Float32Array(visitor.trailPoints.length * 3);
      visitor.trailPoints.forEach((p, i) => {
        positions[i * 3] = p.x;
        positions[i * 3 + 1] = p.y;
        positions[i * 3 + 2] = p.z;
      });
      visitor.trail.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      visitor.trail.geometry.computeBoundingSphere();
    }
  }

  clearVisitors() {
    this.objects.visitors.forEach((visitor) => {
      this.scene.remove(visitor.mesh);
      this.scene.remove(visitor.trail);
    });
    this.objects.visitors.clear();
  }

  createHeatmap(data, floor = 1) {
    if (this.objects.heatmap) {
      this.scene.remove(this.objects.heatmap);
    }

    const { width, depth, height } = GALLERY_DIMENSIONS;
    const floorY = (floor - 1) * height;

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    gradient.addColorStop(0, 'rgba(255, 0, 0, 0.8)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 0, 0.4)');
    gradient.addColorStop(1, 'rgba(0, 255, 0, 0)');

    ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    ctx.fillRect(0, 0, 256, 256);

    const maxValue = Math.max(...data.map(d => d.value), 1);

    data.forEach(point => {
      const x = ((point.x + width / 2) / width) * 256;
      const y = ((point.z + depth / 2) / depth) * 256;
      const normalizedValue = point.value / maxValue;
      const radius = 10 + normalizedValue * 40;

      const radialGradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      radialGradient.addColorStop(0, `rgba(255, ${Math.floor(255 * (1 - normalizedValue))}, 0, ${0.6 * normalizedValue})`);
      radialGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = radialGradient;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    });

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.7,
      depthWrite: false
    });

    const geometry = new THREE.PlaneGeometry(width, depth);
    const heatmapMesh = new THREE.Mesh(geometry, material);
    heatmapMesh.rotation.x = -Math.PI / 2;
    heatmapMesh.position.y = floorY + 0.05;
    heatmapMesh.userData.floor = floor;

    this.objects.heatmap = heatmapMesh;
    this.scene.add(heatmapMesh);

    return heatmapMesh;
  }

  clearHeatmap() {
    if (this.objects.heatmap) {
      this.scene.remove(this.objects.heatmap);
      this.objects.heatmap = null;
    }
  }

  setLabelsVisible(visible) {
    this.objects.artworks.forEach((artwork) => {
      artwork.label.visible = visible;
    });
  }

  setGridVisible(visible) {
    this.objects.grid.visible = visible;
  }

  resize() {
    const { clientWidth, clientHeight } = this.container;
    this.camera.aspect = clientWidth / clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(clientWidth, clientHeight);
  }

  animate() {
    this.animationId = requestAnimationFrame(() => this.animate());

    const delta = this.clock.getDelta();

    this.controls.update();

    if (this.onAnimationFrame) {
      this.onAnimationFrame(delta);
    }

    this.objects.visitors.forEach((visitor) => {
      visitor.mesh.rotation.y += delta * 2;
    });

    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }

    this.renderer.dispose();
    this.objects.controls.dispose();
  }
}
