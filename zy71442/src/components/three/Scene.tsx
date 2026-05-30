import { useRef, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, Effects } from '@react-three/drei';
import { EffectComposer, FXAA, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { SurfaceMesh } from './SurfaceMesh';
import { NormalVectors } from './NormalVectors';
import { BoundaryCurve } from './BoundaryCurve';
import { SamplePoints } from './SamplePoints';
import { ProjectionPlane } from './ProjectionPlane';
import { ParameterSlice } from './ParameterSlice';
import { useSurfaceStore } from '../../stores/useSurfaceStore';
import { useViewStore } from '../../stores/useViewStore';
import { useDiagnosisStore } from '../../stores/useDiagnosisStore';
import { useFilterStore } from '../../stores/useFilterStore';

interface CameraControllerProps {
  onCameraChange?: (position: THREE.Vector3, target: THREE.Vector3) => void;
}

function CameraController({ onCameraChange }: CameraControllerProps) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const { setCameraPosition, setCameraTarget } = useViewStore();

  useEffect(() => {
    if (controlsRef.current && onCameraChange) {
      controlsRef.current.addEventListener('change', () => {
        const target = controlsRef.current.target;
        setCameraPosition({ x: camera.position.x, y: camera.position.y, z: camera.position.z });
        setCameraTarget({ x: target.x, y: target.y, z: target.z });
        onCameraChange(camera.position, target);
      });
    }
  }, [camera, onCameraChange, setCameraPosition, setCameraTarget]);

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.05}
      minDistance={1}
      maxDistance={20}
      makeDefault
    />
  );
}

function SceneContent() {
  const { vertices, normals, uvs, boundaryPoints, samplePoints, isLoaded } = useSurfaceStore();
  const {
    normalLength,
    normalDensity,
    projectionPlane,
    showProjection,
  } = useViewStore();
  const { issues } = useDiagnosisStore();

  const resolution = Math.sqrt(vertices.length) | 0;

  const reversedNormalIndices = new Set(
    issues
      .filter((i) => i.type === 'normal_reversed' && !i.resolved)
      .flatMap((i) => i.location.vertexIndices || [])
  );

  const boundaryGaps = issues
    .filter((i) => i.type === 'boundary_gap' && !i.resolved)
    .map((i) => ({
      start: Math.floor((i.location.parameterRange?.[0] || 0) * boundaryPoints.length),
      end: Math.floor((i.location.parameterRange?.[1] || 0) * boundaryPoints.length),
    }));

  const sparseSampleIndices = new Set(
    issues
      .filter((i) => i.type === 'sample_sparse' && !i.resolved)
      .map((_, idx) => idx % samplePoints.length)
  );

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[5, 8, 5]}
        intensity={0.8}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-3, 4, -3]} intensity={0.3} />
      <pointLight position={[0, 5, 0]} intensity={0.2} color="#22d3ee" />

      <SurfaceMesh
        vertices={vertices}
        normals={normals}
        uvs={uvs}
        resolution={resolution}
        reversedNormalIndices={reversedNormalIndices}
      />

      <NormalVectors
        vertices={vertices}
        normals={normals}
        length={normalLength}
        density={normalDensity}
        reversedIndices={reversedNormalIndices}
      />

      <BoundaryCurve points={boundaryPoints} gapIndices={boundaryGaps} />

      <SamplePoints points={samplePoints} sparseIndices={sparseSampleIndices} />

      {showProjection && (
        <ProjectionPlane surfacePoints={vertices} plane={projectionPlane} />
      )}

      <ParameterSlice vertices={vertices} resolution={resolution} />

      <Grid
        args={[10, 10]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#1e293b"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#334155"
        fadeDistance={30}
        fadeStrength={1}
        followCamera={false}
        infiniteGrid
      />

      <Effects>
        <EffectComposer enableNormalPass={false}>
          <FXAA />
          <Bloom
            intensity={0.3}
            luminanceThreshold={0.8}
            luminanceSmoothing={0.9}
            mipmapBlur
          />
        </EffectComposer>
      </Effects>
    </>
  );
}

interface SceneProps {
  className?: string;
}

export function Scene({ className }: SceneProps) {
  return (
    <Canvas
      className={className}
      camera={{ position: [3, 3, 3], fov: 50 }}
      gl={{ antialias: true, alpha: false }}
      dpr={[1, 2]}
      shadows
    >
      <color attach="background" args={['#0f172a']} />
      <fog attach="fog" args={['#0f172a', 8, 25]} />
      <CameraController />
      <SceneContent />
    </Canvas>
  );
}
