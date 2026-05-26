import { useRef, useCallback } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../../store/gameStore';
import { GridFloor } from './GridFloor';
import { Robot3D } from './Robot3D';
import { Shelf3D } from './Shelf3D';
import { Obstacle3D } from './Obstacle3D';
import { ChargingStation3D } from './ChargingStation3D';
import { PathLine } from './PathLine';
import { Position } from '../../types/game';

const CELL_SIZE = 1;

function SceneContent() {
  const raycaster = useRef(new THREE.Raycaster());
  const mouse = useRef(new THREE.Vector2());
  const planeRef = useRef<THREE.Mesh>(null);
  
  const level = useGameStore((state) => state.level);
  const robots = useGameStore((state) => state.robots);
  const selectedRobotId = useGameStore((state) => state.selectedRobotId);
  const previewPath = useGameStore((state) => state.previewPath);
  const selectRobot = useGameStore((state) => state.selectRobot);
  const assignTarget = useGameStore((state) => state.assignTarget);
  const setHoveredPosition = useGameStore((state) => state.setHoveredPosition);
  
  const { camera, gl } = useThree();

  const getGridPosition = useCallback((event: any): Position | null => {
    if (!planeRef.current || !level) return null;

    const rect = gl.domElement.getBoundingClientRect();
    mouse.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.current.setFromCamera(mouse.current, camera);
    const intersects = raycaster.current.intersectObject(planeRef.current);

    if (intersects.length > 0) {
      const point = intersects[0].point;
      const offsetX = -level.gridSize.width * CELL_SIZE / 2;
      const offsetZ = -level.gridSize.height * CELL_SIZE / 2;
      
      const x = Math.floor((point.x - offsetX) / CELL_SIZE);
      const y = Math.floor((point.z - offsetZ) / CELL_SIZE);
      
      if (x >= 0 && x < level.gridSize.width && y >= 0 && y < level.gridSize.height) {
        return { x, y };
      }
    }
    return null;
  }, [camera, gl, level]);

  const handleClick = useCallback((event: any) => {
    if (!level) return;

    const gridPos = getGridPosition(event);
    if (!gridPos) return;

    const clickedRobot = robots.find(
      (r) => r.position.x === gridPos.x && r.position.y === gridPos.y
    );

    if (clickedRobot && clickedRobot.status !== 'dead') {
      selectRobot(clickedRobot.id);
      return;
    }

    if (selectedRobotId) {
      assignTarget(selectedRobotId, gridPos);
    }
  }, [level, robots, selectedRobotId, selectRobot, assignTarget, getGridPosition]);

  const handleMouseMove = useCallback((event: any) => {
    if (!level || !selectedRobotId) return;
    
    const gridPos = getGridPosition(event);
    setHoveredPosition(gridPos);
  }, [level, selectedRobotId, getGridPosition, setHoveredPosition]);

  if (!level) return null;

  const selectedRobot = robots.find((r) => r.id === selectedRobotId);

  return (
    <>
      <OrbitControls 
        makeDefault 
        minPolarAngle={Math.PI / 6} 
        maxPolarAngle={Math.PI / 2.5}
        minDistance={5}
        maxDistance={30}
      />
      
      <ambientLight intensity={0.4} />
      <directionalLight 
        position={[10, 20, 10]} 
        intensity={1} 
        castShadow 
      />
      <pointLight position={[-5, 10, -5]} intensity={0.5} />

      <GridFloor 
        width={level.gridSize.width} 
        height={level.gridSize.height} 
        cellSize={CELL_SIZE}
      />

      <mesh
        ref={planeRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.001, 0]}
        visible={false}
      >
        <planeGeometry 
          args={[level.gridSize.width * CELL_SIZE, level.gridSize.height * CELL_SIZE]} 
        />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {level.shelves.map((shelf) => (
        <Shelf3D
          key={shelf.id}
          shelf={shelf}
          cellSize={CELL_SIZE}
          gridWidth={level.gridSize.width}
          gridHeight={level.gridSize.height}
        />
      ))}

      {level.obstacles.map((obstacle) => (
        <Obstacle3D
          key={obstacle.id}
          obstacle={obstacle}
          cellSize={CELL_SIZE}
          gridWidth={level.gridSize.width}
          gridHeight={level.gridSize.height}
        />
      ))}

      {level.chargingStations.map((station) => (
        <ChargingStation3D
          key={station.id}
          station={station}
          cellSize={CELL_SIZE}
          gridWidth={level.gridSize.width}
          gridHeight={level.gridSize.height}
        />
      ))}

      {robots.map((robot) => (
        <Robot3D
          key={robot.id}
          robot={robot}
          isSelected={robot.id === selectedRobotId}
          cellSize={CELL_SIZE}
          gridWidth={level.gridSize.width}
          gridHeight={level.gridSize.height}
        />
      ))}

      {robots.map((robot) =>
        robot.path.length > 0 ? (
          <PathLine
            key={`path-${robot.id}`}
            path={robot.path.slice(robot.pathIndex)}
            startPosition={robot.position}
            color={robot.color}
            cellSize={CELL_SIZE}
            gridWidth={level.gridSize.width}
            gridHeight={level.gridSize.height}
          />
        ) : null
      )}

      {selectedRobot && previewPath.length > 0 && (
        <PathLine
          path={previewPath}
          startPosition={selectedRobot.position}
          color="#ffff00"
          cellSize={CELL_SIZE}
          gridWidth={level.gridSize.width}
          gridHeight={level.gridSize.height}
          isPreview
        />
      )}

      <mesh
        onClick={handleClick}
        onPointerMove={handleMouseMove}
        onPointerOut={() => setHoveredPosition(null)}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.002, 0]}
      >
        <planeGeometry 
          args={[level.gridSize.width * CELL_SIZE, level.gridSize.height * CELL_SIZE]} 
        />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </>
  );
}

export function GameScene() {
  return (
    <Canvas
      camera={{ position: [10, 15, 10], fov: 50 }}
      shadows
      gl={{ antialias: true }}
      style={{ background: '#0f0f1a' }}
    >
      <SceneContent />
    </Canvas>
  );
}
