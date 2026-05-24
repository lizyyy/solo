import { Upload, RotateCcw, Download, Eye, EyeOff, Layers, FileJson, FileText, Route, X, Save, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useSceneStore } from '../../store/useSceneStore';
import { CameraPreset } from '../../types';
import { exportJSON, exportPDF } from '../../utils/exportReport';

export function TopToolbar() {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [routeName, setRouteName] = useState('');
  const {
    loadSampleData,
    resetScene,
    setCameraPreset,
    cameraPreset,
    isDataLoaded,
    importSceneData,
    sceneData,
    planningMode,
    togglePlanningMode,
    clearPlannedRoute,
    plannedRoute,
    savePlannedRoute,
    recomputeAllRoutes,
    revalidateData
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

  const cameraPresets: { id: CameraPreset; label: string; icon: typeof Eye }[] = [
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

        <div className="flex items-center gap-1">
          <button
            onClick={togglePlanningMode}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm font-medium ${
              planningMode
                ? 'bg-orange-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            disabled={!isDataLoaded}
          >
            <Route size={16} />
            {planningMode ? '退出规划' : '路线规划'}
          </button>
          
          {planningMode && (
            <>
              <button
                onClick={clearPlannedRoute}
                className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm font-medium"
              >
                <X size={16} />
                清除
              </button>
              <button
                onClick={() => setShowSaveModal(true)}
                className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
                disabled={!plannedRoute || plannedRoute.length < 2}
              >
                <Save size={16} />
                保存
              </button>
            </>
          )}
          
          <button
            onClick={recomputeAllRoutes}
            className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm font-medium"
            disabled={!isDataLoaded}
          >
            <RefreshCw size={16} />
            重算
          </button>
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

      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-96 shadow-2xl">
            <h3 className="text-white font-semibold text-lg mb-4">保存救援路线</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-gray-300 text-sm mb-1">路线名称</label>
                <input
                  type="text"
                  value={routeName}
                  onChange={(e) => setRouteName(e.target.value)}
                  placeholder="输入路线名称..."
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowSaveModal(false);
                    setRouteName('');
                  }}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    if (routeName.trim()) {
                      savePlannedRoute(
                        routeName.trim(),
                        sceneData?.rescueStations[0]?.name || '',
                        'manual'
                      );
                      setShowSaveModal(false);
                      setRouteName('');
                    }
                  }}
                  className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors disabled:opacity-50"
                  disabled={!routeName.trim()}
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {planningMode && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-20">
          <div className="px-4 py-2 bg-orange-600/90 text-white text-sm rounded-lg shadow-lg flex items-center gap-2">
            <Route size={16} />
            <span>路线规划模式：点击地形添加路径点，至少需要2个点</span>
            <span className="ml-2 px-2 py-0.5 bg-white/20 rounded">
              已添加: {plannedRoute?.length || 0} 个点
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default TopToolbar;
