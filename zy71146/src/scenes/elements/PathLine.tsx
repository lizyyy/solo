import { useMemo, useRef } from 'react';
import { CatmullRomCurve3, Vector3, TubeGeometry } from 'three';
import { useFrame } from '@react-three/fiber';
import { PathData } from '@/types';
import { useSceneStore } from '@/store/sceneStore';

interface PathLineProps {
  data: PathData;
  showPlayer?: boolean;
}

export function PathLine({ data, showPlayer = true }: PathLineProps) {
  const tubeRef = useRef<TubeGeometry>(null);
  const playerRef = useRef<THREE.Mesh>(null);
  
  const activePath = useSceneStore(state => state.activePath);
  const currentTime = useSceneStore(state => state.currentTime);
  const totalDuration = useSceneStore(state => state.totalDuration);
  const isPlaying = useSceneStore(state => state.isPlaying);
  const isActive = activePath === data.id;

  const curve = useMemo(() => {
    const points = data.points.map(p => new Vector3(p[0], p[1], p[2]));
    return new CatmullRomCurve3(points, false, 'catmullrom', 0.5);
  }, [data.points]);

  const tubeGeometry = useMemo(() => {
    return new TubeGeometry(curve, 100, 0.15, 8, false);
  }, [curve]);

  useFrame(() => {
    if (playerRef.current && isActive) {
      const progress = Math.min(currentTime / totalDuration, 1);
      const position = curve.getPoint(progress);
      playerRef.current.position.copy(position);
      
      const tangent = curve.getTangent(progress);
      playerRef.current.rotation.y = Math.atan2(tangent.x, tangent.z);
    }
  });

  return (
    <group>
      <mesh geometry={tubeGeometry}>
        <meshBasicMaterial
          color={data.color}
          transparent
          opacity={isActive ? 0.8 : 0.4}
          side={2}
        />
      </mesh>

      {data.points.map((point, index) => (
        <mesh key={index} position={point}>
          <sphereGeometry args={[0.25, 16, 16]} />
          <meshBasicMaterial color={data.color} />
        </mesh>
      ))}

      {isActive && showPlayer && (
        <mesh ref={playerRef as any}>
          <capsuleGeometry args={[0.3, 0.8, 8, 16]} />
          <meshStandardMaterial
            color={data.color}
            emissive={data.color}
            emissiveIntensity={0.5}
          />
          <mesh position={[0, 0.8, 0]}>
            <sphereGeometry args={[0.25, 16, 16]} />
            <meshStandardMaterial color="#ffcc80" />
          </mesh>
        </mesh>
      )}
    </group>
  );
}
