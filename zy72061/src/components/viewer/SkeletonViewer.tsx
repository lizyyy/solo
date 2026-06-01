import { useEffect, useRef, useMemo, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { useGaitStore } from '../../store/useGaitStore';
import { SkeletonPoint, SKELETON_CONNECTIONS } from '../../types';

interface PointMeshProps {
  point: SkeletonPoint;
  isSelected: boolean;
  isFiltered: boolean;
  onClick: () => void;
}

function PointMesh({ point, isSelected, isFiltered, onClick }: PointMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    if (meshRef.current) {
      if (point.isAnomaly) {
        const scale = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.15;
        meshRef.current.scale.setScalar(scale);
      }
    }
  });

  const color = useMemo(() => {
    if (!isFiltered) return '#3a4a5c';
    if (isSelected) return '#165DFF';
    if (point.isAnomaly) return '#FF7D00';
    return '#ffffff';
  }, [isSelected, isFiltered, point.isAnomaly]);

  const emissive = useMemo(() => {
    if (!isFiltered) return '#000000';
    if (isSelected) return '#165DFF';
    if (point.isAnomaly) return '#FF7D00';
    return '#1a2d4a';
  }, [isSelected, isFiltered, point.isAnomaly]);

  const scale = isSelected ? 0.035 : point.isAnomaly ? 0.028 : 0.022;

  return (
    <mesh
      ref={meshRef}
      position={[point.x, point.y, point.z]}
      onClick={(e) => {
        e.stopPropagation();
        if (isFiltered) onClick();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = isFiltered ? 'pointer' : 'default';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'auto';
      }}
    >
      <sphereGeometry args={[scale, 16, 16]} />
      <meshStandardMaterial
        color={color}
        emissive={emissive}
        emissiveIntensity={isSelected || hovered ? 0.5 : 0.2}
        transparent
        opacity={isFiltered ? 1 : 0.3}
      />
    </mesh>
  );
}

interface SkeletonLinesProps {
  points: SkeletonPoint[];
  filteredPointNames: Set<string>;
}

function SkeletonLines({ points, filteredPointNames }: SkeletonLinesProps) {
  const pointsMap = useMemo(() => {
    const map = new Map<string, SkeletonPoint>();
    points.forEach((p) => map.set(p.name, p));
    return map;
  }, [points]);

  const lineSegments = useMemo(() => {
    const positions: number[] = [];
    const colors: number[] = [];

    SKELETON_CONNECTIONS.forEach(([from, to]) => {
      const fromPoint = pointsMap.get(from);
      const toPoint = pointsMap.get(to);
      if (fromPoint && toPoint) {
        positions.push(fromPoint.x, fromPoint.y, fromPoint.z);
        positions.push(toPoint.x, toPoint.y, toPoint.z);

        const isFiltered = filteredPointNames.has(from) && filteredPointNames.has(to);
        const isAnomaly = fromPoint.isAnomaly || toPoint.isAnomaly;

        const color = isFiltered ? (isAnomaly ? [1, 0.49, 0] : [1, 1, 1]) : [0.3, 0.4, 0.5];
        colors.push(...color, ...color);
      }
    });

    return { positions: new Float32Array(positions), colors: new Float32Array(colors) };
  }, [pointsMap, filteredPointNames]);

  return (
    <lineSegments>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={lineSegments.positions.length / 3}
          array={lineSegments.positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={lineSegments.colors.length / 3}
          array={lineSegments.colors}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial vertexColors transparent opacity={0.7} linewidth={2} />
    </lineSegments>
  );
}

function CameraController() {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const { cameraState, setCameraState, selectedPointId, frames, currentFrameIndex } = useGaitStore();

  useEffect(() => {
    if (cameraState.position) {
      camera.position.set(...cameraState.position);
    }
  }, []);

  useEffect(() => {
    if (selectedPointId) {
      const currentFrame = frames[currentFrameIndex];
      const selectedPoint = currentFrame?.points.find(
        (p) => p.id === selectedPointId || p.name === selectedPointId,
      );
      if (selectedPoint && controlsRef.current) {
        controlsRef.current.target.set(selectedPoint.x, selectedPoint.y, selectedPoint.z);
      }
    }
  }, [selectedPointId, currentFrameIndex]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      target={cameraState.target}
      onChange={() => {
        if (controlsRef.current) {
          setCameraState({
            position: [camera.position.x, camera.position.y, camera.position.z],
            target: [controlsRef.current.target.x, controlsRef.current.target.y, controlsRef.current.target.z],
          });
        }
      }}
    />
  );
}

function SceneContent() {
  const { frames, currentFrameIndex, selectedPointId, setSelectedPointId, getFilteredPoints } = useGaitStore();
  const currentFrame = frames[currentFrameIndex];
  const filteredPoints = getFilteredPoints();
  const filteredPointNames = useMemo(() => new Set(filteredPoints.map((p) => p.name)), [filteredPoints]);

  if (!currentFrame) return null;

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 10, 5]} intensity={0.8} castShadow />
      <directionalLight position={[-5, 5, -5]} intensity={0.4} />

      <Grid
        args={[10, 10]}
        cellSize={0.5}
        cellThickness={0.5}
        cellColor="#2a3a4a"
        sectionSize={2}
        sectionThickness={1}
        sectionColor="#3a4a5a"
        fadeDistance={30}
        fadeStrength={1}
        followCamera={false}
        infiniteGrid
        position={[0, -0.01, 0]}
      />

      <SkeletonLines points={currentFrame.points} filteredPointNames={filteredPointNames} />

      {currentFrame.points.map((point) => (
        <PointMesh
          key={point.id}
          point={point}
          isSelected={selectedPointId === point.id || selectedPointId === point.name}
          isFiltered={filteredPointNames.has(point.name)}
          onClick={() => setSelectedPointId(point.id)}
        />
      ))}

      <CameraController />
    </>
  );
}

export default function SkeletonViewer() {
  return (
    <div className="w-full h-full relative">
      <Canvas
        camera={{ position: [3, 2, 3], fov: 50 }}
        style={{ background: 'linear-gradient(180deg, #0a1628 0%, #1a2d4a 100%)' }}
      >
        <SceneContent />
      </Canvas>

      <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm rounded-lg px-4 py-2 text-white text-sm">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-white"></span>
            正常点位
          </span>
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-orange-500 animate-pulse"></span>
            异常点位
          </span>
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500"></span>
            选中点位
          </span>
        </div>
      </div>

      <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-sm rounded-lg px-4 py-2 text-white text-xs">
        <div>鼠标左键：旋转 | 鼠标右键：平移 | 滚轮：缩放</div>
      </div>
    </div>
  );
}
