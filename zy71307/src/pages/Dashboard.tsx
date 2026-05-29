import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FlaskConical, TrendingUp, AlertTriangle, FileText, Plus, Database, Clock, ChevronRight } from 'lucide-react';
import { useExperimentStore } from '@/store/useExperimentStore';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { experiments, loadExperiments, createExperimentWithSampleData, isLoading } = useExperimentStore();

  useEffect(() => {
    loadExperiments();
  }, [loadExperiments]);

  const totalDataPoints = experiments.reduce((sum, e) => sum + e.dataPoints.length, 0);
  const totalAnomalies = experiments.reduce((sum, e) => sum + e.anomalies.length, 0);
  const recentExperiment = experiments[0];

  const quickActions = [
    { icon: FlaskConical, label: '新建实验', onClick: () => navigate('/experiments'), color: 'text-tech-400' },
    { icon: TrendingUp, label: '拟合分析', onClick: () => recentExperiment && navigate(`/experiments/${recentExperiment.id}/fitting`), color: 'text-alert-green' },
    { icon: AlertTriangle, label: '异常检测', onClick: () => recentExperiment && navigate(`/experiments/${recentExperiment.id}/anomalies`), color: 'text-alert-orange' },
    { icon: FileText, label: '导出报告', onClick: () => recentExperiment && navigate(`/experiments/${recentExperiment.id}/report`), color: 'text-purple-400' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-100">工作台</h1>
          <p className="text-sm text-gray-400 mt-1">无人机桨叶推力实验数据分析系统</p>
        </div>
        <button
          onClick={createExperimentWithSampleData}
          className="flex items-center gap-2 px-4 py-2 bg-tech-500 hover:bg-tech-400 text-white rounded-lg transition-colors"
        >
          <Plus size={16} />
          <span className="text-sm font-medium">加载示例数据</span>
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-industrial-800 border border-industrial-700 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-tech-500/10 border border-tech-500/30 flex items-center justify-center">
              <Database size={20} className="text-tech-400" />
            </div>
            <div>
              <p className="text-xs text-gray-400">实验批次</p>
              <p className="text-2xl font-bold font-mono text-gray-100">{experiments.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-industrial-800 border border-industrial-700 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-alert-green/10 border border-alert-green/30 flex items-center justify-center">
              <TrendingUp size={20} className="text-alert-green" />
            </div>
            <div>
              <p className="text-xs text-gray-400">数据点总数</p>
              <p className="text-2xl font-bold font-mono text-gray-100">{totalDataPoints}</p>
            </div>
          </div>
        </div>
        <div className="bg-industrial-800 border border-industrial-700 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-alert-orange/10 border border-alert-orange/30 flex items-center justify-center">
              <AlertTriangle size={20} className="text-alert-orange" />
            </div>
            <div>
              <p className="text-xs text-gray-400">异常检测</p>
              <p className="text-2xl font-bold font-mono text-alert-orange">{totalAnomalies}</p>
            </div>
          </div>
        </div>
        <div className="bg-industrial-800 border border-industrial-700 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center">
              <FileText size={20} className="text-purple-400" />
            </div>
            <div>
              <p className="text-xs text-gray-400">已完成分析</p>
              <p className="text-2xl font-bold font-mono text-gray-100">
                {experiments.filter(e => e.fittingResult).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {quickActions.map((action, index) => (
          <button
            key={index}
            onClick={action.onClick}
            disabled={!recentExperiment && index > 0}
            className={`flex items-center gap-3 p-4 bg-industrial-800 border border-industrial-700 rounded-lg hover:bg-industrial-700/50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <action.icon size={20} className={action.color} />
            <span className="text-sm font-medium text-gray-200">{action.label}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 bg-industrial-800 border border-industrial-700 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-industrial-700">
            <h2 className="font-display text-sm font-semibold text-gray-100">最近实验</h2>
            <button
              onClick={() => navigate('/experiments')}
              className="text-xs text-tech-400 hover:text-tech-300 flex items-center gap-1"
            >
              查看全部 <ChevronRight size={12} />
            </button>
          </div>
          <div className="divide-y divide-industrial-700">
            {experiments.slice(0, 5).map((exp) => (
              <button
                key={exp.id}
                onClick={() => navigate(`/experiments/${exp.id}/data`)}
                className="w-full flex items-center justify-between p-4 hover:bg-industrial-700/30 transition-colors text-left"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-2 h-2 rounded-full ${
                    exp.fittingResult ? 'bg-alert-green' : 'bg-gray-500'
                  }`} />
                  <div>
                    <p className="text-sm font-medium text-gray-200">{exp.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {exp.dataPoints.length} 个数据点 · {exp.anomalies.length} 个异常
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <Clock size={12} />
                    {new Date(exp.updatedAt).toLocaleDateString()}
                  </p>
                  {exp.fittingResult && (
                    <p className="text-xs font-mono text-tech-400 mt-0.5">
                      R² = {exp.fittingResult.rSquared.toFixed(4)}
                    </p>
                  )}
                </div>
              </button>
            ))}
            {experiments.length === 0 && (
              <div className="py-12 text-center text-gray-500">
                <FlaskConical size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">暂无实验数据</p>
                <p className="text-xs mt-1">点击上方"加载示例数据"开始</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-industrial-800 border border-industrial-700 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-industrial-700">
            <h2 className="font-display text-sm font-semibold text-gray-100">异常统计</h2>
          </div>
          <div className="p-4 space-y-4">
            {[
              { type: '转速缺样', count: experiments.reduce((s, e) => s + e.anomalies.filter(a => a.type === 'rpm_missing').length, 0), color: 'bg-alert-orange' },
              { type: '电压骤降', count: experiments.reduce((s, e) => s + e.anomalies.filter(a => a.type === 'voltage_sag').length, 0), color: 'bg-alert-yellow' },
              { type: '单位错误', count: experiments.reduce((s, e) => s + e.anomalies.filter(a => a.type === 'unit_error').length, 0), color: 'bg-alert-red' },
            ].map((item, index) => (
              <div key={index}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-400">{item.type}</span>
                  <span className="font-mono text-gray-200">{item.count}</span>
                </div>
                <div className="h-2 bg-industrial-900 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${item.color} transition-all`}
                    style={{ width: `${Math.min(totalAnomalies > 0 ? (item.count / totalAnomalies) * 100 : 0, 100)}%` }}
                  />
                </div>
              </div>
            ))}

            <div className="pt-4 border-t border-industrial-700">
              <h3 className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-3">系统状态</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">本地存储</span>
                  <span className="font-mono text-alert-green">已启用</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">计算引擎</span>
                  <span className="font-mono text-alert-green">就绪</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">参数配置</span>
                  <span className="font-mono text-alert-green">已加载</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
