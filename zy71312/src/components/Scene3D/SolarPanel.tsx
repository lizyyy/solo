import React, { useMemo } from 'react';

interface SolarPanelProps {
  tiltAngle: number;
  count?: number;
  panelWidth?: number;
  panelHeight?: number;
  roofWidth?: number;
  roofDepth?: number;
  showLabels?: boolean;
}

export const SolarPanel: React.FC<SolarPanelProps> = ({
  tiltAngle,
  count = 20,
  panelWidth = 1.2,
  panelHeight = 2,
  roofWidth = 10,
  roofDepth = 8,
  showLabels = true,
}) => {
  const angleRad = (tiltAngle * Math.PI) / 180;

  const panels = useMemo(() => {
    const result: { position: [number, number, number]; rotation: [number, number, number] }[] = [];
    const cols = Math.min(6, Math.floor((roofWidth - 1) / (panelWidth + 0.3)));
    const rows = Math.ceil(count / cols);

    const actualCols = Math.min(cols, count);
    const actualRows = Math.min(rows, Math.ceil(count / actualCols));
    const totalWidth = actualCols * (panelWidth + 0.3) - 0.3;
    const startX = -totalWidth / 2 + panelWidth / 2;

    const panelDepth = panelHeight * Math.cos(angleRad);
    const totalDepth = actualRows * (panelDepth + 0.3) - 0.3;
    const startZ = -totalDepth / 2 + panelDepth / 2;

    let panelIndex = 0;
    for (let row = 0; row < actualRows && panelIndex < count; row++) {
      for (let col = 0; col < actualCols && panelIndex < count; col++) {
        const x = startX + col * (panelWidth + 0.3);
        const z = startZ + row * (panelDepth + 0.3);
        const y = (panelHeight / 2) * Math.sin(angleRad) + 0.2;

        result.push({
          position: [x, y, z],
          rotation: [angleRad, 0, 0],
        });
        panelIndex++;
      }
    }

    return result;
  }, [count, panelWidth, panelHeight, roofWidth, roofDepth, angleRad]);

  return (
    <group>
      {panels.map((panel, index) => (
        <group key={index} position={panel.position} rotation={panel.rotation}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[panelWidth, 0.05, panelHeight]} />
            <meshStandardMaterial
              color="#1a365d"
              metalness={0.4}
              roughness={0.3}
            />
          </mesh>

          <mesh position={[0, 0.026, 0]}>
            <boxGeometry args={[panelWidth - 0.05, 0.005, panelHeight - 0.05]} />
            <meshStandardMaterial
              color="#2563eb"
              metalness={0.8}
              roughness={0.2}
            />
          </mesh>

          {showLabels && index === 0 && (
            <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[panelWidth * 0.8, 0.3]} />
              <meshBasicMaterial color="white" transparent opacity={0.9} />
            </mesh>
          )}
        </group>
      ))}

      <mesh position={[0, 0.1, roofDepth / 2 + 0.5]}>
        <planeGeometry args={[3, 0.5]} />
        <meshBasicMaterial color="#ffb300" transparent opacity={0.9} side={2} />
      </mesh>
    </group>
  );
};
