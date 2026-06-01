import { useState } from 'react';
import { X, AlertTriangle, Clock, User, Plus, MapPin, FileText, Sparkles } from 'lucide-react';
import type { DataRecord, SourceType } from '@/types';
import { formatDateTime } from '@/utils/data';
import { useAppStore } from '@/store/appStore';

const sourceTypeLabels: Record<SourceType, { label: string; icon: typeof MapPin; color: string }> = {
  gis: { label: 'GIS 系统', icon: MapPin, color: 'text-blue-400' },
  inspection: { label: '巡检平板', icon: FileText, color: 'text-amber-400' },
  excel: { label: '临时 Excel', icon: FileText, color: 'text-emerald-400' },
  manual: { label: '手动录入', icon: FileText, color: 'text-slate-400' },
};

interface TracePanelProps {
  record: DataRecord
  onClose: () => void
}

export default function TracePanel({ record, onClose }: TracePanelProps) {
  const [newNote, setNewNote] = useState('');
  const addNote = useAppStore(s => s.addNote);
  const supplementalDiff = useAppStore(s => s.supplementalDiff);

  const sourceInfo = sourceTypeLabels[record.source.type];
  const SourceIcon = sourceInfo.icon;
  const diff = supplementalDiff[record.id];

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    addNote(record.id, newNote.trim());
    setNewNote('');
  };

  return (
    <div className="h-full bg-[#1a1f36] border-l border-slate-700/50 flex flex-col w-full">
      <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-white flex items-center gap-2">
            {record.anomaly.isAnomaly && (
              <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 text-[10px] rounded border border-red-500/30 flex items-center gap-1">
                <AlertTriangle size={10} />
                异常
              </span>
            )}
            {record.mapped.label || `记录 #${record.id.slice(0, 6)}`}
          </h3>
          <p className="text-[10px] text-slate-500 mt-0.5 font-mono">ID: {record.id}</p>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-slate-700/50 rounded-md">
          <X size={16} className="text-slate-400" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {record.anomaly.isAnomaly && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            <div className="flex items-center gap-2 text-red-400 text-xs font-medium mb-1">
              <AlertTriangle size={12} />
              异常信息
            </div>
            <div className="text-xs text-slate-300">{record.anomaly.anomalyType}</div>
            <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
              <Clock size={10} />
              检测于 {formatDateTime(record.anomaly.detectedAt!)}
            </div>
          </div>
        )}

        <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
          <div className="text-xs text-slate-400 mb-2 font-medium">希腊值数据</div>
          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
            <div className="flex justify-between">
              <span className="text-slate-500">Delta:</span>
              <span className="text-slate-200">{(record.mapped.delta as number)?.toFixed(4)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Gamma:</span>
              <span className="text-slate-200">{(record.mapped.gamma as number)?.toFixed(4)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Theta:</span>
              <span className="text-slate-200">{(record.mapped.theta as number)?.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Vega:</span>
              <span className="text-slate-200">{(record.mapped.vega as number)?.toFixed(2)}</span>
            </div>
            {record.mapped.strike !== undefined && (
              <div className="flex justify-between">
                <span className="text-slate-500">行权价:</span>
                <span className="text-slate-200">{record.mapped.strike}</span>
              </div>
            )}
            {record.mapped.maturity && (
              <div className="flex justify-between">
                <span className="text-slate-500">到期:</span>
                <span className="text-slate-200">{String(record.mapped.maturity)}</span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
          <div className="text-xs text-slate-400 mb-2 font-medium">原始数据行</div>
          <div className="text-[10px] font-mono text-slate-400 overflow-x-auto">
            {JSON.stringify(record.raw, null, 2)}
          </div>
        </div>

        <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
          <div className="text-xs text-slate-400 mb-2 font-medium flex items-center gap-1.5">
            <SourceIcon size={12} className={sourceInfo.color} />
            来源信息
          </div>
          <div className="space-y-1.5 text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-500">来源类型:</span>
              <span className={sourceInfo.color}>{sourceInfo.label}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">文件名:</span>
              <span className="text-slate-300 font-mono">{record.source.fileName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">原始备注:</span>
              <span className="text-slate-300">{record.source.originalNotes}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">导入时间:</span>
              <span className="text-slate-400">{formatDateTime(record.source.importTime)}</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
          <div className="text-xs text-slate-400 mb-3 font-medium flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <User size={12} />
              处理备注
              {diff && (
                <span className="ml-2 px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-[9px] rounded border border-amber-500/30">
                  补录后 {record.notes.length - diff.beforeNoteCount} 条新增
                </span>
              )}
            </span>
          </div>

          {record.notes.length === 0 ? (
            <div className="text-[11px] text-slate-500 text-center py-4">
              暂无备注，补录一条吧
            </div>
          ) : (
            <div className="space-y-2">
              {record.notes.map((note, idx) => (
                <div key={note.id} className="bg-slate-800/50 rounded-md p-2.5 border border-slate-700/30">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <User size={10} />
                      {note.author}
                    </span>
                    <div className="flex items-center gap-2">
                      {note.isSupplemental && (
                        <span className="px-1 py-0.5 bg-cyan-500/20 text-cyan-400 text-[9px] rounded border border-cyan-500/30">
                          补录
                        </span>
                      )}
                      {idx >= (diff?.beforeNoteCount || 0) && diff && (
                        <span className="px-1 py-0.5 bg-amber-500/20 text-amber-400 text-[9px] rounded border border-amber-500/30 flex items-center gap-0.5">
                          <Sparkles size={9} />
                          NEW
                        </span>
                      )}
                      <span className="text-[9px] text-slate-500 flex items-center gap-0.5">
                        <Clock size={9} />
                        {formatDateTime(note.createdAt)}
                      </span>
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-300 leading-relaxed">{note.content}</div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-3 pt-3 border-t border-slate-700/30">
            <div className="flex gap-2">
              <input
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddNote()}
                placeholder="补录备注（会带到导出报告里）..."
                className="flex-1 bg-slate-900/50 border border-slate-700/50 rounded-md px-2.5 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50"
              />
              <button
                onClick={handleAddNote}
                disabled={!newNote.trim()}
                className="px-3 py-2 bg-cyan-500/20 text-cyan-400 text-xs rounded-md border border-cyan-500/30 hover:bg-cyan-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <Plus size={12} />
                追加
              </button>
            </div>
            {diff && (
              <div className="mt-2 text-[10px] text-amber-400/80 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1">
                ⚠ 这条记录在"先跑一小包材料"后有补录，导出报告时会标注差异
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
