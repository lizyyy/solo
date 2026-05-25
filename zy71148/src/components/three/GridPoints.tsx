import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useThree, ThreeEvent } from '@react-three/fiber';
import { useAppStore } from '../../store';
import { getStatusColor, hexToRgb } from '../../utils/colors';
import { formatTime } from '../../utils/statistics';

export const GridPoints = () => {
  const data = useAppStore((state) => state.data);
  const currentTimeIndex = useAppStore((state) => state.currentTimeIndex);
  const showGrid = useAppStore((state) => state.showGrid);
  const hoveredPoint = useAppStore((state) => state.hoveredPoint);
  const selectedGridIds = useAppStore((state) => state.selectedGridIds);
  const setHoveredPoint = useAppStore((state) => state.setHoveredPoint);
  const setGridPointDetail = useAppStore((state) => state.setGridPointDetail);
  const { camera, gl } = useThree();
  const raycaster = useRef(new THREE.Raycaster());
  const mouse = useRef(new THREE.Vector2());

  const points = useMemo(() => {
    if (!data || !showGrid) return null;

    const snapshot = data.snapshots[currentTimeIndex];
    const instancedMesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.25, 16, 16),
      new THREE.MeshStandardMaterial({
        emissive: '#ffffff',
        emissiveIntensity: 0.3,
      }),
      data.gridPoints.length
    );

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    data.gridPoints.forEach((point, index) => {
      const sample = snapshot.thicknessSamples.find((s) => s.gridId === point.id);
      const status = sample?.status || 'missing';
      const col = getStatusColor(status);

      const height = sample ? sample.thickness * 0.1 + 0.3 : 0.5;

      dummy.position.set(point.x, height, point.y);

      if (point.id === hoveredPoint || selectedGridIds.includes(point.id)) {
        dummy.scale.set(1.5, 1.5, 1.5);
      } else {
        dummy.scale.set(1, 1, 1);
      }

      dummy.updateMatrix();
      instancedMesh.setMatrixAt(index, dummy.matrix);

      const rgb = hexToRgb(col);
      color.setRGB(rgb.r, rgb.g, rgb.b);
      instancedMesh.setColorAt(index, color);
    });

    instancedMesh.instanceMatrix.needsUpdate = true;
    if (instancedMesh.instanceColor) {
      instancedMesh.instanceColor.needsUpdate = true;
    }

    return instancedMesh;
  }, [data, currentTimeIndex, showGrid, hoveredPoint, selectedGridIds]);

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (!data || !showGrid) return;

    e.stopPropagation();

    const rect = gl.domElement.getBoundingClientRect();
    mouse.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.current.setFromCamera(mouse.current, camera);

    const intersects = raycaster.current.intersectObject(points!);

    if (intersects.length > 0) {
      const instanceId = intersects[0].instanceId;
      if (instanceId !== undefined && data) {
        const point = data.gridPoints[instanceId];
        const snapshot = data.snapshots[currentTimeIndex];
        const sample = snapshot.thicknessSamples.find((s) => s.gridId === point.id);

        setGridPointDetail({
          gridId: point.id,
          x: point.x,
          y: point.y,
          thickness: sample?.thickness || 0,
          status: sample?.status || 'missing',
          timestamp: snapshot.timestamp,
        });
      }
    }
  };

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    if (!data || !showGrid) return;

    e.stopPropagation();

    const rect = gl.domElement.getBoundingClientRect();
    mouse.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.current.setFromCamera(mouse.current, camera);

    const intersects = raycaster.current.intersectObject(points!);

    if (intersects.length > 0) {
      const instanceId = intersects[0].instanceId;
      if (instanceId !== undefined && data) {
        setHoveredPoint(data.gridPoints[instanceId].id);
      }
    }
  };

  const handlePointerOut = () => {
    setHoveredPoint(null);
  };

  if (!points) return null;

  return (
    <>
      <primitive
        object={points}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      />
      <SamplingPointDetailModal />
    </>
  );
};

const SamplingPointDetailModal = () => {
  const gridPointDetail = useAppStore((state) => state.gridPointDetail);
  const setGridPointDetail = useAppStore((state) => state.setGridPointDetail);
  const data = useAppStore((state) => state.data);

  if (!gridPointDetail || !data) return null;

  const statusColors: Record<string, string> = {
    normal: 'bg-green-500',
    warning: 'bg-yellow-500',
    critical: 'bg-red-500',
    missing: 'bg-gray-500',
  };

  const statusLabels: Record<string, string> = {
    normal: '正常',
    warning: '警告',
    critical: '危险',
    missing: '缺失',
  };

  const historicalSamples = data.snapshots
    .map((snapshot) => {
      const sample = snapshot.thicknessSamples.find((s) => s.gridId === gridPointDetail.gridId);
      return sample ? { timestamp: snapshot.timestamp, thickness: sample.thickness, status: sample.status } : null;
    })
    .filter(Boolean)
    .slice(-5);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setGridPointDetail(null)}>
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-cyan-400">采样点详情</h3>
          <button onClick={() => setGridPointDetail(null)} className="text-slate-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-slate-400 mb-1">采样点 ID</div>
              <div className="text-sm font-mono text-white">{gridPointDetail.gridId}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1">坐标位置</div>
              <div className="text-sm font-mono text-white">({gridPointDetail.x.toFixed(1)}, {gridPointDetail.y.toFixed(1)})</div>
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1">当前厚度</div>
              <div className={`text-xl font-bold ${gridPointDetail.thickness < data.rink.thicknessThreshold ? 'text-red-400' : 'text-green-400'}`}>
                {gridPointDetail.thickness.toFixed(1)} mm
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1">状态</div>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${statusColors[gridPointDetail.status]}`}></div>
                <span className="text-sm text-white">{statusLabels[gridPointDetail.status]}</span>
              </div>
            </div>
            <div className="col-span-2">
              <div className="text-xs text-slate-400 mb-1">采样时间</div>
              <div className="text-sm font-mono text-white">{formatTime(gridPointDetail.timestamp)}</div>
            </div>
          </div>

          <div className="border-t border-slate-700 pt-4">
            <div className="text-xs text-slate-400 mb-2">最近 5 次采样记录</div>
            <div className="space-y-2">
              {historicalSamples.map((sample, index) => (
                <div key={index} className="flex items-center justify-between bg-slate-800 rounded-lg px-3 py-2">
                  <span className="text-xs font-mono text-slate-400">{formatTime(sample!.timestamp)}</span>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-mono ${sample!.thickness < data.rink.thicknessThreshold ? 'text-red-400' : 'text-white'}`}>
                      {sample!.thickness.toFixed(1)} mm
                    </span>
                    <div className={`w-2 h-2 rounded-full ${statusColors[sample!.status]}`}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg p-3">
            <div className="text-xs text-slate-400 mb-1">阈值参考</div>
            <div className="text-sm text-white">
              最小阈值: <span className="text-red-400 font-mono">{data.rink.thicknessThreshold} mm</span>
            </div>
            <div className="text-xs text-slate-500 mt-1">
              当前状态: {gridPointDetail.thickness >= data.rink.thicknessThreshold ? '✓ 符合标准' : '⚠️ 低于阈值'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
