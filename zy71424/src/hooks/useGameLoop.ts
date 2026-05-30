import { useEffect, useRef } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { generateRandomEvent } from '@/engine/eventGenerator';
import { calculatePenalty } from '@/engine/scoringEngine';

export const useGameLoop = () => {
  const status = useGameStore(state => state.status);
  const timeElapsed = useGameStore(state => state.timeElapsed);
  const totalDuration = useGameStore(state => state.totalDuration);
  const channels = useGameStore(state => state.channels);
  const masterLevel = useGameStore(state => state.masterLevel);
  const events = useGameStore(state => state.events);
  const setTimeElapsed = useGameStore(state => state.setTimeElapsed);
  const addEvent = useGameStore(state => state.addEvent);
  const endGame = useGameStore(state => state.endGame);
  const setScore = useGameStore(state => state.setScore);

  const lastEventTimeRef = useRef(0);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (status !== 'playing') {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = window.setInterval(() => {
      const state = useGameStore.getState();
      
      if (state.timeElapsed >= state.totalDuration) {
        state.endGame();
        return;
      }

      const newTime = state.timeElapsed + 1;
      state.setTimeElapsed(newTime);

      const unresolvedEvents = state.events.filter(e => !e.resolved);
      let totalPenalty = 0;
      for (const event of unresolvedEvents) {
        totalPenalty += calculatePenalty(event, newTime);
      }
      
      if (totalPenalty > 0) {
        state.setScore(Math.max(0, state.score - totalPenalty * 0.1));
      }

      const timeSinceLastEvent = newTime - lastEventTimeRef.current;
      const eventInterval = Math.max(5, 12 - Math.floor(newTime / 30));
      
      if (timeSinceLastEvent >= eventInterval && Math.random() > 0.3) {
        const eventData = generateRandomEvent(state.channels, newTime, unresolvedEvents);
        if (eventData) {
          state.addEvent(eventData);
          lastEventTimeRef.current = newTime;
        }
      }

      if (state.masterLevel > 85 && Math.random() > 0.7) {
        const hasRecentClipping = state.events.some(
          e => e.type === 'clipping' && !e.resolved && newTime - e.timestamp < 5
        );
        if (!hasRecentClipping) {
          state.addEvent({
            type: 'clipping',
            severity: 'critical',
            description: '主输出爆峰！快拉低总音量！',
          });
          lastEventTimeRef.current = newTime;
        }
      }
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [status]);

  useEffect(() => {
    if (status === 'idle') {
      lastEventTimeRef.current = 0;
    }
  }, [status]);
};
