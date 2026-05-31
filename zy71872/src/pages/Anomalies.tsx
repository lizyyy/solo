import { useState } from 'react';
import { AlertTriangle, CheckCircle, Filter, Info, AlertCircle } from 'lucide-react';
import { useSimulationStore } from '../store/useSimulationStore';
import { getAnomalyTypeLabel, getAnomalySeverityColor } from '../services/anomalyService';
import type { AnomalyType, AnomalySeverity } from '../types';

export function Anomalies() {
  const { anomalies, submissions, teams, markAnomalyHandled } = useSimulationStore();
  const [filterType, setFilterType] = useState<AnomalyType | 'all'>('all');
  const [filterSeverity, setFilterSeverity] = useState<AnomalySeverity | 'all'>('all');
  const [filterHandled, setFilterHandled] = useState<'all' | 'handled' | 'unhandled'>('unhandled');

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN');
  };

  const getTeamName = (teamId: string) => {
    return teams.find((t) => t.id === teamId)?.name || teamId;
  };

  const getSubmissionInfo = (submissionId: string) => {
    return submissions.find((s) => s.id === submissionId);
  };

  const filteredAnomalies = anomalies.filter((a) => {
    if (filterType !== 'all' && a.type !== filterType) return false;
    if (filterSeverity !== 'all' && a.severity !== filterSeverity) return false;
    if (filterHandled === 'handled' && !a.handled) return false;
    if (filterHandled === 'unhandled' && a.handled) return false;
    return true;
  });

  const sortedAnomalies = [...filteredAnomalies].sort((a, b) => b.timestamp - a.timestamp);

  const stats = {
    total: anomalies.length,
    unhandled: anomalies.filter((a) => !a.handled).length,
    errors: anomalies.filter((a) => a.severity === 'error').length,
    warnings: anomalies.filter((a) => a.severity === 'warning').length,
    infos: anomalies.filter((a) => a.severity === 'info').length,
  };

  const typeOptions: { value: AnomalyType | 'all'; label: string }[] = [
    { value: 'all', label: '全部类型' },
    { value: 'missing_notes', label: '缺队员笔记' },
    { value: 'duplicate_chart', label: '重复结果图' },
    { value: 'boundary_case', label: '边界情况' },
    { value: 'draft_modified', label: '草稿修改' },
    { value: 'resubmission', label: '二次提交' },
  ];

  const severityOptions: { value: AnomalySeverity | 'all'; label: string; icon: typeof Info }[] = [
    { value: 'all', label: '全部等级', icon: Filter },
    { value: 'error', label: '错误', icon: AlertCircle },
    { value: 'warning', label: '警告', icon: AlertTriangle },
    { value: 'info', label: '提示', icon: Info },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">异常中心</h1>
        {anomalies.length > 0 && (
          <div className="flex items-center space-x-4">
            <div className="text-sm text-slate-400">
              共 <span className="text-slate-200 font-mono">{anomalies.length}</span> 个异常,
              未处理 <span className="text-red-400 font-mono">{stats.unhandled}</span> 个
            </div>
          </div>
        )}
      </div>

      {anomalies.length === 0 ? (
        <div className="panel text-center py-12 text-slate-500">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>暂无异常记录</p>
          <p className="text-sm mt-2">运行仿真后系统会自动检测异常</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="panel">
              <div className="text-xs text-slate-400">总计</div>
              <div className="font-mono text-2xl font-semibold text-slate-200 mt-1">
                {stats.total}
              </div>
            </div>
            <div className="panel">
              <div className="text-xs text-slate-400">未处理</div>
              <div className={`font-mono text-2xl font-semibold mt-1 ${stats.unhandled > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {stats.unhandled}
              </div>
            </div>
            <div className="panel">
              <div className="text-xs text-slate-400">错误</div>
              <div className="font-mono text-2xl font-semibold text-red-400 mt-1">
                {stats.errors}
              </div>
            </div>
            <div className="panel">
              <div className="text-xs text-slate-400">警告</div>
              <div className="font-mono text-2xl font-semibold text-amber-400 mt-1">
                {stats.warnings}
              </div>
            </div>
            <div className="panel">
              <div className="text-xs text-slate-400">提示</div>
              <div className="font-mono text-2xl font-semibold text-blue-400 mt-1">
                {stats.infos}
              </div>
            </div>
          </div>

          <div className="panel mb-6">
            <div className="flex items-center space-x-4 flex-wrap gap-y-2">
              <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-400">筛选:</span>
              </div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as AnomalyType | 'all')}
                className="bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              >
                {typeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <select
                value={filterSeverity}
                onChange={(e) => setFilterSeverity(e.target.value as AnomalySeverity | 'all')}
                className="bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              >
                {severityOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <select
                value={filterHandled}
                onChange={(e) => setFilterHandled(e.target.value as 'all' | 'handled' | 'unhandled')}
                className="bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              >
                <option value="all">全部状态</option>
                <option value="unhandled">未处理</option>
                <option value="handled">已处理</option>
              </select>
              <span className="text-sm text-slate-500 ml-auto">
                显示 {sortedAnomalies.length} 条
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {sortedAnomalies.length === 0 ? (
              <div className="panel text-center py-8 text-slate-500">
                没有符合筛选条件的异常记录
              </div>
            ) : (
              sortedAnomalies.map((anomaly) => {
                const submission = getSubmissionInfo(anomaly.submissionId);
                const SeverityIcon = severityOptions.find((s) => s.value === anomaly.severity)?.icon || AlertTriangle;
                return (
                  <div
                    key={anomaly.id}
                    className={`panel border-l-4 ${
                      anomaly.severity === 'error'
                        ? 'border-l-red-500'
                        : anomaly.severity === 'warning'
                        ? 'border-l-amber-500'
                        : 'border-l-blue-500'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        <SeverityIcon
                          className={`w-5 h-5 mt-0.5 ${
                            anomaly.severity === 'error'
                              ? 'text-red-400'
                              : anomaly.severity === 'warning'
                              ? 'text-amber-400'
                              : 'text-blue-400'
                          }`}
                        />
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className={`badge ${getAnomalySeverityColor(anomaly.severity)}`}>
                              {getAnomalyTypeLabel(anomaly.type)}
                            </span>
                            <span className="text-sm font-medium">{anomaly.message}</span>
                            {anomaly.handled && (
                              <span className="badge text-emerald-400 bg-emerald-900/30 border-emerald-500/50 text-xs">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                已处理
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-slate-400 mt-2">
                            {anomaly.explanation}
                          </div>
                          <div className="flex items-center space-x-4 mt-3 text-xs text-slate-500">
                            <span>队伍: {getTeamName(anomaly.teamId)}</span>
                            {submission && (
                              <span>提交ID: {submission.id.substring(0, 12)}...</span>
                            )}
                            <span>时间: {formatTime(anomaly.timestamp)}</span>
                          </div>
                        </div>
                      </div>
                      {!anomaly.handled && (
                        <button
                          className="btn btn-success text-xs"
                          onClick={() => markAnomalyHandled(anomaly.id)}
                        >
                          <CheckCircle className="w-3 h-3 mr-2" />
                          标记已处理
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
