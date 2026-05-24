import { useRef, useEffect, useCallback, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useSceneStore } from '../store/useSceneStore';
import { useTimeStore } from '../store/useTimeStore';
import { calculateSolarPosition, isSunVisible } from '../utils/solarMath';
import { createSceneOccluders, calculateComponentShadowRate } from '../utils/shadowUtils';
import { CameraState, ViewPreset } from '../types';

interface UseThreeSceneReturn {
  containerRef: React.RefObject<HTMLDivElement>;
  captureScreenshot: () => string | null;
  setViewPreset: (preset: ViewPreset) => void;
}

const viewPresets: Record<ViewPreset, CameraState> = {
  overview: {
    position: { x: 25, y: 25, z: 25 },
    target: { x: 0, y: 10, z: 0 },
  },
  top: {
    position: { x: 0, y: 50, z: 0.1 },
    target: { x: 0, y: 10, z: 0 },
  },
  front: {
    position: { x: 0, y: 15, z: 40 },
    target: { x: 0, y: 10, z: 0 },
  },
  side: {
    position: { x: 40, y: 15, z: 0 },
    target: { x: 0, y: 10, z: 0 },
  },
  birdseye: {
    position: { x: 35, y: 40, z: 35 },
    target: { x: 0, y: 10, z: 0 },
  },
};

export function useThreeScene(): UseThreeSceneReturn {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);
  const sunMeshRef = useRef<THREE.Mesh | null>(null);
  const animationIdRef = useRef<number | null>(null);
  const componentMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const treeMeshesRef = useRef<Map<string, THREE.Group>>(new Map());
  const roofGroupRef = useRef<THREE.Group | null>(null);
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const occludersRef = useRef<THREE.Object3D[]>([]);
  const lastShadowCalcRef = useRef<number>(0);

  const [captureFn, setCaptureFn] = useState<(() => string | null) | null>(null);
  const [viewPresetFn, setViewPresetFn] = useState<((preset: ViewPreset) => void) | null>(null);

  const createRoof = useCallback((scene: THREE.Scene, roofData: any) => {
    if (roofGroupRef.current) {
      scene.remove(roofGroupRef.current);
      roofGroupRef.current = null;
    }

    const group = new THREE.Group();

    const roofGeometry = new THREE.BoxGeometry(roofData.width, 0.3, roofData.depth);
    const roofMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a5568,
      roughness: 0.8,
      metalness: 0.2,
    });
    const roofMesh = new THREE.Mesh(roofGeometry, roofMaterial);
    roofMesh.position.set(0, roofData.height, 0);
    roofMesh.receiveShadow = true;
    roofMesh.castShadow = true;
    group.add(roofMesh);

    const parapetMaterial = new THREE.MeshStandardMaterial({
      color: 0x718096,
      roughness: 0.9,
    });

    const parapetHeight = roofData.parapetHeight;
    const parapetThickness = 0.3;

    const frontParapet = new THREE.Mesh(
      new THREE.BoxGeometry(roofData.width + parapetThickness * 2, parapetHeight, parapetThickness),
      parapetMaterial
    );
    frontParapet.position.set(0, roofData.height + parapetHeight / 2, -roofData.depth / 2);
    frontParapet.castShadow = true;
    frontParapet.receiveShadow = true;
    group.add(frontParapet);

    const backParapet = new THREE.Mesh(
      new THREE.BoxGeometry(roofData.width + parapetThickness * 2, parapetHeight, parapetThickness),
      parapetMaterial
    );
    backParapet.position.set(0, roofData.height + parapetHeight / 2, roofData.depth / 2);
    backParapet.castShadow = true;
    backParapet.receiveShadow = true;
    group.add(backParapet);

    const leftParapet = new THREE.Mesh(
      new THREE.BoxGeometry(parapetThickness, parapetHeight, roofData.depth),
      parapetMaterial
    );
    leftParapet.position.set(-roofData.width / 2, roofData.height + parapetHeight / 2, 0);
    leftParapet.castShadow = true;
    leftParapet.receiveShadow = true;
    group.add(leftParapet);

    const rightParapet = new THREE.Mesh(
      new THREE.BoxGeometry(parapetThickness, parapetHeight, roofData.depth),
      parapetMaterial
    );
    rightParapet.position.set(roofData.width / 2, roofData.height + parapetHeight / 2, 0);
    rightParapet.castShadow = true;
    rightParapet.receiveShadow = true;
    group.add(rightParapet);

    const buildingGeometry = new THREE.BoxGeometry(roofData.width, roofData.height, roofData.depth);
    const buildingMaterial = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.9,
    });
    const buildingMesh = new THREE.Mesh(buildingGeometry, buildingMaterial);
    buildingMesh.position.set(0, roofData.height / 2, 0);
    buildingMesh.receiveShadow = true;
    buildingMesh.castShadow = true;
    group.add(buildingMesh);

    scene.add(group);
    roofGroupRef.current = group;
  }, []);

  const createTree = useCallback((treeData: any): THREE.Group => {
    const group = new THREE.Group();

    const trunkGeometry = new THREE.CylinderGeometry(0.3, 0.5, treeData.height * 0.4, 8);
    const trunkMaterial = new THREE.MeshStandardMaterial({
      color: 0x8b4513,
      roughness: 0.9,
    });
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.y = treeData.height * 0.2;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    group.add(trunk);

    const foliageRadius = treeData.radius;
    const foliageHeight = treeData.height * 0.7;
    const foliageGeometry = new THREE.ConeGeometry(foliageRadius, foliageHeight, 8);
    const foliageMaterial = new THREE.MeshStandardMaterial({
      color: 0x228b22,
      roughness: 0.8,
    });
    const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
    foliage.position.y = treeData.height * 0.4 + foliageHeight / 2;
    foliage.castShadow = true;
    foliage.receiveShadow = true;
    group.add(foliage);

    const foliage2 = new THREE.Mesh(
      new THREE.ConeGeometry(foliageRadius * 0.8, foliageHeight * 0.7, 8),
      foliageMaterial
    );
    foliage2.position.y = treeData.height * 0.5 + foliageHeight * 0.6;
    foliage2.castShadow = true;
    group.add(foliage2);

    group.position.set(treeData.position.x, 0, treeData.position.z);

    return group;
  }, []);

  const createComponent = useCallback((comp: any, isSelected: boolean, isFiltered: boolean): THREE.Mesh => {
    const geometry = new THREE.BoxGeometry(comp.size.width, 0.05, comp.size.height);
    const material = new THREE.MeshStandardMaterial({
      color: isSelected ? 0xf97316 : isFiltered ? 0x0f766e : 0x64748b,
      roughness: 0.3,
      metalness: 0.7,
      emissive: isSelected ? 0xf97316 : 0x000000,
      emissiveIntensity: isSelected ? 0.2 : 0,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(comp.position.x, comp.position.y, comp.position.z);
    mesh.rotation.x = -comp.rotation * (Math.PI / 180);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.userData = { componentId: comp.id };
    return mesh;
  }, []);

  const captureScreenshot = useCallback((): string | null => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) {
      return null;
    }
    rendererRef.current.render(sceneRef.current, cameraRef.current);
    return rendererRef.current.domElement.toDataURL('image/png');
  }, []);

  const setViewPreset = useCallback((preset: ViewPreset) => {
    const cameraState = viewPresets[preset];
    if (!cameraState || !cameraRef.current || !controlsRef.current) return;

    cameraRef.current.position.set(
      cameraState.position.x,
      cameraState.position.y,
      cameraState.position.z
    );
    controlsRef.current.target.set(
      cameraState.target.x,
      cameraState.target.y,
      cameraState.target.z
    );
    controlsRef.current.update();
    useSceneStore.getState().setViewPreset(preset);
  }, []);

  useEffect(() => {
    setCaptureFn(() => captureScreenshot);
    setViewPresetFn(() => setViewPreset);
  }, [captureScreenshot, setViewPreset]);

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      60,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(25, 25, 25);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 10;
    controls.maxDistance = 100;
    controls.maxPolarAngle = Math.PI / 2.1;
    controls.target.set(0, 10, 0);
    controlsRef.current = controls;

    const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 1);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 500;
    sunLight.shadow.camera.left = -50;
    sunLight.shadow.camera.right = 50;
    sunLight.shadow.camera.top = 50;
    sunLight.shadow.camera.bottom = -50;
    sunLight.shadow.bias = -0.0001;
    scene.add(sunLight);
    sunLightRef.current = sunLight;

    const sunGeometry = new THREE.SphereGeometry(3, 32, 32);
    const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffdd00 });
    const sunMesh = new THREE.Mesh(sunGeometry, sunMaterial);
    scene.add(sunMesh);
    sunMeshRef.current = sunMesh;

    const groundGeometry = new THREE.PlaneGeometry(200, 200);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x2d3748,
      roughness: 0.9,
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const gridHelper = new THREE.GridHelper(100, 50, 0x4a5568, 0x2d3748);
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);

    const handleResize = () => {
      if (!containerRef.current || !camera || !renderer) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    let lastTime = 0;
    const animate = (time: number) => {
      animationIdRef.current = requestAnimationFrame(animate);

      const timeState = useTimeStore.getState();
      const sceneState = useSceneStore.getState();

      if (timeState.isPlaying) {
        const delta = (time - lastTime) / 1000;
        lastTime = time;

        const newHour = timeState.hour + delta * timeState.playSpeed * 2;
        if (newHour >= 18) {
          useTimeStore.getState().setHour(6);
        } else if (newHour < 6) {
          useTimeStore.getState().setHour(6);
        } else {
          useTimeStore.getState().setHour(newHour);
        }
      } else {
        lastTime = time;
      }

      const currentTimeState = useTimeStore.getState();
      const solarPos = calculateSolarPosition(
        currentTimeState.month,
        currentTimeState.day,
        currentTimeState.hour
      );

      if (sunLightRef.current && sunMeshRef.current) {
        sunLightRef.current.position.set(solarPos.x, solarPos.y, solarPos.z);
        sunMeshRef.current.position.set(solarPos.x, solarPos.y, solarPos.z);

        const visible = isSunVisible(solarPos.altitude);
        sunLightRef.current.visible = visible;
        sunMeshRef.current.visible = visible;

        if (visible) {
          const intensity = Math.max(0.2, Math.min(1, solarPos.altitude / 60));
          sunLightRef.current.intensity = intensity;
        }
      }

      const now = Date.now();
      if (now - lastShadowCalcRef.current > 100) {
        lastShadowCalcRef.current = now;

        if (sceneState.components.length > 0 && solarPos.altitude > 0) {
          if (occludersRef.current.length === 0) {
            occludersRef.current = createSceneOccluders(sceneState.trees, sceneState.roof);
          }

          const shadowResults = sceneState.components.map((comp) => {
            const result = calculateComponentShadowRate(
              comp,
              solarPos,
              occludersRef.current,
              raycasterRef.current,
              3
            );
            return {
              componentId: comp.id,
              shadowRate: result.shadowRate,
              shadowedPoints: result.shadowedPoints,
              totalPoints: result.totalPoints,
            };
          });

          useSceneStore.getState().updateRealTimeShadows(shadowResults);

          componentMeshesRef.current.forEach((mesh, componentId) => {
            const shadowResult = shadowResults.find((s) => s.componentId === componentId);
            if (shadowResult && mesh.material instanceof THREE.MeshStandardMaterial) {
              const shadowIntensity = shadowResult.shadowRate / 100;
              const baseColor = mesh.userData.isSelected
                ? new THREE.Color(0xf97316)
                : mesh.userData.isFiltered
                ? new THREE.Color(0x0f766e)
                : new THREE.Color(0x64748b);

              const shadowedColor = baseColor.clone().multiplyScalar(1 - shadowIntensity * 0.5);
              mesh.material.color.copy(shadowedColor);
            }
          });
        }
      }

      controls.update();

      useSceneStore.getState().setCamera({
        position: {
          x: camera.position.x,
          y: camera.position.y,
          z: camera.position.z,
        },
        target: {
          x: controls.target.x,
          y: controls.target.y,
          z: controls.target.z,
        },
      });

      renderer.render(scene, camera);
    };

    animate(0);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      renderer.dispose();
      if (containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  useEffect(() => {
    if (!sceneRef.current) return;
    createRoof(sceneRef.current, useSceneStore.getState().roof);
    occludersRef.current = [];
  }, [useSceneStore.getState().roof, createRoof]);

  useEffect(() => {
    if (!sceneRef.current) return;

    treeMeshesRef.current.forEach((mesh) => {
      sceneRef.current?.remove(mesh);
    });
    treeMeshesRef.current.clear();

    const trees = useSceneStore.getState().trees;
    trees.forEach((tree) => {
      const treeMesh = createTree(tree);
      sceneRef.current?.add(treeMesh);
      treeMeshesRef.current.set(tree.id, treeMesh);
    });

    occludersRef.current = [];
  }, [useSceneStore.getState().trees, createTree]);

  useEffect(() => {
    if (!sceneRef.current) return;

    const sceneState = useSceneStore.getState();
    const filteredIds = new Set(sceneState.getFilteredComponents().map((c) => c.id));

    componentMeshesRef.current.forEach((mesh) => {
      sceneRef.current?.remove(mesh);
    });
    componentMeshesRef.current.clear();

    sceneState.components.forEach((comp) => {
      const isSelected = sceneState.selectedComponents.includes(comp.id);
      const isFiltered = filteredIds.has(comp.id);
      const mesh = createComponent(comp, isSelected, isFiltered);
      mesh.userData.isSelected = isSelected;
      mesh.userData.isFiltered = isFiltered;
      sceneRef.current?.add(mesh);
      componentMeshesRef.current.set(comp.id, mesh);
    });

    occludersRef.current = [];
  }, [
    useSceneStore.getState().components,
    useSceneStore.getState().selectedComponents,
    useSceneStore.getState().filter,
    createComponent,
  ]);

  return {
    containerRef,
    captureScreenshot: captureFn || (() => null),
    setViewPreset: viewPresetFn || (() => {}),
  };
}
