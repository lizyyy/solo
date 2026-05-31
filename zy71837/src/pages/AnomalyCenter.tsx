import React, { useState } from 'react';
import { AlertTriangle, AlertCircle, CheckCircle, XCircle, Filter } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { AnomalyCard } from '@/components/AnomalyCard';
import type { AnomalySeverity, AnomalyStatus, AnomalyType } from '@/types';
import { getAnomalyTypeLabel } from '@/utils/anomalyDetector';

export const AnomalyCenter: React.FC = () => {
  const { anomalies, detectAnomalies, currentVersion } = useAppStore();
  const [severityFilter, setSeverityFilter] = useState<AnomalySeverity | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<AnomalyStatus | 'all'>('open');
  const [typeFilter, setTypeFilter] = useState<AnomalyType | 'all'>('all');
  const [isDetecting, setIsDetecting] = useState(false);

  const handleDetect = async () => {
    setIsDetecting(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    detectAnomalies();
    setIsDetecting(false);
  };

  const filteredAnomalies = anomalies.filter(a => {
    if (severityFilter !== 'all' && a.severity !== severityFilter) return false;
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    if (typeFilter !== 'all' && a.type !== typeFilter) return false;
    return true;
  });

  const stats = {
    total: anomalies.length,
    open: anomalies.filter(a => a.status === 'open').length,
    resolved: anomalies.filter(a => a.status === 'resolved').length,
    critical: anomalies.filter(a => a.severity === 'critical' && a.status === 'open').length,
    high: anomalies.filter(a => a.severity === 'high' && a.status === 'open').length,
    medium: anomalies.filter(a => a.severity === 'medium' && a.status === 'open').length
  };

  const uniqueTypes = Array.from(new Set(anomalies.map(a => a.type)));

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-primary-200 bg-white">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-danger-500" />
            <h1 className="font-mono font-bold text-lg text-primary-800">异常中心</h1>
          </div>
          {currentVersion && (
            <span className="text-sm text-primary-500 font-mono">
              基于版本 v{currentVersion.version}
            </span>
          )}
        </div>
        <button
          onClick={handleDetect}
          disabled={isDetecting}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-danger-600 text-white hover:bg-danger-700 transition-colors disabled:opacity-50"
        >
          <AlertCircle className={`w-4 h-4 ${isDetecting ? 'animate-pulse' : ''}`} />
          {isDetecting ? '检测中...' : '重新检测'}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 p-4 border-b border-primary-200 bg-primary-50">
        <div className="p-4 bg-white border border-primary-200">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-primary-400" />
            <span className="text-xs text-primary-500 font-mono">总计</span>
          </div>
          <div className="font-mono text-2xl font-bold text-primary-800">{stats.total}</div>
        </div>
        <div className="p-4 bg-white border border-primary-200">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="w-4 h-4 text-danger-500" />
            <span className="text-xs text-primary-500 font-mono">待处理</span>
          </div>
          <div className="font-mono text-2xl font-bold text-danger-600">{stats.open}</div>
        </div>
        <div className="p-4 bg-white border border-primary-200">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-4 h-4 text-success-500" />
            <span className="text-xs text-primary-500 font-mono">已解决</span>
          </div>
          <div className="font-mono text-2xl font-bold text-success-600">{stats.resolved}</div>
        </div>
        <div className="p-4 bg-danger-50 border border-danger-200">
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="w-4 h-4 text-danger-600" />
            <span className="text-xs text-danger-600 font-mono">严重</span>
          </div>
          <div className="font-mono text-2xl font-bold text-danger-700">{stats.critical}</div>
        </div>
        <div className="p-4 bg-danger-50 border border-danger-200">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="w-4 h-4 text-danger-500" />
            <span className="text-xs text-danger-600 font-mono">高危</span>
          </div>
          <div className="font-mono text-2xl font-bold text-danger-600">{stats.high}</div>
        </div>
        <div className="p-4 bg-warning-50 border border-warning-200">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-warning-500" />
            <span className="text-xs text-warning-600 font-mono">中危</span>
          </div>
          <div className="font-mono text-2xl font-bold text-warning-600">{stats.medium}</div>
        </div>
      </div>

      <div className="flex items-center gap-4 px-4 py-3 border-b border-primary-200 bg-white">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-primary-400" />
          <span className="text-sm font-mono text-primary-600">筛选:</span>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="px-3 py-1.5 text-sm border border-primary-300 bg-white focus:outline-none focus:border-info-500 font-mono"
        >
          <option value="all">全部状态</option>
          <option value="open">待处理</option>
          <option value="resolved">已解决</option>
          <option value="ignored">已忽略</option>
        </select>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value as any)}
          className="px-3 py-1.5 text-sm border border-primary-300 bg-white focus:outline-none focus:border-info-500 font-mono"
        >
          <option value="all">全部级别</option>
          <option value="critical">严重</option>
          <option value="high">高危</option>
          <option value="medium">中危</option>
          <option value="low">低危</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as any)}
          className="px-3 py-1.5 text-sm border border-primary-300 bg-white focus:outline-none focus:border-info-500 font-mono"
        >
          <option value="all">全部类型</option>
          {uniqueTypes.map(type => (
            <option key={type} value={type}>{getAnomalyTypeLabel(type)}</option>
          ))}
        </select>
        <span className="text-sm text-primary-400 font-mono ml-auto">
          共 {filteredAnomalies.length} 条
        </span>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-4xl mx-auto space-y-3">
          {filteredAnomalies.length === 0 ? (
            <div className="text-center py-12 text-primary-400">
              <CheckCircle className="w-12 h-12 mx-auto mb-4 text-success-400" />
              <p className="font-mono">暂无符合条件的异常</p>
            </div>
          ) : (
            filteredAnomalies.map(anomaly => (
              <AnomalyCard key={anomaly.id} anomaly={anomaly} />
            ))
          )}
        </div>
      </div>
    </div>
  );
};
