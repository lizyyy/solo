import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Calendar, Database, AlertTriangle, TrendingUp, ChevronRight } from 'lucide-react';
import { useExperimentStore } from '@/store/useExperimentStore';
import { AnomalyBadge } from '@/components/AnomalyBadge';

export const ExperimentList: React.FC = () => {
  const navigate = useNavigate();
  const { experiments, loadExperiments, createNewExperiment, createExperimentWithSampleData, deleteExperiment, isLoading } = useExperimentStore();

  useEffect(() => {
    loadExperiments();
  }, [loadExperiments]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('确定要删除这个实验吗？')) {
      await deleteExperiment(id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-400">加载中...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-100">实验列表</h1>
          <p className="text-sm text-gray-400 mt-1">管理所有实验批次</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={createExperimentWithSampleData}
            className="flex items-center gap-2 px-4 py-2 border border-industrial-600 hover:bg-industrial-800 text-gray-200 rounded-lg transition-colors"
          >
            <Database size={16} />
            <span className="text-sm font-medium">加载示例数据</span>
          </button>
          <button
            onClick={createNewExperiment}
            className="flex items-center gap-2 px-4 py-2 bg-tech-500 hover:bg-tech-400 text-white rounded-lg transition-colors"
          >
            <Plus size={16} />
            <span className="text-sm font-medium">新建实验</span>
          </button>
        </div>
      </div>

      {experiments.length === 0 ? (
        <div className="bg-industrial-800 border border-industrial-700 rounded-lg p-12 text-center">
          <Database size={48} className="mx-auto mb-4 text-gray-600" />
          <h3 className="text-lg font-medium text-gray-200 mb-2">暂无实验数据</h3>
          <p className="text-sm text-gray-500 mb-6">创建一个新实验或加载示例数据开始分析</p>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={createExperimentWithSampleData}
              className="px-6 py-2 bg-tech-500 hover:bg-tech-400 text-white rounded-lg transition-colors"
            >
              加载示例数据
            </button>
            <button
              onClick={createNewExperiment}
              className="px-6 py-2 border border-industrial-600 hover:bg-industrial-700 text-gray-200 rounded-lg transition-colors"
            >
              新建空白实验
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {experiments.map((exp) => (
            <div
              key={exp.id}
              className="bg-industrial-800 border border-industrial-700 rounded-lg overflow-hidden hover:border-industrial-600 transition-colors cursor-pointer"
              onClick={() => navigate(`/experiments/${exp.id}/data`)}
            >
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${
                    exp.fittingResult ? 'bg-alert-green animate-pulse' : 'bg-gray-500'
                  }`} />
                  <div>
                    <h3 className="font-display text-base font-semibold text-gray-100">{exp.name}</h3>
                    {exp.description && (
                      <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{exp.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2">
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Calendar size={12} />
                        {new Date(exp.createdAt).toLocaleDateString()}
                      </span>
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Database size={12} />
                        {exp.dataPoints.length} 个数据点
                      </span>
                      {exp.anomalies.length > 0 && (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <AlertTriangle size={12} className="text-alert-orange" />
                          {exp.anomalies.length} 个异常
                        </span>
                      )}
                      {exp.fittingResult && (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <TrendingUp size={12} className="text-alert-green" />
                          R² = {exp.fittingResult.rSquared.toFixed(4)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    {exp.anomalies.slice(0, 3).map((a) => (
                      <AnomalyBadge key={a.id} type={a.type} severity={a.severity} showLabel={false} size="sm" />
                    ))}
                    {exp.anomalies.length > 3 && (
                      <span className="text-xs text-gray-500 font-mono">+{exp.anomalies.length - 3}</span>
                    )}
                  </div>
                  <button
                    onClick={(e) => handleDelete(e, exp.id)}
                    className="p-2 rounded text-gray-400 hover:bg-industrial-700 hover:text-alert-red transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                  <ChevronRight size={20} className="text-gray-500" />
                </div>
              </div>

              <div className="px-4 py-3 bg-industrial-900/50 border-t border-industrial-700/50 flex items-center gap-6">
                <div className="text-xs">
                  <span className="text-gray-500">空气密度: </span>
                  <span className="font-mono text-gray-300">{exp.environment.airDensity} kg/m³</span>
                </div>
                <div className="text-xs">
                  <span className="text-gray-500">拟合类型: </span>
                  <span className="font-mono text-gray-300">{exp.fittingParams.fitType}</span>
                </div>
                <div className="text-xs">
                  <span className="text-gray-500">桨径范围: </span>
                  <span className="font-mono text-gray-300">
                    {[...new Set(exp.dataPoints.map(d => d.propellerDiameter))].sort().join(', ')} inch
                  </span>
                </div>
                <div className="text-xs">
                  <span className="text-gray-500">转速范围: </span>
                  <span className="font-mono text-gray-300">
                    {exp.dataPoints.length > 0 ? `${Math.min(...exp.dataPoints.map(d => d.rpm))} - ${Math.max(...exp.dataPoints.map(d => d.rpm))}` : '-'} RPM
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
