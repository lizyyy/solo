import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, Line, Sphere, Text } from '@react-three/drei';
import * as THREE from 'three';
import type { PathPoint, InspectionMark } from '@/types';

interface PipelineSceneProps {
  pathPoints: PathPoint[];
  marks: InspectionMark[];
  selectedMarkId: string | null;
  onSelectMark: (markId: string | null) => void;
  currentTime?: number;
}

function PipelineLine({ points }: { points: PathPoint[] }) {
  const linePoints = useMemo(() => {
    return points.map(p => new THREE.Vector3(p.x, p.z, p.y));
  }, [points]);

  return (
    <Line
      points={linePoints}
      color="#4487E7"
      lineWidth={3}
      transparent
      opacity={0.8}
    />
  );
}

function ObstacleMarkers({
  marks,
  selectedMarkId,
  onSelectMark
}: {
  marks: InspectionMark[];
  selectedMarkId: string | null;
  onSelectMark: (markId: string | null) => void;
}) {
  const obstacleMarks = marks.filter(m => m.isObstacle);

  return (
    <group>
      {obstacleMarks.map((mark) => {
        const isSelected = mark.id === selectedMarkId;
        return (
          <group
            key={mark.id}
            position={[mark.x, mark.z, mark.y]}
            onClick={(e) => {
              e.stopPropagation();
              onSelectMark(isSelected ? null : mark.id);
            }}
          >
            <Sphere
              args={[isSelected ? 0.8 : 0.5, 16, 16]}
            >
              <meshStandardMaterial
                color={isSelected ? '#E63946' : '#E63946'}
                emissive={isSelected ? '#E63946' : '#000000'}
                emissiveIntensity={isSelected ? 0.5 : 0}
              />
            </Sphere>
            {isSelected && (
              <Text
                position={[0, 1.5, 0]}
                fontSize={0.8}
                color="#F1FAEE"
                anchorX="center"
                anchorY="middle"
              >
                {`#${mark.sequenceNo} ${mark.obstacleType}`}
              </Text>
            )}
          </group>
        );
      })}
    </group>
  );
}

function RegularMarkers({
  marks,
  selectedMarkId,
  onSelectMark
}: {
  marks: InspectionMark[];
  selectedMarkId: string | null;
  onSelectMark: (markId: string | null) => void;
}) {
  const regularMarks = marks.filter(m => !m.isObstacle);

  return (
    <group>
      {regularMarks.map((mark) => {
        const isSelected = mark.id === selectedMarkId;
        return (
          <group
            key={mark.id}
            position={[mark.x, mark.z, mark.y]}
            onClick={(e) => {
              e.stopPropagation();
              onSelectMark(isSelected ? null : mark.id);
            }}
          >
            <Sphere
              args={[isSelected ? 0.5 : 0.3, 8, 8]}
            >
              <meshStandardMaterial
                color={isSelected ? '#2A9D8F' : '#4487E7'}
                emissive={isSelected ? '#2A9D8F' : '#000000'}
                emissiveIntensity={isSelected ? 0.5 : 0}
              />
            </Sphere>
          </group>
        );
      })}
    </group>
  );
}

function PlaybackMarker({
  pathPoints,
  currentTime
}: {
  pathPoints: PathPoint[];
  currentTime: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const totalPoints = pathPoints.length;
  const currentIndex = Math.min(
    Math.floor((currentTime / 100) * totalPoints),
    totalPoints - 1
  );
  const currentPoint = pathPoints[currentIndex];

  useFrame(() => {
    if (meshRef.current && currentPoint) {
      meshRef.current.position.set(currentPoint.x, currentPoint.z, currentPoint.y);
    }
  });

  if (!currentPoint) return null;

  return (
    <Sphere ref={meshRef} args={[0.6, 16, 16]}>
      <meshStandardMaterial
        color="#2A9D8F"
        emissive="#2A9D8F"
        emissiveIntensity={0.8}
      />
    </Sphere>
  );
}

function SceneContent({
  pathPoints,
  marks,
  selectedMarkId,
  onSelectMark,
  currentTime = 0
}: PipelineSceneProps) {
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[10, 20, 10]}
        intensity={1}
        castShadow
      />
      <directionalLight
        position={[-10, 10, -10]}
        intensity={0.3}
      />

      <Grid
        args={[100, 100]}
        cellSize={5}
        cellThickness={0.5}
        cellColor="#0A2463"
        sectionSize={25}
        sectionThickness={1}
        sectionColor="#4487E7"
        fadeDistance={100}
        fadeStrength={1}
        followCamera={false}
        infiniteGrid
      />

      {pathPoints.length > 1 && (
        <>
          <PipelineLine points={pathPoints} />
          <PlaybackMarker pathPoints={pathPoints} currentTime={currentTime} />
        </>
      )}

      <ObstacleMarkers
        marks={marks}
        selectedMarkId={selectedMarkId}
        onSelectMark={onSelectMark}
      />

      <RegularMarkers
        marks={marks}
        selectedMarkId={selectedMarkId}
        onSelectMark={onSelectMark}
      />

      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        minDistance={10}
        maxDistance={200}
      />
    </>
  );
}

export default function PipelineScene(props: PipelineSceneProps) {
  return (
    <div className="canvas-container w-full h-full">
      <Canvas
        camera={{ position: [50, 50, 50], fov: 50 }}
        onClick={() => props.onSelectMark(null)}
      >
        <SceneContent {...props} />
      </Canvas>
    </div>
  );
}
