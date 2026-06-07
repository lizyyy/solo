import { Edit3, User } from 'lucide-react';
import type { NoteHistory } from '@/types';
import { diffContent, formatDateTime, getRoleLabel } from '@/utils';

interface NoteHistoryListProps {
  histories: NoteHistory[];
}

export default function NoteHistoryList({ histories }: NoteHistoryListProps) {
  if (histories.length === 0) {
    return (
      <div className="glass rounded-2xl p-6 border border-white/50 text-center">
        <Edit3 className="w-10 h-10 text-primary-300 mx-auto mb-3" />
        <p className="text-primary-500">暂无备注修改记录</p>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl p-6 border border-white/50">
      <h3 className="font-display text-lg font-semibold text-primary-900 mb-6 flex items-center gap-2">
        <Edit3 className="w-5 h-5 text-primary-600" />
        备注修改历史
      </h3>
      <div className="space-y-4">
        {histories.map((history) => {
          const diffs = diffContent(history.oldContent || '(空)', history.newContent || '(空)');
          return (
            <div
              key={history.id}
              className="p-4 bg-white/70 rounded-xl border border-primary-100 animate-fade-in"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-primary-500" />
                  <span className="text-sm font-medium text-primary-700">
                    {getRoleLabel(history.modifiedBy)}
                  </span>
                </div>
                <span className="text-xs text-primary-400">
                  {formatDateTime(history.modifiedAt)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-primary-500 mb-1.5">修改前</p>
                  <div className="p-3 bg-red-50 rounded-lg text-sm border border-red-100">
                    {diffs.map((seg, idx) =>
                      seg.type === 'removed' ? (
                        <span key={idx} className="line-through text-red-600 bg-red-100 px-0.5 rounded">
                          {seg.content}
                        </span>
                      ) : seg.type === 'same' ? (
                        <span key={idx} className="text-primary-600">
                          {seg.content}
                        </span>
                      ) : null
                    )}
                    {!history.oldContent && <span className="text-primary-400 italic">(空)</span>}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-primary-500 mb-1.5">修改后</p>
                  <div className="p-3 bg-emerald-50 rounded-lg text-sm border border-emerald-100">
                    {diffs.map((seg, idx) =>
                      seg.type === 'added' ? (
                        <span key={idx} className="text-emerald-700 bg-emerald-100 px-0.5 rounded font-medium">
                          {seg.content}
                        </span>
                      ) : seg.type === 'same' ? (
                        <span key={idx} className="text-primary-600">
                          {seg.content}
                        </span>
                      ) : null
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
