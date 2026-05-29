import { useEffect, useRef, useMemo, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { SimulationResult } from '../types';
import { TARGET_CENTER_TEMPERATURE } from '../data/materials';

interface Workspace3DProps {
  simulations: SimulationResult[];
  selectedIds: string[];
  onSelectSimulation: (id: string) => void;
}

export const Workspace3D: React.FC<Workspace3DProps> = ({
  simulations,
  selectedIds,
  onSelectSimulation
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const simulationMeshesRef = useRef<Map<string, THREE.Group>>(new Map());
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const selectedSimulations = useMemo(() => {
    return simulations.filter(s => selectedIds.includes(s.id));
  }, [simulations, selectedIds]);

  const getTemperatureColor = (temp: number): THREE.Color => {
    const minTemp = 20;
    const maxTemp = 250;
    const ratio = Math.max(0, Math.min(1, (temp - minTemp) / (maxTemp - minTemp)));
    
    const hue = (1 - ratio) * 0.65;
    return new THREE.Color().setHSL(hue, 0.8, 0.5);
  };

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
    camera.position.set(8, 6, 8);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 3;
    controls.maxDistance = 30;
    controlsRef.current = controls;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 15, 10);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    const pointLight = new THREE.PointLight(0xffaa00, 0.5, 30);
    pointLight.position.set(0, 10, 0);
    scene.add(pointLight);

    const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x333333);
    scene.add(gridHelper);

    const ovenGeometry = new THREE.BoxGeometry(12, 8, 10);
    const ovenEdges = new THREE.EdgesGeometry(ovenGeometry);
    const ovenLine = new THREE.LineSegments(
      ovenEdges,
      new THREE.LineBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.3 })
    );
    ovenLine.position.y = 4;
    scene.add(ovenLine);

    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!containerRef.current) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  useEffect(() => {
    if (!sceneRef.current) return;

    simulationMeshesRef.current.forEach(mesh => {
      sceneRef.current?.remove(mesh);
    });
    simulationMeshesRef.current.clear();

    const spacing = 3.5;
    const startX = -((selectedSimulations.length - 1) * spacing) / 2;

    selectedSimulations.forEach((simulation, index) => {
      const group = new THREE.Group();
      group.userData = { simulationId: simulation.id };

      const { cakeDimensions, ovenTemperature } = simulation.params;
      const radius = cakeDimensions.diameter / 100 * 15;
      const height = cakeDimensions.height / 100 * 15;

      const moldGeometry = new THREE.CylinderGeometry(
        radius * 1.1,
        radius * 1.1,
        height * 1.1,
        32
      );
      const moldMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color(simulation.material.color),
        metalness: 0.3,
        roughness: 0.5,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide
      });
      const mold = new THREE.Mesh(moldGeometry, moldMaterial);
      mold.position.y = height * 1.1 / 2;
      mold.castShadow = true;
      group.add(mold);

      const cakeGeometry = new THREE.CylinderGeometry(radius, radius, height, 32);
      const cakeMaterial = new THREE.MeshStandardMaterial({
        color: 0xd4a574,
        metalness: 0.1,
        roughness: 0.8
      });
      const cake = new THREE.Mesh(cakeGeometry, cakeMaterial);
      cake.position.y = height / 2;
      cake.castShadow = true;
      group.add(cake);

      const tempColor = getTemperatureColor(simulation.maxTemperature);
      const centerGeometry = new THREE.SphereGeometry(radius * 0.15, 16, 16);
      const centerMaterial = new THREE.MeshBasicMaterial({
        color: tempColor,
        transparent: true,
        opacity: 0.9
      });
      const center = new THREE.Mesh(centerGeometry, centerMaterial);
      center.position.y = height / 2;
      group.add(center);

      const glowGeometry = new THREE.SphereGeometry(radius * 0.25, 16, 16);
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: tempColor,
        transparent: true,
        opacity: 0.3
      });
      const glow = new THREE.Mesh(glowGeometry, glowMaterial);
      glow.position.y = height / 2;
      group.add(glow);

      const barHeight = (simulation.maxTemperature / ovenTemperature) * 3;
      const barGeometry = new THREE.BoxGeometry(0.3, barHeight, 0.3);
      const barMaterial = new THREE.MeshBasicMaterial({ color: tempColor });
      const bar = new THREE.Mesh(barGeometry, barMaterial);
      bar.position.set(0, height + barHeight / 2 + 0.3, 0);
      group.add(bar);

      group.position.set(startX + index * spacing, 0, 0);
      
      simulationMeshesRef.current.set(simulation.id, group);
      sceneRef.current?.add(group);
    });
  }, [selectedSimulations]);

  useEffect(() => {
    if (!containerRef.current || !sceneRef.current || !cameraRef.current) return;

    const handleMouseMove = (event: MouseEvent) => {
      const rect = containerRef.current!.getBoundingClientRect();
      mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current!);
      
      const allMeshes: THREE.Object3D[] = [];
      simulationMeshesRef.current.forEach(group => {
        group.traverse(child => {
          if (child instanceof THREE.Mesh) {
            allMeshes.push(child);
          }
        });
      });

      const intersects = raycasterRef.current.intersectObjects(allMeshes);
      
      if (intersects.length > 0) {
        let foundId: string | null = null;
        for (const intersect of intersects) {
          let obj: THREE.Object3D | null = intersect.object;
          while (obj) {
            if (obj.userData?.simulationId) {
              foundId = obj.userData.simulationId;
              break;
            }
            obj = obj.parent;
          }
          if (foundId) break;
        }
        setHoveredId(foundId);
        containerRef.current!.style.cursor = foundId ? 'pointer' : 'default';
      } else {
        setHoveredId(null);
        containerRef.current!.style.cursor = 'default';
      }
    };

    const handleClick = () => {
      if (hoveredId) {
        onSelectSimulation(hoveredId);
      }
    };

    containerRef.current.addEventListener('mousemove', handleMouseMove);
    containerRef.current.addEventListener('click', handleClick);

    return () => {
      containerRef.current?.removeEventListener('mousemove', handleMouseMove);
      containerRef.current?.removeEventListener('click', handleClick);
    };
  }, [hoveredId, onSelectSimulation]);

  useEffect(() => {
    simulationMeshesRef.current.forEach((group, id) => {
      const isSelected = selectedIds.includes(id);
      const isHovered = hoveredId === id;
      
      group.traverse(child => {
        if (child instanceof THREE.Mesh) {
          if (child.material instanceof THREE.MeshStandardMaterial) {
            child.material.emissive = isSelected || isHovered 
              ? new THREE.Color(0x222244) 
              : new THREE.Color(0x000000);
          }
        }
      });

      group.scale.setScalar(isHovered ? 1.05 : 1);
    });
  }, [selectedIds, hoveredId]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full rounded-lg overflow-hidden" />
      
      <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm rounded-lg p-3 text-white text-sm">
        <div className="font-medium mb-2">温度图例</div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: '#00ff88' }} />
          <span>20°C</span>
          <div className="w-24 h-3 rounded bg-gradient-to-r from-green-400 via-yellow-400 to-red-500" />
          <span>250°C</span>
        </div>
      </div>

      <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-sm rounded-lg p-3 text-white text-sm">
        <div className="font-medium mb-2">操作提示</div>
        <div className="text-xs text-gray-300 space-y-1">
          <div>🖱️ 左键拖动: 旋转视角</div>
          <div>🖱️ 滚轮: 缩放</div>
          <div>🖱️ 右键拖动: 平移</div>
          <div>👆 点击模具: 选择/取消</div>
        </div>
      </div>

      {hoveredId && (
        <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-sm rounded-lg p-3 text-white">
          {(() => {
            const sim = simulations.find(s => s.id === hoveredId);
            if (!sim) return null;
            return (
              <div>
                <div className="font-medium text-lg">{sim.material.name}</div>
                <div className="text-sm text-gray-300 mt-1">
                  最高温度: {sim.maxTemperature.toFixed(1)}°C
                </div>
                <div className="text-sm text-gray-300">
                  达到{TARGET_CENTER_TEMPERATURE}°C: {sim.timeToTargetTemp ? `${sim.timeToTargetTemp.toFixed(0)}秒` : '未达到'}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};
