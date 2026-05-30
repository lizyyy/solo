import { useState } from 'react';
import {
  Layers,
  Play,
  RotateCcw,
  FileText,
  Settings,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  MapPin,
  AlertTriangle,
  FileOutput,
} from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useCollisionStore } from '../../stores/collisionStore';
import { usePipelineStore } from '../../stores/pipelineStore';
import { cn } from '../../lib/utils';

interface HeaderProps {
  onRunDetection: () => void;
  onExportReport: () => void;
  onViewLogs: () => void;
  isDetecting: boolean;
  collisionCount: number;
  segmentCount: number;
}

export function Header({
  onRunDetection,
  onExportReport,
  onViewLogs,
  isDetecting,
  collisionCount,
  segmentCount,
}: HeaderProps) {
  const [showHelp, setShowHelp] = useState(false);
  const toggleLeftPanel = useUIStore((state) => state.toggleLeftPanel);
  const toggleRightPanel = useUIStore((state) => state.toggleRightPanel);
  const leftCollapsed = useUIStore((state) => state.leftPanelCollapsed);
  const rightCollapsed = useUIStore((state) => state.rightPanelCollapsed);
  const resetData = usePipelineStore((state) => state.resetData);
  const resetCollision = useCollisionStore((state) => state.reset);
  const dataIssues = useCollisionStore((state) => state.dataIssues);

  const handleReset = () => {
    resetData();
    resetCollision();
  };

  return (
    <header className="h-14 bg-slate-900 border-b border-slate-700 flex items-center justify-between px-4 relative z-50">
      <div className="flex items-center gap-4">
        <button
          onClick={toggleLeftPanel}
          className="p-2 hover:bg-slate-700 rounded transition-colors text-slate-400 hover:text-white"
          title={leftCollapsed ? '展开左侧面板' : '收起左侧面板'}
        >
          {leftCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>

        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
            <Layers size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-sm leading-tight">地下管线碰撞巡检系统</h1>
            <p className="text-slate-400 text-xs">Pipeline Collision Inspection</p>
          </div>
        </div>

        <div className="h-6 w-px bg-slate-700 mx-2" />

        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5 text-slate-400">
            <MapPin size={14} className="text-blue-400" />
            <span>管线: <span className="text-white font-medium">{segmentCount}</span></span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400">
            <AlertTriangle size={14} className="text-orange-400" />
            <span>碰撞: <span className="text-orange-400 font-medium">{collisionCount}</span></span>
          </div>
          {dataIssues.length > 0 && (
            <div className="flex items-center gap-1.5 text-slate-400">
              <AlertTriangle size={14} className="text-yellow-400" />
              <span>数据问题: <span className="text-yellow-400 font-medium">{dataIssues.length}</span></span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors"
          title="重置数据"
        >
          <RotateCcw size={14} />
          重置
        </button>

        <button
          onClick={onViewLogs}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors"
          title="查看操作日志"
        >
          <FileText size={14} />
          日志
        </button>

        <button
          onClick={onExportReport}
          disabled={collisionCount === 0}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded transition-colors',
            collisionCount > 0
              ? 'text-white bg-emerald-600 hover:bg-emerald-500'
              : 'text-slate-500 bg-slate-700 cursor-not-allowed'
          )}
          title="导出检测报告"
        >
          <FileOutput size={14} />
          导出报告
        </button>

        <div className="h-6 w-px bg-slate-700 mx-1" />

        <button
          onClick={onRunDetection}
          disabled={isDetecting}
          className={cn(
            'flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded transition-all',
            isDetecting
              ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20'
          )}
        >
          <Play size={14} className={cn(isDetecting && 'animate-pulse')} />
          {isDetecting ? '检测中...' : '开始碰撞检测'}
        </button>

        <div className="h-6 w-px bg-slate-700 mx-1" />

        <button
          onClick={() => setShowHelp(!showHelp)}
          className="p-2 hover:bg-slate-700 rounded transition-colors text-slate-400 hover:text-white"
          title="帮助"
        >
          <HelpCircle size={18} />
        </button>

        <button
          onClick={toggleRightPanel}
          className="p-2 hover:bg-slate-700 rounded transition-colors text-slate-400 hover:text-white"
          title={rightCollapsed ? '展开右侧面板' : '收起右侧面板'}
        >
          {rightCollapsed ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </button>
      </div>

      {showHelp && (
        <div className="absolute top-full right-4 mt-2 w-80 bg-slate-800 border border-slate-600 rounded-lg p-4 shadow-xl z-50">
          <h3 className="text-white font-medium mb-3">操作说明</h3>
          <ul className="text-sm text-slate-300 space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-blue-400">•</span>
              鼠标左键拖动旋转视角，滚轮缩放，右键平移
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400">•</span>
              点击管线段或碰撞点查看详细信息
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400">•</span>
              点击"开始碰撞检测"执行净距分析
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400">•</span>
              检测完成后可导出PDF报告
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400">•</span>
              红色=严重碰撞，橙色=警告，绿色=提示
            </li>
          </ul>
          <button
            onClick={() => setShowHelp(false)}
            className="mt-3 w-full py-1.5 text-xs text-slate-400 hover:text-white bg-slate-700 hover:bg-slate-600 rounded transition-colors"
          >
            关闭
          </button>
        </div>
      )}
    </header>
  );
}
