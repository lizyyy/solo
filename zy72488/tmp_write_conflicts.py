content = '''import { useState } from 'react';
import {
  AlertTriangle,
  Bus,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Database,
  FileCheck,
  Layers,
  Hash,
  MapPin,
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import type { Conflict } from '@/types';
import { cn } from '@/lib/utils';

export default function Conflicts() {
  const { conflicts, updateConflict, currentUser, addHistory, updatePoint, points } = useStore();
  const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed' | 'rejected' | 'resolved'>('all');

  const filteredConflicts = conflicts.filter((c) => {
    if (filter === 'all') return true;
    return c.status === filter;
  });

  const handleConfirm = (conflict: Conflict) => {
    updateConflict(conflict.id, { status: 'confirmed', conclusion: '已确认冲突存在，需后续处理' });

    const point = points.find((p) => p.id === conflict.pointId);
    if (point && conflict.type === 'bus-vs-redline') {
      updatePoint(conflict.pointId, { status: 'conflict' });
    }

    addHistory({
      pointId: conflict.pointId,
      pointName: conflict.pointName,
      action: 'confirm',
      operator: currentUser,
      beforeData: {},
      afterData: {},
      fieldChanges: [],
      changeReason: '人工确认冲突存在',
      remark: `确认冲突：${getConflictTypeName(conflict.type)}`,
    });
  };

  const handleReject = (conflict: Conflict) => {
    updateConflict(conflict.id, { status: 'rejected', conclusion: '经核实不构成冲突，已驳回' });

    if (conflict.type === 'bus-vs-redline') {
      const point = points.find((p) => p.id === conflict.pointId);
      if (point && point.status === 'conflict') {
        const hasOtherConflicts = conflicts.some(
          (c) => c.pointId === conflict.pointId && c.type === 'bus-vs-redline' && c.id !== conflict.id && c.status === 'pending'
        );
        if (!hasOtherConflicts) {
          updatePoint(conflict.pointId, { status: 'normal' });
        }
      }
    }

    addHistory({
      pointId: conflict.pointId,
      pointName: conflict.pointName,
      action: 'reject',
      operator: currentUser,
      beforeData: {},
      afterData: {},
      fieldChanges: [],
      changeReason: '经核实不构成冲突',
      remark: `驳回冲突：${getConflictTypeName(conflict.type)}`,
    });
  };

  const getConflictTypeName = (type: string) => {
    const names: Record<string, string> = {
      'bus-vs-redline': '公交时段与红线图备注冲突',
      'detour-not-synced': '施工改道未同步地图',
      'data-inconsistent': '数据前后不一致',
      'duplicate-import': '重复导入检测',
    };
    return names[type] || type;
  };

  const getConflictTypeBadge = (type: string) => {
    const config: Record<string, { label: string; className: string }> = {
      'bus-vs-redline': { label: '时段冲突', className: 'bg-red-100 text-red-700' },
      'detour-not-synced': { label: '改道未同步', className: 'bg-amber-100 text-amber-700' },
      'data-inconsistent': { label: '数据不一致', className: 'bg-orange-100 text-orange-700' },
      'duplicate-import': { label: '重复导入', className: 'bg-indigo-100 text-indigo-700' },
    };
    const cfg = config[type] || { label: type, className: 'bg-slate-100 text-slate-700' };
    return (
      <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', cfg.className)}>
        {cfg.label}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; className: string }> = {
      pending: { label: '待处理', className: 'bg-amber-100 text-amber-700' },
      confirmed: { label: '已确认', className: 'bg-emerald-100 text-emerald-700' },
      rejected: { label: '已驳回', className: 'bg-red-100 text-red-700' },
      resolved: { label: '已处理', className: 'bg-blue-100 text-blue-700' },
    };
    const cfg = config[status] || config.pending;
    return (
      <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', cfg.className)}>
        {cfg.label}
      </span>
    );
  };

  const getDetourProcessStatus = (conflict: Conflict) => {
    const point = points.find((p) => p.id === conflict.pointId);
    if (conflict.status === 'resolved') return '已处理';
    if (conflict.status === 'rejected') return '已驳回';
    if (point?.reviewStatus === 'pending') return '待复核';
    if (point?.reviewStatus === 'approved') return '已通过';
    if (point?.reviewStatus === 'rejected') return '已驳回';
    return '待处理';
  };

  const getDetourProcessStatusBadge = (conflict: Conflict) => {
    const status = getDetourProcessStatus(conflict);
    let className = 'bg-amber-100 text-amber-700';
    if (status === '已处理' || status === '已通过') className = 'bg-emerald-100 text-emerald-700';
    if (status === '已驳回') className = 'bg-red-100 text-red-700';
    return (
      <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', className)}>
        {status}
      </span>
    );
  };

  const getMapSyncStatus = (conflict: Conflict) => {
    const point = points.find((p) => p.id === conflict.pointId);
    return point?.mapSynced ?? false;
  };

  const pendingCount = conflicts.filter((c) => c.status === 'pending').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">冲突检测中心</h2>
          <p className="text-sm text-slate-500 mt-1">
            共 {conflicts.length} 个冲突，{pendingCount} 个待处理
          </p>
        </div>
        <div className="flex gap-2">
          {(['all', 'pending', 'confirmed', 'rejected', 'resolved'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-3 py-1.5 text-sm rounded-lg transition-colors',
                filter === f
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              )}
            >
              {f === 'all' ? '全部' : f === 'pending' ? '待处理' : f === 'confirmed' ? '已确认' : f === 'rejected' ? '已驳回' : '已处理'}
            </button>
          ))}
        </div>
      </div>

      {pendingCount > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">
                有 {pendingCount} 个冲突需要您确认或驳回
              </p>
              <p className="text-xs text-amber-600 mt-1">
                请仔细核对冲突证据，系统不会自动替您做决定
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {filteredConflicts.map((conflict) => (
          <div key={conflict.id} className="bg-white rounded-lg shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center',
                  conflict.type === 'detour-not-synced' ? 'bg-amber-100' :
                  conflict.type === 'duplicate-import' ? 'bg-indigo-100' :
                  'bg-red-100'
                )}>
                  <AlertTriangle size={20} className={cn(
                    conflict.type === 'detour-not-synced' ? 'text-amber-600' :
                    conflict.type === 'duplicate-import' ? 'text-indigo-600' :
                    'text-red-600'
                  )} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-800">{conflict.pointName}</h3>
                    {getConflictTypeBadge(conflict.type)}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Database size={12} />
                      来源：{conflict.source || '系统检测'}
                    </span>
                    <span className="text-xs text-slate-500">
                      {getConflictTypeName(conflict.type)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {getStatusBadge(conflict.status)}
                {conflict.handler && (
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <Clock size={12} />
                    {conflict.handler} 处理于 {new Date(conflict.handledAt!).toLocaleString('zh-CN')}
                  </span>
                )}
              </div>
            </div>

            <div className="p-4 space-y-4">
              {conflict.type === 'bus-vs-redline' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Bus size={16} className="text-blue-600" />
                      <p className="text-sm font-medium text-blue-800">公交刷卡时段</p>
                    </div>
                    <p className="text-sm text-blue-700">{conflict.busCardValue}</p>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText size={16} className="text-purple-600" />
                      <p className="text-sm font-medium text-purple-800">红线图备注</p>
                    </div>
                    <p className="text-sm text-purple-700">{conflict.redLineValue}</p>
                  </div>
                </div>
              )}

              {conflict.type === 'duplicate-import' && (
                <div className="space-y-3">
                  <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-100">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Layers size={16} className="text-indigo-600" />
                        <p className="text-sm font-medium text-indigo-800">批次信息</p>
                      </div>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">
                        已去重·数据未翻倍
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {conflict.batchId && (
                        <div className="flex items-center gap-2">
                          <Hash size={14} className="text-indigo-400 flex-shrink-0" />
                          <div>
                            <p className="text-xs text-indigo-500">批次ID</p>
                            <p className="text-sm font-mono text-indigo-700">{conflict.batchId}</p>
                          </div>
                        </div>
                      )}
                      {conflict.batchSource && (
                        <div className="flex items-center gap-2">
                          <Database size={14} className="text-indigo-400 flex-shrink-0" />
                          <div>
                            <p className="text-xs text-indigo-500">批次来源</p>
                            <p className="text-sm text-indigo-700">{conflict.batchSource}</p>
                          </div>
                        </div>
                      )}
                      {conflict.importOrder !== undefined && (
                        <div className="flex items-center gap-2">
                          <Layers size={14} className="text-indigo-400 flex-shrink-0" />
                          <div>
                            <p className="text-xs text-indigo-500">第几次导入</p>
                            <p className="text-sm text-indigo-700">第 {conflict.importOrder} 次</p>
                          </div>
                        </div>
                      )}
                      {conflict.totalDuplicates !== undefined && (
                        <div className="flex items-center gap-2">
                          <AlertTriangle size={14} className="text-indigo-400 flex-shrink-0" />
                          <div>
                            <p className="text-xs text-indigo-500">总重复次数</p>
                            <p className="text-sm text-indigo-700">{conflict.totalDuplicates} 次</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {conflict.busCardValue && (
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Bus size={16} className="text-blue-600" />
                        <p className="text-sm font-medium text-blue-800">公交刷卡时段</p>
                      </div>
                      <p className="text-sm text-blue-700">{conflict.busCardValue}</p>
                    </div>
                  )}

                  <div className="px-1">
                    <p className="text-xs text-slate-400 leading-relaxed">
                      去重口径：相同点位 + 相同数据内容 + 同一来源批次ID。同一批重传自动去重，不同批次不拦截。
                    </p>
                  </div>
                </div>
              )}

              {conflict.type === 'detour-not-synced' && (
                <div className="space-y-3">
                  <div className="p-4 bg-amber-50 rounded-lg border border-amber-100">
                    <div className="flex items-center gap-2 mb-3">
                      <MapPin size={16} className="text-amber-600" />
                      <p className="text-sm font-medium text-amber-800">改道信息</p>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {conflict.source && (
                        <div className="flex items-center gap-2">
                          <Database size={14} className="text-amber-400 flex-shrink-0" />
                          <div>
                            <p className="text-xs text-amber-500">改道来源</p>
                            <p className="text-sm text-amber-700">{conflict.source}</p>
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <MapPin size={14} className="text-amber-400 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-amber-500">地图同步</p>
                          <p className={cn(
                            'text-sm font-medium',
                            getMapSyncStatus(conflict) ? 'text-emerald-600' : 'text-red-600'
                          )}>
                            {getMapSyncStatus(conflict) ? '已同步' : '未同步'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock size={14} className="text-amber-400 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-amber-500">处理状态</p>
                          <div className="mt-0.5">
                            {getDetourProcessStatusBadge(conflict)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-xs font-medium text-slate-500 mb-2">冲突证据</p>
                <p className="text-sm text-slate-700">{conflict.evidence}</p>
              </div>

              {conflict.conclusion && (
                <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                  <div className="flex items-start gap-2">
                    <FileCheck size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium text-emerald-700">处理结论</p>
                      <p className="text-sm text-emerald-800 mt-0.5">{conflict.conclusion}</p>
                    </div>
                  </div>
                </div>
              )}

              {conflict.status === 'pending' && (
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => handleReject(conflict)}
                    className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50 transition-colors"
                  >
                    <XCircle size={16} />
                    驳回
                  </button>
                  <button
                    onClick={() => handleConfirm(conflict)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 transition-colors"
                  >
                    <CheckCircle size={16} />
                    确认
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {filteredConflicts.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-100 p-12 text-center">
            <CheckCircle size={48} className="text-emerald-400 mx-auto mb-3" />
            <p className="text-slate-600">暂无冲突记录</p>
          </div>
        )}
      </div>
    </div>
  );
}
'''

with open('/Users/lzy/pro/solo/workspaces/zy72488/src/pages/Conflicts.tsx', 'w') as f:
    f.write(content)

print(f'File written successfully, size: {len(content)} bytes')
