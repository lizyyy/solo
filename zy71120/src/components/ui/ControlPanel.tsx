import { useState } from 'react';
import {
  AlertTriangle,
  Thermometer,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Server,
  Wind,
  Tag,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { AlertLevel } from '../../types';
import { ALERT_COLORS } from '../../utils/colors';
import { cn } from '../../lib/utils';

interface FilterSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function FilterSection({ title, icon, children, defaultOpen = true }: FilterSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-cyan-500/20 pb-3">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-2 text-sm font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span>{title}</span>
        </div>
        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {isOpen && <div className="mt-2 space-y-2">{children}</div>}
    </div>
  );
}

export function ControlPanel() {
  const {
    alertFilters,
    toggleAlertFilter,
    showHeatLayer,
    setShowHeatLayer,
    showLabels,
    setShowLabels,
    showRacks,
    setShowRacks,
    showAirFlow,
    setShowAirFlow,
    currentAlerts,
  } = useAppStore();

  const alertLevels: { level: AlertLevel; label: string; icon: React.ReactNode }[] = [
    { level: 'critical', label: '严重告警', icon: <AlertTriangle size={14} /> },
    { level: 'warning', label: '一般告警', icon: <AlertTriangle size={14} /> },
    { level: 'info', label: '提示信息', icon: <AlertTriangle size={14} /> },
  ];

  const layerToggles = [
    {
      key: 'heatLayer',
      label: '热力层',
      icon: <Thermometer size={14} />,
      value: showHeatLayer,
      onChange: setShowHeatLayer,
    },
    {
      key: 'racks',
      label: '机柜',
      icon: <Server size={14} />,
      value: showRacks,
      onChange: setShowRacks,
    },
    {
      key: 'labels',
      label: '标签',
      icon: <Tag size={14} />,
      value: showLabels,
      onChange: setShowLabels,
    },
    {
      key: 'airflow',
      label: '气流',
      icon: <Wind size={14} />,
      value: showAirFlow,
      onChange: setShowAirFlow,
    },
  ];

  const alertCounts = alertLevels.reduce((acc, { level }) => {
    acc[level] = currentAlerts.filter((a) => a.level === level).length;
    return acc;
  }, {} as Record<AlertLevel, number>);

  return (
    <div className="absolute left-4 top-20 bottom-24 w-64 bg-slate-900/90 backdrop-blur-md rounded-lg border border-cyan-500/20 shadow-2xl overflow-hidden flex flex-col">
      <div className="p-4 border-b border-cyan-500/20">
        <h2 className="text-lg font-bold text-cyan-400 flex items-center gap-2">
          <Server size={20} />
          控制面板
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <FilterSection title="告警筛选" icon={<AlertTriangle size={16} />}>
          <div className="space-y-2">
            {alertLevels.map(({ level, label, icon }) => (
              <button
                key={level}
                onClick={() => toggleAlertFilter(level)}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-all',
                  alertFilters.includes(level)
                    ? 'bg-cyan-500/20 border border-cyan-500/50'
                    : 'bg-slate-800/50 border border-transparent hover:bg-slate-700/50'
                )}
              >
                <div className="flex items-center gap-2">
                  <span style={{ color: ALERT_COLORS[level] }}>{icon}</span>
                  <span className="text-gray-300">{label}</span>
                </div>
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-mono"
                  style={{
                    backgroundColor: `${ALERT_COLORS[level]}30`,
                    color: ALERT_COLORS[level],
                  }}
                >
                  {alertCounts[level]}
                </span>
              </button>
            ))}
          </div>
        </FilterSection>

        <FilterSection title="图层控制" icon={<Eye size={16} />}>
          <div className="space-y-2">
            {layerToggles.map(({ key, label, icon, value, onChange }) => (
              <button
                key={key}
                onClick={() => onChange(!value)}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-all',
                  value
                    ? 'bg-cyan-500/20 border border-cyan-500/50'
                    : 'bg-slate-800/50 border border-transparent hover:bg-slate-700/50'
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-cyan-400">{icon}</span>
                  <span className="text-gray-300">{label}</span>
                </div>
                {value ? (
                  <Eye size={16} className="text-cyan-400" />
                ) : (
                  <EyeOff size={16} className="text-gray-500" />
                )}
              </button>
            ))}
          </div>
        </FilterSection>

        <FilterSection title="图例说明" icon={<Thermometer size={16} />}>
          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-400" />
              <span className="text-gray-400">正常 - 功耗 &lt; 60kW</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <span className="text-gray-400">预警 - 功耗 60-80kW</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-gray-400">严重 - 功耗 &gt; 80kW</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-500" />
              <span className="text-gray-400">离线 - 设备断开</span>
            </div>
          </div>
        </FilterSection>
      </div>
    </div>
  );
}
