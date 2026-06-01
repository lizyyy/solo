import { useState } from 'react';
import { format } from 'date-fns';
import { Plus, MessageSquare, TrendingUp, AlertTriangle } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { compareNoteImpact } from '../../utils/diffComparator';
import { ASSESSMENT_LABELS, UNIT_LABELS } from '../../types';
import type { Note, NoisePredictionResult } from '../../types';

export const NotePanel = () => {
  const { currentBatchId, batches, addNoteToBatch } = useAppStore();
  const currentBatch = batches.find((b) => b.id === currentBatchId);

  const [isAdding, setIsAdding] = useState(false);
  const [noteContent, setNoteContent] = useState('');

  const handleAddNote = () => {
    if (!currentBatchId || !noteContent.trim()) return;

    const note: Note = {
      id: Math.random().toString(36).substring(2, 11),
      batchId: currentBatchId,
      timestamp: Date.now(),
      content: noteContent,
      author: '老岑',
      previousResultSnapshot: currentBatch?.result ? { ...currentBatch.result } : undefined,
    };

    addNoteToBatch(currentBatchId, note);
    setNoteContent('');
    setIsAdding(false);
  };

  if (!currentBatch) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center text-slate-400">
        <MessageSquare className="w-10 h-10 mx-auto mb-2" />
        <p>请先选择一个批次</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-indigo-700 to-indigo-600 px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-white font-semibold">维修师傅备注</h3>
              <p className="text-indigo-200 text-sm">补录工况与观察记录</p>
            </div>
          </div>
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 text-white rounded-lg text-sm hover:bg-white/30 transition-all"
          >
            <Plus className="w-4 h-4" />
            补录备注
          </button>
        </div>
      </div>

      <div className="p-5">
        {isAdding && (
          <div className="mb-4 p-4 bg-indigo-50 rounded-lg border border-indigo-200 animate-in slide-in-from-top duration-200">
            <textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="输入备注内容，如：爬升阶段旋翼负载较大..."
              className="w-full px-4 py-3 border border-slate-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              rows={3}
            />
            {currentBatch.result && (
              <p className="text-xs text-indigo-600 mt-2 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                补录时将自动记录当前结果快照（{currentBatch.result.overallNoiseLevel.toFixed(1)}
                {UNIT_LABELS[currentBatch.result.unit]}，{ASSESSMENT_LABELS[currentBatch.result.assessment]}），
                便于后续对比补录前后差异
              </p>
            )}
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={handleAddNote}
                disabled={!noteContent.trim()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition-all disabled:opacity-50"
              >
                确认补录
              </button>
              <button
                onClick={() => { setIsAdding(false); setNoteContent(''); }}
                className="px-4 py-2 border border-slate-300 text-slate-600 rounded-lg text-sm hover:bg-slate-50 transition-all"
              >
                取消
              </button>
            </div>
          </div>
        )}

        {currentBatch.notes.length === 0 ? (
          <p className="text-center text-slate-400 py-6">暂无备注记录</p>
        ) : (
          <div className="space-y-3">
            {[...currentBatch.notes].reverse().map((note, idx) => {
              const impact = compareNoteImpact(
                note.previousResultSnapshot,
                currentBatch.result
              );

              return (
                <div
                  key={note.id}
                  className="p-4 rounded-lg border border-slate-200 bg-slate-50 hover:border-indigo-200 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm text-slate-800">{note.author}</span>
                        <span className="text-xs text-slate-400">
                          {format(new Date(note.timestamp), 'MM-dd HH:mm:ss')}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600">{note.content}</p>
                    </div>
                  </div>

                  {note.previousResultSnapshot && impact && impact.impact !== 'none' && (
                    <div className={`mt-2 p-2 rounded text-xs ${
                      impact.impact === 'critical' ? 'bg-red-50 text-red-700 border border-red-100' :
                      impact.impact === 'major' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                      'bg-blue-50 text-blue-700 border border-blue-100'
                    }`}>
                      <div className="flex items-center gap-1">
                        {impact.impact === 'critical' ? (
                          <AlertTriangle className="w-3 h-3" />
                        ) : (
                          <TrendingUp className="w-3 h-3" />
                        )}
                        {impact.summary}
                      </div>
                      {impact.diffs.filter((d) => d.significance === 'high').map((diff, dIdx) => (
                        <div key={dIdx} className="mt-1 ml-4">
                          {diff.field}: {String(diff.oldValue)} → {String(diff.newValue)}
                        </div>
                      ))}
                    </div>
                  )}

                  {note.previousResultSnapshot && (
                    <div className="mt-2 text-xs text-slate-400 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      补录时快照: {note.previousResultSnapshot.overallNoiseLevel.toFixed(1)}
                      {UNIT_LABELS[note.previousResultSnapshot.unit]}（
                      {ASSESSMENT_LABELS[note.previousResultSnapshot.assessment]}）
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
};
