import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  AlertTriangle,
  Eye,
  CheckCircle,
  User,
  FileText,
  Image,
  History,
  Download,
  RefreshCw,
} from 'lucide-react';
import { useAppStore } from '@/store';
import { getStatusLabel, getStatusColor, formatDate } from '@/utils';
import type { TaskStatus } from '@/types';

const getStatusIcon = (status: TaskStatus) => {
  switch (status) {
    case 'waiting_artworks':
      return Clock;
    case 'pending':
      return AlertTriangle;
    case 'reviewing':
      return Eye;
    case 'completed':
      return CheckCircle;
  }
};

const tabs = [
  { id: 'note', label: '策展备注', icon: FileText },
  { id: 'artworks', label: '作品清单', icon: Image },
  { id: 'layout', label: '展墙图历史', icon: History },
  { id: 'logs', label: '操作记录', icon: History },
];

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('note');
  const [compareVersion, setCompareVersion] = useState<number | null>(null);

  const task = useAppStore((state) => state.getTaskById(id || ''));
  const statusHistories = useAppStore((state) =>
    state.getStatusHistoriesByTaskId(id || '')
  );
  const artworks = useAppStore((state) => state.getArtworksByTaskId(id || ''));
  const wallLayouts = useAppStore((state) => state.getWallLayoutsByTaskId(id || ''));
  const operationLogs = useAppStore((state) =>
    state.getOperationLogsByTaskId(id || '')
  );
  const checkConsistency = useAppStore((state) => state.checkConsistency);

  if (!task) {
    return (
      <div className="text-center py-12">
        <p className="text-ivory-300">任务不存在</p>
        <button
          onClick={() => navigate('/')}
          className="btn-primary mt-4"
        >
          返回列表
        </button>
      </div>
    );
  }

  const StatusIcon = getStatusIcon(task.status);
  const consistencyResult = checkConsistency(task.id);

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/')}
          className="p-2 hover:bg-charcoal-200 rounded-md transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-ivory-300" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="font-serif text-2xl text-ivory-100">{task.title}</h1>
            <span
              className={`status-badge border ${getStatusColor(task.status)}`}
            >
              <StatusIcon className="w-3 h-3 inline mr-1" />
              {getStatusLabel(task.status)}
            </span>
            {task.executionCount > 1 && (
              <span className="flex items-center gap-1 text-xs text-gold-300 bg-gold-300/10 px-2 py-1 rounded">
                <RefreshCw className="w-3 h-3" />
                第 {task.executionCount} 次执行
              </span>
            )}
          </div>
          <div className="flex items-center gap-6 text-sm text-ivory-400">
            <span>来源: {task.source}</span>
            <span className="flex items-center gap-1">
              <User className="w-4 h-4" />
              {task.updatedBy}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {formatDate(task.updatedAt)}
            </span>
          </div>
        </div>
        <Link
          to={`/export/${task.id}`}
          className="btn-primary flex items-center gap-2"
        >
          <Download className="w-5 h-5" />
          导出复核
        </Link>
      </div>

      <div className="card p-6">
        <h3 className="font-serif text-lg text-ivory-100 mb-4">状态时间线</h3>
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-charcoal-200" />
          <div className="space-y-6">
            {statusHistories.map((history, index) => {
              const Icon = getStatusIcon(history.toStatus);
              const isLast = index === statusHistories.length - 1;
              return (
                <div key={history.id} className="relative flex gap-4">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center z-10 ${
                      isLast
                        ? 'bg-gold-300 text-charcoal-500 animate-pulse-gold'
                        : 'bg-charcoal-200 text-ivory-400'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 pb-2">
                    <div className="flex items-center gap-3 mb-1">
                      <span
                        className={`status-badge border ${getStatusColor(
                          history.toStatus
                        )}`}
                      >
                        {getStatusLabel(history.toStatus)}
                      </span>
                      <span className="text-sm text-ivory-400">
                        {history.operator}
                      </span>
                      <span className="text-sm text-ivory-500">
                        {formatDate(history.operatedAt)}
                      </span>
                    </div>
                    {history.remark && (
                      <p className="text-sm text-ivory-300">{history.remark}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {task.status === 'pending' && task.pendingReason && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-md">
          <p className="text-amber-300 flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>
              <strong>待处理原因：</strong>
              {task.pendingReason}
            </span>
          </p>
        </div>
      )}

      <div className="border-b border-charcoal-200/50">
        <div className="flex gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-gold-300 text-gold-300'
                    : 'border-transparent text-ivory-400 hover:text-ivory-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="card p-6">
        {activeTab === 'note' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-lg text-ivory-100">策展备注</h3>
              <span className="text-xs text-ivory-500">
                最后更新: {formatDate(task.updatedAt)}
              </span>
            </div>
            <div className="bg-charcoal-400/50 rounded-md p-5 font-mono text-sm text-ivory-200 whitespace-pre-wrap">
              {task.curatorNote}
            </div>
          </div>
        )}

        {activeTab === 'artworks' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-lg text-ivory-100">
                作品清单 ({artworks.length} 件)
              </h3>
              {!consistencyResult.isConsistent && (
                <span className="text-xs text-amber-300 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" />
                  有 {consistencyResult.issues.length} 个一致性问题
                </span>
              )}
            </div>
            {artworks.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-charcoal-200/50">
                      <th className="text-left py-3 px-4 text-sm font-medium text-ivory-400">
                        作品名称
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-ivory-400">
                        艺术家
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-ivory-400">
                        尺寸
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-ivory-400">
                        展墙
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-ivory-400">
                        版本
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {artworks.map((artwork) => {
                      const hasIssue = consistencyResult.issues.some(
                        (i) => i.artworkId === artwork.id
                      );
                      return (
                        <tr
                          key={artwork.id}
                          className={`border-b border-charcoal-200/30 hover:bg-charcoal-200/30 transition-colors ${
                            hasIssue ? 'bg-amber-500/5' : ''
                          }`}
                        >
                          <td className="py-3 px-4 text-ivory-100">
                            {artwork.title}
                            {hasIssue && (
                              <AlertTriangle className="w-4 h-4 text-amber-400 inline ml-2" />
                            )}
                          </td>
                          <td className="py-3 px-4 text-ivory-300">
                            {artwork.artist}
                          </td>
                          <td className="py-3 px-4 text-ivory-300">
                            {artwork.size}
                          </td>
                          <td className="py-3 px-4 text-ivory-300">
                            {artwork.wallId}
                          </td>
                          <td className="py-3 px-4 text-ivory-400 text-sm">
                            v{artwork.version}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-ivory-400">
                <Image className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>暂无作品清单</p>
                <p className="text-sm text-ivory-500 mt-1">
                  作品清单上传后将在此处显示
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'layout' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-lg text-ivory-100">
                展墙图历史 ({wallLayouts.length} 个版本)
              </h3>
              {wallLayouts.length >= 2 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-ivory-400">对比版本:</span>
                  <select
                    value={compareVersion || ''}
                    onChange={(e) =>
                      setCompareVersion(
                        e.target.value ? Number(e.target.value) : null
                      )
                    }
                    className="px-3 py-1.5 bg-charcoal-400 border border-charcoal-200/50 rounded-md text-sm text-ivory-100"
                  >
                    <option value="">无</option>
                    {wallLayouts.slice(1).map((layout) => (
                      <option key={layout.version} value={layout.version}>
                        v{layout.version}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {wallLayouts.length > 0 ? (
              <div className="space-y-4">
                {wallLayouts.map((layout) => (
                  <div
                    key={layout.id}
                    className={`p-4 bg-charcoal-400/50 rounded-md border ${
                      compareVersion === layout.version
                        ? 'border-gold-300/50'
                        : 'border-charcoal-200/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-gold-300">
                          v{layout.version}
                        </span>
                        <span className="text-sm text-ivory-400">
                          {layout.modifiedBy}
                        </span>
                        <span className="text-sm text-ivory-500">
                          {formatDate(layout.modifiedAt)}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-ivory-300 mb-3">
                      {layout.changeNote}
                    </p>
                    <div className="flex flex-wrap gap-3">
                      {layout.layoutData.walls.map((wall) => (
                        <div
                          key={wall.id}
                          className="bg-charcoal-300 rounded-md p-3 min-w-[200px]"
                        >
                          <p className="text-sm font-medium text-ivory-200 mb-2">
                            {wall.name}
                          </p>
                          <p className="text-xs text-ivory-400">
                            {wall.artworks.length} 件作品
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-ivory-400">
                <Image className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>暂无展墙图记录</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="space-y-4">
            <h3 className="font-serif text-lg text-ivory-100">操作记录</h3>
            {operationLogs.length > 0 ? (
              <div className="space-y-2">
                {operationLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-4 p-3 bg-charcoal-400/30 rounded-md"
                  >
                    <div className="w-2 h-2 rounded-full bg-gold-300 mt-2" />
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-sm font-medium text-ivory-200">
                          {log.operator}
                        </span>
                        <span className="text-xs text-ivory-500">
                          {formatDate(log.operatedAt)}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            log.action === 'create'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : log.action === 'update'
                              ? 'bg-blue-500/20 text-blue-300'
                              : 'bg-red-500/20 text-red-300'
                          }`}
                        >
                          {log.action === 'create'
                            ? '创建'
                            : log.action === 'update'
                            ? '更新'
                            : '删除'}
                        </span>
                      </div>
                      <p className="text-sm text-ivory-300">
                        {log.fieldName}: {log.oldValue && <span className="text-ivory-500 line-through">{log.oldValue}</span>}{' '}
                        {log.newValue && <span className="text-ivory-200">{log.newValue}</span>}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-ivory-400">
                <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>暂无操作记录</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
