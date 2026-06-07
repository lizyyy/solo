import { useState, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import ReactECharts from 'echarts-for-react';
import {
  Map,
  Box,
  PieChart,
  Download,
  Layers,
  ExternalLink,
  MapPin,
  FileText,
  Bus,
  X,
  AlertTriangle,
} from 'lucide-react';
import { useAppStore } from '@/store';
import { showToast } from '@/utils/errorMessageUtils';

function PointMarker({
  position,
  isBoundary,
  isPending,
  onClick,
}: {
  position: [number, number, number];
  isBoundary: boolean;
  isPending: boolean;
  onClick: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 2) * 0.1;
    }
  });

  const color = isPending ? '#F59E0B' : isBoundary ? '#EF4444' : '#10B981';

  return (
    <mesh
      ref={meshRef}
      position={position}
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
      <cylinderGeometry args={[0.15, 0.15, 0.6, 8]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={hovered ? 0.5 : 0.2}
      />
      <mesh position={[0, 0.45, 0]}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={hovered ? 0.8 : 0.4}
        />
      </mesh>
    </mesh>
  );
}

function StreetBoundary({ boundary, color }: { boundary: [number, number][]; color: string }) {
  const points = useMemo(() => {
    const shape = new THREE.Shape();
    boundary.forEach((pt, i) => {
      const x = (pt[0] - 116.35) * 100;
      const z = (pt[1] - 39.95) * 100;
      if (i === 0) shape.moveTo(x, z);
      else shape.lineTo(x, z);
    });
    const geometry = new THREE.ShapeGeometry(shape);
    const positions = geometry.attributes.position;
    const newPositions = new Float32Array(positions.count * 3);
    for (let i = 0; i < positions.count; i++) {
      newPositions[i * 3] = positions.getX(i);
      newPositions[i * 3 + 1] = 0;
      newPositions[i * 3 + 2] = positions.getY(i);
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(newPositions, 3));
    geometry.computeVertexNormals();
    return geometry;
  }, [boundary]);

  return (
    <mesh geometry={points} receiveShadow>
      <meshStandardMaterial color={color} transparent opacity={0.3} side={THREE.DoubleSide} />
    </mesh>
  );
}

function Scene3D({
  onPointClick,
}: {
  onPointClick: (pointId: string) => void;
}) {
  const { points, streets } = useAppStore();

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 20, 10]} intensity={1} castShadow />
      <directionalLight position={[-10, 10, -10]} intensity={0.4} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#F1F5F9" />
      </mesh>

      <gridHelper args={[30, 30, '#CBD5E1', '#E2E8F0']} position={[0, 0, 0]} />

      {streets.map((street, index) => (
        <StreetBoundary
          key={street.id}
          boundary={street.boundary}
          color={index === 0 ? '#DBEAFE' : '#D1FAE5'}
        />
      ))}

      {points.map((point) => {
        const x = (point.lng - 116.35) * 100;
        const z = (point.lat - 39.95) * 100;
        return (
          <PointMarker
            key={point.id}
            position={[x, 0.5, z]}
            isBoundary={point.isBoundary}
            isPending={point.boundaryStatus === 'pending'}
            onClick={() => onPointClick(point.id)}
          />
        );
      })}

      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={5}
        maxDistance={50}
      />
    </>
  );
}

export default function MapView() {
  const { points, streets, busTimeSlots, stallRotations, getPointRemarks } = useAppStore();
  const [viewMode, setViewMode] = useState<'2d' | '3d' | 'chart'>('3d');
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  const selectedPoint = points.find((p) => p.id === selectedPointId);
  const pointRemarks = selectedPointId ? getPointRemarks(selectedPointId) : [];
  const pointSlots = selectedPointId
    ? busTimeSlots.filter((s) => s.relatedPointIds.includes(selectedPointId))
    : [];
  const pointStalls = selectedPointId
    ? stallRotations.filter((s) => s.pointId === selectedPointId)
    : [];

  const getStreetName = (id: string) => streets.find((s) => s.id === id)?.name || id;

  const handleExport = async () => {
    if (!mapRef.current) return;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(mapRef.current);
      const link = document.createElement('a');
      link.download = `早市点位地图_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL();
      link.click();
      showToast('地图导出成功', 'success');
    } catch (e) {
      showToast('导出失败，请重试', 'error');
    }
  };

  const chartOption = {
    tooltip: { trigger: 'item' },
    legend: { bottom: '5%', left: 'center' },
    series: [
      {
        name: '点位分布',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
        label: { show: false },
        emphasis: {
          label: { show: true, fontSize: 16, fontWeight: 'bold' },
        },
        data: [
          { value: points.filter((p) => !p.isBoundary).length, name: '正常点位', itemStyle: { color: '#10B981' } },
          { value: points.filter((p) => p.isBoundary && p.boundaryStatus === 'pending').length, name: '待复核边界点', itemStyle: { color: '#F59E0B' } },
          { value: points.filter((p) => p.isBoundary && p.boundaryStatus === 'confirmed').length, name: '已确认边界点', itemStyle: { color: '#3B82F6' } },
        ],
      },
    ],
  };

  const barOption = {
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'category',
      data: stallRotations.map((s) => s.stallNumber),
    },
    yAxis: { type: 'value', name: '关联时段数' },
    series: [
      {
        data: stallRotations.map((s) => s.busTimeSlotIds.length),
        type: 'bar',
        itemStyle: { color: '#1E40AF', borderRadius: [4, 4, 0, 0] },
      },
    ],
  };

  const Positions2D = () => (
    <div className="relative w-full h-full bg-slate-100 rounded-lg overflow-hidden">
      <svg viewBox="-2 -2 4 4" className="w-full h-full">
        {streets.map((street, index) => {
          const points = street.boundary
            .map(([lng, lat]) => `${(lng - 116.35) * 20},${(39.95 - lat) * 20}`)
            .join(' ');
          return (
            <polygon
              key={street.id}
              points={points}
              fill={index === 0 ? '#DBEAFE' : '#D1FAE5'}
              stroke={index === 0 ? '#93C5FD' : '#6EE7B7'}
              strokeWidth={0.05}
            />
          );
        })}
        {points.map((point) => {
          const x = (point.lng - 116.35) * 20;
          const y = (39.95 - point.lat) * 20;
          const color =
            point.boundaryStatus === 'pending'
              ? '#F59E0B'
              : point.isBoundary
              ? '#EF4444'
              : '#10B981';
          return (
            <g key={point.id} onClick={() => setSelectedPointId(point.id)} className="cursor-pointer">
              <circle cx={x} cy={y} r={0.15} fill={color} stroke="white" strokeWidth={0.05} />
              <text x={x} y={y - 0.25} textAnchor="middle" fontSize={0.2} fill="#334155">
                {point.name.slice(0, 4)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 font-serif">地图展示</h2>
          <p className="text-slate-500 mt-1">查看点位分布，支持2D/3D切换和图表统计</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('2d')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                viewMode === '2d' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              <Map size={16} />
              2D
            </button>
            <button
              onClick={() => setViewMode('3d')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                viewMode === '3d' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              <Box size={16} />
              3D
            </button>
            <button
              onClick={() => setViewMode('chart')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                viewMode === 'chart' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              <PieChart size={16} />
              图表
            </button>
          </div>
          {viewMode !== 'chart' && (
            <button
              onClick={handleExport}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Download size={18} />
              导出地图
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <div
            ref={mapRef}
            className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden"
            style={{ height: viewMode === 'chart' ? '500px' : '500px' }}
          >
            {viewMode === '2d' && <Positions2D />}
            {viewMode === '3d' && (
              <Canvas camera={{ position: [15, 15, 15], fov: 50 }}>
                <Scene3D onPointClick={setSelectedPointId} />
              </Canvas>
            )}
            {viewMode === 'chart' && (
              <div className="p-6 h-full grid grid-cols-2 gap-6">
                <div>
                  <h4 className="text-lg font-semibold text-slate-800 mb-4">点位状态分布</h4>
                  <ReactECharts option={chartOption} style={{ height: '380px' }} />
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-slate-800 mb-4">摊位关联时段数</h4>
                  <ReactECharts option={barOption} style={{ height: '380px' }} />
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-slate-600">正常点位</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span className="text-slate-600">边界待复核</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-slate-600">边界点位</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-3 bg-blue-100 border border-blue-200" />
              <span className="text-slate-600">幸福街道</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-3 bg-green-100 border border-green-200" />
              <span className="text-slate-600">光明街道</span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          {selectedPoint ? (
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 sticky top-6">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-semibold text-slate-800">点位详情</h3>
                <button
                  onClick={() => setSelectedPointId(null)}
                  className="p-1 hover:bg-slate-100 rounded"
                >
                  <X size={18} className="text-slate-400" />
                </button>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <p className="text-sm text-slate-500">点位名称</p>
                  <p className="font-medium text-slate-800">{selectedPoint.name}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">归属街道</p>
                  <p className="text-slate-700">{selectedPoint.streetIds.map(getStreetName).join(' / ')}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">坐标</p>
                  <p className="text-slate-700 font-mono text-sm">
                    {selectedPoint.lng}, {selectedPoint.lat}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">状态</p>
                  {selectedPoint.boundaryStatus === 'pending' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-700 rounded text-sm">
                      <AlertTriangle size={14} />
                      边界待复核
                    </span>
                  ) : selectedPoint.isBoundary ? (
                    <span className="px-2 py-1 bg-red-50 text-red-700 rounded text-sm">边界点位</span>
                  ) : (
                    <span className="px-2 py-1 bg-green-50 text-green-700 rounded text-sm">正常</span>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <p className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <Bus size={14} />
                    关联公交时段 ({pointSlots.length})
                  </p>
                  {pointSlots.length > 0 ? (
                    pointSlots.slice(0, 3).map((slot) => (
                      <div key={slot.id} className="p-2 bg-slate-50 rounded text-sm">
                        <p className="text-slate-700">{slot.routeName} - {slot.date}</p>
                        <p className="text-slate-500 text-xs">{slot.startTime} - {slot.endTime}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-400">暂无关联时段</p>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <p className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <FileText size={14} />
                    红线图备注 ({pointRemarks.length})
                  </p>
                  {pointRemarks.length > 0 ? (
                    <div className="p-2 bg-slate-50 rounded text-sm">
                      <p className="text-slate-700">{pointRemarks[0].content}</p>
                      <p className="text-slate-400 text-xs mt-1">
                        {pointRemarks[0].createdByName} · v{pointRemarks[0].version}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">暂无备注</p>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <p className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <Layers size={14} />
                    关联摊位 ({pointStalls.length})
                  </p>
                  {pointStalls.length > 0 ? (
                    pointStalls.map((stall) => (
                      <div key={stall.id} className="p-2 bg-slate-50 rounded text-sm">
                        <p className="text-slate-700 font-medium">{stall.stallNumber}</p>
                        <p className="text-slate-500 text-xs">{stall.vendorName}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-400">暂无摊位</p>
                  )}
                </div>

                <div className="pt-3 space-y-2">
                  <button
                    onClick={() => {
                      showToast('跳转到公交时段管理', 'success');
                    }}
                    className="w-full py-2 px-3 border border-slate-200 rounded-lg text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                  >
                    <ExternalLink size={14} />
                    查看关联时段
                  </button>
                  <button
                    onClick={() => {
                      showToast('跳转到红线备注管理', 'success');
                    }}
                    className="w-full py-2 px-3 border border-slate-200 rounded-lg text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                  >
                    <ExternalLink size={14} />
                    查看红线备注
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-8 text-center">
              <MapPin size={48} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500">点击地图上的点位</p>
              <p className="text-slate-400 text-sm">查看详细信息和溯源</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
