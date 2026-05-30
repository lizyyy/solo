import { useState, useEffect, useCallback } from 'react';
import { ParameterInput } from './components/ParameterInput';
import { ResultSidebar } from './components/ResultSidebar';
import { HistoryPanel } from './components/HistoryPanel';
import { analyzeLaunchWindow } from './utils/balloonPhysics';
import {
  generateReport,
  exportToJson,
  exportToText,
  downloadFile,
  saveToLocalStorage,
  loadFromLocalStorage,
  generateId,
} from './utils/exportReport';
import type { BalloonParams, LaunchWindowResult, ExperimentRecord } from './types';

const DEFAULT_PARAMS: BalloonParams = {
  experimentName: '',
  temperature: null,
  temperatureUnit: '°C',
  payload: null,
  payloadUnit: 'kg',
  windSpeed: null,
  windSpeedUnit: 'm/s',
  balloonVolume: null,
  volumeUnit: 'm³',
  safetyNotes: '',
};

function App() {
  const [params, setParams] = useState<BalloonParams>(DEFAULT_PARAMS);
  const [result, setResult] = useState<LaunchWindowResult | null>(null);
  const [records, setRecords] = useState<ExperimentRecord[]>([]);
  const [showExportMenu, setShowExportMenu] = useState(false);

  useEffect(() => {
    setRecords(loadFromLocalStorage());
  }, []);

  useEffect(() => {
    const hasAnyValue =
      params.temperature !== null ||
      params.payload !== null ||
      params.windSpeed !== null ||
      params.balloonVolume !== null;

    if (hasAnyValue) {
      const timer = setTimeout(() => {
        const newResult = analyzeLaunchWindow(params);
        setResult(newResult);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setResult(null);
    }
  }, [params]);

  const handleParamsChange = useCallback((newParams: BalloonParams) => {
    setParams(newParams);
  }, []);

  const handleSaveRecord = useCallback(() => {
    if (!result) return;

    const record: ExperimentRecord = {
      id: generateId(),
      name: params.experimentName || '未命名实验',
      params: { ...params },
      result: { ...result, timestamp: new Date(result.timestamp) },
      createdAt: new Date().toISOString(),
    };

    saveToLocalStorage(record);
    setRecords(loadFromLocalStorage());
  }, [params, result]);

  const handleExport = useCallback(
    (format: 'json' | 'txt') => {
      if (!result) return;

      const report = generateReport(params, result);
      const filename = `${params.experimentName || '热气球实验报告'}_${new Date().toISOString().slice(0, 10)}`;

      if (format === 'json') {
        downloadFile(exportToJson(report), `${filename}.json`, 'application/json');
      } else {
        downloadFile(exportToText(report), `${filename}.txt`, 'text/plain');
      }
      setShowExportMenu(false);
    },
    [params, result]
  );

  const handleSelectRecord = useCallback((record: ExperimentRecord) => {
    setParams({ ...record.params });
    setResult({
      ...record.result,
      timestamp: new Date(record.result.timestamp),
    });
  }, []);

  const handleDeleteRecord = useCallback(
    (id: string) => {
      const updated = records.filter((r) => r.id !== id);
      setRecords(updated);
      localStorage.setItem('balloonExperiments', JSON.stringify(updated));
    },
    [records]
  );

  const handleReset = useCallback(() => {
    setParams(DEFAULT_PARAMS);
    setResult(null);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gradient-to-r from-purple-600 to-purple-800 text-white py-6 px-8 shadow-lg">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-4xl">🎈</span>
              <div>
                <h1 className="text-2xl font-bold">热气球升空窗口</h1>
                <p className="text-purple-200 text-sm mt-1">研学实验 · 实时分析 · 报告导出</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleReset}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors"
              >
                🔄 重置参数
              </button>
              {result && (
                <>
                  <button
                    onClick={handleSaveRecord}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors"
                  >
                    💾 保存记录
                  </button>
                  <div className="relative">
                    <button
                      onClick={() => setShowExportMenu(!showExportMenu)}
                      className="px-4 py-2 bg-white text-purple-700 hover:bg-purple-50 rounded-lg text-sm font-medium transition-colors"
                    >
                      📤 导出报告
                    </button>
                    {showExportMenu && (
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-10">
                        <button
                          onClick={() => handleExport('txt')}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-purple-50"
                        >
                          📄 导出为 TXT
                        </button>
                        <button
                          onClick={() => handleExport('json')}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-purple-50"
                        >
                          📋 导出为 JSON
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <ParameterInput params={params} onChange={handleParamsChange} />
            <HistoryPanel
              records={records}
              onSelect={handleSelectRecord}
              onDelete={handleDeleteRecord}
            />
          </div>
          <div>
            <ResultSidebar result={result} />
          </div>
        </div>
      </main>

      <footer className="bg-gray-100 border-t border-gray-200 py-4 mt-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-gray-500">
          <p>热气球实验助手 · 仅供教学实验辅助工具</p>
          <p className="mt-1">请在专业人员指导下进行实验操作</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
