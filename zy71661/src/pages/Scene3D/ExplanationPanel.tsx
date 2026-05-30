import { useSimulationStore } from '@/store/useSimulationStore';
import { useUIStore } from '@/store/useUIStore';
import { SUPPLEMENT_COLOR } from '@/constants/config';
import { Zap, ArrowDown, Wind, Gauge, Thermometer } from 'lucide-react';
import type { DataPoint } from '@/types/simulation';

function findNearestPoint(points: DataPoint[], time: number): DataPoint | null {
  if (points.length === 0) return null;
  let nearest = points[0];
  let minDiff = Math.abs(points[0].timestamp - time);
  for (let i = 1; i < points.length; i++) {
    const diff = Math.abs(points[i].timestamp - time);
    if (diff < minDiff) {
      minDiff = diff;
      nearest = points[i];
    }
  }
  return nearest;
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-200" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

function EnergyTab({ point, totalEnergy }: { point: DataPoint; totalEnergy: number }) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-1.5 text-gray-300"><Thermometer size={14} /> 势能</span>
          <span className="font-mono text-blue-400">{point.potentialEnergy.toFixed(2)} J</span>
        </div>
        <ProgressBar value={point.potentialEnergy} max={totalEnergy} color="#60a5fa" />
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-1.5 text-gray-300"><Zap size={14} /> 动能</span>
          <span className="font-mono text-yellow-400">{point.kineticEnergy.toFixed(2)} J</span>
        </div>
        <ProgressBar value={point.kineticEnergy} max={totalEnergy} color="#facc15" />
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-1.5 text-gray-300"><ArrowDown size={14} /> 摩擦损耗</span>
          <span className="font-mono text-red-400">{point.frictionLoss.toFixed(2)} J</span>
        </div>
        <ProgressBar value={point.frictionLoss} max={totalEnergy} color="#f87171" />
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-1.5 text-gray-300"><Wind size={14} /> 空气阻力损耗</span>
          <span className="font-mono text-purple-400">{point.airDragLoss.toFixed(2)} J</span>
        </div>
        <ProgressBar value={point.airDragLoss} max={totalEnergy} color="#c084fc" />
      </div>
      <div className="pt-2 border-t border-gray-700">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-200 font-medium">总能量</span>
          <span className="font-mono text-green-400">{point.totalEnergy.toFixed(2)} J</span>
        </div>
      </div>
    </div>
  );
}

function ForceTab({ point }: { point: DataPoint }) {
  return (
    <div className="space-y-3">
      <div className="p-2 bg-gray-750 rounded-lg space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-300">重力分量</span>
          <span className="font-mono text-orange-400">{point.normalForce.toFixed(2)} N</span>
        </div>
        <p className="text-xs text-gray-500">沿坡面方向的重力分量，驱动滑板加速</p>
      </div>
      <div className="p-2 bg-gray-750 rounded-lg space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-300">法向力</span>
          <span className="font-mono text-blue-400">{point.normalForce.toFixed(2)} N</span>
        </div>
        <p className="text-xs text-gray-500">坡面对滑板的支持力，垂直于接触面</p>
      </div>
      <div className="p-2 bg-gray-750 rounded-lg space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-300">摩擦力</span>
          <span className="font-mono text-red-400">{point.frictionForce.toFixed(2)} N</span>
        </div>
        <p className="text-xs text-gray-500">与运动方向相反，消耗动能转化为热能</p>
      </div>
      <div className="p-2 bg-gray-750 rounded-lg space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-300">空气阻力</span>
          <span className="font-mono text-purple-400">{point.airDragForce.toFixed(2)} N</span>
        </div>
        <p className="text-xs text-gray-500">与速度平方成正比，高速时影响显著</p>
      </div>
    </div>
  );
}

function VelocityTab({ point }: { point: DataPoint }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 text-gray-300"><Gauge size={14} /> 速度</span>
        <span className="font-mono text-cyan-400">{point.velocity.toFixed(2)} m/s</span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 text-gray-300"><Zap size={14} /> 加速度</span>
        <span className="font-mono text-amber-400">{point.acceleration.toFixed(2)} m/s²</span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 text-gray-300"><ArrowDown size={14} /> 位置</span>
        <span className="font-mono text-lime-400">{point.position.toFixed(2)} m</span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 text-gray-300"><Wind size={14} /> 时间</span>
        <span className="font-mono text-gray-400">{point.timestamp.toFixed(2)} s</span>
      </div>
    </div>
  );
}

const TAB_CONFIG = [
  { key: 'energy' as const, label: '能量', icon: Zap },
  { key: 'force' as const, label: '受力', icon: ArrowDown },
  { key: 'velocity' as const, label: '速度', icon: Gauge },
];

export default function ExplanationPanel() {
  const { currentSimulation, currentTime, activeTab, setActiveTab } = useSimulationStore();
  const { setShowAnomalyPanel } = useUIStore();

  const dataPoints = currentSimulation?.dataPoints ?? [];
  const anomalies = currentSimulation?.anomalies ?? [];
  const point = findNearestPoint(dataPoints, currentTime);
  const maxTotalEnergy = dataPoints.length > 0 ? Math.max(...dataPoints.map(p => p.totalEnergy)) : 1;
  const unconfirmedAnomalies = anomalies.filter(a => !a.isConfirmed);

  if (!point) {
    return (
      <div className="w-72 h-full bg-gray-900/95 border-l border-gray-700 flex items-center justify-center text-gray-500 text-sm">
        暂无数据
      </div>
    );
  }

  return (
    <div className="w-72 h-full bg-gray-900/95 border-l border-gray-700 flex flex-col">
      <div className="flex border-b border-gray-700">
        {TAB_CONFIG.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 py-2.5 text-xs flex items-center justify-center gap-1 transition-colors ${
              activeTab === key
                ? 'text-white border-b-2 border-blue-500 bg-gray-800/50'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      <div className={`flex-1 overflow-y-auto p-3 ${point.isSupplemented ? 'border-2 border-orange-500 rounded-lg m-1' : ''}`}>
        {point.isSupplemented && (
          <div className="mb-2 px-2 py-1 rounded text-xs font-medium text-white text-center" style={{ backgroundColor: SUPPLEMENT_COLOR }}>
            补录
          </div>
        )}
        {activeTab === 'energy' && <EnergyTab point={point} totalEnergy={maxTotalEnergy} />}
        {activeTab === 'force' && <ForceTab point={point} />}
        {activeTab === 'velocity' && <VelocityTab point={point} />}
      </div>

      {unconfirmedAnomalies.length > 0 && (
        <div className="border-t border-gray-700 p-2">
          <button
            onClick={() => setShowAnomalyPanel(true)}
            className="w-full flex items-center justify-between px-2 py-1.5 bg-red-900/30 hover:bg-red-900/50 rounded text-xs text-red-400 transition-colors"
          >
            <span>{unconfirmedAnomalies.length} 个未确认异常</span>
            <span>→</span>
          </button>
        </div>
      )}
    </div>
  );
}
