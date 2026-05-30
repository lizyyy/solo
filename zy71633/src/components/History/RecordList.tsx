import { useState } from 'react';
import { Trash2, FileDown, Eye, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { useHistoryStore } from '../../store/useHistoryStore';
import { Experiment } from '../../types';
import { exportToHTML, exportToJSON } from '../../utils/export';

interface RecordItemProps {
  experiment: Experiment;
  onView: (id: string) => void;
  onDelete: (id: string) => void;
}

function RecordItem({ experiment, onView, onDelete }: RecordItemProps) {
  const hasAnomalies = experiment.anomalies.filter((a) => !a.resolved).length > 0;

  return (
    <div className={`p-4 bg-space-800/50 rounded-lg border ${
      hasAnomalies ? 'border-danger-500/50' : 'border-cyber-500/20'
    } hover:border-cyber-500/50 transition-all duration-200`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-white font-jetbrains truncate">{experiment.name}</h4>
            {hasAnomalies && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-danger-500/20 text-danger-500 text-xs rounded">
                <AlertTriangle size={12} />
                异常
              </span>
            )}
            {experiment.status === 'completed' && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">
                <CheckCircle size={12} />
                完成
              </span>
            )}
          </div>
          <div className="text-xs text-gray-400 font-jetbrains">
            {new Date(experiment.timestamp).toLocaleString('zh-CN')}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-space-900/50 rounded p-2">
          <div className="text-xs text-gray-500">电流</div>
          <div className="text-sm text-cyber-500 font-jetbrains">{experiment.params.coilCurrent}A</div>
        </div>
        <div className="bg-space-900/50 rounded p-2">
          <div className="text-xs text-gray-500">速度</div>
          <div className="text-sm text-green-400 font-jetbrains">
            {experiment.result ? experiment.result.finalVelocity.toFixed(1) : '--'}m/s
          </div>
        </div>
        <div className="bg-space-900/50 rounded p-2">
          <div className="text-xs text-gray-500">温度</div>
          <div className={`text-sm font-jetbrains ${
            experiment.result && experiment.result.maxTemperature > 80
              ? 'text-danger-500'
              : 'text-warning-500'
          }`}>
            {experiment.result ? experiment.result.maxTemperature.toFixed(1) : '--'}°C
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onView(experiment.id)}
          className="flex-1 py-2 px-3 bg-space-700 hover:bg-space-600 text-white text-sm font-jetbrains rounded transition-colors flex items-center justify-center gap-1"
        >
          <Eye size={14} />
          查看
        </button>
        <button
          onClick={() => exportToHTML(experiment)}
          className="py-2 px-3 bg-cyber-500/20 hover:bg-cyber-500/30 text-cyber-500 text-sm font-jetbrains rounded transition-colors flex items-center justify-center gap-1"
        >
          <FileDown size={14} />
          导出
        </button>
        <button
          onClick={() => onDelete(experiment.id)}
          className="py-2 px-3 bg-danger-500/20 hover:bg-danger-500/30 text-danger-500 text-sm font-jetbrains rounded transition-colors flex items-center justify-center gap-1"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

export function RecordList() {
  const { experiments, actions } = useHistoryStore();
  const [filter, setFilter] = useState<'all' | 'withAnomalies' | 'completed'>('all');

  const filteredExperiments = experiments.filter((exp) => {
    if (filter === 'withAnomalies') return exp.anomalies.some((a) => !a.resolved);
    if (filter === 'completed') return exp.status === 'completed';
    return true;
  });

  return (
    <div className="min-h-screen bg-space-900 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-orbitron text-cyber-500 tracking-wider">
            实验历史
          </h1>
          <div className="flex items-center gap-2">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="px-3 py-2 bg-space-800 border border-cyber-500/30 rounded text-white text-sm font-jetbrains focus:outline-none focus:border-cyber-500"
            >
              <option value="all">全部实验</option>
              <option value="withAnomalies">含异常</option>
              <option value="completed">已完成</option>
            </select>
          </div>
        </div>

        {filteredExperiments.length === 0 ? (
          <div className="text-center py-20">
            <Clock size={48} className="mx-auto text-gray-600 mb-4" />
            <p className="text-gray-500 font-jetbrains">暂无实验记录</p>
            <p className="text-gray-600 text-sm mt-2">完成实验后记录将显示在这里</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredExperiments.map((experiment) => (
              <RecordItem
                key={experiment.id}
                experiment={experiment}
                onView={() => {}}
                onDelete={actions.deleteExperiment}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
