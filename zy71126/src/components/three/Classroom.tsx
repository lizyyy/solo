import { useAppStore } from '@/store/appStore';

export function Classroom() {
  const platform = useAppStore((state) => state.platform);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#1a1a2e" />
      </mesh>

      <gridHelper args={[30, 30, '#3b82f6', '#1e3a5f']} position={[0, 0.01, 0]} />

      <mesh position={[0, 1.5, -15]} receiveShadow>
        <boxGeometry args={[30, 3, 0.2]} />
        <meshStandardMaterial color="#16213e" />
      </mesh>

      <mesh position={[0, 1.5, 15]} receiveShadow>
        <boxGeometry args={[30, 3, 0.2]} />
        <meshStandardMaterial color="#16213e" />
      </mesh>

      <mesh position={[-15, 1.5, 0]} receiveShadow>
        <boxGeometry args={[0.2, 3, 30]} />
        <meshStandardMaterial color="#16213e" />
      </mesh>

      <mesh position={[15, 1.5, 0]} receiveShadow>
        <boxGeometry args={[0.2, 3, 30]} />
        <meshStandardMaterial color="#16213e" />
      </mesh>

      <mesh
        position={[platform.position.x, platform.position.y + platform.size.height / 2, platform.position.z]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[platform.size.width, platform.size.height, platform.size.depth]} />
        <meshStandardMaterial color="#4a5568" />
      </mesh>

      <mesh position={[platform.targetPoint.x, platform.targetPoint.y, platform.targetPoint.z]}>
        <sphereGeometry args={[0.1]} />
        <meshBasicMaterial color="#10b981" transparent opacity={0.8} />
      </mesh>
    </group>
  );
}

export function Lighting() {
  return (
    <>
      <ambientLight intensity={0.4} color="#ffffff" />
      
      <directionalLight
        position={[10, 15, 10]}
        intensity={1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={50}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />
      
      <directionalLight position={[-5, 5, -5]} intensity={0.3} color="#60a5fa" />
      
      <pointLight position={[0, 8, 0]} intensity={0.5} color="#ffffff" />
    </>
  );
}
