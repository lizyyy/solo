import { useState } from 'react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  X,
  Check,
  Clock,
  AlertTriangle,
  User,
  Battery,
  FileText,
  Download,
  Edit3,
  GitCompare,
  Eye,
  UserPlus,
} from 'lucide-react';
import { useRecordsStore } from '../../store/useRecordsStore';
import { useUiStore } from '../../store/useUiStore';
import { StatusBadge } from '../ui/StatusBadge';
import { HistoryTimeline } from './HistoryTimeline';
import { getSourceTypeLabel, getIssueStatusLabel, exportRecordWithHistory, exportRouteToKML } from '../../utils/export';
import { calculateRouteLength, formatDistance } from '../../utils/geo';
import { NoFlyZoneSourceType } from '../../types';
import { cn } from '../../lib/utils';

export function RecordDetail() {
  const {
    selectedRecordId,
    getSelectedRecord,
    getSelectedRecordHistory,
    getSelectedRecordIssues,
    getSelectedRecordRouteVersions,
    getCurrentRouteVersion,
    updateRecordStatus,
    toggleCompareVersion,
    compareRouteVersionIds,
    clearCompareVersions,
    resolveIssue,
  } = useRecordsStore();
  const { currentUser, setDetailPanelOpen, openModal } = useUiStore();

  const [activeTab, setActiveTab] = useState<'info' | 'history' | 'issues' | 'versions'>('info');

  const record = getSelectedRecord();
  const history = getSelectedRecordHistory();
  const issues = getSelectedRecordIssues();
  const routeVersions = getSelectedRecordRouteVersions();
  const currentRoute = selectedRecordId ? getCurrentRouteVersion(selectedRecordId) : undefined;

  if (!record) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500">
        <div className="text-center">
          <Eye className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>选择一条记录查看详情</p>
        </div>
      </div>
    );
  }

  const routeLength = currentRoute ? calculateRouteLength(currentRoute.routeData.coordinates) : 0;

  const handleMarkReviewed = async () => {
    await updateRecordStatus(record.id, 'reviewed', currentUser, '复核通过');
  };

  const handleMarkPending = async () => {
    const reason = prompt('请输入待处理原因：');
    if (reason !== null) {
      await updateRecordStatus(
        record.id,
        'pending_processing',
        currentUser,
        reason || '需要进一步处理',
        reason || '需要进一步处理'
      );
    }
  };

  const handleAddIssue = () => {
    openModal('issue', { recordId: record.id });
  };

  const handleModifyRoute = () => {
    openModal('routeModify', { recordId: record.id });
  };

  const handleExportRecord = () => {
    exportRecordWithHistory(record, history, routeVersions, issues);
  };

  const handleExportKML = () => {
    if (currentRoute) {
      exportRouteToKML(currentRoute.routeData, currentRoute.version);
    }
  };

  const handleResolveIssue = async (issueId: string) => {
    await resolveIssue(issueId, currentUser);
  };

  const tabs = [
    { id: 'info' as const, label: '基本信息', icon: FileText },
    { id: 'history' as const, label: '操作历史', icon: Clock },
    { id: 'issues' as const, label: '禁飞区问题', icon: AlertTriangle, badge: issues.filter((i) => i.status === 'open').length },
    { id: 'versions' as const, label: '航线版本', icon: GitCompare, badge: routeVersions.length },
  ];

  return (
    <div className="h-full flex flex-col bg-slate-900/80 backdrop-blur-sm border-l border-slate-700/50">
      <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-lg font-bold text-slate-200">{record.id}</span>
            <StatusBadge status={record.status} />
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {format(new Date(record.createdAt), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN })}
          </p>
        </div>
        <button
          onClick={() => setDetailPanelOpen(false)}
          className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex gap-1 p-2 border-b border-slate-700/50 bg-slate-900/50">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded transition-colors',
              activeTab === tab.id
                ? 'bg-orange-500/20 text-orange-400'
                : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50'
            )}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-red-500/30 text-red-400">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'info' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/50">
                <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
                  <User className="w-3.5 h-3.5" />
                  飞手
                </div>
                <p className="text-slate-200 font-medium">{record.pilot}</p>
              </div>
              <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/50">
                <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
                  <Battery className="w-3.5 h-3.5" />
                  电池循环
                </div>
                <p className="text-slate-200 font-mono font-medium text-xl">{record.batteryCycle}</p>
              </div>
            </div>

            <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/50">
              <div className="text-slate-500 text-xs mb-1">来源</div>
              <p className="text-slate-200 text-sm">{record.source}</p>
            </div>

            {currentRoute && (
              <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/50">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-slate-500 text-xs">当前航线</div>
                  <span className="text-xs text-orange-400">版本 {currentRoute.version}</span>
                </div>
                <p className="text-slate-200 font-medium">{currentRoute.routeData.name}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                  <span>航点数: {currentRoute.routeData.coordinates.length}</span>
                  <span>航程: {formatDistance(routeLength)}</span>
                </div>
                {currentRoute.changeDescription && (
                  <p className="mt-2 text-xs text-slate-500 bg-slate-900/50 rounded p-2">
                    {currentRoute.changeDescription}
                  </p>
                )}
              </div>
            )}

            {record.pendingReason && (
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
                <div className="flex items-center gap-2 text-orange-400 text-xs mb-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  待处理原因
                </div>
                <p className="text-orange-300 text-sm">{record.pendingReason}</p>
              </div>
            )}

            {compareRouteVersionIds.length === 2 && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-blue-400 text-xs">
                    <GitCompare className="w-3.5 h-3.5" />
                    正在对比 2 个航线版本
                  </div>
                  <button
                    onClick={clearCompareVersions}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    清除
                  </button>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 text-center py-2 bg-blue-500/20 rounded text-xs text-blue-300">
                    旧版本 (蓝色)
                  </div>
                  <div className="flex-1 text-center py-2 bg-green-500/20 rounded text-xs text-green-300">
                    新版本 (绿色)
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && <HistoryTimeline history={history} />}

        {activeTab === 'issues' && (
          <div className="space-y-3">
            {issues.map((issue) => (
              <div
                key={issue.id}
                className={cn(
                  'rounded-lg p-3 border',
                  issue.status === 'open'
                    ? 'bg-red-500/10 border-red-500/30'
                    : 'bg-green-500/10 border-green-500/30'
                )}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'px-2 py-0.5 text-xs rounded',
                        issue.sourceType === 'inspection_photo'
                          ? 'bg-purple-500/30 text-purple-300'
                          : 'bg-blue-500/30 text-blue-300'
                      )}
                    >
                      {getSourceTypeLabel(issue.sourceType)}
                    </span>
                    <StatusBadge status={issue.status} />
                  </div>
                  <span className="text-xs text-slate-500">
                    {format(new Date(issue.createdAt), 'MM-dd HH:mm', { locale: zhCN })}
                  </span>
                </div>
                <p className="text-sm text-slate-300 mb-2">{issue.description}</p>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1 text-slate-400">
                    <UserPlus className="w-3.5 h-3.5" />
                    责任人: <span className="text-slate-300">{issue.assignee}</span>
                  </div>
                  {issue.status === 'open' && (
                    <button
                      onClick={() => handleResolveIssue(issue.id)}
                      className="flex items-center gap-1 px-2 py-1 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
                    >
                      <Check className="w-3 h-3" />
                      标记解决
                    </button>
                  )}
                </div>
              </div>
            ))}
            {issues.length === 0 && (
              <div className="text-center py-8 text-slate-500 text-sm">暂无禁飞区问题</div>
            )}
          </div>
        )}

        {activeTab === 'versions' && (
          <div className="space-y-2">
            {routeVersions.map((version) => {
              const isSelected = compareRouteVersionIds.includes(version.id);
              return (
                <div
                  key={version.id}
                  className={cn(
                    'rounded-lg p-3 border transition-colors cursor-pointer',
                    isSelected
                      ? 'bg-orange-500/10 border-orange-500/50'
                      : 'bg-slate-800/30 border-slate-700/50 hover:border-slate-600'
                  )}
                  onClick={() => toggleCompareVersion(version.id)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-orange-400">v{version.version}</span>
                      {version.id === record.currentRouteVersionId && (
                        <span className="px-1.5 py-0.5 text-[10px] rounded bg-green-500/30 text-green-400">
                          当前
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-500">
                      {format(new Date(version.createdAt), 'MM-dd HH:mm', { locale: zhCN })}
                    </span>
                  </div>
                  <p className="text-sm text-slate-300">{version.routeData.name}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {version.createdBy} · {version.routeData.coordinates.length} 个航点
                  </p>
                  {version.changeDescription && (
                    <p className="text-xs text-slate-400 mt-2 bg-slate-900/50 rounded p-2">
                      {version.changeDescription}
                    </p>
                  )}
                </div>
              );
            })}
            {compareRouteVersionIds.length > 0 && (
              <p className="text-xs text-center text-slate-500 py-2">
                已选择 {compareRouteVersionIds.length}/2 个版本进行对比
              </p>
            )}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-700/50 bg-slate-900/50 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          {record.status === 'pending_review' && (
            <>
              <button
                onClick={handleMarkReviewed}
                className="flex items-center justify-center gap-2 px-3 py-2 bg-green-500/20 text-green-400 rounded border border-green-500/50 hover:bg-green-500/30 transition-colors text-sm"
              >
                <Check className="w-4 h-4" />
                复核通过
              </button>
              <button
                onClick={handleMarkPending}
                className="flex items-center justify-center gap-2 px-3 py-2 bg-orange-500/20 text-orange-400 rounded border border-orange-500/50 hover:bg-orange-500/30 transition-colors text-sm"
              >
                <Clock className="w-4 h-4" />
                标记待处理
              </button>
            </>
          )}
          {record.status === 'pending_processing' && (
            <button
              onClick={handleMarkReviewed}
              className="col-span-2 flex items-center justify-center gap-2 px-3 py-2 bg-green-500/20 text-green-400 rounded border border-green-500/50 hover:bg-green-500/30 transition-colors text-sm"
            >
              <Check className="w-4 h-4" />
              处理完成，标记复核通过
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleModifyRoute}
            className="flex items-center justify-center gap-2 px-3 py-2 bg-slate-800 text-slate-300 rounded border border-slate-700 hover:bg-slate-700 transition-colors text-sm"
          >
            <Edit3 className="w-4 h-4" />
            修正航线
          </button>
          <button
            onClick={handleAddIssue}
            className="flex items-center justify-center gap-2 px-3 py-2 bg-slate-800 text-slate-300 rounded border border-slate-700 hover:bg-slate-700 transition-colors text-sm"
          >
            <AlertTriangle className="w-4 h-4" />
            添加问题
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleExportKML}
            className="flex items-center justify-center gap-2 px-3 py-2 bg-slate-800/50 text-slate-400 rounded border border-slate-700/50 hover:bg-slate-800 hover:text-slate-300 transition-colors text-sm"
          >
            <Download className="w-4 h-4" />
            导出KML
          </button>
          <button
            onClick={handleExportRecord}
            className="flex items-center justify-center gap-2 px-3 py-2 bg-slate-800/50 text-slate-400 rounded border border-slate-700/50 hover:bg-slate-800 hover:text-slate-300 transition-colors text-sm"
          >
            <Download className="w-4 h-4" />
            导出详情
          </button>
        </div>
      </div>
    </div>
  );
}
