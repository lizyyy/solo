import React, { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text, Line } from '@react-three/drei';
import * as THREE from 'three';

interface ContainerBox {
  id: string;
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  coordType: string;
  needsReview: boolean;
  recordId: string;
}

interface Props {
  containers: ContainerBox[];
  onClickContainer: (id: string) => void;
}

function Box({ container, onClick }: { container: ContainerBox; onClick: () => void }) {
  let edgeColor = '#3b82f6';
  let labelColor = '#333';
  if (container.needsReview) {
    edgeColor = '#fbbf24';
    labelColor = '#d97706';
  } else if (container.coordType === 'latlng_with_distance') {
    edgeColor = '#16a34a';
  } else if (container.coordType === 'metric') {
    edgeColor = '#06b6d4';
  }
  const geo = useMemo(() => new THREE.BoxGeometry(...container.size), [container.size]);

  return (
    <group position={container.position}>
      <mesh onClick={onClick} geometry={geo}>
        <meshStandardMaterial color={container.color} transparent opacity={0.7} />
      </mesh>
      <lineSegments geometry={new THREE.EdgesGeometry(geo)}>
        <lineBasicMaterial color={edgeColor} />
      </lineSegments>
      {container.needsReview && (
        <Text position={[0, container.size[1] / 2 + 0.3, 0]} fontSize={0.3} color="#fbbf24">
          !
        </Text>
      )}
      <Text position={[0, -container.size[1] / 2 - 0.3, 0]} fontSize={0.15} color="#333">
        {container.coordType === 'mixed' ? 'MIXED' : container.id.slice(0, 6)}
      </Text>
    </group>
  );
}

function GridFloor() {
  const lines = [];
  for (let i = -10; i <= 10; i++) {
    lines.push(
      <Line key={`h${i}`} points={[[-10, 0, i], [10, 0, i]]} color="#d1d5db" lineWidth={0.5} />,
      <Line key={`v${i}`} points={[[i, 0, -10], [i, 0, 10]]} color="#d1d5db" lineWidth={0.5} />
    );
  }
  return <>{lines}</>;
}

export default function View3D({ containers, onClickContainer }: Props) {
  return (
    <div style={{ background: '#fff', borderRadius: 8, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
      <h3 style={{ marginBottom: 12, fontSize: 16, color: '#1a1a2e' }}>3D 堆场回放</h3>
      <div style={{ height: 400, borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
        <Canvas camera={{ position: [15, 12, 15], fov: 50 }}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[10, 20, 10]} intensity={0.8} />
          <GridFloor />
          {containers.map((c) => (
            <Box key={c.id} container={c} onClick={() => onClickContainer(c.recordId)} />
          ))}
          <OrbitControls />
        </Canvas>
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
        点击箱体可溯源到测距仪记录和障碍物备注；黄色边框 = 坐标混用待复核
      </div>
    </div>
  );
}
