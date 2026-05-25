import React, { useEffect, useRef, useState } from 'react';
import { OrbitControls, PerspectiveCamera, TransformControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useAppStore } from '../../store/useAppStore';
import { OperatingRoom } from './OperatingRoom';
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

interface DraggableElementProps {
  element: SceneElement;
  isSelected: boolean;
  onSelect: () => void;
  onDragEnd: (position: { x: number; y: number; z: number }) => void;
}

const DraggableInstrumentCart: React.FC<DraggableElementProps> = ({
  element,
  isSelected,
  onSelect,
  onDragEnd,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const transformRef = useRef<any>(null);
  const data = element as any;
  const { width, depth, height } = data;

  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.position.set(
        element.position.x,
        element.position.y,
        element.position.z
      );
    }
  }, [element.position]);

  const color = isSelected ? '#4096ff' : '#d9d9d9';

  const handleClick = (e: any) => {
    e.stopPropagation();
    onSelect();
  };

  const handleTransformChange = () => {
    if (groupRef.current) {
      onDragEnd({
        x: groupRef.current.position.x,
        y: groupRef.current.position.y,
        z: groupRef.current.position.z,
      });
    }
  };

  if (!element.visible) return null;

  return (
    <group>
      <group ref={groupRef} onClick={handleClick}>
        <mesh position={[0, height / 2, 0]} castShadow>
          <boxGeometry args={[width, height, depth]} />
          <meshStandardMaterial color={color} />
        </mesh>
        <mesh position={[0, height * 0.3, 0]} castShadow>
          <boxGeometry args={[width - 0.05, 0.05, depth - 0.05]} />
          <meshStandardMaterial color="#f0f0f0" />
        </mesh>
        <mesh position={[0, height * 0.6, 0]} castShadow>
          <boxGeometry args={[width - 0.05, 0.05, depth - 0.05]} />
          <meshStandardMaterial color="#f0f0f0" />
        </mesh>
        {[-1, 1].map((x) =>
          [-1, 1].map((z) => (
            <mesh
              key={`wheel-${x}-${z}`}
              position={[(x * width) / 2 - 0.08, 0.08, (z * depth) / 2 - 0.08] as [number, number, number]}
              castShadow
            >
              <cylinderGeometry args={[0.06, 0.06, 0.16, 16]} />
              <meshStandardMaterial color="#333333" />
            </mesh>
          ))
        )}
      </group>
      {isSelected && groupRef.current && (
        <TransformControls
          ref={transformRef}
          object={groupRef.current}
          mode="translate"
          onMouseUp={handleTransformChange}
        />
      )}
    </group>
  );
};

const DraggableSterileZone: React.FC<DraggableElementProps> = ({
  element,
  isSelected,
  onSelect,
  onDragEnd,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const transformRef = useRef<any>(null);
  const data = element as any;
  const { width, depth, color } = data;

  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.position.set(
        element.position.x,
        element.position.y,
        element.position.z
      );
    }
  }, [element.position]);

  const borderColor = isSelected ? '#165DFF' : color;

  const handleClick = (e: any) => {
    e.stopPropagation();
    onSelect();
  };

  const handleTransformChange = () => {
    if (groupRef.current) {
      onDragEnd({
        x: groupRef.current.position.x,
        y: groupRef.current.position.y,
        z: groupRef.current.position.z,
      });
    }
  };

  if (!element.visible) return null;

  return (
    <group>
      <group ref={groupRef} onClick={handleClick}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <planeGeometry args={[width, depth]} />
          <meshStandardMaterial
            color={color}
            transparent
            opacity={0.25}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
          <ringGeometry args={[Math.min(width, depth) / 2 - 0.1, Math.min(width, depth) / 2, 64]} />
          <meshBasicMaterial color={borderColor} transparent opacity={0.8} side={THREE.DoubleSide} />
        </mesh>
        {[-1, 1].map((x) =>
          [-1, 1].map((z) => (
            <mesh key={`corner-${x}-${z}`} position={[(x * width) / 2, 0.05, (z * depth) / 2] as [number, number, number]}>
              <sphereGeometry args={[0.08, 16, 16]} />
              <meshBasicMaterial color={borderColor} />
            </mesh>
          ))
        )}
      </group>
      {isSelected && groupRef.current && (
        <TransformControls
          ref={transformRef}
          object={groupRef.current}
          mode="translate"
          onMouseUp={handleTransformChange}
        />
      )}
    </group>
  );
};

const DraggableRecycleBin: React.FC<DraggableElementProps> = ({
  element,
  isSelected,
  onSelect,
  onDragEnd,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const transformRef = useRef<any>(null);
  const data = element as any;
  const { radius } = data;
  const height = 0.8;

  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.position.set(
        element.position.x,
        element.position.y,
        element.position.z
      );
    }
  }, [element.position]);

  const bodyColor = isSelected ? '#ff7875' : '#ff4d4f';

  const handleClick = (e: any) => {
    e.stopPropagation();
    onSelect();
  };

  const handleTransformChange = () => {
    if (groupRef.current) {
      onDragEnd({
        x: groupRef.current.position.x,
        y: groupRef.current.position.y,
        z: groupRef.current.position.z,
      });
    }
  };

  if (!element.visible) return null;

  return (
    <group>
      <group ref={groupRef} onClick={handleClick}>
        <mesh position={[0, height / 2, 0]} castShadow>
          <cylinderGeometry args={[radius, radius * 0.9, height, 32]} />
          <meshStandardMaterial color={bodyColor} />
        </mesh>
        <mesh position={[0, height + 0.02, 0]}>
          <torusGeometry args={[radius, 0.04, 16, 32]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
      </group>
      {isSelected && groupRef.current && (
        <TransformControls
          ref={transformRef}
          object={groupRef.current}
          mode="translate"
          onMouseUp={handleTransformChange}
        />
      )}
    </group>
  );
};

import { Staff } from './Staff';
import { PathLine } from './PathLine';
import { ErrorMarker } from './ErrorMarker';

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

        const newTime = currentTime + delta;
        if (newTime >= totalDuration) {
          setPlayState(false);
          setCurrentTime(0);
          return;
        }
        setCurrentTime(newTime);
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

  const handleCanvasClick = () => {
    setSelectedElement(null);
  };

  const handleElementSelect = (id: string) => {
    setSelectedElement(id);
  };

  const handleTransformChange = (id: string, position: { x: number; y: number; z: number }) => {
    updateElement(id, { position });
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

  const renderDraggableElement = (element: SceneElement) => {
    const isSelected = selectedElementId === element.id;
    const props = {
      element,
      isSelected,
      onSelect: () => handleElementSelect(element.id),
      onDragEnd: (pos: { x: number; y: number; z: number }) => handleTransformChange(element.id, pos),
    };

    switch (element.type) {
      case 'instrumentCart':
        return <DraggableInstrumentCart key={element.id} {...props} />;
      case 'sterileZone':
        return <DraggableSterileZone key={element.id} {...props} />;
      case 'recycleBin':
        return <DraggableRecycleBin key={element.id} {...props} />;
      default:
        return null;
    }
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
          .map(renderDraggableElement)}

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
