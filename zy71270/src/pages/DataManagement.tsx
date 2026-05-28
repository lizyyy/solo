import { useEffect, useState } from 'react';
import {
  Database,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Clock,
  FileWarning,
  History,
  ArrowLeftRight,
} from 'lucide-react';
import GlassPanel from '../components/common/GlassPanel';
import Badge from '../components/common/Badge';
import { useDataStore } from '../store/dataStore';
import { useModificationStore } from '../store/modificationStore';
import { formatTimestamp } from '../utils/format';
import type { DataSourceStatus, DataQualityIssue } from '../types';

type TabKey = 'sources' | 'missing' | 'history';

interface DataManagementProps {
  noHeader?: boolean;
}

export default function DataManagement({ }: DataManagementProps) {
  const warehouse = useDataStore((s) => s.warehouse);
  const reloadData = useDataStore((s) => s.reloadData);
  const getDataSourceStatus = useDataStore((s) => s.getDataSourceStatus);
  const getDataQualityIssues = useDataStore((s) => s.getDataQualityIssues);
  const isLoading = useDataStore((s) => s.isLoading);
  const lastSyncTime = useDataStore((s) => s.lastSyncTime);

  const modifications = useModificationStore((s) => s.modifications);
  const getModifications = useModificationStore((s) => s.getModifications);

  const [activeTab, setActiveTab] = useState<TabKey>('sources');
  const [sourceStatuses, setSourceStatuses] = useState<DataSourceStatus[]>([]);
  const [qualityIssues, setQualityIssues] = useState<DataQualityIssue[]>([]);

  useEffect(() => {
    setSourceStatuses(getDataSourceStatus());
    setQualityIssues(getDataQualityIssues());
  }, [getDataSourceStatus, getDataQualityIssues, warehouse]);

  const handleRefresh = async () => {
    await reloadData();
    setSourceStatuses(getDataSourceStatus());
    setQualityIssues(getDataQualityIssues());
  };

  const severityIcon = (severity: DataQualityIssue['severity']) => {
    switch (severity) {
      case 'error': return <XCircle className="w-4 h-4 text-status-red" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-status-amber" />;
      case 'info': return <FileWarning className="w-4 h-4 text-accent-blue" />;
    }
  };

  const tabs: { key: TabKey; label: string; icon: React.ElementType; count?: number }[] = [
    { key: 'sources', label: '输入源', icon: Database },
    { key: 'missing', label: '缺失清单', icon: FileWarning, count: qualityIssues.length },
    { key: 'history', label: '修改历史', icon: History, count: modifications.length },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-warehouse-bg">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold gradient-text mb-1">数据管理</h2>
            <p className="text-sm text-slate-500">数据源状态、缺失清单、修改历史回溯</p>
          </div>
          <div className="flex items-center gap-3">
            {lastSyncTime && (
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <Clock className="w-3 h-3" />
                <span className="font-mono">上次同步: {formatTimestamp(lastSyncTime)}</span>
              </div>
            )}
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="btn btn-secondary flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              刷新数据
            </button>
          </div>
        </div>

        <div className="flex gap-1 border-b border-warehouse-border/50">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`tab-btn flex items-center gap-2 ${activeTab === tab.key ? 'active' : ''}`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <Badge variant={tab.count > 5 ? 'warning' : 'info'}>{tab.count}</Badge>
              )}
            </button>
          ))}
        </div>

        {activeTab === 'sources' && (
          <div className="grid grid-cols-2 gap-4">
            {sourceStatuses.map((source) => (
              <div key={source.type} className="card">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`status-dot ${source.isConnected ? 'green' : 'red'}`} />
                    <span className="text-sm font-semibold text-slate-200">{source.name}</span>
                  </div>
                  <Badge variant={source.isConnected ? 'success' : 'error'}>
                    {source.isConnected ? '已连接' : '未连接'}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <div className="text-slate-500 mb-1">记录数</div>
                    <div className="font-mono text-slate-300">{source.recordCount}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 mb-1">质量评分</div>
                    <div className="flex items-center gap-1">
                      <div className="progress-bar flex-1">
                        <div
                          className="progress-fill"
                          style={{
                            width: `${source.qualityScore}%`,
                            background: source.qualityScore >= 90 ? '#10B981' : source.qualityScore >= 70 ? '#F59E0B' : '#EF4444',
                          }}
                        />
                      </div>
                      <span className="font-mono text-slate-300">{source.qualityScore}</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 mb-1">问题</div>
                    <div className="font-mono text-slate-300">{source.issues.length}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'missing' && (
          <GlassPanel title="数据质量问题清单" icon={<FileWarning className="w-4 h-4 text-status-amber" />}>
            {qualityIssues.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-slate-500">
                <CheckCircle2 className="w-8 h-8 mb-2 text-status-green" />
                <span className="text-sm">暂无数据质量问题</span>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>级别</th>
                    <th>类型</th>
                    <th>实体ID</th>
                    <th>描述</th>
                    <th>可修复</th>
                  </tr>
                </thead>
                <tbody>
                  {qualityIssues.map((issue) => (
                    <tr key={issue.id}>
                      <td>{severityIcon(issue.severity)}</td>
                      <td>
                        <Badge variant={issue.severity === 'error' ? 'error' : issue.severity === 'warning' ? 'warning' : 'info'}>
                          {issue.type === 'trajectory_break' ? '轨迹断点' :
                           issue.type === 'floor_confusion' ? '楼层混淆' :
                           issue.type === 'duplicate_queue' ? '重复排队' : '字段缺失'}
                        </Badge>
                      </td>
                      <td className="font-mono text-xs text-slate-400">{issue.entityId}</td>
                      <td className="text-xs text-slate-300">{issue.description}</td>
                      <td>
                        {issue.canFix ? (
                          <Badge variant="success">可修复</Badge>
                        ) : (
                          <Badge variant="error">需补录</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </GlassPanel>
        )}

        {activeTab === 'history' && (
          <GlassPanel title="修改历史记录" icon={<History className="w-4 h-4" />}>
            {modifications.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-slate-500">
                <History className="w-8 h-8 mb-2" />
                <span className="text-sm">暂无修改记录</span>
              </div>
            ) : (
              <div className="space-y-3">
                {getModifications().slice(0, 50).map((mod) => (
                  <div key={mod.id} className="card">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <ArrowLeftRight className="w-4 h-4 text-accent-blue" />
                        <span className="text-sm font-semibold text-slate-200">
                          {mod.entityType} / {mod.fieldName}
                        </span>
                        {mod.isRollback && <Badge variant="warning">回滚</Badge>}
                      </div>
                      <span className="text-xs font-mono text-slate-500">
                        {formatTimestamp(mod.modifiedAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs mb-1">
                      <div className="flex items-center gap-1">
                        <span className="text-slate-500">旧值:</span>
                        <span className="font-mono text-status-red line-through">{mod.oldValue}</span>
                      </div>
                      <span className="text-slate-600">→</span>
                      <div className="flex items-center gap-1">
                        <span className="text-slate-500">新值:</span>
                        <span className="font-mono text-status-green">{mod.newValue}</span>
                      </div>
                    </div>
                    <div className="text-xs text-slate-500">
                      修改人: <span className="text-slate-400">{mod.modifiedBy}</span>
                      {' | '}
                      理由: <span className="text-slate-400">{mod.reason}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassPanel>
        )}
      </div>
    </div>
  );
}
