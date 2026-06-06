import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import {
  BarChart3,
  ArrowLeft,
  Music,
  FileImage,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { formatDate } from '../utils/boundaryRules';

interface BarProps {
  position: [number, number, number];
  height: number;
  color: string;
  label: string;
  data: {
    id: string;
    personName: string;
    trackName: string;
    lateMinutes: number;
    trackRemark: string;
    hasReworkReason: boolean;
  };
  isSelected: boolean;
  onClick: () => void;
}

function Bar({ position, height, color, label, data, isSelected, onClick }: BarProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame(() => {
    if (meshRef.current) {
      const targetScale = isSelected ? 1.1 : hovered ? 1.05 : 1;
      meshRef.current.scale.y = THREE.MathUtils.lerp(
        meshRef.current.scale.y,
        targetScale,
        0.1
      );
      if (isSelected) {
        meshRef.current.position.y = THREE.MathUtils.lerp(
          meshRef.current.position.y,
          position[1] + height / 2 + 0.2,
          0.1
        );
      } else {
        meshRef.current.position.y = THREE.MathUtils.lerp(
          meshRef.current.position.y,
          position[1] + height / 2,
          0.1
        );
      }
    }
  });

  return (
    <group>
      <mesh
        ref={meshRef}
        position={[position[0], position[1] + height / 2, position[2]]}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = 'auto';
        }}
      >
        <boxGeometry args={[0.6, height, 0.6]} />
        <meshStandardMaterial
          color={color}
          metalness={0.3}
          roughness={0.4}
          emissive={isSelected ? color : '#000000'}
          emissiveIntensity={isSelected ? 0.2 : 0}
        />
      </mesh>
      {(hovered || isSelected) && (
        <Html
          position={[position[0], position[1] + height + 0.5, position[2]]}
          center
          distanceFactor={10}
        >
          <div className="bg-white rounded-lg shadow-xl p-3 whitespace-nowrap border border-gray-200">
            <p className="text-sm font-medium text-primary-800">{label}</p>
            <p className="text-xs text-gray-500">迟到 {data.lateMinutes} 分钟</p>
            {data.hasReworkReason && (
              <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                含返工原因
              </p>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}

function Scene({
  data,
  selectedId,
  onSelect,
}: {
  data: Array<{
    id: string;
    personName: string;
    trackName: string;
    lateMinutes: number;
    trackRemark: string;
    hasReworkReason: boolean;
  }>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const maxHeight = Math.max(...data.map((d) => d.lateMinutes), 1);
  const barSpacing = 1.2;
  const startX = -((data.length - 1) * barSpacing) / 2;

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 10, 5]} intensity={1} castShadow />
      <directionalLight position={[-5, 5, -5]} intensity={0.3} />

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.01, 0]}
        receiveShadow
        onClick={() => onSelect(null)}
      >
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#f0f7f7" />
      </mesh>

      <gridHelper args={[20, 20, '#b3d5d5', '#d9eaea']} position={[0, 0, 0]} />

      {data.map((item, index) => {
        const height = (item.lateMinutes / maxHeight) * 4 + 0.1;
        const color = item.hasReworkReason ? '#b4543c' : '#1a3a3a';
        const x = startX + index * barSpacing;

        return (
          <Bar
            key={item.id}
            position={[x, 0, 0]}
            height={height}
            color={color}
            label={`${item.personName} - ${item.trackName}`}
            data={item}
            isSelected={selectedId === item.id}
            onClick={() => onSelect(item.id)}
          />
        );
      })}

      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minPolarAngle={0.2}
        maxPolarAngle={Math.PI / 2.2}
      />
    </>
  );
}

export default function Statistics3D() {
  const navigate = useNavigate();
  const records = useStore((state) => state.records);
  const getTrackById = useStore((state) => state.getTrackById);
  const getContractById = useStore((state) => state.getContractById);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const lateRecords = useMemo(() => {
    return records
      .filter((r) => r.isLate || r.hasReworkReason)
      .slice(0, 15)
      .map((r) => {
        const track = getTrackById(r.trackId);
        return {
          id: r.id,
          personName: r.personName,
          trackName: track?.aliasName || track?.trackName || '未知',
          lateMinutes: r.lateMinutes || 0,
          trackRemark: r.trackRemark,
          hasReworkReason: r.hasReworkReason,
          trackId: r.trackId,
          contractId: r.contractId,
          rehearsalDate: r.rehearsalDate,
          status: r.status,
        };
      });
  }, [records, getTrackById]);

  const selectedRecord = useMemo(() => {
    if (!selectedId) return null;
    return lateRecords.find((r) => r.id === selectedId);
  }, [selectedId, lateRecords]);

  const selectedTrack = selectedRecord ? getTrackById(selectedRecord.trackId) : null;
  const selectedContract = selectedRecord ? getContractById(selectedRecord.contractId) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            onClick={() => navigate('/statistics')}
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-serif font-bold text-primary-800">
              3D 统计视图
            </h1>
            <p className="text-gray-600 mt-1">
              点击柱子可钻取追溯源材料，拖拽旋转视角
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-primary-700"></div>
            <span>正常迟到</span>
          </div>
          <div className="flex items-center gap-1 ml-4">
            <div className="w-3 h-3 rounded bg-danger-500"></div>
            <span>含返工原因</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <div className="card p-0 overflow-hidden">
            <div className="h-[500px] bg-gradient-to-b from-gray-50 to-white">
              <Canvas
                camera={{ position: [8, 6, 8], fov: 50 }}
                onClick={() => setSelectedId(null)}
              >
                <Scene
                  data={lateRecords}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              </Canvas>
            </div>
          </div>
        </div>

        <div>
          {selectedRecord ? (
            <div className="card space-y-4">
              <h3 className="text-lg font-serif font-semibold text-primary-800 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-accent-500" />
                记录详情
              </h3>

              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500">人员</p>
                  <p className="text-sm font-medium text-primary-800">
                    {selectedRecord.personName}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">曲目</p>
                  <p className="text-sm text-primary-700">{selectedRecord.trackName}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">排练日期</p>
                  <p className="text-sm text-gray-700">
                    {formatDate(selectedRecord.rehearsalDate)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">迟到时长</p>
                  <p className="text-sm font-medium text-danger-600">
                    {selectedRecord.lateMinutes} 分钟
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">轨道备注</p>
                  <div className="remark-preserve text-sm text-gray-700 mt-1 p-2 bg-gray-50 rounded">
                    {selectedRecord.trackRemark}
                  </div>
                </div>
                {selectedRecord.hasReworkReason && (
                  <div className="p-2 bg-amber-50 border border-amber-200 rounded">
                    <p className="text-xs text-amber-700 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      含返工原因，待版权运营复核
                    </p>
                  </div>
                )}
              </div>

              {selectedTrack && (
                <div className="pt-3 border-t border-gray-100">
                  <p className="text-xs font-medium text-gray-500 mb-2">溯源</p>
                  <div className="space-y-2">
                    <button
                      className="w-full flex items-center gap-2 p-2 hover:bg-primary-50 rounded-lg text-sm text-primary-700 transition-colors"
                      onClick={() => navigate('/aliases')}
                    >
                      <Music className="w-4 h-4" />
                      查看曲目别名表
                      <ExternalLink className="w-3.5 h-3.5 ml-auto" />
                    </button>
                    {selectedContract && (
                      <button
                        className="w-full flex items-center gap-2 p-2 hover:bg-primary-50 rounded-lg text-sm text-primary-700 transition-colors"
                        onClick={() => navigate('/contracts')}
                      >
                        <FileImage className="w-4 h-4" />
                        查看合同页截图
                        <ExternalLink className="w-3.5 h-3.5 ml-auto" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="card h-full flex items-center justify-center">
              <div className="text-center text-gray-400">
                <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">点击左侧柱子查看详情</p>
                <p className="text-xs mt-1">可溯源到曲目别名表和合同截图</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
