import { useState } from 'react';
import { Pin, Plus, Trash2, AlertCircle, CheckCircle, User, Clock, Edit3 } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { AnnotationType } from '@/types';

const ANNOTATION_TYPES: { type: AnnotationType; label: string; color: string }[] = [
  { type: 'lesion', label: '病灶', color: 'text-red-400' },
  { type: 'artifact', label: '伪影', color: 'text-yellow-400' },
  { type: 'note', label: '备注', color: 'text-blue-400' },
  { type: 'measurement', label: '测量', color: 'text-green-400' },
];

export const AnnotationPanel = () => {
  const {
    annotations,
    selectedSliceId,
    selectedAnnotationId,
    selectAnnotation,
    addAnnotation,
    updateAnnotation,
    deleteAnnotation,
    resolveAnnotationDrift,
    authorName,
    slices,
  } = useAppStore();

  const [isAdding, setIsAdding] = useState(false);
  const [newAnnotation, setNewAnnotation] = useState({
    type: 'lesion' as AnnotationType,
    description: '',
    x: 0.5,
    y: 0.5,
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState('');

  const selectedSlice = slices.find((s) => s.id === selectedSliceId);
  const sliceAnnotations = annotations.filter((a) => a.sliceId === selectedSliceId);

  const handleAddAnnotation = () => {
    if (!selectedSliceId || !newAnnotation.description.trim()) return;

    addAnnotation({
      sliceId: selectedSliceId,
      type: newAnnotation.type,
      description: newAnnotation.description,
      x: newAnnotation.x,
      y: newAnnotation.y,
      author: authorName,
      hasDrift: false,
      isResolved: false,
    });

    setNewAnnotation({ type: 'lesion', description: '', x: 0.5, y: 0.5 });
    setIsAdding(false);
  };

  const handleStartEdit = (annotation: typeof annotations[0]) => {
    setEditingId(annotation.id);
    setEditDescription(annotation.description);
  };

  const handleSaveEdit = (id: string) => {
    updateAnnotation(id, { description: editDescription });
    setEditingId(null);
    setEditDescription('');
  };

  const handleResolveDrift = (annotationId: string) => {
    const annotation = annotations.find((a) => a.id === annotationId);
    if (annotation) {
      resolveAnnotationDrift(annotationId, annotation.x, annotation.y);
    }
  };

  const getAnnotationTypeInfo = (type: AnnotationType) => {
    return ANNOTATION_TYPES.find((t) => t.type === type) || ANNOTATION_TYPES[0];
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="bg-slate-800/90 backdrop-blur-sm rounded-xl p-4 border border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-cyan-400 font-semibold text-sm flex items-center gap-2">
          <Pin className="w-4 h-4" />
          标注管理
        </h3>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className={`p-1.5 rounded-lg transition-all ${
            isAdding
              ? 'bg-cyan-500 text-white'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {isAdding && selectedSliceId && (
        <div className="mb-4 p-3 bg-slate-900/50 rounded-lg border border-cyan-500/30">
          <div className="text-xs text-slate-400 mb-2">添加新标注</div>
          <div className="space-y-2">
            <div className="flex gap-1">
              {ANNOTATION_TYPES.map((t) => (
                <button
                  key={t.type}
                  onClick={() => setNewAnnotation({ ...newAnnotation, type: t.type })}
                  className={`flex-1 px-2 py-1 rounded text-xs transition-all ${
                    newAnnotation.type === t.type
                      ? 'bg-cyan-500/20 border border-cyan-500 text-cyan-400'
                      : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={newAnnotation.description}
              onChange={(e) => setNewAnnotation({ ...newAnnotation, description: e.target.value })}
              placeholder="输入标注描述..."
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
            <div className="flex gap-2">
              <button
                onClick={handleAddAnnotation}
                disabled={!newAnnotation.description.trim()}
                className="flex-1 px-3 py-2 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                添加
              </button>
              <button
                onClick={() => setIsAdding(false)}
                className="px-3 py-2 bg-slate-700 text-slate-300 rounded-lg text-sm hover:bg-slate-600 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {!selectedSliceId ? (
        <div className="text-center py-8 text-slate-500 text-sm">
          <Pin className="w-8 h-8 mx-auto mb-2 opacity-50" />
          点击选择切片以查看标注
        </div>
      ) : sliceAnnotations.length === 0 ? (
        <div className="text-center py-8 text-slate-500 text-sm">
          <Pin className="w-8 h-8 mx-auto mb-2 opacity-50" />
          该切片暂无标注
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {sliceAnnotations.map((annotation) => {
            const typeInfo = getAnnotationTypeInfo(annotation.type);
            const isSelected = selectedAnnotationId === annotation.id;
            const isEditing = editingId === annotation.id;

            return (
              <div
                key={annotation.id}
                className={`p-3 rounded-lg cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-cyan-500/20 border border-cyan-500/50'
                    : 'bg-slate-700/50 hover:bg-slate-700 border border-transparent'
                } ${annotation.hasDrift ? 'border-l-2 border-l-yellow-500' : ''}`}
                onClick={() => selectAnnotation(annotation.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium ${typeInfo.color}`}>
                      {typeInfo.label}
                    </span>
                    {annotation.hasDrift && (
                      <AlertCircle className="w-3 h-3 text-yellow-400" />
                    )}
                    {annotation.isResolved && (
                      <CheckCircle className="w-3 h-3 text-green-400" />
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {annotation.hasDrift && !annotation.isResolved && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleResolveDrift(annotation.id);
                        }}
                        className="p-1 text-green-400 hover:bg-green-500/20 rounded"
                        title="修正漂移"
                      >
                        <CheckCircle className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartEdit(annotation);
                      }}
                      className="p-1 text-slate-400 hover:text-cyan-400 rounded"
                      title="编辑"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteAnnotation(annotation.id);
                      }}
                      className="p-1 text-slate-400 hover:text-red-400 rounded"
                      title="删除"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {isEditing ? (
                  <div className="mt-2">
                    <input
                      type="text"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex gap-1 mt-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSaveEdit(annotation.id);
                        }}
                        className="px-2 py-1 bg-cyan-500 text-white rounded text-xs"
                      >
                        保存
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingId(null);
                        }}
                        className="px-2 py-1 bg-slate-600 text-slate-300 rounded text-xs"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-300 text-sm mt-1">{annotation.description}</p>
                )}

                <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {annotation.author}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTime(annotation.timestamp)}
                  </span>
                </div>

                {annotation.hasDrift && !annotation.isResolved && (
                  <div className="mt-2 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded">
                    <div className="text-yellow-400 text-xs font-medium">漂移警告</div>
                    <div className="text-yellow-300/70 text-xs mt-1">
                      标注位置可能存在漂移，建议检查并确认位置准确性
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {selectedSlice && (
        <div className="mt-4 pt-4 border-t border-slate-700">
          <div className="text-xs text-slate-500">
            当前切片: <span className="text-slate-300 font-mono">#{selectedSlice.index.toString().padStart(2, '0')}</span>
          </div>
        </div>
      )}
    </div>
  );
};
