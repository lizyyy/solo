import { useState, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import ReactECharts from 'echarts-for-react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sphere, Text } from '@react-three/drei';
import * as THREE from 'three';
import {
  Layers,
  PieChart,
  BarChart3,
  MapPin,
  FileText,
  Accessibility,
  Eye,
} from 'lucide-react';
import { useAppStore } from '../store';
import { labelMap } from '../data/mockData';
import { useNavigate } from 'react-router-dom';

function PointMarker({ position, color, label, onClick, status }: any) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 2 + position[0]) * 0.1;
    }
  });

  return (
    <group position={position}>
      <Sphere
        ref={meshRef}
        args={[0.08, 16, 16]}
        position={[0, 0, 0]}
        onClick={onClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={hovered ? 0.5 : 0.2}
          transparent
          opacity={0.9}
        />
      </Sphere>
      {hovered && (
        <Text
          position={[0, 0.25, 0]}
          fontSize={0.12}
          color="#1E293B"
          anchorX="center"
          anchorY="bottom"
          outlineWidth={0.02}
          outlineColor="white"
        >
          {label}
        </Text>
      )}
    </group>
  );
}

function Scene3D({ points, onPointClick }: any) {
  const getPointColor = (status: string) => {
    switch (status) {
      case 'normal': return '#10B981';
      case 'warning': return '#F59E0B';
      case 'pending_review': return '#3B82F6';
      case 'exception': return '#EF4444';
      default: return '#64748b';
    }
  };

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <pointLight position={[-10, -10, -5]} intensity={0.5} />
      
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#e2e8f0" />
      </mesh>

      <mesh position={[0, -0.4, 0]}>
        <boxGeometry args={[12, 0.1, 8]} />
        <meshStandardMaterial color="#cbd5e1" />
      </mesh>

      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[6, 0.05, 4]} />
        <meshStandardMaterial color="#1E3A5F" transparent opacity={0.15} />
      </mesh>

      {points.map((point: any, index: number) => {
        const x = (point.lng - 120.155) * 200;
        const z = (point.lat - 30.276) * 200;
        return (
          <PointMarker
            key={point.id}
            position={[x, 0, z]}
            color={getPointColor(point.status)}
            label={point.name}
            onClick={() => onPointClick(point)}
            status={point.status}
          />
        );
      })}

      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minPolarAngle={0}
        maxPolarAngle={Math.PI / 2.2}
      />
    </>
  );
}

export default function Visualization() {
  const navigate = useNavigate();
  const { points, notices, ramps } = useAppStore();
  const [viewMode, setViewMode] = useState<'3d' | 'chart'>('3d');
  const [chartType, setChartType] = useState<'pie' | 'bar'>('pie');

  const statusStats = useMemo(() => {
    const stats: Record<string, number> = {
      normal: 0,
      warning: 0,
      pending_review: 0,
      exception: 0,
    };
    points.forEach(p => stats[p.status]++);
    return stats;
  }, [points]);

  const typeStats = useMemo(() => {
    const stats: Record<string, number> = {
      notice: 0,
      ramp: 0,
      both: 0,
    };
    points.forEach(p => stats[p.type]++);
    return stats;
  }, [points]);

  const pieOption = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)'
    },
    legend: {
      orient: 'vertical',
      left: 'left',
    },
    series: [
      {
        name: '点位状态',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: false,
          position: 'center'
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 20,
            fontWeight: 'bold'
          }
        },
        labelLine: {
          show: false
        },
        data: [
          { value: statusStats.normal, name: '正常', itemStyle: { color: '#10B981' } },
          { value: statusStats.warning, name: '预警', itemStyle: { color: '#F59E0B' } },
          { value: statusStats.pending_review, name: '待复核', itemStyle: { color: '#3B82F6' } },
          { value: statusStats.exception, name: '异常', itemStyle: { color: '#EF4444' } },
        ]
      }
    ]
  };

  const barOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: ['正常', '预警', '待复核', '异常'],
      axisLabel: {
        color: '#64748b'
      }
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: '#64748b'
      }
    },
    series: [
      {
        name: '点位数量',
        type: 'bar',
        barWidth: '50%',
        data: [
          { value: statusStats.normal, itemStyle: { color: '#10B981' } },
          { value: statusStats.warning, itemStyle: { color: '#F59E0B' } },
          { value: statusStats.pending_review, itemStyle: { color: '#3B82F6' } },
          { value: statusStats.exception, itemStyle: { color: '#EF4444' } },
        ]
      }
    ]
  };

  const handlePointClick = (point: any) => {
    if (point.noticeId) {
      navigate('/notices');
    } else if (point.rampId) {
      navigate('/ramps');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-slate-800">可视化看板</h2>
          <p className="text-slate-500 text-sm mt-1">3D 地图和图表展示，点击点位可溯源查看原始记录</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('3d')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              viewMode === '3d' ? 'bg-primary text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-4 h-4" />
            3D 地图
          </button>
          <button
            onClick={() => setViewMode('chart')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              viewMode === 'chart' ? 'bg-primary text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            统计图表
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{points.length}</p>
              <p className="text-sm text-slate-500">点位总数</p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{notices.length}</p>
              <p className="text-sm text-slate-500">施工告示</p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Accessibility className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{ramps.length}</p>
              <p className="text-sm text-slate-500">坡道记录</p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-rose-50 flex items-center justify-center">
              <Eye className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{points.filter(p => !p.detourSynced).length}</p>
              <p className="text-sm text-slate-500">未同步改道</p>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        {viewMode === '3d' ? (
          <div className="h-[500px]">
            <Canvas camera={{ position: [5, 5, 5], fov: 50 }}>
              <Scene3D points={points} onPointClick={handlePointClick} />
            </Canvas>
            <div className="p-4 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-sm text-slate-600">正常</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <span className="text-sm text-slate-600">预警</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="text-sm text-slate-600">待复核</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500" />
                  <span className="text-sm text-slate-600">异常</span>
                </div>
              </div>
              <p className="text-xs text-slate-400">💡 悬停点位查看名称，点击溯源至原始记录</p>
            </div>
          </div>
        ) : (
          <div className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => setChartType('pie')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  chartType === 'pie' ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <PieChart className="w-4 h-4" />
                饼图
              </button>
              <button
                onClick={() => setChartType('bar')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  chartType === 'bar' ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                柱状图
              </button>
            </div>
            <div className="h-[400px]">
              <ReactECharts
                option={chartType === 'pie' ? pieOption : barOption}
                style={{ height: '100%', width: '100%' }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
        <p className="text-sm text-blue-800">
          💡 <strong>点击溯源：</strong>在 3D 视图中点击任意点位，可跳转到对应的施工告示或无障碍坡道记录页面查看详细信息。不仅仅是漂亮的可视化画面，更能回溯数据源头。
        </p>
      </div>
    </motion.div>
  );
}
