import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ShipRecord } from '@/types';
import { geoToScene, CHANNEL_LENGTH, CHANNEL_WIDTH } from '@/data/sampleData';

function WaterSurface() {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor1: { value: new THREE.Color('#051225') },
      uColor2: { value: new THREE.Color('#0a2040') },
    }),
    []
  );

  useFrame((_, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value += delta * 0.3;
    }
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
      <planeGeometry args={[CHANNEL_WIDTH + 10, CHANNEL_LENGTH + 10, 32, 32]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={`
          varying vec2 vUv;
          uniform float uTime;
          void main() {
            vUv = uv;
            vec3 pos = position;
            pos.z += sin(pos.x * 2.0 + uTime) * 0.15 + cos(pos.y * 1.5 + uTime * 0.7) * 0.1;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        `}
        fragmentShader={`
          varying vec2 vUv;
          uniform vec3 uColor1;
          uniform vec3 uColor2;
          uniform float uTime;
          void main() {
            vec3 color = mix(uColor1, uColor2, vUv.y + sin(vUv.x * 3.0 + uTime) * 0.1);
            gl_FragColor = vec4(color, 0.95);
          }
        `}
        transparent
      />
    </mesh>
  );
}

function ChannelBoundary() {
  const hw = CHANNEL_WIDTH / 2;
  const hl = CHANNEL_LENGTH / 2;
  const points = [
    new THREE.Vector3(-hw, 0.05, -hl),
    new THREE.Vector3(-hw, 0.05, hl),
    new THREE.Vector3(hw, 0.05, hl),
    new THREE.Vector3(hw, 0.05, -hl),
    new THREE.Vector3(-hw, 0.05, -hl),
  ];

  return (
    <group>
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={points.length}
            array={new Float32Array(points.flatMap((p) => [p.x, p.y, p.z]))}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#00E5CC" linewidth={2} transparent opacity={0.7} />
      </line>
      {[
        [-hw, -hl],
        [-hw, hl],
        [hw, -hl],
        [hw, hl],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.3, z]}>
          <sphereGeometry args={[0.3, 8, 8]} />
          <meshStandardMaterial color="#00E5CC" emissive="#00E5CC" emissiveIntensity={2} />
        </mesh>
      ))}
    </group>
  );
}

function ShipMarker({
  record,
  isSelected,
  onSelect,
}: {
  record: ShipRecord;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const [x, , z] = geoToScene(record.longitude, record.latitude);
  const isAnomaly = record.anomalyType !== '正常';
  const baseColor = isAnomaly ? '#FF4757' : '#00E5CC';

  useFrame((state) => {
    if (isAnomaly && glowRef.current) {
      const pulse = Math.sin(state.clock.elapsedTime * 3) * 0.5 + 0.5;
      glowRef.current.scale.setScalar(1 + pulse * 0.5);
      (glowRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
        1 + pulse * 2;
    }
  });

  return (
    <group
      ref={groupRef}
      position={[x, 0.2, z]}
      rotation={[0, (-record.heading * Math.PI) / 180, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <mesh position={[0, 0.4, 0]}>
        <coneGeometry args={[0.25, 0.8, 4]} />
        <meshStandardMaterial color={baseColor} emissive={baseColor} emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0, 0.15, -0.3]}>
        <boxGeometry args={[0.5, 0.3, 0.8]} />
        <meshStandardMaterial color={baseColor} emissive={baseColor} emissiveIntensity={0.3} />
      </mesh>
      {isSelected && (
        <mesh position={[0, 0.3, 0]}>
          <ringGeometry args={[0.8, 1.0, 16]} />
          <meshStandardMaterial
            color="#FFFFFF"
            emissive="#FFFFFF"
            emissiveIntensity={1}
            transparent
            opacity={0.6}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
      {isAnomaly && (
        <mesh ref={glowRef} position={[0, 0.4, 0]}>
          <sphereGeometry args={[0.7, 12, 12]} />
          <meshStandardMaterial
            color="#FF4757"
            emissive="#FF4757"
            emissiveIntensity={1.5}
            transparent
            opacity={0.25}
          />
        </mesh>
      )}
    </group>
  );
}

export default function SandtableScene({
  records,
  selectedRecordId,
  onSelectRecord,
}: {
  records: ShipRecord[];
  selectedRecordId: string | null;
  onSelectRecord: (id: string | null) => void;
}) {
  return (
    <group onClick={() => onSelectRecord(null)}>
      <ambientLight intensity={0.2} />
      <directionalLight position={[20, 30, 10]} intensity={0.6} color="#4488cc" />
      <pointLight position={[0, 10, 0]} intensity={0.3} color="#00E5CC" distance={60} />
      <WaterSurface />
      <ChannelBoundary />
      <gridHelper
        args={[Math.max(CHANNEL_LENGTH, CHANNEL_WIDTH) + 20, 20, '#0a2040', '#071530']}
        position={[0, 0.01, 0]}
      />
      {records.map((record) => (
        <ShipMarker
          key={record.id}
          record={record}
          isSelected={record.id === selectedRecordId}
          onSelect={() => onSelectRecord(record.id)}
        />
      ))}
    </group>
  );
}
