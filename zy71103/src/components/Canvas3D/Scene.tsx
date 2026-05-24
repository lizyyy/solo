import React, { useEffect, useRef } from 'react';
import { OrbitControls, PerspectiveCamera, TransformControls } from '@react-three/drei';
import { useThree, useFrame } from '@react-three/fiber';
import { useAppStore } from '../../store/useAppStore';
import { OperatingRoom } from './OperatingRoom';
import { InstrumentCart } from './InstrumentCart';
import { SterileZone } from './SterileZone';
import { RecycleBin } from './RecycleBin';
import { Staff } from './Staff';
import { PathLine } from './PathLine';
import { ErrorMarker } from './ErrorMarker';
import type { SceneElement } from '../../types';
import * as THREE from 'three';

interface CameraControllerProps {
  view: 'top' | 'front' | 'side' | 'free';
  roomSize: { width: number; depth: number };
}

const CameraController: React.FC<CameraControllerProps> = ({ view, roomSize }) => {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    const maxDim = Math.max(roomSize.width, roomSize.depth);
    const distance = maxDim * 1.2;

    switch (view) {
      case 'top':
        camera.position.set(0, distance, 0);
        if (controlsRef.current) {
          controlsRef.current.target.set(0, 0, 0);
        }
        break;
      case 'front':
        camera.position.set(0, distance * 0.6, distance);
        if (controlsRef.current) {
          controlsRef.current.target.set(0, 0, 0);
        }
        break;
      case 'side':
        camera.position.set(distance, distance * 0.4, 0);
        if (controlsRef.current) {
          controlsRef.current.target.set(0, 0, 0);
        }
        break;
      case 'free':
      default:
        break;
    }
  }, [view, camera, roomSize]);

  return <OrbitControls ref={controlsRef} makeDefault enableDamping dampingFactor={0.05} />;
};

interface TransformableElementProps {
  element: SceneElement;
  isSelected: boolean;
  onTransformEnd: () => void;
}

const TransformableElement: React.FC<TransformableElementProps> = ({
  element,
  isSelected,
  onTransformEnd,
}) => {
  const transformRef = useRef<any>(null);
  const groupRef = useRef<THREE.Group>(null);
  const { updateElement } = useAppStore();

  useEffect(() => {
    if (transformRef.current && groupRef.current) {
      const controls = transformRef.current;
      const object = groupRef.current;

      const onChange = () => {
        updateElement(element.id, {
          position: {
            x: object.position.x,
            y: object.position.y,
            z: object.position.z,
          },
          rotation: {
            x: object.rotation.x,
            y: object.rotation.y,
            z: object.rotation.z,
          },
          scale: {
            x: object.scale.x,
            y: object.scale.y,
            z: object.scale.z,
          },
        });
      };

      controls.addEventListener('objectChange', onChange);
      return () => controls.removeEventListener('objectChange', onChange);
    }
  }, [element.id, updateElement]);

  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.position.set(
        element.position.x,
        element.position.y,
        element.position.z
      );
      groupRef.current.rotation.set(
        element.rotation.x,
        element.rotation.y,
        element.rotation.z
      );
      groupRef.current.scale.set(
        element.scale.x,
        element.scale.y,
        element.scale.z
      );
    }
  }, [element.position, element.rotation, element.scale]);

  const renderElement = () => {
    switch (element.type) {
      case 'instrumentCart':
        return (
          <InstrumentCart
            data={element}
            isSelected={isSelected}
            isHovered={false}
          />
        );
      case 'sterileZone':
        return (
          <SterileZone
            data={element}
            isSelected={isSelected}
            isHovered={false}
          />
        );
      case 'recycleBin':
        return (
          <RecycleBin
            data={element}
            isSelected={isSelected}
            isHovered={false}
          />
        );
      default:
        return null;
    }
  };

  if (!element.visible) return null;

  return (
    <>
      <group ref={groupRef}>{renderElement()}</group>
      {isSelected && groupRef.current && (
        <TransformControls
          ref={transformRef}
          object={groupRef.current}
          mode="translate"
          onMouseUp={onTransformEnd}
        />
      )}
    </>
  );
};

export const Scene: React.FC = () => {
  const {
    sceneData,
    selectedElementId,
    isPlaying,
    currentTime,
    totalDuration,
    cameraView,
    setSelectedElement,
    setCurrentTime,
    setPlayState,
    filters,
    updateElement,
  } = useAppStore();

  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (isPlaying) {
      let lastTime = performance.now();
      const animate = (now: number) => {
        const delta = (now - lastTime) / 1000;
        lastTime = now;

        setCurrentTime(currentTime + delta);
        if (currentTime + delta >= totalDuration) {
          setPlayState(false);
          setCurrentTime(0);
          return;
        }
        animationRef.current = requestAnimationFrame(animate);
      };
      animationRef.current = requestAnimationFrame(animate);
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, currentTime, totalDuration, setCurrentTime, setPlayState]);

  const handleCanvasClick = (e: any) => {
    if (e.target === e.currentTarget) {
      setSelectedElement(null);
    }
  };

  const shouldShowElement = (element: SceneElement): boolean => {
    if (!element.visible) return false;
    switch (element.type) {
      case 'instrumentCart':
        return filters.showInstrumentCarts;
      case 'sterileZone':
        return filters.showSterileZones;
      case 'recycleBin':
        return filters.showRecycleBins;
      case 'staff':
        return filters.showStaff;
      default:
        return true;
    }
  };

  const getStaffErrors = (staffId: string): boolean => {
    return sceneData.errors.some((e) => e.elementIds.includes(staffId));
  };

  const getElementById = (id: string): SceneElement | undefined => {
    return sceneData.elements.find((e) => e.id === id);
  };

  return (
    <>
      <PerspectiveCamera makeDefault position={[10, 10, 10]} fov={50} />
      <CameraController view={cameraView} roomSize={sceneData.roomSize} />

      <ambientLight intensity={0.6} />
      <directionalLight
        position={[5, 10, 5]}
        intensity={1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <directionalLight position={[-5, 5, -5]} intensity={0.3} />

      <group onClick={handleCanvasClick}>
        <OperatingRoom
          width={sceneData.roomSize.width}
          depth={sceneData.roomSize.depth}
        />

        {sceneData.elements
          .filter((el) => el.type !== 'staff')
          .filter(shouldShowElement)
          .map((element) => (
            <TransformableElement
              key={element.id}
              element={element}
              isSelected={selectedElementId === element.id}
              onTransformEnd={() => {}}
            />
          ))}

        {sceneData.elements
          .filter((el) => el.type === 'staff')
          .filter(shouldShowElement)
          .map((element) => (
            <React.Fragment key={element.id}>
              <Staff
                data={element as any}
                isSelected={selectedElementId === element.id}
                isHovered={false}
                currentTime={currentTime}
              />
              {filters.showPaths && (
                <PathLine
                  path={(element as any).path}
                  color={(element as any).color}
                  hasError={getStaffErrors(element.id)}
                  currentTime={currentTime}
                />
              )}
            </React.Fragment>
          ))}

        {filters.showErrors &&
          sceneData.errors.map((error) => (
            <ErrorMarker
              key={error.id}
              error={error}
              onClick={() => {
                if (error.timestamp !== undefined) {
                  setCurrentTime(error.timestamp);
                  setPlayState(false);
                }
              }}
            />
          ))}
      </group>
    </>
  );
};
