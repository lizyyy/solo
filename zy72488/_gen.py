#!/usr/bin/env python3
import os

points_content = '''import { useState } from 'react';
import {
  Search, Eye, MapPin, Bus, AlertTriangle,
  CheckCircle, XCircle, Layers, Clock, Hash,
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import StatusBadge from '@/components/StatusBadge';
import { cn } from '@/lib/utils';
import type { Point } from '@/types';

const formatDateTime = (s: string) => {
  const d = new Date(s);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

const getReviewStatusBadge = (status: Point['reviewStatus']) => ({
  'not-needed': { label: '无需复核', className: 'bg-slate-100 text-slate-600' },
  pending: { label: '待复核', className: 'bg-amber-100 text-amber-700' },
  approved: { label: '已通过', className: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: '已驳回', className: 'bg-red-100 text-red-700' },
}[status] || { label: '无需复核', className: 'bg-slate-100 text-slate-600' });

export default function Points() {
  const { points, approveReview, rejectReview } = useStore();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Point | null>(null);

  const filtered = points.filter(
    (p) => p.name.includes(search) || p.location.includes(search)
  );
  const hasDup = (p: Point) => p.importBatches.some((b) => b.isDuplicate);

  const handleApprove = (p: Point) => {
    approveReview(p.id);
    setSelected({ ...p, reviewStatus: 'approved', status: 'normal', mapSynced: true });
  };
  const handleReject = (p: Point) => {
    rejectReview(p.id);
    setSelected({ ...p, reviewStatus: 'rejected' });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">点位清单</h2>
        <p className="text-sm text-slate-500 mt-1">管理所有点位信息，查看导入批次、复核状态及施工改道情况</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-100">
        <div className="p-4 border-b border-slate-100">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text" placeholder="搜索点位名称或位置..." value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs text-slate-500 uppercase">
                <th className="px-4 py-3 font-medium">点位名称</th>
                <th className="px-4 py-3 font-medium">位置</th>
                <th className="px-4 py-3 font-medium">状态</th>
                <th className="px-4 py-3 font-medium">施工改道</th>
                <th className="px-4 py-3 font-medium">导入批次</th>
                <th className="px-4 py-3 font-medium">复核状态</th>
                <th className="px-4 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((p) => {
                const rb = getReviewStatusBadge(p.reviewStatus);
                return (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <MapPin size={16} className="text-primary-500 flex-shrink-0" />
                        <span className="text-sm font-medium text-slate-800">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{p.location}</td>
                    <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                    <td className="px-4 py-3">
                      {p.hasConstructionDetour ? (
                        <span className="inline-flex items-center gap-1 text-amber-600 text-xs">
                          <AlertTriangle size={14} />有改道
                        </span>
                      ) : <span className="text-xs text-slate-400">无</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Layers size={14} className="text-indigo-500 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs text-slate-700 truncate max-w-40">{p.lastImportSource}</p>
                          <p className="text-xs text-slate-400 flex items-center gap-1">
                            共 {p.importCount} 次
                            {hasDup(p) && <span className="px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded text-[10px] font-medium">重传</span>}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', rb.className)}>{rb.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => setSelected(p)} className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700">
                        <Eye size={14} />查看详情
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                  <MapPin size={20} className="text-primary-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">{selected.name}</h3>
                  <p className="text-xs text-slate-500">{selected.location}</p>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600">
                <XCircle size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto max-h-[calc(85vh-80px)]">
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-500 w-20">状态</span>
                <StatusBadge status={selected.status} />
              </div>
              <div className="flex items-start gap-3">
                <span className="text-sm text-slate-500 w-20 flex-shrink-0">公交刷卡时段</span>
                <span className="text-sm text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg">
                  <Bus size={14} className="inline mr-1.5" />{selected.busCardTime}
                </span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-sm text-slate-500 w-20 flex-shrink-0">红线图备注</span>
                <span className="text-sm text-purple-700 bg-purple-50 px-3 py-1.5 rounded-lg flex-1">
                  {selected.redLineNote || '暂无备注'}
                </span>
              </div>

              <div className="flex items-start gap-3">
                <span className="text-sm text-slate-500 w-20 flex-shrink-0 pt-2">导入批次记录</span>
                <div className="flex-1 space-y-2">
                  {selected.importBatches.map((b, i) => (
                    <div key={i} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Hash size={14} className="text-slate-400" />
                          <span className="text-sm font-medium text-slate-700">第 {b.importOrder} 次</span>
                        </div>
                        <span className={cn('text-xs px-2 py-0.5 rounded font-medium',
                          b.isDuplicate ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'
                        )}>
                          {b.isDuplicate ? '重复·已去重' : '新批次'}
                        </span>
                      </div>
                      <div className="space-y-1 text-xs">
                        <p className="text-slate-600">批次ID：<span className="font-mono text-slate-700">{b.batchId}</span></p>
                        <p className="text-slate-600">来源：{b.source}</p>
                        <p className="text-slate-600 flex items-center gap-1"><Clock size={12} />{formatDateTime(b.importedAt)}</p>
                        <p className="text-slate-600 flex items-center gap-1"><Bus size={12} className="text-blue-500" />{b.busCardTime}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {selected.hasConstructionDetour && (
                <div className="flex items-start gap-3 pt-2 border-t border-slate-100">
                  <span className="text-sm text-slate-500 w-20 flex-shrink-0 pt-1">施工改道</span>
                  <div className="flex-1">
                    <div className="p-3 bg-amber-50 rounded-lg border border-amber-100 mb-3">
                      <div className="flex items-center gap-2 text-amber-700">
                        <AlertTriangle size={16} />
                        <span className="text-sm font-medium">存在施工改道</span>
                      </div>
                      <p className="text-xs text-amber-600 mt-1">{selected.mapSynced ? '地图已同步' : '地图未同步，待复核'}</p>
                    </div>
                    {selected.reviewStatus === 'pending' && (
                      <div className="flex gap-2">
                        <button onClick={() => handleApprove(selected)} className="flex-1 flex items-center justify-center gap-1 py-2 bg-emerald-500 text-white rounded-lg text-sm hover:bg-emerald-600">
                          <CheckCircle size={16} />通过
                        </button>
                        <button onClick={() => handleReject(selected)} className="flex-1 flex items-center justify-center gap-1 py-2 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600">
                          <XCircle size={16} />驳回
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
'''

conflicts_content = '''import { useState } from 'react';
import {
  AlertTriangle, Bus, FileText, CheckCircle, XCircle,
  Clock, Database, FileCheck, Layers, User,
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import type { Conflict } from '@/types';
import { cn } from '@/lib/utils';

export default function Conflicts() {
  const { conflicts, updateConflict, currentUser, addHistory, updatePoint, points } = useStore();
  const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed' | 'rejected' | 'resolved'>('all');

  const filteredConflicts = conflicts.filter((c) => filter === 'all' || c.status === filter);
  const pendingCount = conflicts.filter((c) => c.status === 'pending').length;

  const getConflictTypeName = (type: string) => ({
    'bus-vs-redline': '公交时段与红线图备注冲突',
    'detour-not-synced': '施工改道未同步地图',
    'data-inconsistent': '数据前后不一致',
    'duplicate-import': '重复导入检测',
  }[type] || type);

  const getConflictTypeBadge = (type: string) => {
    const config: Record<string, { label: string; className: string }> = {
      'bus-vs-redline': { label: '时段冲突', className: 'bg-red-100 text-red-700' },
      'detour-not-synced': { label: '改道未同步', className: 'bg-amber-100 text-amber-700' },
      'data-inconsistent': { label: '数据不一致', className: 'bg-orange-100 text-orange-700' },
      'duplicate-import': { label: '重复导入', className: 'bg-indigo-100 text-indigo-700' },
    };
    const cfg = config[type] || { label: type, className: 'bg-slate-100 text-slate-700' };
    return <span className={cn('px-2 py-0.5 rounded text-xs font-medium', cfg.className)}>{cfg.label}</span>;
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; className: string }> = {
      pending: { label: '待处理', className: 'bg-amber-100 text-amber-700' },
      confirmed: { label: '已确认', className: 'bg-emerald-100 text-emerald-700' },
      rejected: { label: '已驳回', className: 'bg-red-100 text-red-700' },
      resolved: { label: '已处理', className: 'bg-blue-100 text-blue-700' },
    };
    const cfg = config[status] || config.pending;
    return <span className={cn('px-2 py-0.5 rounded text-xs font-medium', cfg.className)}>{cfg.label}</span>;
  };

  const handleConfirm = (conflict: Conflict) => {
    updateConflict(conflict.id, { status: 'confirmed', conclusion: '已确认冲突存在，需后续处理' });
    if (conflict.type === 'bus-vs-redline') {
      updatePoint(conflict.pointId, { status: 'conflict' });
    }
    addHistory({
      pointId: conflict.pointId, pointName: conflict.pointName, action: 'confirm',
      operator: currentUser, beforeData: {}, afterData: {}, fieldChanges: [],
      changeReason: '人工确认冲突存在', remark: `确认冲突：${getConflictTypeName(conflict.type)}`,
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
        if (!hasOtherConflicts) updatePoint(conflict.pointId, { status: 'normal' });
      }
    }
    addHistory({
      pointId: conflict.pointId, pointName: conflict.pointName, action: 'reject',
      operator: currentUser, beforeData: {}, afterData: {}, fieldChanges: [],
      changeReason: '经核实不构成冲突', remark: `驳回冲突：${getConflictTypeName(conflict.type)}`,
    });
  };

  const getTypeIcon = (type: string) => (type === 'duplicate-import' ? Layers : AlertTriangle);
  const getTypeIconBg = (type: string) => ({
    'duplicate-import': 'bg-indigo-100',
    'detour-not-synced': 'bg-amber-100',
    'bus-vs-redline': 'bg-red-100',
    'data-inconsistent': 'bg-orange-100',
  }[type] || 'bg-slate-100');
  const getTypeIconText = (type: string) => ({
    'duplicate-import': 'text-indigo-600',
    'detour-not-synced': 'text-amber-600',
    'bus-vs-redline': 'text-red-600',
    'data-inconsistent': 'text-orange-600',
  }[type] || 'text-slate-600');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">冲突检测中心</h2>
          <p className="text-sm text-slate-500 mt-1">共 {conflicts.length} 个冲突，{pendingCount} 个待处理</p>
        </div>
        <div className="flex gap-2">
          {(['all', 'pending', 'confirmed', 'rejected', 'resolved'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-3 py-1.5 text-sm rounded-lg transition-colors',
                filter === f ? 'bg-primary-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              )}
            >
              {{ all: '全部', pending: '待处理', confirmed: '已确认', rejected: '已驳回', resolved: '已处理' }[f]}
            </button>
          ))}
        </div>
      </div>

      {pendingCount > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">有 {pendingCount} 个冲突需要您确认或驳回</p>
              <p className="text-xs text-amber-600 mt-1">请仔细核对冲突证据，系统不会自动替您做决定</p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {filteredConflicts.map((conflict) => {
          const TypeIcon = getTypeIcon(conflict.type);
          return (
            <div key={conflict.id} className="bg-white rounded-lg shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn('w-10 h-10 rounded-full flex items-center justify-center', getTypeIconBg(conflict.type))}>
                    <TypeIcon size={20} className={getTypeIconText(conflict.type)} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-slate-800">{conflict.pointName}</h3>
                      {getConflictTypeBadge(conflict.type)}
                      {conflict.type === 'duplicate-import' && conflict.batchId && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700">
                          <Layers size={12} />
                          <span className="font-mono">{conflict.batchId}</span>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                      <span className="flex items-center gap-1"><Database size={12} />{conflict.source || '系统检测'}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {getStatusBadge(conflict.status)}
                  {conflict.handler && conflict.handledAt && (
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Clock size={12} />{conflict.handler} · {new Date(conflict.handledAt).toLocaleString('zh-CN')}
                    </span>
                  )}
                </div>
              </div>

              <div className="p-4 space-y-4">
                {conflict.type === 'bus-vs-redline' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2"><Bus size={16} className="text-blue-600" /><p className="text-sm font-medium text-blue-800">公交刷卡时段</p></div>
                      <p className="text-sm text-blue-700">{conflict.busCardValue}</p>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2"><FileText size={16} className="text-purple-600" /><p className="text-sm font-medium text-purple-800">红线图备注</p></div>
                      <p className="text-sm text-purple-700">{conflict.redLineValue}</p>
                    </div>
                  </div>
                )}

                {conflict.type === 'duplicate-import' && (
                  <div className="p-4 bg-indigo-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-3"><Layers size={16} className="text-indigo-600" /><p className="text-sm font-medium text-indigo-800">批次详情</p></div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {conflict.batchId && <div><p className="text-xs text-indigo-500">批次ID</p><p className="font-mono text-indigo-700 mt-0.5">{conflict.batchId}</p></div>}
                      {conflict.batchSource && <div><p className="text-xs text-indigo-500">批次来源</p><p className="text-indigo-700 mt-0.5">{conflict.batchSource}</p></div>}
                      {conflict.importOrder !== undefined && conflict.totalDuplicates !== undefined && (
                        <div><p className="text-xs text-indigo-500">重传次数</p><p className="text-indigo-700 mt-0.5">第 {conflict.importOrder} 次 / 共 {conflict.totalDuplicates} 次</p></div>
                      )}
                      {conflict.busCardValue && <div><p className="text-xs text-indigo-500">导入的公交刷卡时段</p><p className="text-indigo-700 mt-0.5">{conflict.busCardValue}</p></div>}
                    </div>
                  </div>
                )}

                {conflict.type === 'detour-not-synced' && (
                  <div className="p-4 bg-amber-50 rounded-lg">
                    <div className="flex items-start gap-2">
                      <User size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-amber-800 mb-1">改道来源：{conflict.source}</p>
                        <p className="text-sm text-amber-700">{conflict.evidence}</p>
                      </div>
                    </div>
                  </div>
                )}

                {conflict.type === 'data-inconsistent' && (
                  <div className="p-4 bg-orange-50 rounded-lg">
                    <p className="text-sm text-orange-700">{conflict.evidence}</p>
                  </div>
                )}

                {(conflict.type === 'bus-vs-redline' || conflict.type === 'duplicate-import') && conflict.evidence && (
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <p className="text-xs font-medium text-slate-500 mb-1">证据</p>
                    <p className="text-sm text-slate-700">{conflict.evidence}</p>
                  </div>
                )}

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
                    <button onClick={() => handleReject(conflict)} className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50 transition-colors">
                      <XCircle size={16} />驳回
                    </button>
                    <button onClick={() => handleConfirm(conflict)} className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 transition-colors">
                      <CheckCircle size={16} />确认
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

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

base_dir = '/Users/lzy/pro/solo/workspaces/zy72488/src/pages'

with open(os.path.join(base_dir, 'Points.tsx'), 'w') as f:
    f.write(points_content)
print(f"Points.tsx: {len(points_content.splitlines())} lines")

with open(os.path.join(base_dir, 'Conflicts.tsx'), 'w') as f:
    f.write(conflicts_content)
print(f"Conflicts.tsx: {len(conflicts_content.splitlines())} lines")

print("Done!")
