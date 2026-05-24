import { useState } from 'react';
import {
  Upload,
  Eye,
  EyeOff,
  Filter,
  Camera,
  Layers,
  Database,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { cameraPresets } from '../../data/mockData';
import { cn } from '../../lib/utils';

interface LeftPanelProps {
  currentView: string;
  onViewChange: (view: string) => void;
}

interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function CollapsibleSection({ title, icon, children, defaultOpen = true }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-slate-700">
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2 text-slate-200">
          {icon}
          <span className="font-medium text-sm">{title}</span>
        </div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>
      {isOpen && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

export function LeftPanel({ currentView, onViewChange }: LeftPanelProps) {
  const loadSampleData = useAppStore((state) => state.loadSampleData);
  const showHeatmap = useAppStore((state) => state.showHeatmap);
  const showGoldenLayer = useAppStore((state) => state.showGoldenLayer);
  const showIssues = useAppStore((state) => state.showIssues);
  const setShowHeatmap = useAppStore((state) => state.setShowHeatmap);
  const setShowGoldenLayer = useAppStore((state) => state.setShowGoldenLayer);
  const setShowIssues = useAppStore((state) => state.setShowIssues);
  const filterCategory = useAppStore((state) => state.filterCategory);
  const setFilterCategory = useAppStore((state) => state.setFilterCategory);
  const getCategories = useAppStore((state) => state.getCategories);
  const store = useAppStore((state) => state.store);
  const draggedSku = useAppStore((state) => state.draggedSku);
  const setDraggedSku = useAppStore((state) => state.setDraggedSku);

  const categories = getCategories();

  return (
    <div className="w-64 bg-slate-900 border-r border-slate-700 flex flex-col h-full overflow-y-auto">
      <div className="p-4 border-b border-slate-700">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Database className="w-5 h-5 text-blue-400" />
          控制面板
        </h2>
      </div>

      <CollapsibleSection title="数据导入" icon={<Upload className="w-4 h-4" />}>
        <button
          onClick={loadSampleData}
          className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
        >
          <Upload className="w-4 h-4" />
          导入样例数据
        </button>
        {!store && (
          <p className="mt-2 text-xs text-slate-400 text-center">
            点击上方按钮加载示范门店数据
          </p>
        )}
      </CollapsibleSection>

      {store && (
        <>
          <CollapsibleSection title="图层控制" icon={<Layers className="w-4 h-4" />}>
            <div className="space-y-2">
              <ToggleButton
                label="动线热力图"
                isActive={showHeatmap}
                onToggle={() => setShowHeatmap(!showHeatmap)}
              />
              <ToggleButton
                label="黄金层高亮"
                isActive={showGoldenLayer}
                onToggle={() => setShowGoldenLayer(!showGoldenLayer)}
              />
              <ToggleButton
                label="显示问题标记"
                isActive={showIssues}
                onToggle={() => setShowIssues(!showIssues)}
              />
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="视角预设" icon={<Camera className="w-4 h-4" />}>
            <div className="grid grid-cols-2 gap-2">
              {cameraPresets.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => onViewChange(preset.name)}
                  className={cn(
                    'py-2 px-3 rounded text-xs font-medium transition-all',
                    currentView === preset.name
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  )}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="SKU分类筛选" icon={<Filter className="w-4 h-4" />}>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFilterCategory(null)}
                className={cn(
                  'py-1 px-3 rounded-full text-xs font-medium transition-all',
                  !filterCategory
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                )}
              >
                全部
              </button>
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setFilterCategory(category)}
                  className={cn(
                    'py-1 px-3 rounded-full text-xs font-medium transition-all',
                    filterCategory === category
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  )}
                >
                  {category}
                </button>
              ))}
            </div>
          </CollapsibleSection>

          {draggedSku && (
            <div className="m-4 p-3 bg-amber-900/50 border border-amber-600 rounded-lg">
              <p className="text-amber-200 text-xs">
                <strong>拖拽模式</strong>
              </p>
              <p className="text-amber-300 text-xs mt-1">
                点击目标位置放置SKU，或
                <button
                  onClick={() => setDraggedSku(null)}
                  className="text-amber-400 underline ml-1 hover:text-amber-300"
                >
                  取消
                </button>
              </p>
            </div>
          )}
        </>
      )}

      <div className="mt-auto p-4 border-t border-slate-700">
        <p className="text-xs text-slate-500 text-center">
          提示：双击SKU进入拖拽模式
        </p>
      </div>
    </div>
  );
}

interface ToggleButtonProps {
  label: string;
  isActive: boolean;
  onToggle: () => void;
}

function ToggleButton({ label, isActive, onToggle }: ToggleButtonProps) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        'w-full flex items-center justify-between py-2 px-3 rounded-lg text-sm transition-all',
        isActive
          ? 'bg-blue-900/50 text-blue-300 border border-blue-600'
          : 'bg-slate-800 text-slate-400 border border-slate-700'
      )}
    >
      <span>{label}</span>
      {isActive ? (
        <Eye className="w-4 h-4" />
      ) : (
        <EyeOff className="w-4 h-4" />
      )}
    </button>
  );
}
