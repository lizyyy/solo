import { useRef, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import FieldScene from './FieldScene';
import { useStore } from '@/store/useStore';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

export default function Scene3D() {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const {
    points,
    selectedPointId,
    setSelectedPointId,
    cameraPosition,
    cameraTarget,
    setCameraState,
    filterStatus,
    filterSource,
  } = useStore();

  const filteredPoints = points.filter(
    (p) => filterStatus.includes(p.status) && filterSource.includes(p.source)
  );

  const handlePointClick = useCallback(
    (id: string) => {
      setSelectedPointId(id);
      const point = points.find((p) => p.id === id);
      if (point && controlsRef.current) {
        const target = { x: point.x, y: point.y, z: point.z };
        controlsRef.current.target.set(target.x, target.y, target.z);
        controlsRef.current.update();
        setCameraState(
          [point.x + 3, point.y + 3, point.z + 3],
          [point.x, point.y, point.z]
        );
      }
    },
    [points, setSelectedPointId, setCameraState]
  );

  const handleCameraChange = useCallback(() => {
    if (controlsRef.current) {
      const cam = controlsRef.current.object;
      const target = controlsRef.current.target;
      setCameraState(
        [cam.position.x, cam.position.y, cam.position.z],
        [target.x, target.y, target.z]
      );
    }
  }, [setCameraState]);

  const handleScreenshot = useCallback(() => {
    const canvas = canvasRef.current?.querySelector('canvas');
    if (!canvas) return;

    const filterInfo = `状态筛选: ${filterStatus.join(', ')} | 来源筛选: ${filterSource.join(', ')}`;
    const now = new Date().toLocaleString('zh-CN');

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(canvas, 0, 0);

    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, canvas.height - 60, canvas.width, 60);

    ctx.fillStyle = '#ffffff';
    ctx.font = '14px monospace';
    ctx.fillText(`教学电场线空间台 | ${now}`, 10, canvas.height - 38);
    ctx.font = '12px monospace';
    ctx.fillStyle = '#aaaaaa';
    ctx.fillText(filterInfo, 10, canvas.height - 16);

    const link = document.createElement('a');
    link.download = `电场线空间台_${now.replace(/[/: ]/g, '_')}.png`;
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
  }, [filterStatus, filterSource]);

  return (
    <div className="relative w-full h-full bg-[#0a0a1a]">
      <div ref={canvasRef} className="w-full h-full">
        <Canvas
          camera={{ position: cameraPosition, fov: 60, near: 0.1, far: 100 }}
          gl={{ preserveDrawingBuffer: true, antialias: true }}
          onCreated={({ camera }) => {
            camera.lookAt(...cameraTarget);
          }}
        >
          <FieldScene
            points={filteredPoints}
            onPointClick={handlePointClick}
            selectedPointId={selectedPointId}
          />
          <OrbitControls
            ref={controlsRef}
            enableDamping
            dampingFactor={0.05}
            target={cameraTarget}
            onChange={handleCameraChange}
          />
        </Canvas>
      </div>

      <div className="absolute top-3 right-3 flex gap-2">
        <button
          onClick={handleScreenshot}
          className="px-3 py-1.5 bg-[#0f3460] hover:bg-[#1a4a80] text-white text-xs rounded transition-colors"
          title="截图导出"
        >
          📷 截图
        </button>
      </div>

      {selectedPointId && (() => {
        const pt = points.find((p) => p.id === selectedPointId);
        if (!pt) return null;
        return (
          <div className="absolute bottom-3 left-3 bg-[#1a1a2e]/90 border border-[#0f3460] rounded p-3 max-w-xs text-xs text-white">
            <div className="font-bold text-sm mb-1">{pt.name}</div>
            <div className="text-[#888]">ID: {pt.id}</div>
            <div>坐标: ({pt.x}, {pt.y}, {pt.z})</div>
            <div>来源: {pt.source} — {pt.sourceDetail}</div>
            <div>状态: <span style={{ color: pt.status === 'pass' ? '#16c79a' : pt.status === 'confirm' ? '#f5a623' : '#e94560' }}>
              {pt.status === 'pass' ? '顺利通过' : pt.status === 'confirm' ? '人工确认' : '旧口径'}
            </span></div>
            {pt.gisNote && <div className="text-[#f5a623]">GIS备注: {pt.gisNote}</div>}
            {pt.processNote && <div className="text-[#aaa]">处理: {pt.processNote}</div>}
            <div className="text-[#666] mt-1">原始来源: {pt.originalSource}</div>
            <div className="text-[#666]">处理时间: {pt.processTime}</div>
          </div>
        );
      })()}

      <div className="absolute top-3 left-3 text-[10px] text-[#666]">
        左键旋转 · 右键平移 · 滚轮缩放 · 点击球体定位
      </div>
    </div>
  );
}
