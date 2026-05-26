import { useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, Html } from '@react-three/drei';
import * as THREE from 'three';
import type { Rack as RackType, ACUnit as ACUnitType } from '../../engine/types';
import { ROOM_DIMENSIONS } from '../../engine/config';
import { Rack } from './Rack';
import { ACUnit } from './ACUnit';
import { HeatOverlay } from './HeatOverlay';
import { useUISTore } from '../../store/useUISTore';
import { useGameStore } from '../../store/useGameStore';
import { formatHour } from '../../utils/temperature';

interface RoomSceneProps {
  racks: RackType[];
  acUnits: ACUnitType[];
  showHeatmap: boolean;
  showLabels: boolean;
  interactive?: boolean;
}

function CameraController() {
  const { cameraView } = useUISTore();
  const { camera } = useThree();
  const targetPos = useRef(new THREE.Vector3());
  const targetLook = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    if (cameraView === 'top') {
      targetPos.current.set(0, 20, 0.01);
      targetLook.current.set(0, 0, 0);
    } else {
      targetPos.current.set(12, 10, 12);
      targetLook.current.set(0, 0, 0);
    }

    camera.position.lerp(targetPos.current, delta * 3);
    camera.lookAt(targetLook.current);
  });

  return null;
}

function Floor() {
  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.01, 0]}
        receiveShadow
      >
        <planeGeometry args={[ROOM_DIMENSIONS.width, ROOM_DIMENSIONS.depth]} />
        <meshStandardMaterial
          color="#1e293b"
          metalness={0.2}
          roughness={0.9}
        />
      </mesh>

      <Grid
        args={[ROOM_DIMENSIONS.width, ROOM_DIMENSIONS.depth]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#334155"
        sectionSize={4}
        sectionThickness={1}
        sectionColor="#475569"
        fadeDistance={50}
        fadeStrength={1}
        followCamera={false}
        position={[0, 0.005, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      />
    </group>
  );
}

function Walls() {
  const { width, depth, height } = ROOM_DIMENSIONS;

  return (
    <group>
      <mesh position={[0, height / 2, -depth / 2]}>
        <boxGeometry args={[width, height, 0.2]} />
        <meshStandardMaterial color="#0f172a" side={2} />
      </mesh>
      <mesh position={[-width / 2, height / 2, 0]}>
        <boxGeometry args={[0.2, height, depth]} />
        <meshStandardMaterial color="#0f172a" side={2} />
      </mesh>
      <mesh position={[width / 2, height / 2, 0]}>
        <boxGeometry args={[0.2, height, depth]} />
        <meshStandardMaterial color="#0f172a" side={2} />
      </mesh>

      {Array.from({ length: 8 }).map((_, i) => (
        <mesh
          key={i}
          position={[-width / 2 + 2 + i * 2, height - 0.3, -depth / 2 + 0.2]}
        >
          <boxGeometry args={[1.5, 0.15, 0.1]} />
          <meshStandardMaterial
            color="#e2e8f0"
            emissive="#e2e8f0"
            emissiveIntensity={0.3}
          />
        </mesh>
      ))}
    </group>
  );
}

function RackLabel({ rack }: { rack: RackType }) {
  const { showLabels } = useUISTore();
  if (!showLabels) return null;

  return (
    <Html
      position={[rack.position.x, 3.2, rack.position.z]}
      center
      zIndexRange={[0, 0]}
      style={{
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      <div className="bg-slate-900/90 backdrop-blur-sm px-2 py-1 rounded text-xs font-mono whitespace-nowrap border border-slate-700">
        <div className="text-slate-300 font-bold">{rack.name}</div>
        <div className="text-cyan-400">{rack.temperature.toFixed(1)}°C</div>
        <div className="text-yellow-400">{rack.load.toFixed(1)} kW</div>
      </div>
    </Html>
  );
}

function ACStatusLabel({ ac }: { ac: ACUnitType }) {
  const { showLabels } = useUISTore();
  if (!showLabels) return null;

  return (
    <Html
      position={[ac.position.x, 3.5, ac.position.z]}
      center
      zIndexRange={[0, 0]}
      style={{
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      <div className="bg-slate-900/90 backdrop-blur-sm px-2 py-1 rounded text-xs font-mono whitespace-nowrap border border-slate-700">
        <div className="text-slate-300 font-bold">{ac.name}</div>
        <div className={ac.isOn ? 'text-green-400' : 'text-slate-500'}>
          {ac.isOn ? '运行中' : '已关闭'}
        </div>
        {ac.isOn && (
          <>
            <div className="text-cyan-400">设定 {ac.setPoint}°C</div>
            <div className="text-yellow-400">{ac.powerDraw.toFixed(1)} kW</div>
          </>
        )}
      </div>
    </Html>
  );
}

function SceneContent({ racks, acUnits, showHeatmap, showLabels, interactive = true }: RoomSceneProps) {
  const selectedRackId = useUISTore((s) => s.selectedRackId);
  const selectedACId = useUISTore((s) => s.selectedACId);
  const setSelectedRackId = useUISTore((s) => s.setSelectedRackId);
  const setSelectedACId = useUISTore((s) => s.setSelectedACId);

  const turnState = useGameStore((s) => s.turnState);
  const gamePhase = useGameStore((s) => s.gamePhase);
  const levelName = useGameStore((s) => s.levelName);

  return (
    <>
      <CameraController />
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[8, 15, 8]}
        intensity={0.8}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
      />

      <pointLight position={[0, 4, 0]} intensity={0.3} color="#0ea5e9" />

      <Floor />
      <Walls />
      <HeatOverlay racks={racks} show={showHeatmap} />

      {racks.map((rack) => (
        <group key={rack.id}>
          <Rack
            rack={rack}
            isSelected={selectedRackId === rack.id}
            onClick={() => interactive && setSelectedRackId(rack.id === selectedRackId ? null : rack.id)}
          />
          <RackLabel rack={rack} />
        </group>
      ))}

      {acUnits.map((ac) => (
        <group key={ac.id}>
          <ACUnit
            ac={ac}
            isSelected={selectedACId === ac.id}
            onClick={() => interactive && setSelectedACId(ac.id === selectedACId ? null : ac.id)}
          />
          <ACStatusLabel ac={ac} />
        </group>
      ))}

      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={5}
        maxDistance={30}
        maxPolarAngle={Math.PI / 2.1}
        minPolarAngle={Math.PI / 6}
      />

      <Html position={[-ROOM_DIMENSIONS.width / 2 + 0.5, ROOM_DIMENSIONS.height - 0.5, -ROOM_DIMENSIONS.depth / 2 + 0.5]}>
        <div className="bg-slate-900/80 backdrop-blur-sm px-3 py-2 rounded text-xs font-mono border border-slate-700">
          <div className="text-cyan-400 font-bold">{levelName}</div>
          <div className="text-slate-300">{formatHour(turnState.hour)}</div>
          <div className={gamePhase === 'paused' ? 'text-yellow-400' : 'text-green-400'}>
            {gamePhase === 'paused' ? '已暂停' : gamePhase === 'won' ? '挑战成功' : gamePhase === 'lost' ? '挑战失败' : '运行中'}
          </div>
        </div>
      </Html>
    </>
  );
}

export function RoomScene(props: RoomSceneProps) {
  return (
    <Canvas
      shadows
      camera={{ position: [12, 10, 12], fov: 50 }}
      gl={{ antialias: true, alpha: false }}
      style={{ background: '#020617' }}
    >
      <fog attach="fog" args={['#020617', 15, 40]} />
      <SceneContent {...props} interactive={props.interactive !== false} />
    </Canvas>
  );
}
