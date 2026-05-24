import React, { useState } from 'react';
import { Html } from '@react-three/drei';
import { useSceneStore } from '../../store/useSceneStore';
import { Showcase as ShowcaseType } from '../../data/types';

interface ShowcaseProps {
  showcase: ShowcaseType;
  hasAnomaly?: boolean;
}

const ShowcaseComponent: React.FC<ShowcaseProps> = ({ showcase, hasAnomaly }) => {
  const [hovered, setHovered] = useState(false);
  const selectedShowcase = useSceneStore((state) => state.selectedShowcase);
  const setSelectedShowcase = useSceneStore((state) => state.setSelectedShowcase);
  const selectedShowcases = useSceneStore((state) => state.selectedShowcases);
  const highlightAnomalies = useSceneStore((state) => state.highlightAnomalies);

  const isSelected = selectedShowcase === showcase.id;
  const isFiltered = selectedShowcases.length > 0 && !selectedShowcases.includes(showcase.id);

  const baseColor = hasAnomaly && highlightAnomalies ? '#ff6b35' : '#00d4ff';
  const color = isSelected ? '#ffffff' : hovered ? '#00ffff' : baseColor;
  const opacity = isFiltered ? 0.2 : 1;

  return (
    <group
      position={[showcase.position.x, 0, showcase.position.z]}
      onClick={(e) => {
        e.stopPropagation();
        setSelectedShowcase(isSelected ? null : showcase.id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'auto';
      }}
    >
      <mesh position={[0, showcase.size.height / 2, 0]} castShadow>
        <boxGeometry args={[showcase.size.width, showcase.size.height, showcase.size.depth]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={opacity * 0.7}
          emissive={color}
          emissiveIntensity={isSelected ? 0.5 : hovered ? 0.3 : 0.1}
        />
      </mesh>

      <mesh position={[0, showcase.size.height + 0.05, 0]}>
        <boxGeometry args={[showcase.size.width + 0.1, 0.1, showcase.size.depth + 0.1]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isSelected ? 0.8 : hovered ? 0.5 : 0.2}
        />
      </mesh>

      {(hovered || isSelected) && (
        <Html
          position={[0, showcase.size.height + 0.5, 0]}
          center
          distanceFactor={10}
        >
          <div
            style={{
              background: 'rgba(10, 22, 40, 0.95)',
              border: `1px solid ${color}`,
              borderRadius: '8px',
              padding: '8px 12px',
              color: '#fff',
              fontSize: '12px',
              whiteSpace: 'nowrap',
              boxShadow: `0 0 20px ${color}40`,
            }}
          >
            <div style={{ fontWeight: 'bold', color }}>{showcase.number}</div>
            <div>{showcase.name}</div>
            <div style={{ fontSize: '10px', color: '#888' }}>{showcase.category}</div>
          </div>
        </Html>
      )}

      {hasAnomaly && highlightAnomalies && (
        <mesh position={[0, showcase.size.height + 1, 0]}>
          <sphereGeometry args={[0.15]} />
          <meshBasicMaterial color="#ff6b35" transparent opacity={0.8 + Math.sin(Date.now() / 200) * 0.2} />
        </mesh>
      )}
    </group>
  );
};

const Showcases: React.FC = () => {
  const hallData = useSceneStore((state) => state.hallData);
  const anomalies = useSceneStore((state) => state.anomalies);

  if (!hallData) return null;

  const showcaseIdsWithAnomalies = new Set(
    anomalies.filter((a) => a.showcaseId).map((a) => a.showcaseId)
  );

  return (
    <group>
      {hallData.showcases.map((showcase) => (
        <ShowcaseComponent
          key={showcase.id}
          showcase={showcase}
          hasAnomaly={showcaseIdsWithAnomalies.has(showcase.id)}
        />
      ))}
    </group>
  );
};

export default Showcases;
