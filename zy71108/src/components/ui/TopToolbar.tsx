import { Upload, RotateCcw, Download, Eye, EyeOff, Layers, FileJson, FileText, Camera } from 'lucide-react';
import { useState } from 'react';
import { useSceneStore } from '../../store/useSceneStore';
import { CameraPreset } from '../../types';
import { exportJSON, exportPDF } from '../../utils/exportReport';

export function TopToolbar() {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const {
    loadSampleData,
    resetScene,
    setCameraPreset,
    cameraPreset,
    isDataLoaded,
    importSceneData,
    sceneData
  } = useSceneStore();

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          importSceneData(data);
        } catch (error) {
          console.error('Failed to import data:', error);
          alert('导入数据失败，请检查文件格式');
        }
      };
      reader.readAsText(file);
    }
  };

  const cameraPresets: { id: CameraPreset; label: string; icon: typeof Camera }[] = [
    { id: 'overview', label: '总览', icon: Eye },
    { id: 'top', label: '俯视', icon: Eye },
    { id: 'side', label: '侧视', icon: Eye },
    { id: 'closeup', label: '近景', icon: EyeOff }
  ];

  return (
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-900/80 backdrop-blur-md rounded-xl border border-gray-700/50 shadow-xl">
        <button
          onClick={loadSampleData}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors text-sm font-medium"
        >
          <Layers size={16} />
          加载样例
        </button>

        <label className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg cursor-pointer transition-colors text-sm font-medium">
          <Upload size={16} />
          导入数据
          <input
            type="file"
            accept=".json"
            onChange={handleFileImport}
            className="hidden"
          />
        </label>

        <div className="w-px h-6 bg-gray-600" />

        <button
          onClick={resetScene}
          className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm font-medium"
          disabled={!isDataLoaded}
        >
          <RotateCcw size={16} />
          重置
        </button>

        <div className="w-px h-6 bg-gray-600" />

        <div className="flex items-center gap-1">
          {cameraPresets.map(preset => (
            <button
              key={preset.id}
              onClick={() => setCameraPreset(preset.id)}
              className={`px-3 py-2 rounded-lg transition-colors text-sm font-medium ${
                cameraPreset === preset.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              disabled={!isDataLoaded}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-gray-600" />

        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors text-sm font-medium"
            disabled={!isDataLoaded}
          >
            <Download size={16} />
            导出
          </button>
          
          {showExportMenu && isDataLoaded && sceneData && (
            <div className="absolute right-0 top-full mt-2 bg-gray-900 border border-gray-700 rounded-lg shadow-xl overflow-hidden z-50">
              <button
                onClick={() => {
                  exportJSON(sceneData);
                  setShowExportMenu(false);
                }}
                className="flex items-center gap-2 w-full px-4 py-2 hover:bg-gray-700 text-white text-sm transition-colors"
              >
                <FileJson size={16} />
                导出 JSON 数据
              </button>
              <button
                onClick={() => {
                  const canvas = document.querySelector('canvas');
                  exportPDF(sceneData, canvas || undefined);
                  setShowExportMenu(false);
                }}
                className="flex items-center gap-2 w-full px-4 py-2 hover:bg-gray-700 text-white text-sm transition-colors"
              >
                <FileText size={16} />
                导出 PDF 报告
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TopToolbar;
