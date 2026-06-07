import { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { StatusBadge } from '@/components/StatusBadge';
import { BookOpen, Plus, Clock, AlertCircle, Link, FileText } from 'lucide-react';

export function ThresholdNotes() {
  const { thresholdNotes, trainingLogs, addThresholdNote, getLogsByNoteId } = useAppStore();
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedLogIds, setSelectedLogIds] = useState<string[]>([]);
  const [content, setContent] = useState('');
  const [isLateArrival, setIsLateArrival] = useState(true);
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);

  const handleSubmit = () => {
    if (selectedLogIds.length === 0 || !content.trim()) return;
    addThresholdNote(selectedLogIds, content, isLateArrival);
    setShowAddForm(false);
    setSelectedLogIds([]);
    setContent('');
  };

  const toggleLogSelection = (logId: string) => {
    setSelectedLogIds((prev) =>
      prev.includes(logId) ? prev.filter((id) => id !== logId) : [...prev, logId]
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BookOpen size={24} className="text-amber-400" />
            阈值调参笔记
          </h1>
          <p className="text-slate-400 text-sm mt-1">管理阈值调参笔记，支持晚到材料补录，仅刷新关联明细不覆盖已确认内容</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors"
        >
          <Plus size={16} />
          添加笔记
        </button>
      </div>

      {showAddForm && (
        <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white">添加阈值调参笔记</h3>

          <div className="space-y-2">
            <label className="text-sm text-slate-400">关联训练日志（可多选）</label>
            <div className="max-h-48 overflow-y-auto bg-slate-900/50 rounded-lg border border-slate-700 divide-y divide-slate-700/50">
              {trainingLogs.map((log) => (
                <label
                  key={log.id}
                  className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${
                    selectedLogIds.includes(log.id) ? 'bg-amber-900/30' : 'hover:bg-slate-800/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedLogIds.includes(log.id)}
                    onChange={() => toggleLogSelection(log.id)}
                    className="rounded border-slate-600 bg-slate-700 text-amber-500 focus:ring-amber-500"
                  />
                  <code className="text-xs font-mono text-blue-400 bg-blue-900/30 px-1.5 py-0.5 rounded">
                    L{log.originalLineNumber}
                  </code>
                  <span className="text-sm text-slate-300">Epoch {log.epoch}</span>
                  <span className="text-xs text-slate-500">总指标 {(log.overallMetric * 100).toFixed(1)}%</span>
                  <StatusBadge status={log.status} isBoundaryCase={log.isBoundaryCase} />
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-slate-400">笔记内容</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm resize-none focus:outline-none focus:border-amber-500"
              placeholder="请输入阈值调参笔记内容..."
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isLateArrival}
                onChange={(e) => setIsLateArrival(e.target.checked)}
                className="rounded border-slate-600 bg-slate-700 text-amber-500 focus:ring-amber-500"
              />
              <span className="text-sm text-slate-300">标记为晚到材料</span>
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSubmit}
              disabled={selectedLogIds.length === 0 || !content.trim()}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition-colors"
            >
              提交
            </button>
            <button
              onClick={() => {
                setShowAddForm(false);
                setSelectedLogIds([]);
                setContent('');
              }}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {thresholdNotes.map((note) => {
          const linkedLogs = getLogsByNoteId(note.id);
          const isExpanded = expandedNoteId === note.id;

          return (
            <div
              key={note.id}
              className={`bg-slate-800/50 rounded-lg border transition-all ${
                note.isLateArrival ? 'border-amber-700/50' : 'border-slate-700'
              }`}
            >
              <div
                className="px-4 py-3 cursor-pointer"
                onClick={() => setExpandedNoteId(isExpanded ? null : note.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {note.isLateArrival ? (
                      <div className="p-1.5 bg-amber-900/50 rounded-lg">
                        <AlertCircle size={18} className="text-amber-400" />
                      </div>
                    ) : (
                      <div className="p-1.5 bg-slate-700 rounded-lg">
                        <FileText size={18} className="text-slate-400" />
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">
                          {note.isLateArrival ? '晚到材料' : '常规笔记'}
                        </span>
                        {note.isLateArrival && (
                          <span className="px-1.5 py-0.5 text-xs bg-amber-500/20 text-amber-300 rounded">
                            补录
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-300 mt-1 line-clamp-2">{note.content}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {new Date(note.createdAt).toLocaleString('zh-CN')}
                        </span>
                        <span>{note.createdBy}</span>
                        <span className="flex items-center gap-1">
                          <Link size={12} />
                          关联 {linkedLogs.length} 条日志
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="px-4 pb-4 border-t border-slate-700/50 pt-3">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                    关联训练日志
                  </h4>
                  <div className="space-y-2">
                    {linkedLogs.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-center gap-3 px-3 py-2 bg-slate-900/50 rounded-lg"
                      >
                        <code className="text-xs font-mono text-blue-400 bg-blue-900/30 px-1.5 py-0.5 rounded">
                          L{log.originalLineNumber}
                        </code>
                        <span className="text-sm text-slate-300">Epoch {log.epoch}</span>
                        <span className="text-xs text-slate-500">
                          总指标 {(log.overallMetric * 100).toFixed(1)}% | 少数类 {(log.minorityMetric * 100).toFixed(1)}%
                        </span>
                        <StatusBadge status={log.status} isBoundaryCase={log.isBoundaryCase} />
                        {log.status === 'confirmed' && note.isLateArrival && (
                          <span className="ml-auto text-xs text-emerald-400 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                            状态未被覆盖
                          </span>
                        )}
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
