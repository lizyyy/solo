import { useRef, useState, Suspense, Component, ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle,
  Camera,
  ChevronRight,
  X,
  Zap,
  MapPin,
  Loader2,
  Merge,
  History,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { DeviceData, Anomaly, ANOMALY_TYPE_LABELS } from '../types';

class SceneErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: string | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900 rounded-2xl">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mb-4" />
          <h3 className="text-white font-medium mb-2">3D场景加载异常</h3>
          <p className="text-gray-400 text-sm mb-4">可以在右侧列表查看和处理异常</p>
          <p className="text-gray-500 text-xs">{this.state.error?.slice(0, 50)}...</p>
        </div>
      );
    }
    return this.props.children;
  }
}

function FloorMesh({ floor, isSelected, hasAnomaly, onClick, position }: any) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    if (meshRef.current && hasAnomaly && !isSelected) {
      const scale = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.02;
      meshRef.current.scale.setScalar(scale);
    }
  });

  const color = isSelected
    ? '#3b82f6'
    : hasAnomaly
      ? hovered
        ? '#fca5a5'
        : '#ef4444'
      : hovered
        ? '#93c5fd'
        : '#60a5fa';

  return (
    <mesh
      ref={meshRef}
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <boxGeometry args={[10, 0.3, 8]} />
      <meshStandardMaterial color={color} transparent opacity={isSelected ? 0.9 : 0.7} />
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(10, 0.3, 8)]} />
        <lineBasicMaterial color="#1e3a5f" linewidth={2} />
      </lineSegments>
    </mesh>
  );
}

function DeviceMarker({ device, anomalies, isSelected, onClick }: any) {
  const meshRef = useRef<THREE.Mesh>(null);
  const hasHighAnomaly = anomalies.some(
    (a: Anomaly) => a.deviceId === device.id && !a.resolved && a.severity === 'high'
  );
  const hasMediumAnomaly = anomalies.some(
    (a: Anomaly) => a.deviceId === device.id && !a.resolved && a.severity === 'medium'
  );

  useFrame((state) => {
    if (meshRef.current && hasHighAnomaly) {
      meshRef.current.position.y = device.position.y + 0.5 + Math.sin(state.clock.elapsedTime * 3) * 0.1;
    }
  });

  let color = '#10b981';
  if (hasHighAnomaly) color = '#ef4444';
  else if (hasMediumAnomaly) color = '#f59e0b';

  const aliasBadge = device.aliasNames && device.aliasNames.length > 0;

  return (
    <group position={[device.position.x, device.position.y, device.position.z]}>
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onClick(device);
        }}
      >
        <sphereGeometry args={[0.25, 16, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={hasHighAnomaly ? 0.5 : 0.2} />
      </mesh>
      {isSelected && (
        <Html position={[0, 0.6, 0]} center>
          <div className="bg-white rounded-lg shadow-xl p-2 min-w-[140px] border border-gray-200">
            <p className="font-medium text-gray-800 text-sm">{device.name || '未命名设备'}</p>
            <p className="text-xs text-gray-500">能耗: {device.energyConsumption}kWh</p>
            <p className="text-xs text-gray-500">{device.floor}F</p>
            {aliasBadge && (
              <p className="text-xs text-purple-600 mt-1">含别名: {device.aliasNames.slice(0, 2).join('、')}</p>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}

function BuildingScene() {
  const currentSolution = useAppStore((state) => state.currentSolution);
  const selectedFloor = useAppStore((state) => state.selectedFloor);
  const selectedDevice = useAppStore((state) => state.selectedDevice);
  const setSelectedFloor = useAppStore((state) => state.setSelectedFloor);
  const setSelectedDevice = useAppStore((state) => state.setSelectedDevice);

  if (!currentSolution) return null;

  const floors = [1, 2, 3];
  const floorHeight = 3;

  const floorHasAnomaly = (floor: number) => {
    const floorDevices = currentSolution.devices.filter((d) => d.floor === floor);
    return floorDevices.some((d) => currentSolution.anomalies.some((a) => a.deviceId === d.id && !a.resolved));
  };

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 20, 10]} intensity={1} castShadow />
      <pointLight position={[0, 10, 0]} intensity={0.5} color="#60a5fa" />

      <gridHelper args={[30, 30, '#374151', '#1f2937']} position={[0, -0.5, 0]} />

      {floors.map((floor) => (
        <FloorMesh
          key={floor}
          floor={floor}
          isSelected={selectedFloor === floor}
          hasAnomaly={floorHasAnomaly(floor)}
          onClick={() => setSelectedFloor(selectedFloor === floor ? null : floor)}
          position={[0, (floor - 1) * floorHeight, 0]}
        />
      ))}

      {currentSolution.devices.map((device) => (
        <DeviceMarker
          key={device.id}
          device={device}
          anomalies={currentSolution.anomalies}
          isSelected={selectedDevice?.id === device.id}
          onClick={(d: DeviceData) => setSelectedDevice(selectedDevice?.id === d.id ? null : d)}
        />
      ))}

      <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} minDistance={5} maxDistance={30} autoRotate={false} />
    </>
  );
}

export default function ScenePage() {
  const navigate = useNavigate();
  const currentSolution = useAppStore((state) => state.currentSolution);
  const selectedFloor = useAppStore((state) => state.selectedFloor);
  const selectedDevice = useAppStore((state) => state.selectedDevice);
  const setSelectedDevice = useAppStore((state) => state.setSelectedDevice);
  const resolveAnomaly = useAppStore((state) => state.resolveAnomaly);
  const mergeSameDevice = useAppStore((state) => state.mergeSameDevice);
  const [resolveRemark, setResolveRemark] = useState('');
  const [resolvingAnomaly, setResolvingAnomaly] = useState<string | null>(null);
  const [showMergePanel, setShowMergePanel] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState<string>('');
  const [canonicalName, setCanonicalName] = useState('');
  const [activeTab, setActiveTab] = useState<'devices' | 'logs'>('devices');

  if (!currentSolution) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center">
        <Camera className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-600 mb-2">请先导入数据</h2>
        <p className="text-gray-400 mb-6">返回导入页面上传或选择样例数据</p>
        <button onClick={() => navigate('/')} className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
          前往导入
        </button>
      </div>
    );
  }

  const floorDevices = selectedFloor ? currentSolution.devices.filter((d) => d.floor === selectedFloor) : currentSolution.devices;

  const deviceAnomalies = selectedDevice ? currentSolution.anomalies.filter((a) => a.deviceId === selectedDevice.id) : [];

  const sameDeviceAnomaly = deviceAnomalies.find((a) => a.type === 'same_device_different_name' && !a.resolved);
  const relatedDevice = sameDeviceAnomaly?.relatedDeviceId
    ? currentSolution.devices.find((d) => d.id === sameDeviceAnomaly.relatedDeviceId)
    : null;

  const handleResolve = (anomalyId: string) => {
    resolveAnomaly(anomalyId, resolveRemark);
    setResolveRemark('');
    setResolvingAnomaly(null);
  };

  const handleOpenMerge = () => {
    setShowMergePanel(true);
    setMergeTargetId(relatedDevice?.id || '');
    setCanonicalName(selectedDevice?.name || '');
  };

  const handleConfirmMerge = () => {
    if (!selectedDevice || !mergeTargetId) return;
    mergeSameDevice(selectedDevice.id, mergeTargetId, canonicalName.trim() || selectedDevice.name);
    setShowMergePanel(false);
    setCanonicalName('');
  };

  const operationLogs = (currentSolution.operationLogs || []).slice().sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));

  return (
    <div className="h-full flex gap-6">
      <div className="flex-1 bg-gray-900 rounded-2xl overflow-hidden relative">
        <div className="absolute top-4 left-4 z-10 bg-black/50 backdrop-blur-sm rounded-lg px-3 py-2">
          <p className="text-white text-sm font-medium">3D 楼宇视图</p>
          <p className="text-gray-300 text-xs">拖拽旋转 · 滚轮缩放 · 点击选择</p>
        </div>

        {selectedFloor && (
          <div className="absolute top-4 right-4 z-10 bg-primary-600 text-white rounded-lg px-3 py-2">
            <p className="text-sm font-medium">{selectedFloor}F 已选中</p>
          </div>
        )}

        <SceneErrorBoundary>
          <Suspense
            fallback={
              <div className="w-full h-full flex items-center justify-center bg-gray-900">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              </div>
            }
          >
            <Canvas camera={{ position: [15, 12, 15], fov: 50 }} style={{ width: '100%', height: '100%' }} gl={{ antialias: true, alpha: false }}>
              <color attach="background" args={['#111827']} />
              <fog attach="fog" args={['#111827', 20, 40]} />
              <BuildingScene />
            </Canvas>
          </Suspense>
        </SceneErrorBoundary>
      </div>

      <div className="w-96 flex flex-col gap-4">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('devices')}
            className={`flex-1 py-2 rounded-xl font-medium text-sm transition-colors ${
              activeTab === 'devices' ? 'bg-primary-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <MapPin className="w-4 h-4 inline mr-1" />
            设备与异常
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`flex-1 py-2 rounded-xl font-medium text-sm transition-colors ${
              activeTab === 'logs' ? 'bg-primary-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <History className="w-4 h-4 inline mr-1" />
            操作记录 ({operationLogs.length})
          </button>
        </div>

        {activeTab === 'devices' ? (
          <>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary-600" />
                设备列表
                {selectedFloor && <span className="text-sm font-normal text-gray-500">({selectedFloor}F)</span>}
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin">
                {floorDevices.map((device) => {
                  const deviceAnomalyCount = currentSolution.anomalies.filter(
                    (a) => a.deviceId === device.id && !a.resolved
                  ).length;
                  const hasSameDev = currentSolution.anomalies.some(
                    (a) => a.deviceId === device.id && a.type === 'same_device_different_name' && !a.resolved
                  );

                  return (
                    <div
                      key={device.id}
                      onClick={() => setSelectedDevice(device)}
                      className={`p-3 rounded-xl cursor-pointer transition-all ${
                        selectedDevice?.id === device.id
                          ? 'bg-primary-50 border-2 border-primary-500'
                          : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-800 text-sm">
                            {device.name || '未命名设备'}
                            {hasSameDev && (
                              <span className="ml-1 text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                                疑似重复
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-gray-500">
                            {device.floor}F · {device.energyConsumption}kWh
                          </p>
                          {device.aliasNames && device.aliasNames.length > 0 && (
                            <p className="text-[11px] text-purple-600 mt-0.5">别名: {device.aliasNames.join('、')}</p>
                          )}
                        </div>
                        {deviceAnomalyCount > 0 ? (
                          <span className="flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">
                            <AlertTriangle className="w-3 h-3" />
                            {deviceAnomalyCount}
                          </span>
                        ) : (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {selectedDevice && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 flex-1 overflow-y-auto scrollbar-thin">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-accent-orange" />
                    异常详情
                  </h3>
                  <button onClick={() => setSelectedDevice(null)} className="p-1 hover:bg-gray-100 rounded">
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                </div>

                <div className="mb-4 p-3 bg-gray-50 rounded-xl">
                  <p className="font-medium text-gray-800">{selectedDevice.name || '未命名设备'}</p>
                  <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-gray-500">
                    <span>楼层: {selectedDevice.floor}F</span>
                    <span>能耗: {selectedDevice.energyConsumption}kWh</span>
                    <span>X: {selectedDevice.position.x.toFixed(2)}m</span>
                    <span>Y: {selectedDevice.position.y.toFixed(2)}m</span>
                  </div>
                  {selectedDevice.photo ? (
                    <img src={selectedDevice.photo} alt="设备照片" className="mt-3 w-full h-24 object-cover rounded-lg" />
                  ) : (
                    <div className="mt-3 w-full h-24 bg-gray-200 rounded-lg flex items-center justify-center">
                      <Camera className="w-6 h-6 text-gray-400" />
                      <span className="text-sm text-gray-400 ml-2">无照片</span>
                    </div>
                  )}
                </div>

                {sameDeviceAnomaly && relatedDevice && (
                  <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <Merge className="w-4 h-4 text-purple-600" />
                      <p className="text-sm font-medium text-purple-800">异名同设备识别</p>
                    </div>
                    <p className="text-xs text-purple-700 mb-2">
                      疑似与 <strong>{relatedDevice.name}</strong> 为同一物理设备
                    </p>
                    <p className="text-xs text-purple-600 mb-3">{sameDeviceAnomaly.description}</p>
                    {!showMergePanel ? (
                      <button
                        onClick={handleOpenMerge}
                        className="w-full py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 flex items-center justify-center gap-1"
                      >
                        <Merge className="w-3.5 h-3.5" />
                        合并为同一设备
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <div>
                          <label className="text-xs text-gray-600 block mb-1">选择保留的目标设备</label>
                          <select
                            value={mergeTargetId}
                            onChange={(e) => setMergeTargetId(e.target.value)}
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                          >
                            <option value="">请选择...</option>
                            <option value={relatedDevice.id}>{relatedDevice.name || '未命名'}</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-gray-600 block mb-1">规范名称（合并后的统一名称）</label>
                          <input
                            type="text"
                            value={canonicalName}
                            onChange={(e) => setCanonicalName(e.target.value)}
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                            placeholder="输入规范设备名"
                          />
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => setShowMergePanel(false)}
                            className="flex-1 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                          >
                            取消
                          </button>
                          <button
                            onClick={handleConfirmMerge}
                            disabled={!mergeTargetId}
                            className="flex-1 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                          >
                            确认合并
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-3 overflow-y-auto scrollbar-thin">
                  {deviceAnomalies.length > 0 ? (
                    deviceAnomalies.map((anomaly) => (
                      <div
                        key={anomaly.id}
                        className={`p-3 rounded-xl ${
                          anomaly.resolved ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {anomaly.resolved ? (
                                <CheckCircle className="w-4 h-4 text-green-600" />
                              ) : (
                                <AlertTriangle className="w-4 h-4 text-red-600" />
                              )}
                              <span className="text-xs bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded">
                                {ANOMALY_TYPE_LABELS[anomaly.type] || anomaly.type}
                              </span>
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full ${
                                  anomaly.severity === 'high'
                                    ? 'bg-red-200 text-red-800'
                                    : anomaly.severity === 'medium'
                                      ? 'bg-orange-200 text-orange-800'
                                      : 'bg-gray-200 text-gray-800'
                                }`}
                              >
                                {anomaly.severity === 'high' ? '高' : anomaly.severity === 'medium' ? '中' : '低'}
                              </span>
                            </div>
                            <p className="text-sm text-gray-700 mt-1">{anomaly.description}</p>
                            {anomaly.remark && (
                              <p className="text-xs text-gray-500 mt-1">
                                备注: {anomaly.remark}
                              </p>
                            )}
                            {anomaly.resolvedAt && (
                              <p className="text-xs text-gray-400 mt-0.5">
                                处理于 {new Date(anomaly.resolvedAt).toLocaleString()}
                              </p>
                            )}
                          </div>
                        </div>
                        {!anomaly.resolved && resolvingAnomaly === anomaly.id ? (
                          <div className="mt-3 space-y-2">
                            <input
                              type="text"
                              value={resolveRemark}
                              onChange={(e) => setResolveRemark(e.target.value)}
                              placeholder="输入处理备注（原因说明）..."
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => setResolvingAnomaly(null)}
                                className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                              >
                                取消
                              </button>
                              <button
                                onClick={() => handleResolve(anomaly.id)}
                                className="flex-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                              >
                                标记已处理
                              </button>
                            </div>
                          </div>
                        ) : !anomaly.resolved && anomaly.type !== 'same_device_different_name' ? (
                          <button
                            onClick={() => setResolvingAnomaly(anomaly.id)}
                            className="mt-2 text-xs text-primary-600 hover:text-primary-700"
                          >
                            处理此异常 →
                          </button>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6">
                      <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">该设备无异常</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 flex-1 overflow-y-auto scrollbar-thin">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <History className="w-5 h-5 text-primary-600" />
              操作历史记录
            </h3>
            {operationLogs.length === 0 ? (
              <div className="text-center py-10">
                <History className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">暂无操作记录</p>
              </div>
            ) : (
              <div className="space-y-3">
                {operationLogs.map((log) => (
                  <div key={log.id} className="p-3 bg-gray-50 rounded-xl border-l-4 border-primary-400">
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          log.type === 'device_merged'
                            ? 'bg-purple-100 text-purple-700'
                            : log.type === 'anomaly_resolved'
                              ? 'bg-green-100 text-green-700'
                              : log.type === 'remark_added'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {log.type === 'device_merged'
                          ? '设备合并'
                          : log.type === 'anomaly_resolved'
                            ? '异常处理'
                            : log.type === 'remark_added'
                              ? '添加备注'
                              : log.type === 'config_updated'
                                ? '参数更新'
                                : log.type}
                      </span>
                      <span className="text-[11px] text-gray-400">{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-gray-700 mt-2">{log.description}</p>
                    <p className="text-xs text-gray-500 mt-1">操作人: {log.operator}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <button
          onClick={() => navigate('/report')}
          className="flex items-center justify-center gap-2 w-full py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors"
        >
          生成报告
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
