import { useState, useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '../store/useGameStore';
import { ReplayData, Decision } from '../game/types';

interface UseReplayPlayerOptions {
  autoPlay?: boolean;
  speed?: number;
}

export function useReplayPlayer(
  replayData: ReplayData | null,
  options: UseReplayPlayerOptions = {}
) {
  const { loadReplayState, setReplayTime, state } = useGameStore();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [speed, setSpeed] = useState(options.speed || 1);
  const [currentDecisionIndex, setCurrentDecisionIndex] = useState(-1);
  const animationFrameRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);

  const totalTime = replayData?.snapshots[replayData.snapshots.length - 1]?.timestamp || 0;

  const decisions = replayData?.decisions || [];

  useEffect(() => {
    if (replayData) {
      loadReplayState(replayData);
      setCurrentTime(0);
      setCurrentDecisionIndex(-1);
      setIsPlaying(false);
    }
  }, [replayData, loadReplayState]);

  useEffect(() => {
    if (!isPlaying || !replayData) {
      return;
    }

    lastTimeRef.current = performance.now();

    const tick = (now: number) => {
      const delta = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      let newTime = currentTime + delta * speed;

      const nextDecision = decisions.find((d, i) => i > currentDecisionIndex && d.timestamp <= newTime);
      if (nextDecision) {
        newTime = nextDecision.timestamp;
        setIsPlaying(false);
        setCurrentDecisionIndex(decisions.indexOf(nextDecision));
      }

      if (newTime >= totalTime) {
        newTime = totalTime;
        setIsPlaying(false);
      }

      setCurrentTime(newTime);
      setReplayTime(newTime);

      if (isPlaying && newTime < totalTime) {
        animationFrameRef.current = requestAnimationFrame(tick);
      }
    };

    animationFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, currentTime, speed, replayData, totalTime, decisions, currentDecisionIndex, setReplayTime]);

  const play = useCallback(() => {
    if (currentTime >= totalTime) {
      setCurrentTime(0);
      setCurrentDecisionIndex(-1);
      setReplayTime(0);
    }
    setIsPlaying(true);
  }, [currentTime, totalTime, setReplayTime]);

  const pause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const seekTo = useCallback((time: number) => {
    const clampedTime = Math.max(0, Math.min(totalTime, time));
    setCurrentTime(clampedTime);
    setReplayTime(clampedTime);
    
    const decisionIndex = decisions.findIndex(d => d.timestamp > clampedTime) - 1;
    setCurrentDecisionIndex(decisionIndex);
  }, [totalTime, decisions, setReplayTime]);

  const stepForward = useCallback(() => {
    const nextDecision = decisions.find((_, i) => i > currentDecisionIndex);
    if (nextDecision) {
      seekTo(nextDecision.timestamp);
    } else {
      seekTo(totalTime);
    }
  }, [decisions, currentDecisionIndex, seekTo, totalTime]);

  const stepBackward = useCallback(() => {
    const prevDecision = decisions[currentDecisionIndex];
    if (prevDecision) {
      const prevPrevDecision = decisions[currentDecisionIndex - 1];
      seekTo(prevPrevDecision?.timestamp || 0);
    } else {
      seekTo(0);
    }
  }, [decisions, currentDecisionIndex, seekTo]);

  const reset = useCallback(() => {
    setCurrentTime(0);
    setCurrentDecisionIndex(-1);
    setIsPlaying(false);
    setReplayTime(0);
  }, [setReplayTime]);

  const currentDecision: Decision | null = currentDecisionIndex >= 0 ? decisions[currentDecisionIndex] : null;
  const nextDecision: Decision | null = currentDecisionIndex + 1 < decisions.length ? decisions[currentDecisionIndex + 1] : null;

  return {
    isPlaying,
    currentTime,
    totalTime,
    speed,
    currentDecision,
    nextDecision,
    currentDecisionIndex,
    totalDecisions: decisions.length,
    play,
    pause,
    togglePlay,
    seekTo,
    stepForward,
    stepBackward,
    reset,
    setSpeed,
  };
}
