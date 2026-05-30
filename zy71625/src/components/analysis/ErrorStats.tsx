import { useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { ErrorType, ERROR_TYPE_INFO, STEPS } from '../../types';
import { ErrorCard } from './ErrorCard';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Filter, RotateCcw, AlertTriangle } from 'lucide-react';

export const ErrorStats = () => {
  const { errorTracking, setFilterOptions, filterOptions, repairSteps, setPlaybackIndex } = useGameStore();
  const [selectedErrorTypes, setSelectedErrorTypes] = useState<ErrorType[]>([]);

  const chartData = [
    { name: '划痕误判', value: errorTracking.scratchMisjudgment, color: '#C0392B', type: 'scratch_misjudgment' as ErrorType },
    { name: '清洗过度', value: errorTracking.overCleaning, color: '#E67E22', type: 'over_cleaning' as ErrorType },
    { name: '试听漏记录', value: errorTracking.missingListeningRecord, color: '#8E44AD', type: 'missing_listening_record' as ErrorType },
  ];

  const filteredErrors = errorTracking.errors.filter(error => {
    if (selectedErrorTypes.length > 0 && !selectedErrorTypes.includes(error.type)) {
      return false;
    }
    return true;
  });

  const toggleErrorType = (type: ErrorType) => {
    setSelectedErrorTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const handleReplay = (error: any) => {
    const stepIndex = repairSteps.findIndex(s => s.id === error.stepId);
    if (stepIndex !== -1) {
      setPlaybackIndex(stepIndex);
    }
  };

  const clearFilters = () => {
    setSelectedErrorTypes([]);
    setFilterOptions({ errorTypes: [] });
  };

  const totalErrors = errorTracking.scratchMisjudgment + errorTracking.overCleaning + errorTracking.missingListeningRecord;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl text-[#D4A574] font-serif">错因分析</h2>
        {selectedErrorTypes.length > 0 && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-2 text-sm text-white/60 hover:text-white/80"
          >
            <RotateCcw size={14} />
            清除筛选
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {chartData.map((item) => (
          <motion.div
            key={item.type}
            onClick={() => toggleErrorType(item.type)}
            className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
              selectedErrorTypes.includes(item.type)
                ? 'bg-white/5'
                : 'bg-[#1a1a1a]'
            }`}
            style={{
              borderColor: selectedErrorTypes.includes(item.type) ? item.color : `${item.color}30`,
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${item.color}20` }}
                >
                  <AlertTriangle size={16} style={{ color: item.color }} />
                </div>
                <span className="text-sm font-serif" style={{ color: item.color }}>
                  {item.name}
                </span>
              </div>
              <span className="text-2xl font-serif" style={{ color: item.color }}>
                {item.value}
              </span>
            </div>
            <p className="text-[10px] text-white/50">
              {ERROR_TYPE_INFO[item.type].description}
            </p>
          </motion.div>
        ))}
      </div>

      {totalErrors > 0 && (
        <div className="bg-[#1a1a1a] rounded-xl border border-[#D4A574]/30 p-6">
          <h3 className="text-[#D4A574] font-serif mb-4">错误分布</h3>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#999', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#999', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #D4A574/30',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-white/80 font-serif flex items-center gap-2">
            <Filter size={16} className="text-[#D4A574]" />
            错误列表
            <span className="text-xs text-white/50">
              ({filteredErrors.length} 条记录)
            </span>
          </h3>
        </div>

        {filteredErrors.length === 0 ? (
          <div className="text-center py-8 text-white/40 font-serif bg-[#1a1a1a] rounded-xl border border-white/5">
            暂无错误记录
          </div>
        ) : (
          <div className="space-y-3">
            {filteredErrors.map((error, index) => (
              <ErrorCard
                key={`${error.timestamp}-${index}`}
                error={error}
                onReplay={handleReplay}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
