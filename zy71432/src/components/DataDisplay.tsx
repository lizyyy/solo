import { useGameStore } from '../store/gameStore';
import { formatPhysicsForDisplay } from '../physics/aerodynamics';
import { Gauge, Wind, ArrowDown, Zap, Activity } from 'lucide-react';

export const DataDisplay = () => {
  const { currentPhysics, trackProgress, frameCount } = useGameStore();
  const display = formatPhysicsForDisplay(currentPhysics);

  const progressPercent = (trackProgress * 100).toFixed(1);

  const GaugeBar = ({ 
    label, 
    value, 
    max, 
    unit, 
    color,
    icon: Icon 
  }: { 
    label: string; 
    value: number; 
    max: number; 
    unit: string;
    color: string;
    icon: React.ElementType;
  }) => {
    const percent = Math.min(100, (value / max) * 100);
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1 text-gray-400">
            <Icon className="w-3 h-3" />
            <span>{label}</span>
          </div>
          <span className={`font-mono font-bold ${color}`}>
            {value.toFixed(1)} {unit}
          </span>
        </div>
        <div className="h-1.5 bg-[#1e3a5f] rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-100 rounded-full ${
              color.includes('green') ? 'bg-green-500' :
              color.includes('red') ? 'bg-red-500' :
              color.includes('orange') ? 'bg-orange-500' :
              'bg-cyan-500'
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="bg-[#0f1c33] border border-[#1e3a5f] rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-[#00d4ff] font-['Orbitron'] tracking-wider">
          实时数据
        </h2>
        <span className="text-xs text-gray-500">帧: {frameCount}</span>
      </div>

      <div className="bg-[#0a1628] rounded-lg p-4 border border-[#1e3a5f]">
        <div className="text-center">
          <div className="text-xs text-gray-400 mb-1">当前速度</div>
          <div className="text-4xl font-bold text-white font-['Orbitron'] tracking-wider">
            {display.speedKmh}
            <span className="text-lg text-gray-400 ml-1">km/h</span>
          </div>
        </div>
        
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-400">赛道进度</span>
            <span className="text-[#00d4ff] font-mono">{progressPercent}%</span>
          </div>
          <div className="h-2 bg-[#1e3a5f] rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-[#00d4ff] to-[#ff6b35] rounded-full transition-all duration-100"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#0a1628] rounded-lg p-3 border border-[#1e3a5f]">
          <GaugeBar
            label="加速度"
            value={currentPhysics.acceleration}
            max={15}
            unit="m/s²"
            color="text-green-400"
            icon={Activity}
          />
        </div>
        
        <div className="bg-[#0a1628] rounded-lg p-3 border border-[#1e3a5f]">
          <GaugeBar
            label="有效功率"
            value={currentPhysics.effectivePower / 1000}
            max={500}
            unit="kW"
            color="text-[#00d4ff]"
            icon={Zap}
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="bg-[#0a1628] rounded-lg p-3 border border-[#1e3a5f]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Wind className="w-4 h-4 text-[#ff6b35]" />
              <span className="text-sm text-white">空气阻力 F<sub>d</sub></span>
            </div>
            <span className="text-lg font-bold text-[#ff6b35] font-mono">
              {display.dragForceKN} kN
            </span>
          </div>
          <div className="h-1.5 bg-[#1e3a5f] rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 rounded-full transition-all duration-100"
              style={{ width: `${Math.min(100, (currentPhysics.dragForce / 8000) * 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-gray-500 mt-1">
            <span>0</span>
            <span>4 kN 阈值</span>
            <span>8 kN</span>
          </div>
        </div>

        <div className="bg-[#0a1628] rounded-lg p-3 border border-[#1e3a5f]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <ArrowDown className="w-4 h-4 text-[#00d4ff]" />
              <span className="text-sm text-white">下压力 F<sub>df</sub></span>
            </div>
            <span className="text-lg font-bold text-[#00d4ff] font-mono">
              {display.downForceKN} kN
            </span>
          </div>
          <div className="h-1.5 bg-[#1e3a5f] rounded-full overflow-hidden">
            <div 
              className="h-full bg-[#00d4ff] rounded-full transition-all duration-100"
              style={{ width: `${Math.min(100, Math.max(0, (currentPhysics.downForce / 10000) * 100))}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-gray-500 mt-1">
            <span>0</span>
            <span>正下压力</span>
            <span>10 kN</span>
          </div>
        </div>

        <div className="bg-[#0a1628] rounded-lg p-3 border border-[#1e3a5f]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Gauge className="w-4 h-4 text-[#4ade80]" />
              <span className="text-sm text-white">抓地力 μ</span>
            </div>
            <span className="text-lg font-bold text-[#4ade80] font-mono">
              {display.grip}
            </span>
          </div>
          <div className="h-1.5 bg-[#1e3a5f] rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-100 ${
                currentPhysics.grip > 0.9 ? 'bg-green-500' :
                currentPhysics.grip > 0.65 ? 'bg-yellow-500' :
                'bg-red-500'
              }`}
              style={{ width: `${Math.min(100, (currentPhysics.grip / 1.5) * 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] mt-1">
            <span className="text-red-500">0.65 阈值</span>
            <span className="text-gray-500">0.9 良好</span>
            <span className="text-green-500">1.5 最大</span>
          </div>
        </div>
      </div>

      <div className="bg-[#0a1628] rounded-lg p-3 border border-[#1e3a5f]">
        <div className="text-xs text-gray-400 mb-2">相对风速</div>
        <div className="text-2xl font-bold text-white font-mono">
          {(currentPhysics.relativeWindSpeed * 3.6).toFixed(1)}
          <span className="text-sm text-gray-400 ml-1">km/h</span>
        </div>
        <div className="text-[10px] text-gray-500 mt-1">
          包含赛车自身速度和环境风速的矢量叠加
        </div>
      </div>

      <div className="bg-[#0a1628] rounded-lg p-3 border border-[#1e3a5f]">
        <div className="text-xs text-gray-400 mb-2">瞬时计算值</div>
        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
          <div className="flex justify-between">
            <span className="text-gray-500">动压:</span>
            <span className="text-gray-300">
              {(0.5 * 1.225 * currentPhysics.relativeWindSpeed ** 2 / 1000).toFixed(2)} kPa
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">推力:</span>
            <span className="text-gray-300">
              {currentPhysics.speed > 0.1 
                ? ((currentPhysics.effectivePower / currentPhysics.speed) / 1000).toFixed(2)
                : '—'} kN
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
