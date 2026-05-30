import { useState, useEffect } from 'react';
import { Save, History, ChevronDown } from 'lucide-react';
import type { NoteVersion } from '@/types';
import { useAppStore } from '@/store';

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function NoteEditor({
  recordId,
  notes,
}: {
  recordId: string;
  notes: NoteVersion[];
}) {
  const updateNotes = useAppStore((s) => s.updateNotes);
  const [content, setContent] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const currentNote = notes.find((n) => n.isCurrent);
  const historyNotes = notes.filter((n) => !n.isCurrent).sort((a, b) => b.version - a.version);

  useEffect(() => {
    setContent(currentNote?.content ?? '');
  }, [currentNote?.content, recordId]);

  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => setShowToast(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  async function handleSave() {
    if (!content.trim()) return;
    setIsSaving(true);
    try {
      await updateNotes(recordId, content);
      setShowToast(true);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="relative">
      {showToast && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 rounded-lg bg-synth-green/20 border border-synth-green/40 px-4 py-2 text-xs text-synth-green font-medium animate-pulse z-10">
          保存成功
        </div>
      )}

      <div className="rounded-xl border border-white/5 bg-synth-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-200">备注</h3>
          <span className="text-[10px] text-synth-amber/80 border border-synth-amber/20 rounded-md px-2 py-0.5">
            保存将创建新版本，旧版本不会被覆盖
          </span>
        </div>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          className="w-full rounded-lg border border-white/10 bg-synth-bg px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600 focus:border-synth-green/40 focus:outline-none focus:ring-1 focus:ring-synth-green/20 resize-none"
          placeholder="输入备注内容..."
        />

        <div className="flex items-center justify-between mt-3">
          {currentNote && (
            <span className="text-[10px] text-gray-500 font-mono-display">
              v{currentNote.version} · {formatTimestamp(currentNote.createdAt)}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving || !content.trim()}
            className="ml-auto flex items-center gap-1.5 rounded-lg bg-synth-green/10 border border-synth-green/30 px-3 py-1.5 text-xs font-medium text-synth-green hover:bg-synth-green/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Save size={12} />
            {isSaving ? '保存中...' : '保存'}
          </button>
        </div>

        {historyNotes.length > 0 && (
          <div className="mt-4 border-t border-white/5 pt-3">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors"
            >
              <History size={12} />
              历史版本 ({historyNotes.length})
              <ChevronDown
                size={12}
                className={`transition-transform ${showHistory ? 'rotate-180' : ''}`}
              />
            </button>

            {showHistory && (
              <div className="mt-2 space-y-2">
                {historyNotes.map((note) => (
                  <div
                    key={note.id}
                    className="rounded-lg border border-white/5 bg-synth-bg/60 px-3 py-2"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono-display text-purple-400">
                        v{note.version}
                      </span>
                      <span className="text-[10px] font-mono-display text-gray-600">
                        {formatTimestamp(note.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      {note.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
