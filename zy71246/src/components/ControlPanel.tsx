import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, Pause, FastForward, SkipForward, 
  Download, Send, Plus, Zap, BarChart3,
  List, Package, ArrowUpDown, Magnet
} from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { useScheduleStore } from '../store/scheduleStore';
import { useEventStore } from '../store/eventStore';
import { formatTime } from '../utils/time';
import { calculateTransmissionTime, sortCommandsByPriority } from '../engine/queueEngine';
import type { Command, DataPacket, GroundStation, VisibilityWindow } from '../types/mission';

interface ControlPanelProps {
  onAutoSchedule?: () => void;
  onGenerateReport?: () => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({ 
  onAutoSchedule, 
  onGenerateReport 
}) => {
  const { 
    status, 
    speed,
    startGame, 
    pauseGame, 
    resumeGame, 
    setSpeed,
    dataPackets,
    commands,
    groundStations,
    visibilityWindows,
    activeTransmissions,
    addToQueue,
  } = useGameStore();

  const { blocks, addDownloadBlock, addCommandBlock, autoSchedule } = useScheduleStore();
  const { events } = useEventStore();

  const [selectedPacket, setSelectedPacket] = useState<string | null>(null);
  const [selectedCommand, setSelectedCommand] = useState<string | null>(null);
  const [selectedWindow, setSelectedWindow] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'packets' | 'commands' | 'stations'>('packets');

  const pendingPackets = dataPackets.filter(p => !p.isDownloaded);
  const pendingCommands = commands.filter(c => c.status === 'queued');
  const sortedCommands = sortCommandsByPriority(pendingCommands);
  const availableWindows = visibilityWindows.filter(w => w.status === 'predicted');

  const handleAddDownloadBlock = () => {
    if (!selectedPacket || !selectedWindow) return;
    
    const window = visibilityWindows.find(w => w.id === selectedWindow);
    if (!window) return;

    const packet = dataPackets.find(p => p.id === selectedPacket);
    if (!packet) return;

    const station = groundStations.find(s => s.id === window.groundStationId);
    if (!station) return;

    const requiredTime = (packet.size * 8) / (station.bandwidth * 0.85) * 1000;
    const endTime = Math.min(window.startTime + requiredTime, window.endTime);

    addDownloadBlock(
      window,
      station,
      [packet],
      window.startTime
    );
    
    setSelectedPacket(null);
  };

  const handleAddCommandBlock = () => {
    if (!selectedCommand || !selectedWindow) return;
    
    const window = visibilityWindows.find(w => w.id === selectedWindow);
    if (!window) return;

    const command = commands.find(c => c.id === selectedCommand);
    if (!command) return;

    const station = groundStations.find(s => s.id === window.groundStationId);
    if (!station) return;

    const requiredTime = calculateTransmissionTime(command, station.bandwidth);
    const startTime = window.startTime;
    const endTime = Math.min(startTime + requiredTime, window.endTime);

    addCommandBlock(
      window,
      station,
      [command],
      startTime
    );
    
    addToQueue(window.groundStationId, selectedCommand);
    setSelectedCommand(null);
  };

  const handleAutoSchedule = () => {
    autoSchedule(visibilityWindows, groundStations, dataPackets, commands);
    onAutoSchedule?.();
  };

  return (
    <div className="bg-deep-900 rounded-lg border border-deep-700">
      <div className="px-4 py-3 border-b border-deep-700 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gold-400 font-mono">测控控制台</h3>
        <div className="flex items-center gap-2">
          {status === 'idle' && (
            <button
              onClick={startGame}
              className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-500 rounded text-xs font-mono transition-colors"
            >
              <Play className="w-3 h-3" />
              开始任务
            </button>
          )}
          {status === 'running' && (
            <button
              onClick={pauseGame}
              className="flex items-center gap-1 px-3 py-1.5 bg-yellow-600 hover:bg-yellow-500 rounded text-xs font-mono transition-colors"
            >
              <Pause className="w-3 h-3" />
              暂停
            </button>
          )}
          {status === 'paused' && (
            <button
              onClick={resumeGame}
              className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-500 rounded text-xs font-mono transition-colors"
            >
              <Play className="w-3 h-3" />
              继续
            </button>
          )}
          
          {status !== 'completed' && (
            <div className="flex items-center gap-1 bg-deep-800 rounded px-2">
              {[0.5, 1, 2, 4, 8].map(s => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={`px-2 py-1 text-[10px] font-mono rounded transition-colors ${
                    speed === s ? 'bg-gold-600 text-white' : 'text-deep-400 hover:text-white'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          )}

          {status === 'completed' && (
            <button
              onClick={onGenerateReport}
              className="flex items-center gap-1 px-3 py-1.5 bg-gold-600 hover:bg-gold-500 rounded text-xs font-mono transition-colors"
            >
              <BarChart3 className="w-3 h-3" />
              生成报告
            </button>
          )}
        </div>
      </div>

      {status !== 'running' && status !== 'completed' && (
        <div className="px-4 py-2 border-b border-deep-700 flex items-center gap-4">
          <button
            onClick={handleAutoSchedule}
            className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 rounded text-xs font-mono transition-colors"
          >
            <Zap className="w-3 h-3" />
            智能自动调度
          </button>
          <span className="text-xs text-deep-500">
            提示：点击下方任务和窗口，然后点击「+」按钮添加调度
          </span>
        </div>
      )}

      <div className="flex border-b border-deep-700">
        {[
          { key: 'packets', label: '数据包', icon: Package, count: pendingPackets.length },
          { key: 'commands', label: '指令队列', icon: Send, count: pendingCommands.length },
          { key: 'stations', label: '地面站', icon: Magnet, count: groundStations.length },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex-1 px-4 py-2 text-xs font-mono flex items-center justify-center gap-2 transition-colors ${
              activeTab === tab.key 
                ? 'bg-deep-800 text-gold-400 border-b-2 border-gold-500' 
                : 'text-deep-400 hover:text-white'
            }`}
          >
            <tab.icon className="w-3 h-3" />
            {tab.label}
            {tab.count > 0 && (
              <span className="bg-deep-700 px-1.5 rounded text-[10px]">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      <div className="p-4 max-h-64 overflow-y-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'packets' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-2"
            >
              {pendingPackets.length === 0 ? (
                <div className="text-center text-deep-500 py-4 text-sm">所有数据包已下载</div>
              ) : (
                pendingPackets.map(packet => (
                  <motion.div
                    key={packet.id}
                    whileHover={{ scale: 1.01 }}
                    className={`p-3 rounded border cursor-pointer transition-colors ${
                      selectedPacket === packet.id 
                        ? 'border-green-500 bg-green-900/20' 
                        : 'border-deep-700 bg-deep-800/50 hover:border-deep-500'
                    }`}
                    onClick={() => setSelectedPacket(packet.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Download className={`w-4 h-4 ${packet.priority === 'critical' ? 'text-red-400' : 'text-blue-400'}`} />
                        <span className="text-sm font-mono">{packet.dataType}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                          packet.priority === 'critical' ? 'bg-red-900/50 text-red-300' :
                          packet.priority === 'high' ? 'bg-orange-900/50 text-orange-300' :
                          'bg-blue-900/50 text-blue-300'
                        }`}>
                          {packet.priority}
                        </span>
                      </div>
                      <span className="text-xs text-deep-400 font-mono">{packet.size} MB</span>
                    </div>
                    <div className="mt-1 text-[11px] text-deep-500">
                      {packet.description}
                    </div>
                  </motion.div>
                ))
              )}
            </motion.div>
          )}

          {activeTab === 'commands' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-2"
            >
              {sortedCommands.length === 0 ? (
                <div className="text-center text-deep-500 py-4 text-sm">所有指令已发送</div>
              ) : (
                sortedCommands.map(command => (
                  <motion.div
                    key={command.id}
                    whileHover={{ scale: 1.01 }}
                    className={`p-3 rounded border cursor-pointer transition-colors ${
                      selectedCommand === command.id 
                        ? 'border-blue-500 bg-blue-900/20' 
                        : 'border-deep-700 bg-deep-800/50 hover:border-deep-500'
                    }`}
                    onClick={() => setSelectedCommand(command.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Send className={`w-4 h-4 ${command.priority <= 1 ? 'text-red-400' : 'text-yellow-400'}`} />
                        <span className="text-sm font-mono">{command.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                          command.priority <= 1 ? 'bg-red-900/50 text-red-300' :
                          command.priority <= 2 ? 'bg-orange-900/50 text-orange-300' :
                          'bg-yellow-900/50 text-yellow-300'
                        }`}>
                          P{command.priority}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-deep-400 font-mono">{command.size} KB</div>
                        <div className="text-[10px] text-deep-500">TTL: {formatTime(command.timeToLive)}</div>
                      </div>
                    </div>
                    <div className="mt-1 text-[11px] text-deep-500">
                      {command.description}
                    </div>
                  </motion.div>
                ))
              )}
            </motion.div>
          )}

          {activeTab === 'stations' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-2"
            >
              <div className="mb-3">
                <div className="text-xs text-deep-400 mb-2">选择可见窗口进行调度：</div>
                {availableWindows.length === 0 ? (
                  <div className="text-center text-deep-500 py-2 text-sm">暂无可用窗口</div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {availableWindows.map(window => {
                      const station = groundStations.find(s => s.id === window.groundStationId);
                      return (
                        <div
                          key={window.id}
                          className={`p-2 rounded border cursor-pointer transition-colors ${
                            selectedWindow === window.id 
                              ? 'border-gold-500 bg-gold-900/20' 
                              : 'border-deep-700 bg-deep-800/50 hover:border-deep-500'
                          }`}
                          onClick={() => setSelectedWindow(window.id)}
                        >
                          <div className="text-xs font-mono text-gold-400">{station?.name}</div>
                          <div className="text-[10px] text-deep-400">
                            {formatTime(window.startTime)} - {formatTime(window.endTime)}
                          </div>
                          <div className="text-[10px] text-deep-500">
                            时长: {formatTime(window.duration)} | 仰角: {window.maxElevation}°
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {groundStations.map(station => (
                <div key={station.id} className="p-3 rounded border border-deep-700 bg-deep-800/50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Magnet className="w-4 h-4 text-gold-400" />
                      <span className="text-sm font-mono text-gold-400">{station.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-deep-400">
                      <span>带宽: {station.bandwidth} Mbps</span>
                      <span>天线: {station.antennaDiameter}m</span>
                    </div>
                  </div>
                  <div className="text-[11px] text-deep-500">
                    位置: {station.name} | 坐标: {station.latitude.toFixed(2)}°, {station.longitude.toFixed(2)}°
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {status !== 'running' && status !== 'completed' && (selectedPacket || selectedCommand) && selectedWindow && (
        <div className="px-4 py-3 border-t border-deep-700 bg-deep-800/50 flex items-center justify-between">
          <div className="text-xs text-deep-300">
            {selectedPacket && `下载: ${dataPackets.find(p => p.id === selectedPacket)?.dataType}`}
            {selectedCommand && `发送: ${commands.find(c => c.id === selectedCommand)?.name}`}
            {' → '}
            {visibilityWindows.find(w => w.id === selectedWindow)?.groundStationId && (
              groundStations.find(s => s.id === visibilityWindows.find(w => w.id === selectedWindow)?.groundStationId)?.name
            )}
          </div>
          <div className="flex gap-2">
            {selectedPacket && (
              <button
                onClick={handleAddDownloadBlock}
                className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-500 rounded text-xs font-mono transition-colors"
              >
                <Plus className="w-3 h-3" />
                添加下载
              </button>
            )}
            {selectedCommand && (
              <button
                onClick={handleAddCommandBlock}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-xs font-mono transition-colors"
              >
                <Plus className="w-3 h-3" />
                添加发送
              </button>
            )}
          </div>
        </div>
      )}

      {activeTransmissions.length > 0 && (
        <div className="px-4 py-3 border-t border-deep-700">
          <div className="text-xs text-deep-400 mb-2 font-mono">活跃传输</div>
          <div className="space-y-2">
            {activeTransmissions.map((trans, index) => {
              const packet = dataPackets.find(p => p.id === trans.packetId);
              const command = commands.find(c => c.id === trans.commandId);
              const station = groundStations.find(s => s.id === trans.stationId);
              
              return (
                <div key={index} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-mono">
                        {trans.type === 'download' ? '↓' : '↑'} {packet?.dataType || command?.name}
                      </span>
                      <span className="text-deep-400">{trans.progress.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 bg-deep-700 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ 
                          width: `${trans.progress}%`,
                          backgroundColor: trans.type === 'download' ? '#27ae60' : '#3498db'
                        }}
                        initial={false}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                  </div>
                  <span className="text-[10px] text-deep-500 font-mono">{station?.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
