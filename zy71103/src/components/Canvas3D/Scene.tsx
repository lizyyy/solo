import React, { useEffect, useRef } from 'react';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
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

export const Scene: React.FC = () => {
  const {
    sceneData,
    selectedElementId,
    hoveredElementId,
    isPlaying,
    currentTime,
    cameraView,
    setSelectedElement,
    setHoveredElement,
    updateElement,
    setPlayState,
    setCurrentTime,
    totalDuration,
  } = useAppStore();

  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (isPlaying) {
      const animate = () => {
        setCurrentTime(currentTime + 0.016);
        if (currentTime >= totalDuration) {
          setPlayState(false);
          setCurrentTime(0);
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

  const handleElementDragEnd = (id: string, position: { x: number; y: number; z: number }) => {
    updateElement(id, { position });
  };

  const getStaffErrors = (staffId: string): boolean => {
    return sceneData.errors.some((e) => e.elementIds.includes(staffId));
  };

  const renderElement = (element: SceneElement) => {
    const isSelected = selectedElementId === element.id;
    const isHovered = hoveredElementId === element.id;

    switch (element.type) {
      case 'instrumentCart':
        return (
          <InstrumentCart
            key={element.id}
            data={element}
            isSelected={isSelected}
            isHovered={isHovered}
            onSelect={() => setSelectedElement(element.id)}
            onHover={(h) => setHoveredElement(h ? element.id : null)}
            onDragEnd={(pos) => handleElementDragEnd(element.id, pos)}
          />
        );
      case 'sterileZone':
        return (
          <SterileZone
            key={element.id}
            data={element}
            isSelected={isSelected}
            isHovered={isHovered}
            onSelect={() => setSelectedElement(element.id)}
            onHover={(h) => setHoveredElement(h ? element.id : null)}
            onDragEnd={(pos) => handleElementDragEnd(element.id, pos)}
          />
        );
      case 'recycleBin':
        return (
          <RecycleBin
            key={element.id}
            data={element}
            isSelected={isSelected}
            isHovered={isHovered}
            onSelect={() => setSelectedElement(element.id)}
            onHover={(h) => setHoveredElement(h ? element.id : null)}
            onDragEnd={(pos) => handleElementDragEnd(element.id, pos)}
          />
        );
      case 'staff':
        return (
          <React.Fragment key={element.id}>
            <Staff
              data={element}
              isSelected={isSelected}
              isHovered={isHovered}
              currentTime={currentTime}
              isPlaying={isPlaying}
              onSelect={() => setSelectedElement(element.id)}
              onHover={(h) => setHoveredElement(h ? element.id : null)}
              onDragEnd={(pos) => handleElementDragEnd(element.id, pos)}
            />
            <PathLine
              path={element.path}
              color={element.color}
              hasError={getStaffErrors(element.id)}
              currentTime={currentTime}
              isPlaying={isPlaying}
            />
          </React.Fragment>
        );
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

      <OperatingRoom width={sceneData.roomSize.width} depth={sceneData.roomSize.depth} />

      {sceneData.elements.map(renderElement)}

      {sceneData.errors.map((error) => (
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
    </>
  );
};
