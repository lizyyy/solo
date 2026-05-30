import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, Eye, EyeOff, BarChart3 } from 'lucide-react';
import { useHallStore } from '@/store/useHallStore';
import { useScreenshot } from '@/hooks/useScreenshot';
import Scene from '@/components/scene/Scene';
import Nav from '@/components/Nav';
import AnomalyBar from '@/components/AnomalyBar';
import TraceBreadcrumb from '@/components/panel/TraceBreadcrumb';
import FrequencyTable from '@/components/panel/FrequencyTable';

const STANDARD_FREQUENCIES = [125, 250, 500, 1000, 2000, 4000];

export default function HallOverview() {
  const hall = useHallStore((s) => s.hall);
  const surfaces = useHallStore((s) => s.surfaces);
  const anomalies = useHallStore((s) => s.anomalies);
  const selection = useHallStore((s) => s.selection);
  const showPaths = useHallStore((s) => s.showPaths);
  const showHeatmap = useHallStore((s) => s.showHeatmap);
  const activeFrequency = useHallStore((s) => s.activeFrequency);
  const loadData = useHallStore((s) => s.loadData);
  const setSurfaceAngle = useHallStore((s) => s.setSurfaceAngle);
  const togglePaths = useHallStore((s) => s.togglePaths);
  const toggleHeatmap = useHallStore((s) => s.toggleHeatmap);
  const setActiveFrequency = useHallStore((s) => s.setActiveFrequency);
  const useErrorProneData = useHallStore((s) => s.useErrorProneData);

  const { canvasRef, captureScreenshot } = useScreenshot();

  const [selectedAnomaly, setSelectedAnomaly] = useState(anomalies.find((a) => a.id === selection.id));

  useEffect(() => {
    loadData(useErrorProneData);
  }, []);

  useEffect(() => {
    setSelectedAnomaly(anomalies.find((a) => a.id === selection.id));
  }, [selection.id, anomalies]);

  if (!hall) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <Nav />

      <div className="flex-1 flex overflow-hidden">
        <div className="w-[70%] relative">
          <Scene canvasRef={canvasRef as React.RefObject<HTMLCanvasElement>} />

          <div className="absolute top-4 right-4 flex gap-2">
            <button
              onClick={captureScreenshot}
              className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <Camera className="w-4 h-4" />
              截图
            </button>
          </div>

          <AnomalyBar anomalies={anomalies.filter((a) => a.status !== 'dismissed')} />
        </div>

        <div className="w-[30%] bg-gray-800 border-l border-gray-700 p-4 overflow-y-auto">
          <div className="space-y-4">
            <div className="bg-gray-900/50 rounded-lg p-4">
              <h3 className="text-white font-semibold mb-3">表面角度控制</h3>
              <div className="space-y-3">
                {surfaces.map((surface) => (
                  <div key={surface.id}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-gray-300 text-sm">{surface.name}</span>
                      <span className="text-amber-400 font-mono text-sm">
                        {surface.angle}°
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="90"
                      value={surface.angle}
                      onChange={(e) => setSurfaceAngle(surface.id, Number(e.target.value))}
                      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gray-900/50 rounded-lg p-4">
              <h3 className="text-white font-semibold mb-3">显示选项</h3>
              <div className="space-y-2">
                <button
                  onClick={togglePaths}
                  className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                    showPaths ? 'bg-amber-500/20 text-amber-400' : 'bg-gray-700/50 text-gray-300'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {showPaths ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    显示反射路径
                  </span>
                  <div className={`w-10 h-6 rounded-full relative ${
                    showPaths ? 'bg-amber-500' : 'bg-gray-600'
                  }`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      showPaths ? 'translate-x-5' : 'translate-x-1'
                    }`} />
                  </div>
                </button>
                <button
                  onClick={toggleHeatmap}
                  className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                    showHeatmap ? 'bg-amber-500/20 text-amber-400' : 'bg-gray-700/50 text-gray-300'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {showHeatmap ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    显示热力图
                  </span>
                  <div className={`w-10 h-6 rounded-full relative ${
                    showHeatmap ? 'bg-amber-500' : 'bg-gray-600'
                  }`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      showHeatmap ? 'translate-x-5' : 'translate-x-1'
                    }`} />
                  </div>
                </button>
              </div>
            </div>

            <div className="bg-gray-900/50 rounded-lg p-4">
              <h3 className="text-white font-semibold mb-3">频率选择</h3>
              <div className="grid grid-cols-3 gap-2">
                {STANDARD_FREQUENCIES.map((freq) => (
                  <button
                    key={freq}
                    onClick={() => setActiveFrequency(freq)}
                    className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                      activeFrequency === freq
                        ? 'bg-amber-500 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {freq}Hz
                  </button>
                ))}
              </div>
            </div>

            {selectedAnomaly && selectedAnomaly.traceChain.length > 0 && (
              <div className="bg-gray-900/50 rounded-lg p-4">
                <h3 className="text-white font-semibold mb-3">追踪链路</h3>
                <TraceBreadcrumb traceChain={selectedAnomaly.traceChain} />
              </div>
            )}

            {selection.type === 'zone' && selection.id && (
              <FrequencyTable zoneId={selection.id} />
            )}
          </div>
        </div>
      </div>

      <div className="absolute top-4 left-4 bg-gray-900/80 rounded-lg px-4 py-2">
        <h1 className="text-white font-semibold text-lg">{hall.name}</h1>
        <p className="text-gray-400 text-sm">
          {hall.width}m × {hall.depth}m × {hall.height}m
        </p>
      </div>

      <div className="absolute top-4 right-32 flex gap-2">
        <Link
          to="/report"
          className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <BarChart3 className="w-4 h-4" />
          报告
        </Link>
      </div>
    </div>
  );
}
