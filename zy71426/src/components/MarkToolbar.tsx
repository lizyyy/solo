import { Highlighter, Stamp, FileText, X } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import type { ActiveTool, MarkType } from '../types';
import { getMarkTypeLabel } from '../utils/gameEngine';

interface MarkToolbarProps {
  onMark: (markType: MarkType) => void;
}

const MarkToolbar = ({ onMark }: MarkToolbarProps) => {
  const { activeTool, setActiveTool } = useGameStore();

  const tools: { id: ActiveTool; icon: React.ElementType; label: string }[] = [
    { id: 'highlight', icon: Highlighter, label: '荧光笔' },
    { id: 'stamp', icon: Stamp, label: '印章' },
    { id: 'note', icon: FileText, label: '便签' }
  ];

  const markTypes: { type: MarkType; color: string; bgColor: string }[] = [
    { type: 'exemption', color: 'text-red-400', bgColor: 'bg-red-500/20 hover:bg-red-500/30' },
    { type: 'old_damage', color: 'text-orange-400', bgColor: 'bg-orange-500/20 hover:bg-orange-500/30' },
    { type: 'contradiction', color: 'text-amber-400', bgColor: 'bg-amber-500/20 hover:bg-amber-500/30' },
    { type: 'suspicious', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20 hover:bg-yellow-500/30' }
  ];

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="file-folder flex items-center gap-2 p-3 glow-border">
        {tools.map((tool) => {
          const Icon = tool.icon;
          const isActive = activeTool === tool.id;
          return (
            <button
              key={tool.id}
              onClick={() => setActiveTool(isActive ? null : tool.id)}
              className={`p-3 rounded-lg transition-all duration-200 flex flex-col items-center gap-1 ${
                isActive
                  ? 'bg-detective-accent text-detective-bg shadow-lg'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-detective-bgLighter'
              }`}
              title={tool.label}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs">{tool.label}</span>
            </button>
          );
        })}

        {activeTool && (
          <>
            <div className="w-px h-12 bg-detective-bgLighter mx-2"></div>
            
            {markTypes.map((markType) => (
              <button
                key={markType.type}
                onClick={() => {
                  onMark(markType.type);
                }}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${markType.bgColor} ${markType.color}`}
              >
                {getMarkTypeLabel(markType.type)}
              </button>
            ))}

            <button
              onClick={() => setActiveTool(null)}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-detective-bgLighter ml-2"
              title="关闭"
            >
              <X className="w-5 h-5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default MarkToolbar;
