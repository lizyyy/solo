import { useEffect, useRef } from 'react';
import { useCalibrationStore } from '../store/calibrationStore';
import Scene3D from '../components/scene/Scene3D';
import ControlPanel from '../components/controls/ControlPanel';
import StatusPanel from '../components/status/StatusPanel';
import ErrorCards from '../components/status/ErrorCards';
import ActionButtons from '../components/actions/ActionButtons';
import ScreenshotPreview from '../components/actions/ScreenshotPreview';
import HistoryPanel from '../components/history/HistoryPanel';
import CompareTable from '../components/history/CompareTable';
import WearTrendChart from '../components/history/WearTrendChart';
import { Camera, AlertCircle } from 'lucide-react';

export default function CalibrationPage() {
  const { calculate, loadStoredRecords, lastError, setError } = useCalibrationStore();
  const sceneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    calculate();
    loadStoredRecords();
  }, [calculate, loadStoredRecords]);

  return (
    <div className="min-h-screen bg-walnut-950 text-walnut-100">
      <header className="border-b border-brass-500/30 bg-walnut-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-brass-500/20 flex items-center justify-center">
                <Camera className="text-brass-400" size={24} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-brass-300">黑胶唱针压力校准系统</h1>
                <p className="text-xs text-walnut-400">Vinyl Stylus Pressure Calibration</p>
              </div>
            </div>
            {lastError && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-danger-500/20 border border-danger-500/30 rounded-full">
                <AlertCircle size={16} className="text-danger-400" />
                <span className="text-sm text-danger-300">{lastError}</span>
                <button
                  onClick={() => setError(null)}
                  className="text-danger-400 hover:text-danger-300 ml-1"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-6 space-y-4">
            <div
              ref={sceneRef}
              id="scene-container"
              className="h-[500px] rounded-xl overflow-hidden border-2 border-brass-500/30 shadow-2xl"
            >
              <Scene3D />
            </div>

            <ActionButtons sceneRef="scene-container" />

            <ScreenshotPreview />
          </div>

          <div className="col-span-12 lg:col-span-6 space-y-4">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="h-[600px]">
                <ControlPanel />
              </div>
              <div className="space-y-4">
                <StatusPanel />
                <ErrorCards />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-brass-500/20 pt-6">
          <h2 className="text-xl font-bold text-brass-300 mb-4">历史记录与分析</h2>
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 lg:col-span-6">
              <HistoryPanel />
            </div>
            <div className="col-span-12 lg:col-span-6 space-y-4">
              <CompareTable />
              <WearTrendChart />
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-brass-500/20 mt-12 py-6 bg-walnut-900/50">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-walnut-500">
            黑胶唱针压力校准系统 · 物理模型计算仅供参考
          </p>
          <p className="text-xs text-walnut-600 mt-1">
            建议使用专业设备进行实际测量校准
          </p>
        </div>
      </footer>
    </div>
  );
}
