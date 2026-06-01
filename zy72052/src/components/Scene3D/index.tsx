import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Text } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { ConcertHall } from './ConcertHall';
import { ReflectionChamber } from './ReflectionChamber';
import { SoundRay } from './SoundRay';
import { useAppStore } from '@/store/useAppStore';

export function Scene3D() {
  const filteredPoints = useAppStore(s => s.filteredPoints);
  const selectedPointId = useAppStore(s => s.selectedPointId);
  const selectPoint = useAppStore(s => s.selectPoint);
  const rayPaths = useAppStore(s => s.rayPaths);
  const showRayAnimation = useAppStore(s => s.showRayAnimation);
  const isPointInRayPath = useAppStore(s => s.isPointInRayPath);

  const chamberPoints = filteredPoints.filter(p => p.isReflectionChamber);
  const otherPoints = filteredPoints.filter(p => !p.isReflectionChamber);

  return (
    <Canvas
      camera={{ position: [8, 6, 10], fov: 50 }}
      style={{ background: '#0a0f1a' }}
      gl={{ preserveDrawingBuffer: true }}
    >
      <ambientLight intensity={0.2} color="#4a6fa5" />
      <directionalLight position={[5, 8, 3]} intensity={0.6} color="#e8d5b7" castShadow />
      <pointLight position={[0, 4, -3]} intensity={0.5} color="#ffd89b" distance={15} />

      <ConcertHall />

      {chamberPoints.map(point => (
        <group key={point.id}>
          <ReflectionChamber
            point={point}
            isSelected={selectedPointId === point.id}
            isInRayPath={isPointInRayPath(point.id)}
            onClick={selectPoint}
          />
          {point.x !== null && point.y !== null && point.z !== null && (
            <Text
              position={[point.x - 5, point.y + 0.6, point.z - 5]}
              fontSize={0.2}
              color="#e0e0e0"
              anchorX="center"
              anchorY="bottom"
            >
              {point.name}
            </Text>
          )}
        </group>
      ))}

      {otherPoints.map(point => {
        if (point.x === null || point.y === null || point.z === null) return null;
        const icon = point.type === 'microphone' ? '🎤' : '🔊';
        return (
          <group key={point.id} position={[point.x - 5, point.y, point.z - 5]}>
            <mesh onClick={(e) => { e.stopPropagation(); selectPoint(point.id); }}>
              <sphereGeometry args={[0.15, 12, 12]} />
              <meshStandardMaterial
                color={point.type === 'microphone' ? '#27ae60' : '#3498db'}
                emissive={point.type === 'microphone' ? '#27ae60' : '#3498db'}
                emissiveIntensity={0.5}
              />
            </mesh>
            <Text
              position={[0, 0.4, 0]}
              fontSize={0.18}
              color="#e0e0e0"
              anchorX="center"
              anchorY="bottom"
            >
              {`${icon} ${point.name}`}
            </Text>
          </group>
        );
      })}

      <SoundRay
        paths={rayPaths}
        selectedChamberId={selectedPointId}
        visible={showRayAnimation}
      />

      <OrbitControls
        makeDefault
        maxPolarAngle={Math.PI / 2}
        minDistance={3}
        maxDistance={25}
        target={[0, 2, 0]}
      />

      <EffectComposer>
        <Bloom intensity={0.4} luminanceThreshold={0.6} luminanceSmoothing={0.9} />
      </EffectComposer>
    </Canvas>
  );
}
