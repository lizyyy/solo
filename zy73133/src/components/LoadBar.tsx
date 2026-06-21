import { useState } from 'react';
import { Upload, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { useTidalStore } from '@/store/useTidalStore';
import { SAMPLE_BUOY_LOGS } from '@/engine/sampleLogs';
import { cn } from '@/lib/utils';

export function LoadBar() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(SAMPLE_BUOY_LOGS);
  const loadLogs = useTidalStore((s) => s.loadLogs);
  const logText = useTidalStore((s) => s.logText);

  return (
    <div className="border-b border-glow-teal/20 bg-abyss-800/60">
      <div className="flex items-center gap-2 px-4 py-2">
        <FileText className="h-3.5 w-3.5 text-glow-cyan/70" />
        <span className="font-mono text-[10px] text-signal-moon/50">浮标日志源</span>
        <span className="font-mono text-[10px] text-glow-cyan truncate max-w-[280px]">
          {logText.split('\n').filter((l) => l.trim() && !l.trim().startsWith('#')).length} 行有效日志
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={() => loadLogs(SAMPLE_BUOY_LOGS)}
            className="rounded-md border border-glow-cyan/40 bg-glow-cyan/10 px-2.5 py-1 font-mono text-[10px] font-semibold text-glow-cyan hover:bg-glow-cyan/20"
          >
            加载示例日志
          </button>
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1 rounded-md border border-signal-moon/15 px-2 py-1 font-mono text-[10px] text-signal-moon/60 hover:text-signal-moon"
          >
            <Upload className="h-3 w-3" /> 自定义
            {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </div>
      </div>
      {open && (
        <div className="border-t border-glow-teal/10 px-4 py-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={6}
            className="w-full resize-none rounded-lg border border-glow-teal/30 bg-abyss-900/70 p-2.5 font-mono text-[10px] leading-relaxed text-signal-moon placeholder:text-signal-moon/25 focus:border-glow-cyan/60 focus:outline-none"
            placeholder="粘贴浮标日志，每行一条..."
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              onClick={() => setDraft(SAMPLE_BUOY_LOGS)}
              className="rounded-md border border-signal-moon/15 px-2.5 py-1 font-mono text-[10px] text-signal-moon/60 hover:text-signal-moon"
            >
              重置为示例
            </button>
            <button
              onClick={() => { loadLogs(draft); setOpen(false); }}
              className={cn(
                'rounded-md border border-glow-cyan/40 bg-glow-cyan/15 px-2.5 py-1 font-mono text-[10px] font-semibold text-glow-cyan hover:bg-glow-cyan/25',
              )}
            >
              解析并加载
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
