import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Line } from '@react-three/drei';
import * as THREE from 'three';
import type { HoistingPoint, Route, DetectionIssue } from '../types';

interface PointMeshProps {
  point: HoistingPoint;
  onClick: () => void;
}

function PointMesh({ point, onClick }: PointMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const color = point.status === 'warning' ? '#FF7D00' : '#165DFF';
  const pulseColor = point.status === 'warning' ? '#FFE8BF' : '#C9DBFF';

  useFrame((state) => {
    if (meshRef.current && point.status === 'warning') {
      const scale = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.1;
      meshRef.current.scale.setScalar(scale);
    }
  });

  return (
    <group position={[point.x, point.z, point.y]} onClick={(e) => { e.stopPropagation(); onClick(); }}>
      {point.status === 'warning' && (
        <mesh ref={meshRef}>
          <sphereGeometry args={[0.35, 16, 16]} />
          <meshBasicMaterial color={pulseColor} transparent opacity={0.4} />
        </mesh>
      )}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial color={color} metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.25, 0.3, 32]} />
        <meshBasicMaterial color={color} side={THREE.DoubleSide} />
      </mesh>
      <Text
        position={[0, 0.5, 0]}
        fontSize={0.25}
        color="#1D2129"
        anchorX="center"
        anchorY="middle"
      >
        {point.name}
      </Text>
      <Text
        position={[0, -0.5, 0]}
        fontSize={0.18}
        color="#4E5969"
        anchorX="center"
        anchorY="middle"
      >
        {point.load}kg
      </Text>
    </group>
  );
}

interface RouteLineProps {
  route: Route;
  points: HoistingPoint[];
  hasIssue: boolean;
  issue?: DetectionIssue;
}

function RouteLine({ route, points, hasIssue, issue }: RouteLineProps) {
  const fromPoint = points.find(p => p.id === route.fromPoint);
  const toPoint = points.find(p => p.id === route.toPoint);

  const start = useMemo(() => {
    if (!fromPoint) return new THREE.Vector3(0, 0, 0);
    return new THREE.Vector3(fromPoint.x, fromPoint.z, fromPoint.y);
  }, [fromPoint]);

  const end = useMemo(() => {
    if (!toPoint) return new THREE.Vector3(0, 0, 0);
    return new THREE.Vector3(toPoint.x, toPoint.z, toPoint.y);
  }, [toPoint]);

  const curvePoints = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      const pt = new THREE.Vector3();
      pt.lerpVectors(start, end, t);
      const height = Math.sin(t * Math.PI) * 0.5;
      pt.y += height;
      pts.push(pt);
    }
    return pts;
  }, [start, end]);

  if (!fromPoint || !toPoint) return null;

  const midPoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  midPoint.y += 0.5;

  const color = hasIssue ? '#F53F3F' : (route.color || '#165DFF');
  const dashSize = hasIssue ? 0.3 : 0;
  const gapSize = hasIssue ? 0.2 : 0;

  return (
    <group>
      <Line
        points={curvePoints}
        color={color}
        lineWidth={hasIssue ? 4 : 2}
        dashed={hasIssue}
        dashSize={dashSize}
        gapSize={gapSize}
      />
      <Text
        position={[midPoint.x, midPoint.y + 0.3, midPoint.z]}
        fontSize={0.2}
        color={hasIssue ? '#F53F3F' : '#4E5969'}
        anchorX="center"
        anchorY="middle"
      >
        {route.name}: {route.length}m
        {issue && route.calculatedLength && ` / 实测${route.calculatedLength}m`}
      </Text>
    </group>
  );
}

interface StageFloorProps {
  width?: number;
  depth?: number;
}

function StageFloor({ width = 12, depth = 8 }: StageFloorProps) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#F7F8FA" />
      </mesh>
      
      <gridHelper args={[width, 12, '#C9CDD4', '#E5E6EB']} position={[0, 0.001, 0]} />
      
      {Array.from({ length: Math.floor(width / 2) + 1 }).map((_, i) => (
        <Text
          key={`x-${i}`}
          position={[-width / 2 + i * 2, 0.02, -depth / 2 - 0.3]}
          fontSize={0.15}
          color="#86909C"
          anchorX="center"
          anchorY="middle"
        >
          {i * 2 - width / 2}
        </Text>
      ))}
      
      {Array.from({ length: Math.floor(depth / 2) + 1 }).map((_, i) => (
        <Text
          key={`z-${i}`}
          position={[-width / 2 - 0.5, 0.02, -depth / 2 + i * 2]}
          fontSize={0.15}
          color="#86909C"
          anchorX="center"
          anchorY="middle"
        >
          {i * 2}
        </Text>
      ))}
    </group>
  );
}

interface Stage3DSceneProps {
  points: HoistingPoint[];
  routes: Route[];
  issues: DetectionIssue[];
  selectedIssueId: string | null;
  onPointClick: (pointId: string) => void;
}

export function Stage3DScene({ points, routes, issues, selectedIssueId, onPointClick }: Stage3DSceneProps) {
  const selectedIssue = issues.find(i => i.id === selectedIssueId);

  return (
    <Canvas
      camera={{ position: [8, 10, 12], fov: 50 }}
      style={{ background: 'linear-gradient(180deg, #1D2129 0%, #272E3B 100%)' }}
    >
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 15, 10]} intensity={1} castShadow />
      <directionalLight position={[-5, 8, -5]} intensity={0.5} />
      <pointLight position={[0, 15, 0]} intensity={0.8} color="#165DFF" />

      <StageFloor width={12} depth={8} />

      {routes.map(route => {
        const hasIssue = issues.some(i => i.routeId === route.id && i.status !== 'resolved');
        const issue = issues.find(i => i.routeId === route.id);
        const isHighlighted = selectedIssue?.routeId === route.id;
        return (
          <RouteLine
            key={route.id}
            route={route}
            points={points}
            hasIssue={hasIssue || isHighlighted}
            issue={issue}
          />
        );
      })}

      {points.map(point => {
        const relatedIssue = issues.find(i => {
          const route = routes.find(r => r.id === i.routeId);
          return route && (route.fromPoint === point.id || route.toPoint === point.id) && i.status !== 'resolved';
        });
        return (
          <PointMesh
            key={point.id}
            point={{ ...point, status: relatedIssue ? 'warning' : point.status }}
            onClick={() => onPointClick(point.id)}
          />
        );
      })}

      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        minDistance={5}
        maxDistance={30}
        maxPolarAngle={Math.PI / 2.1}
      />
    </Canvas>
  );
}
