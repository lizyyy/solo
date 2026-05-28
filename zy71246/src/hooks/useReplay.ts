import { useState, useEffect, useRef, useCallback } from 'react';
import type { EventLog, MissionReport } from '../types/mission';
import { createReplayEngine, ReplayEngine } from '../engine/replayEngine';

interface UseReplayOptions {
  autoPlay?: boolean;
  initialSpeed?: number;
}

export function useReplay(
  report: MissionReport | null,
  options: UseReplayOptions = {}
) {
  const { autoPlay = false, initialSpeed = 1 } = options;
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [speed, setSpeed] = useState(initialSpeed);
  const [replayedEvents, setReplayedEvents] = useState<EventLog[]>([]);
  
  const engineRef = useRef<ReplayEngine | null>(null);
  const eventsRef = useRef<EventLog[]>([]);

  const handleEvent = useCallback((event: EventLog, index: number) => {
    setCurrentIndex(index + 1);
    setCurrentTime(event.timestamp);
    setReplayedEvents(prev => {
      if (index < prev.length) {
        return prev.slice(0, index + 1);
      }
      return [...prev, event];
    });
  }, []);

  const initEngine = useCallback(() => {
    if (!report || report.timelineData.length === 0) return;

    if (engineRef.current) {
      engineRef.current.destroy();
    }

    eventsRef.current = report.timelineData;
    engineRef.current = createReplayEngine(report.timelineData, handleEvent);
    engineRef.current.setSpeed(speed);
    
    setCurrentIndex(0);
    setCurrentTime(report.startTime);
    setReplayedEvents([]);

    if (autoPlay) {
      engineRef.current.play();
      setIsPlaying(true);
    }
  }, [report, speed, autoPlay, handleEvent]);

  useEffect(() => {
    initEngine();
    
    return () => {
      if (engineRef.current) {
        engineRef.current.destroy();
      }
    };
  }, [initEngine]);

  const play = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.play();
      setIsPlaying(true);
    }
  }, []);

  const pause = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const toggle = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const stop = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.stop();
      setIsPlaying(false);
      setCurrentIndex(0);
      setCurrentTime(engineRef.current.getStartTime());
      setReplayedEvents([]);
    }
  }, []);

  const reset = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.reset();
      setIsPlaying(false);
      setCurrentIndex(0);
      setCurrentTime(engineRef.current.getStartTime());
      setReplayedEvents([]);
    }
  }, []);

  const seekTo = useCallback((timestamp: number) => {
    if (engineRef.current) {
      engineRef.current.seekTo(timestamp);
      setCurrentTime(timestamp);
      setIsPlaying(false);
    }
  }, []);

  const seekToIndex = useCallback((index: number) => {
    if (engineRef.current) {
      engineRef.current.seekToIndex(index);
      setCurrentIndex(index);
      setIsPlaying(false);
    }
  }, []);

  const stepForward = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.stepForward();
      setIsPlaying(false);
    }
  }, []);

  const stepBackward = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.stepBackward();
      setIsPlaying(false);
    }
  }, []);

  const changeSpeed = useCallback((newSpeed: number) => {
    setSpeed(newSpeed);
    if (engineRef.current) {
      engineRef.current.setSpeed(newSpeed);
    }
  }, []);

  const getProgress = useCallback(() => {
    if (!report || report.timelineData.length === 0) return 0;
    return currentIndex / report.timelineData.length;
  }, [report, currentIndex]);

  const getKeyEvents = useCallback(() => {
    if (!engineRef.current) return [];
    return engineRef.current.getKeyEvents();
  }, []);

  const isAtEnd = engineRef.current?.isAtEnd() || false;
  const isAtStart = engineRef.current?.isAtStart() || true;
  const totalEvents = report?.timelineData.length || 0;
  const startTime = report?.startTime || 0;
  const endTime = report?.endTime || 0;

  return {
    isPlaying,
    currentIndex,
    currentTime,
    speed,
    replayedEvents,
    totalEvents,
    startTime,
    endTime,
    isAtEnd,
    isAtStart,
    play,
    pause,
    toggle,
    stop,
    reset,
    seekTo,
    seekToIndex,
    stepForward,
    stepBackward,
    changeSpeed,
    getProgress,
    getKeyEvents,
  };
}

export function useReplayTimeline(
  events: EventLog[],
  startTime: number,
  endTime: number,
  width: number
) {
  const timeToX = useCallback((time: number) => {
    const duration = endTime - startTime;
    if (duration === 0) return 0;
    return Math.max(0, Math.min(width, ((time - startTime) / duration) * width));
  }, [startTime, endTime, width]);

  const xToTime = useCallback((x: number) => {
    const duration = endTime - startTime;
    return startTime + (Math.max(0, Math.min(width, x)) / width) * duration;
  }, [startTime, endTime, width]);

  const getEventMarkers = useCallback(() => {
    return events.map(event => ({
      x: timeToX(event.timestamp),
      type: event.type,
      severity: event.severity,
      event,
    }));
  }, [events, timeToX]);

  const getKeyEventMarkers = useCallback(() => {
    const keyTypes = ['window_missed', 'command_timeout', 'data_packet_lost', 'mission_start', 'mission_end'];
    return events
      .filter(e => keyTypes.includes(e.type))
      .map(event => ({
        x: timeToX(event.timestamp),
        type: event.type,
        severity: event.severity,
        event,
      }));
  }, [events, timeToX]);

  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      info: '#3498db',
      warning: '#f39c12',
      error: '#e74c3c',
      critical: '#c0392b',
    };
    return colors[severity] || '#95a5a6';
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      window_start: '#27ae60',
      window_end: '#16a085',
      window_missed: '#e74c3c',
      command_sent: '#3498db',
      command_timeout: '#f39c12',
      command_failed: '#e67e22',
      data_download_start: '#2ecc71',
      data_download_complete: '#27ae60',
      data_packet_lost: '#e74c3c',
      mission_start: '#9b59b6',
      mission_end: '#8e44ad',
    };
    return colors[type] || '#95a5a6';
  };

  return {
    timeToX,
    xToTime,
    getEventMarkers,
    getKeyEventMarkers,
    getSeverityColor,
    getTypeColor,
  };
}
