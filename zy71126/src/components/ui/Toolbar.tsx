import { useState } from 'react';
import {
  Upload,
  RotateCcw,
  FileDown,
  Eye,
  Move,
  Save,
  ChevronDown,
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { sampleLayouts } from '@/data/sampleLayouts';
import { ViewMode } from '@/types';

export function Toolbar() {
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
  const [showViewMenu, setShowViewMenu] = useState(false);
  const loadLayout = useAppStore((state) => state.loadLayout);
  const resetLayout = useAppStore((state) => state.resetLayout);
  const isDraggingEnabled = useAppStore((state) => state.isDraggingEnabled);
  const setIsDraggingEnabled = useAppStore((state) => state.setIsDraggingEnabled);
  const setViewMode = useAppStore((state) => state.setViewMode);
  const layoutName = useAppStore((state) => state.layoutName);
  const saveTimelineState = useAppStore((state) => state.saveTimelineState);

  const viewModes: { id: ViewMode; label: string }[] = [
    { id: 'perspective', label: '透视视角' },
    { id: 'top', label: '俯视视角' },
    { id: 'front', label: '正视视角' },
    { id: 'side', label: '侧视视角' },
  ];

  return (
    <div className="absolute top-0 left-0 right-0 h-14 bg-slate-900/95 backdrop-blur-sm border-b border-slate-700 flex items-center justify-between px-4 z-10">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-bold text-white mr-6">教室视线检查</h1>
        <span className="text-slate-400 text-sm">当前布局: {layoutName}</span>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative">
          <button
            onClick={() => setShowLayoutMenu(!showLayoutMenu)}
            className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors"
          >
            <Upload size={16} />
            导入样例
            <ChevronDown size={14} />
          </button>
          {showLayoutMenu && (
            <div className="absolute top-full mt-1 left-0 bg-slate-800 rounded-lg shadow-xl border border-slate-700 py-1 min-w-48 z-20">
              {sampleLayouts.map((layout, index) => (
                <button
                  key={index}
                  onClick={() => {
                    loadLayout(layout);
                    setShowLayoutMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-slate-700 transition-colors"
                >
                  {layout.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => setShowViewMenu(!showViewMenu)}
            className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors"
          >
            <Eye size={16} />
            视角
            <ChevronDown size={14} />
          </button>
          {showViewMenu && (
            <div className="absolute top-full mt-1 left-0 bg-slate-800 rounded-lg shadow-xl border border-slate-700 py-1 min-w-32 z-20">
              {viewModes.map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => {
                    setViewMode(mode.id);
                    setShowViewMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-slate-700 transition-colors"
                >
                  {mode.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => setIsDraggingEnabled(!isDraggingEnabled)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
            isDraggingEnabled
              ? 'bg-blue-600 hover:bg-blue-500 text-white'
              : 'bg-slate-700 hover:bg-slate-600 text-white'
          }`}
        >
          <Move size={16} />
          拖拽座位
        </button>

        <button
          onClick={() => saveTimelineState(`状态 ${Date.now()}`)}
          className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm transition-colors"
        >
          <Save size={16} />
          保存状态
        </button>

        <button
          onClick={resetLayout}
          className="flex items-center gap-2 px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm transition-colors"
        >
          <RotateCcw size={16} />
          重置
        </button>

        <button
          onClick={() => {
            const event = new CustomEvent('exportReport');
            window.dispatchEvent(event);
          }}
          className="flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm transition-colors"
        >
          <FileDown size={16} />
          导出报告
        </button>
      </div>
    </div>
  );
}
