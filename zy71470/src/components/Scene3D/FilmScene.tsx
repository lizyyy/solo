import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { EffectComposer, Bloom, ChromaticAberration } from '@react-three/postprocessing';
import * as THREE from 'three';
import type { FilmParams, RGB } from '@/types';
import { toRadians } from '@/utils/unitConversion';
import { rgbToHex } from '@/utils/interferenceEngine';

interface FilmSceneProps {
  params: FilmParams;
  reflectedColor: RGB;
}

const SUBSTRATE_SIZE = 4;
const SUBSTRATE_THICKNESS = 0.8;
const FILM_WIDTH = 3.5;

const Substrate = ({ substrateN }: { substrateN: number }) => {
  const opacity = Math.min(0.7, 1 / substrateN);
  
  return (
    <mesh position={[0, -SUBSTRATE_THICKNESS / 2 - 0.1, 0]} receiveShadow>
      <boxGeometry args={[SUBSTRATE_SIZE, SUBSTRATE_THICKNESS, SUBSTRATE_SIZE]} />
      <meshPhysicalMaterial
        color="#aaddff"
        transparent
        opacity={opacity}
        roughness={0.1}
        metalness={0.1}
        transmission={0.9}
        thickness={0.5}
        ior={substrateN}
      />
    </mesh>
  );
};

const FilmLayer = ({
  thickness,
  refractiveIndex,
  reflectedColor,
}: {
  thickness: number;
  refractiveIndex: number;
  reflectedColor: RGB;
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  const filmThickness = useMemo(() => {
    const minVis = 0.02;
    const maxVis = 0.6;
    const normalized = Math.min(thickness / 2000, 1);
    return minVis + normalized * (maxVis - minVis);
  }, [thickness]);

  const colorHex = useMemo(() => rgbToHex(reflectedColor), [reflectedColor]);
  const opacity = Math.min(0.8, 1 / refractiveIndex);

  useFrame((state) => {
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.MeshPhysicalMaterial;
      const pulse = 0.02 * Math.sin(state.clock.elapsedTime * 2);
      material.emissiveIntensity = 0.3 + pulse;
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={[0, filmThickness / 2 + SUBSTRATE_THICKNESS / 2 + 0.05, 0]}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[FILM_WIDTH, filmThickness, FILM_WIDTH]} />
      <meshPhysicalMaterial
        color={colorHex}
        emissive={colorHex}
        emissiveIntensity={0.3}
        transparent
        opacity={opacity}
        roughness={0.05}
        metalness={0.05}
        transmission={0.85}
        thickness={0.1}
        ior={refractiveIndex}
        clearcoat={1}
        clearcoatRoughness={0.1}
      />
    </mesh>
  );
};

const LightRays = ({
  incidentAngle,
  angleUnit,
  refractiveIndex,
  reflectedColor,
}: {
  incidentAngle: number;
  angleUnit: 'degree' | 'radian';
  refractiveIndex: number;
  reflectedColor: RGB;
}) => {
  const incidentRef = useRef<THREE.Line>(null as unknown as THREE.Line);
  const reflectedRef = useRef<THREE.Line>(null as unknown as THREE.Line);
  const refractedRef = useRef<THREE.Line>(null as unknown as THREE.Line);

  const theta1 = toRadians(incidentAngle, angleUnit);
  const sinTheta2 = (1.0 / refractiveIndex) * Math.sin(theta1);
  const theta2 = Math.abs(sinTheta2) > 1 ? Math.PI / 2 : Math.asin(sinTheta2);

  const rayLength = 4;
  const startY = 4;
  const filmY = 0.5;

  const incidentPoints = useMemo(() => {
    const points: [number, number, number][] = [];
    const startX = -rayLength * Math.sin(theta1);
    const startZ = rayLength * Math.cos(theta1) * 0.3;
    
    for (let t = 0; t <= 1; t += 0.02) {
      points.push([
        startX * (1 - t),
        startY * (1 - t) + filmY * t,
        startZ * (1 - t),
      ]);
    }
    return points;
  }, [theta1]);

  const reflectedPoints = useMemo(() => {
    const points: [number, number, number][] = [];
    const reflectAngle = theta1;
    const endX = rayLength * Math.sin(reflectAngle);
    const endZ = rayLength * Math.cos(reflectAngle) * 0.3;
    
    for (let t = 0; t <= 1; t += 0.02) {
      points.push([
        endX * t,
        filmY + (startY - filmY) * t,
        endZ * t,
      ]);
    }
    return points;
  }, [theta1]);

  const refractedPoints = useMemo(() => {
    if (Math.abs(sinTheta2) > 1) return [];
    
    const points: [number, number, number][] = [];
    const endX = rayLength * 0.5 * Math.sin(theta2);
    const endY = filmY - rayLength * 0.5 * Math.cos(theta2);
    const endZ = rayLength * 0.5 * Math.cos(theta2) * 0.2;
    
    for (let t = 0; t <= 1; t += 0.02) {
      points.push([
        endX * t,
        filmY + (endY - filmY) * t,
        endZ * t,
      ]);
    }
    return points;
  }, [theta2, sinTheta2]);

  const colorHex = useMemo(() => rgbToHex(reflectedColor), [reflectedColor]);

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    
    if (incidentRef.current) {
      const material = incidentRef.current.material as THREE.LineBasicMaterial;
      material.opacity = 0.6 + 0.4 * Math.sin(time * 3);
    }
    if (reflectedRef.current) {
      const material = reflectedRef.current.material as THREE.LineBasicMaterial;
      material.opacity = 0.7 + 0.3 * Math.sin(time * 3 + 1);
    }
    if (refractedRef.current) {
      const material = refractedRef.current.material as THREE.LineBasicMaterial;
      material.opacity = 0.5 + 0.3 * Math.sin(time * 3 + 2);
    }
  });

  const incidentGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setFromPoints(incidentPoints.map(p => new THREE.Vector3(...p)));
    return geo;
  }, [incidentPoints]);

  const reflectedGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setFromPoints(reflectedPoints.map(p => new THREE.Vector3(...p)));
    return geo;
  }, [reflectedPoints]);

  const refractedGeometry = useMemo(() => {
    if (refractedPoints.length === 0) return null;
    const geo = new THREE.BufferGeometry();
    geo.setFromPoints(refractedPoints.map(p => new THREE.Vector3(...p)));
    return geo;
  }, [refractedPoints]);

  return (
    <group>
      {React.createElement('line' as any, { ref: incidentRef, geometry: incidentGeometry },
        React.createElement('lineBasicMaterial' as any, { color: '#ffffff', transparent: true, opacity: 0.8, linewidth: 2 })
      )}
      
      {React.createElement('line' as any, { ref: reflectedRef, geometry: reflectedGeometry },
        React.createElement('lineBasicMaterial' as any, { color: colorHex, transparent: true, opacity: 0.9, linewidth: 3 })
      )}
      
      {refractedGeometry && React.createElement('line' as any, { ref: refractedRef, geometry: refractedGeometry },
        React.createElement('lineBasicMaterial' as any, { color: '#88ccff', transparent: true, opacity: 0.6, linewidth: 1.5 })
      )}

      <mesh position={[0, filmY, 0]}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshBasicMaterial color={colorHex} />
      </mesh>
    </group>
  );
};

const SceneContent = ({ params, reflectedColor }: FilmSceneProps) => {
  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[5, 5, 5]} intensity={1} color="#e6f0ff" />
      <pointLight position={[-5, 3, -5]} intensity={0.5} color="#6699ff" />
      <pointLight position={[0, -3, 0]} intensity={0.3} color="#99ccff" />
      
      <Stars radius={50} depth={50} count={2000} factor={4} saturation={0} fade speed={0.5} />
      
      <Substrate substrateN={params.substrateN} />
      <FilmLayer
        thickness={params.thickness}
        refractiveIndex={params.refractiveIndex}
        reflectedColor={reflectedColor}
      />
      <LightRays
        incidentAngle={params.incidentAngle}
        angleUnit={params.angleUnit}
        refractiveIndex={params.refractiveIndex}
        reflectedColor={reflectedColor}
      />
      
      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={3}
        maxDistance={15}
        maxPolarAngle={Math.PI / 2 + 0.2}
      />
      
      <EffectComposer>
        <Bloom
          luminanceThreshold={0.2}
          luminanceSmoothing={0.9}
          height={300}
          intensity={1.5}
        />
        <ChromaticAberration 
          offset={new THREE.Vector2(0.001, 0.001)} 
          radialModulation={false}
          modulationOffset={0}
        />
      </EffectComposer>
    </>
  );
};

export const FilmScene = ({ params, reflectedColor }: FilmSceneProps) => {
  return (
    <div className="w-full h-full">
      <Canvas
        camera={{ position: [4, 3, 6], fov: 50 }}
        gl={{ antialias: true, alpha: false }}
        style={{ background: 'linear-gradient(to bottom, #0A1929, #1a2a4a)' }}
      >
        <fog attach="fog" args={['#0A1929', 8, 25]} />
        <SceneContent params={params} reflectedColor={reflectedColor} />
      </Canvas>
    </div>
  );
};
