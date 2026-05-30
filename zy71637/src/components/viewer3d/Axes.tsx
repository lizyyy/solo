import { useMemo } from 'react';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { COLORS } from '../../utils/colorMapping';
import { DataRange } from '../../types/data';

interface AxesProps {
  dataRange: DataRange;
  showLabels: boolean;
}

export function Axes({ dataRange, showLabels }: AxesProps) {
  const axisLength = 12;
  const tickCount = 5;

  const xTicks = useMemo(() => {
    const ticks = [];
    for (let i = 0; i <= tickCount; i++) {
      const ratio = i / tickCount;
      const value = dataRange.minPrice + ratio * (dataRange.maxPrice - dataRange.minPrice);
      const pos = -6 + ratio * axisLength;
      ticks.push({ value, pos });
    }
    return ticks;
  }, [dataRange.minPrice, dataRange.maxPrice]);

  const zTicks = useMemo(() => {
    const ticks = [];
    for (let i = 0; i <= tickCount; i++) {
      const ratio = i / tickCount;
      const value = dataRange.minQuantity + ratio * (dataRange.maxQuantity - dataRange.minQuantity);
      const pos = -6 + ratio * axisLength;
      ticks.push({ value, pos });
    }
    return ticks;
  }, [dataRange.minQuantity, dataRange.maxQuantity]);

  const yTicks = useMemo(() => {
    const ticks = [];
    for (let i = 0; i <= tickCount; i++) {
      const ratio = i / tickCount;
      const value = dataRange.minTime + ratio * (dataRange.maxTime - dataRange.minTime);
      const pos = -6 + ratio * axisLength;
      ticks.push({ value, pos });
    }
    return ticks;
  }, [dataRange.minTime, dataRange.maxTime]);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
  };

  return (
    <group>
      <group name="x-axis">
        <line>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={2}
              array={new Float32Array([-6, -6, -6, 6, -6, -6])}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color={COLORS.neutral.axis} linewidth={2} />
        </line>
        
        {showLabels && xTicks.map((tick, i) => (
          <group key={`x-tick-${i}`} position={[tick.pos, -6.2, -6]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.02, 0.02, 0.3, 8]} />
              <meshBasicMaterial color={COLORS.neutral.axis} />
            </mesh>
            <Text
              position={[0, -0.3, 0]}
              fontSize={0.25}
              color={COLORS.neutral.text}
              anchorX="center"
              anchorY="middle"
            >
              {tick.value.toFixed(1)}
            </Text>
          </group>
        ))}
        
        {showLabels && (
          <Text
            position={[0, -7, -6]}
            fontSize={0.35}
            color={COLORS.bid.base}
            anchorX="center"
            anchorY="middle"
          >
            价格 (Price)
          </Text>
        )}
      </group>

      <group name="y-axis">
        <line>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={2}
              array={new Float32Array([-6, -6, -6, -6, 6, -6])}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color={COLORS.neutral.axis} linewidth={2} />
        </line>
        
        {showLabels && yTicks.map((tick, i) => (
          <group key={`y-tick-${i}`} position={[-6.2, tick.pos, -6]}>
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.02, 0.02, 0.3, 8]} />
              <meshBasicMaterial color={COLORS.neutral.axis} />
            </mesh>
            <Text
              position={[-0.5, 0, 0]}
              fontSize={0.25}
              color={COLORS.neutral.text}
              anchorX="right"
              anchorY="middle"
            >
              {formatTime(tick.value)}
            </Text>
          </group>
        ))}
        
        {showLabels && (
          <Text
            position={[-7, 0, -6]}
            fontSize={0.35}
            color="#9f7aea"
            anchorX="center"
            anchorY="middle"
            rotation={[0, 0, Math.PI / 2]}
          >
            时间 (Time)
          </Text>
        )}
      </group>

      <group name="z-axis">
        <line>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={2}
              array={new Float32Array([-6, -6, -6, -6, -6, 6])}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color={COLORS.neutral.axis} linewidth={2} />
        </line>
        
        {showLabels && zTicks.map((tick, i) => (
          <group key={`z-tick-${i}`} position={[-6, -6.2, tick.pos]}>
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.02, 0.02, 0.3, 8]} />
              <meshBasicMaterial color={COLORS.neutral.axis} />
            </mesh>
            <Text
              position={[-0.3, 0, 0]}
              fontSize={0.25}
              color={COLORS.neutral.text}
              anchorX="right"
              anchorY="middle"
            >
              {Math.round(tick.value)}
            </Text>
          </group>
        ))}
        
        {showLabels && (
          <Text
            position={[-6, -7, 0]}
            fontSize={0.35}
            color={COLORS.ask.base}
            anchorX="center"
            anchorY="middle"
            rotation={[0, -Math.PI / 2, 0]}
          >
            挂单量 (Quantity)
          </Text>
        )}
      </group>
    </group>
  );
}
