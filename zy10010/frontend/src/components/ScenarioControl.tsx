import React, { useState } from 'react';
import { apiService } from '../services/api';

interface ScenarioControlProps {
  onReset: () => void;
}

const scenarios = [
  {
    id: 'connection_pool',
    name: '连接池耗尽',
    description: '模拟连接数超过池大小导致耗尽',
    params: [{ key: 'pool_size', label: '池大小', type: 'number', default: 10 }],
  },
  {
    id: 'message_queue',
    name: '消息积压',
    description: '模拟消息生产速度超过消费速度',
    params: [{ key: 'backlog_size', label: '积压阈值', type: 'number', default: 50 }],
  },
  {
    id: 'goroutine_leak',
    name: 'Goroutine 泄漏',
    description: '模拟 goroutine 没有正确释放',
    params: [{ key: 'leak_rate', label: '泄漏率 (0-1)', type: 'number', default: 0.3 }],
  },
  {
    id: 'db_lock',
    name: '数据库锁等待',
    description: '模拟多个进程争夺数据库锁',
    params: [{ key: 'contention_rate', label: '竞争率 (0-1)', type: 'number', default: 0.5 }],
  },
  {
    id: 'cache_dirty',
    name: '缓存脏数据',
    description: '模拟缓存数据与数据库不一致',
    params: [{ key: 'dirty_rate', label: '脏数据率 (0-1)', type: 'number', default: 0.3 }],
  },
  {
    id: 'config_drift',
    name: '配置漂移',
    description: '模拟实际配置与预期不一致',
    params: [{ key: 'drift_rate', label: '漂移率 (0-1)', type: 'number', default: 0.4 }],
  },
];

const recoveries = [
  { id: 'connection_pool', name: '连接池' },
  { id: 'message_queue', name: '消息队列' },
  { id: 'goroutine', name: 'Goroutine' },
  { id: 'db_lock', name: '数据库锁' },
  { id: 'cache', name: '缓存' },
  { id: 'config', name: '配置' },
  { id: 'all', name: '全部恢复' },
];

export const ScenarioControl: React.FC<ScenarioControlProps> = ({ onReset }) => {
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [duration, setDuration] = useState(30);
  const [paramValues, setParamValues] = useState<Record<string, number>>({});
  const [running, setRunning] = useState(false);

  const handleStartScenario = async () => {
    if (!selectedScenario) return;

    const scenario = scenarios.find((s) => s.id === selectedScenario);
    if (!scenario) return;

    const params: Record<string, any> = {};
    scenario.params.forEach((p) => {
      params[p.key] = paramValues[p.key] ?? p.default;
    });

    setRunning(true);
    try {
      await apiService.startScenario(selectedScenario, params, duration);
    } catch (error) {
      console.error('Failed to start scenario:', error);
    } finally {
      setTimeout(() => setRunning(false), duration * 1000);
    }
  };

  const handleRecovery = async (type: string) => {
    try {
      await apiService.startRecovery(type);
    } catch (error) {
      console.error('Failed to start recovery:', error);
    }
  };

  const handleReset = async () => {
    try {
      await apiService.reset();
      onReset();
    } catch (error) {
      console.error('Failed to reset:', error);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-4 text-gray-300">场景控制</h3>

      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-400 mb-2">问题场景</h4>
        <div className="grid grid-cols-2 gap-2">
          {scenarios.map((scenario) => (
            <button
              key={scenario.id}
              onClick={() => setSelectedScenario(scenario.id)}
              className={`text-left p-3 rounded border transition-all ${selectedScenario === scenario.id
                  ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                  : 'border-gray-700 hover:border-gray-600 text-gray-400'
                }`}
            >
              <div className="font-medium text-sm">{scenario.name}</div>
              <div className="text-xs mt-1 opacity-75">{scenario.description}</div>
            </button>
          ))}
        </div>
      </div>

      {selectedScenario && (
        <div className="mb-6 space-y-3">
          <div>
            <label className="text-sm text-gray-400 block mb-1">持续时间 (秒)</label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full bg-gray-700 text-gray-300 rounded px-3 py-2 text-sm"
              min={5}
              max={300}
            />
          </div>

          {scenarios.find((s) => s.id === selectedScenario)?.params.map((param) => (
            <div key={param.key}>
              <label className="text-sm text-gray-400 block mb-1">{param.label}</label>
              <input
                type={param.type}
                value={paramValues[param.key] ?? param.default}
                onChange={(e) =>
                  setParamValues((prev) => ({
                    ...prev,
                    [param.key]: Number(e.target.value),
                  }))
                }
                className="w-full bg-gray-700 text-gray-300 rounded px-3 py-2 text-sm"
                step="0.1"
              />
            </div>
          ))}

          <button
            onClick={handleStartScenario}
            disabled={running}
            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded font-medium transition-colors"
          >
            {running ? '运行中...' : '开始模拟'}
          </button>
        </div>
      )}

      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-400 mb-2">异常恢复</h4>
        <div className="grid grid-cols-2 gap-2">
          {recoveries.map((recovery) => (
            <button
              key={recovery.id}
              onClick={() => handleRecovery(recovery.id)}
              className="py-2 px-3 bg-green-600/80 hover:bg-green-600 text-white rounded text-sm transition-colors"
            >
              恢复 {recovery.name}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handleReset}
        className="w-full py-2 px-4 bg-gray-600 hover:bg-gray-500 text-white rounded font-medium transition-colors"
      >
        重置系统
      </button>
    </div>
  );
};
