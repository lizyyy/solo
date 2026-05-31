import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let scene, camera, renderer, controls;
let pointMeshes = [];
let towerGroup;
let raycaster, mouse;
let selectedPointId = null;
let onPointClick = null;
let animationId = null;

const SCALE = 0.01;

function getPointColor(flags) {
  if (!flags || flags.length === 0) return 0x8b929e;
  if (flags.includes('ok')) return 0x34c759;
  if (flags.includes('overlap')) return 0xff453a;
  if (flags.includes('no-model')) return 0xff453a;
  if (flags.includes('duplicate-photo')) return 0xff9f0a;
  if (flags.includes('no-inspection')) return 0xff9f0a;
  if (flags.includes('boundary')) return 0x4a9eff;
  return 0x8b929e;
}

export function initScene(canvas, clickCallback) {
  onPointClick = clickCallback;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d1117);
  scene.fog = new THREE.Fog(0x0d1117, 800, 2000);

  const rect = canvas.parentElement.getBoundingClientRect();
  camera = new THREE.PerspectiveCamera(50, rect.width / rect.height, 0.1, 5000);
  camera.position.set(15, 12, 15);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(rect.width, rect.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.maxPolarAngle = Math.PI / 2.1;
  controls.minDistance = 3;
  controls.maxDistance = 200;

  const ambientLight = new THREE.AmbientLight(0x6688cc, 0.5);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffeedd, 1.0);
  dirLight.position.set(50, 80, 30);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 500;
  dirLight.shadow.camera.left = -100;
  dirLight.shadow.camera.right = 100;
  dirLight.shadow.camera.top = 100;
  dirLight.shadow.camera.bottom = -100;
  scene.add(dirLight);

  const hemiLight = new THREE.HemisphereLight(0x88aacc, 0x223322, 0.3);
  scene.add(hemiLight);

  const groundGeo = new THREE.PlaneGeometry(400, 400);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x1a2f1a,
    roughness: 0.9,
    metalness: 0.1
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const gridHelper = new THREE.GridHelper(400, 80, 0x2a3f2a, 0x1e2e1e);
  scene.add(gridHelper);

  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  canvas.addEventListener('click', onCanvasClick);
  window.addEventListener('resize', onResize);

  animate();
}

function onResize() {
  if (!renderer || !camera) return;
  const rect = renderer.domElement.parentElement.getBoundingClientRect();
  camera.aspect = rect.width / rect.height;
  camera.updateProjectionMatrix();
  renderer.setSize(rect.width, rect.height);
}

function onCanvasClick(event) {
  if (!raycaster) return;
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(pointMeshes);
  if (intersects.length > 0) {
    const mesh = intersects[0].object;
    if (mesh.userData && mesh.userData.pointId) {
      selectPoint(mesh.userData.pointId);
      if (onPointClick) onPointClick(mesh.userData.pointId);
    }
  }
}

function selectPoint(pointId) {
  selectedPointId = pointId;
  for (const mesh of pointMeshes) {
    const isSelected = mesh.userData.pointId === pointId;
    if (isSelected) {
      mesh.scale.set(1.5, 1.5, 1.5);
    } else {
      mesh.scale.set(1, 1, 1);
    }
  }
}

export function setSelectedPoint(pointId) {
  selectPoint(pointId);
  if (pointId) {
    const mesh = pointMeshes.find(m => m.userData.pointId === pointId);
    if (mesh) {
      const target = mesh.position.clone();
      const offset = new THREE.Vector3(8, 6, 8);
      camera.position.lerp(target.clone().add(offset), 0.3);
      controls.target.lerp(target, 0.3);
    }
  }
}

function createTower(x, z, hubHeight, rotorDiameter, color) {
  const group = new THREE.Group();

  const baseRadius = Math.max(0.3, 0.3);
  const topRadius = Math.max(0.2, 0.2);
  const height = Math.max(0.5, (hubHeight || 80) * SCALE);
  const towerGeo = new THREE.CylinderGeometry(topRadius, baseRadius, height, 12);
  const towerMat = new THREE.MeshStandardMaterial({
    color: 0xcccccc,
    roughness: 0.4,
    metalness: 0.6
  });
  const tower = new THREE.Mesh(towerGeo, towerMat);
  tower.position.y = height / 2;
  tower.castShadow = true;
  group.add(tower);

  const nacelleGeo = new THREE.BoxGeometry(1.2, 0.6, 0.6);
  const nacelleMat = new THREE.MeshStandardMaterial({
    color: 0xeeeeee,
    roughness: 0.3,
    metalness: 0.7
  });
  const nacelle = new THREE.Mesh(nacelleGeo, nacelleMat);
  nacelle.position.y = height + 0.3;
  nacelle.castShadow = true;
  group.add(nacelle);

  const bladeLen = Math.max(1, ((rotorDiameter || 90) / 2) * SCALE);
  const bladeGeo = new THREE.BoxGeometry(bladeLen * 2, 0.05, 0.15);
  const bladeMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.5,
    metalness: 0.3
  });
  const blade = new THREE.Mesh(bladeGeo, bladeMat);
  blade.position.y = height + 0.6;
  blade.userData.isBlade = true;
  group.add(blade);

  const blade2 = blade.clone();
  blade2.rotation.y = Math.PI / 3;
  blade2.userData.isBlade = true;
  group.add(blade2);

  const blade3 = blade.clone();
  blade3.rotation.y = -Math.PI / 3;
  blade3.userData.isBlade = true;
  group.add(blade3);

  group.position.set(x * SCALE, 0, z * SCALE);

  return group;
}

function createPointMarker(x, z, color, pointId) {
  const sx = x * SCALE;
  const sz = z * SCALE;

  const markerGeo = new THREE.SphereGeometry(0.4, 16, 16);
  const markerMat = new THREE.MeshStandardMaterial({
    color: color,
    emissive: color,
    emissiveIntensity: 0.3,
    roughness: 0.3,
    metalness: 0.5
  });
  const marker = new THREE.Mesh(markerGeo, markerMat);
  marker.position.set(sx, 0.5, sz);
  marker.castShadow = true;
  marker.userData = { pointId };

  const ringGeo = new THREE.RingGeometry(0.6, 0.8, 32);
  const ringMat = new THREE.MeshBasicMaterial({
    color: color,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.5
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.set(sx, 0.05, sz);
  ring.rotation.x = -Math.PI / 2;
  marker.userData.ring = ring;

  return { marker, ring };
}

export function updateScene(points, models) {
  if (!scene) return;

  if (towerGroup) {
    scene.remove(towerGroup);
  }
  pointMeshes = [];
  towerGroup = new THREE.Group();

  const modelMap = new Map();
  for (const m of models) {
    modelMap.set(m.id, m);
  }

  const center = { x: 0, z: 0 };
  if (points.length > 0) {
    let sumX = 0, sumZ = 0;
    for (const p of points) {
      sumX += p.x;
      sumZ += p.z;
    }
    center.x = sumX / points.length;
    center.z = sumZ / points.length;
  }

  for (const point of points) {
    const color = getPointColor(point.flags);
    const model = point.linkedModelId ? modelMap.get(point.linkedModelId) : null;
    const hubHeight = model ? model.hubHeight : 80;
    const rotorDiameter = model ? model.rotorDiameter : 90;

    const tower = createTower(point.x - center.x, point.z - center.z, hubHeight, rotorDiameter, color);
    towerGroup.add(tower);

    const { marker, ring } = createPointMarker(point.x - center.x, point.z - center.z, color, point.id);
    towerGroup.add(marker);
    towerGroup.add(ring);
    pointMeshes.push(marker);
  }

  scene.add(towerGroup);

  if (points.length > 0) {
    const avgX = points.reduce((s, p) => s + p.x, 0) / points.length;
    const avgZ = points.reduce((s, p) => s + p.z, 0) / points.length;
    const maxDist = Math.max(
      ...points.map(p => Math.sqrt((p.x - avgX) ** 2 + (p.z - avgZ) ** 2))
    );
    const camDist = Math.max(15, (maxDist * SCALE) * 1.5 + 10);
    camera.position.set(camDist * 0.7, camDist * 0.5, camDist * 0.7);
    controls.target.set(0, 0, 0);
    controls.update();
  }
}

function animate() {
  animationId = requestAnimationFrame(animate);
  if (controls) controls.update();

  if (towerGroup) {
    towerGroup.traverse(child => {
      if (child.userData && child.userData.isBlade) {
        child.rotation.z += 0.005;
      }
    });
  }

  if (selectedPointId) {
    const time = Date.now() * 0.003;
    for (const mesh of pointMeshes) {
      if (mesh.userData.pointId === selectedPointId && mesh.userData.ring) {
        mesh.userData.ring.material.opacity = 0.3 + 0.3 * Math.sin(time);
      }
    }
  }

  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}

export function disposeScene() {
  if (animationId) cancelAnimationFrame(animationId);
  window.removeEventListener('resize', onResize);
  if (renderer) renderer.dispose();
  pointMeshes = [];
  towerGroup = null;
  scene = null;
  camera = null;
}
