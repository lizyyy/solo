import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Filter, X, Droplets, Thermometer, Wind, AlertTriangle } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useSyncState } from '../../hooks/useSyncState';
import { PARAMETER_THRESHOLDS, ANOMALY_LEVEL_COLORS, type WaterQualityParams, type AnomalyLevel } from '../../types';

export function FilterPanel() {
  const { filterParams, buoys } = useAppStore();
  const { handleFilterChange } = useSyncState();

  const parameters = useMemo(() => {
    return [
      { key: 'all', name: '全部参数', icon: Filter },
      { key: 'ph', name: PARAMETER_THRESHOLDS.ph.name, icon: Droplets },
      { key: 'dissolvedOxygen', name: PARAMETER_THRESHOLDS.dissolvedOxygen.name, icon: Wind },
      { key: 'turbidity', name: PARAMETER_THRESHOLDS.turbidity.name, icon: Droplets },
      { key: 'temperature', name: PARAMETER_THRESHOLDS.temperature.name, icon: Thermometer },
      { key: 'salinity', name: PARAMETER_THRESHOLDS.salinity.name, icon: Wind },
      { key: 'ammoniaNitrogen', name: PARAMETER_THRESHOLDS.ammoniaNitrogen.name, icon: AlertTriangle },
    ];
  }, []);

  const riskLevels = useMemo(() => {
    return [
      { key: 'all', name: '全部等级', color: '#00D4FF' },
      { key: 'low', name: '低风险', color: ANOMALY_LEVEL_COLORS.low },
      { key: 'medium', name: '中风险', color: ANOMALY_LEVEL_COLORS.medium },
      { key: 'high', name: '高风险', color: ANOMALY_LEVEL_COLORS.high },
      { key: 'critical', name: '严重', color: ANOMALY_LEVEL_COLORS.critical },
    ];
  }, []);

  const handleBuoyToggle = (buoyId: string) => {
    const currentBuoyIds = filterParams.buoyIds;
    const newBuoyIds = currentBuoyIds.includes(buoyId)
      ? currentBuoyIds.filter((id) => id !== buoyId)
      : [...currentBuoyIds, buoyId];
    handleFilterChange({ buoyIds: newBuoyIds });
  };

  const clearAllFilters = () => {
    handleFilterChange({
      parameter: 'all',
      riskLevel: 'all',
      buoyIds: [],
    });
  };

  const hasActiveFilters =
    filterParams.parameter !== 'all' ||
    filterParams.riskLevel !== 'all' ||
    filterParams.buoyIds.length > 0;

  return (
    <motion.div
      initial={{ x: -300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="absolute top-20 left-6 w-72 z-10"
    >
      <div className="glass-panel p-4 max-h-[calc(100vh-200px)] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-cyan-glow font-orbitron text-lg glow-text flex items-center gap-2">
            <Filter size={20} />
            筛选条件
          </h3>
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="text-cyan-dim hover:text-cyan-glow transition-colors flex items-center gap-1 text-sm"
            >
              <X size={16} />
              清除
            </button>
          )}
        </div>

        <div className="mb-6">
          <h4 className="text-cyan-dim text-sm mb-3 font-roboto-mono">水质参数</h4>
          <div className="grid grid-cols-2 gap-2">
            {parameters.map((param) => {
              const Icon = param.icon;
              const isActive = filterParams.parameter === param.key;
              return (
                <button
                  key={param.key}
                  onClick={() =>
                    handleFilterChange({ parameter: param.key as keyof WaterQualityParams | 'all' })
                  }
                  className={`p-2 rounded-lg flex items-center gap-2 text-left transition-all ${
                    isActive
                      ? 'bg-cyan-glow/20 border border-cyan-glow/50 shadow-glow'
                      : 'bg-ocean-blue/30 border border-transparent hover:bg-ocean-blue/50'
                  }`}
                >
                  <Icon
                    size={16}
                    className={isActive ? 'text-cyan-glow' : 'text-cyan-dim'}
                  />
                  <span
                    className={`text-xs ${isActive ? 'text-cyan-glow' : 'text-cyan-dim'}`}
                  >
                    {param.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-6">
          <h4 className="text-cyan-dim text-sm mb-3 font-roboto-mono">风险等级</h4>
          <div className="flex flex-wrap gap-2">
            {riskLevels.map((level) => {
              const isActive = filterParams.riskLevel === level.key;
              return (
                <button
                  key={level.key}
                  onClick={() =>
                    handleFilterChange({ riskLevel: level.key as AnomalyLevel | 'all' })
                  }
                  className={`px-3 py-1.5 rounded-full text-xs font-roboto-mono transition-all ${
                    isActive
                      ? 'ring-2 ring-offset-2 ring-offset-deep-ocean'
                      : 'opacity-70 hover:opacity-100'
                  }`}
                  style={{
                    backgroundColor: `${level.color}20`,
                    color: level.color,
                    borderColor: level.color,
                    borderWidth: '1px',
                    ['--tw-ring-color' as any]: level.color,
                  }}
                >
                  {level.name}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <h4 className="text-cyan-dim text-sm mb-3 font-roboto-mono">
            浮标筛选
            {filterParams.buoyIds.length > 0 && (
              <span className="text-cyan-glow ml-2">
                已选 {filterParams.buoyIds.length} 个
              </span>
            )}
          </h4>
          <div className="space-y-2">
            {buoys.map((buoy) => {
              const isActive = filterParams.buoyIds.includes(buoy.id);
              const statusColors: Record<string, string> = {
                normal: '#2ED573',
                warning: '#FFA502',
                danger: '#FF4757',
              };

              return (
                <button
                  key={buoy.id}
                  onClick={() => handleBuoyToggle(buoy.id)}
                  className={`w-full p-3 rounded-lg flex items-center justify-between transition-all ${
                    isActive
                      ? 'bg-ocean-blue/80 border border-cyan-glow/50'
                      : 'bg-ocean-blue/30 border border-transparent hover:bg-ocean-blue/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: statusColors[buoy.status] }}
                    />
                    <div className="text-left">
                      <div
                        className={`text-sm ${isActive ? 'text-cyan-glow' : 'text-white'}`}
                      >
                        {buoy.name}
                      </div>
                      <div className="text-xs text-cyan-dim/60 font-roboto-mono">
                        {buoy.lat.toFixed(4)}, {buoy.lng.toFixed(4)}
                      </div>
                    </div>
                  </div>
                  <div
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                      isActive
                        ? 'bg-cyan-glow border-cyan-glow'
                        : 'border-cyan-dim/50'
                    }`}
                  >
                    {isActive && (
                      <svg
                        className="w-3 h-3 text-deep-ocean"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
