import { ToolMode } from '../types';

interface ToolbarProps {
  currentMode: ToolMode;
  onModeChange: (mode: ToolMode) => void;
  onClear: () => void;
  onSave: () => void;
  onExport: () => void;
  planName: string;
  onPlanNameChange: (name: string) => void;
  canSave: boolean;
  canExport: boolean;
}

export const Toolbar = ({
  currentMode,
  onModeChange,
  onClear,
  onSave,
  onExport,
  planName,
  onPlanNameChange,
  canSave,
  canExport
}: ToolbarProps) => {
  const tools: { mode: ToolMode; label: string; icon: string }[] = [
    { mode: 'view', label: '查看', icon: '👁️' },
    { mode: 'draw', label: '绘制', icon: '✏️' },
    { mode: 'edit', label: '编辑', icon: '🔧' },
    { mode: 'delete', label: '删除', icon: '🗑️' }
  ];

  return (
    <div className="bg-gray-800 border-b border-gray-700 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-white mr-4">堆场装卸路径三维看板</h1>
          <div className="h-6 w-px bg-gray-600 mx-2" />
          
          <div className="flex bg-gray-700 rounded-lg overflow-hidden">
            {tools.map(tool => (
            <button
              key={tool.mode}
              onClick={() => onModeChange(tool.mode)}
              className={`px-3 py-1.5 text-sm transition-colors ${
                currentMode === tool.mode
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-600'
              }`}
            >
              <span className="mr-1">{tool.icon}</span>
              {tool.label}
            </button>
          ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={planName}
            onChange={(e) => onPlanNameChange(e.target.value)}
            placeholder="方案名称"
            className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-blue-500 w-40"
          />
          <button
            onClick={onSave}
            disabled={!canSave}
            className={`px-3 py-1.5 rounded text-sm ${
              canSave
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }`}
          >
            💾 保存方案
          </button>
          <button
            onClick={onExport}
            disabled={!canExport}
            className={`px-3 py-1.5 rounded text-sm ${
              canExport
                ? 'bg-purple-600 hover:bg-purple-700 text-white'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }`}
          >
            📄 导出报告
          </button>
          <button
            onClick={onClear}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
          >
            🔄 清空
          </button>
        </div>
      </div>
    </div>
  );
};
