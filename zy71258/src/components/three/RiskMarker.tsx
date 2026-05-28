import { useRef, useState } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import * as THREE from 'three';
import type { Risk } from '@/types';
import { RISK_COLORS, SEVERITY_COLORS } from '@/types';
import { useMainStore } from '@/store/mainStore';

interface RiskMarkerProps {
  risk: Risk;
}

export default function RiskMarker({ risk }: RiskMarkerProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const { selectedRiskId, selectRisk, selectArtwork, selectLightSource } = useMainStore();

  const isSelected = selectedRiskId === risk.id;
  const baseColor = RISK_COLORS[risk.type];
  const severityColor = SEVERITY_COLORS[risk.severity];

  const pulseRef = useRef(0);

  useFrame((_, delta) => {
    pulseRef.current += delta * 2;
    if (groupRef.current) {
      const pulse = 1 + Math.sin(pulseRef.current) * 0.15;
      groupRef.current.scale.setScalar(isSelected ? pulse * 1.2 : hovered ? pulse * 1.1 : pulse);
      groupRef.current.position.y = risk.posY + 0.3 + Math.sin(pulseRef.current * 0.5) * 0.05;
    }
  });

  const handleClick = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    selectRisk(risk.id);
    if (risk.artworkId) selectArtwork(risk.artworkId);
    if (risk.lightSourceId) selectLightSource(risk.lightSourceId);
  };

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = 'pointer';
  };

  const handlePointerOut = () => {
    setHovered(false);
    document.body.style.cursor = 'auto';
  };

  const markerSize = risk.severity === 'critical' ? 0.35 : risk.severity === 'high' ? 0.3 : 0.25;

  return (
    <group ref={groupRef} position={[risk.posX, risk.posY + 0.3, risk.posZ]}>
      <Billboard>
        <group onClick={handleClick} onPointerOver={handlePointerOver} onPointerOut={handlePointerOut}>
          <mesh>
            <octahedronGeometry args={[markerSize, 0]} />
            <meshBasicMaterial
              color={baseColor}
              transparent
              opacity={0.85}
              wireframe={isSelected}
            />
          </mesh>

          <mesh>
            <octahedronGeometry args={[markerSize * 0.6, 0]} />
            <meshBasicMaterial color={severityColor} transparent opacity={0.9} />
          </mesh>

          {isSelected && (
            <mesh>
              <octahedronGeometry args={[markerSize * 1.5, 0]} />
              <meshBasicMaterial color={baseColor} transparent opacity={0.2} wireframe />
            </mesh>
          )}

          {hovered && (
            <group position={[0, markerSize + 0.3, 0]}>
              <mesh position={[0, 0, -0.01]}>
                <planeGeometry args={[2.2, 0.5]} />
                <meshBasicMaterial color="#000000" transparent opacity={0.8} />
              </mesh>
              <Text
                fontSize={0.12}
                color="#ffffff"
                anchorX="center"
                anchorY="middle"
                maxWidth={2}
              >
                {risk.description.substring(0, 30)}...
              </Text>
            </group>
          )}
        </group>
      </Billboard>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -risk.posY - 0.28, 0]}>
        <ringGeometry args={[markerSize * 0.8, markerSize, 32]} />
        <meshBasicMaterial color={baseColor} transparent opacity={0.3} />
      </mesh>

      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -risk.posY - 0.28, 0]}>
          <ringGeometry args={[markerSize * 1.2, markerSize * 1.4, 32]} />
          <meshBasicMaterial color={severityColor} transparent opacity={0.5} />
        </mesh>
      )}
    </group>
  );
}
