import { useRef, useState, useEffect } from 'react';
import { Canvas, useThree, ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import ArchiveBox3D from './ArchiveBox3D';
import FileCard3D from './FileCard3D';
import type { FileCard, ArchiveBox, ConfidentialityLevel } from '@/types';

interface GameSceneProps {
  boxes: ArchiveBox[];
  currentFile: FileCard | null;
  selectedBoxId: string | null;
  selectedConfidentiality: ConfidentialityLevel | null;
  onSelectBox: (boxId: string) => void;
  onDragFileToBox: (boxId: string) => void;
  disabled: boolean;
}

function SceneContent({
  boxes,
  currentFile,
  selectedBoxId,
  selectedConfidentiality,
  onSelectBox,
  onDragFileToBox,
  disabled,
}: GameSceneProps) {
  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    offset: THREE.Vector3;
    currentPos: THREE.Vector3;
  }>({ isDragging: false, offset: new THREE.Vector3(), currentPos: new THREE.Vector3(0, 0.5, 0) });

  const { camera, scene } = useThree();
  const raycaster = useRef(new THREE.Raycaster());
  const mouse = useRef(new THREE.Vector2());

  useEffect(() => {
    if (currentFile) {
      setDragState(s => ({ ...s, currentPos: new THREE.Vector3(0, 0.5, 0) }));
    }
  }, [currentFile?.id]);

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (disabled || !currentFile) return;
    e.stopPropagation();
    setDragState(s => ({ ...s, isDragging: true }));
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!dragState.isDragging || disabled) return;
    e.stopPropagation();

    const rect = (e.target as HTMLElement).getBoundingClientRect();
    mouse.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.current.setFromCamera(mouse.current, camera);

    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const intersectPoint = new THREE.Vector3();
    raycaster.current.ray.intersectPlane(groundPlane, intersectPoint);

    if (intersectPoint) {
      setDragState(s => ({
        ...s,
        currentPos: new THREE.Vector3(
          Math.max(-3, Math.min(3, intersectPoint.x)),
          0.5,
          Math.max(-1, Math.min(1, intersectPoint.z))
        ),
      }));
    }
  };

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    if (!dragState.isDragging || disabled) return;
    e.stopPropagation();

    const dropPos = dragState.currentPos;
    let closestBox: ArchiveBox | null = null;
    let closestDist = Infinity;

    for (const box of boxes) {
      const dist = Math.sqrt(
        Math.pow(dropPos.x - box.position.x, 2) +
        Math.pow(dropPos.z - box.position.y, 2)
      );
      if (dist < closestDist && dist < 0.7) {
        closestDist = dist;
        closestBox = box;
      }
    }

    if (closestBox) {
      onSelectBox(closestBox.id);
      onDragFileToBox(closestBox.id);
    }

    setDragState(s => ({ ...s, isDragging: false, currentPos: new THREE.Vector3(0, 0.5, 0) }));
  };

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 8, 5]} intensity={0.8} castShadow />
      <directionalLight position={[-3, 5, -3]} intensity={0.4} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.3, 0]} receiveShadow>
        <planeGeometry args={[12, 6]} />
        <meshStandardMaterial color="#2c3e50" />
      </mesh>

      <mesh position={[0, -0.29, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[11.5, 5.5]} />
        <meshStandardMaterial color="#1a3a2e" metalness={0.2} roughness={0.8} />
      </mesh>

      {boxes.map((box) => (
        <ArchiveBox3D
          key={box.id}
          position={[box.position.x, 0, box.position.y]}
          color={box.color}
          label={box.name.replace('档案盒', '')}
          isSelected={selectedBoxId === box.id}
          onClick={() => onSelectBox(box.id)}
        />
      ))}

      {currentFile && !disabled && (
        <FileCard3D
          file={currentFile}
          position={[
            dragState.currentPos.x,
            dragState.currentPos.y,
            dragState.currentPos.z,
          ]}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerMove={handlePointerMove}
          isBeingDragged={dragState.isDragging}
          selectedConfidentiality={selectedConfidentiality}
        />
      )}

      <ContactShadows
        position={[0, -0.28, 0]}
        opacity={0.4}
        scale={12}
        blur={2}
        far={4}
      />

      <OrbitControls
        enablePan={false}
        enableZoom={true}
        minDistance={4}
        maxDistance={10}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.5}
        target={[0, 0, 0]}
      />

      <fog attach="fog" args={['#2c3e50', 8, 20]} />
    </>
  );
}

export default function GameScene(props: GameSceneProps) {
  return (
    <Canvas
      shadows
      camera={{ position: [0, 4, 5], fov: 50 }}
      style={{ background: 'linear-gradient(180deg, #34495e 0%, #2c3e50 100%)' }}
    >
      <SceneContent {...props} />
    </Canvas>
  );
}