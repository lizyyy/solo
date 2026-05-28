import {
  Route,
  Archive,
  Bot,
  Zap,
  Flame,
  Eye,
  EyeOff,
  Camera,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useFilterStore, useViewStore } from '../../store';
import GlassPanel from '../common/GlassPanel';
import ToggleSwitch from '../common/ToggleSwitch';
import type { Position3D } from '../../types';

interface LayerItem {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  visible: boolean;
  onToggle: () => void;
}

const PRESET_VIEWS: Array<{
  label: string;
  position: Position3D;
  target: Position3D;
}> = [
  {
    label: '俯视',
    position: { x: 25, y: 60, z: 0 },
    target: { x: 25, y: 0, z: 12.5 },
  },
  {
    label: '侧视',
    position: { x: -30, y: 12.5, z: 0 },
    target: { x: 25, y: 12.5, z: 0 },
  },
  {
    label: '斜视',
    position: { x: 35, y: 40, z: 35 },
    target: { x: 25, y: 12.5, z: 0 },
  },
];

export default function LayerPanel() {
  const showPaths = useFilterStore((s) => s.showPaths);
  const toggleShowPaths = useFilterStore((s) => s.toggleShowPaths);
  const showHeatmap = useFilterStore((s) => s.showHeatmap);
  const toggleShowHeatmap = useFilterStore((s) => s.toggleShowHeatmap);
  const densityThreshold = useFilterStore((s) => s.densityThreshold);
  const setDensityThreshold = useFilterStore((s) => s.setDensityThreshold);

  const setCameraPosition = useViewStore((s) => s.setCameraPosition);
  const setCameraTarget = useViewStore((s) => s.setCameraTarget);

  const layers: LayerItem[] = [
    {
      id: 'paths',
      label: '路径云图',
      icon: Route,
      color: 'text-path-cyan',
      visible: showPaths,
      onToggle: toggleShowPaths,
    },
    {
      id: 'shelves',
      label: '货架',
      icon: Archive,
      color: 'text-status-amber',
      visible: true,
      onToggle: () => {},
    },
    {
      id: 'robots',
      label: '机器人',
      icon: Bot,
      color: 'text-accent-blue',
      visible: true,
      onToggle: () => {},
    },
    {
      id: 'charging',
      label: '充电区',
      icon: Zap,
      color: 'text-status-green',
      visible: true,
      onToggle: () => {},
    },
    {
      id: 'heatmap',
      label: '热力图',
      icon: Flame,
      color: 'text-path-orange',
      visible: showHeatmap,
      onToggle: toggleShowHeatmap,
    },
  ];

  return (
    <GlassPanel title="图层控制" icon={<Layers2 className="w-4 h-4" />} className="w-60">
      <div className="space-y-3">
        {layers.map((layer) => (
          <div
            key={layer.id}
            className="flex items-center justify-between py-1"
          >
            <div className="flex items-center gap-2">
              <layer.icon className={cn('w-4 h-4', layer.color)} />
              <span className="text-sm text-slate-300">{layer.label}</span>
            </div>
            {layer.id === 'paths' || layer.id === 'heatmap' ? (
              <ToggleSwitch
                checked={layer.visible}
                onChange={layer.onToggle}
              />
            ) : (
              <button
                onClick={layer.onToggle}
                className="text-slate-400 hover:text-slate-200 transition-colors"
              >
                {layer.visible ? (
                  <Eye className="w-4 h-4" />
                ) : (
                  <EyeOff className="w-4 h-4" />
                )}
              </button>
            )}
          </div>
        ))}

        <div className="pt-2 border-t border-warehouse-border/30">
          <div className="flex justify-between text-xs text-slate-400 mb-1.5">
            <span>密度阈值</span>
            <span className="font-mono text-slate-200">
              {densityThreshold.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={densityThreshold}
            onChange={(e) => setDensityThreshold(Number(e.target.value))}
            className="w-full"
          />
        </div>

        <div className="pt-2 border-t border-warehouse-border/30">
          <span className="text-xs text-slate-400 mb-2 block">颜色映射</span>
          <div className="gradient-bar w-full" />
          <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
            <span>低密度</span>
            <span>中</span>
            <span>高密度</span>
          </div>
        </div>

        <div className="pt-2 border-t border-warehouse-border/30">
          <span className="text-xs text-slate-400 mb-2 block">预设视角</span>
          <div className="flex gap-1.5">
            {PRESET_VIEWS.map((view) => (
              <button
                key={view.label}
                onClick={() => {
                  setCameraPosition(view.position);
                  setCameraTarget(view.target);
                }}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs bg-warehouse-surface border border-warehouse-border/50 text-slate-300 hover:border-accent-blue/40 hover:text-accent-blue transition-all"
              >
                <Camera className="w-3 h-3" />
                {view.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}

function Layers2(props: React.SVGProps<SVGSVGElement> & { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
      <path d="m22.4 10.08-8.58 3.91a2 2 0 0 1-1.66 0L2.6 10.08" />
      <path d="m22.4 14.08-8.58 3.91a2 2 0 0 1-1.66 0L2.6 14.08" />
    </svg>
  );
}
