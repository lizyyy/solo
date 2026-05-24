import React, { useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Layers,
  Eye,
  Grid3X3,
  Settings2,
  Users,
  MapPin,
  DoorOpen,
  DoorClosed,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Clock
} from 'lucide-react';
import { useSimulationStore } from '../../store/useSimulationStore';
import { scenes } from '../../data/scenes';

export const ControlPanel: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    scene: true,
    playback: true,
    batches: false,
    areas: false,
    exits: false,
    view: false
  });

  const {
    selectedScene,
    passengerBatches,
    setScene,
    isPlaying,
    setPlaying,
    speed,
    setSpeed,
    reset,
    is2DMode,
    toggle2DMode,
    cameraView,
    setCameraView,
    updatePassengerBatch,
    addPassengerBatch,
    removePassengerBatch,
    closeExit,
    openExit,
    addClosedArea,
    removeClosedArea
  } = useSimulationStore();

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const SectionHeader: React.FC<{
    section: string;
    title: string;
    icon: React.ReactNode;
  }> = ({ section, title, icon }) => (
    <div
      className="flex items-center justify-between py-2 cursor-pointer hover:bg-slate-700/30 px-2 rounded transition-colors"
      onClick={() => toggleSection(section)}
    >
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-medium text-slate-300">{title}</span>
      </div>
      {expandedSections[section] ? (
        <ChevronDown className="w-4 h-4 text-slate-500" />
      ) : (
        <ChevronRight className="w-4 h-4 text-slate-500" />
      )}
    </div>
  );

  return (
    <div className="absolute left-4 top-16 z-10 flex flex-col gap-2 w-72">
      <div className="bg-slate-800/95 backdrop-blur-sm rounded-lg shadow-xl border border-slate-700 overflow-hidden">
        <div
          className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-700/50 transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-blue-400" />
            <span className="font-medium text-white">控制面板</span>
          </div>
          <span className="text-slate-400 text-sm">{isExpanded ? '收起' : '展开'}</span>
        </div>

        {isExpanded && (
          <div className="px-3 pb-3 space-y-1 border-t border-slate-700 max-h-[calc(100vh-180px)] overflow-y-auto">
            <div className="pt-2">
              <SectionHeader
                section="scene"
                title="场景选择"
                icon={<MapPin className="w-4 h-4 text-blue-400" />}
              />
              {expandedSections.scene && (
                <div className="px-2 py-2 space-y-2">
                  <select
                    value={selectedScene?.id || ''}
                    onChange={(e) => {
                      const scene = scenes.find(s => s.id === e.target.value);
                      if (scene) setScene(scene);
                    }}
                    className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- 请选择场景 --</option>
                    {scenes.map(scene => (
                      <option key={scene.id} value={scene.id}>
                        {scene.name}
                      </option>
                    ))}
                  </select>
                  {selectedScene && (
                    <p className="text-xs text-slate-400">
                      {selectedScene.description}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="pt-1">
              <SectionHeader
                section="playback"
                title="播放控制"
                icon={<Play className="w-4 h-4 text-green-400" />}
              />
              {expandedSections.playback && (
                <div className="px-2 py-2 space-y-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPlaying(!isPlaying)}
                      disabled={!selectedScene}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-md transition-colors font-medium text-sm"
                    >
                      {isPlaying ? (
                        <>
                          <Pause className="w-4 h-4" />
                          暂停
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4" />
                          播放
                        </>
                      )}
                    </button>
                    <button
                      onClick={reset}
                      disabled={!selectedScene}
                      className="px-4 py-2 bg-slate-600 hover:bg-slate-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-md transition-colors"
                      title="重置"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      播放速度: {speed}x
                    </label>
                    <input
                      type="range"
                      min="0.5"
                      max="5"
                      step="0.5"
                      value={speed}
                      onChange={(e) => setSpeed(parseFloat(e.target.value))}
                      className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                      <span>0.5x</span>
                      <span>2.5x</span>
                      <span>5x</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-1">
              <SectionHeader
                section="batches"
                title="客流批次配置"
                icon={<Users className="w-4 h-4 text-purple-400" />}
              />
              {expandedSections.batches && selectedScene && (
                <div className="px-2 py-2 space-y-3">
                  {passengerBatches.map((batch, index) => (
                    <div key={batch.id} className="bg-slate-700/50 rounded-md p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-white">批次 {index + 1}</span>
                        <button
                          onClick={() => removePassengerBatch(batch.id)}
                          disabled={passengerBatches.length <= 1}
                          className="p-1 text-red-400 hover:bg-red-500/20 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">
                            <Clock className="w-3 h-3 inline mr-1" />
                            到达时间(s)
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="120"
                            value={batch.startTime}
                            onChange={(e) => updatePassengerBatch(batch.id, {
                              startTime: Math.max(0, parseInt(e.target.value) || 0)
                            })}
                            className="w-full bg-slate-600 border border-slate-500 rounded px-2 py-1 text-white text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">
                            <Users className="w-3 h-3 inline mr-1" />
                            人数
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="200"
                            value={batch.count}
                            onChange={(e) => updatePassengerBatch(batch.id, {
                              count: Math.max(1, Math.min(200, parseInt(e.target.value) || 1))
                            })}
                            className="w-full bg-slate-600 border border-slate-500 rounded px-2 py-1 text-white text-sm"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs text-slate-400 mb-1">
                            移动速度 (m/s): {batch.speed.toFixed(1)}
                          </label>
                          <input
                            type="range"
                            min="0.5"
                            max="3"
                            step="0.1"
                            value={batch.speed}
                            onChange={(e) => updatePassengerBatch(batch.id, {
                              speed: parseFloat(e.target.value)
                            })}
                            className="w-full h-1.5 bg-slate-600 rounded appearance-none cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={addPassengerBatch}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-md transition-colors text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    添加客流批次
                  </button>
                </div>
              )}
            </div>

            <div className="pt-1">
              <SectionHeader
                section="exits"
                title="出口控制"
                icon={<DoorOpen className="w-4 h-4 text-cyan-400" />}
              />
              {expandedSections.exits && selectedScene && (
                <div className="px-2 py-2 space-y-2">
                  {selectedScene.layout.gates.map(gate => (
                    <div
                      key={gate.id}
                      className="flex items-center justify-between bg-slate-700/50 rounded-md px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        {gate.status === 'open' ? (
                          <DoorOpen className="w-4 h-4 text-green-400" />
                        ) : (
                          <DoorClosed className="w-4 h-4 text-red-400" />
                        )}
                        <span className="text-sm text-white">
                          {gate.type === 'exit' ? '出口' : gate.type === 'entry' ? '入口' : '双向'} {gate.id.split('-')[1]}
                        </span>
                      </div>
                      <button
                        onClick={() => gate.status === 'open' ? closeExit(gate.id) : openExit(gate.id)}
                        className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                          gate.status === 'open'
                            ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                            : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                        }`}
                      >
                        {gate.status === 'open' ? '开启' : '关闭'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-1">
              <SectionHeader
                section="areas"
                title="封闭区域"
                icon={<MapPin className="w-4 h-4 text-red-400" />}
              />
              {expandedSections.areas && selectedScene && (
                <div className="px-2 py-2 space-y-2">
                  {selectedScene.closedAreas.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-2">暂无封闭区域</p>
                  ) : (
                    selectedScene.closedAreas.map(area => (
                      <div
                        key={area.id}
                        className="flex items-center justify-between bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{area.reason}</p>
                          <p className="text-xs text-slate-500">
                            位置: ({area.x.toFixed(0)}, {area.y.toFixed(0)})
                          </p>
                        </div>
                        <button
                          onClick={() => removeClosedArea(area.id)}
                          className="p-1 text-red-400 hover:bg-red-500/20 rounded ml-2"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                  <div className="space-y-2 pt-2 border-t border-slate-700">
                    <p className="text-xs text-slate-400">添加封闭区域:</p>
                    <button
                      onClick={() => addClosedArea(15, 10, 5, 5, '临时封闭区域')}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-md transition-colors text-sm"
                    >
                      <Plus className="w-4 h-4" />
                      添加示例封闭区域
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-1">
              <SectionHeader
                section="view"
                title="视图设置"
                icon={<Eye className="w-4 h-4 text-yellow-400" />}
              />
              {expandedSections.view && (
                <div className="px-2 py-2 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-2">
                      视图模式
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={toggle2DMode}
                        className={`flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                          is2DMode
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        <Layers className="w-4 h-4" />
                        2D
                      </button>
                      <button
                        onClick={toggle2DMode}
                        className={`flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                          !is2DMode
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        <Grid3X3 className="w-4 h-4" />
                        3D
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-2">
                      摄像机视角
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: 'default', label: '默认' },
                        { value: 'top', label: '俯视' },
                        { value: 'angle', label: '斜45°' },
                        { value: 'firstPerson', label: '第一人称' }
                      ].map(view => (
                        <button
                          key={view.value}
                          onClick={() => setCameraView(view.value as 'default' | 'top' | 'angle' | 'firstPerson')}
                          disabled={is2DMode && view.value !== 'top'}
                          className={`flex items-center justify-center gap-1 px-3 py-2 rounded-md text-sm transition-colors ${
                            cameraView === view.value
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                          } ${is2DMode && view.value !== 'top' ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          {view.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
