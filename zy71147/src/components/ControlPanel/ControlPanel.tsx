
import React from 'react';
import { Eye, EyeOff, Layers, Package, Columns, RailSymbol, Anchor, Route, AlertTriangle } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { sampleNames } from '../../data/samples';
import { SampleType } from '../../types';
import { VisibilityState } from '../../types';

export const ControlPanel: React.FC = () => {
  const {
    currentSample,
    visibility,
    selectedBlockId,
    sceneData,
    setCurrentSample,
    setVisibility,
  } = useAppStore();

  const visibilityItems: { key: keyof VisibilityState; label: string; icon: React.ReactNode }[] = [
    { key: 'blocks', label: '船体分段', icon: <Package size={16} /> },
    { key: 'piers', label: '临时支墩', icon: <Columns size={16} /> },
    { key: 'rails', label: '龙门吊轨道', icon: <RailSymbol size={16} /> },
    { key: 'liftingPoints', label: '吊点', icon: <Anchor size={16} /> },
    { key: 'liftingPaths', label: '吊装路径', icon: <Route size={16} /> },
    { key: 'collisionMarkers', label: '冲突标记', icon: <AlertTriangle size={16} /> },
  ];

  const selectedBlock = sceneData.blocks.find((b) => b.id === selectedBlockId);

  return (
    <div className="w-64 bg-gray-900 bg-opacity-95 text-white flex flex-col h-full border-r border-gray-700">
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-lg font-bold text-blue-400 mb-3 flex items-center gap-2">
          <Layers size={20} />
          场景控制
        </h2>

        <div className="mb-4">
          <label className="block text-sm text-gray-400 mb-2">选择样例</label>
          <select
            value={currentSample}
            onChange={(e) => setCurrentSample(e.target.value as SampleType)}
            className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          >
            {Object.entries(sampleNames).map(([key, name]) => (
              <option key={key} value={key}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="p-4 border-b border-gray-700">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">元素可见性</h3>
        <div className="space-y-2">
          {visibilityItems.map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setVisibility({ [key]: !visibility[key] })}
              className={`w-full flex items-center justify-between px-3 py-2 rounded text-sm transition-colors ${
                visibility[key]
                  ? 'bg-blue-600 bg-opacity-30 text-blue-300'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              <span className="flex items-center gap-2">
                {icon}
                {label}
              </span>
              {visibility[key] ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 flex-1 overflow-y-auto">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">分段列表</h3>
        <div className="space-y-2">
          {sceneData.blocks.length === 0 ? (
            <p className="text-gray-500 text-sm italic">暂无分段数据</p>
          ) : (
            sceneData.blocks.map((block) => (
              <div
                key={block.id}
                className={`p-3 rounded cursor-pointer transition-colors ${
                  selectedBlockId === block.id
                    ? 'bg-blue-600 bg-opacity-40 border border-blue-500'
                    : 'bg-gray-800 hover:bg-gray-700 border border-transparent'
                }`}
                onClick={() => useAppStore.getState().setSelectedBlockId(block.id)}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className="w-3 h-3 rounded"
                    style={{ backgroundColor: block.color }}
                  />
                  <span className="text-sm font-medium">{block.name}</span>
                </div>
                <div className="text-xs text-gray-400">
                  {block.dimensions.width} × {block.dimensions.height} × {block.dimensions.depth}m
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  吊点: {block.liftingPoints.length}个
                </div>
              </div>
            ))
          )}
        </div>

        {selectedBlock && (
          <div className="mt-4 p-3 bg-gray-800 rounded border border-gray-700">
            <h4 className="text-sm font-semibold text-blue-400 mb-2">选中分段详情</h4>
            <div className="text-xs space-y-1 text-gray-300">
              <div>位置: ({selectedBlock.position.x.toFixed(1)}, {selectedBlock.position.y.toFixed(1)}, {selectedBlock.position.z.toFixed(1)})</div>
              <div>目标: ({selectedBlock.endPosition.x.toFixed(1)}, {selectedBlock.endPosition.y.toFixed(1)}, {selectedBlock.endPosition.z.toFixed(1)})</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

