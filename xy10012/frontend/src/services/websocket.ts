import { io, Socket } from 'socket.io-client';
import { Task } from '../api';

export interface SocketEvent {
  'task:updated': { taskId: string; task: Task; timestamp: string; rollback?: boolean };
  'task:created': { task: Task; timestamp: string };
  'task:deleted': { taskId: string; timestamp: string };
  'task:list-updated': { taskId: string; timestamp: string };
  'version-conflict': {
    taskId: string;
    currentVersion: number;
    yourVersion: number;
    message: string;
  };
  'lock-acquired': { entityType: string; entityId: string; acquiredBy: string };
  'lock-conflict': {
    entityType: string;
    entityId: string;
    lockedBy: string;
    lockedAt: Date;
  };
  'lock-released': { entityType: string; entityId: string };
  'lock-extended': { entityType: string; entityId: string };
  'lock-expired': { entityType: string; entityId: string };
  'entity-locked': { entityType: string; entityId: string; lockedBy: string };
  'entity-unlocked': { entityType: string; entityId: string; releasedBy: string };
}

class WebSocketService {
  private socket: Socket | null = null;
  private connected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;

  connect(userId: string): Socket {
    if (this.socket && this.connected) {
      return this.socket;
    }

    this.socket = io({
      query: { userId },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    this.socket.on('connect', () => {
      this.connected = true;
      this.reconnectAttempts = 0;
      console.log('[WebSocket] Connected');
    });

    this.socket.on('disconnect', (reason) => {
      this.connected = false;
      console.log('[WebSocket] Disconnected:', reason);
    });

    this.socket.on('reconnect', (attemptNumber) => {
      this.connected = true;
      this.reconnectAttempts = 0;
      console.log('[WebSocket] Reconnected after', attemptNumber, 'attempts');
    });

    this.socket.on('reconnect_attempt', (attemptNumber) => {
      this.reconnectAttempts = attemptNumber;
      if (attemptNumber >= this.maxReconnectAttempts) {
        console.warn('[WebSocket] Max reconnect attempts reached');
      }
    });

    this.socket.on('error', (error) => {
      console.error('[WebSocket] Error:', error);
    });

    return this.socket;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
    }
  }

  subscribe(room: string): void {
    this.socket?.emit('subscribe', room);
  }

  unsubscribe(room: string): void {
    this.socket?.emit('unsubscribe', room);
  }

  acquireLock(entityType: string, entityId: string): void {
    this.socket?.emit('acquire-lock', { entityType, entityId });
  }

  releaseLock(entityType: string, entityId: string): void {
    this.socket?.emit('release-lock', { entityType, entityId });
  }

  extendLock(entityType: string, entityId: string): void {
    this.socket?.emit('extend-lock', { entityType, entityId });
  }

  on<K extends keyof SocketEvent>(event: K, handler: (data: SocketEvent[K]) => void): void {
    this.socket?.on(event, handler);
  }

  off<K extends keyof SocketEvent>(event: K, handler: (data: SocketEvent[K]) => void): void {
    this.socket?.off(event, handler);
  }

  isConnected(): boolean {
    return this.connected;
  }
}

export const wsService = new WebSocketService();