import { useStore } from '@/store/useStore';
import {
  Upload,
  Play,
  MousePointer2,
  PenTool,
  RotateCcw,
  Download,
  Save,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function Toolbar() {
  const {
    toolMode,
    setToolMode,
    resetState,
    loadSampleData,
    pointCloud,
    showReportModal,
    setShowReportModal,
  } = useStore();

  const tools = [
    { id: 'select', icon: MousePointer2, label: '选择' },
    { id: 'draw', icon: PenTool, label: '绘制边界' },
  ];

  return (
    <div className="h-14 bg-gradient-to-r from-slate-800 to-slate-900 border-b border-slate-700 flex items-center px-4 justify-between">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 mr-4">
          <Layers className="w-6 h-6 text-blue-400" />
          <span className="text-white font-semibold text-lg">料场堆体体积估算系统</span>
        </div>

        <div className="h-6 w-px bg-slate-600 mx-2" />

        <div className="flex items-center gap-1">
          {tools.map(tool => (
            <button
              key={tool.id}
              onClick={() => setToolMode(tool.id as 'select' | 'draw')}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all',
                toolMode === tool.id
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-slate-300 hover:bg-slate-700 hover:text-white'
              )}
            >
              <tool.icon className="w-4 h-4" />
              <span>{tool.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={loadSampleData}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-all"
        >
          <Upload className="w-4 h-4" />
          <span>导入样例</span>
        </button>

        <button
          onClick={() => {
            const name = prompt('请输入批次名称:', `盘点批次 ${new Date().toLocaleDateString()}`);
            if (name) {
              useStore.getState().saveBatch(name);
            }
          }}
          disabled={!pointCloud}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          <span>保存批次</span>
        </button>

        <button
          onClick={() => setShowReportModal(true)}
          disabled={!pointCloud}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4" />
          <span>导出报告</span>
        </button>

        <div className="h-6 w-px bg-slate-600 mx-2" />

        <button
          onClick={resetState}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-all"
        >
          <RotateCcw className="w-4 h-4" />
          <span>重置</span>
        </button>
      </div>
    </div>
  );
}
