import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useThermalStore } from '@/store/useThermalStore';
import { useView3DStore } from '@/store/useView3DStore';
import { getTemperatureColor, hexToRgb } from '@/utils/colorMapping';

export const ChipPackageMesh = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  const chipPackage = useThermalStore((state) => state.chipPackage);
  const filterConditions = useThermalStore((state) => state.filterConditions);
  const { colorScale, showHeatMap } = useView3DStore();

  const material = useMemo(() => {
    if (!showHeatMap) {
      return new THREE.MeshStandardMaterial({
        color: '#4a5568',
        metalness: 0.3,
        roughness: 0.7,
        transparent: true,
        opacity: 0.9
      });
    }
    
    return new THREE.MeshStandardMaterial({
      color: '#718096',
      metalness: 0.2,
      roughness: 0.8,
      transparent: true,
      opacity: 0.95
    });
  }, [showHeatMap]);

  useFrame(() => {
    if (meshRef.current) {
    }
  });

  const powerPoints = useMemo(() => {
    return chipPackage.powerPoints.filter(pp => {
      const tempInRange = pp.temperature >= filterConditions.tempRange[0] && 
                         pp.temperature <= filterConditions.tempRange[1];
      const powerInRange = pp.power >= filterConditions.powerRange[0] && 
                          pp.power <= filterConditions.powerRange[1];
      const isAnomaly = pp.status !== 'normal';
      const anomalyFilter = !filterConditions.showOnlyAnomalies || isAnomaly;
      return tempInRange && powerInRange && anomalyFilter;
    });
  }, [chipPackage.powerPoints, filterConditions]);

  const heatSpots = useMemo(() => {
    return powerPoints.map(pp => {
      const color = getTemperatureColor(pp.temperature, colorScale.min, colorScale.max);
      const rgb = hexToRgb(color);
      return {
        position: pp.position,
        color: rgb,
        intensity: pp.temperature / colorScale.max
      };
    });
  }, [powerPoints, colorScale]);

  return (
    <group>
      <mesh ref={meshRef} position={[0, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[
          chipPackage.dimensions.width,
          chipPackage.dimensions.height,
          chipPackage.dimensions.depth
        ]} />
        <primitive object={material} attach="material" />
      </mesh>

      {showHeatMap && heatSpots.map((spot, i) => (
        <mesh key={i} position={[spot.position.x, spot.position.y + 0.01, spot.position.z]}>
          <circleGeometry args={[0.3 * spot.intensity + 0.15, 32]} />
          <meshBasicMaterial 
            color={new THREE.Color(spot.color.r, spot.color.g, spot.color.b)}
            transparent
            opacity={0.8}
          />
        </mesh>
      ))}

      {showHeatMap && powerPoints.map((pp, i) => (
        <mesh key={`cylinder-${i}`} position={[pp.position.x, pp.position.y + 0.1, pp.position.z]}>
          <cylinderGeometry args={[0.1, 0.1, 0.2, 16]} />
          <meshStandardMaterial 
            color={getTemperatureColor(pp.temperature, colorScale.min, colorScale.max)}
            emissive={getTemperatureColor(pp.temperature, colorScale.min, colorScale.max)}
            emissiveIntensity={0.3}
            metalness={0.5}
            roughness={0.3}
          />
        </mesh>
      ))}
    </group>
  );
};
