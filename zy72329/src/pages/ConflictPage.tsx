import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, FileText, ListChecks, X, User } from 'lucide-react';
import { api } from '../lib/api';
import { useAppStore } from '../store';
import { ConflictRecord, ConflictResolution, TeacherNote, SamplingList } from '../../shared/types';
import ConflictCompare from '../components/ConflictCompare';
import { cn } from '../lib/utils';

export default function ConflictPage() {
  const { conflicts, setConflicts, currentUser } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [selectedConflict, setSelectedConflict] = useState<ConflictRecord | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [resolving, setResolving] = useState(false);
  const [teacherNote, setTeacherNote] = useState<TeacherNote | null>(null);
  const [samplingList, setSamplingList] = useState<SamplingList | null>(null);

  const loadConflicts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getConflicts();
      setConflicts(data);
    } catch (error) {
      console.error('加载冲突列表失败:', error);
    } finally {
      setLoading(false);
    }
  }, [setConflicts]);

  useEffect(() => {
    loadConflicts();
  }, [loadConflicts]);

  const handleSelectConflict = async (conflict: ConflictRecord) => {
    if (selectedConflict?.id === conflict.id) {
      setSelectedConflict(null);
      setResolutionNote('');
      return;
    }
    setSelectedConflict(conflict);
    setResolutionNote('');
    try {
      const [recordDetail] = await Promise.all([
        api.getRecordDetail(conflict.recordId),
      ]);
      setTeacherNote({
        id: conflict.teacherNoteId,
        recordNo: recordDetail.recordNo,
        date: recordDetail.date,
        teacherName: recordDetail.teacherName,
        amount: recordDetail.amount,
        itemType: recordDetail.itemType,
        annotation: '老师批注内容示例',
        importBatchId: 'BATCH-001',
        importedAt: recordDetail.createdAt,
        importedBy: '系统管理员',
      });
      setSamplingList({
        id: conflict.samplingListId,
        recordNo: recordDetail.recordNo,
        date: recordDetail.date,
        teacherName: recordDetail.teacherName,
        amount: recordDetail.amount + 100,
        itemType: recordDetail.itemType,
        sceneDescription: '抽样场景描述示例',
        isOldFormat: false,
        importBatchId: 'BATCH-002',
        importedAt: recordDetail.createdAt,
        importedBy: '系统管理员',
      });
    } catch (error) {
      console.error('加载冲突详情失败:', error);
    }
  };

  const handleResolve = async (resolution: ConflictResolution) => {
    if (!selectedConflict) return;
    if (!resolutionNote.trim()) {
      alert('请填写处理意见');
      return;
    }
    setResolving(true);
    try {
      await api.resolveConflict(selectedConflict.id, resolution, resolutionNote);
      await loadConflicts();
      setSelectedConflict(null);
      setResolutionNote('');
    } catch (error) {
      console.error('处理冲突失败:', error);
      alert('处理失败，请重试');
    } finally {
      setResolving(false);
    }
  };

  const unresolvedConflicts = conflicts.filter((c) => !c.resolution);
  const resolvedConflicts = conflicts.filter((c) => c.resolution);

  const ConflictCard = ({ conflict }: { conflict: ConflictRecord }) => {
    const isSelected = selectedConflict?.id === conflict.id;
    const isResolved = !!conflict.resolution;

    return (
      <div
        key={conflict.id}
        className={cn(
          'border rounded-xl overflow-hidden transition-all cursor-pointer',
          isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200 hover:border-gray-300',
          isResolved && 'opacity-75'
        )}
        onClick={() => handleSelectConflict(conflict)}
      >
        <div className="p-4 bg-white">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className={cn(
                'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                isResolved ? 'bg-gray-100 text-gray-500' : 'bg-red-100 text-red-600'
              )}>
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-medium text-gray-900">
                    {conflict.recordId}
                  </span>
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
              <span className="px-2 py-1 bg-red-50 text-red-600 text-xs font-medium rounded-lg">
                待处理
              </span>
            )}
          </div>
        </div>

        {isSelected && (
          <div className="border-t border-gray-200 bg-gray-50 p-4">
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

      {loading ? (
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
                    操作人：{currentUser.name}
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
