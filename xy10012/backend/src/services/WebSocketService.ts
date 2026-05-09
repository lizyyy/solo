import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { logger, RequestContext } from '../utils/logger';
import { lockService, VersionConflictError } from './LockService';
import { EntityType } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

interface ConnectedUser {
  userId: string;
  socketId: string;
  rooms: string[];
}

export class WebSocketService {
  private io: SocketIOServer | null = null;
  private connectedUsers: Map<string, ConnectedUser> = new Map();

  init(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        credentials: true,
      },
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    this.io.on('connection', this.handleConnection.bind(this));
    logger.info('WebSocket service initialized');
  }

  private handleConnection(socket: Socket) {
    const userId = socket.handshake.query.userId as string;

    if (!userId) {
      logger.warn('Socket connection without userId');
      socket.disconnect(true);
      return;
    }

    this.connectedUsers.set(socket.id, {
      userId,
      socketId: socket.id,
      rooms: [],
    });

    logger.info('User connected via WebSocket', { userId, socketId: socket.id });

    socket.on('subscribe', this.handleSubscribe.bind(this, socket, userId));
    socket.on('unsubscribe', this.handleUnsubscribe.bind(this, socket, userId));
    socket.on('acquire-lock', this.handleAcquireLock.bind(this, socket, userId));
    socket.on('release-lock', this.handleReleaseLock.bind(this, socket, userId));
    socket.on('extend-lock', this.handleExtendLock.bind(this, socket, userId));
    socket.on('disconnect', this.handleDisconnect.bind(this, socket, userId));
  }

  private handleSubscribe(socket: Socket, userId: string, room: string) {
    socket.join(room);
    const user = this.connectedUsers.get(socket.id);
    if (user) {
      user.rooms.push(room);
    }
    logger.debug('User subscribed to room', { userId, room });
  }

  private handleUnsubscribe(socket: Socket, userId: string, room: string) {
    socket.leave(room);
    const user = this.connectedUsers.get(socket.id);
    if (user) {
      user.rooms = user.rooms.filter((r) => r !== room);
    }
    logger.debug('User unsubscribed from room', { userId, room });
  }

  private async handleAcquireLock(
    socket: Socket,
    userId: string,
    data: { entityType: EntityType; entityId: string }
  ) {
    const context = new RequestContext({
      requestId: uuidv4(),
      userId,
    });

    try {
      const result = await lockService.acquireOptimisticLock(
        data.entityType,
        data.entityId,
        userId,
        context
      );

      if (result.success) {
        socket.emit('lock-acquired', {
          entityType: data.entityType,
          entityId: data.entityId,
          acquiredBy: userId,
        });

        this.io?.to(`lock:${data.entityType}:${data.entityId}`).emit('entity-locked', {
          entityType: data.entityType,
          entityId: data.entityId,
          lockedBy: userId,
        });
      } else {
        socket.emit('lock-conflict', {
          entityType: data.entityType,
          entityId: data.entityId,
          lockedBy: result.lock?.lockedBy,
          lockedAt: result.lock?.lockedAt,
        });
      }
    } catch (error) {
      logger.error('Error acquiring lock', {
        error: (error as Error).message,
        userId,
        entityType: data.entityType,
        entityId: data.entityId,
      });
      socket.emit('lock-error', {
        message: (error as Error).message,
      });
    }
  }

  private async handleReleaseLock(
    socket: Socket,
    userId: string,
    data: { entityType: EntityType; entityId: string }
  ) {
    try {
      const released = await lockService.releaseOptimisticLock(
        data.entityType,
        data.entityId,
        userId
      );

      if (released) {
        socket.emit('lock-released', {
          entityType: data.entityType,
          entityId: data.entityId,
        });

        this.io?.to(`lock:${data.entityType}:${data.entityId}`).emit('entity-unlocked', {
          entityType: data.entityType,
          entityId: data.entityId,
          releasedBy: userId,
        });
      }
    } catch (error) {
      logger.error('Error releasing lock', {
        error: (error as Error).message,
        userId,
        entityType: data.entityType,
        entityId: data.entityId,
      });
    }
  }

  private async handleExtendLock(
    socket: Socket,
    userId: string,
    data: { entityType: EntityType; entityId: string }
  ) {
    try {
      const extended = await lockService.extendLock(
        data.entityType,
        data.entityId,
        userId
      );

      if (extended) {
        socket.emit('lock-extended', {
          entityType: data.entityType,
          entityId: data.entityId,
        });
      } else {
        socket.emit('lock-expired', {
          entityType: data.entityType,
          entityId: data.entityId,
        });
      }
    } catch (error) {
      logger.error('Error extending lock', {
        error: (error as Error).message,
        userId,
        entityType: data.entityType,
        entityId: data.entityId,
      });
    }
  }

  private handleDisconnect(socket: Socket, userId: string) {
    const user = this.connectedUsers.get(socket.id);
    if (user) {
      for (const room of user.rooms) {
        socket.leave(room);
      }
      this.connectedUsers.delete(socket.id);
    }

    logger.info('User disconnected from WebSocket', { userId, socketId: socket.id });
  }

  broadcastTaskUpdate(taskId: string, data: any) {
    this.io?.to(`task:${taskId}`).emit('task:updated', {
      taskId,
      ...data,
      timestamp: new Date().toISOString(),
    });

    this.io?.to('tasks:all').emit('task:list-updated', {
      taskId,
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  broadcastTaskCreated(task: any) {
    this.io?.to('tasks:all').emit('task:created', {
      task,
      timestamp: new Date().toISOString(),
    });
  }

  broadcastTaskDeleted(taskId: string) {
    this.io?.to('tasks:all').emit('task:deleted', {
      taskId,
      timestamp: new Date().toISOString(),
    });
  }

  broadcastVersionConflict(taskId: string, error: VersionConflictError) {
    this.io?.to(`task:${taskId}`).emit('version-conflict', {
      taskId,
      currentVersion: error.currentVersion,
      yourVersion: error.yourVersion,
      message: error.message,
    });
  }

  getConnectedUsers(): ConnectedUser[] {
    return Array.from(this.connectedUsers.values());
  }

  getUserConnections(userId: string): ConnectedUser[] {
    return this.getConnectedUsers().filter((u) => u.userId === userId);
  }
}

export const wsService = new WebSocketService();