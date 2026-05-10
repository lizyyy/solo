import { useEffect, useRef, useState, useCallback } from 'react';
import { Event, SystemState, WSMessage } from '../types';

export function useWebSocket() {
  const [events, setEvents] = useState<Event[]>([]);
  const [currentState, setCurrentState] = useState<SystemState | null>(null);
  const [playbackState, setPlaybackState] = useState<SystemState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        try {
          const data: WSMessage = JSON.parse(event.data);
          if (data.type === 'event' && data.event) {
            setEvents((prev) => {
              const updated = [...prev, data.event!];
              return updated.slice(-500);
            });
          } else if (data.type === 'state' && data.state) {
            setCurrentState(data.state);
          } else if (data.type === 'playback_state' && data.state) {
            setPlaybackState(data.state);
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        if (!reconnectTimerRef.current) {
          reconnectTimerRef.current = window.setTimeout(connect, 3000);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
      };
    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, [connect]);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  const clearPlaybackState = useCallback(() => {
    setPlaybackState(null);
  }, []);

  return { events, currentState, playbackState, isConnected, clearEvents, clearPlaybackState };
}
