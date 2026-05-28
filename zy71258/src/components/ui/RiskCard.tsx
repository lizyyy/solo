import { AlertTriangle, Sun, Clock, Eye, MapPin, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMainStore } from '@/store/mainStore';
import type { Risk, RiskType } from '@/types';

interface RiskCardProps {
  risk: Risk;
  compact?: boolean;
}

const RISK_CONFIG: Record<RiskType, { label: string; icon: React.ReactNode; color: string }> = {
  over_illumination: { label: '照度超标', icon: <Sun size={14} />, color: '#E5484D' },
  cumulative_leak: { label: '累计漏光', icon: <Clock size={14} />, color: '#F2994A' },
  light_penetration: { label: '光线穿透', icon: <Eye size={14} />, color: '#9B51E0' },
};

export default function RiskCard({ risk, compact = false }: RiskCardProps) {
  const config = RISK_CONFIG[risk.type];
  const selectRisk = useMainStore((state) => state.selectRisk);
  const selectedRiskId = useMainStore((state) => state.selectedRiskId);
  const isSelected = selectedRiskId === risk.id;

  const handleLocate = () => {
    selectRisk(risk.id);
  };

  if (compact) {
    return (
      <button
        onClick={handleLocate}
        className={cn(
          'flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-200',
          'hover:scale-105',
          isSelected
            ? 'bg-[#1A1D24] border-[#C9A962] ring-1 ring-[#C9A962]/30'
            : 'bg-[#16181D] border-[#2A2D34] hover:border-[#3A3D44]'
        )}
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        <div className="flex items-center gap-1.5" style={{ color: config.color }}>
          {config.icon}
          <span className="text-xs font-medium">{config.label}</span>
        </div>
        <MapPin size={12} className="text-[#8B8D93]" />
      </button>
    );
  }

  return (
    <div
      className={cn(
        'p-4 rounded-xl border transition-all duration-200 cursor-pointer',
        'hover:shadow-lg hover:shadow-black/20',
        isSelected
          ? 'bg-[#1A1D24] border-[#C9A962] ring-2 ring-[#C9A962]/20'
          : 'bg-[#16181D] border-[#2A2D34] hover:border-[#3A3D44]'
      )}
      onClick={handleLocate}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="p-2 rounded-lg"
            style={{ backgroundColor: `${config.color}20`, color: config.color }}
          >
            <AlertTriangle size={18} />
          </div>
          <div>
            <div
              className="text-sm font-semibold"
              style={{ fontFamily: "'Noto Serif SC', serif", color: config.color }}
            >
              {config.label}
            </div>
            <div className="text-xs text-[#8B8D93] font-mono">
              #{risk.id.slice(-8)}
            </div>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleLocate();
          }}
          className="flex items-center gap-1 px-2 py-1 rounded-md bg-[#1E2128] border border-[#2A2D34] text-[#C9A962] text-xs hover:bg-[#C9A962]/10 transition-colors"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          <ExternalLink size={12} />
          定位
        </button>
      </div>

      <p
        className="text-xs text-[#B0B2B8] mb-3 leading-relaxed"
        style={{ fontFamily: "'Noto Serif SC', serif" }}
      >
        {risk.description}
      </p>

      <div className="flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-1 text-[#8B8D93]">
          <MapPin size={12} />
          ({risk.posX.toFixed(1)}, {risk.posY.toFixed(1)}, {risk.posZ.toFixed(1)})
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[#8B8D93]">测量值</span>
          <span className="text-[#E5484D] font-semibold">{risk.measuredValue.toFixed(1)}</span>
          <span className="text-[#5A5D63]">/</span>
          <span className="text-[#8B8D93]">{risk.threshold.toFixed(1)}</span>
        </div>
      </div>

      <div className="mt-3 h-1.5 bg-[#2A2D34] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${Math.min((risk.measuredValue / risk.threshold) * 100, 200)}%`,
            backgroundColor: config.color,
          }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="text-[#5A5D63] font-mono">
          超出 {(risk.exceedRatio * 100).toFixed(0)}%
        </span>
        <span
          className={cn(
            'px-2 py-0.5 rounded font-mono',
            risk.status === 'detected' && 'bg-[#E5484D]/20 text-[#E5484D]',
            risk.status === 'acknowledged' && 'bg-[#F2994A]/20 text-[#F2994A]',
            risk.status === 'resolved' && 'bg-[#27AE60]/20 text-[#27AE60]'
          )}
        >
          {risk.status === 'detected' && '待处理'}
          {risk.status === 'acknowledged' && '已确认'}
          {risk.status === 'resolved' && '已解决'}
        </span>
      </div>
    </div>
  );
}
