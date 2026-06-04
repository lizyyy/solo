import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Canvas, useFrame, ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Html, Sphere, Text } from '@react-three/drei';
import * as THREE from 'three';
import { Info, ArrowRight, AlertTriangle } from 'lucide-react';
import { useAppStore } from '@/store';
import type { VisualizationData } from '@/types';

interface DataPointProps {
  data: VisualizationData;
  onClick: () => void;
  isSelected: boolean;
}

const DataPoint: React.FC<DataPointProps> = ({ data, onClick, isSelected }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    if (meshRef.current) {
      const scale = hovered || isSelected ? 1.5 : 1;
      meshRef.current.scale.setScalar(scale);
      meshRef.current.position.y =
        data.z * 0.5 + Math.sin(state.clock.elapsedTime + data.x) * 0.05;
    }
  });

  const color = data.value >= 90 ? '#10b981' : data.value >= 80 ? '#f59e0b' : '#ef4444';

  return (
    <group position={[data.x * 2 - 5, data.z * 0.5, data.y * 2 - 5]}>
      <Sphere
        ref={meshRef}
        args={[0.3, 32, 32]}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={hovered || isSelected ? 0.5 : 0.2}
          transparent
          opacity={0.9}
        />
      </Sphere>
      {(hovered || isSelected) && (
        <Html center distanceFactor={10}>
          <div className="bg-slate-800 text-white px-3 py-2 rounded-lg text-sm whitespace-nowrap shadow-xl">
            <p className="font-medium">{data.studentName}</p>
            <p className="text-slate-300">得分: {data.value}</p>
          </div>
        </Html>
      )}
    </group>
  );
};

const Scene: React.FC<{
  data: VisualizationData[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}> = ({ data, selectedId, onSelect }) => {
  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <pointLight position={[-10, -10, -10]} intensity={0.5} color="#6366f1" />

      <gridHelper args={[20, 20, '#475569', '#334155']} position={[0, -1, 0]} />

      <Text
        position={[0, 3, -10]}
        fontSize={0.5}
        color="#94a3b8"
        anchorX="center"
        anchorY="middle"
      >
        答案得分分布
      </Text>

      {data.map((item) => (
        <DataPoint
          key={item.answerId}
          data={item}
          onClick={() => onSelect(item.answerId)}
          isSelected={selectedId === item.answerId}
        />
      ))}

      <OrbitControls enableDamping dampingFactor={0.05} />
    </>
  );
};

const Visualization: React.FC = () => {
  const navigate = useNavigate();
  const { visualizationData, studentAnswers } = useAppStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedAnswer = studentAnswers.find((a) => a.id === selectedId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">3D可视化</h1>
          <p className="text-slate-500 mt-1">
            点击数据点查看详情，可旋转、缩放查看三维分布
          </p>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800">服务复核提示</p>
            <p className="text-sm text-amber-700 mt-1">
              点击任意数据点可跳转回原始答案进行复核，支持手算反例验证。
              不要只看漂亮画面，务必结合实际答案内容进行判断。
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-6">
        <div className="col-span-3 bg-slate-900 rounded-xl overflow-hidden" style={{ height: '600px' }}>
          <Canvas
            camera={{ position: [8, 8, 8], fov: 50 }}
            style={{ background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)' }}
          >
            <Scene
              data={visualizationData}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </Canvas>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Info className="w-4 h-4 text-slate-400" />
              图例说明
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full bg-emerald-500" />
                <span className="text-sm text-slate-600">优秀 (≥90分)</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full bg-amber-500" />
                <span className="text-sm text-slate-600">良好 (80-89分)</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full bg-red-500" />
                <span className="text-sm text-slate-600">需改进 (＜80分)</span>
              </div>
            </div>
          </div>

          {selectedAnswer ? (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="font-semibold text-slate-800 mb-4">选中数据点</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-slate-400">学生</p>
                  <p className="font-medium text-slate-800">{selectedAnswer.studentName}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">版本</p>
                  <p className="font-medium text-slate-800">v{selectedAnswer.version}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">提交时间</p>
                  <p className="font-medium text-slate-800">{selectedAnswer.createdAt}</p>
                </div>
                <button
                  onClick={() => navigate(`/answers/${selectedAnswer.id}`)}
                  className="w-full flex items-center justify-center gap-2 mt-4 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors"
                >
                  查看答案详情
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 rounded-xl border border-dashed border-slate-200 p-6 text-center">
              <p className="text-slate-400 text-sm">点击左侧3D图中的数据点</p>
              <p className="text-slate-400 text-sm">查看详细信息</p>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-800 mb-3">操作提示</h3>
            <ul className="space-y-2 text-sm text-slate-600">
              <li className="flex items-start gap-2">
                <span className="text-slate-400">•</span>
                拖拽旋转视角
              </li>
              <li className="flex items-start gap-2">
                <span className="text-slate-400">•</span>
                滚轮缩放
              </li>
              <li className="flex items-start gap-2">
                <span className="text-slate-400">•</span>
                点击数据点选中
              </li>
              <li className="flex items-start gap-2">
                <span className="text-slate-400">•</span>
                跳转答案详情复核
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Visualization;
