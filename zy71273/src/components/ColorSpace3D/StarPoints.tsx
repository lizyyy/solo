import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Artwork } from '../../types/artwork';
import { hslTo3DPosition, hslToHex, SPHERE_RADIUS } from '../../utils/hslCalculator';
import { useClusters } from '../../hooks/useClusters';
import { completeMissingFields } from '../../utils/versionManager';

interface StarPointsProps {
  artworks: Artwork[];
  selectedArtworkId: string | null;
  onSelect: (id: string | null) => void;
  clusterMode: 'none' | 'class' | 'color';
}

export function StarPoints({ artworks, selectedArtworkId, onSelect, clusterMode }: StarPointsProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const { clusters, isHighlighted, getArtworkCluster } = useClusters();

  const { positions, colors, sizes, qualityFlags, artworkIds } = useMemo(() => {
    const positions: THREE.Vector3[] = [];
    const colors: number[] = [];
    const sizes: number[] = [];
    const qualityFlags: Array<{ transparentBgRisk: boolean; extremeColorRisk: boolean; missingData: boolean }> = [];
    const artworkIds: string[] = [];

    artworks.forEach(artwork => {
      const complete = completeMissingFields(artwork);
      const pos = hslTo3DPosition(complete.hue!, complete.saturation!, complete.lightness!, SPHERE_RADIUS);
      
      positions.push(pos);
      
      let color: number;
      if (clusterMode === 'class' || clusterMode === 'color') {
        const cluster = getArtworkCluster(artwork.id);
        if (cluster) {
          color = new THREE.Color(cluster.color).getHex();
        } else {
          color = hslToHex(complete.hue!, complete.saturation!, complete.lightness!);
        }
      } else {
        color = hslToHex(complete.hue!, complete.saturation!, complete.lightness!);
      }
      
      colors.push(color);
      sizes.push(0.03 + (complete.score / 100) * 0.05);
      qualityFlags.push({
        transparentBgRisk: artwork.qualityFlags.transparentBgRisk,
        extremeColorRisk: artwork.qualityFlags.extremeColorRisk,
        missingData: artwork.qualityFlags.missingData
      });
      artworkIds.push(artwork.id);
    });

    return { positions, colors, sizes, qualityFlags, artworkIds };
  }, [artworks, clusterMode, getArtworkCluster]);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorObj = useMemo(() => new THREE.Color(), []);

  useFrame((state) => {
    if (!meshRef.current) return;

    const time = state.clock.getElapsedTime();

    positions.forEach((pos, i) => {
      const artworkId = artworkIds[i];
      const isSelected = artworkId === selectedArtworkId;
      const isHovered = artworkId === hoveredId;
      const isClusterHighlighted = isHighlighted(artworkId);
      const flags = qualityFlags[i];
      
      let scale = sizes[i];
      if (isSelected) scale *= 1.8;
      else if (isHovered) scale *= 1.4;
      else if (isClusterHighlighted) scale *= 1.2;

      let pulseScale = 1;
      if (isSelected) {
        pulseScale = 1 + Math.sin(time * 4) * 0.15;
      } else if (flags.extremeColorRisk) {
        pulseScale = 1 + Math.sin(time * 2 + i) * 0.1;
      }

      dummy.position.copy(pos);
      dummy.scale.setScalar(scale * pulseScale);
      dummy.updateMatrix();
      
      meshRef.current!.setMatrixAt(i, dummy.matrix);
      
      colorObj.setHex(colors[i]);
      
      if (flags.missingData) {
        colorObj.setHex(0x9ca3af);
      }
      
      meshRef.current!.setColorAt(i, colorObj);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  });

  const handlePointerMove = (event: { instanceId?: number; stopPropagation?: () => void }) => {
    event.stopPropagation?.();
    const instanceId = event.instanceId;
    if (instanceId !== undefined) {
      setHoveredId(artworkIds[instanceId]);
      document.body.style.cursor = 'pointer';
    }
  };

  const handlePointerOut = () => {
    setHoveredId(null);
    document.body.style.cursor = 'auto';
  };

  const handleClick = (event: { instanceId?: number; stopPropagation?: () => void }) => {
    event.stopPropagation?.();
    const instanceId = event.instanceId;
    if (instanceId !== undefined) {
      const clickedId = artworkIds[instanceId];
      onSelect(clickedId === selectedArtworkId ? null : clickedId);
    }
  };

  return (
    <group>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, positions.length]}
        onPointerMove={handlePointerMove}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
      >
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial 
          transparent 
          opacity={0.9}
          depthWrite={false}
        />
      </instancedMesh>

      {qualityFlags.map((flags, i) => (
        (flags.transparentBgRisk || flags.extremeColorRisk) && (
          <mesh
            key={`outline-${i}`}
            position={positions[i]}
            scale={selectedArtworkId === artworkIds[i] ? 2 : 1.3}
          >
            <ringGeometry args={[sizes[i] * 1.2, sizes[i] * 1.4, 32]} />
            <meshBasicMaterial
              color={flags.transparentBgRisk ? 0xf59e0b : 0x06b6d4}
              transparent
              opacity={0.6}
              side={THREE.DoubleSide}
            />
          </mesh>
        )
      ))}

      {positions.map((pos, i) => (
        qualityFlags[i].missingData && (
          <mesh key={`warning-${i}`} position={pos}>
            <sphereGeometry args={[sizes[i] * 1.8, 8, 8]} />
            <meshBasicMaterial
              color={0xef4444}
              transparent
              opacity={0.15}
            />
          </mesh>
        )
      ))}

      {clusters.map(cluster => (
        <group key={cluster.clusterId}>
          <mesh position={cluster.center}>
            <sphereGeometry args={[0.08, 16, 16]} />
            <meshBasicMaterial 
              color={cluster.color} 
              transparent 
              opacity={0.8}
            />
          </mesh>
          
          {cluster.members.map(memberId => {
            const memberIdx = artworkIds.indexOf(memberId);
            if (memberIdx === -1) return null;
            const memberPos = positions[memberIdx];
            
            const points: THREE.Vector3[] = [];
            const steps = 20;
            for (let j = 0; j <= steps; j++) {
              const t = j / steps;
              points.push(new THREE.Vector3().lerpVectors(
                cluster.center,
                memberPos,
                t
              ));
            }
            
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            
            return (
              <lineSegments key={`line-${memberId}`} geometry={geometry}>
                <lineBasicMaterial 
                  color={cluster.color} 
                  transparent 
                  opacity={0.15}
                />
              </lineSegments>
            );
          })}
        </group>
      ))}
    </group>
  );
}
