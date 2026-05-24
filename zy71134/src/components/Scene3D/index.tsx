import React, { useRef, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useAppStore } from '@/store/useAppStore';
import { FloorMesh } from './FloorMesh';
import { WardMesh } from './WardMesh';
import { PipelineMesh } from './PipelineMesh';
import { ValveMesh } from './ValveMesh';

interface CameraControllerProps {
  viewType: string;
}

const CameraController: React.FC<CameraControllerProps> = ({ viewType }) => {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    const positions: Record<string, [number, number, number]> = {
      perspective: [20, 20, 20],
      top: [0, 35, 0],
      front: [0, 10, 30],
      side: [30, 10, 0],
    };

    const target: [number, number, number] = [0, 8, 0];
    const pos = positions[viewType] || positions.perspective;

    camera.position.set(...pos);
    if (controlsRef.current) {
      controlsRef.current.target.set(...target);
      controlsRef.current.update();
    }
  }, [viewType, camera]);

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.05}
      minDistance={5}
      maxDistance={60}
      maxPolarAngle={Math.PI / 2 + 0.1}
    />
  );
};

interface SceneContentProps {
  selectedFloorId: string | null;
  selectedValveId: string | null;
  filterStatus: string[];
  showAffectedArea: boolean;
}

const SceneContent: React.FC<SceneContentProps> = ({
  selectedFloorId,
  selectedValveId,
  filterStatus,
  showAffectedArea,
}) => {
  const { floors, wards, pipelines, valves } = useAppStore();

  const selectedValve = valves.find((v) => v.id === selectedValveId);
  const affectedWardIds = selectedValve?.affectedWards || [];

  const visibleFloors = selectedFloorId
    ? floors.filter((f) => f.id === selectedFloorId)
    : floors;

  const filteredValves = valves.filter((v) => {
    if (filterStatus.length === 0) return true;
    return filterStatus.includes(v.status);
  });

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[10, 20, 10]}
        intensity={1}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <directionalLight position={[-10, 10, -10]} intensity={0.3} />
      <pointLight position={[0, 15, 0]} intensity={0.5} color="#FFF5E6" />

      <gridHelper args={[60, 30, '#C9CDD4', '#E5E6EB']} position={[0, -0.2, 0]} />

      {visibleFloors.map((floor) => (
        <group key={floor.id}>
          <FloorMesh
            floorLevel={floor.level}
            isSelected={selectedFloorId === floor.id}
          />

          {wards
            .filter((w) => w.floorId === floor.id)
            .map((ward) => (
              <WardMesh
                key={ward.id}
                ward={ward}
                floorLevel={floor.level}
                isAffected={showAffectedArea && affectedWardIds.includes(ward.id)}
                isHighlighted={false}
              />
            ))}

          {pipelines
            .filter((p) => p.floorId === floor.id)
            .map((pipeline) => (
              <PipelineMesh
                key={pipeline.id}
                pipeline={pipeline}
                floorLevel={floor.level}
                isHighlighted={
                  selectedValve?.pipelineId === pipeline.id ||
                  pipeline.connectedValves.includes(selectedValveId || '')
                }
              />
            ))}

          {filteredValves
            .filter((v) => v.floorId === floor.id)
            .map((valve) => (
              <ValveMesh
                key={valve.id}
                valve={valve}
                floorLevel={floor.level}
                isSelected={selectedValveId === valve.id}
              />
            ))}
        </group>
      ))}
    </>
  );
};

interface Scene3DProps {
  className?: string;
}

export const Scene3D: React.FC<Scene3DProps> = ({ className }) => {
  const selectedFloorId = useAppStore((state) => state.selectedFloorId);
  const selectedValveId = useAppStore((state) => state.selectedValveId);
  const filterStatus = useAppStore((state) => state.filterStatus);
  const cameraView = useAppStore((state) => state.cameraView);
  const showAffectedArea = useAppStore((state) => state.showAffectedArea);
  const setSelectedValve = useAppStore((state) => state.setSelectedValve);

  return (
    <div
      className={className}
      onClick={() => setSelectedValve(null)}
      style={{ cursor: 'grab' }}
    >
      <Canvas
        shadows
        camera={{ position: [20, 20, 20], fov: 50 }}
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl }) => {
          gl.setClearColor('#F7F8FA');
        }}
      >
        <CameraController viewType={cameraView} />
        <SceneContent
          selectedFloorId={selectedFloorId}
          selectedValveId={selectedValveId}
          filterStatus={filterStatus}
          showAffectedArea={showAffectedArea}
        />
      </Canvas>
    </div>
  );
};

export default Scene3D;
