import React, { useEffect, useState } from 'react';
import { useAppStore } from '@/store';
import { AlertTriangle, Check, X, Merge } from 'lucide-react';
import type { ConflictRecord } from '../../shared/types';

const formatDate = (iso: string) => {
  return new Date(iso).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const ConflictReview: React.FC = () => {
  const { conflicts, loading, error, fetchConflicts, resolveConflict } = useAppStore();
  const [selectedConflict, setSelectedConflict] = useState<ConflictRecord | null>(null);
  const [resolution, setResolution] = useState<'keep_ramp' | 'keep_sampling' | 'merge'>('keep_ramp');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchConflicts();
  }, [fetchConflicts]);

  const pendingConflicts = conflicts.filter(c => c.status === 'pending');
  const resolvedConflicts = conflicts.filter(c => c.status === 'resolved');

  const handleResolve = async () => {
    if (!selectedConflict) return;
    const success = await resolveConflict(selectedConflict.id, resolution, note);
    if (success) {
      setMessage('冲突复核完成');
      setSelectedConflict(null);
      setNote('');
      setTimeout(() => setMessage(null), 3000);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-slate-800">冲突复核</h3>
          <p className="text-sm text-slate-500 mt-1">
            处理无障碍坡道记录与夜间采样点的数据冲突
          </p>
        </div>
        <div className="flex gap-4">
          <div className="text-sm">
            <span className="text-slate-500">待复核：</span>
            <span className="font-semibold text-red-600">{pendingConflicts.length}</span>
          </div>
          <div className="text-sm">
            <span className="text-slate-500">已完成：</span>
            <span className="font-semibold text-emerald-600">{resolvedConflicts.length}</span>
          </div>
        </div>
      </div>

      {message && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg">
          {message}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
            <h4 className="font-medium text-slate-700">冲突列表</h4>
          </div>
          <div className="divide-y divide-slate-100 max-h-[600px] overflow-auto">
            {loading ? (
              <div className="p-12 text-center text-slate-500">加载中...</div>
            ) : pendingConflicts.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <Check className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                <p>暂无待复核的冲突</p>
              </div>
            ) : (
              pendingConflicts.map((conflict) => (
                <div
                  key={conflict.id}
                  onClick={() => {
                    setSelectedConflict(conflict);
                    setResolution('keep_ramp');
                    setNote('');
                  }}
                  className={`p-4 cursor-pointer transition-colors ${
                    selectedConflict?.id === conflict.id
                      ? 'bg-blue-50'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800">{conflict.location}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        冲突字段：{conflict.conflictFields.join('、')}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        坡道行号：{conflict.rampRecord.originalRowNumber} · 采样点行号：{conflict.samplingRecord.originalRowNumber}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
            <h4 className="font-medium text-slate-700">冲突详情与复核</h4>
          </div>
          
          {!selectedConflict ? (
            <div className="p-12 text-center text-slate-500">
              <AlertTriangle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p>请从左侧选择一条冲突记录进行复核</p>
            </div>
          ) : (
            <div className="p-4 space-y-4 max-h-[600px] overflow-auto">
              <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="text-sm font-medium text-orange-700">
                  {selectedConflict.location}
                </p>
                <p className="text-xs text-orange-600 mt-1">
                  冲突字段：{selectedConflict.conflictFields.join('、')}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-blue-50 border-b border-blue-100">
                    <p className="text-xs font-medium text-blue-700">无障碍坡道记录</p>
                  </div>
                  <div className="p-3 text-sm space-y-2">
                    <div>
                      <p className="text-xs text-slate-500">居民意见原文</p>
                      <p className="text-slate-700">
                        {selectedConflict.rampRecord.residentOpinionOriginal || (
                          <span className="text-orange-600">无原文</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">居民意见汇总</p>
                      <p className="text-slate-700">{selectedConflict.rampRecord.residentOpinionSummary}</p>
                    </div>
                    <div className="pt-2 border-t border-slate-100">
                      <p className="text-xs text-slate-500">
                        导入人：{selectedConflict.rampRecord.importedBy}
                      </p>
                      <p className="text-xs text-slate-500">
                        时间：{formatDate(selectedConflict.rampRecord.importTime)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-purple-50 border-b border-purple-100">
                    <p className="text-xs font-medium text-purple-700">夜间采样点记录</p>
                  </div>
                  <div className="p-3 text-sm space-y-2">
                    <div>
                      <p className="text-xs text-slate-500">居民意见原文</p>
                      <p className="text-slate-700">
                        {selectedConflict.samplingRecord.residentOpinionOriginal || (
                          <span className="text-orange-600">无原文</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">居民意见汇总</p>
                      <p className="text-slate-700">{selectedConflict.samplingRecord.residentOpinionSummary}</p>
                    </div>
                    <div className="pt-2 border-t border-slate-100">
                      <p className="text-xs text-slate-500">
                        补录人：{selectedConflict.samplingRecord.importedBy}
                      </p>
                      <p className="text-xs text-slate-500">
                        时间：{formatDate(selectedConflict.samplingRecord.importTime)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200">
                <p className="text-sm font-medium text-slate-700 mb-3">选择处理方式</p>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                    <input
                      type="radio"
                      name="resolution"
                      value="keep_ramp"
                      checked={resolution === 'keep_ramp'}
                      onChange={() => setResolution('keep_ramp')}
                      className="w-4 h-4 text-blue-600"
                    />
                    <X className="w-4 h-4 text-purple-500" />
                    <div>
                      <p className="text-sm font-medium text-slate-700">保留坡道记录</p>
                      <p className="text-xs text-slate-500">以无障碍坡道的数据为准</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                    <input
                      type="radio"
                      name="resolution"
                      value="keep_sampling"
                      checked={resolution === 'keep_sampling'}
                      onChange={() => setResolution('keep_sampling')}
                      className="w-4 h-4 text-blue-600"
                    />
                    <X className="w-4 h-4 text-blue-500" />
                    <div>
                      <p className="text-sm font-medium text-slate-700">保留采样点记录</p>
                      <p className="text-xs text-slate-500">以夜间采样点的数据为准</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                    <input
                      type="radio"
                      name="resolution"
                      value="merge"
                      checked={resolution === 'merge'}
                      onChange={() => setResolution('merge')}
                      className="w-4 h-4 text-blue-600"
                    />
                    <Merge className="w-4 h-4 text-emerald-500" />
                    <div>
                      <p className="text-sm font-medium text-slate-700">合并双方数据</p>
                      <p className="text-xs text-slate-500">综合两边的信息</p>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">
                  复核意见（选填）
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="请输入复核意见..."
                  rows={2}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleResolve}
                  disabled={loading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? '处理中...' : '确认复核'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {resolvedConflicts.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
            <h4 className="font-medium text-slate-700">已复核记录</h4>
          </div>
          <div className="divide-y divide-slate-100">
            {resolvedConflicts.map((conflict) => (
              <div key={conflict.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-800">{conflict.location}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      处理方式：{
                        conflict.resolution === 'keep_ramp' ? '保留坡道记录' :
                        conflict.resolution === 'keep_sampling' ? '保留采样点记录' : '合并数据'
                      }
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                      <Check className="w-3 h-3" />
                      已复核
                    </span>
                    <p className="text-xs text-slate-500 mt-1">
                      {conflict.resolvedBy} · {conflict.resolvedAt && formatDate(conflict.resolvedAt)}
                    </p>
                  </div>
                </div>
                {conflict.resolutionNote && (
                  <p className="text-sm text-slate-600 mt-2 bg-slate-50 p-2 rounded">
                    复核意见：{conflict.resolutionNote}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
