
import React from 'react';
import { Camera, RotateCcw, Download, Eye, EyeOff, GitCompare, HelpCircle } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { SampleType } from '../../types';
import { sampleNames } from '../../data/samples';

export const Toolbar: React.FC = () => {
  const {
    resetScene,
    showComparison,
    comparisonSample,
    toggleComparison,
    setComparisonSample,
  } = useAppStore();

  const cameraViews = [
    { name: '俯视图', position: { x: 0, y: 100, z: 0.1 }, target: { x: 0, y: 0, z: 0 } },
    { name: '前视图', position: { x: 0, y: 30, z: 80 }, target: { x: 0, y: 0, z: 0 } },
    { name: '侧视图', position: { x: 80, y: 30, z: 0 }, target: { x: 0, y: 0, z: 0 } },
    { name: '等轴测', position: { x: 50, y: 40, z: 50 }, target: { x: 0, y: 0, z: 0 } },
  ];

  const handleExportReport = () => {
    window.dispatchEvent(new CustomEvent('exportReport'));
  };

  return (
    <div className="h-14 bg-gray-900 bg-opacity-95 border-b border-gray-700 flex items-center justify-between px-4">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-bold text-white mr-4">
          <span className="text-blue-400">船厂</span>分段吊装预排
        </h1>
        
        <div className="h-6 w-px bg-gray-600 mx-2" />

        <div className="flex items-center gap-1">
          <Camera size={16} className="text-gray-400 mr-1" />
          {cameraViews.map((view) => (
            <button
              key={view.name}
              onClick={() => useAppStore.getState().setCameraView({ position: view.position, target: view.target })}
              className="px-3 py-1 text-sm rounded hover:bg-gray-700 text-gray-300 transition-colors"
            >
              {view.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => toggleComparison(!showComparison)}
          className={`flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors ${
            showComparison
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          <GitCompare size={16} />
          方案对比
        </button>

        {showComparison && (
          <select
            value={comparisonSample || ''}
            onChange={(e) => setComparisonSample((e.target.value as SampleType) || null)}
            className="bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            <option value="">选择对比方案</option>
            {Object.entries(sampleNames).map(([key, name]) => (
              <option key={key} value={key}>
                {name}
              </option>
            ))}
          </select>
        )}

        <div className="h-6 w-px bg-gray-600 mx-2" />

        <button
          onClick={resetScene}
          className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm text-gray-300 transition-colors"
        >
          <RotateCcw size={16} />
          重置场景
        </button>

        <button
          onClick={handleExportReport}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm text-white transition-colors"
        >
          <Download size={16} />
          导出报告
        </button>

        <button
          className="p-2 rounded hover:bg-gray-700 text-gray-400 transition-colors"
          title="帮助"
        >
          <HelpCircle size={18} />
        </button>
      </div>
    </div>
  );
};

