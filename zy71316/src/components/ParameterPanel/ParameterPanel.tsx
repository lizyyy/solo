import React from 'react';
import { Settings, Rocket, Umbrella, Wind, Zap, Mountain } from 'lucide-react';
import { useSimulationStore } from '../../store/simulationStore';
import { SourceInput } from './SourceInput';

export const ParameterPanel: React.FC = () => {
  const { params, setParam, setSourceInfo, isRunning, runSimulation, resetParams } = useSimulationStore();

  const paramGroups = [
    {
      title: '探测器参数',
      icon: Rocket,
      params: [
        { key: 'probeMass', label: '探测器质量', unit: 'kg', min: 100, max: 5000, step: 50 }
      ]
    },
    {
      title: '降落伞参数',
      icon: Umbrella,
      params: [
        { key: 'parachuteArea', label: '伞面积', unit: 'm²', min: 50, max: 500, step: 10 },
        { key: 'deploymentAltitude', label: '开伞高度', unit: 'm', min: 1000, max: 20000, step: 500 }
      ]
    },
    {
      title: '大气参数',
      icon: Wind,
      params: [
        { key: 'atmosphericDensity', label: '大气密度', unit: 'kg/m³', min: 0, max: 0.05, step: 0.001 }
      ]
    },
    {
      title: '初始条件',
      icon: Zap,
      params: [
        { key: 'initialVelocity', label: '初速度', unit: 'm/s', min: 100, max: 5000, step: 50 },
        { key: 'initialAltitude', label: '初始高度', unit: 'm', min: 10000, max: 200000, step: 5000 }
      ]
    }
  ];

  return (
    <div className="h-full bg-gray-900/80 backdrop-blur-sm border-r border-gray-700 flex flex-col">
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-orange-400" />
          <h2 className="text-lg font-bold text-white tracking-wider">参数配置</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {paramGroups.map((group) => (
          <div key={group.title} className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
            <div className="flex items-center gap-2 mb-3">
              <group.icon className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-semibold text-gray-200">{group.title}</h3>
            </div>
            
            <div className="space-y-4">
              {group.params.map((param) => (
                <div key={param.key}>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs text-gray-400">{param.label}</label>
                    <span className="text-xs text-cyan-400 font-mono">
                      {params[param.key as keyof typeof params] as number} {param.unit}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={param.min}
                    max={param.max}
                    step={param.step}
                    value={params[param.key as keyof typeof params] as number}
                    onChange={(e) => setParam(param.key as any, Number(e.target.value))}
                    disabled={isRunning}
                    className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-500 disabled:opacity-50"
                  />
                  <SourceInput
                    paramName={param.key}
                    sourceInfo={params[`${param.key}Source` as keyof typeof params] as any}
                    onSourceChange={(source) => setSourceInfo(param.key, source)}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
          <div className="flex items-center gap-2 mb-3">
            <Mountain className="w-4 h-4 text-orange-400" />
            <h3 className="text-sm font-semibold text-gray-200">批次信息</h3>
          </div>
          <div className="space-y-2">
            <div>
              <label className="block text-xs text-gray-400 mb-1">批次号</label>
              <input
                type="text"
                value={params.batchId}
                onChange={(e) => setParam('batchId', e.target.value)}
                className="w-full px-2 py-1 text-sm bg-gray-800 border border-gray-600 rounded text-gray-200 focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">操作人员</label>
              <input
                type="text"
                value={params.operator}
                onChange={(e) => setParam('operator', e.target.value)}
                className="w-full px-2 py-1 text-sm bg-gray-800 border border-gray-600 rounded text-gray-200 focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-gray-700 space-y-2">
        <button
          onClick={runSimulation}
          disabled={isRunning}
          className="w-full py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-500/20"
        >
          {isRunning ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin">⚙️</span> 计算中...
            </span>
          ) : (
            '🚀 开始模拟'
          )}
        </button>
        <button
          onClick={resetParams}
          disabled={isRunning}
          className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg transition-colors disabled:opacity-50"
        >
          重置参数
        </button>
      </div>
    </div>
  );
};
