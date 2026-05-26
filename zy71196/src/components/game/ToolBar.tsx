import { TOOL_CONFIG } from '../../game/config';
import type { ToolType } from '../../game/types';

interface ToolBarProps {
  selectedTool: ToolType;
  onSelectTool: (tool: ToolType) => void;
  onEndRound: () => void;
  onPause: () => void;
  onRestart: () => void;
  onExit: () => void;
  isPaused: boolean;
  actionPoints: number;
}

export function ToolBar({
  selectedTool,
  onSelectTool,
  onEndRound,
  onPause,
  onRestart,
  onExit,
  isPaused,
  actionPoints,
}: ToolBarProps) {
  const tools: ToolType[] = ['inspect', 'unclog', 'pump', 'reinforce'];

  return (
    <div className="bg-slate-800/90 backdrop-blur-sm border-t border-slate-700 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {tools.map((tool) => {
            const config = TOOL_CONFIG[tool];
            const canUse = actionPoints >= config.cost;
            
            return (
              <button
                key={tool}
                onClick={() => canUse && onSelectTool(tool)}
                disabled={!canUse}
                className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-all ${
                  selectedTool === tool
                    ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                    : canUse
                    ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
                title={config.description}
              >
                <span className="text-2xl">{config.icon}</span>
                <span className="text-xs font-medium">{config.name}</span>
                <span className="text-xs opacity-70">
                  消耗: {config.cost} AP
                </span>
                <span className="text-[10px] text-slate-400">
                  快捷键: {config.shortcut}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onEndRound}
            className="px-6 py-3 bg-green-600 hover:bg-green-500 text-white font-medium rounded-lg transition-colors"
          >
            结束回合
          </button>

          <div className="h-8 w-px bg-slate-600" />

          <button
            onClick={onPause}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            {isPaused ? '继续' : '暂停'}
          </button>

          <button
            onClick={onRestart}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            重新开始
          </button>

          <button
            onClick={onExit}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
          >
            退出
          </button>
        </div>
      </div>
    </div>
  );
}
