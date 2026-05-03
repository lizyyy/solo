import React, { useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useApp } from '../context/AppContext';
import { HOLD_SIZE_PIXELS } from '../data/sampleData';

export function WallCanvas3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const wallMeshesRef = useRef<THREE.Object3D[]>([]);
  const holdMeshesRef = useRef<Map<string, THREE.Object3D>>(new Map());

  const { activeWall, activeRoute, wallRoutes } = useApp();

  const canvasScale = useMemo(() => {
    if (!activeWall) return 0.01;
    const maxDimension = Math.max(activeWall.width, activeWall.height);
    return 0.01;
  }, [activeWall]);

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x94a3b8);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      50,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(3, 2, 5);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.shadowMap.enabled = true;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controlsRef.current = controls;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    const pointLight = new THREE.PointLight(0xffffff, 0.4);
    pointLight.position.set(-5, 5, 5);
    scene.add(pointLight);

    const floorGeometry = new THREE.PlaneGeometry(20, 20);
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.8,
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.1;
    floor.receiveShadow = true;
    scene.add(floor);

    const gridHelper = new THREE.GridHelper(20, 20, 0x475569, 0x475569);
    gridHelper.position.y = -0.09;
    scene.add(gridHelper);

    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!containerRef.current || !camera || !renderer) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
      controls.dispose();
    };
  }, []);

  useEffect(() => {
    if (!sceneRef.current || !activeWall) return;

    const scene = sceneRef.current;

    wallMeshesRef.current.forEach(mesh => scene.remove(mesh));
    wallMeshesRef.current = [];

    const width = activeWall.width * canvasScale;
    const height = activeWall.height * canvasScale;
    const angleRad = (activeWall.angle * Math.PI) / 180;

    const wallGroup = new THREE.Group();

    const wallGeometry = new THREE.BoxGeometry(width, height, 0.15);
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.7,
    });
    const wall = new THREE.Mesh(wallGeometry, wallMaterial);
    wall.position.z = -0.075;
    wall.receiveShadow = true;
    wallGroup.add(wall);

    const gridSize = 20 * canvasScale;
    const gridMaterial = new THREE.LineBasicMaterial({ color: 0x94a3b8, opacity: 0.3, transparent: true });

    for (let x = -width / 2; x <= width / 2; x += gridSize) {
      const lineGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x, -height / 2, 0.001),
        new THREE.Vector3(x, height / 2, 0.001),
      ]);
      const line = new THREE.Line(lineGeometry, gridMaterial);
      wallGroup.add(line);
    }

    for (let y = -height / 2; y <= height / 2; y += gridSize) {
      const lineGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-width / 2, y, 0.001),
        new THREE.Vector3(width / 2, y, 0.001),
      ]);
      const line = new THREE.Line(lineGeometry, gridMaterial);
      wallGroup.add(line);
    }

    for (const zone of activeWall.zones) {
      const zoneWidth = zone.width * canvasScale;
      const zoneHeight = zone.height * canvasScale;
      const zoneX = (zone.x - activeWall.width / 2) * canvasScale + zoneWidth / 2;
      const zoneY = (activeWall.height / 2 - zone.y) * canvasScale - zoneHeight / 2;

      const zoneGeometry = new THREE.PlaneGeometry(zoneWidth, zoneHeight);
      const zoneMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(zone.color).getHex(),
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
      });
      const zoneMesh = new THREE.Mesh(zoneGeometry, zoneMaterial);
      zoneMesh.position.set(zoneX, zoneY, 0.002);
      wallGroup.add(zoneMesh);
    }

    wallGroup.position.y = height / 2;
    wallGroup.rotation.x = -angleRad;
    wallGroup.position.z = -1;

    scene.add(wallGroup);
    wallMeshesRef.current.push(wallGroup);

    if (cameraRef.current) {
      const cameraDistance = Math.max(width * 1.5, 3);
      cameraRef.current.position.set(cameraDistance, height, cameraDistance);
      cameraRef.current.lookAt(0, height / 2, -1);
    }

  }, [activeWall, canvasScale]);

  useEffect(() => {
    if (!sceneRef.current || !activeWall) return;

    const scene = sceneRef.current;

    holdMeshesRef.current.forEach((mesh) => scene.remove(mesh));
    holdMeshesRef.current.clear();

    const width = activeWall.width * canvasScale;
    const height = activeWall.height * canvasScale;
    const angleRad = (activeWall.angle * Math.PI) / 180;

    const allHolds: Array<{ 
      x: number; 
      y: number; 
      color: string; 
      size: number; 
      shape: string; 
      isActive: boolean 
    }> = [];

    wallRoutes.forEach((route) => {
      route.holds.forEach((hold) => {
        allHolds.push({
          x: hold.position.x,
          y: hold.position.y,
          color: hold.color,
          size: HOLD_SIZE_PIXELS[hold.size],
          shape: hold.shape,
          isActive: route.id === activeRoute?.id,
        });
      });
    });

    for (const hold of allHolds) {
      const holdSize = hold.size * canvasScale * 1.5;
      
      let geometry: THREE.BufferGeometry;
      let material: THREE.MeshStandardMaterial;

      switch (hold.shape) {
        case 'jug':
          geometry = new THREE.SphereGeometry(holdSize / 2, 16, 16);
          material = new THREE.MeshStandardMaterial({
            color: hold.color,
            roughness: 0.4,
            metalness: 0.1,
            transparent: !hold.isActive,
            opacity: hold.isActive ? 1 : 0.4,
          });
          break;

        case 'crimp':
          geometry = new THREE.BoxGeometry(holdSize * 0.6, holdSize, holdSize * 0.5);
          material = new THREE.MeshStandardMaterial({
            color: hold.color,
            roughness: 0.5,
            transparent: !hold.isActive,
            opacity: hold.isActive ? 1 : 0.4,
          });
          break;

        case 'pocket':
          geometry = new THREE.CylinderGeometry(holdSize / 2.5, holdSize / 2, holdSize * 0.8, 16);
          material = new THREE.MeshStandardMaterial({
            color: hold.color,
            roughness: 0.4,
            transparent: !hold.isActive,
            opacity: hold.isActive ? 1 : 0.4,
          });
          break;

        case 'edge':
          geometry = new THREE.BoxGeometry(holdSize * 1.5, holdSize * 0.4, holdSize * 0.6);
          material = new THREE.MeshStandardMaterial({
            color: hold.color,
            roughness: 0.5,
            transparent: !hold.isActive,
            opacity: hold.isActive ? 1 : 0.4,
          });
          break;

        case 'sloper':
        default:
          geometry = new THREE.SphereGeometry(holdSize / 1.5, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
          material = new THREE.MeshStandardMaterial({
            color: hold.color,
            roughness: 0.6,
            transparent: !hold.isActive,
            opacity: hold.isActive ? 1 : 0.4,
          });
          break;
      }

      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;

      const x = (hold.x - activeWall.width / 2) * canvasScale;
      const y = (activeWall.height / 2 - hold.y) * canvasScale;

      mesh.position.set(x, y + height / 2, 0.05);
      mesh.rotation.x = -angleRad;

      scene.add(mesh);
      holdMeshesRef.current.set(`${hold.x}-${hold.y}-${hold.shape}`, mesh);
    }

  }, [wallRoutes, activeRoute, activeWall, canvasScale]);

  if (!activeWall) {
    return (
      <div className="canvas-container">
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="9" y1="21" x2="9" y2="9" />
          </svg>
          <p>请先创建或选择一面墙</p>
        </div>
      </div>
    );
  }

  return (
    <div className="canvas-container">
      <div 
        ref={containerRef} 
        className="three-container"
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
      />
      
      <div style={{
        position: 'absolute',
        bottom: '80px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.7)',
        color: 'white',
        padding: '8px 16px',
        borderRadius: '8px',
        fontSize: '0.875rem',
      }}>
        拖动旋转视角 | 滚轮缩放 | 右键平移
      </div>
    </div>
  );
}
