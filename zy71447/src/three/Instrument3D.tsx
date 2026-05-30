import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { InstrumentModel, ResonanceCavity, SectionParams, BandType, Hotspot, FrequencySample } from '@/types';
import { BAND_CONFIGS } from '@/types';

interface Instrument3DProps {
  instrument: InstrumentModel;
  cavities: ResonanceCavity[];
  hotspots: Hotspot[];
  samples: FrequencySample[];
  sectionParams: SectionParams;
  currentBand: BandType;
  selectedHotspotId: string | null;
  onHotspotClick: (id: string) => void;
  showHeatmap: boolean;
}

export function Instrument3D({
  instrument,
  cavities,
  hotspots,
  samples,
  sectionParams,
  currentBand,
  selectedHotspotId,
  onHotspotClick,
  showHeatmap,
}: Instrument3DProps) {
  const groupRef = useRef<THREE.Group>(null);
  const clipPlaneRef = useRef<THREE.Plane>(new THREE.Plane());

  useEffect(() => {
    const plane = clipPlaneRef.current;
    switch (sectionParams.axis) {
      case 'x':
        plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(1, 0, 0), new THREE.Vector3(sectionParams.position, 0, 0));
        break;
      case 'y':
        plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, sectionParams.position, 0));
        break;
      case 'z':
        plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, sectionParams.position));
        break;
    }
  }, [sectionParams.axis, sectionParams.position]);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.1) * 0.05;
    }
  });

  const bodyGeometry = useMemo(() => {
    const { width, height, depth } = instrument.dimensions;

    if (instrument.name === '古琴') {
      return new THREE.BoxGeometry(width, height, depth);
    } else if (instrument.name === '琵琶') {
      const points: THREE.Vector2[] = [];
      for (let i = 0; i <= 20; i++) {
        const t = i / 20;
        const z = -depth / 2 + t * depth;
        const r = t < 0.7
          ? width / 2 * (1 - Math.pow((t - 0.7) / 0.7, 2))
          : width / 2 * (1 - (t - 0.7) / 0.3) * 0.3;
        points.push(new THREE.Vector2(r, z));
      }
      return new THREE.LatheGeometry(points, 32);
    } else {
      return new THREE.BoxGeometry(width, height, depth * 0.6);
    }
  }, [instrument]);

  const visibleMaterials = useMemo(() => {
    return instrument.materialGroups.filter((m) => m.visible);
  }, [instrument.materialGroups]);

  const bandConfig = useMemo(() => {
    return BAND_CONFIGS.find((b) => b.key === currentBand)!;
  }, [currentBand]);

  const heatmapData = useMemo(() => {
    if (!showHeatmap) return [];
    return samples.filter((s) => s.band === currentBand);
  }, [samples, currentBand, showHeatmap]);

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      <mesh geometry={bodyGeometry} castShadow receiveShadow>
        <meshStandardMaterial
          color={visibleMaterials[0]?.color || '#8B4513'}
          metalness={0.1}
          roughness={0.7}
          clippingPlanes={sectionParams.showInternal ? [clipPlaneRef.current] : []}
          clipShadows={true}
          transparent
          opacity={visibleMaterials[0]?.opacity ?? 1}
        />
      </mesh>

      {sectionParams.showInternal && (
        <mesh geometry={bodyGeometry}>
          <meshBasicMaterial
            color="#B8860B"
            side={THREE.DoubleSide}
            transparent
            opacity={0.2}
            clippingPlanes={[clipPlaneRef.current]}
          />
        </mesh>
      )}

      {cavities.map((cavity) => (
        <mesh key={cavity.id} position={[0, 0, 0]}>
          <boxGeometry
            args={[
              cavity.boundary[1].x - cavity.boundary[0].x,
              cavity.boundary[2].y - cavity.boundary[0].y,
              cavity.boundary[4].z - cavity.boundary[0].z,
            ]}
          />
          <meshStandardMaterial
            color={cavity.color}
            transparent
            opacity={0.4}
            side={THREE.DoubleSide}
            clippingPlanes={sectionParams.showInternal ? [clipPlaneRef.current] : []}
          />
        </mesh>
      ))}

      {heatmapData.map((sample, idx) => (
        <mesh
          key={`heat-${idx}`}
          position={[sample.position.x, sample.position.y, sample.position.z]}
        >
          <sphereGeometry args={[0.008 + sample.responseIntensity / 2000, 16, 16]} />
          <meshBasicMaterial
            color={bandConfig.color}
            transparent
            opacity={0.3 + (sample.responseIntensity / 100) * 0.5}
          />
        </mesh>
      ))}

      {hotspots.map((hotspot) => (
        <group
          key={hotspot.id}
          position={[hotspot.position.x, hotspot.position.y, hotspot.position.z]}
          onClick={(e) => {
            e.stopPropagation();
            onHotspotClick(hotspot.id);
          }}
        >
          <mesh>
            <sphereGeometry args={[selectedHotspotId === hotspot.id ? 0.015 : 0.01, 16, 16]} />
            <meshBasicMaterial
              color={selectedHotspotId === hotspot.id ? '#B8860B' : '#DAA520'}
            />
          </mesh>
          {selectedHotspotId === hotspot.id && (
            <mesh>
              <ringGeometry args={[0.018, 0.022, 32]} />
              <meshBasicMaterial color="#B8860B" transparent opacity={0.6} side={THREE.DoubleSide} />
            </mesh>
          )}
        </group>
      ))}

      <mesh position={[0, -instrument.dimensions.height / 2 - 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[Math.max(instrument.dimensions.width, instrument.dimensions.depth) / 2 + 0.05, 64]} />
        <shadowMaterial opacity={0.3} />
      </mesh>
    </group>
  );
}
