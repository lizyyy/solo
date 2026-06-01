import { useEffect, useRef } from 'react';
import { Table, Camera, Image, FileText, PenTool } from 'lucide-react';
import { useStore } from '@/store/useStore';
import type { SourceType } from '@/types';
import { cn } from '@/lib/utils';

const sourceIcons: Record<SourceType, React.ReactNode> = {
  point_table: <Table size={14} />,
  photo: <Camera size={14} />,
  meeting_screenshot: <Image size={14} />,
  plan_note: <FileText size={14} />,
  manual_coordinate: <PenTool size={14} />,
};

export default function SourcePopover() {
  const { sourcePopover, sourcesByRecord, setSourcePopover, fetchSources } = useStore();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sourcePopover) return;
    fetchSources(sourcePopover.recordId);
  }, [sourcePopover, fetchSources]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setSourcePopover(null);
      }
    }
    if (sourcePopover) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [sourcePopover, setSourcePopover]);

  if (!sourcePopover) return null;

  const sources = sourcesByRecord[sourcePopover.recordId] || [];

  return (
    <div
      ref={ref}
      className={cn(
        'fixed z-50 w-72 rounded-lg border border-gray-600 bg-[#1a1a2e] p-3 shadow-xl',
      )}
      style={{ left: sourcePopover.x, top: sourcePopover.y }}
    >
      <div className="mb-2 text-xs font-semibold text-gray-300">来源追踪</div>
      {sources.length === 0 && (
        <div className="text-xs text-gray-500">加载中...</div>
      )}
      <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
        {sources.map((s) => (
          <div key={s.id} className="flex items-start gap-2 rounded bg-gray-800 p-2">
            <span className="mt-0.5 text-amber-400">{sourceIcons[s.sourceType]}</span>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-gray-200 truncate">{s.sourceName}</div>
              <div className="text-[10px] text-gray-400 truncate">引用: {s.sourceRef}</div>
              {s.description && (
                <div className="text-[10px] text-gray-500 mt-0.5 truncate">{s.description}</div>
              )}
              <div className="text-[10px] text-gray-600 mt-0.5">
                {new Date(s.importedAt).toLocaleString('zh-CN')}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
