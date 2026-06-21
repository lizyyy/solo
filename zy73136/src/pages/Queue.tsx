import { useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  Clock,
  MapPin,
  FileText,
  Eye,
  CheckCircle,
  XCircle,
  PauseCircle,
  Filter,
  ChevronRight,
  Layers,
  ArrowRight,
  Home,
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { useSyncState } from '../hooks/useSyncState';
import {
  ANOMALY_LEVEL_COLORS,
  ANOMALY_LEVEL_LABELS,
  ANOMALY_TYPE_LABELS,
  ANOMALY_STATUS_LABELS,
  PARAMETER_THRESHOLDS,
  type Anomaly,
  type AnomalyStatus,
  type AnomalyLevel,
  type AnomalyType,
} from '../types';

export default function Queue() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    anomalies,
    logs,
    buoys,
    selectedAnomalyId,
    getFilteredAnomalies,
    filterParams,
    updateAnomalyStatus,
    setSelectedAnomaly,
    setFilter,
  } = useAppStore();
  const { handleBuoyClick, handleAnomalyClick, handleTimeChange } = useSyncState();

  const filteredAnomalies = useMemo(() => {
    return getFilteredAnomalies().sort((a, b) => {
      const levelOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const levelDiff = levelOrder[a.level] - levelOrder[b.level];
      if (levelDiff !== 0) return levelDiff;
      return b.timestamp - a.timestamp;
    });
  }, [getFilteredAnomalies]);

  const stats = useMemo(() => {
    const data = filteredAnomalies;
    const total = data.length;
    const pending = data.filter((a) => a.status === 'pending').length;
    const processing = data.filter((a) => a.status === 'processing').length;
    const resolved = data.filter((a) => a.status === 'resolved').length;
    const ignored = data.filter((a) => a.status === 'ignored').length;

    const byLevel: Record<AnomalyLevel, number> = {
      low: data.filter((a) => a.level === 'low').length,
      medium: data.filter((a) => a.level === 'medium').length,
      high: data.filter((a) => a.level === 'high').length,
      critical: data.filter((a) => a.level === 'critical').length,
    };

    return { total, pending, processing, resolved, ignored, byLevel };
  }, [filteredAnomalies]);

  const selectedAnomaly = useMemo(() => {
    if (!selectedAnomalyId) return null;
    return anomalies.find((a) => a.id === selectedAnomalyId);
  }, [selectedAnomalyId, anomalies]);

  useEffect(() => {
    const state = location.state as { anomalyId?: string } | null;
    if (state?.anomalyId && state.anomalyId !== selectedAnomalyId) {
      handleAnomalyClick(state.anomalyId);
    }
  }, [location.state, selectedAnomalyId, handleAnomalyClick]);

  const getTraceChain = useMemo(() => {
    if (!selectedAnomaly) return null;

    const buoy = buoys.find((b) => b.id === selectedAnomaly.buoyId);
    const relatedLog = logs.find((l) => {
      if (selectedAnomaly.logId && l.id === selectedAnomaly.logId) return true;
      return l.anomalies.some((a) => a.id === selectedAnomaly.id);
    });

    return {
      anomaly: selectedAnomaly,
      buoy,
      log: relatedLog,
    };
  }, [selectedAnomaly, buoys, logs]);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const getStatusIcon = (status: AnomalyStatus) => {
    switch (status) {
      case 'pending':
        return <AlertTriangle size={16} />;
      case 'processing':
        return <PauseCircle size={16} />;
      case 'resolved':
        return <CheckCircle size={16} />;
      case 'ignored':
        return <XCircle size={16} />;
    }
  };

  const navigateToHome = (anomaly: Anomaly) => {
    handleAnomalyClick(anomaly.id);
    navigate('/');
  };

  const navigateToLog = (logId: string) => {
    navigate('/logs', { state: { logId, anomalyId: selectedAnomalyId } });
  };

  const handleStatusFilterChange = (value: AnomalyStatus | 'all') => {
    setFilter({ status: value });
  };

  const handleLevelFilterChange = (value: AnomalyLevel | 'all') => {
    setFilter({ riskLevel: value });
  };

  const handleTypeFilterChange = (value: AnomalyType | 'all') => {
    setFilter({ type: value as any });
  };

  const handleAnomalySelect = (anomalyId: string) => {
    handleAnomalyClick(anomalyId);
  };

  return (
    <div className="min-h-screen bg-deep-ocean pt-20 pb-8 px-6">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-orbitron text-cyan-glow glow-text flex items-center gap-3">
                <AlertTriangle size={32} />
                异常队列
              </h1>
              <p className="text-cyan-dim mt-2">
                管理和处理所有水质异常事件，支持状态追踪和完整链路追溯
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/')}
                className="px-4 py-2 rounded-lg border border-cyan-glow/30 text-cyan-glow hover:bg-ocean-blue/30 transition-colors flex items-center gap-2"
              >
                <Home size={18} />
                返回3D视图
              </button>
              <button
                onClick={() => navigate('/logs')}
                className="px-4 py-2 rounded-lg bg-cyan-glow text-deep-ocean font-semibold hover:bg-cyan-dim transition-colors flex items-center gap-2"
              >
                查看日志
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-6 gap-4 mb-6"
        >
          <div className="glass-panel p-4">
            <div className="text-cyan-dim text-sm mb-1 flex items-center gap-1">
              <AlertTriangle size={14} />
              总异常
            </div>
            <div className="text-2xl font-orbitron text-white">{stats.total}</div>
          </div>
          <div className="glass-panel p-4">
            <div className="text-warning-orange text-sm mb-1 flex items-center gap-1">
              <AlertTriangle size={14} />
              待处理
            </div>
            <div className="text-2xl font-orbitron text-warning-orange">
              {stats.pending}
            </div>
          </div>
          <div className="glass-panel p-4">
            <div className="text-cyan-glow text-sm mb-1 flex items-center gap-1">
              <PauseCircle size={14} />
              处理中
            </div>
            <div className="text-2xl font-orbitron text-cyan-glow">
              {stats.processing}
            </div>
          </div>
          <div className="glass-panel p-4">
            <div className="text-normal-green text-sm mb-1 flex items-center gap-1">
              <CheckCircle size={14} />
              已解决
            </div>
            <div className="text-2xl font-orbitron text-normal-green">
              {stats.resolved}
            </div>
          </div>
          <div className="glass-panel p-4">
            <div className="text-cyan-dim text-sm mb-1 flex items-center gap-1">
              <XCircle size={14} />
              已忽略
            </div>
            <div className="text-2xl font-orbitron text-cyan-dim">
              {stats.ignored}
            </div>
          </div>
          <div className="glass-panel p-4">
            <div className="text-anomaly-red text-sm mb-1 flex items-center gap-1">
              <AlertTriangle size={14} />
              严重
            </div>
            <div className="text-2xl font-orbitron text-anomaly-red">
              {stats.byLevel.critical}
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-3 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="col-span-2"
          >
            <div className="glass-panel p-6 h-full">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-orbitron text-cyan-glow flex items-center gap-2">
                  <Layers size={20} />
                  异常列表
                  <span className="text-sm text-cyan-dim font-roboto-mono ml-2">
                    共 {filteredAnomalies.length} 条
                  </span>
                </h2>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <Filter size={14} className="text-cyan-dim" />
                    <select
                      value={filterParams.status}
                      onChange={(e) =>
                        handleStatusFilterChange(e.target.value as AnomalyStatus | 'all')
                      }
                      className="px-3 py-1.5 rounded-lg bg-ocean-blue/30 border border-cyan-glow/30 text-white text-sm focus:outline-none focus:border-cyan-glow/50"
                    >
                      <option value="all">全部状态</option>
                      <option value="pending">待处理</option>
                      <option value="processing">处理中</option>
                      <option value="resolved">已解决</option>
                      <option value="ignored">已忽略</option>
                    </select>
                  </div>
                  <select
                    value={filterParams.riskLevel}
                    onChange={(e) =>
                      handleLevelFilterChange(e.target.value as AnomalyLevel | 'all')
                    }
                    className="px-3 py-1.5 rounded-lg bg-ocean-blue/30 border border-cyan-glow/30 text-white text-sm focus:outline-none focus:border-cyan-glow/50"
                  >
                    <option value="all">全部等级</option>
                    <option value="low">低风险</option>
                    <option value="medium">中风险</option>
                    <option value="high">高风险</option>
                    <option value="critical">严重</option>
                  </select>
                  <select
                    value={(filterParams as any).type || 'all'}
                    onChange={(e) =>
                      handleTypeFilterChange(e.target.value as AnomalyType | 'all')
                    }
                    className="px-3 py-1.5 rounded-lg bg-ocean-blue/30 border border-cyan-glow/30 text-white text-sm focus:outline-none focus:border-cyan-glow/50"
                  >
                    <option value="all">全部类型</option>
                    <option value="parameter">参数超标</option>
                    <option value="trend">趋势异常</option>
                    <option value="boundary">边界样本</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
                <AnimatePresence>
                  {filteredAnomalies.length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="h-64 flex flex-col items-center justify-center text-cyan-dim"
                    >
                      <CheckCircle size={48} className="mb-4 opacity-30" />
                      <p className="text-lg">暂无符合条件的异常记录</p>
                    </motion.div>
                  ) : (
                    filteredAnomalies.map((anomaly) => {
                      const buoy = buoys.find((b) => b.id === anomaly.buoyId);
                      const isSelected = selectedAnomalyId === anomaly.id;

                      return (
                        <motion.div
                          key={anomaly.id}
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          onClick={() =>
                            handleAnomalySelect(anomaly.id)
                          }
                          className={`p-4 rounded-lg cursor-pointer transition-all border ${
                            isSelected
                              ? 'bg-ocean-blue/60 border-cyan-glow/50 shadow-glow ring-2 ring-cyan-glow/30'
                              : 'bg-ocean-blue/20 border-transparent hover:bg-ocean-blue/40 hover:border-cyan-glow/30'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3 flex-1">
                              <div
                                className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
                                style={{
                                  backgroundColor:
                                    ANOMALY_LEVEL_COLORS[anomaly.level],
                                  boxShadow: `0 0 10px ${ANOMALY_LEVEL_COLORS[anomaly.level]}`,
                                }}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span
                                    className="text-xs px-2 py-0.5 rounded-full"
                                    style={{
                                      backgroundColor: `${ANOMALY_LEVEL_COLORS[anomaly.level]}20`,
                                      color: ANOMALY_LEVEL_COLORS[anomaly.level],
                                    }}
                                  >
                                    {ANOMALY_LEVEL_LABELS[anomaly.level]}
                                  </span>
                                  <span
                                    className="text-xs px-2 py-0.5 rounded-full"
                                    style={{
                                      backgroundColor: `${ANOMALY_LEVEL_COLORS[anomaly.level]}10`,
                                      color: ANOMALY_LEVEL_COLORS[anomaly.level],
                                    }}
                                  >
                                    {ANOMALY_TYPE_LABELS[anomaly.type]}
                                  </span>
                                  {anomaly.parameter && (
                                    <span className="text-xs text-cyan-dim">
                                      {
                                        PARAMETER_THRESHOLDS[anomaly.parameter]
                                          ?.name
                                      }
                                    </span>
                                  )}
                                </div>
                                <div className="text-white text-sm mb-1">
                                  {anomaly.description}
                                </div>
                                <div className="flex items-center gap-3 text-xs text-cyan-dim">
                                  <span className="flex items-center gap-1">
                                    <MapPin size={12} />
                                    {buoy?.name || anomaly.buoyId}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock size={12} />
                                    {formatTime(anomaly.timestamp)}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 ml-4">
                              <div
                                className="flex items-center gap-1 px-2 py-1 rounded"
                                style={{
                                  backgroundColor: `${ANOMALY_LEVEL_COLORS[anomaly.level]}10`,
                                  color: ANOMALY_LEVEL_COLORS[anomaly.level],
                                }}
                              >
                                {getStatusIcon(anomaly.status)}
                                <span className="text-xs">
                                  {ANOMALY_STATUS_LABELS[anomaly.status]}
                                </span>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigateToHome(anomaly);
                                }}
                                className="p-1.5 text-cyan-dim hover:text-cyan-glow hover:bg-ocean-blue/50 rounded transition-colors"
                                title="在3D视图中查看"
                              >
                                <Eye size={16} />
                              </button>
                            </div>
                          </div>

                          <AnimatePresence>
                            {isSelected && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="mt-4 pt-4 border-t border-cyan-glow/20">
                                  <div className="flex items-center gap-2 mb-3">
                                    <span className="text-cyan-dim text-sm">
                                      更新状态：
                                    </span>
                                    <div className="flex gap-2">
                                      {(['pending', 'processing', 'resolved', 'ignored'] as AnomalyStatus[]).map(
                                        (status) => (
                                          <button
                                            key={status}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              updateAnomalyStatus(
                                                anomaly.id,
                                                status
                                              );
                                            }}
                                            className={`px-3 py-1 rounded text-xs flex items-center gap-1 transition-colors ${
                                              anomaly.status === status
                                                ? 'ring-2 ring-offset-2 ring-offset-deep-ocean'
                                                : 'opacity-70 hover:opacity-100'
                                            }`}
                                            style={{
                                              backgroundColor: `${ANOMALY_LEVEL_COLORS[anomaly.level]}10`,
                                              color:
                                                ANOMALY_LEVEL_COLORS[
                                                  anomaly.level
                                                ],
                                              ['--tw-ring-color' as any]:
                                                ANOMALY_LEVEL_COLORS[
                                                  anomaly.level
                                                ],
                                            }}
                                          >
                                            {getStatusIcon(status)}
                                            {ANOMALY_STATUS_LABELS[status]}
                                          </button>
                                        )
                                      )}
                                    </div>
                                  </div>

                                  {anomaly.affectedArea && (
                                    <div className="p-3 rounded-lg bg-cyan-glow/10 mb-3">
                                      <div className="text-cyan-glow text-sm mb-1 flex items-center gap-1">
                                        <MapPin size={14} />
                                        影响范围
                                      </div>
                                      <div className="text-xs text-white font-roboto-mono space-y-1">
                                        <div>
                                          半径：{anomaly.affectedArea.radius.toFixed(2)} km
                                        </div>
                                        <div>
                                          纬度：{anomaly.affectedArea.latRange[0].toFixed(4)} -{' '}
                                          {anomaly.affectedArea.latRange[1].toFixed(4)}
                                        </div>
                                        <div>
                                          经度：{anomaly.affectedArea.lngRange[0].toFixed(4)} -{' '}
                                          {anomaly.affectedArea.lngRange[1].toFixed(4)}
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {anomaly.details && (
                                    <div className="p-3 rounded-lg bg-ocean-blue/30">
                                      <div className="text-cyan-dim text-sm mb-1">
                                        详细信息
                                      </div>
                                      <div className="text-xs text-white">
                                        {typeof anomaly.details === 'string'
                                          ? anomaly.details
                                          : JSON.stringify(
                                              anomaly.details,
                                              null,
                                              2
                                            )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      );
                    })
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
            className="col-span-1"
          >
            <div className="glass-panel p-6 h-full">
              <h2 className="text-xl font-orbitron text-cyan-glow mb-4 flex items-center gap-2">
                <FileText size={20} />
                追踪链路
              </h2>

              <AnimatePresence>
                {!getTraceChain ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="h-96 flex flex-col items-center justify-center text-cyan-dim"
                  >
                    <ArrowRight size={48} className="mb-4 opacity-30" />
                    <p className="text-lg">选择异常查看完整链路</p>
                    <p className="text-sm mt-2">
                      从浮标日志到异常事件的完整追溯
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                  >
                    <div className="p-4 rounded-lg bg-anomaly-red/10 border-l-4 border-anomaly-red">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle
                          size={18}
                          className="text-anomaly-red"
                        />
                        <span
                          className="text-sm font-semibold"
                          style={{ color: ANOMALY_LEVEL_COLORS[getTraceChain.anomaly.level] }}
                        >
                          异常事件
                        </span>
                      </div>
                      <div className="text-white text-sm mb-2">
                        {getTraceChain.anomaly.description}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <span
                          className="text-xs px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: `${ANOMALY_LEVEL_COLORS[getTraceChain.anomaly.level]}20`,
                            color:
                              ANOMALY_LEVEL_COLORS[
                                getTraceChain.anomaly.level
                              ],
                          }}
                        >
                          {ANOMALY_TYPE_LABELS[getTraceChain.anomaly.type]}
                        </span>
                        <span
                          className="text-xs px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: `${ANOMALY_LEVEL_COLORS[getTraceChain.anomaly.level]}10`,
                            color:
                              ANOMALY_LEVEL_COLORS[
                                getTraceChain.anomaly.level
                              ],
                          }}
                        >
                          {
                            ANOMALY_STATUS_LABELS[
                              getTraceChain.anomaly.status
                            ]
                          }
                        </span>
                      </div>
                      <div className="text-xs text-cyan-dim mt-2 font-roboto-mono">
                        {formatTime(getTraceChain.anomaly.timestamp)}
                      </div>
                    </div>

                    <div className="flex justify-center">
                      <ArrowRight
                        size={24}
                        className="text-cyan-dim rotate-90"
                      />
                    </div>

                    <div
                      className="p-4 rounded-lg bg-ocean-blue/30 cursor-pointer hover:bg-ocean-blue/50 transition-colors border border-transparent hover:border-cyan-glow/30"
                      onClick={() => handleBuoyClick(getTraceChain.anomaly.buoyId)}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <MapPin size={18} className="text-cyan-glow" />
                        <span className="text-cyan-glow text-sm font-semibold">
                          关联浮标
                        </span>
                      </div>
                      {getTraceChain.buoy ? (
                        <>
                          <div className="text-white text-lg font-orbitron mb-1">
                            {getTraceChain.buoy.name}
                          </div>
                          <div className="text-xs text-cyan-dim font-roboto-mono">
                            {getTraceChain.buoy.lat.toFixed(4)},{' '}
                            {getTraceChain.buoy.lng.toFixed(4)}
                          </div>
                          <div className="text-xs text-cyan-dim mt-1">
                            水深：{getTraceChain.buoy.depth} m
                          </div>
                        </>
                      ) : (
                        <div className="text-cyan-dim text-sm">
                          {getTraceChain.anomaly.buoyId}
                        </div>
                      )}
                    </div>

                    <div className="flex justify-center">
                      <ArrowRight
                        size={24}
                        className="text-cyan-dim rotate-90"
                      />
                    </div>

                    <div
                      className="p-4 rounded-lg bg-normal-green/10 cursor-pointer hover:bg-normal-green/20 transition-colors border-l-4 border-normal-green source-row-mark pl-6"
                      onClick={() => {
                        if (getTraceChain.log) {
                          navigateToLog(getTraceChain.log.id);
                        }
                      }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <FileText size={18} className="text-normal-green" />
                        <span className="text-normal-green text-sm font-semibold">
                          来源日志
                        </span>
                      </div>
                      {getTraceChain.log ? (
                        <>
                          <div className="text-white text-sm mb-2">
                            {formatTime(getTraceChain.log.timestamp)}
                          </div>
                          {getTraceChain.log.isBoundarySample && (
                            <div className="mb-2">
                              <span className="text-xs px-2 py-0.5 rounded-full bg-warning-orange/20 text-warning-orange">
                                边界样本
                              </span>
                            </div>
                          )}
                          {getTraceChain.log.remark && (
                            <div className="text-xs text-cyan-glow mt-2">
                              备注：{getTraceChain.log.remark}
                            </div>
                          )}
                          <div className="text-xs text-cyan-dim mt-2 font-roboto-mono">
                            pH: {getTraceChain.log.parameters.ph.toFixed(2)}, 
                            DO: {getTraceChain.log.parameters.dissolvedOxygen.toFixed(2)}, 
                            浊度: {getTraceChain.log.parameters.turbidity.toFixed(2)}
                          </div>
                        </>
                      ) : (
                        <div className="text-cyan-dim text-sm">
                          未找到关联日志
                        </div>
                      )}
                    </div>

                    {getTraceChain.log?.sourceRow && (
                      <>
                        <div className="flex justify-center">
                          <ArrowRight
                            size={24}
                            className="text-cyan-dim rotate-90"
                          />
                        </div>

                        <div className="p-4 rounded-lg bg-deep-ocean/50">
                          <div className="text-cyan-dim text-xs mb-2 flex items-center gap-1">
                            <FileText size={14} />
                            原始数据行
                          </div>
                          <div className="p-2 rounded bg-deep-ocean">
                            <code className="text-xs text-white/80 font-roboto-mono break-all">
                              {getTraceChain.log.sourceRow}
                            </code>
                          </div>
                        </div>
                      </>
                    )}

                    <div className="pt-4 mt-4 border-t border-cyan-glow/20">
                      <button
                        onClick={() => navigateToHome(getTraceChain.anomaly)}
                        className="w-full px-4 py-2 rounded-lg bg-cyan-glow text-deep-ocean font-semibold hover:bg-cyan-dim transition-colors flex items-center justify-center gap-2"
                      >
                        <Eye size={18} />
                        在3D视图中定位
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
