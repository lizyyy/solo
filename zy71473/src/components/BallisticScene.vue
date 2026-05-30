<template>
  <div ref="containerRef" class="scene-container"></div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import * as THREE from 'three';

const props = defineProps({
  trajectoryPoints: { type: Array, default: () => [] },
  impactPoint: { type: Object, default: () => ({ x: 0, y: 0, z: 0 }) },
  windSpeed: { type: Number, default: 0 },
  windAngle: { type: Number, default: 0 },
  distance: { type: Number, default: 500 }
});

const containerRef = ref(null);
let scene, camera, renderer, animationId;
let trajectoryLine, impactMarker, windArrow;
let targetRing, groundPlane;

function initScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a0f);
  scene.fog = new THREE.Fog(0x0a0a0f, 500, 2000);

  camera = new THREE.PerspectiveCamera(60, containerRef.value.clientWidth / containerRef.value.clientHeight, 0.1, 5000);
  camera.position.set(-200, 150, 200);
  camera.lookAt(250, 0, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(containerRef.value.clientWidth, containerRef.value.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  containerRef.value.appendChild(renderer.domElement);

  const ambientLight = new THREE.AmbientLight(0x404050, 0.6);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1);
  dirLight.position.set(100, 200, 100);
  dirLight.castShadow = true;
  scene.add(dirLight);

  createGround();
  createGrid();
  createTarget();
  createShooter();
  createTrajectoryLine();
  createImpactMarker();
  createWindIndicator();

  window.addEventListener('resize', onResize);
  animate();
}

function createGround() {
  const groundGeo = new THREE.PlaneGeometry(3000, 1000);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a2e,
    roughness: 0.9,
    metalness: 0.1
  });
  groundPlane = new THREE.Mesh(groundGeo, groundMat);
  groundPlane.rotation.x = -Math.PI / 2;
  groundPlane.position.y = -0.1;
  groundPlane.receiveShadow = true;
  scene.add(groundPlane);
}

function createGrid() {
  const gridHelper = new THREE.GridHelper(2000, 50, 0x2a2a4e, 0x1a1a3e);
  scene.add(gridHelper);

  const axesHelper = new THREE.AxesHelper(100);
  axesHelper.position.set(0, 0.1, 0);
  scene.add(axesHelper);
}

function createTarget() {
  const targetGroup = new THREE.Group();

  for (let i = 0; i < 5; i++) {
    const radius = (5 - i) * 0.15;
    const ringGeo = new THREE.RingGeometry(radius - 0.015, radius, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: i % 2 === 0 ? 0xff3333 : 0xffffff,
      side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.y = -Math.PI / 2;
    targetGroup.add(ring);
  }

  const poleGeo = new THREE.CylinderGeometry(0.02, 0.02, 3, 8);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x666666 });
  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.position.set(0, 1.5, 0);
  targetGroup.add(pole);

  targetGroup.position.set(props.distance, 0, 0);
  targetRing = targetGroup;
  scene.add(targetGroup);
}

function createShooter() {
  const shooterGroup = new THREE.Group();

  const baseGeo = new THREE.BoxGeometry(0.5, 1.5, 0.3);
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x4a5568 });
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.position.y = 0.75;
  shooterGroup.add(base);

  const barrelGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.5, 16);
  const barrelMat = new THREE.MeshStandardMaterial({ color: 0x2d3748 });
  const barrel = new THREE.Mesh(barrelGeo, barrelMat);
  barrel.rotation.z = -Math.PI / 2;
  barrel.position.set(0.75, 1.5, 0);
  shooterGroup.add(barrel);

  shooterGroup.position.set(0, 0, 0);
  scene.add(shooterGroup);
}

function createTrajectoryLine() {
  const geometry = new THREE.BufferGeometry();
  const material = new THREE.LineBasicMaterial({
    color: 0x00ff88,
    linewidth: 2,
    transparent: true,
    opacity: 0.9
  });
  trajectoryLine = new THREE.Line(geometry, material);
  scene.add(trajectoryLine);
}

function createImpactMarker() {
  const markerGeo = new THREE.SphereGeometry(0.08, 16, 16);
  const markerMat = new THREE.MeshBasicMaterial({ color: 0xff6600 });
  impactMarker = new THREE.Mesh(markerGeo, markerMat);
  scene.add(impactMarker);
}

function createWindIndicator() {
  const dir = new THREE.Vector3(0, 0, 1);
  const origin = new THREE.Vector3(100, 50, 0);
  const length = 30;
  const hex = 0x00aaff;

  windArrow = new THREE.ArrowHelper(dir, origin, length, hex, 10, 5);
  scene.add(windArrow);
}

function updateTrajectory() {
  if (!trajectoryLine || props.trajectoryPoints.length < 2) return;

  const positions = new Float32Array(props.trajectoryPoints.length * 3);

  props.trajectoryPoints.forEach((p, i) => {
    positions[i * 3] = p.x;
    positions[i * 3 + 1] = p.y;
    positions[i * 3 + 2] = p.z;
  });

  trajectoryLine.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  trajectoryLine.geometry.attributes.position.needsUpdate = true;
  trajectoryLine.geometry.computeBoundingSphere();
}

function updateImpactMarker() {
  if (!impactMarker) return;
  impactMarker.position.set(props.impactPoint.x, props.impactPoint.y || 0, props.impactPoint.z);
}

function updateTargetPosition() {
  if (targetRing) {
    targetRing.position.set(props.distance, 0, 0);
  }
}

function updateWindIndicator() {
  if (!windArrow) return;

  const windRad = (props.windAngle * Math.PI) / 180;
  const dir = new THREE.Vector3(
    Math.cos(windRad),
    0,
    Math.sin(windRad)
  ).normalize();

  const length = Math.max(10, props.windSpeed * 5);
  const hex = props.windSpeed > 10 ? 0xff4444 : 0x00aaff;

  windArrow.setDirection(dir);
  windArrow.setLength(length, length * 0.3, length * 0.2);
  windArrow.setColor(new THREE.Color(hex));
}

function animate() {
  animationId = requestAnimationFrame(animate);

  const time = Date.now() * 0.0005;
  camera.position.x = -200 + Math.sin(time) * 50;
  camera.position.z = 200 + Math.cos(time) * 50;
  camera.lookAt(props.distance * 0.4, 50, 0);

  if (impactMarker) {
    impactMarker.material.color.setHSL((Date.now() * 0.001) % 1, 1, 0.5);
  }

  renderer.render(scene, camera);
}

function onResize() {
  if (!containerRef.value) return;
  camera.aspect = containerRef.value.clientWidth / containerRef.value.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(containerRef.value.clientWidth, containerRef.value.clientHeight);
}

onMounted(() => {
  initScene();
});

onUnmounted(() => {
  cancelAnimationFrame(animationId);
  window.removeEventListener('resize', onResize);
  if (renderer) {
    renderer.dispose();
    if (containerRef.value && renderer.domElement) {
      containerRef.value.removeChild(renderer.domElement);
    }
  }
});

watch(() => props.trajectoryPoints, updateTrajectory, { deep: true });
watch(() => props.impactPoint, updateImpactMarker, { deep: true });
watch(() => props.distance, updateTargetPosition);
watch(() => [props.windSpeed, props.windAngle], updateWindIndicator);
</script>

<style scoped>
.scene-container {
  width: 100%;
  height: 100%;
  position: relative;
}
</style>
