import { useAppStore } from '@/store/useAppStore';
import {
  AnomalyTypeBadge,
  SeverityBadge,
  StatusBadge,
  SourceTypeBadge,
} from '@/components/common/Badges';
import {
  AlertTriangle,
  Filter,
  Search,
  ChevronDown,
  MapPin,
  FileText,
  Rows3,
  ArrowRight,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { useState } from 'react';
import { anomalyTypeLabels, severityLabels, sourceTypeLabels } from '@/utils/anomalyDetector';
import type { AnomalyType, Severity, EvidenceStatus } from '@/types';
import { useNavigate } from 'react-router-dom';

export default function AnomaliesPage() {
  const { anomalies, filter, setFilter, setAnomalyStatus, stations, selectAnomaly } = useAppStore();
  const navigate = useNavigate();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = anomalies.filter(a => {
    if (filter.type !== 'all' && a.type !== filter.type) return false;
    if (filter.status !== 'all' && a.status !== filter.status) return false;
    if (filter.severity !== 'all' && a.severity !== filter.severity) return false;
    if (filter.stationId !== 'all' && a.stationId !== filter.stationId) return false;
    return true;
  });

  const sortedAnomalies = [...filtered].sort((a, b) => {
    const severityOrder = { high: 0, medium: 1, low: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  const stats = {
    total: anomalies.length,
    unit: anomalies.filter(a => a.type === 'unit_mismatch').length,
    caliber: anomalies.filter(a => a.type === 'caliber_change').length,
    time: anomalies.filter(a => a.type === 'time_mismatch').length,
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleViewEvidence = (anomalyId: string) => {
    selectAnomaly(anomalyId);
    navigate('/review');
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-ocean-800">异常检测面板</h2>
          <p className="text-sm text-ocean-500 mt-1">
            自动识别单位混写、口径变更、时间不一致等数据异常
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/compare')}
            className="btn-secondary text-sm flex items-center gap-1.5"
          >
            版本对比
            <ArrowRight className="w-4 h-4" />
          </button>
          <button className="btn-primary text-sm flex items-center gap-1.5">
            导出异常报告
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: '异常总数', value: stats.total, icon: AlertTriangle, color: 'text-alert-orange', bg: 'bg-alert-orange/10' },
          { label: '单位混写', value: stats.unit, icon: Rows3, color: 'text-ocean-600', bg: 'bg-ocean-100' },
          { label: '口径变更', value: stats.caliber, icon: FileText, color: 'text-purple-600', bg: 'bg-purple-100' },
          { label: '时间不一致', value: stats.time, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map((item, i) => {
          const Icon = item.icon;
          return (
            <div key={i} className="card-base card-hover p-4 animate-fade-in-up stagger-1" style={{ opacity: 0, animationDelay: `${i * 50}ms` }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-ocean-600">{item.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${item.color}`}>{item.value}</p>
                </div>
                <div className={`p-3 rounded-lg ${item.bg}`}>
                  <Icon className={`w-5 h-5 ${item.color}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card-base p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-ocean-500" />
            <span className="text-sm font-medium text-ocean-700">筛选条件</span>
          </div>
          <span className="text-xs text-ocean-500">
            共 {sortedAnomalies.length} 条结果
          </span>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-ocean-500">异常类型</label>
            <select
              value={filter.type}
              onChange={(e) => setFilter({ type: e.target.value as AnomalyType | 'all' })}
              className="px-3 py-1.5 text-sm border border-ocean-200 rounded-md bg-white
                         focus:outline-none focus:border-ocean-400"
            >
              <option value="all">全部类型</option>
              {Object.entries(anomalyTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-ocean-500">严重程度</label>
            <select
              value={filter.severity}
              onChange={(e) => setFilter({ severity: e.target.value as Severity | 'all' })}
              className="px-3 py-1.5 text-sm border border-ocean-200 rounded-md bg-white
                         focus:outline-none focus:border-ocean-400"
            >
              <option value="all">全部等级</option>
              {Object.entries(severityLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-ocean-500">确认状态</label>
            <select
              value={filter.status}
              onChange={(e) => setFilter({ status: e.target.value as EvidenceStatus | 'all' })}
              className="px-3 py-1.5 text-sm border border-ocean-200 rounded-md bg-white
                         focus:outline-none focus:border-ocean-400"
            >
              <option value="all">全部状态</option>
              <option value="confirmed">已确认</option>
              <option value="pending">待补证据</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-ocean-500">监测点位</label>
            <select
              value={filter.stationId}
              onChange={(e) => setFilter({ stationId: e.target.value })}
              className="px-3 py-1.5 text-sm border border-ocean-200 rounded-md bg-white
                         focus:outline-none focus:border-ocean-400"
            >
              <option value="all">全部点位</option>
              {stations.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="card-base overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ocean-50">
            <tr>
              <th className="text-left py-3 px-4 font-medium text-ocean-600 text-xs uppercase tracking-wider w-10"></th>
              <th className="text-left py-3 px-4 font-medium text-ocean-600 text-xs uppercase tracking-wider">类型</th>
              <th className="text-left py-3 px-4 font-medium text-ocean-600 text-xs uppercase tracking-wider">点位</th>
              <th className="text-left py-3 px-4 font-medium text-ocean-600 text-xs uppercase tracking-wider">异常描述</th>
              <th className="text-left py-3 px-4 font-medium text-ocean-600 text-xs uppercase tracking-wider">影响范围</th>
              <th className="text-left py-3 px-4 font-medium text-ocean-600 text-xs uppercase tracking-wider">严重度</th>
              <th className="text-left py-3 px-4 font-medium text-ocean-600 text-xs uppercase tracking-wider">状态</th>
              <th className="text-left py-3 px-4 font-medium text-ocean-600 text-xs uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody>
            {sortedAnomalies.map((anomaly) => {
              const isExpanded = expandedId === anomaly.id;
              return (
                <>
                  <tr
                    key={anomaly.id}
                    className="border-b border-ocean-50 hover:bg-ocean-50/50 cursor-pointer transition-colors"
                    onClick={() => toggleExpand(anomaly.id)}
                  >
                    <td className="py-3 px-4">
                      <ChevronDown className={`w-4 h-4 text-ocean-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </td>
                    <td className="py-3 px-4">
                      <AnomalyTypeBadge type={anomaly.type} />
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-ocean-400" />
                        <span className="text-ocean-700">{anomaly.stationName}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-ocean-600 max-w-xs">{anomaly.description}</td>
                    <td className="py-3 px-4 text-ocean-500 text-xs">{anomaly.impactRange}</td>
                    <td className="py-3 px-4">
                      <SeverityBadge severity={anomaly.severity} size="sm" />
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={anomaly.status} />
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        {anomaly.status === 'pending' ? (
                          <button
                            onClick={() => setAnomalyStatus(anomaly.id, 'confirmed')}
                            className="text-xs text-alert-green hover:text-alert-green/80 flex items-center gap-1"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            标记确认
                          </button>
                        ) : (
                          <button
                            onClick={() => setAnomalyStatus(anomaly.id, 'pending')}
                            className="text-xs text-ocean-500 hover:text-ocean-700 flex items-center gap-1"
                          >
                            <Clock className="w-3.5 h-3.5" />
                            改为待补
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="bg-ocean-50/30">
                      <td colSpan={8} className="py-4 px-8">
                        <div className="grid grid-cols-2 gap-6">
                          <div>
                            <h4 className="text-xs font-semibold text-ocean-700 uppercase tracking-wider mb-3">
                              涉及材料
                            </h4>
                            <div className="space-y-2">
                              {anomaly.materialNames.map((name, i) => (
                                <div key={i} className="flex items-center gap-2 text-sm text-ocean-600">
                                  <FileText className="w-4 h-4 text-ocean-400" />
                                  <span>{name}</span>
                                </div>
                              ))}
                            </div>
                            <div className="mt-3 pt-3 border-t border-ocean-100">
                              <div className="text-xs text-ocean-500">
                                来源行号：第 {anomaly.sourceRows.join(', ')} 行
                              </div>
                            </div>
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold text-ocean-700 uppercase tracking-wider mb-3">
                              结论变化说明
                            </h4>
                            <p className="text-sm text-ocean-600 leading-relaxed">
                              {anomaly.conclusionChange}
                            </p>
                            <button
                              onClick={() => handleViewEvidence(anomaly.id)}
                              className="mt-3 text-sm text-ocean-600 hover:text-ocean-800 flex items-center gap-1"
                            >
                              查看完整证据链
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>

        {sortedAnomalies.length === 0 && (
          <div className="py-12 text-center">
            <Search className="w-10 h-10 text-ocean-300 mx-auto mb-3" />
            <p className="text-ocean-500">没有找到符合条件的异常记录</p>
          </div>
        )}
      </div>
    </div>
  );
}
