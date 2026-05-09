const logger = require('../utils/logger');
const PushTask = require('../models/PushTask');
const LiveRoom = require('../models/LiveRoom');
const Message = require('../models/Message');
const OperationLog = require('../models/OperationLog');
const { messageQueue, QUEUE_NAMES } = require('../redis/messageQueue');

class PushTaskService {
  constructor(webSocketService) {
    this.webSocketService = webSocketService;
    this.isRunning = false;
  }

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;

    logger.info('推送任务服务启动');

    this.processDelayedMessages();
    this.processPushTasks();
  }

  async stop() {
    this.isRunning = false;
    logger.info('推送任务服务停止');
  }

  async createTask(taskData, userId) {
    const task = PushTask.create(taskData);

    OperationLog.create({
      operationType: 'CREATE_PUSH_TASK',
      entityType: 'push_task',
      entityId: task.id,
      userId,
      beforeData: null,
      afterData: task
    });

    const delay = task.scheduledAt ? task.scheduledAt - Date.now() : 0;

    await messageQueue.enqueue(
      QUEUE_NAMES.PUSH_TASKS,
      { taskId: task.id },
      {
        delay: delay > 0 ? delay : 0,
        maxRetries: task.maxRetries
      }
    );

    logger.info(`推送任务已创建: ${task.id}, 类型: ${task.taskType}`);

    return task;
  }

  async processPushTasks() {
    while (this.isRunning) {
      try {
        const message = await messageQueue.dequeue(QUEUE_NAMES.PUSH_TASKS, 5);

        if (!message) continue;

        const { taskId } = message.payload;
        const task = PushTask.findById(taskId);

        if (!task) {
          logger.warn(`推送任务不存在: ${taskId}`);
          await messageQueue.ack(QUEUE_NAMES.PUSH_TASKS, message.id);
          continue;
        }

        if (task.status === 'completed' || task.status === 'failed') {
          logger.warn(`推送任务已处理: ${taskId}, 状态: ${task.status}`);
          await messageQueue.ack(QUEUE_NAMES.PUSH_TASKS, message.id);
          continue;
        }

        PushTask.updateStatus(taskId, 'processing', {
          executedAt: Date.now()
        });

        try {
          const result = await this.executeTask(task);

          PushTask.updateStatus(taskId, 'completed', {
            completedAt: Date.now()
          });

          await messageQueue.ack(QUEUE_NAMES.PUSH_TASKS, message.id);

          OperationLog.create({
            operationType: 'EXECUTE_PUSH_TASK',
            entityType: 'push_task',
            entityId: taskId,
            afterData: { status: 'completed', result }
          });

          logger.info(`推送任务执行成功: ${taskId}`);
        } catch (error) {
          logger.error(`推送任务执行失败: ${taskId}`, error);

          const nackResult = await messageQueue.nack(
            QUEUE_NAMES.PUSH_TASKS,
            message,
            error
          );

          if (nackResult.deadLetter) {
            PushTask.updateStatus(taskId, 'failed', {
              errorMessage: error.message
            });

            OperationLog.create({
              operationType: 'FAIL_PUSH_TASK',
              entityType: 'push_task',
              entityId: taskId,
              afterData: { status: 'failed', error: error.message }
            });
          } else {
            PushTask.incrementRetry(taskId, error.message);
          }
        }
      } catch (error) {
        logger.error('推送任务处理循环错误:', error);
        await this.sleep(1000);
      }
    }
  }

  async executeTask(task) {
    const { taskType, liveRoomId, targetUserIds, payload } = task;

    switch (taskType) {
      case 'room_announcement':
        return await this.handleRoomAnnouncement(liveRoomId, payload);

      case 'broadcast':
        return await this.handleBroadcast(payload);

      case 'targeted_notification':
        return await this.handleTargetedNotification(targetUserIds, payload);

      case 'live_started':
        return await this.handleLiveStarted(liveRoomId, payload);

      case 'live_ended':
        return await this.handleLiveEnded(liveRoomId, payload);

      default:
        throw new Error(`未知的任务类型: ${taskType}`);
    }
  }

  async handleRoomAnnouncement(liveRoomId, payload) {
    if (!liveRoomId) {
      throw new Error('房间公告任务需要指定直播间ID');
    }

    const liveRoom = LiveRoom.findById(liveRoomId);
    if (!liveRoom) {
      throw new Error(`直播间不存在: ${liveRoomId}`);
    }

    const { id, sequenceNumber } = Message.create({
      liveRoomId,
      senderId: 'system',
      content: payload.content || '',
      messageType: 'notification'
    });

    const messageData = {
      id,
      liveRoomId,
      senderId: 'system',
      senderName: '系统公告',
      content: payload.content,
      messageType: 'notification',
      sequenceNumber,
      timestamp: Date.now()
    };

    this.webSocketService.broadcastToRoom(liveRoomId, {
      type: 'system_message',
      data: messageData
    });

    return {
      type: 'room_announcement',
      liveRoomId,
      messageId: id,
      userCount: this.webSocketService.getRoomUserCount(liveRoomId)
    };
  }

  async handleBroadcast(payload) {
    const activeRooms = LiveRoom.findActive();
    const results = [];

    for (const room of activeRooms) {
      try {
        const { id, sequenceNumber } = Message.create({
          liveRoomId: room.id,
          senderId: 'system',
          content: payload.content || '',
          messageType: 'notification'
        });

        const messageData = {
          id,
          liveRoomId: room.id,
          senderId: 'system',
          senderName: '系统广播',
          content: payload.content,
          messageType: 'notification',
          sequenceNumber,
          timestamp: Date.now()
        };

        this.webSocketService.broadcastToRoom(room.id, {
          type: 'system_message',
          data: messageData
        });

        results.push({
          liveRoomId: room.id,
          messageId: id,
          userCount: this.webSocketService.getRoomUserCount(room.id)
        });
      } catch (error) {
        logger.error(`广播到直播间失败: ${room.id}`, error);
        results.push({
          liveRoomId: room.id,
          error: error.message
        });
      }
    }

    return {
      type: 'broadcast',
      roomCount: activeRooms.length,
      results
    };
  }

  async handleTargetedNotification(targetUserIds, payload) {
    if (!targetUserIds || targetUserIds.length === 0) {
      throw new Error('定向通知需要指定目标用户');
    }

    const connections = this.webSocketService.connectionMap;
    const notifiedUsers = new Set();

    for (const ws of connections.values()) {
      if (targetUserIds.includes(ws.userId)) {
        const messageData = {
          id: Date.now().toString() + '-' + ws.userId,
          senderId: 'system',
          senderName: '系统通知',
          content: payload.content,
          messageType: 'notification',
          timestamp: Date.now()
        };

        this.webSocketService.sendToClient(ws, {
          type: 'notification',
          data: messageData
        });

        notifiedUsers.add(ws.userId);
      }
    }

    return {
      type: 'targeted_notification',
      totalTargeted: targetUserIds.length,
      successfullyNotified: notifiedUsers.size,
      notifiedUsers: Array.from(notifiedUsers)
    };
  }

  async handleLiveStarted(liveRoomId, payload) {
    if (!liveRoomId) {
      throw new Error('直播开始通知需要指定直播间ID');
    }

    const liveRoom = LiveRoom.findById(liveRoomId);
    if (!liveRoom) {
      throw new Error(`直播间不存在: ${liveRoomId}`);
    }

    this.webSocketService.broadcastToRoom(liveRoomId, {
      type: 'live_started',
      data: {
        room: liveRoom,
        timestamp: Date.now(),
        payload
      }
    });

    return {
      type: 'live_started',
      liveRoomId,
      userCount: this.webSocketService.getRoomUserCount(liveRoomId)
    };
  }

  async handleLiveEnded(liveRoomId, payload) {
    if (!liveRoomId) {
      throw new Error('直播结束通知需要指定直播间ID');
    }

    const liveRoom = LiveRoom.findById(liveRoomId);
    if (!liveRoom) {
      throw new Error(`直播间不存在: ${liveRoomId}`);
    }

    this.webSocketService.broadcastToRoom(liveRoomId, {
      type: 'live_ended',
      data: {
        room: liveRoom,
        timestamp: Date.now(),
        payload
      }
    });

    return {
      type: 'live_ended',
      liveRoomId,
      userCount: this.webSocketService.getRoomUserCount(liveRoomId)
    };
  }

  async processDelayedMessages() {
    while (this.isRunning) {
      try {
        await messageQueue.processDelayedMessages();
        await this.sleep(1000);
      } catch (error) {
        logger.error('延迟消息处理错误:', error);
      }
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = PushTaskService;
