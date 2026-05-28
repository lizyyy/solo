import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AlertTriangle, AlertCircle, Info, 
  X, Bell, ChevronDown, ChevronUp,
  Clock, MapPin, Wifi
} from 'lucide-react';
import { useEventStore } from '../store/eventStore';
import { useGameStore } from '../store/gameStore';
import { formatTime } from '../utils/time';
import type { EventLog } from '../types/mission';

interface AlertPanelProps {
  maxVisible?: number;
}

export const AlertPanel: React.FC<AlertPanelProps> = ({ maxVisible = 50 }) => {
  const { events, getErrorsByType, getCriticalErrors } = useEventStore();
  const { currentTime, groundStations } = useGameStore();
  
  const [expanded, setExpanded] = useState(true);
  const [filter, setFilter] = useState<'all' | 'info' | 'warning' | 'error' | 'critical'>('all');
  const [showErrorDetail, setShowErrorDetail] = useState<EventLog | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const lastEventCount = useRef(0);

  useEffect(() => {
    if (containerRef.current && events.length > lastEventCount.current) {
      containerRef.current.scrollTop = 0;
    }
    lastEventCount.current = events.length;
  }, [events.length]);

  const filteredEvents = events.filter(e => {
    if (filter === 'all') return true;
    return e.severity === filter;
  }).slice(0, maxVisible);

  const criticalErrors = getCriticalErrors();
  const windowMissed = getErrorsByType('window_missed') as EventLog[];
  const commandTimeout = getErrorsByType('command_timeout') as EventLog[];
  const packetLost = getErrorsByType('data_packet_lost') as EventLog[];

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'error': return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      default: return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'border-red-800 bg-red-900/20';
      case 'error': return 'border-orange-800 bg-orange-900/20';
      case 'warning': return 'border-yellow-800 bg-yellow-900/20';
      default: return 'border-blue-800 bg-blue-900/20';
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      window_start: '窗口开始',
      window_end: '窗口结束',
      window_missed: '窗口错过',
      command_sent: '指令发送',
      command_timeout: '指令超时',
      command_failed: '指令失败',
      data_download_start: '数据下载开始',
      data_download_complete: '数据下载完成',
      data_packet_lost: '数据包丢失',
      mission_start: '任务开始',
      mission_end: '任务结束',
      score_update: '分数更新',
      error: '错误',
    };
    return labels[type] || type;
  };

  const formatErrorDetail = (event: EventLog) => {
    if (!event.errorDetail) return null;

    const { errorType } = event.errorDetail;
    
    if (errorType === 'window_missed' && event.errorDetail.windowMissed) {
      const { reason, scheduledTasks } = event.errorDetail.windowMissed;
      const reasonText = {
        wrong_station: '调度到错误的地面站',
        previous_overrun: '前序任务超时占用',
        insufficient_slew_time: '天线转向时间不足',
        prediction_error: '窗口预报存在误差',
      }[reason] || reason;
      
      return (
        <div className="mt-2 space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <MapPin className="w-3 h-3 text-deep-400" />
            <span className="text-deep-400">错误原因：</span>
            <span className="text-orange-300">{reasonText}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-3 h-3 text-deep-400" />
            <span className="text-deep-400">影响任务：</span>
            <span className="text-orange-300">{scheduledTasks.length} 个任务未执行</span>
          </div>
        </div>
      );
    }

    if (errorType === 'command_timeout' && event.errorDetail.commandTimeout) {
      const { reason, queuePosition, transmittedPercent } = event.errorDetail.commandTimeout;
      const reasonText = {
        queue_position: '队列优先级过低',
        size_too_large: '指令数据包过长',
        retransmission_needed: '需要重试传输',
        solar_conjunction: '日凌干扰',
      }[reason] || reason;
      
      return (
        <div className="mt-2 space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <Wifi className="w-3 h-3 text-deep-400" />
            <span className="text-deep-400">错误原因：</span>
            <span className="text-yellow-300">{reasonText}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-deep-400">队列位置：</span>
            <span className="text-yellow-300">第 {queuePosition + 1} 位</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-deep-400">已传输：</span>
            <span className="text-yellow-300">{transmittedPercent.toFixed(1)}%</span>
          </div>
        </div>
      );
    }

    if (errorType === 'data_packet_lost' && event.errorDetail.dataPacketLost) {
      const { reason, recoveredPercent } = event.errorDetail.dataPacketLost;
      const reasonText = {
        bandwidth_exceeded: '带宽超限',
        rain_fade: '雨衰影响',
        storage_overflow: '存储溢出',
        ground_storage_failure: '地面存储故障',
      }[reason] || reason;
      
      return (
        <div className="mt-2 space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <Wifi className="w-3 h-3 text-deep-400" />
            <span className="text-deep-400">错误原因：</span>
            <span className="text-red-300">{reasonText}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-deep-400">数据恢复率：</span>
            <span className={`${recoveredPercent >= 50 ? 'text-yellow-300' : 'text-red-300'}`}>
              {recoveredPercent.toFixed(1)}%
            </span>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="bg-deep-900 rounded-lg border border-deep-700">
      <div 
        className="px-4 py-3 border-b border-deep-700 flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <Bell className="w-4 h-4 text-gold-400" />
            {criticalErrors.length > 0 && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full text-[8px] flex items-center justify-center">
                {criticalErrors.length}
              </span>
            )}
          </div>
          <h3 className="text-sm font-semibold text-gold-400 font-mono">事件日志</h3>
          
          <div className="flex items-center gap-2 ml-4">
            {[
              { key: 'window_missed', count: windowMissed.length, color: 'text-orange-400', label: '窗口错过' },
              { key: 'command_timeout', count: commandTimeout.length, color: 'text-yellow-400', label: '指令超时' },
              { key: 'data_packet_lost', count: packetLost.length, color: 'text-red-400', label: '丢包' },
            ].map(item => (
              item.count > 0 && (
                <span key={item.key} className={`text-[10px] ${item.color} font-mono`}>
                  {item.label}: {item.count}
                </span>
              )
            ))}
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex bg-deep-800 rounded">
            {[
              { key: 'all', label: '全部' },
              { key: 'critical', label: '严重' },
              { key: 'error', label: '错误' },
              { key: 'warning', label: '警告' },
              { key: 'info', label: '信息' },
            ].map(f => (
              <button
                key={f.key}
                onClick={(e) => {
                  e.stopPropagation();
                  setFilter(f.key as any);
                }}
                className={`px-2 py-1 text-[10px] font-mono transition-colors ${
                  filter === f.key 
                    ? 'bg-gold-600 text-white rounded' 
                    : 'text-deep-400 hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-deep-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-deep-400" />
          )}
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div 
              ref={containerRef}
              className="p-2 max-h-72 overflow-y-auto space-y-1"
            >
              {filteredEvents.length === 0 ? (
                <div className="text-center text-deep-500 py-4 text-sm">
                  暂无事件记录
                </div>
              ) : (
                filteredEvents.map((event, index) => (
                  <motion.div
                    key={`${event.timestamp}-${index}`}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: index * 0.02 }}
                    className={`p-2 rounded border-l-2 cursor-pointer transition-colors hover:bg-deep-800/50 ${getSeverityColor(event.severity)}`}
                    onClick={() => setShowErrorDetail(showErrorDetail?.timestamp === event.timestamp ? null : event)}
                  >
                    <div className="flex items-start gap-2">
                      {getSeverityIcon(event.severity)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono">
                            <span className="text-deep-400">{formatTime(event.timestamp)}</span>
                            {' | '}
                            <span className={event.severity === 'critical' || event.severity === 'error' ? 'text-red-300' : 'text-white'}>
                              {getTypeLabel(event.type)}
                            </span>
                          </span>
                          {event.scoreImpact && event.scoreImpact !== 0 && (
                            <span className={`text-[10px] font-mono ${event.scoreImpact > 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {event.scoreImpact > 0 ? '+' : ''}{event.scoreImpact}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-deep-300 mt-0.5">
                          {event.message}
                        </div>
                        
                        {showErrorDetail?.timestamp === event.timestamp && formatErrorDetail(event)}
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
