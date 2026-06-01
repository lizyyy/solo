import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, Text, Line } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import type { Project, Point, Anomaly } from '../types';
import { useProjectStore } from '../store/projectStore';

interface PointMarkerProps {
  point: Point;
  coordColor: string;
  isSelected: boolean;
  onClick: () => void;
}

function PointMarker({ point, coordColor, isSelected, onClick }: PointMarkerProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  const hasAnomaly = point.anomalies.length > 0;
  const missingPhoto = point.anomalies.some((a) => a.type === 'missing_photo');
  const coordOffset = point.anomalies.find((a) => a.type === 'coordinate_offset');

  const pointColor = useMemo(() => {
    if (point.anomalies.some((a) => a.type === 'coordinate_offset')) return '#ffb703';
    if (point.anomalies.some((a) => a.type === 'duplicate_name')) return '#9b5de5';
    if (missingPhoto) return '#e63946';
    if (point.anomalies.some((a) => a.type === 'cross_floor')) return '#f97316';
    return coordColor;
  }, [point.anomalies, coordColor]);

  useFrame(({ clock }) => {
    if (meshRef.current && hasAnomaly) {
      const scale = 1 + Math.sin(clock.elapsedTime * 3) * 0.1;
      meshRef.current.scale.setScalar(scale);
    }
    if (glowRef.current && hasAnomaly) {
      const scale = 1.5 + Math.sin(clock.elapsedTime * 2) * 0.3;
      glowRef.current.scale.setScalar(scale);
    }
  });

  return (
    <group position={[point.position.x, point.position.y + 0.5, point.position.z]}>
      {coordOffset && coordOffset.originalPosition && (
        <Line
          points={[
            [0, -0.5, 0],
            [
              coordOffset.originalPosition.x - point.position.x,
              coordOffset.originalPosition.y - point.position.y,
              coordOffset.originalPosition.z - point.position.z,
            ],
          ]}
          color="#ffb703"
          lineWidth={2}
          dashed
          dashSize={0.3}
          gapSize={0.2}
        />
      )}

      {coordOffset && coordOffset.originalPosition && (
        <mesh
          position={[
            coordOffset.originalPosition.x - point.position.x,
            coordOffset.originalPosition.y - point.position.y + 0.5,
            coordOffset.originalPosition.z - point.position.z,
          ]}
        >
          <sphereGeometry args={[0.3, 16, 16]} />
          <meshBasicMaterial color="#ffb703" transparent opacity={0.3} wireframe />
        </mesh>
      )}

      {hasAnomaly && (
        <mesh ref={glowRef}>
          <sphereGeometry args={[0.5, 16, 16]} />
          <meshBasicMaterial color={pointColor} transparent opacity={0.2} />
        </mesh>
      )}

      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        <sphereGeometry args={[0.35, 16, 16]} />
        {missingPhoto ? (
          <meshBasicMaterial color={pointColor} wireframe />
        ) : (
          <meshStandardMaterial
            color={pointColor}
            emissive={isSelected ? pointColor : '#000000'}
            emissiveIntensity={isSelected ? 0.5 : 0}
          />
        )}
      </mesh>

      <Text
        position={[0, 0.8, 0]}
        fontSize={0.25}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
      >
        {point.name.split('-')[1] || point.name}
      </Text>

      <Text
        position={[0, 1.1, 0]}
        fontSize={0.15}
        color="#94a3b8"
        anchorX="center"
        anchorY="middle"
      >
        {point.deviceId}
      </Text>
    </group>
  );
}

interface CrossFloorLineProps {
  point1: Point;
  point2: Point;
}

function CrossFloorLine({ point1, point2 }: CrossFloorLineProps) {
  return (
    <Line
      points={[
        [point1.position.x, point1.position.y + 0.5, point1.position.z],
        [point2.position.x, point2.position.y + 0.5, point2.position.z],
      ]}
      color="#f97316"
      lineWidth={2}
      dashed
      dashSize={0.5}
      gapSize={0.3}
    />
  );
}

interface DuplicateLineProps {
  point1: Point;
  point2: Point;
}

function DuplicateLine({ point1, point2 }: DuplicateLineProps) {
  return (
    <Line
      points={[
        [point1.position.x, point1.position.y + 0.5, point1.position.z],
        [point2.position.x, point2.position.y + 0.5, point2.position.z],
      ]}
      color="#9b5de5"
      lineWidth={2}
      dashed
      dashSize={0.2}
      gapSize={0.2}
    />
  );
}

interface SceneContentProps {
  project: Project;
}

function SceneContent({ project }: SceneContentProps) {
  const { selectedPointId, selectPoint } = useProjectStore();

  const crossFloorPairs = useMemo(() => {
    const pairs: [Point, Point][] = [];
    project.points.forEach((point) => {
      const crossFloor = point.anomalies.find((a) => a.type === 'cross_floor');
      if (crossFloor && crossFloor.relatedPointId) {
        const relatedPoint = project.points.find((p) => p.id === crossFloor.relatedPointId);
        if (relatedPoint) {
          pairs.push([point, relatedPoint]);
        }
      }
    });
    return pairs;
  }, [project.points]);

  const duplicatePairs = useMemo(() => {
    const pairs: [Point, Point][] = [];
    const processed = new Set<string>();
    project.points.forEach((point) => {
      const duplicate = point.anomalies.find((a) => a.type === 'duplicate_name');
      if (duplicate && duplicate.relatedPointId && !processed.has(point.id)) {
        const relatedPoint = project.points.find((p) => p.id === duplicate.relatedPointId);
        if (relatedPoint) {
          pairs.push([point, relatedPoint]);
          processed.add(point.id);
          processed.add(relatedPoint.id);
        }
      }
    });
    return pairs;
  }, [project.points]);

  return (
    <>
      {project.coordinateSystems.map((coord) => {
        const coordPoints = project.points.filter((p) => p.coordinateSystemId === coord.id);
        const offsetX = coord.offset.x;
        const offsetZ = coord.offset.z;

        return (
          <group key={coord.id}>
            <Grid
              position={[offsetX + 15, -0.01, offsetZ + 15]}
              args={[30, 30]}
              cellSize={2}
              cellThickness={0.5}
              cellColor={coord.color}
              sectionSize={10}
              sectionThickness={1}
              sectionColor={coord.color}
              fadeDistance={50}
              fadeStrength={1}
              infiniteGrid={false}
            />

            <Text
              position={[offsetX, 0.1, offsetZ]}
              fontSize={0.6}
              color={coord.color}
              anchorX="left"
              anchorY="bottom"
            >
              {coord.name}
            </Text>

            {coordPoints.map((point) => (
              <PointMarker
                key={point.id}
                point={point}
                coordColor={coord.color}
                isSelected={selectedPointId === point.id}
                onClick={() => selectPoint(point.id)}
              />
            ))}
          </group>
        );
      })}

      {crossFloorPairs.map(([p1, p2], index) => (
        <CrossFloorLine key={`cross-${index}`} point1={p1} point2={p2} />
      ))}

      {duplicatePairs.map(([p1, p2], index) => (
        <DuplicateLine key={`dup-${index}`} point1={p1} point2={p2} />
      ))}

      <EffectComposer>
        <Bloom luminanceThreshold={0.2} luminanceSmoothing={0.9} height={300} intensity={0.5} />
      </EffectComposer>
    </>
  );
}

interface Scene3DProps {
  project: Project;
}

export function Scene3D({ project }: Scene3DProps) {
  return (
    <Canvas
      camera={{ position: [30, 25, 35], fov: 50 }}
      style={{ background: '#0f172a' }}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 20, 10]} intensity={1} castShadow />
      <pointLight position={[-10, 10, -10]} intensity={0.5} color="#60a5fa" />

      <SceneContent project={project} />

      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        minDistance={10}
        maxDistance={80}
      />
    </Canvas>
  );
}
