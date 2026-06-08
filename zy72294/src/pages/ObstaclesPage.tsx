import { useState } from 'react';
import { Edit, X, Clock, ChevronDown, ChevronUp, History, AlertTriangle, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store';
import StatusBadge from '@/components/StatusBadge';
import { cn } from '@/lib/utils';
import type * as T from '@/types';

type FilterType = 'all' | 'pending' | 'completed' | 'verify';

const filterLabels: Record<FilterType, string> = {
  all: '全部',
  pending: '待补充',
  completed: '已补充',
  verify: '需核实',
};

export default function ObstaclesPage() {
  const navigate = useNavigate();
  const {
    getUniqueRecords,
    getNoteForRecord,
    getReviewForRecord,
    updateObstacleNote,
    getHistoryForEntity,
    setSelectedRecordId,
  } = useAppStore();

  const [filter, setFilter] = useState<FilterType>('all');
  const [editingNote, setEditingNote] = useState<T.ObstacleNote | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editRecordId, setEditRecordId] = useState<string | null>(null);
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);

  const getStatus = (note: T.ObstacleNote | undefined): 'pending' | 'completed' | 'verify' => {
    if (!note) return 'pending';
    return note.status;
  };

  const uniqueRecords = getUniqueRecords();

  const filteredRecords = uniqueRecords.filter((record) => {
    const note = getNoteForRecord(record.id);
    const status = getStatus(note);
    if (filter === 'all') return true;
    return status === filter;
  });

  const handleEdit = (note: T.ObstacleNote, recordId: string) => {
    setEditingNote(note);
    setEditRecordId(recordId);
    setEditContent(note.content);
  };

  const handleSave = () => {
    if (editRecordId && editContent.trim()) {
      updateObstacleNote(editRecordId, editContent.trim(), '小陶');
      setEditingNote(null);
      setEditContent('');
      setEditRecordId(null);
    }
  };

  const handleCancel = () => {
    setEditingNote(null);
    setEditContent('');
    setEditRecordId(null);
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-industrial-900 mb-1">障碍物备注</h1>
          <p className="text-gray-500 text-sm">查看和编辑障碍物备注，历史修改可追溯</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-6">
        {Object.entries(filterLabels).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key as FilterType)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              filter === key
                ? 'bg-industrial-500 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filteredRecords.map((record) => {
          const note = getNoteForRecord(record.id);
          const status = getStatus(note);
          const review = getReviewForRecord(record.id);
          const histories = note ? getHistoryForEntity('obstacle_note', note.id) : [];
          const isExpanded = expandedHistory === record.id;
          const isOccludedPending = record.alarmOccluded && review?.reviewStatus === 'pending';

          return (
            <div key={record.id} className="bg-white rounded-lg border border-gray-200 shadow-card overflow-hidden">
              {isOccludedPending && (
                <div className="px-6 py-3 bg-warning-50 border-b border-warning-200 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-warning-700 text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="font-medium">移动端截图遮挡告警标签</span>
                    <span className="text-warning-500">— 需施工经理复核后才能归为正常，请勿提前标记完成</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/review')}
                    className="px-3 py-1 text-xs font-medium bg-warning-500 text-white rounded hover:bg-warning-600 transition-colors"
                  >
                    前往复核
                  </button>
                </div>
              )}

              <div className="p-6">
                <div className="flex items-start gap-4">
                  <div className={cn(
                    "w-20 h-20 rounded-lg overflow-hidden flex items-center justify-center shrink-0",
                    record.alarmOccluded ? "bg-warning-100" : "bg-gray-200"
                  )}>
                    {record.alarmOccluded ? (
                      <AlertTriangle className="w-8 h-8 text-warning-500" />
                    ) : (
                      <span className="text-xs text-gray-500">截图</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <p className="font-medium text-gray-900">
                        测距点 ({record.pointX}, {record.pointY})
                      </p>
                      <span className="font-mono text-sm text-gray-500">{record.distance}m</span>
                      {record.alarmOccluded && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-warning-100 text-warning-700">
                          遮挡告警
                        </span>
                      )}
                      <StatusBadge status={status} />
                    </div>
                    <p className="text-sm text-gray-700 line-clamp-2">
                      {note?.content || <span className="text-gray-400 italic">暂无备注，请点击编辑补充</span>}
                    </p>
                    {note?.updatedAt && note.updatedBy && (
                      <p className="text-xs text-gray-400 mt-2">
                        最后更新：{note.updatedBy} · {formatTime(note.updatedAt)}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-3 shrink-0">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setExpandedHistory(isExpanded ? null : record.id)}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <History className="w-4 h-4" />
                        历史对比
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEdit(note || { id: '', recordId: record.id, content: '', status: 'pending' as const, updatedAt: '', updatedBy: '' }, record.id)}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-industrial-600 hover:bg-industrial-50 rounded-lg transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                        编辑
                      </button>
                    </div>
                  </div>
                </div>

                {isExpanded && histories.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      变更历史（改前/改后）
                    </p>
                    <div className="space-y-3">
                      {histories.map((h) => (
                        <div key={h.id}>
                          <p className="text-xs text-gray-400 mb-1">
                            {h.operator} · {formatTime(h.operatedAt)} · {h.fieldName}
                          </p>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-red-50 rounded-lg p-3 border border-red-100">
                              <p className="text-xs text-red-500 mb-1">改前</p>
                              <p className="text-sm text-red-800">{h.oldValue || '(空)'}</p>
                            </div>
                            <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                              <p className="text-xs text-green-500 mb-1">改后</p>
                              <p className="text-sm text-green-800">{h.newValue || '(空)'}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {isExpanded && histories.length === 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-sm text-gray-400 text-center">暂无变更历史</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {editingNote && editRecordId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-industrial-900">编辑障碍物备注</h3>
              <button onClick={handleCancel} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              {(() => {
                const record = uniqueRecords.find((r) => r.id === editRecordId);
                const review = getReviewForRecord(editRecordId);
                const isOccludedPending = record?.alarmOccluded && review?.reviewStatus === 'pending';
                return isOccludedPending ? (
                  <div className="mb-4 p-3 bg-warning-50 border border-warning-200 rounded-lg text-sm text-warning-700">
                    <AlertTriangle className="w-4 h-4 inline mr-1" />
                    此记录截图遮挡告警标签，保存后备注状态将为"需核实"，待施工经理复核后才能标记为已完成。
                  </div>
                ) : null;
              })()}
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full h-40 p-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-industrial-500 resize-none"
                placeholder="请输入障碍物备注..."
              />
              <div className="flex justify-end gap-3 mt-4">
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  disabled={!editContent.trim()}
                  className="px-4 py-2 text-sm bg-industrial-500 text-white rounded-lg hover:bg-industrial-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
