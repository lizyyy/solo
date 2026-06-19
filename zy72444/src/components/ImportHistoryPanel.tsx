import { useState } from 'react';
import { History, ChevronDown, ChevronUp, Image, FileSpreadsheet, Repeat, Sparkles, CheckCircle, AlertCircle, Fingerprint, ArrowLeft, RefreshCw } from 'lucide-react';
import type { ImportSession, ImportResultStatus } from '@/types';
import { formatDateTime, getRoleLabel } from '@/utils';

interface ImportHistoryPanelProps {
  sessions: ImportSession[];
}

const statusColor: Record<ImportResultStatus, string> = {
  new: 'text-emerald-700 bg-emerald-100',
  'duplicate-this-session': 'text-amber-700 bg-amber-100',
  'duplicate-history': 'text-sky-700 bg-sky-100',
  updated: 'text-violet-700 bg-violet-100',
};
const statusLabel: Record<ImportResultStatus, string> = {
  new: '新增',
  'duplicate-this-session': '本次内部重复',
  'duplicate-history': '历史重复',
  updated: '备注已更新',
};

export default function ImportHistoryPanel({ sessions }: ImportHistoryPanelProps) {
  const [openId, setOpenId] = useState<string | null>(sessions[0]?.id || null);

  if (!sessions.length) {
    return (
      <div className="glass rounded-2xl p-6 border border-white/50 text-center">
        <History className="w-10 h-10 text-primary-300 mx-auto mb-3" />
        <p className="text-primary-500 text-sm">暂无导入历史</p>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl border border-white/50 overflow-hidden">
      <div className="px-5 py-4 border-b border-primary-100 flex items-center gap-2">
        <History className="w-5 h-5 text-primary-600" />
        <h3 className="font-display font-semibold text-primary-900">导入历史追溯</h3>
        <span className="ml-auto text-xs text-primary-400">共 {sessions.length} 次导入</span>
      </div>
      <div className="divide-y divide-primary-50">
        {sessions.map((s, idx) => {
          const open = openId === s.id;
          const Icon = s.sourceType === 'photo' ? Image : FileSpreadsheet;
          return (
            <div key={s.id}>
              <button
                onClick={() => setOpenId(open ? null : s.id)}
                className="w-full text-left px-5 py-3.5 hover:bg-primary-50/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${s.sourceType === 'photo' ? 'bg-primary-100 text-primary-600' : 'bg-violet-100 text-violet-700'}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-primary-900 text-sm truncate max-w-[220px]">{s.fileName}</p>
                      <span className="font-mono text-[10px] text-primary-400">#{s.id}</span>
                      {idx === 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium">
                          <Sparkles className="w-3 h-3" />
                          最新
                        </span>
                      )}
                      {s.isResameMaterialImport && (
                        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">
                          <RefreshCw className="w-3 h-3" />
                          同材料重复导入
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-primary-500 mt-0.5">
                      <span>{formatDateTime(s.importedAt)}</span>
                      <span>·</span>
                      <span>{getRoleLabel(s.importedBy)}</span>
                      <span>·</span>
                      <span>参数 {s.calcParamsVersion}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1 text-[10px] font-medium">
                      <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">+{s.newCount}</span>
                      <span className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-700">⟲{s.duplicateHistoryCount}</span>
                      <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">⇄{s.duplicateThisSessionCount}</span>
                    </div>
                    {open ? (
                      <ChevronUp className="w-4 h-4 text-primary-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-primary-400" />
                    )}
                  </div>
                </div>
              </button>
              {open && (
                <div className="px-5 pb-4 pt-1 animate-fade-in">
                  <div className="mb-3 space-y-2">
                    <div className="flex items-center gap-2 text-xs text-primary-500 bg-primary-50 px-3 py-2 rounded-lg">
                      <Fingerprint className="w-3.5 h-3.5 flex-shrink-0 text-primary-400" />
                      <span className="font-mono text-[11px]">材料指纹: {s.materialFingerprint}</span>
                    </div>
                    {s.isResameMaterialImport && s.priorSessionId && (
                      <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
                        <ArrowLeft className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>这是同材料第 2+ 次导入，首次导入会话为 <span className="font-mono font-medium">{s.priorSessionId}</span></span>
                      </div>
                    )}
                  </div>
                  <div className="rounded-xl border border-primary-100 divide-y divide-primary-50 overflow-hidden max-h-72 overflow-auto">
                    {s.details.map((d) => (
                      <div key={`${s.id}-${d.lineNo}-${d.dedupKey}`} className="flex items-start gap-3 p-3 text-xs">
                        <span className="font-mono text-primary-400 w-8 flex-shrink-0">L{d.lineNo}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-primary-800">{d.displayName}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusColor[d.status]}`}>
                              {statusLabel[d.status]}
                            </span>
                            {d.newRecordId && (
                              <span className="font-mono text-[10px] text-primary-400">→ 记录 {d.newRecordId}</span>
                            )}
                            {d.existingRecordId && (
                              <span className="font-mono text-[10px] text-sky-600">↩ 对应 {d.existingRecordId}</span>
                            )}
                          </div>
                          <p className="text-primary-500 mt-1 leading-relaxed">{d.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
