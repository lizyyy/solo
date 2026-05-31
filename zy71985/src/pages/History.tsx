import { useState, useMemo } from 'react';
import {
  History,
  KeyRound,
  ShieldAlert,
  Search,
  Filter,
  AlertTriangle,
  Eye,
  Clock,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store';
import { ActionBadge, StatusBadge, SourceBadge } from '@/components/StatusBadge';
import Timeline from '@/components/Timeline';
import PermissionDiff from '@/components/PermissionDiff';
import { formatDateTime } from '@/utils';
import type { OperationAction } from '@/types';

export default function HistoryPage() {
  const navigate = useNavigate();
  const operationLogs = useAppStore(state => state.operationLogs);
  const permissionChanges = useAppStore(state => state.permissionChanges);
  const getIdempotentInvalidRecords = useAppStore(state => state.getIdempotentInvalidRecords);
  const records = useAppStore(state => state.records);

  const [activeTab, setActiveTab] = useState<'logs' | 'idempotent' | 'permission'>('logs');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [actionFilter, setActionFilter] = useState<OperationAction | 'all'>('all');

  const filteredLogs = useMemo(() => {
    let filtered = [...operationLogs].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    if (actionFilter !== 'all') {
      filtered = filtered.filter(l => l.action === actionFilter);
    }
    if (searchKeyword) {
      const kw = searchKeyword.toLowerCase();
      filtered = filtered.filter(l =>
        l.recordId.toLowerCase().includes(kw) ||
        l.operator.toLowerCase().includes(kw) ||
        l.reason.toLowerCase().includes(kw)
      );
    }

    return filtered;
  }, [operationLogs, actionFilter, searchKeyword]);

  const idempotentInvalidRecords = useMemo(() => {
    return getIdempotentInvalidRecords();
  }, [records]);

  const allPermissionChanges = useMemo(() => {
    return [...permissionChanges].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [permissionChanges]);

  const getRecordInfo = (recordId: string) => {
    return records.find(r => r.id === recordId);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">历史追溯</h1>
          <p className="mt-1 text-slate-400 text-sm">
            查看操作日志、幂等键失效记录和权限变更历史
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-400" />
            <span className="text-slate-400">操作日志: <span className="text-cyan-400 font-medium">{operationLogs.length}</span></span>
          </div>
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-red-400" />
            <span className="text-slate-400">幂等失效: <span className="text-red-400 font-medium">{idempotentInvalidRecords.length}</span></span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-pink-400" />
            <span className="text-slate-400">权限变更: <span className="text-pink-400 font-medium">{permissionChanges.length}</span></span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 bg-slate-800/30 border border-slate-700/50 rounded-lg p-1 w-fit">
        {([
          { key: 'logs', label: `操作日志 (${operationLogs.length})`, icon: History },
          { key: 'idempotent', label: `幂等键失效 (${idempotentInvalidRecords.length})`, icon: KeyRound },
          { key: 'permission', label: `权限变更 (${permissionChanges.length})`, icon: ShieldAlert },
        ] as const).map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'logs' && (
        <div className="space-y-4">
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="搜索记录ID、操作人、原因..."
                  value={searchKeyword}
                  onChange={e => setSearchKeyword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <select
                  value={actionFilter}
                  onChange={e => setActionFilter(e.target.value as any)}
                  className="px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
                >
                  <option value="all">全部操作</option>
                  <option value="import">导入</option>
                  <option value="create">创建</option>
                  <option value="review">复核</option>
                  <option value="modify">修改</option>
                  <option value="export">导出</option>
                  <option value="permission_change">权限变更</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700/50">
                    <th className="text-left px-4 py-3 text-slate-400 text-xs font-medium uppercase tracking-wider">
                      时间
                    </th>
                    <th className="text-left px-4 py-3 text-slate-400 text-xs font-medium uppercase tracking-wider">
                      操作类型
                    </th>
                    <th className="text-left px-4 py-3 text-slate-400 text-xs font-medium uppercase tracking-wider">
                      操作人
                    </th>
                    <th className="text-left px-4 py-3 text-slate-400 text-xs font-medium uppercase tracking-wider">
                      关联记录
                    </th>
                    <th className="text-left px-4 py-3 text-slate-400 text-xs font-medium uppercase tracking-wider">
                      原因
                    </th>
                    <th className="text-right px-4 py-3 text-slate-400 text-xs font-medium uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                        暂无操作记录
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map(log => {
                      const record = getRecordInfo(log.recordId);
                      return (
                        <tr key={log.id} className="hover:bg-slate-800/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Clock className="w-3.5 h-3.5 text-slate-500" />
                              <span className="text-slate-300 text-xs font-mono">
                                {formatDateTime(log.createdAt)}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <ActionBadge action={log.action} />
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-white text-sm">{log.operator}</span>
                          </td>
                          <td className="px-4 py-3">
                            {record ? (
                              <div className="flex items-center gap-2">
                                <StatusBadge status={record.status} size="sm" />
                                <span className="text-slate-300 text-sm font-mono">
                                  {record.stockCode}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-500 text-xs">
                                {log.recordId.slice(0, 16)}...
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-slate-300 text-sm">{log.reason}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              {record && (
                                <button
                                  onClick={() => navigate(`/records/${record.id}`)}
                                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                                  title="查看记录"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'idempotent' && (
        <div className="space-y-4">
          {idempotentInvalidRecords.length === 0 ? (
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-12 text-center">
              <KeyRound className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
              <p className="text-white font-medium mb-1">幂等键状态良好</p>
              <p className="text-slate-400 text-sm">当前没有幂等键失效的记录</p>
            </div>
          ) : (
            <div className="space-y-3">
              {idempotentInvalidRecords.map(record => (
                <div
                  key={record.id}
                  className="bg-slate-800/30 border border-red-500/30 rounded-xl p-5 hover:border-red-500/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-red-500/10 text-red-400">
                          <AlertTriangle className="w-4 h-4" />
                          <span className="text-xs font-medium">幂等键失效</span>
                        </div>
                        <StatusBadge status={record.status} size="sm" />
                        <SourceBadge source={record.source} />
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                        <div>
                          <p className="text-slate-500 text-xs">库存编码</p>
                          <p className="text-white font-mono">{record.stockCode}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 text-xs">接口名称</p>
                          <p className="text-white font-mono">{record.interfaceName}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 text-xs">操作人</p>
                          <p className="text-white">{record.operator}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 text-xs">重试次数</p>
                          <p className="text-red-400 font-mono">{record.idempotentRetryCount || 0}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-slate-500 text-xs mb-1">幂等键</p>
                          <p className="text-red-400 font-mono text-sm">{record.idempotentKey}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 text-xs mb-1">失效原因</p>
                          <p className="text-red-300 text-sm">{record.idempotentInvalidReason || '未知'}</p>
                        </div>
                      </div>

                      {record.pendingReason && (
                        <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                          <p className="text-amber-400 text-xs font-medium mb-1">待处理原因</p>
                          <p className="text-amber-300 text-sm">{record.pendingReason}</p>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => navigate(`/records/${record.id}`)}
                      className="flex items-center gap-2 px-3 py-2 bg-slate-700 text-white rounded-lg text-sm hover:bg-slate-600 transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                      查看详情
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'permission' && (
        <div>
          <PermissionDiff changes={allPermissionChanges} />
        </div>
      )}
    </div>
  );
}
