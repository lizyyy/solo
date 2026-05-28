import { useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '../store/gameStore';
import { useEventStore } from '../store/eventStore';
import { useScheduleStore } from '../store/scheduleStore';
import { 
  detectWindowStart, 
  detectWindowEnd, 
  detectMissedWindow,
  getCurrentWindow,
} from '../engine/windowEngine';
import { detectCommandTimeout, getNextCommand } from '../engine/queueEngine';
import { detectPacketLoss, calculateTransmissionProgress } from '../engine/transmissionEngine';
import type { Command, DataPacket, VisibilityWindow, ScheduleBlock } from '../types/mission';
import { formatTime } from '../utils/time';

export function useGameLoop() {
  const { 
    status, 
    speed, 
    updateTime, 
    currentTime,
    visibilityWindows,
    updateWindow,
    commands,
    updateCommand,
    dataPackets,
    updatePacket,
    groundStations,
    queues,
    activeTransmissions,
    addActiveTransmission,
    updateActiveTransmission,
    removeActiveTransmission,
    addScore,
    deductScore,
    endGame,
    scheduleBlocks,
    updateScheduleBlock,
  } = useGameStore();
  
  const { addEvent, addError } = useEventStore();
  const { blocks } = useScheduleStore();
  
  const loopRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const processedWindowsRef = useRef<Set<string>>(new Set());
  const processedCommandsRef = useRef<Set<string>>(new Set());

  const processWindowStarts = useCallback((time: number) => {
    const newWindow = detectWindowStart(visibilityWindows, time);
    if (newWindow && !processedWindowsRef.current.has(newWindow.id)) {
      processedWindowsRef.current.add(newWindow.id);
      updateWindow(newWindow.id, { status: 'active' });
      
      const station = groundStations.find(s => s.id === newWindow.groundStationId);
      addEvent({
        timestamp: time,
        type: 'window_start',
        severity: 'info',
        message: `窗口开始：${station?.name || '未知站点'} 可见窗口已打开，持续 ${formatTime(newWindow.endTime - newWindow.startTime)}`,
        relatedEntityId: newWindow.id,
      });
    }
  }, [visibilityWindows, updateWindow, groundStations, addEvent]);

  const processWindowEnds = useCallback((time: number) => {
    const endingWindow = detectWindowEnd(visibilityWindows, time);
    if (endingWindow) {
      updateWindow(endingWindow.id, { 
        status: 'completed',
        actualDuration: time - endingWindow.startTime,
      });
      
      const station = groundStations.find(s => s.id === endingWindow.groundStationId);
      addEvent({
        timestamp: time,
        type: 'window_end',
        severity: 'info',
        message: `窗口结束：${station?.name || '未知站点'} 可见窗口已关闭`,
        relatedEntityId: endingWindow.id,
      });

      const windowBlocks = blocks.filter(b => b.windowId === endingWindow.id);
      windowBlocks.forEach(block => {
        updateScheduleBlock(block.id, { endTime: time });
      });
    }
  }, [visibilityWindows, updateWindow, groundStations, addEvent, blocks, updateScheduleBlock]);

  const processMissedWindows = useCallback((time: number) => {
    visibilityWindows.forEach(window => {
      if (window.status !== 'predicted') return;
      if (time < window.endTime) return;

      const scheduledBlocks = blocks.filter(b => b.windowId === window.id);
      if (scheduledBlocks.length === 0) return;

      const previousBlock = blocks
        .filter(b => b.stationId === window.groundStationId && b.endTime <= window.startTime)
        .sort((a, b) => b.endTime - a.endTime)[0];

      const error = detectMissedWindow(window, blocks, time, previousBlock);
      if (error) {
        updateWindow(window.id, { status: 'missed' });
        
        const result = addError(error, time, useGameStore.getState().score);
        deductScore(result.scoreDeduction);
        
        scheduledBlocks.forEach(block => {
          block.taskIds.forEach(taskId => {
            const command = commands.find(c => c.id === taskId);
            if (command) {
              updateCommand(taskId, { status: 'failed' });
            }
            const packet = dataPackets.find(p => p.id === taskId);
            if (packet) {
              updatePacket(taskId, { isDownloaded: false });
            }
          });
        });
      }
    });
  }, [visibilityWindows, blocks, commands, dataPackets, updateWindow, updateCommand, updatePacket, addError, deductScore]);

  const processCommandTimeouts = useCallback((time: number) => {
    const currentWindow = getCurrentWindow(visibilityWindows, time);
    if (!currentWindow) return;

    Object.entries(queues).forEach(([stationId, queue]) => {
      if (stationId !== currentWindow.groundStationId) return;

      queue.commands.forEach((commandId, index) => {
        if (processedCommandsRef.current.has(commandId)) return;

        const command = commands.find(c => c.id === commandId);
        if (!command) return;

        const transmission = activeTransmissions.find(
          t => t.commandId === commandId && t.type === 'command'
        );

        const transmittedPercent = transmission?.progress || 0;

        const error = detectCommandTimeout(
          command,
          currentWindow,
          time,
          index,
          transmittedPercent
        );

        if (error) {
          processedCommandsRef.current.add(commandId);
          updateCommand(commandId, { status: 'timeout' });
          
          const result = addError(error, time, useGameStore.getState().score);
          deductScore(result.scoreDeduction);

          const transIndex = activeTransmissions.findIndex(
            t => t.commandId === commandId && t.type === 'command'
          );
          if (transIndex >= 0) {
            removeActiveTransmission(transIndex);
          }
        }
      });
    });
  }, [visibilityWindows, queues, commands, activeTransmissions, updateCommand, addError, deductScore, removeActiveTransmission]);

  const processPacketLoss = useCallback((time: number) => {
    const currentWindow = getCurrentWindow(visibilityWindows, time);
    if (!currentWindow) return;

    dataPackets.forEach(packet => {
      if (packet.isDownloaded) return;

      const transmission = activeTransmissions.find(
        t => t.packetId === packet.id && t.type === 'download'
      );
      
      if (!transmission) return;

      const downloadedPercent = calculateTransmissionProgress(transmission, time);

      if (time >= currentWindow.endTime && downloadedPercent < 100) {
        const station = groundStations.find(s => s.id === currentWindow.groundStationId);
        if (!station) return;

        const error = detectPacketLoss(
          packet,
          currentWindow,
          time,
          downloadedPercent,
          station
        );

        if (error) {
          const result = addError(error, time, useGameStore.getState().score);
          deductScore(result.scoreDeduction);

          const transIndex = activeTransmissions.findIndex(
            t => t.packetId === packet.id && t.type === 'download'
          );
          if (transIndex >= 0) {
            removeActiveTransmission(transIndex);
          }
        }
      }
    });
  }, [visibilityWindows, dataPackets, activeTransmissions, groundStations, addError, deductScore, removeActiveTransmission]);

  const processActiveTransmissions = useCallback((time: number) => {
    const currentWindow = getCurrentWindow(visibilityWindows, time);
    if (!currentWindow) return;

    const station = groundStations.find(s => s.id === currentWindow.groundStationId);
    if (!station) return;

    const queue = queues[currentWindow.groundStationId];
    
    activeTransmissions.forEach((transmission, index) => {
      if (transmission.windowId !== currentWindow.id) return;

      const progress = calculateTransmissionProgress(transmission, time);
      updateActiveTransmission(index, { progress });

      if (progress >= 100) {
        if (transmission.type === 'download' && transmission.packetId) {
          updatePacket(transmission.packetId, { 
            isDownloaded: true, 
            downloadWindowId: currentWindow.id 
          });
          addScore(50);
          
          const packet = dataPackets.find(p => p.id === transmission.packetId);
          addEvent({
            timestamp: time,
            type: 'data_download_complete',
            severity: 'info',
            message: `数据下载完成：${packet?.dataType || '未知'} 数据 ${Math.round(packet?.size || 0)}MB`,
            relatedEntityId: transmission.packetId,
          });
        } else if (transmission.type === 'command' && transmission.commandId) {
          updateCommand(transmission.commandId, { 
            status: 'success', 
            isSent: true, 
            sentTime: time,
            windowId: currentWindow.id,
          });
          addScore(30);
          
          const command = commands.find(c => c.id === transmission.commandId);
          addEvent({
            timestamp: time,
            type: 'command_sent',
            severity: 'info',
            message: `指令发送成功：${command?.name || '未知指令'}`,
            relatedEntityId: transmission.commandId,
          });
        }
        
        removeActiveTransmission(index);
      }
    });

    if (activeTransmissions.length === 0 && queue) {
      const nextCommand = getNextCommand(queue, commands);
      if (nextCommand && nextCommand.status === 'queued') {
        const station = groundStations.find(s => s.id === currentWindow.groundStationId);
        if (station) {
          const requiredTime = (nextCommand.size * 8) / (station.bandwidth * 1024) * 1000 + 500;
          
          if (time + requiredTime <= currentWindow.endTime) {
            updateCommand(nextCommand.id, { status: 'transmitting', transmittedPercent: 0 });
            
            addActiveTransmission({
              type: 'command',
              windowId: currentWindow.id,
              stationId: currentWindow.groundStationId,
              commandId: nextCommand.id,
              startTime: time,
              totalDuration: requiredTime,
              progress: 0,
            });

            addEvent({
              timestamp: time,
              type: 'command_sent',
              severity: 'info',
              message: `开始发送指令：${nextCommand.name}`,
              relatedEntityId: nextCommand.id,
            });
          }
        }
      }
    }
  }, [visibilityWindows, groundStations, queues, activeTransmissions, commands, dataPackets, updateCommand, updatePacket, updateActiveTransmission, removeActiveTransmission, addActiveTransmission, addScore, addEvent]);

  const processScheduledBlocks = useCallback((time: number) => {
    const currentWindow = getCurrentWindow(visibilityWindows, time);
    if (!currentWindow) return;

    const windowBlocks = blocks.filter(
      b => b.windowId === currentWindow.id && 
           b.startTime <= time && 
           b.endTime > time
    );

    windowBlocks.forEach(block => {
      const hasActiveTransmission = activeTransmissions.some(
        t => t.windowId === currentWindow.id && 
             block.taskIds.includes(t.packetId || t.commandId || '')
      );

      if (hasActiveTransmission) return;

      const station = groundStations.find(s => s.id === currentWindow.groundStationId);
      if (!station) return;

      block.taskIds.forEach(taskId => {
        const packet = dataPackets.find(p => p.id === taskId);
        const command = commands.find(c => c.id === taskId);

        if (packet && !packet.isDownloaded) {
          const existing = activeTransmissions.some(t => t.packetId === packet.id);
          if (!existing) {
            const requiredTime = (packet.size * 8) / (station.bandwidth * 0.85) * 1000;
            
            if (time + requiredTime <= currentWindow.endTime) {
              updatePacket(packet.id, { isDownloaded: false });
              
              addActiveTransmission({
                type: 'download',
                windowId: currentWindow.id,
                stationId: currentWindow.groundStationId,
                packetId: packet.id,
                startTime: time,
                totalDuration: requiredTime,
                progress: 0,
              });

              addEvent({
                timestamp: time,
                type: 'data_download_start',
                severity: 'info',
                message: `开始下载：${packet.dataType} 数据 ${packet.size}MB`,
                relatedEntityId: packet.id,
              });
            }
          }
        }

        if (command && command.status === 'queued') {
          const existing = activeTransmissions.some(t => t.commandId === command.id);
          if (!existing) {
            const requiredTime = (command.size * 8) / (station.bandwidth * 1024) * 1000 + 500;
            
            if (time + requiredTime <= currentWindow.endTime) {
              updateCommand(command.id, { status: 'transmitting', transmittedPercent: 0 });
              
              addActiveTransmission({
                type: 'command',
                windowId: currentWindow.id,
                stationId: currentWindow.groundStationId,
                commandId: command.id,
                startTime: time,
                totalDuration: requiredTime,
                progress: 0,
              });

              addEvent({
                timestamp: time,
                type: 'command_sent',
                severity: 'info',
                message: `开始发送指令：${command.name}`,
                relatedEntityId: command.id,
              });
            }
          }
        }
      });
    });
  }, [visibilityWindows, blocks, activeTransmissions, groundStations, dataPackets, commands, updatePacket, updateCommand, addActiveTransmission, addEvent]);

  const checkMissionEnd = useCallback((time: number) => {
    const lastWindow = [...visibilityWindows].sort((a, b) => b.endTime - a.endTime)[0];
    if (lastWindow && time >= lastWindow.endTime + 5000) {
      const allWindowsProcessed = visibilityWindows.every(
        w => w.status === 'completed' || w.status === 'missed'
      );
      
      if (allWindowsProcessed) {
        addEvent({
          timestamp: time,
          type: 'mission_end',
          severity: 'info',
          message: '任务结束，正在生成测控报告...',
        });
        endGame();
      }
    }
  }, [visibilityWindows, addEvent, endGame]);

  useEffect(() => {
    if (status !== 'running') {
      if (loopRef.current) {
        cancelAnimationFrame(loopRef.current);
        loopRef.current = null;
      }
      return;
    }

    const gameLoop = (timestamp: number) => {
      if (lastUpdateRef.current === 0) {
        lastUpdateRef.current = timestamp;
      }

      const realDelta = timestamp - lastUpdateRef.current;
      const gameDelta = realDelta * speed;

      if (gameDelta >= 100) {
        updateTime(gameDelta);
        
        const newTime = useGameStore.getState().currentTime;
        
        processWindowStarts(newTime);
        processScheduledBlocks(newTime);
        processActiveTransmissions(newTime);
        processWindowEnds(newTime);
        processMissedWindows(newTime);
        processCommandTimeouts(newTime);
        processPacketLoss(newTime);
        checkMissionEnd(newTime);
        
        lastUpdateRef.current = timestamp;
      }

      loopRef.current = requestAnimationFrame(gameLoop);
    };

    loopRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (loopRef.current) {
        cancelAnimationFrame(loopRef.current);
      }
    };
  }, [
    status, 
    speed, 
    updateTime, 
    processWindowStarts,
    processScheduledBlocks,
    processActiveTransmissions,
    processWindowEnds,
    processMissedWindows,
    processCommandTimeouts,
    processPacketLoss,
    checkMissionEnd,
  ]);

  const resetLoop = useCallback(() => {
    processedWindowsRef.current.clear();
    processedCommandsRef.current.clear();
    lastUpdateRef.current = 0;
  }, []);

  return { resetLoop };
}
