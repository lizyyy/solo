import { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useAppStore } from '../store/appStore';
import { convertToHeightPoints, createBarGeometry, createBarMaterial, getAnomalyColor } from '../utils/heightField';
import { CarbonHeightPoint } from '../types';

interface BarMesh extends THREE.Mesh {
  userData: {
    flightId: string;
    point: CarbonHeightPoint;
    baseColor: string;
  };
}

export default function CarbonHeightField() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const barsGroupRef = useRef<THREE.Group | null>(null);
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());
  const animationIdRef = useRef<number>(0);
  const barMapRef = useRef<Map<string, BarMesh>>(new Map());

  const {
    routes,
    aircraft,
    selectedFlightId,
    hoveredFlightId,
    setSelectedFlight,
    setHoveredFlight,
    isRotating,
    getFilteredData,
    permissionManager,
  } = useAppStore();

  const createScene = useCallback(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0e1a);
    scene.fog = new THREE.Fog(0x0a0e1a, 50, 150);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      60,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(40, 50, 40);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 20;
    controls.maxDistance = 100;
    controls.maxPolarAngle = Math.PI / 2.1;
    controlsRef.current = controls;

    const ambientLight = new THREE.AmbientLight(0x404060, 0.5);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1);
    mainLight.position.set(50, 80, 50);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 200;
    mainLight.shadow.camera.left = -100;
    mainLight.shadow.camera.right = 100;
    mainLight.shadow.camera.top = 100;
    mainLight.shadow.camera.bottom = -100;
    scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0x6080ff, 0.4);
    fillLight.position.set(-50, 30, -50);
    scene.add(fillLight);

    const gridHelper = new THREE.GridHelper(120, 24, 0x334155, 0x1e293b);
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);

    const groundGeometry = new THREE.PlaneGeometry(120, 120);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.8,
      metalness: 0.2,
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const barsGroup = new THREE.Group();
    scene.add(barsGroup);
    barsGroupRef.current = barsGroup;

    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);

      if (isRotating && barsGroupRef.current) {
        barsGroupRef.current.rotation.y += 0.002;
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!containerRef.current || !camera || !renderer) return;
      camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationIdRef.current);
      renderer.dispose();
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, [isRotating]);

  const updateBars = useCallback(() => {
    if (!barsGroupRef.current || !sceneRef.current) return;

    barsGroupRef.current.clear();
    barMapRef.current.clear();

    const filteredData = getFilteredData();
    const points = convertToHeightPoints(filteredData, routes, aircraft);

    const barWidth = 3.5;
    const barDepth = 3.5;

    points.forEach((point) => {
      const geometry = createBarGeometry(barWidth, barDepth, point.height);
      const isSelected = selectedFlightId === point.flightData.id;
      const isHovered = hoveredFlightId === point.flightData.id;
      
      let displayColor = point.color;
      const anomalyColor = getAnomalyColor(point.flightData.anomalies);
      if (anomalyColor && point.flightData.status === 'tentative') {
        displayColor = anomalyColor;
      }

      const material = createBarMaterial(displayColor, isSelected, isHovered);
      const bar = new THREE.Mesh(geometry, material) as unknown as BarMesh;
      
      bar.position.set(point.x, 0, point.z);
      bar.castShadow = true;
      bar.receiveShadow = true;
      bar.userData = {
        flightId: point.flightData.id,
        point,
        baseColor: point.color,
      };

      if (point.flightData.anomalies.length > 0) {
        const edges = new THREE.EdgesGeometry(geometry);
        const lineColor = anomalyColor || '#f59e0b';
        const lineMaterial = new THREE.LineBasicMaterial({ 
          color: lineColor, 
          linewidth: 2 
        });
        const wireframe = new THREE.LineSegments(edges, lineMaterial);
        bar.add(wireframe);
      }

      barMapRef.current.set(point.flightData.id, bar);
      barsGroupRef.current!.add(bar);
    });

    createAxisLabels();
  }, [getFilteredData, routes, aircraft, selectedFlightId, hoveredFlightId]);

  const createAxisLabels = useCallback(() => {
    if (!barsGroupRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('航线 →', 128, 40);

    const texture = new THREE.CanvasTexture(canvas);
    const labelMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const xLabel = new THREE.Sprite(labelMaterial);
    xLabel.position.set(0, 0.1, -55);
    xLabel.scale.set(20, 5, 1);
    barsGroupRef.current.add(xLabel);

    const canvas2 = document.createElement('canvas');
    canvas2.width = 256;
    canvas2.height = 64;
    const ctx2 = canvas2.getContext('2d');
    if (!ctx2) return;

    ctx2.fillStyle = '#ffffff';
    ctx2.font = 'bold 24px Arial';
    ctx2.textAlign = 'center';
    ctx2.fillText('机型 ↓', 128, 40);

    const texture2 = new THREE.CanvasTexture(canvas2);
    const labelMaterial2 = new THREE.SpriteMaterial({ map: texture2, transparent: true });
    const zLabel = new THREE.Sprite(labelMaterial2);
    zLabel.position.set(-55, 0.1, 0);
    zLabel.rotation.y = Math.PI / 2;
    zLabel.scale.set(20, 5, 1);
    barsGroupRef.current.add(zLabel);
  }, []);

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!containerRef.current || !cameraRef.current || !barsGroupRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    const intersects = raycasterRef.current.intersectObjects(
      barsGroupRef.current.children,
      true
    );

    if (intersects.length > 0) {
      const bar = intersects[0].object as BarMesh;
      if (bar.userData?.flightId) {
        setHoveredFlight(bar.userData.flightId);
        containerRef.current.style.cursor = 'pointer';
      }
    } else {
      setHoveredFlight(null);
      containerRef.current.style.cursor = 'grab';
    }
  }, [setHoveredFlight]);

  const handleClick = useCallback((event: MouseEvent) => {
    if (!containerRef.current || !cameraRef.current || !barsGroupRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    const intersects = raycasterRef.current.intersectObjects(
      barsGroupRef.current.children,
      true
    );

    if (intersects.length > 0) {
      const bar = intersects[0].object as BarMesh;
      if (bar.userData?.flightId) {
        const flightId = bar.userData.flightId;
        if (selectedFlightId === flightId) {
          setSelectedFlight(null);
        } else {
          setSelectedFlight(flightId);
          permissionManager.logAction('click_flight_bar', { flightId });
        }
      }
    }
  }, [selectedFlightId, setSelectedFlight, permissionManager]);

  useEffect(() => {
    const cleanup = createScene();
    return cleanup;
  }, [createScene]);

  useEffect(() => {
    updateBars();
  }, [updateBars]);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    el.addEventListener('mousemove', handleMouseMove);
    el.addEventListener('click', handleClick);
    return () => {
      el.removeEventListener('mousemove', handleMouseMove);
      el.removeEventListener('click', handleClick);
    };
  }, [handleMouseMove, handleClick]);

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full min-h-[600px] rounded-lg overflow-hidden"
      style={{ cursor: 'grab' }}
    />
  );
}
