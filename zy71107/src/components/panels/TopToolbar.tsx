import React, { useState } from 'react';
import { RotateCcw, Download, Eye, Database, AlertTriangle, FileText } from 'lucide-react';
import { useSceneStore } from '../../store/useSceneStore';
import { SampleType, CameraView } from '../../data/types';
import { generatePDFReport, exportJSONReport, ReportData } from '../../utils/reportGenerator';

const TopToolbar: React.FC = () => {
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  
  const loadSample = useSceneStore((state) => state.loadSample);
  const resetState = useSceneStore((state) => state.resetState);
  const setCameraView = useSceneStore((state) => state.setCameraView);
  const currentSample = useSceneStore((state) => state.currentSample);
  const anomalies = useSceneStore((state) => state.anomalies);
  const hallData = useSceneStore((state) => state.hallData);
  const trajectories = useSceneStore((state) => state.trajectories);
  const batches = useSceneStore((state) => state.batches);

  const sampleOptions: { value: SampleType; label: string; description: string }[] = [
    { value: 'normal', label: '正常数据', description: '完整的参观动线数据' },
    { value: 'conflict', label: '异常数据', description: '包含轨迹断点和编号错位' },
    { value: 'empty', label: '空数据', description: '无参观记录的展厅' },
  ];

  const cameraOptions: { value: CameraView; label: string }[] = [
    { value: 'perspective', label: '透视视角' },
    { value: 'top', label: '俯视视角' },
    { value: 'front', label: '正面视角' },
    { value: 'side', label: '侧面视角' },
  ];

  const handleExportPDF = async () => {
    if (!hallData) return;
    const reportData: ReportData = {
      hallData,
      trajectories,
      anomalies,
      batches,
      generatedAt: new Date(),
    };
    await generatePDFReport(reportData);
    setExportMenuOpen(false);
  };

  const handleExportJSON = () => {
    if (!hallData) return;
    const reportData: ReportData = {
      hallData,
      trajectories,
      anomalies,
      batches,
      generatedAt: new Date(),
    };
    exportJSONReport(reportData);
    setExportMenuOpen(false);
  };

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3">
      <div className="bg-slate-900/90 backdrop-blur-md rounded-xl px-4 py-2 border border-slate-700/50 shadow-xl">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-cyan-400" />
          <span className="text-white text-sm font-medium mr-2">样例数据:</span>
          <select
            value={currentSample || ''}
            onChange={(e) => e.target.value && loadSample(e.target.value as SampleType)}
            className="bg-slate-800 text-white text-sm px-3 py-1.5 rounded-lg border border-slate-600 focus:border-cyan-500 focus:outline-none cursor-pointer"
          >
            <option value="" disabled>选择样例</option>
            {sampleOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label} - {opt.description}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-slate-900/90 backdrop-blur-md rounded-xl px-4 py-2 border border-slate-700/50 shadow-xl">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-cyan-400" />
          <span className="text-white text-sm font-medium mr-2">视角:</span>
          <select
            onChange={(e) => setCameraView(e.target.value as CameraView)}
            className="bg-slate-800 text-white text-sm px-3 py-1.5 rounded-lg border border-slate-600 focus:border-cyan-500 focus:outline-none cursor-pointer"
          >
            {cameraOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        onClick={resetState}
        className="bg-slate-900/90 backdrop-blur-md rounded-xl px-4 py-2 border border-slate-700/50 shadow-xl hover:bg-slate-800/90 transition-colors flex items-center gap-2"
      >
        <RotateCcw className="w-4 h-4 text-white" />
        <span className="text-white text-sm">重置</span>
      </button>

      {hallData && trajectories.length > 0 && (
        <div className="relative">
          <button
            onClick={() => setExportMenuOpen(!exportMenuOpen)}
            className="bg-cyan-700/90 backdrop-blur-md rounded-xl px-4 py-2 border border-cyan-600/50 shadow-xl hover:bg-cyan-600/90 transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4 text-white" />
            <span className="text-white text-sm">导出报告</span>
          </button>
          {exportMenuOpen && (
            <div className="absolute top-full mt-2 right-0 bg-slate-900/95 backdrop-blur-md rounded-xl border border-slate-700/50 shadow-xl overflow-hidden min-w-40">
              <button
                onClick={handleExportPDF}
                className="w-full px-4 py-2 text-left text-white text-sm hover:bg-slate-700/50 transition-colors flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                导出 PDF
              </button>
              <button
                onClick={handleExportJSON}
                className="w-full px-4 py-2 text-left text-white text-sm hover:bg-slate-700/50 transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                导出 JSON
              </button>
            </div>
          )}
        </div>
      )}

      {hallData && (
        <div className="bg-slate-900/90 backdrop-blur-md rounded-xl px-4 py-2 border border-slate-700/50 shadow-xl">
          <span className="text-cyan-400 text-sm font-medium">{hallData.name}</span>
        </div>
      )}

      {anomalies.length > 0 && (
        <div className="bg-orange-900/90 backdrop-blur-md rounded-xl px-4 py-2 border border-orange-600/50 shadow-xl flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-orange-400" />
          <span className="text-orange-300 text-sm font-medium">
            {anomalies.length} 个异常
          </span>
        </div>
      )}
    </div>
  );
};

export default TopToolbar;
