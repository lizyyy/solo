import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, Clock, AlertTriangle, Droplets, Thermometer, Wind, MessageSquare } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAppStore } from '../../store/useAppStore';
import { useSyncState } from '../../hooks/useSyncState';
import { PARAMETER_THRESHOLDS, ANOMALY_LEVEL_COLORS, ANOMALY_STATUS_LABELS, ANOMALY_TYPE_LABELS } from '../../types';
import { formatCoordinates } from '../../utils/geoCalculator';

export function BuoyDetailPanel() {
  const {
    selectedBuoyId,
    buoys,
    logs,
    anomalies,
    expandedLogId,
    setSelectedBuoy,
    setExpandedLog,
    updateLogRemark,
  } = useAppStore();

  const { handleAnomalyClick } = useSyncState();
  const [editingRemark, setEditingRemark] = useState<string | null>(null);
  const [remarkText, setRemarkText] = useState('');

  const selectedBuoy = useMemo(() => {
    return buoys.find((b) => b.id === selectedBuoyId);
  }, [buoys, selectedBuoyId]);

  const buoyLogs = useMemo(() => {
    return logs
      .filter((l) => l.buoyId === selectedBuoyId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 24);
  }, [logs, selectedBuoyId]);

  const buoyAnomalies = useMemo(() => {
    return anomalies
      .filter((a) => a.buoyId === selectedBuoyId)
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [anomalies, selectedBuoyId]);

  const trendData = useMemo(() => {
    return buoyLogs.slice(0, 12).reverse().map((log) => ({
      time: new Date(log.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      ph: log.parameters.ph,
      dissolvedOxygen: log.parameters.dissolvedOxygen,
      turbidity: log.parameters.turbidity,
    }));
  }, [buoyLogs]);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const handleSaveRemark = (logId: string) => {
    updateLogRemark(logId, remarkText);
    setEditingRemark(null);
    setRemarkText('');
  };

  const startEditRemark = (log: typeof buoyLogs[0]) => {
    setEditingRemark(log.id);
    setRemarkText(log.remark || '');
  };

  if (!selectedBuoy) return null;

  const statusColors: Record<string, string> = {
    normal: 'text-normal-green',
    warning: 'text-warning-orange',
    danger: 'text-anomaly-red',
  };

  const statusLabels: Record<string, string> = {
    normal: '正常',
    warning: '警告',
    danger: '危险',
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: 300, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 300, opacity: 0 }}
        className="absolute top-20 right-6 w-80 z-10"
      >
        <div className="glass-panel p-4 max-h-[calc(100vh-200px)] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-cyan-glow font-orbitron text-lg glow-text">
              {selectedBuoy.name}
            </h3>
            <button
              onClick={() => setSelectedBuoy(null)}
              className="text-cyan-dim hover:text-cyan-glow transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="space-y-3 mb-6">
            <div className="flex items-center gap-2 text-sm">
              <MapPin size={16} className="text-cyan-glow" />
              <span className="text-cyan-dim">位置:</span>
              <span className="text-white font-roboto-mono">
                {formatCoordinates(selectedBuoy.lat, selectedBuoy.lng)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Droplets size={16} className="text-cyan-glow" />
              <span className="text-cyan-dim">水深:</span>
              <span className="text-white font-roboto-mono">{selectedBuoy.depth} m</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <AlertTriangle size={16} className="text-cyan-glow" />
              <span className="text-cyan-dim">状态:</span>
              <span className={`font-roboto-mono ${statusColors[selectedBuoy.status]}`}>
                {statusLabels[selectedBuoy.status]}
              </span>
            </div>
          </div>

          <div className="mb-6">
            <h4 className="text-cyan-dim text-sm mb-3 font-roboto-mono">实时参数</h4>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(selectedBuoy.parameters).map(([key, value]) => {
                const info = PARAMETER_THRESHOLDS[key as keyof typeof PARAMETER_THRESHOLDS];
                const isExceed = value > info.max || (key === 'ph' && value < info.min) || (key === 'dissolvedOxygen' && value < info.min);
                return (
                  <div
                    key={key}
                    className={`p-2 rounded-lg ${isExceed ? 'bg-anomaly-red/20 border border-anomaly-red/50' : 'bg-ocean-blue/30'}`}
                  >
                    <div className="text-xs text-cyan-dim">{info.name}</div>
                    <div className={`text-lg font-roboto-mono ${isExceed ? 'text-anomaly-red' : 'text-white'}`}>
                      {value.toFixed(2)}
                      <span className="text-xs text-cyan-dim ml-1">{info.unit}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {trendData.length > 0 && (
            <div className="mb-6">
              <h4 className="text-cyan-dim text-sm mb-3 font-roboto-mono">参数趋势</h4>
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E3A5F" />
                    <XAxis dataKey="time" stroke="#0099BB" fontSize={10} />
                    <YAxis stroke="#0099BB" fontSize={10} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1E3A5F',
                        border: '1px solid #00D4FF',
                        borderRadius: '8px',
                      }}
                    />
                    <Line type="monotone" dataKey="ph" stroke="#00D4FF" dot={false} strokeWidth={2} />
                    <Line type="monotone" dataKey="dissolvedOxygen" stroke="#2ED573" dot={false} strokeWidth={2} />
                    <Line type="monotone" dataKey="turbidity" stroke="#FFA502" dot={false} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {buoyAnomalies.length > 0 && (
            <div className="mb-6">
              <h4 className="text-cyan-dim text-sm mb-3 font-roboto-mono">
                关联异常 ({buoyAnomalies.length})
              </h4>
              <div className="space-y-2">
                {buoyAnomalies.slice(0, 5).map((anomaly) => (
                  <div
                    key={anomaly.id}
                    onClick={() => handleAnomalyClick(anomaly.id)}
                    className="p-2 rounded-lg bg-ocean-blue/30 hover:bg-ocean-blue/50 cursor-pointer transition-all border border-transparent hover:border-cyan-glow/30"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: `${ANOMALY_LEVEL_COLORS[anomaly.level]}20`,
                          color: ANOMALY_LEVEL_COLORS[anomaly.level],
                        }}
                      >
                        {ANOMALY_TYPE_LABELS[anomaly.type]}
                      </span>
                      <span
                        className="text-xs"
                        style={{ color: ANOMALY_LEVEL_COLORS[anomaly.level] }}
                      >
                        {ANOMALY_STATUS_LABELS[anomaly.status]}
                      </span>
                    </div>
                    <div className="text-xs text-white">{anomaly.description}</div>
                    <div className="text-xs text-cyan-dim/60 font-roboto-mono mt-1">
                      {formatTime(anomaly.timestamp)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {buoyLogs.length > 0 && (
            <div>
              <h4 className="text-cyan-dim text-sm mb-3 font-roboto-mono">
                最近日志 ({buoyLogs.length})
              </h4>
              <div className="space-y-2">
                {buoyLogs.slice(0, 8).map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  return (
                    <div
                      key={log.id}
                      className={`rounded-lg overflow-hidden transition-all ${
                        log.isBoundarySample
                          ? 'border-2 border-warning-orange bg-warning-orange/10'
                          : 'bg-ocean-blue/30'
                      } ${isExpanded ? 'ring-2 ring-cyan-glow/50' : ''}`}
                    >
                      <div
                        onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                        className="p-2 cursor-pointer hover:bg-ocean-blue/50 transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Clock size={14} className="text-cyan-dim" />
                            <span className="text-xs text-cyan-dim font-roboto-mono">
                              {formatTime(log.timestamp)}
                            </span>
                            {log.isBoundarySample && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-warning-orange/20 text-warning-orange">
                                边界样本
                              </span>
                            )}
                            {log.remark && (
                              <MessageSquare size={14} className="text-cyan-glow" />
                            )}
                          </div>
                          {log.anomalies.length > 0 && (
                            <span className="text-xs text-anomaly-red">
                              {log.anomalies.length} 个异常
                            </span>
                          )}
                        </div>
                      </div>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="px-2 pb-3 border-t border-cyan-glow/20">
                              {log.affectedArea && (
                                <div className="mt-2 p-2 rounded bg-anomaly-red/10 affected-area-highlight">
                                  <div className="text-xs text-cyan-dim mb-1">影响范围</div>
                                  <div className="text-xs text-white font-roboto-mono">
                                    纬度: {log.affectedArea.latRange[0].toFixed(4)} -{' '}
                                    {log.affectedArea.latRange[1].toFixed(4)}
                                  </div>
                                  <div className="text-xs text-white font-roboto-mono">
                                    经度: {log.affectedArea.lngRange[0].toFixed(4)} -{' '}
                                    {log.affectedArea.lngRange[1].toFixed(4)}
                                  </div>
                                  <div className="text-xs text-cyan-dim font-roboto-mono mt-1">
                                    半径: {log.affectedArea.radius.toFixed(2)} km
                                  </div>
                                </div>
                              )}

                              {log.sourceRow && (
                                <div className="mt-2 p-2 rounded bg-normal-green/10 source-row-mark pl-3">
                                  <div className="text-xs text-cyan-dim mb-1">来源行</div>
                                  <div className="text-xs text-white font-roboto-mono">
                                    {log.sourceRow}
                                  </div>
                                </div>
                              )}

                              {editingRemark === log.id ? (
                                <div className="mt-2">
                                  <textarea
                                    value={remarkText}
                                    onChange={(e) => setRemarkText(e.target.value)}
                                    placeholder="输入备注..."
                                    className="w-full p-2 rounded bg-deep-ocean border border-cyan-glow/30 text-white text-sm resize-none"
                                    rows={3}
                                  />
                                  <div className="flex gap-2 mt-2">
                                    <button
                                      onClick={() => handleSaveRemark(log.id)}
                                      className="px-3 py-1 rounded bg-cyan-glow text-deep-ocean text-xs hover:bg-cyan-dim transition-colors"
                                    >
                                      保存
                                    </button>
                                    <button
                                      onClick={() => setEditingRemark(null)}
                                      className="px-3 py-1 rounded bg-ocean-blue text-cyan-dim text-xs hover:bg-ocean-light transition-colors"
                                    >
                                      取消
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="mt-2">
                                  <div className="flex items-center justify-between">
                                    <div className="text-xs text-cyan-dim">人工备注</div>
                                    <button
                                      onClick={() => startEditRemark(log)}
                                      className="text-xs text-cyan-glow hover:underline"
                                    >
                                      {log.remark ? '编辑' : '添加'}
                                    </button>
                                  </div>
                                  <div className="text-xs text-white mt-1">
                                    {log.remark || '暂无备注'}
                                  </div>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
