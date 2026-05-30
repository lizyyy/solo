import React, { useRef, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Gauge,
  Clock,
  AlertTriangle,
  Bookmark,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from 'lucide-react';
import { useDataStore } from '../../store/useDataStore';
import { useUIStore } from '../../store/useUIStore';
import { useTimelinePlayback } from '../../hooks/useTimelinePlayback';
import { formatTime, formatPrice } from '../../utils/formatters';
import { AnomalyType, ANOMALY_TYPE_COLORS } from '../../types/anomaly';

export const Timeline: React.FC = () => {
  const {
    processedSnapshots,
    currentTimeIndex,
    setCurrentTimeIndex,
    anomalies,
    timeRange,
    visibleLevels,
    showBid,
    showAsk,
    showAnomalies,
  } = useDataStore();

  const { setToast } = useUIStore();
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  const {
    isPlaying,
    playbackSpeed,
    setPlaybackSpeed,
    togglePlay,
    stepForward,
    stepBackward,
    jumpToStart,
    jumpToEnd,
  } = useTimelinePlayback();

  const speeds = [0.25, 0.5, 1, 2, 4, 8];

  const totalSnapshots = processedSnapshots.length;
  const currentSnapshot = processedSnapshots[currentTimeIndex];

  const getAnomalyMarkers = useCallback(() => {
    if (!anomalies || anomalies.length === 0) return [];
    
    const markerMap = new Map<number, { types: AnomalyType[]; severity: number }>();
    
    anomalies.forEach((anomaly) => {
      const snapshotIndex = anomaly.snapshotIndex;
      if (snapshotIndex >= 0 && snapshotIndex < totalSnapshots) {
        const existing = markerMap.get(snapshotIndex);
        if (existing) {
          existing.types.push(anomaly.type);
          existing.severity = Math.max(existing.severity, anomaly.severity);
        } else {
          markerMap.set(snapshotIndex, {
            types: [anomaly.type],
            severity: anomaly.severity,
          });
        }
      }
    });

    return Array.from(markerMap.entries()).map(([index, data]) => ({
      index,
      position: totalSnapshots > 1 ? (index / (totalSnapshots - 1)) * 100 : 0,
      ...data,
    }));
  }, [anomalies, totalSnapshots]);

  const anomalyMarkers = getAnomalyMarkers();

  const handleTimelineClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!timelineRef.current || totalSnapshots <= 1) return;
      
      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, x / rect.width));
      const newIndex = Math.round(percentage * (totalSnapshots - 1));
      
      setCurrentTimeIndex(newIndex);
      setToast(`已跳转到 ${formatTime(processedSnapshots[newIndex]?.timestamp || 0)}`, 'info');
    },
    [totalSnapshots, setCurrentTimeIndex, setToast, processedSnapshots]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!timelineRef.current || totalSnapshots <= 1) return;
      
      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, x / rect.width));
      const index = Math.round(percentage * (totalSnapshots - 1));
      setHoveredIndex(index);
      
      if (isDragging) {
        setCurrentTimeIndex(index);
      }
    },
    [totalSnapshots, isDragging, setCurrentTimeIndex]
  );

  const handleMouseDown = () => {
    setIsDragging(true);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseUp = () => setIsDragging(false);
      window.addEventListener('mouseup', handleGlobalMouseUp);
      return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }
  }, [isDragging]);

  const progressPercent = totalSnapshots > 1 ? (currentTimeIndex / (totalSnapshots - 1)) * 100 : 0;

  const getVolumeBarHeight = (snapshot: typeof processedSnapshots[0]) => {
    if (!snapshot) return 0;
    
    let totalVolume = 0;
    let maxVolume = 1;
    
    snapshot.bids.forEach((bid, i) => {
      if (visibleLevels.includes(i + 1) && showBid) {
        totalVolume += bid.quantity;
      }
    });
    
    snapshot.asks.forEach((ask, i) => {
      if (visibleLevels.includes(i + 1) && showAsk) {
        totalVolume += ask.quantity;
      }
    });

    processedSnapshots.forEach((s) => {
      let vol = 0;
      s.bids.forEach((b, i) => {
        if (visibleLevels.includes(i + 1) && showBid) vol += b.quantity;
      });
      s.asks.forEach((a, i) => {
        if (visibleLevels.includes(i + 1) && showAsk) vol += a.quantity;
      });
      maxVolume = Math.max(maxVolume, vol);
    });

    return Math.min(100, (totalVolume / maxVolume) * 100);
  };

  return (
    <motion.div
      className="absolute bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-700/50"
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <div className="px-6 py-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={jumpToStart}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-all"
                title="跳到开始"
              >
                <SkipBack size={18} />
              </button>
              <button
                onClick={stepBackward}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-all"
                title="上一帧"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={togglePlay}
                className="p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all shadow-lg shadow-blue-600/30 hover:shadow-blue-500/40"
                title={isPlaying ? '暂停' : '播放'}
              >
                {isPlaying ? <Pause size={20} /> : <Play size={20} />}
              </button>
              <button
                onClick={stepForward}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-all"
                title="下一帧"
              >
                <ChevronRight size={18} />
              </button>
              <button
                onClick={jumpToEnd}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-all"
                title="跳到结束"
              >
                <SkipForward size={18} />
              </button>
            </div>

            <div className="relative">
              <button
                onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-300 hover:text-white hover:bg-slate-700/50 rounded-lg transition-all"
              >
                <Gauge size={14} />
                <span>{playbackSpeed}x</span>
              </button>
              
              <AnimatePresence>
                {showSpeedMenu && (
                  <motion.div
                    className="absolute bottom-full left-0 mb-2 bg-slate-800 border border-slate-600 rounded-lg shadow-xl overflow-hidden"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                  >
                    {speeds.map((speed) => (
                      <button
                        key={speed}
                        onClick={() => {
                          setPlaybackSpeed(speed);
                          setShowSpeedMenu(false);
                        }}
                        className={`block w-full px-4 py-2 text-sm text-left transition-all ${
                          playbackSpeed === speed
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {speed}x 速度
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {currentSnapshot && (
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2 text-slate-400">
                  <Clock size={14} />
                  <span className="text-white font-mono">
                    {formatTime(currentSnapshot.timestamp)}
                  </span>
                </div>
                <div className="h-4 w-px bg-slate-600" />
                <div className="text-slate-400">
                  快照 <span className="text-white font-mono">{currentTimeIndex + 1}</span>
                  <span className="text-slate-500"> / {totalSnapshots}</span>
                </div>
                {timeRange && (
                  <>
                    <div className="h-4 w-px bg-slate-600" />
                    <div className="text-slate-400">
                      买一 <span className="text-cyan-400 font-mono">{formatPrice(currentSnapshot.bids[0]?.price || 0)}</span>
                    </div>
                    <div className="text-slate-400">
                      卖一 <span className="text-rose-400 font-mono">{formatPrice(currentSnapshot.asks[0]?.price || 0)}</span>
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="flex items-center gap-2">
              <button className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-all">
                <ZoomIn size={16} />
              </button>
              <button className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-all">
                <ZoomOut size={16} />
              </button>
              <button className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-all">
                <Maximize2 size={16} />
              </button>
            </div>
          </div>
        </div>

        <div
          ref={timelineRef}
          className="relative h-20 bg-slate-800/50 rounded-xl border border-slate-700/50 cursor-pointer overflow-hidden group"
          onClick={handleTimelineClick}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            setHoveredIndex(null);
            setIsDragging(false);
          }}
        >
          <div className="absolute inset-0 flex items-end gap-px px-1 pb-1">
            {processedSnapshots.map((snapshot, i) => {
              const height = getVolumeBarHeight(snapshot);
              const hasAnomaly = anomalyMarkers.some((m) => m.index === i);
              const isBid = i % 2 === 0;
              
              return (
                <motion.div
                  key={snapshot.id || i}
                  className="flex-1 rounded-t transition-all"
                  style={{
                    height: `${Math.max(4, height)}%`,
                    backgroundColor: hasAnomaly
                      ? '#ef4444'
                      : isBid
                      ? 'rgba(34, 211, 238, 0.4)'
                      : 'rgba(251, 113, 133, 0.4)',
                    opacity: i === currentTimeIndex ? 1 : 0.6,
                  }}
                  whileHover={{ opacity: 1, scaleY: 1.05 }}
                />
              );
            })}
          </div>

          {showAnomalies && anomalyMarkers.map((marker, i) => (
            <motion.div
              key={`marker-${i}`}
              className="absolute bottom-0 w-0.5 pointer-events-none"
              style={{
                left: `${marker.position}%`,
                height: '100%',
                background: `linear-gradient(to top, ${ANOMALY_TYPE_COLORS[marker.types[0]] || '#ef4444'}, transparent)`,
                opacity: 0.8,
              }}
            >
              <div
                className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full"
                style={{ backgroundColor: ANOMALY_TYPE_COLORS[marker.types[0]] || '#ef4444' }}
              />
            </motion.div>
          ))}

          <motion.div
            className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg shadow-white/30 pointer-events-none"
            style={{ left: `${progressPercent}%` }}
          >
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-white rounded-full shadow-lg" />
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-white rounded-full shadow-lg" />
          </motion.div>

          <AnimatePresence>
            {hoveredIndex !== null && processedSnapshots[hoveredIndex] && (
              <motion.div
                className="absolute top-2 px-3 py-1.5 bg-slate-900/95 border border-slate-600 rounded-lg text-xs pointer-events-none z-10"
                style={{
                  left: `${totalSnapshots > 1 ? (hoveredIndex / (totalSnapshots - 1)) * 100 : 0}%`,
                  transform: 'translateX(-50%)',
                }}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
              >
                <div className="text-white font-mono">
                  {formatTime(processedSnapshots[hoveredIndex].timestamp)}
                </div>
                <div className="text-slate-400">
                  快照 {hoveredIndex + 1} / {totalSnapshots}
                </div>
                {anomalyMarkers.find((m) => m.index === hoveredIndex) && (
                  <div className="flex items-center gap-1 mt-1 text-rose-400">
                    <AlertTriangle size={10} />
                    <span>存在异常</span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-slate-900/80 to-transparent pointer-events-none" />
        </div>

        <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
          <span>{processedSnapshots[0] ? formatTime(processedSnapshots[0].timestamp) : '--:--:--'}</span>
          <div className="flex items-center gap-4">
            {anomalyMarkers.length > 0 && (
              <div className="flex items-center gap-1.5 text-rose-400">
                <AlertTriangle size={12} />
                <span>{anomalyMarkers.length} 个异常时间点</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-slate-400">
              <Bookmark size={12} />
              <span>拖拽时间轴快速定位</span>
            </div>
          </div>
          <span>{processedSnapshots[processedSnapshots.length - 1] ? formatTime(processedSnapshots[processedSnapshots.length - 1].timestamp) : '--:--:--'}</span>
        </div>
      </div>
    </motion.div>
  );
};
