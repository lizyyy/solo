import { useState, useRef, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sphere, Text } from '@react-three/drei';
import * as THREE from 'three';
import {
  BarChart3,
  Box,
  Link2,
  FileText,
  ExternalLink,
  Info
} from 'lucide-react';
import { useAppStore } from '../store';

interface DataPoint {
  x: number;
  y: number;
  z: number;
  metricName: string;
  threshold: number;
  report: number;
  playbackId: string;
  noteId: string;
  bucketUrl?: string;
}

function DataPointSphere({
  point,
  onClick,
  isSelected
}: {
  point: DataPoint;
  onClick: () => void;
  isSelected: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const hasAnomaly = point.threshold !== point.report;

  useFrame((state) => {
    if (meshRef.current && isSelected) {
      meshRef.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 3) * 0.1);
    }
  });

  return (
    <group position={[point.x, point.y, point.z]}>
      <Sphere
        ref={meshRef}
        args={[hasAnomaly ? 0.4 : 0.3, 32, 32]}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        <meshStandardMaterial
          color={hasAnomaly ? '#ff6b35' : '#10B981'}
          emissive={hasAnomaly ? '#ff6b35' : '#10B981'}
          emissiveIntensity={isSelected ? 0.5 : 0.2}
          transparent
          opacity={0.9}
        />
      </Sphere>
      <Text
        position={[0, 0.6, 0]}
        fontSize={0.25}
        color="#333"
        anchorX="center"
        anchorY="bottom"
      >
        {point.metricName}
      </Text>
    </group>
  );
}

function Scene({
  dataPoints,
  selectedPoint,
  onSelectPoint
}: {
  dataPoints: DataPoint[];
  selectedPoint: DataPoint | null;
  onSelectPoint: (point: DataPoint) => void;
}) {
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <pointLight position={[-10, -10, -5]} intensity={0.5} />
      <gridHelper args={[20, 20, '#ccc', '#eee']} />

      <Text position={[10, 0.1, 0]} fontSize={0.3} color="#666" anchorX="center">
        阈值
      </Text>
      <Text position={[0, 0.1, 10]} fontSize={0.3} color="#666" anchorX="center">
        报告值
      </Text>
      <Text position={[0, 6, 0]} fontSize={0.3} color="#666" anchorX="center">
        时间
      </Text>

      {dataPoints.map((point, index) => (
        <DataPointSphere
          key={index}
          point={point}
          onClick={() => onSelectPoint(point)}
          isSelected={selectedPoint?.metricName === point.metricName && selectedPoint?.x === point.x}
        />
      ))}

      <OrbitControls enableDamping dampingFactor={0.05} />
    </>
  );
}

export const VisualizationPage = () => {
  const { playbackRecords, getBucketsByPlaybackId } = useAppStore();
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
  const [selectedPoint, setSelectedPoint] = useState<DataPoint | null>(null);

  const chartData = playbackRecords.flatMap(record =>
    record.thresholds.map(t => ({
      name: `${record.noteId} - ${t.metricName}`,
      threshold: t.thresholdValue,
      report: t.reportValue,
      isConsistent: t.isConsistent,
      playbackId: record.id,
      noteId: record.noteId,
      fileName: record.fileName
    }))
  );

  const dataPoints3D: DataPoint[] = playbackRecords.flatMap((record, recordIndex) =>
    record.thresholds.map((t, thresholdIndex) => ({
      x: t.thresholdValue * 100,
      y: recordIndex * 2 + 1,
      z: t.reportValue * 100,
      metricName: t.metricName,
      threshold: t.thresholdValue,
      report: t.reportValue,
      playbackId: record.id,
      noteId: record.noteId,
      bucketUrl: getBucketsByPlaybackId(record.id)[0]?.bucketUrl
    }))
  );

  const option2D = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross'
      }
    },
    legend: {
      data: ['阈值', '报告值', '不一致标记'],
      top: 10
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: chartData.map(d => d.name),
      axisLabel: {
        rotate: 30,
        fontSize: 10
      }
    },
    yAxis: {
      type: 'value',
      name: '数值'
    },
    series: [
      {
        name: '阈值',
        type: 'bar',
        data: chartData.map(d => d.threshold),
        itemStyle: {
          color: '#1e3a5f'
        }
      },
      {
        name: '报告值',
        type: 'bar',
        data: chartData.map(d => d.report),
        itemStyle: {
          color: '#627d98'
        }
      },
      {
        name: '不一致标记',
        type: 'scatter',
        data: chartData.map(d => d.isConsistent ? null : Math.max(d.threshold, d.report) + 0.01),
        itemStyle: {
          color: '#ff6b35',
          fontSize: 20
        },
        symbolSize: 15
      }
    ]
  };

  const onChartClick = (params: any) => {
    const dataIndex = params.dataIndex;
    if (chartData[dataIndex]) {
      const item = chartData[dataIndex];
      const buckets = getBucketsByPlaybackId(item.playbackId);
      setSelectedPoint({
        x: dataIndex,
        y: item.threshold,
        z: item.report,
        metricName: item.name,
        threshold: item.threshold,
        report: item.report,
        playbackId: item.playbackId,
        noteId: item.noteId,
        bucketUrl: buckets[0]?.bucketUrl
      });
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 font-display mb-2">可视化展示</h1>
          <p className="text-gray-500">
            以图表或3D方式展示阈值变化趋势，点击数据点可回溯原始数据
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('2d')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              viewMode === '2d'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            2D图表
          </button>
          <button
            onClick={() => setViewMode('3d')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              viewMode === '3d'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Box className="w-4 h-4" />
            3D展示
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            {viewMode === '2d' ? (
              <ReactECharts
                option={option2D}
                style={{ height: '500px' }}
                onEvents={{ click: onChartClick }}
              />
            ) : (
              <div className="bg-primary-900/5 rounded-xl" style={{ height: '500px' }}>
                <Canvas camera={{ position: [15, 10, 15], fov: 50 }}>
                  <Scene
                    dataPoints={dataPoints3D}
                    selectedPoint={selectedPoint}
                    onSelectPoint={setSelectedPoint}
                  />
                </Canvas>
                <p className="text-center text-xs text-gray-400 mt-2">
                  鼠标拖拽旋转视角，滚轮缩放，橙色球体表示阈值与报告值不一致
                </p>
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sticky top-6">
            <h3 className="text-lg font-semibold text-gray-800 font-display mb-4">
              数据详情
            </h3>

            {selectedPoint ? (
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">指标名称</p>
                  <p className="font-medium text-gray-800">{selectedPoint.metricName}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-orange-50 rounded-lg">
                    <p className="text-xs text-orange-600 mb-1">实际阈值</p>
                    <p className="font-mono font-bold text-orange-700">{selectedPoint.threshold}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">报告值</p>
                    <p className="font-mono font-bold text-gray-600 line-through">{selectedPoint.report}</p>
                  </div>
                </div>

                {selectedPoint.threshold !== selectedPoint.report && (
                  <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-orange-700">
                        阈值已修改但报告仍写旧值，需数据科学家复核
                      </p>
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-gray-200 space-y-2">
                  <p className="text-sm font-medium text-gray-700 mb-3">快速跳转</p>
                  <a
                    href={`/playbacks/${selectedPoint.playbackId}`}
                    className="flex items-center gap-2 p-3 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors text-primary-700"
                  >
                    <FileText className="w-4 h-4" />
                    <span className="text-sm">查看调参笔记详情</span>
                    <ExternalLink className="w-3 h-3 ml-auto" />
                  </a>
                  {selectedPoint.bucketUrl && (
                    <a
                      href={selectedPoint.bucketUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-3 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors text-primary-700"
                    >
                      <Link2 className="w-4 h-4" />
                      <span className="text-sm">打开线上实验桶</span>
                      <ExternalLink className="w-3 h-3 ml-auto" />
                    </a>
                  )}
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <p className="text-xs text-gray-500">
                    笔记ID: <span className="font-mono">{selectedPoint.noteId}</span>
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">点击图表中的数据点查看详情</p>
              </div>
            )}
          </div>

          <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">图例说明</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-green-500"></span>
                <span className="text-sm text-gray-600">阈值与报告值一致</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-orange-500"></span>
                <span className="text-sm text-gray-600">阈值已改但报告写旧值</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
