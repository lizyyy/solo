import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { InstancedMesh, Mesh, Object3D } from 'three';
import { Cube3D } from '../../types/data';
import { COLORS, hexToRgb } from '../../utils/colorMapping';

interface CubeMeshProps {
  cubes: Cube3D[];
  visibleLevels: number[];
  showBids: boolean;
  showAsks: boolean;
  showAnomalies: boolean;
  currentTimeIndex: number;
  windowSize: number;
  onCubeClick: (cube: Cube3D) => void;
  onCubeHover: (cube: Cube3D | null) => void;
}

export function CubeMesh({
  cubes,
  visibleLevels,
  showBids,
  showAsks,
  showAnomalies,
  currentTimeIndex,
  windowSize,
  onCubeClick,
  onCubeHover,
}: CubeMeshProps) {
  const meshRef = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);

  const visibleCubes = useMemo(() => {
    return cubes.filter(cube => {
      if (!visibleLevels.includes(cube.level)) return false;
      if (cube.isBid && !showBids) return false;
      if (!cube.isBid && !showAsks) return false;
      if (cube.isAnomaly && !showAnomalies) return false;
      
      const timeIdx = Math.floor((cube.y + 5) / (10 / Math.max(cubes.length / 20, 1)));
      if (timeIdx < currentTimeIndex - windowSize || timeIdx > currentTimeIndex + windowSize) {
        return false;
      }
      
      return true;
    });
  }, [cubes, visibleLevels, showBids, showAsks, showAnomalies, currentTimeIndex, windowSize]);

  useFrame((state, delta) => {
    if (!meshRef.current) return;

    const time = state.clock.elapsedTime;

    visibleCubes.forEach((cube, i) => {
      dummy.position.set(cube.x, cube.y, cube.z);
      dummy.scale.set(cube.width, cube.height, cube.depth);

      let opacity = cube.opacity;
      let color = cube.color;

      if (cube.isSelected) {
        const pulse = 1 + Math.sin(time * 4) * 0.1;
        dummy.scale.multiplyScalar(pulse);
        color = COLORS.selection.base;
        opacity = 1;
      } else if (cube.isAnomaly) {
        const pulse = 1 + Math.sin(time * 3 + i * 0.5) * 0.15;
        dummy.scale.multiplyScalar(pulse);
        opacity = 0.8 + Math.sin(time * 2 + i * 0.3) * 0.2;
      }

      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);

      const rgb = hexToRgb(color);
      meshRef.current!.setColorAt(i, { r: rgb.r, g: rgb.g, b: rgb.b, isColor: true } as any);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  });

  if (visibleCubes.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, visibleCubes.length]}
      onClick={(e) => {
        e.stopPropagation();
        const instanceId = e.instanceId;
        if (instanceId !== undefined && instanceId < visibleCubes.length) {
          onCubeClick(visibleCubes[instanceId]);
        }
      }}
      onPointerMove={(e) => {
        e.stopPropagation();
        const instanceId = e.instanceId;
        if (instanceId !== undefined && instanceId < visibleCubes.length) {
          onCubeHover(visibleCubes[instanceId]);
        }
      }}
      onPointerOut={() => onCubeHover(null)}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        transparent
        opacity={0.8}
        roughness={0.3}
        metalness={0.1}
        vertexColors
      />
    </instancedMesh>
  );
}
