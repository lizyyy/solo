import {
  ChevronDown,
  FileCode,
  StickyNote,
  Code2,
  Link2,
  X,
} from 'lucide-react';
import { useWorkbenchStore } from '@/store';

export default function BottomPanel() {
  const record = useWorkbenchStore((s) => s.record);
  const showBottomPanel = useWorkbenchStore((s) => s.showBottomPanel);
  const setShowBottomPanel = useWorkbenchStore((s) => s.setShowBottomPanel);

  if (!showBottomPanel) {
    return (
      <div className="bg-slate-800 border-t border-slate-700 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 flex items-center gap-1.5">
            <Link2 size={12} className="text-blue-400" />
            渲染源 ID:{' '}
            <span className="font-mono text-slate-400">
              {record?.render_source_id || '-'}
            </span>
          </span>
          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] border border-emerald-500/30">
            同源一套话
          </span>
        </div>
        <button
          onClick={() => setShowBottomPanel(true)}
          className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded flex items-center gap-1 transition-colors"
        >
          <ChevronDown size={12} />
          展开
        </button>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 border-t border-slate-700 flex flex-col h-64">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700 bg-slate-800/80 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 flex items-center gap-1.5">
            <Link2 size={12} className="text-blue-400" />
            <span className="text-slate-500">渲染源 ID:</span>
            <span className="font-mono text-slate-300 text-[11px] bg-slate-900/50 px-2 py-0.5 rounded">
              {record?.render_source_id || '-'}
            </span>
          </span>
          <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 text-[10px] border border-emerald-500/30 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            同源一套话
          </span>
        </div>
        <button
          onClick={() => setShowBottomPanel(false)}
          className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded flex items-center gap-1 transition-colors"
        >
          <X size={12} />
          折叠
        </button>
      </div>

      <div className="flex-1 grid grid-cols-3 gap-0 min-h-0">
        <div className="flex flex-col border-r border-slate-700 min-w-0">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/50 border-b border-slate-700 flex-shrink-0">
            <FileCode size={12} className="text-slate-400" />
            <span className="text-xs text-slate-400 font-medium">
              scene_annotations 场景标注
            </span>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 bg-white min-w-0">
            <pre className="font-mono text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
              {record?.scene_annotations || '// 等待场景标注同步...\n'}
            </pre>
          </div>
        </div>

        <div className="flex flex-col border-r border-slate-700 min-w-0">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/50 border-b border-slate-700 flex-shrink-0">
            <StickyNote size={12} className="text-slate-400" />
            <span className="text-xs text-slate-400 font-medium">
              side_notes 工程附注
            </span>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 min-w-0">
            <pre className="font-sans text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
              {record?.side_notes || '（暂无工程附注）\n'}
            </pre>
          </div>
        </div>

        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/50 border-b border-slate-700 flex-shrink-0">
            <Code2 size={12} className="text-slate-400" />
            <span className="text-xs text-slate-400 font-medium">
              api_response JSON
            </span>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 bg-slate-950 min-w-0">
            <pre className="font-mono text-xs text-emerald-300 whitespace-pre-wrap leading-relaxed">
              {record?.api_response
                ? JSON.stringify(record.api_response, null, 2)
                : '{}'}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
