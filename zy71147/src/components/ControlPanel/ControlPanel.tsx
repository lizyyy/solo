import React, { useState } from 'react';
import { Eye, EyeOff, Layers, Package, Columns, RailSymbol, Anchor, Route, AlertTriangle, Settings, GripVertical } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { sampleNames } from '../../data/samples';
import { SampleType, VisibilityState } from '../../types';

export const ControlPanel: React.FC = () => {
  const {
    currentSample,
    visibility,
    selectedBlockId,
    sceneData,
    setCurrentSample,
    setVisibility,
    setSelectedBlockId,
    updateBlockPosition,
  } = useAppStore();

  const [expandedSection, setExpandedSection] = useState<string>('blocks');

  const visibilityItems: { key: keyof VisibilityState; label: string; icon: React.ReactNode }[] = [
    { key: 'blocks', label: '船体分段', icon: <Package size={16} /> },
    { key: 'piers', label: '临时支墩', icon: <Columns size={16} /> },
    { key: 'rails', label: '龙门吊轨道', icon: <RailSymbol size={16} /> },
    { key: 'liftingPoints', label: '吊点', icon: <Anchor size={16} /> },
    { key: 'liftingPaths', label: '吊装路径', icon: <Route size={16} /> },
    { key: 'collisionMarkers', label: '冲突标记', icon: <AlertTriangle size={16} /> },
  ];

  const selectedBlock = sceneData.blocks.find((b) => b.id === selectedBlockId);

  const handlePositionChange = (axis: 'x' | 'y' | 'z', value: number) => {
    if (!selectedBlock) return;
    const newPosition = { ...selectedBlock.position };
    newPosition[axis] = value;
    updateBlockPosition(selectedBlock.id, newPosition);
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? '' : section);
  };

  return (
    <div className="w-72 bg-gray-900 bg-opacity-95 text-white flex flex-col h-full border-r border-gray-700 overflow-hidden">
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

      <div className="flex-1 overflow-y-auto">
        <div className="border-b border-gray-700">
          <button
            onClick={() => toggleSection('visibility')}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-800 transition-colors"
          >
            <span className="text-sm font-semibold text-gray-300 flex items-center gap-2">
              <Eye size={16} />
              元素可见性
            </span>
            <span className="text-gray-500 text-xs">{expandedSection === 'visibility' ? '▼' : '▶'}</span>
          </button>
          
          {expandedSection === 'visibility' && (
            <div className="p-4 pt-0 space-y-2">
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
          )}
        </div>

        <div className="border-b border-gray-700">
          <button
            onClick={() => toggleSection('blocks')}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-800 transition-colors"
          >
            <span className="text-sm font-semibold text-gray-300 flex items-center gap-2">
              <Package size={16} />
              分段列表
            </span>
            <span className="text-gray-500 text-xs">{expandedSection === 'blocks' ? '▼' : '▶'}</span>
          </button>
          
          {expandedSection === 'blocks' && (
            <div className="p-4 pt-0 space-y-2">
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
                    onClick={() => setSelectedBlockId(block.id)}
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
          )}
        </div>

        {selectedBlock && (
          <div className="border-b border-gray-700">
            <button
              onClick={() => toggleSection('params')}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-800 transition-colors"
            >
              <span className="text-sm font-semibold text-blue-400 flex items-center gap-2">
                <Settings size={16} />
                吊装参数调整
              </span>
              <span className="text-gray-500 text-xs">{expandedSection === 'params' ? '▼' : '▶'}</span>
            </button>
            
            {expandedSection === 'params' && (
              <div className="p-4 pt-0 space-y-4">
                <div className="bg-gray-800 rounded p-3">
                  <div className="text-sm font-medium mb-3 text-blue-300">
                    {selectedBlock.name} - 位置调整
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="flex items-center justify-between text-xs text-gray-400 mb-1">
                        <span>X 坐标</span>
                        <span className="text-gray-300">{selectedBlock.position.x.toFixed(1)}</span>
                      </label>
                      <input
                        type="range"
                        min="-40"
                        max="40"
                        step="0.5"
                        value={selectedBlock.position.x}
                        onChange={(e) => handlePositionChange('x', parseFloat(e.target.value))}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                    
                    <div>
                      <label className="flex items-center justify-between text-xs text-gray-400 mb-1">
                        <span>Y 坐标</span>
                        <span className="text-gray-300">{selectedBlock.position.y.toFixed(1)}</span>
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="30"
                        step="0.5"
                        value={selectedBlock.position.y}
                        onChange={(e) => handlePositionChange('y', parseFloat(e.target.value))}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                    
                    <div>
                      <label className="flex items-center justify-between text-xs text-gray-400 mb-1">
                        <span>Z 坐标</span>
                        <span className="text-gray-300">{selectedBlock.position.z.toFixed(1)}</span>
                      </label>
                      <input
                        type="range"
                        min="-40"
                        max="40"
                        step="0.5"
                        value={selectedBlock.position.z}
                        onChange={(e) => handlePositionChange('z', parseFloat(e.target.value))}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-gray-800 rounded p-3">
                  <div className="text-sm font-medium mb-2 text-gray-300">分段信息</div>
                  <div className="text-xs space-y-1 text-gray-400">
                    <div className="flex justify-between">
                      <span>尺寸:</span>
                      <span className="text-gray-300">{selectedBlock.dimensions.width} × {selectedBlock.dimensions.height} × {selectedBlock.dimensions.depth}m</span>
                    </div>
                    <div className="flex justify-between">
                      <span>起点:</span>
                      <span className="text-gray-300">({selectedBlock.startPosition.x.toFixed(1)}, {selectedBlock.startPosition.y.toFixed(1)}, {selectedBlock.startPosition.z.toFixed(1)})</span>
                    </div>
                    <div className="flex justify-between">
                      <span>终点:</span>
                      <span className="text-gray-300">({selectedBlock.endPosition.x.toFixed(1)}, {selectedBlock.endPosition.y.toFixed(1)}, {selectedBlock.endPosition.z.toFixed(1)})</span>
                    </div>
                    <div className="flex justify-between">
                      <span>吊点数:</span>
                      <span className="text-gray-300">{selectedBlock.liftingPoints.length}</span>
                    </div>
                  </div>
                </div>

                <div className="text-xs text-gray-500 flex items-center gap-1">
                  <GripVertical size={12} />
                  提示: 也可在3D场景中直接拖拽分段
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

