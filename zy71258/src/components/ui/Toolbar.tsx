import {
  Move,
  Thermometer,
  Lightbulb,
  AlertTriangle,
  Camera,
  FileText,
  RotateCcw,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMainStore } from '@/store/mainStore';

interface ToolbarButtonProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
  variant?: 'toggle' | 'action';
}

function ToolbarButton({ icon, label, active, onClick, variant = 'toggle' }: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-200',
        'border',
        variant === 'toggle' && active
          ? 'bg-[#C9A962]/20 border-[#C9A962] text-[#C9A962]'
          : variant === 'toggle'
          ? 'bg-[#16181D] border-[#2A2D34] text-[#8B8D93] hover:border-[#3A3D44] hover:text-[#B0B2B8]'
          : 'bg-[#16181D] border-[#2A2D34] text-[#C9A962] hover:border-[#C9A962] hover:bg-[#C9A962]/10'
      )}
      style={{ fontFamily: "'JetBrains Mono', monospace" }}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
      {variant === 'toggle' && active && <Check size={14} />}
    </button>
  );
}

export default function Toolbar() {
  const {
    isRelayoutMode,
    setRelayoutMode,
    showHeatmap,
    setShowHeatmap,
    showLightRays,
    setShowLightRays,
    showRiskMarkers,
    setShowRiskMarkers,
    resetData,
  } = useMainStore();

  const handleScreenshot = () => {
    console.log('截图功能');
  };

  const handleExportReport = () => {
    console.log('导出报告');
  };

  const handleResetView = () => {
    resetData();
  };

  return (
    <div className="h-14 bg-[#121418] border-b border-[#2A2D34] px-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 pr-4 border-r border-[#2A2D34]">
          <div className="w-8 h-8 rounded-lg bg-[#C9A962]/20 flex items-center justify-center">
            <Lightbulb size={18} className="text-[#C9A962]" />
          </div>
          <div>
            <div
              className="text-sm font-semibold text-[#C9A962]"
              style={{ fontFamily: "'Noto Serif SC', serif" }}
            >
              光照保护监测系统
            </div>
            <div className="text-xs text-[#5A5D63] font-mono">v1.0.0</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ToolbarButton
            icon={<Move size={16} />}
            label="换位模式"
            active={isRelayoutMode}
            onClick={() => setRelayoutMode(!isRelayoutMode)}
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 pr-4 border-r border-[#2A2D34]">
          <ToolbarButton
            icon={<Thermometer size={16} />}
            label="热力图"
            active={showHeatmap}
            onClick={() => setShowHeatmap(!showHeatmap)}
          />
          <ToolbarButton
            icon={<Lightbulb size={16} />}
            label="光线"
            active={showLightRays}
            onClick={() => setShowLightRays(!showLightRays)}
          />
          <ToolbarButton
            icon={<AlertTriangle size={16} />}
            label="风险标记"
            active={showRiskMarkers}
            onClick={() => setShowRiskMarkers(!showRiskMarkers)}
          />
        </div>

        <div className="flex items-center gap-2">
          <ToolbarButton
            icon={<Camera size={16} />}
            label="截图"
            variant="action"
            onClick={handleScreenshot}
          />
          <ToolbarButton
            icon={<FileText size={16} />}
            label="报告导出"
            variant="action"
            onClick={handleExportReport}
          />
          <ToolbarButton
            icon={<RotateCcw size={16} />}
            label="视图重置"
            variant="action"
            onClick={handleResetView}
          />
        </div>
      </div>
    </div>
  );
}
