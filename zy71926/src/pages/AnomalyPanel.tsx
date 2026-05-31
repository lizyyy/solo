import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store';
import { useState, useMemo } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { ANOMALY_META, ANOMALY_SEVERITY_META } from '@/types';
import type { AnomalyType } from '@/types';
import { exportAnomalyReport, downloadCSV } from '@/utils/exportService';

type TabType = 'all' | AnomalyType;

export default function AnomalyPanel() {
  const navigate = useNavigate();
  const { anomalies, registrations, currentOperator, batchResolveAnomalies } = useStore();
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showOnlyUnresolved, setShowOnlyUnresolved] = useState(true);

  const filteredAnomalies = useMemo(() => {
    let result = anomalies;
    if (showOnlyUnresolved) {
      result = result.filter((a) => !a.resolvedAt);
    }
    if (activeTab !== 'all') {
      result = result.filter((a) => a.type === activeTab);
    }
    return result.sort(
      (a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime()
    );
  }, [anomalies, activeTab, showOnlyUnresolved]);

  const counts = useMemo(() => {
    const unresolved = anomalies.filter((a) => !a.resolvedAt);
    return {
      all: unresolved.length,
      duplicate: unresolved.filter((a) => a.type === 'duplicate').length,
      late_attachment: unresolved.filter((a) => a.type === 'late_attachment').length,
      missing_info: unresolved.filter((a) => a.type === 'missing_info').length,
      conflict: unresolved.filter((a) => a.type === 'conflict').length,
      swap_record: unresolved.filter((a) => a.type === 'swap_record').length,
    };
  }, [anomalies]);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const selectAll = () => {
    if (selectedIds.size === filteredAnomalies.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAnomalies.map((a) => a.id)));
    }
  };

  const handleBatchResolve = () => {
    if (selectedIds.size === 0) return;
    batchResolveAnomalies(Array.from(selectedIds), currentOperator);
    setSelectedIds(new Set());
  };

  const handleExportReport = () => {
    const targetAnomalies = showOnlyUnresolved
      ? anomalies.filter((a) => !a.resolvedAt)
      : anomalies;
    const result = exportAnomalyReport(targetAnomalies, registrations, currentOperator);
    downloadCSV(result.csv, result.exportId);
  };

  const formatTime = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: zhCN });
    } catch {
      return dateStr;
    }
  };

  const formatTimeFull = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN });
    } catch {
      return dateStr;
    }
  };

  const tabs: { key: TabType; label: string; shortLabel: string }[] = [
    { key: 'all', label: '全部', shortLabel: '全' },
    { key: 'duplicate', label: '重复项', shortLabel: '重' },
    { key: 'late_attachment', label: '晚到附件', shortLabel: '晚' },
    { key: 'missing_info', label: '信息缺失', shortLabel: '缺' },
    { key: 'conflict', label: '展位冲突', shortLabel: '冲' },
    { key: 'swap_record', label: '调换记录', shortLabel: '调' },
  ];

  const getTagClass = (type: AnomalyType) => {
    const map: Record<AnomalyType, string> = {
      duplicate: 'tag-danger',
      late_attachment: 'tag-warning',
      missing_info: 'tag-danger',
      conflict: 'tag-danger',
      swap_record: 'tag-info',
    };
    return map[type];
  };

  return (
    <div className="h-full flex flex-col">
      <div className="panel border-t-0 border-x-0 px-4 py-2 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="btn btn-secondary text-[10px]">
            ← 返回列表
          </button>
          <h1 className="text-base font-bold">异常面板</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportReport} className="btn btn-warning text-xs">
            导出异常报告
          </button>
          {selectedIds.size > 0 && (
            <button onClick={handleBatchResolve} className="btn btn-success text-xs">
              批量处理（{selectedIds.size}）
            </button>
          )}
        </div>
      </div>

      <div className="panel border-t-0 border-x-0 px-4 py-1 flex items-center gap-1 flex-shrink-0 overflow-x-auto scrollbar-thin">
        {tabs.map((tab) => {
          const count = tab.key === 'all' ? counts.all : counts[tab.key as AnomalyType] || 0;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'bg-console-info/20 text-console-info border-b-2 border-console-info'
                  : 'text-console-muted hover:text-console-text'
              }`}
            >
              [{tab.shortLabel}] {tab.label}
              {count > 0 && (
                <span className="ml-1 text-[10px] text-console-danger">({count})</span>
              )}
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-console-muted cursor-pointer">
            <input
              type="checkbox"
              checked={showOnlyUnresolved}
              onChange={(e) => setShowOnlyUnresolved(e.target.checked)}
              className="accent-console-warning"
            />
            仅显示未处理
          </label>
        </div>
      </div>

      <div className="panel border-t-0 border-x-0 px-4 py-1 flex items-center gap-2 flex-shrink-0">
        <label className="flex items-center gap-1 text-xs text-console-muted cursor-pointer">
          <input
            type="checkbox"
            checked={selectedIds.size === filteredAnomalies.length && filteredAnomalies.length > 0}
            onChange={selectAll}
            className="accent-console-info"
          />
          全选
        </label>
        <span className="text-console-muted text-[10px]">
          已选 {selectedIds.size}/{filteredAnomalies.length}
        </span>
      </div>

      <div className="flex-1 overflow-auto scrollbar-thin p-4 space-y-2">
        {filteredAnomalies.length === 0 && (
          <div className="text-center text-console-muted py-12">
            无匹配异常记录
          </div>
        )}
        {filteredAnomalies.map((anomaly) => {
          const reg = registrations.find((r) => r.id === anomaly.registrationId);
          const meta = ANOMALY_META[anomaly.type as AnomalyType];
          const sevMeta = ANOMALY_SEVERITY_META[anomaly.severity];
          const isExpanded = expandedId === anomaly.id;

          return (
            <div
              key={anomaly.id}
              className={`panel p-3 cursor-pointer transition-colors ${
                anomaly.resolvedAt ? 'opacity-50' : ''
              }`}
              onClick={() => setExpandedId(isExpanded ? null : anomaly.id)}
            >
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={selectedIds.has(anomaly.id)}
                  onChange={(e) => {
                    e.stopPropagation();
                    toggleSelect(anomaly.id);
                  }}
                  className="accent-console-info mt-0.5"
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`tag ${getTagClass(anomaly.type as AnomalyType)}`}>
                      [{meta?.shortLabel}] {meta?.label}
                    </span>
                    <span
                      className="tag tag-muted"
                      style={{ color: sevMeta.color, borderColor: sevMeta.color }}
                    >
                      {sevMeta.label}
                    </span>
                    {anomaly.resolvedAt ? (
                      <span className="tag tag-success">已处理</span>
                    ) : (
                      <span className="tag tag-warning">待处理</span>
                    )}
                    <span className="text-console-muted text-[10px] ml-auto">
                      {formatTime(anomaly.detectedAt)}
                    </span>
                  </div>
                  <div className="text-xs mb-1">
                    <span className="text-console-muted">涉及作品：</span>
                    <span className="font-medium">{reg?.artworkName || '-'}</span>
                    <span className="text-console-muted ml-2">艺术家：</span>
                    <span>{reg?.artist || '-'}</span>
                    {reg?.location && (
                      <>
                        <span className="text-console-muted ml-2">展位：</span>
                        <span className="text-console-info">{reg.location}</span>
                      </>
                    )}
                  </div>
                  <div className="text-xs text-console-muted">{anomaly.description}</div>

                  {isExpanded && (
                    <div className="mt-2 pt-2 border-t border-console-border/50 space-y-1.5 text-xs">
                      <div>
                        <span className="text-console-muted">检测规则：</span>
                        <span className="text-console-info">{anomaly.rule}</span>
                      </div>
                      <div>
                        <span className="text-console-muted">处理建议：</span>
                        <span className="text-console-success">{anomaly.suggestion}</span>
                      </div>
                      <div>
                        <span className="text-console-muted">检测时间：</span>
                        {formatTimeFull(anomaly.detectedAt)}
                      </div>
                      {anomaly.resolvedAt && (
                        <div>
                          <span className="text-console-muted">处理时间：</span>
                          {formatTimeFull(anomaly.resolvedAt)}
                          <span className="text-console-muted ml-2">处理人：</span>
                          {anomaly.resolver}
                        </div>
                      )}
                      <div className="flex gap-2 mt-2">
                        {!anomaly.resolvedAt && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              useStore.getState().resolveAnomaly(anomaly.id, currentOperator);
                            }}
                            className="btn btn-success text-[10px]"
                          >
                            标记已处理
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/registration/${anomaly.registrationId}`);
                          }}
                          className="btn btn-secondary text-[10px]"
                        >
                          查看记录
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
