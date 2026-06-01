import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Database, RefreshCw } from 'lucide-react';
import { FileUpload } from '../components/common/FileUpload';
import { DeviceParamsForm } from '../components/import/DeviceParamsForm';
import { NotesEditor } from '../components/import/NotesEditor';
import { useAnalysisStore } from '../store/useAnalysisStore';
import { parseFile } from '../utils/csvParser';
import { generateMockSensorData } from '../data/mockData';

export function DataImportPage() {
  const navigate = useNavigate();
  const [batchName, setBatchName] = useState('测试批次-' + new Date().toLocaleDateString('zh-CN'));
  const [analysisReason, setAnalysisReason] = useState('滑雪坡道能量分析');
  const [isLoading, setIsLoading] = useState(false);

  const {
    sensorData,
    deviceParams,
    fieldNotes,
    manualCorrections,
    sourceFiles,
    setSensorData,
    setDeviceParams,
    addFieldNote,
    removeFieldNote,
    addManualCorrection,
    removeManualCorrection,
    setSourceFiles,
    runAnalysis,
    clearCurrent,
  } = useAnalysisStore();

  const handleFilesSelected = async (files: File[]) => {
    setIsLoading(true);
    try {
      const allData: any[] = [];
      for (const file of files) {
        const data = await parseFile(file);
        allData.push(...data);
      }
      if (allData.length > 0) {
        setSensorData(allData);
        setSourceFiles(files.map((f) => f.name));
      }
    } catch (error) {
      console.error('文件解析失败:', error);
    }
    setIsLoading(false);
  };

  const handleLoadSampleData = () => {
    setSensorData(generateMockSensorData());
    setSourceFiles(['示例传感器数据.csv']);
  };

  const handleRunAnalysis = () => {
    if (sensorData.length === 0) {
      alert('请先上传或加载传感器数据');
      return;
    }
    runAnalysis(batchName, analysisReason);
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">数据导入</h1>
          <p className="mt-1 text-slate-400">
            上传传感器数据、配置设备参数、添加现场备注和人工修正
          </p>
        </div>

        <div className="grid grid-cols-3 gap-8">
          <div className="col-span-2 space-y-6">
            <div className="rounded-lg bg-slate-800/50 p-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Database className="h-5 w-5 text-cyan-400" />
                  <h3 className="text-lg font-medium text-white">传感器数据</h3>
                </div>
                <button
                  onClick={handleLoadSampleData}
                  className="flex items-center space-x-1 rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>加载示例数据</span>
                </button>
              </div>

              <FileUpload onFilesSelected={handleFilesSelected} />

              {sensorData.length > 0 && (
                <div className="mt-4 rounded-md bg-slate-700/50 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-white">
                        已加载 <span className="font-mono text-cyan-400">{sensorData.length}</span> 条数据
                      </p>
                      <p className="text-xs text-slate-400">
                        来源: {sourceFiles.join(', ')}
                      </p>
                    </div>
                    <button
                      onClick={clearCurrent}
                      className="text-sm text-red-400 hover:text-red-300"
                    >
                      清除数据
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-lg bg-slate-800/50 p-6">
              <h3 className="mb-4 text-lg font-medium text-white">分析配置</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300">
                    批次名称
                  </label>
                  <input
                    type="text"
                    value={batchName}
                    onChange={(e) => setBatchName(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300">
                    分析原因
                  </label>
                  <input
                    type="text"
                    value={analysisReason}
                    onChange={(e) => setAnalysisReason(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
              </div>
            </div>

            <NotesEditor
              fieldNotes={fieldNotes}
              manualCorrections={manualCorrections}
              sensorData={sensorData}
              onAddNote={addFieldNote}
              onRemoveNote={removeFieldNote}
              onAddCorrection={addManualCorrection}
              onRemoveCorrection={removeManualCorrection}
            />
          </div>

          <div className="space-y-6">
            <DeviceParamsForm params={deviceParams} onChange={setDeviceParams} />

            <div className="sticky top-8">
              <button
                onClick={handleRunAnalysis}
                disabled={sensorData.length === 0 || isLoading}
                className="flex w-full items-center justify-center space-x-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-4 text-lg font-medium text-white shadow-lg shadow-cyan-500/30 transition-all hover:shadow-cyan-500/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Play className="h-5 w-5" />
                <span>运行能量分析</span>
              </button>
              <p className="mt-2 text-center text-xs text-slate-500">
                {sensorData.length > 0
                  ? `准备分析 ${sensorData.length} 条数据`
                  : '请先上传或加载数据'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
