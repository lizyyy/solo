import { useState, useMemo } from 'react';
import { useAppStore } from '@/store';
import {
  formatTime,
  PROBLEM_TYPE_LABELS,
  CONFIRMATION_STATUS_LABELS,
  SOURCE_TYPE_LABELS,
  INSTRUMENT_LABELS,
  ProblemType,
  ConfirmationStatus,
} from '@/types';
import {
  Check,
  X,
  MessageSquare,
  Plus,
  Play,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  User,
  UserCircle,
} from 'lucide-react';

type SortField = 'time' | 'deviationCents' | 'confidence' | 'createdAt';
type SortOrder = 'asc' | 'desc';

export function MisnoteList() {
  const {
    filteredMisnotes,
    misnotes,
    voiceParts,
    selectedMisnoteId,
    selectMisnote,
    seekToTime,
    confirmMisnote,
    rejectMisnote,
    addComment,
    comments,
    isPlaying,
    addManualMisnote,
    playbackTime,
  } = useAppStore();

  const [sortField, setSortField] = useState<SortField>('time');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [selectedForComment, setSelectedForComment] = useState<string | null>(null);

  const sortedMisnotes = useMemo(() => {
    return [...filteredMisnotes].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'time':
          comparison = a.time - b.time;
          break;
        case 'deviationCents':
          comparison = a.deviationCents - b.deviationCents;
          break;
        case 'confidence':
          comparison = a.confidence - b.confidence;
          break;
        case 'createdAt':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [filteredMisnotes, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 text-xs font-medium text-primary-400 hover:text-primary-200 transition-colors"
    >
      {label}
      {sortField === field ? (
        sortOrder === 'asc' ? (
          <ChevronUp size={12} />
        ) : (
          <ChevronDown size={12} />
        )
      ) : (
        <ArrowUpDown size={12} className="opacity-50" />
      )}
    </button>
  );

  const getVoicePart = (voicePartId: string) => {
    return voiceParts.find((v) => v.id === voicePartId);
  };

  const getMisnoteComments = (misnoteId: string) => {
    return comments.filter((c) => c.misnoteId === misnoteId);
  };

  const handleAddManual = () => {
    addManualMisnote({
      time: playbackTime,
      problemType: 'noise_misjudgment',
    });
    setShowAddForm(false);
  };

  const handleSubmitComment = (misnoteId: string) => {
    if (newComment.trim()) {
      addComment(misnoteId, newComment.trim(), '李老师', true);
      setNewComment('');
      setSelectedForComment(null);
    }
  };

  const problemTypeColor = (type: ProblemType) => {
    switch (type) {
      case 'voice_overlap':
        return 'bg-problem-overlap';
      case 'section_misalignment':
        return 'bg-problem-misalignment';
      case 'noise_misjudgment':
        return 'bg-problem-noise';
    }
  };

  const statusBgColor = (status: ConfirmationStatus) => {
    switch (status) {
      case 'confirmed':
        return 'bg-status-confirmed/20 border-status-confirmed/50';
      case 'rejected':
        return 'bg-status-rejected/20 border-status-rejected/50';
      case 'pending':
        return 'bg-status-pending/20 border-status-pending/50';
    }
  };

  return (
    <div className="h-full flex flex-col bg-primary-900 border-l border-primary-700">
      <div className="p-4 border-b border-primary-700">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-primary-100">错音列表</span>
            <span className="text-xs bg-primary-700 px-2 py-0.5 rounded font-mono">
              {filteredMisnotes.length} / {misnotes.length}
            </span>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1 text-xs btn-secondary py-1.5 px-3"
          >
            <Plus size={14} />
            人工补录
          </button>
        </div>

        {showAddForm && (
          <div className="mb-3 p-3 bg-primary-800 rounded-lg border border-primary-600 animate-fade-in">
            <div className="text-sm text-primary-200 mb-2">
              在当前位置 <span className="font-mono">{formatTime(playbackTime)}</span>{' '}
              添加错音标记
            </div>
            <div className="flex gap-2">
              <button onClick={handleAddManual} className="btn-primary text-xs py-1.5">
                确认添加
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="btn-secondary text-xs py-1.5"
              >
                取消
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-12 gap-2 px-2 py-2 text-xs border-b border-primary-700">
          <div className="col-span-2">
            <SortHeader field="time" label="时间" />
          </div>
          <div className="col-span-2">声部</div>
          <div className="col-span-2">问题类型</div>
          <div className="col-span-1 text-center">音高</div>
          <div className="col-span-2">
            <SortHeader field="deviationCents" label="偏差" />
          </div>
          <div className="col-span-1">
            <SortHeader field="confidence" label="置信度" />
          </div>
          <div className="col-span-2 text-right">操作</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {sortedMisnotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-primary-500">
            <MessageSquare size={48} className="mb-3 opacity-30" />
            <p>当前筛选条件下没有错音标记</p>
          </div>
        ) : (
          <div className="divide-y divide-primary-800">
            {sortedMisnotes.map((misnote) => {
              const voicePart = getVoicePart(misnote.voicePartId);
              const misnoteComments = getMisnoteComments(misnote.id);
              const isSelected = misnote.id === selectedMisnoteId;
              const isCommenting = selectedForComment === misnote.id;

              return (
                <div
                  key={misnote.id}
                  className={`p-3 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-primary-700/50'
                      : 'hover:bg-primary-800/50'
                  }`}
                  onClick={() => {
                    selectMisnote(misnote.id);
                    seekToTime(misnote.time, true);
                  }}
                >
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-2">
                      <span className="font-mono text-sm text-primary-200">
                        {formatTime(misnote.time)}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <div className="flex items-center gap-1">
                        <span className="text-sm text-primary-200">
                          {voicePart?.name || '-'}
                        </span>
                        {voicePart && (
                          <span className="text-xs text-primary-500">
                            ({INSTRUMENT_LABELS[voicePart.instrument]})
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="col-span-2">
                      <div className="flex items-center gap-1.5">
                        <div
                          className={`w-2.5 h-2.5 rounded-full ${problemTypeColor(
                            misnote.problemType
                          )}`}
                        />
                        <span className="text-xs text-primary-300">
                          {PROBLEM_TYPE_LABELS[misnote.problemType]}
                        </span>
                      </div>
                    </div>
                    <div className="col-span-1 text-center">
                      <span className="font-mono text-xs text-primary-300">
                        {misnote.actualPitch}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span
                        className={`font-mono text-sm ${
                          misnote.deviationCents > 100
                            ? 'text-problem-misalignment'
                            : misnote.deviationCents > 50
                            ? 'text-problem-overlap'
                            : 'text-primary-300'
                        }`}
                      >
                        {misnote.deviationCents.toFixed(0)}¢
                      </span>
                    </div>
                    <div className="col-span-1">
                      <div className="w-full bg-primary-700 rounded-full h-1.5">
                        <div
                          className="bg-primary-400 h-1.5 rounded-full"
                          style={{ width: `${misnote.confidence * 100}%` }}
                        />
                      </div>
                    </div>
                    <div className="col-span-2 flex items-center justify-end gap-1">
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded border ${statusBgColor(
                          misnote.confirmationStatus
                        )}`}
                      >
                        {CONFIRMATION_STATUS_LABELS[misnote.confirmationStatus]}
                      </span>
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded ${
                          misnote.sourceType === 'system'
                            ? 'tag-system'
                            : 'tag-manual'
                        }`}
                      >
                        {SOURCE_TYPE_LABELS[misnote.sourceType]}
                      </span>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="mt-3 pt-3 border-t border-primary-700 animate-slide-up">
                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div className="text-xs">
                          <span className="text-primary-500">预期音高:</span>{' '}
                          <span className="font-mono text-primary-200">
                            {misnote.expectedPitch}
                          </span>
                        </div>
                        <div className="text-xs">
                          <span className="text-primary-500">实际音高:</span>{' '}
                          <span className="font-mono text-primary-200">
                            {misnote.actualPitch}
                          </span>
                        </div>
                        <div className="text-xs">
                          <span className="text-primary-500">偏差:</span>{' '}
                          <span className="font-mono text-problem-misalignment">
                            {misnote.deviationCents.toFixed(1)} 音分
                          </span>
                        </div>
                        <div className="text-xs">
                          <span className="text-primary-500">置信度:</span>{' '}
                          <span className="font-mono text-primary-200">
                            {(misnote.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="text-xs">
                          <span className="text-primary-500">持续时间:</span>{' '}
                          <span className="font-mono text-primary-200">
                            {misnote.duration.toFixed(3)}s
                          </span>
                        </div>
                        <div className="text-xs">
                          <span className="text-primary-500">学生:</span>{' '}
                          <span className="text-primary-200">
                            {voicePart?.studentName || '-'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mb-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            confirmMisnote(misnote.id);
                          }}
                          disabled={misnote.confirmationStatus === 'confirmed'}
                          className="flex items-center gap-1 btn-success text-xs py-1.5 px-3 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Check size={14} />
                          确认
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            rejectMisnote(misnote.id);
                          }}
                          disabled={misnote.confirmationStatus === 'rejected'}
                          className="flex items-center gap-1 btn-danger text-xs py-1.5 px-3 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <X size={14} />
                          驳回
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedForComment(
                              isCommenting ? null : misnote.id
                            );
                          }}
                          className={`flex items-center gap-1 text-xs py-1.5 px-3 rounded-lg border transition-colors ${
                            isCommenting
                              ? 'bg-primary-600 border-primary-500 text-white'
                              : 'bg-primary-800 border-primary-600 text-primary-200 hover:bg-primary-700'
                          }`}
                        >
                          <MessageSquare size={14} />
                          备注 ({misnoteComments.length})
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            seekToTime(misnote.time, !isPlaying);
                          }}
                          className="flex items-center gap-1 btn-secondary text-xs py-1.5 px-3"
                        >
                          <Play size={14} />
                          播放
                        </button>
                      </div>

                      {isCommenting && (
                        <div className="mb-3 p-3 bg-primary-800 rounded-lg border border-primary-600">
                          <textarea
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder="输入点评备注..."
                            className="input w-full text-sm mb-2 resize-none"
                            rows={2}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSubmitComment(misnote.id);
                              }}
                              className="btn-primary text-xs py-1.5"
                            >
                              发送
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedForComment(null);
                                setNewComment('');
                              }}
                              className="btn-secondary text-xs py-1.5"
                            >
                              取消
                            </button>
                          </div>
                        </div>
                      )}

                      {misnoteComments.length > 0 && (
                        <div className="space-y-2">
                          {misnoteComments.map((comment) => (
                            <div
                              key={comment.id}
                              className="p-2 bg-primary-800/50 rounded-lg text-sm"
                            >
                              <div className="flex items-center gap-1.5 mb-1">
                                {comment.authorType === 'teacher' ? (
                                  <UserCircle
                                    size={14}
                                    className="text-primary-400"
                                  />
                                ) : (
                                  <User size={14} className="text-primary-500" />
                                )}
                                <span className="font-medium text-primary-200">
                                  {comment.authorName}
                                </span>
                                <span className="text-xs text-primary-500">
                                  {comment.authorType === 'teacher'
                                    ? '老师'
                                    : '学生'}
                                </span>
                                <span className="ml-auto text-xs text-primary-500">
                                  {new Date(
                                    comment.createdAt
                                  ).toLocaleString('zh-CN', {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </div>
                              <p className="text-primary-300 text-sm pl-5">
                                {comment.content}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
