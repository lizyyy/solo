import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { zones } from '../../data/stationConfig';
import { useSimulationStore } from '../../store/useSimulationStore';

function Floor() {
  return (
    <group>
      <mesh position={[0, -0.01, 0]} receiveShadow>
        <boxGeometry args={[22, 0.02, 40]} />
        <meshStandardMaterial
          color="#1a1a2e"
          roughness={0.8}
          metalness={0.2}
        />
      </mesh>

      <mesh position={[0, -0.005, 0]}>
        <boxGeometry args={[20, 0.01, 15]} />
        <meshStandardMaterial
          color="#2a2a4e"
          roughness={0.6}
          metalness={0.3}
        />
      </mesh>

      <gridHelper args={[20, 20, '#00D4FF', '#1a3a4e']} position={[0, 0.001, 0]} />
    </group>
  );
}

function Walls() {
  const wallMaterial = (
    <meshStandardMaterial
      color="#1e293b"
      roughness={0.7}
      metalness={0.3}
    />
  );

  return (
    <group>
      <mesh position={[-11, 2.5, 0]}>
        <boxGeometry args={[0.5, 5, 40]} />
        {wallMaterial}
      </mesh>
      <mesh position={[11, 2.5, 0]}>
        <boxGeometry args={[0.5, 5, 40]} />
        {wallMaterial}
      </mesh>
      <mesh position={[0, 2.5, 20]}>
        <boxGeometry args={[22, 5, 0.5]} />
        {wallMaterial}
      </mesh>
      <mesh position={[0, 2.5, -20]}>
        <boxGeometry args={[22, 5, 0.5]} />
        {wallMaterial}
      </mesh>
    </group>
  );
}

function Ceiling() {
  return (
    <group>
      <mesh position={[0, 5, 0]}>
        <boxGeometry args={[22, 0.3, 40]} />
        <meshStandardMaterial
          color="#0f172a"
          roughness={0.9}
          metalness={0.1}
        />
      </mesh>

      {[[-5, 5, 5], [5, 5, 5], [-5, 5, -5], [5, 5, -5]].map((pos, i) => (
        <mesh key={i} position={pos as [number, number, number]}>
          <cylinderGeometry args={[0.3, 0.4, 0.1, 16]} />
          <meshStandardMaterial
            color="#ffffff"
            emissive="#88ccff"
            emissiveIntensity={0.5}
          />
        </mesh>
      ))}

      <mesh position={[0, 5, 15]}>
        <cylinderGeometry args={[0.3, 0.4, 0.1, 16]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#88ccff"
          emissiveIntensity={0.5}
        />
      </mesh>
      <mesh position={[0, 5, -15]}>
        <cylinderGeometry args={[0.3, 0.4, 0.1, 16]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#88ccff"
          emissiveIntensity={0.5}
        />
      </mesh>
    </group>
  );
}

function Columns() {
  const columnMaterial = (
    <meshStandardMaterial
      color="#334155"
      roughness={0.5}
      metalness={0.5}
    />
  );

  const positions = [
    [-8, 2.5, -8], [8, 2.5, -8],
    [-8, 2.5, 8], [8, 2.5, 8],
    [0, 2.5, -8], [0, 2.5, 8],
  ];

  return (
    <group>
      {positions.map((pos, i) => (
        <mesh key={i} position={pos as [number, number, number]}>
          <cylinderGeometry args={[0.4, 0.5, 5, 8]} />
          {columnMaterial}
        </mesh>
      ))}
    </group>
  );
}

function ZoneIndicator() {
  const crowdData = useSimulationStore((state) => state.crowdData);

  const concourseZone = zones.find((z) => z.id === 'concourse_main');
  const concourseData = crowdData.get('concourse_main');
  const capacity = concourseZone?.capacity || 800;
  const count = concourseData?.count || 0;
  const percentage = Math.min((count / capacity) * 100, 150);

  let color = '#00ff88';
  if (percentage > 90) color = '#FFB800';
  if (percentage > 120) color = '#FF3B30';

  return (
    <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[8, 10, 4]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.3}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function InfoSign() {
  const currentTime = useSimulationStore((state) => state.currentTime);
  const crowdData = useSimulationStore((state) => state.crowdData);

  const concourseData = crowdData.get('concourse_main');
  const count = concourseData?.count || 0;

  return (
    <group position={[9.5, 2, 0]}>
      <mesh>
        <boxGeometry args={[0.1, 1.5, 1]} />
        <meshStandardMaterial
          color="#1e293b"
          roughness={0.3}
          metalness={0.7}
        />
      </mesh>
      <mesh position={[0.06, 0.2, 0]}>
        <boxGeometry args={[0.02, 0.8, 0.8]} />
        <meshStandardMaterial
          color="#00D4FF"
          emissive="#00D4FF"
          emissiveIntensity={0.5}
          transparent
          opacity={0.8}
        />
      </mesh>
    </group>
  );
}

function EntranceMarkers() {
  return (
    <group>
      <group position={[0, 0.1, 18]}>
        <mesh>
          <boxGeometry args={[4, 0.05, 2]} />
          <meshStandardMaterial
            color="#00ff88"
            emissive="#00ff88"
            emissiveIntensity={0.3}
          />
        </mesh>
        <mesh position={[0, 0.2, 0]}>
          <coneGeometry args={[0.5, 1, 4]} />
          <meshStandardMaterial
            color="#00ff88"
            emissive="#00ff88"
            emissiveIntensity={0.5}
          />
        </mesh>
      </group>

      <group position={[0, 0.1, -18]}>
        <mesh>
          <boxGeometry args={[4, 0.05, 2]} />
          <meshStandardMaterial
            color="#ff6600"
            emissive="#ff6600"
            emissiveIntensity={0.3}
          />
        </mesh>
        <mesh position={[0, 0.2, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.5, 1, 4]} />
          <meshStandardMaterial
            color="#ff6600"
            emissive="#ff6600"
            emissiveIntensity={0.5}
          />
        </mesh>
      </group>
    </group>
  );
}

export function StationHall() {
  return (
    <group>
      <Floor />
      <Walls />
      <Ceiling />
      <Columns />
      <ZoneIndicator />
      <InfoSign />
      <EntranceMarkers />
    </group>
  );
}
