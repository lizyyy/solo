import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  AlertCircle,
  Clock,
  Layers,
  RefreshCw,
  Database,
  Hash,
  ArrowRightLeft,
  FileWarning,
  ChevronDown,
  ChevronUp,
  Filter,
  Search,
  Target,
  Lightbulb,
  Wrench,
} from 'lucide-react';
import { useDataStore } from '../../store/useDataStore';
import { useUIStore } from '../../store/useUIStore';
import {
  AnomalyType,
  Anomaly,
  ANOMALY_TYPE_NAMES,
  ANOMALY_TYPE_COLORS,
  ANOMALY_DESCRIPTIONS,
} from '../../types/anomaly';
import { formatTime, formatLevel, formatSide } from '../../utils/formatters';

const getAnomalyIcon = (type: AnomalyType) => {
  const iconMap: Record<AnomalyType, React.ReactNode> = {
    price_misalignment: <Layers size={14} />,
    duplicate_cancellation: <RefreshCw size={14} />,
    time_grain_chaos: <Clock size={14} />,
    null_value: <Database size={14} />,
    duplicate_entry: <Hash size={14} />,
    boundary_extreme: <AlertCircle size={14} />,
    time_reversal: <ArrowRightLeft size={14} />,
    missing_snapshot: <FileWarning size={14} />,
  };
  return iconMap[type] || <AlertTriangle size={14} />;
};

export const AnomalyCard: React.FC = () => {
  const {
    anomalies,
    processedSnapshots,
    setCurrentTimeIndex,
    selectedCube,
    selectCube,
    cubes,
  } = useDataStore();
  const { setRightPanelOpen } = useUIStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<AnomalyType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const anomalyStats = useMemo(() => {
    const stats: Record<AnomalyType, { count: number; severity: number }> = {} as Record<AnomalyType, { count: number; severity: number }>;
    
    anomalies.forEach((anomaly) => {
      if (!stats[anomaly.type]) {
        stats[anomaly.type] = { count: 0, severity: 0 };
      }
      stats[anomaly.type].count++;
      stats[anomaly.type].severity = Math.max(stats[anomaly.type].severity, anomaly.severity);
    });

    return stats;
  }, [anomalies]);

  const filteredAnomalies = useMemo(() => {
    return anomalies.filter((anomaly) => {
      const typeMatch = filterType === 'all' || anomaly.type === filterType;
      const queryMatch = !searchQuery || 
        anomaly.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ANOMALY_TYPE_NAMES[anomaly.type].toLowerCase().includes(searchQuery.toLowerCase());
      return typeMatch && queryMatch;
    });
  }, [anomalies, filterType, searchQuery]);

  const totalAnomalies = anomalies.length;
  const highSeverityCount = anomalies.filter((a) => a.severity >= 3).length;

  const handleJumpToAnomaly = (anomaly: Anomaly) => {
    setCurrentTimeIndex(anomaly.snapshotIndex);
    setRightPanelOpen(true);
    
    if (anomaly.level !== undefined && anomaly.side !== undefined) {
      const cube = cubes.find(
        (c) =>
          c.timestamp === processedSnapshots[anomaly.snapshotIndex]?.timestamp &&
          c.level === anomaly.level &&
          c.isBid === (anomaly.side === 'bid')
      );
      if (cube) {
        selectCube(cube);
      }
    }
  };

  if (totalAnomalies === 0) {
    return (
      <div className="p-6 text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-emerald-500/10 rounded-full flex items-center justify-center">
          <AlertCircle className="text-emerald-500" size={28} />
        </div>
        <h3 className="text-lg font-medium text-slate-300 mb-2">数据质量良好</h3>
        <p className="text-sm text-slate-500">
          未检测到异常数据。盘口快照完整，档位对齐，时间序列正常。
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <motion.div
        className="bg-gradient-to-br from-rose-500/10 to-amber-500/10 border border-rose-500/20 rounded-xl p-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-rose-500/20 rounded-xl flex items-center justify-center">
            <AlertTriangle className="text-rose-400" size={20} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">异常检测结果</h3>
            <p className="text-sm text-slate-400">共检测到 {totalAnomalies} 个异常</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-800/50 rounded-lg p-3">
            <p className="text-xs text-slate-400 mb-1">高严重度</p>
            <p className="text-xl font-bold text-rose-400">{highSeverityCount}</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3">
            <p className="text-xs text-slate-400 mb-1">异常类型</p>
            <p className="text-xl font-bold text-amber-400">{Object.keys(anomalyStats).length}</p>
          </div>
        </div>
      </motion.div>

      <div className="space-y-2">
        <h4 className="text-xs font-medium text-slate-400 px-1">异常类型分布</h4>
        <div className="flex flex-wrap gap-2">
          {Object.entries(anomalyStats).map(([type, data]) => (
            <motion.button
              key={type}
              onClick={() => setFilterType(filterType === type ? 'all' : type as AnomalyType)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                filterType === type
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50'
              }`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {getAnomalyIcon(type as AnomalyType)}
              <span>{ANOMALY_TYPE_NAMES[type as AnomalyType]}</span>
              <span
                className="ml-1 px-1.5 py-0.5 rounded text-xs"
                style={{ backgroundColor: `${ANOMALY_TYPE_COLORS[type as AnomalyType]}30` }}
              >
                {data.count}
              </span>
            </motion.button>
          ))}
          {filterType !== 'all' && (
            <button
              onClick={() => setFilterType('all')}
              className="px-2.5 py-1.5 bg-slate-700/50 text-slate-300 rounded-lg text-xs hover:bg-slate-700 transition-all"
            >
              清除筛选
            </button>
          )}
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
        <input
          type="text"
          placeholder="搜索异常描述..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-all"
        />
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
        <AnimatePresence>
          {filteredAnomalies.map((anomaly, index) => (
            <motion.div
              key={anomaly.id}
              className="bg-slate-800/50 border border-slate-700/30 rounded-xl overflow-hidden"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ delay: index * 0.03 }}
            >
              <div
                className="p-3 cursor-pointer hover:bg-slate-700/30 transition-all"
                onClick={() => setExpandedId(expandedId === anomaly.id ? null : anomaly.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${ANOMALY_TYPE_COLORS[anomaly.type]}20` }}
                    >
                      <div style={{ color: ANOMALY_TYPE_COLORS[anomaly.type] }}>
                        {getAnomalyIcon(anomaly.type)}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-white text-sm">
                          {ANOMALY_TYPE_NAMES[anomaly.type]}
                        </h4>
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3].map((i) => (
                            <div
                              key={i}
                              className={`w-1.5 h-1.5 rounded-full ${
                                i <= anomaly.severity
                                  ? 'bg-rose-500'
                                  : 'bg-slate-600'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-1">
                        {anomaly.description}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Clock size={10} />
                          {formatTime(anomaly.timestamp)}
                        </span>
                        {anomaly.level !== undefined && (
                          <span className="flex items-center gap-1">
                            <Layers size={10} />
                            {formatSide(anomaly.side === 'bid')} {formatLevel(anomaly.level)}
                          </span>
                        )}
                        <span>#{anomaly.snapshotIndex + 1}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleJumpToAnomaly(anomaly);
                      }}
                      className="px-2 py-1 text-xs bg-blue-600/20 text-blue-400 rounded hover:bg-blue-600/30 transition-all"
                    >
                      定位
                    </button>
                    {expandedId === anomaly.id ? (
                      <ChevronUp size={16} className="text-slate-400" />
                    ) : (
                      <ChevronDown size={16} className="text-slate-400" />
                    )}
                  </div>
                </div>
              </div>

              <AnimatePresence>
                {expandedId === anomaly.id && (
                  <motion.div
                    className="border-t border-slate-700/30"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                  >
                    <div className="p-4 space-y-4 bg-slate-900/50">
                      <div>
                        <h5 className="text-xs font-medium text-slate-400 mb-2 flex items-center gap-1.5">
                          <Target size={12} />
                          异常说明
                        </h5>
                        <p className="text-sm text-slate-300 leading-relaxed">
                          {ANOMALY_DESCRIPTIONS[anomaly.type]?.pattern || ''}
                        </p>
                      </div>

                      <div>
                        <h5 className="text-xs font-medium text-slate-400 mb-2 flex items-center gap-1.5">
                          <AlertTriangle size={12} />
                          影响分析
                        </h5>
                        <p className="text-sm text-slate-300 leading-relaxed">
                          {anomaly.impact || '该异常可能导致盘口深度计算偏差、策略信号误触发。建议结合上下文进一步分析。'}
                        </p>
                      </div>

                      <div>
                        <h5 className="text-xs font-medium text-slate-400 mb-2 flex items-center gap-1.5">
                          <Lightbulb size={12} />
                          处理建议
                        </h5>
                        <ul className="text-sm text-slate-300 space-y-1">
                          {(anomaly.suggestions || ['检查数据来源是否正确', '考虑插值或跳过该异常点', '评估对策略的实际影响']).map((suggestion, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-blue-400 mt-1">•</span>
                              <span>{suggestion}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {anomaly.rawData && (
                        <div>
                          <h5 className="text-xs font-medium text-slate-400 mb-2 flex items-center gap-1.5">
                            <Database size={12} />
                            原始数据
                          </h5>
                          <pre className="text-xs text-slate-400 bg-slate-950/50 p-2 rounded-lg overflow-x-auto">
                            {JSON.stringify(anomaly.rawData, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </AnimatePresence>

        {filteredAnomalies.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            <Filter size={24} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">没有匹配的异常记录</p>
          </div>
        )}
      </div>
    </div>
  );
};
