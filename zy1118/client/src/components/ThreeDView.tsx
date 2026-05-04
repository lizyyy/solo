import { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Plan, Booth, ValidationResult, Position } from '../types';
import { boothColors } from '../utils/geometry';

interface ThreeDViewProps {
  plan: Plan | null;
  validationResults: ValidationResult[];
  selectedBoothId: string | null;
  onSelectBooth: (id: string | null) => void;
}

export function ThreeDView({ plan, validationResults, selectedBoothId, onSelectBooth }: ThreeDViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const boothMeshesRef = useRef<Map<string, THREE.Object3D>>(new Map());
  const animationFrameRef = useRef<number | null>(null);

  const getRiskLevelForBooth = useCallback((boothId: string): string | null => {
    const result = validationResults.find(r => 
      !r.passed && r.affectedObjects?.some(o => o.id === boothId && o.type === 'booth')
    );
    return result ? result.riskLevel : null;
  }, [validationResults]);

  const createBoothMesh = useCallback((booth: Booth, hallHeight: number) => {
    const group = new THREE.Group();
    group.userData = { boothId: booth.id };

    const baseHeight = booth.size.height || 2.5;
    const color = boothColors[booth.type] || boothColors.other;

    const geometry = new THREE.BoxGeometry(booth.size.width, baseHeight, booth.size.depth);
    const material = new THREE.MeshStandardMaterial({
      color,
      transparent: true,
      opacity: 0.8,
      roughness: 0.7,
      metalness: 0.1
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = baseHeight / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    const edgeGeometry = new THREE.EdgesGeometry(geometry);
    const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x333333, linewidth: 2 });
    const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    edges.position.y = baseHeight / 2;
    group.add(edges);

    if (booth.isPopular) {
      const starGeometry = new THREE.RingGeometry(0.3, 0.6, 5);
      const starMaterial = new THREE.MeshBasicMaterial({ color: 0xfbbf24, side: THREE.DoubleSide });
      const star = new THREE.Mesh(starGeometry, starMaterial);
      star.position.y = baseHeight + 0.2;
      star.rotation.x = -Math.PI / 2;
      group.add(star);
    }

    const riskLevel = getRiskLevelForBooth(booth.id);
    if (riskLevel) {
      const riskColors: Record<string, number> = {
        critical: 0xdc2626,
        high: 0xea580c,
        medium: 0xca8a04,
        low: 0x65a30d
      };
      const ringGeometry = new THREE.RingGeometry(
        Math.max(booth.size.width, booth.size.depth) / 2 + 0.1,
        Math.max(booth.size.width, booth.size.depth) / 2 + 0.2,
        32
      );
      const ringMaterial = new THREE.MeshBasicMaterial({ 
        color: riskColors[riskLevel] || 0xdc2626, 
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8
      });
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.position.y = 0.02;
      ring.rotation.x = -Math.PI / 2;
      group.add(ring);
    }

    group.position.set(
      booth.position.x + booth.size.width / 2,
      0,
      booth.position.y + booth.size.depth / 2
    );

    return group;
  }, [getRiskLevelForBooth]);

  const createHallFloor = useCallback((plan: Plan) => {
    const group = new THREE.Group();

    const floorGeometry = new THREE.PlaneGeometry(plan.hall.dimensions.width, plan.hall.dimensions.depth);
    const floorMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xf8fafc,
      roughness: 0.8
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.x = plan.hall.dimensions.width / 2;
    floor.position.z = plan.hall.dimensions.depth / 2;
    floor.receiveShadow = true;
    group.add(floor);

    const gridSize = plan.hall.gridSize || 1;
    const gridHelper = new THREE.GridHelper(
      Math.max(plan.hall.dimensions.width, plan.hall.dimensions.depth),
      Math.max(plan.hall.dimensions.width, plan.hall.dimensions.depth) / gridSize,
      0xe2e8f0,
      0xf1f5f9
    );
    gridHelper.position.x = plan.hall.dimensions.width / 2;
    gridHelper.position.z = plan.hall.dimensions.depth / 2;
    group.add(gridHelper);

    const wallHeight = plan.hall.dimensions.height || 6;
    const wallMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xe2e8f0,
      side: THREE.DoubleSide
    });

    const backWall = new THREE.Mesh(
      new THREE.BoxGeometry(plan.hall.dimensions.width, wallHeight, 0.2),
      wallMaterial
    );
    backWall.position.set(
      plan.hall.dimensions.width / 2,
      wallHeight / 2,
      0.1
    );
    group.add(backWall);

    const leftWall = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, wallHeight, plan.hall.dimensions.depth),
      wallMaterial
    );
    leftWall.position.set(
      0.1,
      wallHeight / 2,
      plan.hall.dimensions.depth / 2
    );
    group.add(leftWall);

    const rightWall = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, wallHeight, plan.hall.dimensions.depth),
      wallMaterial
    );
    rightWall.position.set(
      plan.hall.dimensions.width - 0.1,
      wallHeight / 2,
      plan.hall.dimensions.depth / 2
    );
    group.add(rightWall);

    for (const entrance of plan.hall.entrances) {
      const entranceGroup = new THREE.Group();
      
      const markerGeometry = new THREE.BoxGeometry(entrance.size.width, 0.1, entrance.size.depth);
      const markerMaterial = new THREE.MeshBasicMaterial({ color: 0x10b981 });
      const marker = new THREE.Mesh(markerGeometry, markerMaterial);
      marker.position.set(
        entrance.position.x + entrance.size.width / 2,
        0.05,
        entrance.position.y + entrance.size.depth / 2
      );
      entranceGroup.add(marker);

      const labelGeometry = new THREE.PlaneGeometry(entrance.size.width, 0.5);
      const labelMaterial = new THREE.MeshBasicMaterial({ color: 0x10b981, side: THREE.DoubleSide });
      const label = new THREE.Mesh(labelGeometry, labelMaterial);
      label.position.set(
        entrance.position.x + entrance.size.width / 2,
        0.5,
        entrance.position.y + entrance.size.depth / 2 + 0.5
      );
      label.rotation.x = -Math.PI / 4;
      entranceGroup.add(label);

      group.add(entranceGroup);
    }

    for (const exit of plan.hall.exits) {
      const exitGroup = new THREE.Group();
      
      const exitColor = exit.isEmergency ? 0xef4444 : 0xf97316;
      const markerGeometry = new THREE.BoxGeometry(exit.size.width, 0.1, exit.size.depth);
      const markerMaterial = new THREE.MeshBasicMaterial({ color: exitColor });
      const marker = new THREE.Mesh(markerGeometry, markerMaterial);
      marker.position.set(
        exit.position.x + exit.size.width / 2,
        0.05,
        exit.position.y + exit.size.depth / 2
      );
      exitGroup.add(marker);

      group.add(exitGroup);
    }

    for (const pillar of plan.hall.pillars) {
      const pillarMesh = new THREE.Mesh(
        new THREE.BoxGeometry(pillar.size.width, wallHeight * 0.8, pillar.size.depth),
        new THREE.MeshStandardMaterial({ color: 0x94a3b8 })
      );
      pillarMesh.position.set(
        pillar.position.x + pillar.size.width / 2,
        wallHeight * 0.4,
        pillar.position.y + pillar.size.depth / 2
      );
      group.add(pillarMesh);
    }

    return group;
  }, []);

  const addRiskIndicators = useCallback((scene: THREE.Scene, results: ValidationResult[]) => {
    for (const result of results) {
      if (result.passed || !result.location) continue;

      const riskColors: Record<string, number> = {
        critical: 0xdc2626,
        high: 0xea580c,
        medium: 0xca8a04,
        low: 0x65a30d
      };

      const color = riskColors[result.riskLevel] || 0xdc2626;
      const size = result.riskLevel === 'critical' ? 1.5 : result.riskLevel === 'high' ? 1.2 : 0.8;

      const geometry = new THREE.SphereGeometry(size, 16, 16);
      const material = new THREE.MeshBasicMaterial({ 
        color,
        transparent: true,
        opacity: 0.6
      });
      const sphere = new THREE.Mesh(geometry, material);
      sphere.position.set(
        result.location.x,
        1,
        result.location.y
      );
      sphere.userData = { isRiskIndicator: true, ruleId: result.ruleId };
      scene.add(sphere);
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8fafc);
    scene.fog = new THREE.Fog(0xf8fafc, 50, 150);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(30, 25, 30);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2;
    controls.minDistance = 5;
    controls.maxDistance = 100;
    controlsRef.current = controls;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(20, 40, 20);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    const handleResize = () => {
      if (!containerRef.current || !camera || !renderer) return;
      const newWidth = containerRef.current.clientWidth;
      const newHeight = containerRef.current.clientHeight;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };
    window.addEventListener('resize', handleResize);

    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      renderer.dispose();
      containerRef.current?.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !plan) return;

    for (const mesh of boothMeshesRef.current.values()) {
      scene.remove(mesh);
    }
    boothMeshesRef.current.clear();

    const existingObjects = scene.children.filter(c => 
      c.userData.isHall || c.userData.isRiskIndicator
    );
    for (const obj of existingObjects) {
      scene.remove(obj);
    }

    const hallGroup = createHallFloor(plan);
    hallGroup.userData = { isHall: true };
    scene.add(hallGroup);

    for (const booth of plan.booths) {
      const mesh = createBoothMesh(booth, plan.hall.dimensions.height || 6);
      boothMeshesRef.current.set(booth.id, mesh);
      scene.add(mesh);
    }

    addRiskIndicators(scene, validationResults.filter(r => !r.passed));

  }, [plan, validationResults, createHallFloor, createBoothMesh, addRiskIndicators]);

  useEffect(() => {
    for (const [id, mesh] of boothMeshesRef.current) {
      const isSelected = id === selectedBoothId;
      const baseScale = isSelected ? 1.02 : 1;
      mesh.scale.set(baseScale, baseScale, baseScale);
    }
  }, [selectedBoothId]);

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full bg-slate-50"
      style={{ cursor: 'grab' }}
    />
  );
}
