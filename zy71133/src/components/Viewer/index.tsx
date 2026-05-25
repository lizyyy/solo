import { useRef, useCallback, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '@/store/useStore';
import { PointCloud } from './PointCloud';
import { BoundaryLine, DrawingBoundary } from './BoundaryLine';
import { GroundPlane } from './GroundPlane';
import { BoundaryVertex } from '@/types';

interface SceneProps {
  onGroundClick?: (point: { x: number; z: number }) => void;
}

function Scene({ onGroundClick }: SceneProps) {
  const {
    pointCloud,
    boundaries,
    selectedBoundaryId,
    baseHeight,
    toolMode,
    drawingVertices,
    cameraState,
    setSelectedBoundaryId,
    setCameraState,
    setDragState,
    dragState,
    updateVertex,
  } = useStore();

  const { camera, gl } = useThree();
  const controlsRef = useRef<THREE.EventDispatcher | null>(null);
  const raycaster = useRef(new THREE.Raycaster());
  const mouse = useRef(new THREE.Vector2());
  const isDragging = useRef(false);

  useEffect(() => {
    camera.position.set(...cameraState.position);
    if (controlsRef.current) {
      const controls = controlsRef.current as unknown as { target: THREE.Vector3 };
      controls.target.set(...cameraState.target);
    }
  }, [camera, cameraState]);

  useFrame(() => {
    if (controlsRef.current) {
      const controls = controlsRef.current as unknown as { target: THREE.Vector3; update: () => void };
      setCameraState({
        position: [camera.position.x, camera.position.y, camera.position.z],
        target: [controls.target.x, controls.target.y, controls.target.z],
      });
    }

    if (dragState && isDragging.current) {
      const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -baseHeight);
      const intersect = new THREE.Vector3();
      raycaster.current.setFromCamera(mouse.current, camera);
      raycaster.current.ray.intersectPlane(groundPlane, intersect);

      if (intersect) {
        updateVertex(dragState.boundaryId, dragState.vertexIndex, { x: intersect.x, z: intersect.z });
      }
    }
  });

  const handlePointerMove = useCallback((event: { clientX: number; clientY: number }) => {
    const rect = gl.domElement.getBoundingClientRect();
    mouse.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }, [gl]);

  const handlePointerUp = useCallback(() => {
    if (dragState) {
      isDragging.current = false;
      setDragState(null);
    }
  }, [dragState, setDragState]);

  useEffect(() => {
    const canvas = gl.domElement;
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', handlePointerUp);
    return () => {
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerup', handlePointerUp);
    };
  }, [gl, handlePointerMove, handlePointerUp]);

  const handleBoundaryClick = useCallback((id: string) => (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    if (toolMode === 'select' || toolMode === 'edit') {
      setSelectedBoundaryId(selectedBoundaryId === id ? null : id);
    }
  }, [toolMode, selectedBoundaryId, setSelectedBoundaryId]);

  const handleVertexMouseDown = useCallback((boundaryId: string, vertexIndex: number) => {
    if (toolMode === 'edit' && selectedBoundaryId === boundaryId) {
      isDragging.current = true;
      setDragState({ boundaryId, vertexIndex });
    }
  }, [toolMode, selectedBoundaryId, setDragState]);

  const handleGroundClick = useCallback((point: { x: number; z: number }) => {
    if (toolMode === 'draw' && onGroundClick) {
      onGroundClick(point);
    }
  }, [toolMode, onGroundClick]);

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[50, 50, 25]} intensity={0.8} castShadow />
      <hemisphereLight args={['#87CEEB', '#362d1f', 0.4]} />

      <GroundPlane
        size={120}
        height={baseHeight}
        showGrid={true}
        onGroundClick={handleGroundClick}
      />

      {pointCloud && <PointCloud points={pointCloud.points} pointSize={0.4} />}

      {boundaries.map(boundary => (
        <BoundaryLine
          key={boundary.id}
          boundary={boundary}
          isSelected={selectedBoundaryId === boundary.id}
          baseHeight={baseHeight}
          isEditing={toolMode === 'edit'}
          onClick={handleBoundaryClick(boundary.id)}
          onVertexMouseDown={(index) => handleVertexMouseDown(boundary.id, index)}
        />
      ))}

      {toolMode === 'draw' && drawingVertices.length > 0 && (
        <DrawingBoundary vertices={drawingVertices} baseHeight={baseHeight} />
      )}

      <OrbitControls
        ref={controlsRef as React.MutableRefObject<undefined>}
        makeDefault
        enableDamping
        dampingFactor={0.05}
        minDistance={10}
        maxDistance={200}
        enablePan={!dragState && toolMode !== 'draw'}
        enableRotate={!dragState && toolMode !== 'draw'}
      />
    </>
  );
}

interface ViewerProps {
  id?: string;
}

export function Viewer({ id = 'viewer-container' }: ViewerProps) {
  const {
    toolMode,
    drawingVertices,
    addDrawingVertex,
    setIsDrawing,
    addBoundary,
    baseHeight,
  } = useStore();

  const handleGroundClick = useCallback((point: BoundaryVertex) => {
    if (toolMode !== 'draw') return;

    if (drawingVertices.length > 2) {
      const firstVertex = drawingVertices[0];
      const distance = Math.sqrt(
        Math.pow(point.x - firstVertex.x, 2) +
        Math.pow(point.z - firstVertex.z, 2)
      );

      if (distance < 3) {
        const newBoundary = {
          id: 'boundary-' + Date.now(),
          name: `料堆 ${Math.floor(Math.random() * 100)}`,
          vertices: drawingVertices,
          baseHeight: baseHeight,
          materialId: 'ore',
        };
        addBoundary(newBoundary);
        setIsDrawing(false);
        return;
      }
    }

    addDrawingVertex(point);
    setIsDrawing(true);
  }, [toolMode, drawingVertices, addDrawingVertex, addBoundary, setIsDrawing, baseHeight]);

  return (
    <div
      id={id}
      className="w-full h-full relative"
      style={{ background: '#1D2129' }}
    >
      <Canvas
        camera={{ position: [50, 50, 50], fov: 50 }}
        shadows
        gl={{ antialias: true, alpha: false }}
      >
        <color attach="background" args={['#1D2129']} />
        <fog attach="fog" args={['#1D2129', 80, 200]} />
        <Scene onGroundClick={handleGroundClick} />
      </Canvas>

      {toolMode === 'draw' && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm shadow-lg">
          点击地面添加顶点，点击起点附近闭合多边形（当前 {drawingVertices.length} 个顶点）
        </div>
      )}
      {toolMode === 'edit' && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-orange-600 text-white px-4 py-2 rounded-lg text-sm shadow-lg">
          编辑模式：选中料堆后拖拽顶点调整边界
        </div>
      )}
    </div>
  );
}
