import { useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { SlicePlane } from './SlicePlane';
import { useAppStore } from '@/store/useAppStore';
import { Slice, Annotation } from '@/types';

interface SliceStackProps {
  slices: Slice[];
  annotations: Annotation[];
  sliceSpacing: number;
  windowWidth: number;
  windowCenter: number;
}

const SliceStack = ({
  slices,
  annotations,
  sliceSpacing,
  windowWidth,
  windowCenter,
}: SliceStackProps) => {
  const groupRef = useRef<THREE.Group>(null);
  const {
    rotation,
    setRotation,
    selectSlice,
    highlightSlice,
    selectedSliceId,
    filterErrorsOnly,
    filterAnnotatedOnly,
  } = useAppStore();

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.x = rotation.x;
      groupRef.current.rotation.y = rotation.y;
      groupRef.current.rotation.z = rotation.z;
    }
  });

  const filteredSlices = useMemo(() => {
    return slices.filter((slice) => {
      if (filterErrorsOnly && !slice.hasError) return false;
      if (filterAnnotatedOnly && !annotations.some((a) => a.sliceId === slice.id))
        return false;
      return true;
    });
  }, [slices, annotations, filterErrorsOnly, filterAnnotatedOnly]);

  const totalHeight = (filteredSlices.length - 1) * sliceSpacing;

  return (
    <group ref={groupRef}>
      {filteredSlices.map((slice, index) => {
        const zPos = index * sliceSpacing - totalHeight / 2;
        return (
          <SlicePlane
            key={slice.id}
            slice={slice}
            position={[0, 0, zPos]}
            isSelected={slice.id === selectedSliceId}
            annotations={annotations}
            windowWidth={windowWidth}
            windowCenter={windowCenter}
            onClick={() => selectSlice(slice.id)}
            onPointerOver={() => highlightSlice(slice.id, true)}
            onPointerOut={() => highlightSlice(slice.id, false)}
          />
        );
      })}
    </group>
  );
};

const CameraController = () => {
  const { camera } = useThree();

  useFrame(() => {
    camera.updateProjectionMatrix();
  });

  return null;
};

interface SliceStack3DProps {
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
}

export const SliceStack3D = ({ onCanvasReady }: SliceStack3DProps) => {
  const {
    slices,
    annotations,
    sliceSpacing,
    currentWindowWidth,
    currentWindowCenter,
  } = useAppStore();

  return (
    <Canvas
      camera={{ position: [0, 0, 5], fov: 50 }}
      gl={{ preserveDrawingBuffer: true, antialias: true }}
      onCreated={({ gl }) => {
        if (onCanvasReady) {
          onCanvasReady(gl.domElement);
        }
      }}
    >
      <color attach="background" args={['#0a0f1a']} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} />
      <fog attach="fog" args={['#0a0f1a', 8, 15]} />

      <SliceStack
        slices={slices}
        annotations={annotations}
        sliceSpacing={sliceSpacing}
        windowWidth={currentWindowWidth}
        windowCenter={currentWindowCenter}
      />

      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        minDistance={2}
        maxDistance={12}
      />

      <CameraController />
    </Canvas>
  );
};
