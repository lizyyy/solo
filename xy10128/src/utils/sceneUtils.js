import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function createScene(container) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf0f0f0);

  const camera = new THREE.PerspectiveCamera(
    60,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
  );
  camera.position.set(8, 8, 12);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 3;
  controls.maxDistance = 30;

  return { scene, camera, renderer, controls };
}

export function addLights(scene) {
  const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(10, 20, 10);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  directionalLight.shadow.camera.near = 0.5;
  directionalLight.shadow.camera.far = 50;
  directionalLight.shadow.camera.left = -20;
  directionalLight.shadow.camera.right = 20;
  directionalLight.shadow.camera.top = 20;
  directionalLight.shadow.camera.bottom = -20;
  scene.add(directionalLight);

  const fillLight = new THREE.DirectionalLight(0x8888ff, 0.3);
  fillLight.position.set(-10, 5, -10);
  scene.add(fillLight);

  return { ambientLight, directionalLight, fillLight };
}

export function createOperatingTable(centerX = 0, centerZ = 0) {
  const group = new THREE.Group();
  group.userData = { type: 'table', name: '手术台' };

  const tableGeometry = new THREE.BoxGeometry(8, 0.2, 3);
  const tableMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x4a5568, 
    metalness: 0.3,
    roughness: 0.7 
  });
  const tableTop = new THREE.Mesh(tableGeometry, tableMaterial);
  tableTop.position.y = 0.8;
  tableTop.receiveShadow = true;
  tableTop.castShadow = true;
  group.add(tableTop);

  for (let i = 0; i < 4; i++) {
    const legGeometry = new THREE.BoxGeometry(0.3, 0.8, 0.3);
    const legMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x2d3748, 
      metalness: 0.5,
      roughness: 0.5 
    });
    const leg = new THREE.Mesh(legGeometry, legMaterial);
    const x = i % 2 === 0 ? -3.5 : 3.5;
    const z = i < 2 ? -1.2 : 1.2;
    leg.position.set(x, 0.4, z);
    leg.castShadow = true;
    group.add(leg);
  }

  group.position.set(centerX, 0, centerZ);

  return group;
}

export function createInstrumentZone(centerX = 0, centerZ = 0) {
  const group = new THREE.Group();
  group.userData = { type: 'zone', name: '无菌区' };

  const zoneGeometry = new THREE.BoxGeometry(6, 0.05, 4);
  const zoneMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x38a169, 
    transparent: true, 
    opacity: 0.3,
    side: THREE.DoubleSide
  });
  const zonePlane = new THREE.Mesh(zoneGeometry, zoneMaterial);
  zonePlane.position.y = 0.91;
  zonePlane.receiveShadow = true;
  group.add(zonePlane);

  const borderMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x276749,
    metalness: 0.2,
    roughness: 0.8
  });

  const edgeHeight = 0.1;
  const edges = [
    { x: 0, z: 2, w: 6, d: 0.1 },
    { x: 0, z: -2, w: 6, d: 0.1 },
    { x: 3, z: 0, w: 0.1, d: 4 },
    { x: -3, z: 0, w: 0.1, d: 4 }
  ];

  edges.forEach(edge => {
    const edgeGeometry = new THREE.BoxGeometry(edge.w, edgeHeight, edge.d);
    const edgeMesh = new THREE.Mesh(edgeGeometry, borderMaterial);
    edgeMesh.position.set(edge.x, 0.91 + edgeHeight / 2, edge.z);
    edgeMesh.castShadow = true;
    edgeMesh.receiveShadow = true;
    group.add(edgeMesh);
  });

  group.position.set(centerX, 0, centerZ);

  return group;
}

export function createPathwayVisualizer(pathwayConfig) {
  const group = new THREE.Group();
  group.userData = { type: 'pathway', name: '取用路径' };

  const pathWidth = 1.5;
  const color = 0x4299e1;

  const pathGeometry = new THREE.PlaneGeometry(pathwayConfig.length || 8, pathWidth);
  const pathMaterial = new THREE.MeshStandardMaterial({ 
    color: color, 
    transparent: true, 
    opacity: 0.2,
    side: THREE.DoubleSide
  });
  
  const path = new THREE.Mesh(pathGeometry, pathMaterial);
  path.rotation.x = -Math.PI / 2;
  path.position.set(
    pathwayConfig.x || 0,
    0.01,
    pathwayConfig.z || -4
  );
  path.receiveShadow = true;
  group.add(path);

  const arrowCount = Math.floor((pathwayConfig.length || 8) / 2);
  for (let i = 0; i < arrowCount; i++) {
    const arrowGeometry = new THREE.ConeGeometry(0.15, 0.3, 4);
    const arrowMaterial = new THREE.MeshStandardMaterial({ 
      color: color,
      transparent: true,
      opacity: 0.5
    });
    const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
    arrow.rotation.x = Math.PI / 2;
    arrow.position.set(
      pathwayConfig.x || 0,
      0.05,
      (pathwayConfig.z || -4) - (i * 2) + ((pathwayConfig.length || 8) / 2 - 1)
    );
    arrow.castShadow = true;
    group.add(arrow);
  }

  return group;
}
