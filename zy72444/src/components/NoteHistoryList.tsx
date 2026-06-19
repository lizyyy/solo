import { Edit3, User, ArrowRight, Sparkles, Upload, MousePointer } from 'lucide-react';
import type { NoteHistory } from '@/types';
import { diffContent, formatDateTime } from '@/utils';

interface NoteHistoryListProps {
  histories: NoteHistory[];
  onLocate?: (recordId: string) => void;
}

export default function NoteHistoryList({ histories, onLocate }: NoteHistoryListProps) {
  if (histories.length === 0) {
    return (
      <div className="glass rounded-2xl p-6 border border-white/50 text-center">
        <Edit3 className="w-10 h-10 text-primary-300 mx-auto mb-3" />
        <p className="text-primary-500 text-sm">暂无备注修改记录</p>
        <p className="text-xs text-primary-400 mt-1">当版权运营小鹿修改备注时，会在此显示谁、改了什么、影响了哪些结果字段</p>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl p-6 border border-white/50">
      <h3 className="font-display text-lg font-semibold text-primary-900 mb-5 flex items-center gap-2">
        <Edit3 className="w-5 h-5 text-primary-600" />
        备注变更历史
        <span className="text-xs font-sans font-normal text-primary-400 ml-1">
          （可追溯谁改了什么、影响哪条结果）
        </span>
      </h3>
      <div className="space-y-4">
        {histories.map((history) => {
          const diffs = diffContent(history.oldContent || '(空)', history.newContent || '(空)');
          return (
            <div
              key={history.id}
              className="p-4 bg-white/70 rounded-xl border border-primary-100 animate-fade-in"
            >
              <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary-100 text-primary-700 text-xs font-medium">
                    <User className="w-3 h-3" />
                    {history.operatorName}
                  </div>
                  <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                    history.source === 'import'
                      ? 'bg-violet-100 text-violet-700'
                      : 'bg-slate-100 text-slate-700'
                  }`}>
                    {history.source === 'import' ? (
                      <><Upload className="w-3 h-3" />导入触发</>
                    ) : (
                      <><MousePointer className="w-3 h-3" />手动修改</>
                    )}
                  </div>
                  <span className="text-xs text-primary-400 font-mono">{history.id}</span>
                  {history.importSessionId && (
                    <span className="text-xs text-violet-500 font-mono">
                      会话: {history.importSessionId}
                    </span>
                  )}
                  <span className="text-xs text-primary-400">
                    {formatDateTime(history.modifiedAt)}
                  </span>
                  {onLocate && (
                    <button
                      onClick={() => onLocate(history.recordId)}
                      className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-accent-50 text-accent-700 hover:bg-accent-100 transition-colors"
                    >
                      <ArrowRight className="w-3 h-3" />
                      定位到记录 {history.recordId}
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <p className="text-xs text-primary-500 mb-1.5">修改前</p>
                  <div className="p-3 bg-red-50 rounded-lg text-sm border border-red-100 min-h-[44px]">
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
                    {!history.oldContent && (
                      <span className="text-primary-400 italic">(空)</span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-primary-500 mb-1.5">修改后</p>
                  <div className="p-3 bg-emerald-50 rounded-lg text-sm border border-emerald-100 min-h-[44px]">
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

              <div className="pt-3 border-t border-primary-100">
                <p className="text-xs text-primary-500 mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-accent-500" />
                  本次变更影响以下结果字段：
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {history.affectedResultFields.map((f) => (
                    <span
                      key={f}
                      className="inline-flex items-center px-2 py-0.5 rounded-full bg-accent-50 text-accent-700 text-[11px] font-medium border border-accent-100"
                    >
                      ▶ {f}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
