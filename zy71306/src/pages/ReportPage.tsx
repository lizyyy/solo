import { useEffect } from 'react';
import { useCalibrationStore } from '../store/calibrationStore';
import ReportPreview from '../components/report/ReportPreview';

export default function ReportPage() {
  const { loadStoredRecords } = useCalibrationStore();

  useEffect(() => {
    loadStoredRecords();
  }, [loadStoredRecords]);

  return (
    <div className="min-h-screen bg-walnut-950 text-walnut-100">
      <header className="border-b border-brass-500/30 bg-walnut-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brass-500/20 flex items-center justify-center">
              <span className="text-brass-400 text-xl">📋</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-brass-300">校准报告</h1>
              <p className="text-xs text-walnut-400">Calibration Report</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <ReportPreview />
      </main>

      <footer className="border-t border-brass-500/20 mt-12 py-6 bg-walnut-900/50">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-walnut-500">
            黑胶唱针压力校准系统 · 物理模型计算仅供参考
          </p>
        </div>
      </footer>
    </div>
  );
}
