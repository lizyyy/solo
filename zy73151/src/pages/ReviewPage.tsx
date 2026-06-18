import { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import {
  AnomalyTypeBadge,
  SeverityBadge,
  StatusBadge,
  SourceTypeBadge,
} from '@/components/common/Badges';
import {
  ClipboardCheck,
  CheckCircle,
  Clock,
  AlertTriangle,
  ChevronRight,
  MapPin,
  FileText,
  MessageSquare,
  ArrowRight,
  Filter,
  Search,
  Layers,
  History,
} from 'lucide-react';
import { anomalyTypeLabels, severityLabels, sourceTypeLabels } from '@/utils/anomalyDetector';
import type { AnomalyType, Severity, EvidenceStatus, EvidenceItem } from '@/types';

export default function ReviewPage() {
  const { anomalies, filter, setFilter, setAnomalyStatus, selectedAnomalyId, selectAnomaly, materials } = useAppStore();
  const [activeTab, setActiveTab] = useState<'all' | 'confirmed' | 'pending'>('all');

  const filtered = anomalies.filter(a => {
    if (activeTab === 'confirmed' && a.status !== 'confirmed') return false;
    if (activeTab === 'pending' && a.status !== 'pending') return false;
    if (filter.type !== 'all' && a.type !== filter.type) return false;
    if (filter.severity !== 'all' && a.severity !== filter.severity) return false;
    if (filter.stationId !== 'all' && a.stationId !== filter.stationId) return false;
    return true;
  });

  const sortedAnomalies = [...filtered].sort((a, b) => {
    const severityOrder = { high: 0, medium: 1, low: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  const selectedAnomaly = anomalies.find(a => a.id === selectedAnomalyId);

  const stats = {
    total: anomalies.length,
    confirmed: anomalies.filter(a => a.status === 'confirmed').length,
    pending: anomalies.filter(a => a.status === 'pending').length,
    high: anomalies.filter(a => a.severity === 'high').length,
  };

  const confirmationRate = stats.total > 0 ? ((stats.confirmed / stats.total) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-ocean-800">复核汇总</h2>
          <p className="text-sm text-ocean-500 mt-1">
            分类管理异常记录，区分已确认与待补证据，追溯结论变化
          </p>
        </div>
        <button className="btn-primary text-sm flex items-center gap-1.5">
          导出复核报告
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: '异常总数', value: stats.total, icon: AlertTriangle, color: 'text-alert-orange', bg: 'bg-alert-orange/10', border: 'border-alert-orange/20' },
          { label: '已确认', value: stats.confirmed, icon: CheckCircle, color: 'text-alert-green', bg: 'bg-alert-green/10', border: 'border-alert-green/20' },
          { label: '待补证据', value: stats.pending, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
          { label: '高风险', value: stats.high, icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-200' },
        ].map((item, i) => {
          const Icon = item.icon;
          return (
            <div
              key={i}
              className={`card-base card-hover p-4 border ${item.border} animate-fade-in-up stagger-${i + 1}`}
              style={{ opacity: 0 }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-ocean-600">{item.label}</p>
                  <p className={`text-3xl font-bold mt-1 ${item.color}`}>{item.value}</p>
                </div>
                <div className={`p-2.5 rounded-lg ${item.bg}`}>
                  <Icon className={`w-5 h-5 ${item.color}`} />
                </div>
              </div>
              {i === 1 && (
                <div className="mt-3 pt-3 border-t border-ocean-100">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-ocean-500">确认率</span>
                    <span className="font-medium text-ocean-700">{confirmationRate}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 bg-ocean-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-alert-green rounded-full transition-all duration-500"
                      style={{ width: `${confirmationRate}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-4">
          <div className="card-base">
            <div className="flex items-center border-b border-ocean-100">
              {[
                { key: 'all', label: '全部异常', count: stats.total },
                { key: 'pending', label: '待补证据', count: stats.pending },
                { key: 'confirmed', label: '已确认', count: stats.confirmed },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as typeof activeTab)}
                  className={`px-6 py-3 text-sm font-medium transition-colors relative ${
                    activeTab === tab.key
                      ? 'text-ocean-700'
                      : 'text-ocean-500 hover:text-ocean-700'
                  }`}
                >
                  {tab.label}
                  <span className={`ml-2 text-xs ${
                    activeTab === tab.key ? 'text-ocean-700' : 'text-ocean-400'
                  }`}>
                    {tab.count}
                  </span>
                  {activeTab === tab.key && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-ocean-600" />
                  )}
                </button>
              ))}
            </div>

            <div className="p-4 border-b border-ocean-50 flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-ocean-500" />
                <select
                  value={filter.type}
                  onChange={(e) => setFilter({ type: e.target.value as AnomalyType | 'all' })}
                  className="px-3 py-1.5 text-sm border border-ocean-200 rounded-md bg-white
                             focus:outline-none focus:border-ocean-400"
                >
                  <option value="all">全部类型</option>
                  {Object.entries(anomalyTypeLabels).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={filter.severity}
                  onChange={(e) => setFilter({ severity: e.target.value as Severity | 'all' })}
                  className="px-3 py-1.5 text-sm border border-ocean-200 rounded-md bg-white
                             focus:outline-none focus:border-ocean-400"
                >
                  <option value="all">全部等级</option>
                  {Object.entries(severityLabels).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="divide-y divide-ocean-50 max-h-[500px] overflow-y-auto scrollbar-thin">
              {sortedAnomalies.map((anomaly, index) => (
                <div
                  key={anomaly.id}
                  onClick={() => selectAnomaly(anomaly.id)}
                  className={`p-4 cursor-pointer transition-colors ${
                    selectedAnomalyId === anomaly.id
                      ? 'bg-ocean-50/70'
                      : 'hover:bg-ocean-50/40'
                  }`}
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <AnomalyTypeBadge type={anomaly.type} />
                        <SeverityBadge severity={anomaly.severity} size="sm" />
                      </div>
                      <p className="text-sm text-ocean-700 font-medium">
                        {anomaly.description}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-ocean-500">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {anomaly.stationName}
                        </span>
                        <span className="flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          第 {anomaly.sourceRows.join(', ')} 行
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <StatusBadge status={anomaly.status} />
                      <ChevronRight className="w-4 h-4 text-ocean-300" />
                    </div>
                  </div>
                </div>
              ))}

              {sortedAnomalies.length === 0 && (
                <div className="py-12 text-center">
                  <Search className="w-10 h-10 text-ocean-300 mx-auto mb-3" />
                  <p className="text-ocean-500">没有符合条件的异常记录</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card-base p-4">
            <h3 className="text-sm font-semibold text-ocean-700 flex items-center gap-2 mb-4">
              <Layers className="w-4 h-4" />
              材料版本时间线
            </h3>
            <div className="space-y-3">
              {[...materials].sort((a, b) =>
                new Date(b.uploadTime).getTime() - new Date(a.uploadTime).getTime()
              ).map((material, i) => (
                <div key={material.id} className="flex items-start gap-3">
                  <div className="relative">
                    <div className={`w-3 h-3 rounded-full mt-1 ${
                      material.isLatest ? 'bg-alert-green' : 'bg-ocean-300'
                    }`} />
                    {i < materials.length - 1 && (
                      <div className="absolute top-4 left-1/2 -translate-x-1/2 w-px h-full bg-ocean-200" />
                    )}
                  </div>
                  <div className="flex-1 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-ocean-800 truncate">
                        {material.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <SourceTypeBadge source={material.source} />
                      <span className="text-xs text-ocean-500">v{material.version}</span>
                    </div>
                    <p className="text-xs text-ocean-400 mt-1">{material.uploadTime}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {selectedAnomaly && (
            <EvidenceDetailCard anomalyId={selectedAnomalyId!} />
          )}

          {!selectedAnomaly && (
            <div className="card-base p-6 text-center">
              <History className="w-10 h-10 text-ocean-300 mx-auto mb-3" />
              <p className="text-sm text-ocean-500">选择左侧异常查看证据链</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EvidenceDetailCard({ anomalyId }: { anomalyId: string }) {
  const { anomalies, setAnomalyStatus } = useAppStore();
  const anomaly = anomalies.find(a => a.id === anomalyId);

  if (!anomaly) return null;

  return (
    <div className="card-base p-4 border-l-4 border-alert-orange/50 animate-slide-in-right">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-ocean-700">证据链详情</h3>
        <StatusBadge status={anomaly.status} />
      </div>

      <div className="mb-4">
        <p className="text-sm text-ocean-700 font-medium mb-2">结论变化说明</p>
        <p className="text-sm text-ocean-600 leading-relaxed bg-ocean-50/50 p-3 rounded-md">
          {anomaly.conclusionChange}
        </p>
      </div>

      <div className="mb-4">
        <p className="text-sm font-medium text-ocean-700 mb-3">证据时间线</p>
        <div className="space-y-3 max-h-64 overflow-y-auto scrollbar-thin">
          {anomaly.evidenceChain.map((item: EvidenceItem, i: number) => (
            <div key={item.id} className="flex items-start gap-3">
              <div className="relative flex-shrink-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  item.isVerbal ? 'bg-purple-100 text-purple-600' : 'bg-ocean-100 text-ocean-600'
                }`}>
                  {item.isVerbal ? (
                    <MessageSquare className="w-4 h-4" />
                  ) : (
                    <FileText className="w-4 h-4" />
                  )}
                </div>
                {i < anomaly.evidenceChain.length - 1 && (
                  <div className="absolute top-8 left-1/2 -translate-x-1/2 w-px h-4 bg-ocean-200" />
                )}
              </div>
              <div className="flex-1 min-w-0 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-ocean-800 truncate">
                    {item.materialName}
                  </span>
                  {item.changeType && (
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      item.changeType === 'modify' ? 'bg-amber-100 text-amber-700' :
                      item.changeType === 'add' ? 'bg-green-100 text-green-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {item.changeType === 'modify' ? '修改' : item.changeType === 'add' ? '新增' : '删除'}
                    </span>
                  )}
                </div>
                <p className="text-sm text-ocean-600 mt-1">{item.content}</p>
                {item.previousValue && item.currentValue && (
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <span className="text-red-500 line-through">{item.previousValue}</span>
                    <ArrowRight className="w-3 h-3 text-ocean-400" />
                    <span className="text-alert-green font-medium">{item.currentValue}</span>
                  </div>
                )}
                <p className="text-xs text-ocean-400 mt-1">{item.timestamp}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="pt-4 border-t border-ocean-100">
        {anomaly.status === 'pending' ? (
          <button
            onClick={() => setAnomalyStatus(anomaly.id, 'confirmed')}
            className="w-full btn-primary text-sm flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            标记为已确认
          </button>
        ) : (
          <button
            onClick={() => setAnomalyStatus(anomaly.id, 'pending')}
            className="w-full btn-secondary text-sm flex items-center justify-center gap-2"
          >
            <Clock className="w-4 h-4" />
            改为待补证据
          </button>
        )}
      </div>
    </div>
  );
}
