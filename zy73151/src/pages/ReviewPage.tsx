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
  Download,
  FileSpreadsheet,
  File,
  AlertCircle,
  Zap,
  ListChecks,
  ShieldAlert,
} from 'lucide-react';
import { anomalyTypeLabels, severityLabels, sourceTypeLabels } from '@/utils/anomalyDetector';
import type { AnomalyType, Severity, EvidenceStatus, EvidenceItem } from '@/types';
import { exportReviewReport } from '@/utils/exporters';

export default function ReviewPage() {
  const { anomalies, materials, stations, filter, setFilter, setAnomalyStatus, selectedAnomalyId, selectAnomaly } = useAppStore();
  const [activeTab, setActiveTab] = useState<'all' | 'confirmed' | 'pending'>('all');
  const [showExportMenu, setShowExportMenu] = useState(false);

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

  const handleExport = (format: 'markdown' | 'html' | 'all') => {
    exportReviewReport(anomalies, materials, stations, format);
    setShowExportMenu(false);
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-ocean-800">复核汇总</h2>
          <p className="text-sm text-ocean-500 mt-1">
            分类管理异常记录，区分已确认与待补证据，追溯结论变化
          </p>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="btn-primary text-sm flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" />
            导出复核报告
          </button>
          {showExportMenu && (
            <div className="absolute right-0 top-full mt-2 bg-white rounded-lg shadow-glow-orange border border-ocean-100 py-1 min-w-[200px] z-10 animate-slide-in-right">
              <button
                onClick={() => handleExport('markdown')}
                className="w-full px-4 py-2 text-left text-sm text-ocean-700 hover:bg-ocean-50 flex items-center gap-2"
              >
                <File className="w-4 h-4 text-ocean-500" />
                导出 Markdown（适合文档存档）
              </button>
              <button
                onClick={() => handleExport('html')}
                className="w-full px-4 py-2 text-left text-sm text-ocean-700 hover:bg-ocean-50 flex items-center gap-2"
              >
                <FileSpreadsheet className="w-4 h-4 text-purple-500" />
                导出 HTML（可直接浏览器打开）
              </button>
              <div className="border-t border-ocean-100 my-1" />
              <button
                onClick={() => handleExport('all')}
                className="w-full px-4 py-2 text-left text-sm font-medium text-ocean-800 hover:bg-ocean-50 flex items-center gap-2"
              >
                <Download className="w-4 h-4 text-ocean-600" />
                全部导出
              </button>
            </div>
          )}
        </div>
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
  const { anomalies, setAnomalyStatus, materials } = useAppStore();
  const anomaly = anomalies.find(a => a.id === anomalyId);

  if (!anomaly) return null;

  const verbalEvidence = anomaly.evidenceChain.filter(e => e.isVerbal);
  const caliberEvidence = anomaly.evidenceChain.filter(e => e.changeType === 'modify' && e.previousValue && e.currentValue);
  const confirmedEvidence = anomaly.status === 'confirmed' ? anomaly.evidenceChain : [];
  const pendingEvidence = anomaly.status === 'pending'
    ? anomaly.evidenceChain
    : anomaly.evidenceChain.filter(e => {
      const mat = materials.find(m => m.id === e.materialId);
      return mat?.source === 'verbal_note' || false;
    });

  const hasCaliberChanges = verbalEvidence.length > 0 || caliberEvidence.length > 0;

  return (
    <div className="card-base p-4 border-l-4 border-alert-orange/50 animate-slide-in-right space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ocean-700">证据链详情</h3>
        <StatusBadge status={anomaly.status} />
      </div>

      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <AlertCircle className="w-4 h-4 text-alert-orange" />
          <p className="text-sm font-medium text-ocean-700">异常原因</p>
        </div>
        <div className="p-3 bg-red-50/60 border border-red-100 rounded-md space-y-1.5">
          <p className="text-sm text-red-700 font-medium">{anomaly.description}</p>
          <div className="flex flex-wrap gap-1.5 text-xs pt-1">
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-white/80 rounded border border-red-200 text-red-600">
              <MapPin className="w-3 h-3" />
              {anomaly.stationName}
            </span>
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-white/80 rounded border border-red-200 text-red-600">
              <FileText className="w-3 h-3" />
              第 {anomaly.sourceRows.join(', ')} 行
            </span>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Zap className="w-4 h-4 text-alert-orange" />
          <p className="text-sm font-medium text-ocean-700">影响范围 & 结论说明</p>
        </div>
        <div className="p-3 bg-ocean-50/60 border border-ocean-100 rounded-md space-y-2">
          <div>
            <span className="text-xs font-medium text-ocean-600">影响范围：</span>
            <span className="text-xs text-ocean-700">{anomaly.impactRange}</span>
          </div>
          <div>
            <span className="text-xs font-medium text-ocean-600">结论说明：</span>
            <span className="text-xs text-ocean-700 leading-relaxed">{anomaly.conclusionChange}</span>
          </div>
        </div>
      </div>

      {hasCaliberChanges && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <ShieldAlert className="w-4 h-4 text-purple-500" />
            <p className="text-sm font-medium text-ocean-700">口径变更记录</p>
          </div>
          <div className="p-3 bg-purple-50/60 border border-purple-100 rounded-md space-y-2">
            {verbalEvidence.length > 0 && (
              <div>
                <p className="text-xs font-medium text-purple-700 mb-1">📣 口头说明改变判断（{verbalEvidence.length}条）</p>
                {verbalEvidence.map(item => (
                  <div key={item.id} className="ml-2 p-2 bg-white/70 rounded text-xs space-y-1">
                    <div className="font-medium text-purple-600 flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      {item.materialName}
                    </div>
                    <p className="text-ocean-600 leading-relaxed">{item.content}</p>
                    <p className="text-ocean-400 text-[10px]">{item.timestamp}</p>
                  </div>
                ))}
              </div>
            )}
            {caliberEvidence.length > 0 && (
              <div>
                <p className="text-xs font-medium text-amber-700 mb-1">✏️ 数值变更记录（{caliberEvidence.length}条）</p>
                {caliberEvidence.map(item => (
                  <div key={item.id} className="ml-2 p-2 bg-white/70 rounded text-xs">
                    <div className="flex items-center gap-2 text-[11px] font-medium text-ocean-700">
                      <FileText className="w-3 h-3" />
                      {item.fieldName}：{item.materialName}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-red-500 line-through">{item.previousValue}</span>
                      <ArrowRight className="w-3 h-3 text-ocean-400" />
                      <span className="text-alert-green font-medium">{item.currentValue}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div>
        <p className="text-sm font-medium text-ocean-700 mb-3 flex items-center gap-1.5">
          <History className="w-4 h-4" />
          证据时间线（共 {anomaly.evidenceChain.length} 条）
        </p>
        <div className="space-y-3 max-h-64 overflow-y-auto scrollbar-thin pr-1">
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
                  <div className="absolute top-8 left-1/2 -translate-x-1/2 w-px h-5 bg-ocean-200" />
                )}
              </div>
              <div className="flex-1 min-w-0 pb-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-ocean-800 truncate">
                    {item.materialName}
                  </span>
                  {item.changeType && (
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                      item.changeType === 'modify' ? 'bg-amber-100 text-amber-700' :
                      item.changeType === 'add' ? 'bg-green-100 text-green-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {item.changeType === 'modify' ? '修改口径' : item.changeType === 'add' ? '新增' : '删除'}
                    </span>
                  )}
                </div>
                <p className="text-sm text-ocean-600 mt-1 leading-relaxed">{item.content}</p>
                {item.previousValue && item.currentValue && (
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <span className="px-2 py-0.5 bg-red-100 text-red-600 rounded line-through">{item.previousValue}</span>
                    <ArrowRight className="w-3 h-3 text-ocean-400" />
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded font-medium">{item.currentValue}</span>
                  </div>
                )}
                <p className="text-[11px] text-ocean-400 mt-1">{item.timestamp}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-ocean-700 flex items-center gap-1.5">
            <ListChecks className="w-4 h-4" />
            当前证据状态
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className={`p-3 rounded-md border ${
            anomaly.status === 'confirmed'
              ? 'bg-alert-green/5 border-alert-green/30'
              : 'bg-ocean-50 border-ocean-100'
          }`}>
            <div className="flex items-center gap-1 mb-1">
              <CheckCircle className={`w-4 h-4 ${anomaly.status === 'confirmed' ? 'text-alert-green' : 'text-ocean-300'}`} />
              <span className={`text-xs font-medium ${anomaly.status === 'confirmed' ? 'text-alert-green' : 'text-ocean-500'}`}>
                已确认证据
              </span>
            </div>
            <p className="text-lg font-bold text-ocean-800">
              {anomaly.status === 'confirmed' ? anomaly.evidenceChain.length : 0}
            </p>
          </div>
          <div className={`p-3 rounded-md border ${
            anomaly.status === 'pending'
              ? 'bg-amber-50 border-amber-200'
              : 'bg-ocean-50 border-ocean-100'
          }`}>
            <div className="flex items-center gap-1 mb-1">
              <Clock className={`w-4 h-4 ${anomaly.status === 'pending' ? 'text-amber-500' : 'text-ocean-300'}`} />
              <span className={`text-xs font-medium ${anomaly.status === 'pending' ? 'text-amber-700' : 'text-ocean-500'}`}>
                待补证据
              </span>
            </div>
            <p className="text-lg font-bold text-ocean-800">
              {anomaly.status === 'pending' ? '需补充' : 0}
            </p>
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-ocean-100 space-y-2">
        <div className="p-2 bg-ocean-50/50 rounded-md text-xs text-ocean-600">
          <span className="font-medium">关联材料：</span>{anomaly.materialNames.join('、')}
        </div>
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
