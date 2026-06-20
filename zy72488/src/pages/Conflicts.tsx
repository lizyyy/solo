import { useState } from 'react';
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
  User,
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import type { Conflict } from '@/types';
import { cn } from '@/lib/utils';

export default function Conflicts() {
  const { conflicts, updateConflict, currentUser, addHistory, updatePoint, points } = useStore();
  const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed' | 'rejected' | 'resolved'>('all');

  const filteredConflicts = conflicts.filter((c) => filter === 'all' || c.status === filter);
  const pendingCount = conflicts.filter((c) => c.status === 'pending').length;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-slate-100 p-12 text-center">
        <CheckCircle size={48} className="text-emerald-400 mx-auto mb-3" />
        <p className="text-slate-600">加载中...</p>
      </div>
    </div>
  );
}
                  </div>
                  {conflict.source && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg">
                      <User size={14} className="text-slate-400" />
                      <span className="text-xs text-slate-500">数据来源：</span>
                      <span className="text-xs font-medium text-slate-700">{conflict.source}</span>
                    </div>
                  )}
                </div>
              )}

              {conflict.type === 'duplicate-import' && (
                <div className="space-y-3">
                  <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-100">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Layers size={16} className="text-indigo-600" />
                        <p className="text-sm font-medium text-indigo-800">批次详情</p>
                      </div>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">
                        已去重·数据未翻倍
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
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
                      {conflict.importOrder !== undefined && conflict.totalDuplicates !== undefined && (
                        <div className="flex items-center gap-2">
                          <Layers size={14} className="text-indigo-400 flex-shrink-0" />
                          <div>
                            <p className="text-xs text-indigo-500">重传次数</p>
                            <p className="text-sm text-indigo-700">第 {conflict.importOrder} 次 / 共 {conflict.totalDuplicates} 次</p>
                          </div>
                        </div>
                      )}
                      {conflict.importOrder !== undefined && conflict.totalDuplicates === undefined && (
                        <div className="flex items-center gap-2">
                          <Layers size={14} className="text-indigo-400 flex-shrink-0" />
                          <div>
                            <p className="text-xs text-indigo-500">第几次导入</p>
                            <p className="text-sm text-indigo-700">第 {conflict.importOrder} 次</p>
                          </div>
                        </div>
                      )}
                      {conflict.importOrder === undefined && conflict.totalDuplicates !== undefined && (
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
                        <p className="text-sm font-medium text-blue-800">导入的公交刷卡时段数据</p>
                      </div>
                      <p className="text-sm text-blue-700">{conflict.busCardValue}</p>
                    </div>
                  )}

                  <div className="p-4 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle size={14} className="text-slate-400" />
                      <p className="text-xs font-medium text-slate-500">冲突证据</p>
                    </div>
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
                          <User size={14} className="text-amber-400 flex-shrink-0" />
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

                  <div className="p-4 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle size={14} className="text-slate-400" />
                      <p className="text-xs font-medium text-slate-500">冲突证据</p>
                    </div>
                    <div className="space-y-2">
                      {conflict.source && (
                        <div className="flex items-start gap-2">
                          <span className="text-xs text-slate-400 flex-shrink-0 w-16">改道来源：</span>
                          <span className="text-sm text-slate-700 font-medium">{conflict.source}</span>
                        </div>
                      )}
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-slate-400 flex-shrink-0 w-16">改道描述：</span>
                        <span className="text-sm text-slate-700">{conflict.evidence}</span>
                      </div>
                    </div>
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
                </div>
              )}

              {conflict.type === 'data-inconsistent' && (
                <div className="space-y-3">
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle size={14} className="text-slate-400" />
                      <p className="text-xs font-medium text-slate-500">冲突证据</p>
                    </div>
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
