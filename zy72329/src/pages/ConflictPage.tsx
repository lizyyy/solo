import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, FileText, ListChecks, X, User, Shield, ArrowRight } from 'lucide-react';
import { api } from '../lib/api';
import { useDataStore } from '../store/dataStore';
import { useAuthStore } from '../store/authStore';
import { ConflictRecord, ConflictResolution, TeacherNote, SamplingList, BillRecord } from '../../shared/types';
import ConflictCompare from '../components/ConflictCompare';
import { cn } from '../lib/utils';

export default function ConflictPage() {
  const { conflicts, records, refreshAll, refreshConflicts, getRecordById } = useDataStore();
  const { user: currentUser } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [selectedConflict, setSelectedConflict] = useState<ConflictRecord | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [resolving, setResolving] = useState(false);
  const [teacherNote, setTeacherNote] = useState<TeacherNote | null>(null);
  const [samplingList, setSamplingList] = useState<SamplingList | null>(null);
  const [relatedRecord, setRelatedRecord] = useState<BillRecord | null>(null);

  useEffect(() => {
    if (conflicts.length === 0) {
      refreshConflicts();
    }
  }, [conflicts.length, refreshConflicts]);

  const handleSelectConflict = useCallback(async (conflict: ConflictRecord) => {
    if (selectedConflict?.id === conflict.id) {
      setSelectedConflict(null);
      setResolutionNote('');
      setTeacherNote(null);
      setSamplingList(null);
      setRelatedRecord(null);
      return;
    }
    setSelectedConflict(conflict);
    setResolutionNote('');

    const record = getRecordById(conflict.recordId);
    if (record) {
      setRelatedRecord(record);
      setTeacherNote({
        id: conflict.teacherNoteId,
        recordNo: record.recordNo,
        date: record.date,
        teacherName: record.teacherName,
        amount: record.amount,
        itemType: record.itemType,
        annotation: '老师批注完整内容示例 - 包含授课时长、课程内容、学生反馈等详细信息',
        importBatchId: 'BATCH-001',
        importedAt: record.createdAt,
        importedBy: '系统管理员',
      });
      setSamplingList({
        id: conflict.samplingListId,
        recordNo: record.recordNo,
        date: record.date,
        teacherName: record.teacherName,
        amount: conflict.conflictingFields.find((f) => f.field === 'amount')?.samplingListValue as number || record.amount + 100,
        itemType: record.itemType,
        sceneDescription: '抽样现场完整描述 - 包含实际到场情况、现场执行记录、签字确认等信息',
        isOldFormat: false,
        importBatchId: 'BATCH-002',
        importedAt: record.createdAt,
        importedBy: '系统管理员',
      });
    }
  }, [selectedConflict?.id, getRecordById]);

  const handleResolve = async (resolution: ConflictResolution) => {
    if (!selectedConflict) return;
    if (!resolutionNote.trim()) {
      alert('请填写处理意见');
      return;
    }
    setResolving(true);
    setLoading(true);
    try {
      await api.resolveConflict(selectedConflict.id, resolution, resolutionNote);
      await refreshAll();
      setSelectedConflict(null);
      setResolutionNote('');
      setTeacherNote(null);
      setSamplingList(null);
      setRelatedRecord(null);
    } catch (error) {
      console.error('处理冲突失败:', error);
      alert('处理失败，请重试');
    } finally {
      setResolving(false);
      setLoading(false);
    }
  };

  const unresolvedConflicts = conflicts.filter((c) => !c.resolution);
  const resolvedConflicts = conflicts.filter((c) => c.resolution);

  const ConflictCard = ({ conflict }: { conflict: ConflictRecord }) => {
    const isSelected = selectedConflict?.id === conflict.id;
    const isResolved = !!conflict.resolution;
    const record = getRecordById(conflict.recordId);

    return (
      <div
        key={conflict.id}
        className={cn(
          'border rounded-xl overflow-hidden transition-all',
          !isResolved && 'cursor-pointer',
          isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200 hover:border-gray-300',
          isResolved && 'opacity-75'
        )}
        onClick={() => handleSelectConflict(conflict)}
      >
        <div className="p-4 bg-white">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-start gap-3">
              <div className={cn(
                'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                isResolved ? 'bg-gray-100 text-gray-500' : 'bg-red-100 text-red-600'
              )}>
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-medium text-gray-900">
                    {record?.recordNo || conflict.recordId}
                  </span>
                  {record?.teacherName && (
                    <span className="text-sm text-gray-600">{record.teacherName}</span>
                  )}
                  {isResolved && (
                    <span className={cn(
                      'px-2 py-0.5 rounded-full text-xs font-medium',
                      conflict.resolution === 'teacher_note' && 'bg-blue-100 text-blue-700',
                      conflict.resolution === 'sampling_list' && 'bg-green-100 text-green-700',
                      conflict.resolution === 'rejected' && 'bg-gray-100 text-gray-700'
                    )}>
                      {conflict.resolution === 'teacher_note' && '已采纳批注'}
                      {conflict.resolution === 'sampling_list' && '已采纳抽样'}
                      {conflict.resolution === 'rejected' && '已标记异常'}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  冲突字段：{conflict.conflictingFields.map((f) => f.field).join('、')}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  创建时间：{conflict.createdAt}
                </p>
              </div>
            </div>
            {!isResolved && (
              <div className="flex flex-col items-end gap-1">
                <span className="px-2 py-1 bg-red-50 text-red-600 text-xs font-medium rounded-lg">
                  待处理
                </span>
              </div>
            )}
          </div>

          {!isResolved && (
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
              <Shield className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span className="text-xs text-amber-800 font-medium">
                待唐老师确认处理方式
              </span>
            </div>
          )}
        </div>

        {isSelected && (
          <div className="border-t border-gray-200 bg-gray-50 p-4">
            {!isResolved && (
              <div className="mb-4">
                <div className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
                  原始说法对比
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-1.5 mb-2">
                      <FileText className="w-4 h-4 text-blue-600" />
                      <span className="text-xs font-semibold text-blue-800">老师批注</span>
                    </div>
                    <div className="space-y-1 text-xs">
                      {conflict.conflictingFields.map((f) => (
                        <div key={f.field} className="flex justify-between">
                          <span className="text-gray-500">{f.field}:</span>
                          <span className="text-red-600 font-medium bg-red-50 px-1.5 py-0.5 rounded">
                            {String(f.teacherNoteValue)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-1.5 mb-2 justify-end">
                      <span className="text-xs font-semibold text-green-800">抽样名单</span>
                      <ListChecks className="w-4 h-4 text-green-600" />
                    </div>
                    <div className="space-y-1 text-xs">
                      {conflict.conflictingFields.map((f) => (
                        <div key={f.field} className="flex justify-between">
                          <span className="text-gray-500">{f.field}:</span>
                          <span className="text-red-600 font-medium bg-red-50 px-1.5 py-0.5 rounded">
                            {String(f.samplingListValue)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <ConflictCompare
              conflict={conflict}
              teacherNote={teacherNote}
              samplingList={samplingList}
              disabled={isResolved}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-28">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">冲突处理</h1>
          <p className="text-sm text-gray-500 mt-1">处理老师批注与抽样名单的数据冲突</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-500">
            待处理：<span className="font-semibold text-red-600">{unresolvedConflicts.length}</span> 条
          </div>
          <div className="text-sm text-gray-500">
            已处理：<span className="font-semibold text-green-600">{resolvedConflicts.length}</span> 条
          </div>
        </div>
      </div>

      {loading && conflicts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
          加载中...
        </div>
      ) : conflicts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">暂无冲突记录</p>
        </div>
      ) : (
        <div className="space-y-4">
          {unresolvedConflicts.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-3">待处理冲突</h2>
              <div className="space-y-3">
                {unresolvedConflicts.map((conflict) => (
                  <ConflictCard key={conflict.id} conflict={conflict} />
                ))}
              </div>
            </div>
          )}

          {resolvedConflicts.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-3">已处理冲突</h2>
              <div className="space-y-3">
                {resolvedConflicts.map((conflict) => (
                  <ConflictCard key={conflict.id} conflict={conflict} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {selectedConflict && !selectedConflict.resolution && (
        <div className="fixed bottom-0 left-0 right-0 lg:left-64 bg-white border-t border-gray-200 shadow-lg z-40">
          <div className="max-w-6xl mx-auto p-4">
            <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
              <div className="flex-1 w-full">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  处理意见 <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={resolutionNote}
                    onChange={(e) => setResolutionNote(e.target.value)}
                    placeholder="请输入处理意见（必填）"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                {currentUser && (
                  <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                    <User className="w-3 h-3" />
                    操作人：{currentUser.name} ({currentUser.role === 'coach' ? '唐老师' : currentUser.role})
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 w-full lg:w-auto">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedConflict(null);
                    setResolutionNote('');
                  }}
                  className="flex-1 lg:flex-none px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                >
                  <X className="w-4 h-4" />
                  取消
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleResolve('teacher_note');
                  }}
                  disabled={resolving || !resolutionNote.trim()}
                  className="flex-1 lg:flex-none px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FileText className="w-4 h-4" />
                  确认批注
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleResolve('sampling_list');
                  }}
                  disabled={resolving || !resolutionNote.trim()}
                  className="flex-1 lg:flex-none px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ListChecks className="w-4 h-4" />
                  确认抽样
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleResolve('rejected');
                  }}
                  disabled={resolving || !resolutionNote.trim()}
                  className="flex-1 lg:flex-none px-4 py-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <X className="w-4 h-4" />
                  驳回
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
