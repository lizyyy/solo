import React, { useState } from 'react';
import {
  Download,
  RotateCcw,
  Upload,
  Eye,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

export const TopMenu: React.FC = () => {
  const {
    sceneData,
    loadSample,
    resetScene,
    exportReport,
    setCameraView,
    cameraView,
  } = useAppStore();

  const [showSamples, setShowSamples] = useState(false);
  const [showViews, setShowViews] = useState(false);

  const errorCount = sceneData.errors.filter((e) => e.severity === 'error').length;
  const warningCount = sceneData.errors.filter((e) => e.severity === 'warning').length;

  const samples = [
    { id: 'standard-or', name: '标准手术间布局' },
    { id: 'error-demo', name: '错误动线演示' },
  ];

  const views = [
    { id: 'top', name: '俯视图' },
    { id: 'front', name: '正视图' },
    { id: 'side', name: '侧视图' },
    { id: 'free', name: '自由视角' },
  ];

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
      <div className="bg-white rounded-xl shadow-lg px-4 py-2 flex items-center gap-2">
        <div className="flex items-center gap-2 pr-4 border-r border-gray-200">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">OR</span>
          </div>
          <div>
            <h1 className="text-sm font-semibold text-gray-800">手术室器械动线排布</h1>
            <p className="text-xs text-gray-500">{sceneData.name}</p>
          </div>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowSamples(!showSamples)}
            className="px-3 py-2 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2 text-sm"
          >
            <Upload className="w-4 h-4" />
            导入样例
          </button>
          {showSamples && (
            <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg py-1 min-w-40 z-50">
              {samples.map((sample) => (
                <button
                  key={sample.id}
                  onClick={() => {
                    loadSample(sample.id);
                    setShowSamples(false);
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-gray-100 text-sm"
                >
                  {sample.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => setShowViews(!showViews)}
            className="px-3 py-2 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2 text-sm"
          >
            <Eye className="w-4 h-4" />
            视角
          </button>
          {showViews && (
            <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg py-1 min-w-32 z-50">
              {views.map((view) => (
                <button
                  key={view.id}
                  onClick={() => {
                    setCameraView(view.id as any);
                    setShowViews(false);
                  }}
                  className={`w-full px-4 py-2 text-left text-sm ${
                    cameraView === view.id
                      ? 'bg-blue-50 text-blue-600'
                      : 'hover:bg-gray-100'
                  }`}
                >
                  {view.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={resetScene}
          className="px-3 py-2 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2 text-sm"
        >
          <RotateCcw className="w-4 h-4" />
          重置
        </button>

        <button
          onClick={exportReport}
          className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors flex items-center gap-2 text-sm"
        >
          <Download className="w-4 h-4" />
          导出报告
        </button>

        <div className="pl-4 border-l border-gray-200 flex items-center gap-3">
          {errorCount > 0 ? (
            <div className="flex items-center gap-1 text-red-500">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-medium">{errorCount} 错误</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-green-500">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm font-medium">无错误</span>
            </div>
          )}
          {warningCount > 0 && (
            <div className="flex items-center gap-1 text-yellow-500">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-medium">{warningCount} 警告</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
