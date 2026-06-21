import { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import {
  OrbitControls,
  Html,
  Stars,
  Grid,
} from '@react-three/drei';
import * as THREE from 'three';
import { Camera, Eye, Map as MapIcon, Save } from 'lucide-react';
import { useWorkbenchStore } from '@/store';
import type { CollisionPoint, ViewPoint } from '@/shared/types';

const PRESET_VIEWS: Record<string, ViewPoint> = {
  front: {
    camera_position: { x: 0, y: 3, z: 12 },
    camera_target: { x: 0, y: 3, z: 0 },
    zoom: 1,
    fov: 50,
  },
  side: {
    camera_position: { x: 12, y: 3, z: 0 },
    camera_target: { x: 0, y: 3, z: 0 },
    zoom: 1,
    fov: 50,
  },
  top: {
    camera_position: { x: 0, y: 14, z: 0.01 },
    camera_target: { x: 0, y: 0, z: 0 },
    zoom: 1,
    fov: 50,
  },
};

const COLLISION_POSITIONS: Record<string, [number, number, number]> = {
  'COL-FZ4-001': [-1.2, 4.5, 0.8],
  'COL-FZ4-002': [1.0, 2.8, -0.6],
  'COL-FZ4-003': [0.0, 5.5, 0.0],
  default: [0.5, 3.5, 0.5],
};

function getCollisionPosition(elementId: string, index: number): [number, number, number] {
  const key = elementId || `default-${index}`;
  if (COLLISION_POSITIONS[elementId]) return COLLISION_POSITIONS[elementId];
  const pos = COLLISION_POSITIONS[`COL-FZ4-00${(index % 3) + 1}`];
  if (!pos) return COLLISION_POSITIONS.default;
  return [
    pos[0] + (index * 0.3) % 1.5 - 0.75,
    pos[1] + (index * 0.2) % 2 - 1,
    pos[2] + (index * 0.25) % 1 - 0.5,
  ];
}

function getFingerprint(vp: ViewPoint): string {
  const { camera_position, camera_target } = vp;
  const vals = [
    camera_position.x,
    camera_position.y,
    camera_position.z,
    camera_target.x,
    camera_target.y,
    camera_target.z,
  ];
  return vals.map((v) => Math.round(v * 100).toString(36)).join('-');
}

function CollisionSphere({
  collision,
  position,
  index,
}: {
  collision: CollisionPoint;
  position: [number, number, number];
  index: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const selectCollision = useWorkbenchStore((s) => s.selectCollision);
  const selectedId = useWorkbenchStore((s) => s.selectedCollisionId);
  const setViewpoint = useWorkbenchStore((s) => s.updateViewpoint);
  const { camera, controls } = useThree() as { camera: THREE.PerspectiveCamera; controls: any };

  const isSelected = selectedId === collision.collision_id;
  const color = collision.severity === 'high' ? '#ef4444' : collision.severity === 'medium' ? '#f97316' : '#eab308';

  useFrame((state) => {
    if (meshRef.current) {
      const t = state.clock.getElapsedTime() + index * 0.5;
      const pulse = 1 + Math.sin(t * 2) * 0.15;
      meshRef.current.scale.setScalar(pulse);
    }
  });

  const handleClick = () => {
    selectCollision(collision.collision_id);
    const vp = collision.viewpoint;
    if (vp) {
      const startPos = camera.position.clone();
      const endPos = new THREE.Vector3(
        vp.camera_position.x,
        vp.camera_position.y,
        vp.camera_position.z
      );
      const startTarget = new THREE.Vector3();
      const endTarget = new THREE.Vector3(
        vp.camera_target.x,
        vp.camera_target.y,
        vp.camera_target.z
      );
      if (controls) {
        startTarget.copy(controls.target);
      }
      let progress = 0;
      const duration = 800;
      const startTime = performance.now();
      const animate = () => {
        progress = Math.min((performance.now() - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        camera.position.lerpVectors(startPos, endPos, eased);
        if (controls) {
          controls.target.lerpVectors(startTarget, endTarget, eased);
          controls.update();
        }
        if (progress < 1) requestAnimationFrame(animate);
        else setViewpoint(vp);
      };
      animate();
    }
  };

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          setHovered(false);
          document.body.style.cursor = 'default';
        }}
        onClick={(e) => {
          e.stopPropagation();
          handleClick();
        }}
      >
        <sphereGeometry args={[0.18, 32, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isSelected ? 2 : hovered ? 1.2 : 0.6}
          transparent
          opacity={0.9}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.32, 32, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.15} />
      </mesh>
      {(hovered || isSelected) && (
        <Html
          position={[0, 0.5, 0]}
          center
          distanceFactor={8}
          style={{ pointerEvents: 'none' }}
        >
          <div className="bg-slate-900/95 text-white text-xs px-3 py-2 rounded-md shadow-xl border border-slate-700 whitespace-nowrap min-w-[200px]">
            <div className="font-bold text-red-400 mb-1">碰撞点: {collision.collision_id}</div>
            <div className="text-slate-300 mb-1">{collision.description}</div>
            <div className="text-slate-400 font-mono text-[10px] mt-2 pt-2 border-t border-slate-700">
              VP: {getFingerprint(collision.viewpoint)}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

function BeamStructure() {
  return (
    <group>
      <mesh position={[0, 3, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.5, 0.5, 7, 32]} />
        <meshStandardMaterial color="#4a5568" metalness={0.3} roughness={0.7} />
      </mesh>
      <mesh position={[0, 7, 0]} castShadow>
        <cylinderGeometry args={[0.55, 0.55, 0.2, 32]} />
        <meshStandardMaterial color="#2d3748" metalness={0.4} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.7, 0.7, 0.3, 32]} />
        <meshStandardMaterial color="#2d3748" metalness={0.4} roughness={0.6} />
      </mesh>
      <mesh position={[0, 5.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[6, 0.4, 0.5]} />
        <meshStandardMaterial color="#718096" metalness={0.25} roughness={0.75} />
      </mesh>
      <mesh position={[0, 2.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.5, 0.4, 5]} />
        <meshStandardMaterial color="#718096" metalness={0.25} roughness={0.75} />
      </mesh>
      <mesh position={[-3, 5.5, 0]} castShadow>
        <cylinderGeometry args={[0.25, 0.25, 0.6, 16]} />
        <meshStandardMaterial color="#2d3748" metalness={0.4} roughness={0.6} />
      </mesh>
      <mesh position={[3, 5.5, 0]} castShadow>
        <cylinderGeometry args={[0.25, 0.25, 0.6, 16]} />
        <meshStandardMaterial color="#2d3748" metalness={0.4} roughness={0.6} />
      </mesh>
      <mesh position={[0, 2.5, -2.5]} castShadow>
        <cylinderGeometry args={[0.25, 0.25, 0.6, 16]} />
        <meshStandardMaterial color="#2d3748" metalness={0.4} roughness={0.6} />
      </mesh>
      <mesh position={[0, 2.5, 2.5]} castShadow>
        <cylinderGeometry args={[0.25, 0.25, 0.6, 16]} />
        <meshStandardMaterial color="#2d3748" metalness={0.4} roughness={0.6} />
      </mesh>
    </group>
  );
}

function CollisionLayer() {
  const record = useWorkbenchStore((s) => s.record);
  const collisions = useMemo(() => {
    if (!record) return [];
    const list: Array<{ collision: CollisionPoint; index: number }> = [];
    record.materials.forEach((mat) => {
      mat.collision_points.forEach((col) => {
        list.push({ collision: col, index: list.length });
      });
    });
    return list;
  }, [record]);

  return (
    <group>
      {collisions.map(({ collision, index }) => (
        <CollisionSphere
          key={collision.collision_id}
          collision={collision}
          position={getCollisionPosition(collision.collision_id, index)}
          index={index}
        />
      ))}
    </group>
  );
}

function CameraController() {
  return null;
}

export default function Scene3D() {
  const controlsRef = useRef<any>(null);
  const setViewpoint = useWorkbenchStore((s) => s.updateViewpoint);
  const loading = useWorkbenchStore((s) => s.loading);

  const getCamera = (): THREE.PerspectiveCamera | undefined => {
    const c = controlsRef.current;
    if (!c) return undefined;
    return (c.object ?? c.camera) as THREE.PerspectiveCamera | undefined;
  };

  const applyPreset = (view: ViewPoint) => {
    if (!controlsRef.current) return;
    const cam = getCamera();
    if (!cam) return;
    const duration = 800;
    const startPos = cam.position.clone();
    const endPos = new THREE.Vector3(
      view.camera_position.x,
      view.camera_position.y,
      view.camera_position.z
    );
    const startTarget = controlsRef.current.target.clone();
    const endTarget = new THREE.Vector3(
      view.camera_target.x,
      view.camera_target.y,
      view.camera_target.z
    );
    let progress = 0;
    const startTime = performance.now();
    const animate = () => {
      progress = Math.min((performance.now() - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      cam.position.lerpVectors(startPos, endPos, eased);
      controlsRef.current.target.lerpVectors(startTarget, endTarget, eased);
      controlsRef.current.update();
      if (progress < 1) requestAnimationFrame(animate);
      else setViewpoint(view);
    };
    animate();
  };

  const saveViewpoint = () => {
    const cam = getCamera();
    if (!controlsRef.current || !cam) return;
    const target = controlsRef.current.target;
    const vp: ViewPoint = {
      camera_position: { x: cam.position.x, y: cam.position.y, z: cam.position.z },
      camera_target: { x: target.x, y: target.y, z: target.z },
      zoom: 1,
      fov: cam.fov || 50,
    };
    setViewpoint(vp);
  };

  return (
    <div className="w-full h-full relative bg-slate-900 rounded-lg overflow-hidden">
      <Canvas
        shadows
        camera={{ position: [0, 3, 12], fov: 50, near: 0.1, far: 100 }}
        onCreated={({ gl }) => {
          gl.setClearColor('#0f172a');
        }}
      >
        <fog attach="fog" args={['#0f172a', 15, 40]} />
        <ambientLight intensity={0.4} />
        <directionalLight
          position={[10, 15, 10]}
          intensity={1.2}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <pointLight position={[-8, 5, -8]} intensity={0.5} color="#60a5fa" />
        <Stars radius={50} depth={50} count={2000} factor={4} fade speed={0.5} />
        <Grid
          args={[20, 20]}
          cellSize={1}
          cellThickness={0.5}
          cellColor="#1e3a5f"
          sectionSize={5}
          sectionThickness={1}
          sectionColor="#3b82f6"
          fadeDistance={30}
          fadeStrength={1}
          infiniteGrid
          position={[0, -3.5, 0]}
        />
        <BeamStructure />
        <CollisionLayer />
        <OrbitControls
          ref={controlsRef}
          makeDefault
          enableDamping
          dampingFactor={0.08}
          minDistance={3}
          maxDistance={30}
          maxPolarAngle={Math.PI / 2 + 0.2}
        />
        <CameraController />
      </Canvas>

      <div className="absolute top-4 left-4 flex gap-2">
        <button
          onClick={() => applyPreset(PRESET_VIEWS.front)}
          className="bg-slate-800/80 hover:bg-blue-600/80 text-white px-3 py-2 rounded-md text-sm flex items-center gap-1.5 backdrop-blur border border-slate-700 transition-all"
          title="正视角"
        >
          <Eye size={14} /> 正
        </button>
        <button
          onClick={() => applyPreset(PRESET_VIEWS.side)}
          className="bg-slate-800/80 hover:bg-blue-600/80 text-white px-3 py-2 rounded-md text-sm flex items-center gap-1.5 backdrop-blur border border-slate-700 transition-all"
          title="侧视角"
        >
          <Camera size={14} /> 侧
        </button>
        <button
          onClick={() => applyPreset(PRESET_VIEWS.top)}
          className="bg-slate-800/80 hover:bg-blue-600/80 text-white px-3 py-2 rounded-md text-sm flex items-center gap-1.5 backdrop-blur border border-slate-700 transition-all"
          title="俯视角"
        >
          <MapIcon size={14} /> 俯
        </button>
        <button
          onClick={saveViewpoint}
          className="bg-emerald-700/80 hover:bg-emerald-600/80 text-white px-3 py-2 rounded-md text-sm flex items-center gap-1.5 backdrop-blur border border-emerald-600 transition-all"
          title="保存当前视角"
        >
          <Save size={14} /> 保存视角
        </button>
      </div>

      {loading && (
        <div className="absolute inset-0 bg-slate-900/70 flex items-center justify-center">
          <div className="text-white flex items-center gap-3">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            加载中...
          </div>
        </div>
      )}

      <div className="absolute bottom-4 right-4 text-slate-400 text-xs bg-slate-800/60 px-3 py-1.5 rounded-md backdrop-blur border border-slate-700">
        拖拽旋转 | 滚轮缩放 | 右键平移
      </div>
    </div>
  );
}
