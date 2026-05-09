const redis = require('./redis');
const config = require('../config');
const logger = require('../utils/logger');
const PushMessage = require('../models/PushMessage');
const auditService = require('./auditService');

const STREAM_NAME = 'push_messages';
const CONSUMER_NAME = `consumer-${Date.now()}`;
let isRunning = false;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function simulatePushDelivery(messageData) {
  const failureRate = 0.05;
  
  await sleep(100 + Math.random() * 200);
  
  if (Math.random() < failureRate) {
    throw new Error('Simulated delivery failure');
  }
  
  const deliveredCount = messageData.pushType === 'broadcast' 
    ? Math.floor(Math.random() * 1000) + 500
    : messageData.targetUsers?.length || 0;
  
  return {
    success: true,
    deliveredCount,
    totalRecipients: deliveredCount,
  };
}

async function processMessage(streamEntry) {
  try {
    const fields = streamEntry.message;
    const messageId = fields.messageId;
    
    logger.debug(`Processing message: ${messageId}, entry ID: ${streamEntry.id}`);
    
    const message = await PushMessage.findById(messageId);
    
    if (!message) {
      logger.warn(`Message not found: ${messageId}`);
      return { success: true };
    }
    
    if (message.status === 'cancelled') {
      logger.info(`Message was cancelled: ${messageId}`);
      return { success: true };
    }
    
    if (message.status === 'sent') {
      logger.info(`Message already sent: ${messageId}`);
      return { success: true };
    }
    
    await PushMessage.findByIdAndUpdate(messageId, {
      status: 'processing',
    });
    
    const result = await simulatePushDelivery({
      pushType: message.pushType,
      targetUsers: message.targetUsers,
      title: message.title,
      content: message.content,
    });
    
    await PushMessage.findByIdAndUpdate(messageId, {
      status: 'sent',
      sentAt: new Date(),
      totalRecipients: result.totalRecipients,
      deliveredCount: result.deliveredCount,
      failedCount: result.totalRecipients - result.deliveredCount,
    });
    
    await auditService.logAction({
      action: 'push_sent',
      resourceType: 'push_message',
      resourceId: message._id,
      userId: message.createdBy,
      username: 'system',
      description: `Push message sent successfully: ${message.title}, delivered: ${result.deliveredCount}`,
    });
    
    logger.info(`Message processed successfully: ${messageId}`);
    return { success: true };
    
  } catch (err) {
    logger.error(`Error processing message: ${err.message}`, err);
    
    const fields = streamEntry.message;
    const messageId = fields.messageId;
    
    const message = await PushMessage.findById(messageId);
    
    if (message) {
      const shouldRetry = message.retryCount < message.maxRetries;
      
      if (shouldRetry) {
        await PushMessage.findByIdAndUpdate(messageId, {
          status: 'queued',
          retryCount: message.retryCount + 1,
          errorMessage: err.message,
        });
        
        await auditService.logAction({
          action: 'push_failed',
          resourceType: 'push_message',
          resourceId: message._id,
          userId: message.createdBy,
          username: 'system',
          status: 'failed',
          errorMessage: err.message,
          description: `Push failed, scheduled for retry (${message.retryCount + 1}/${message.maxRetries}): ${message.title}`,
        });
        
        return { success: false, retry: true };
      } else {
        await PushMessage.findByIdAndUpdate(messageId, {
          status: 'failed',
          failedAt: new Date(),
          errorMessage: err.message,
        });
        
        await auditService.logAction({
          action: 'push_failed',
          resourceType: 'push_message',
          resourceId: message._id,
          userId: message.createdBy,
          username: 'system',
          status: 'failed',
          errorMessage: err.message,
          description: `Push failed after all retries: ${message.title}`,
        });
        
        return { success: true };
      }
    }
    
    return { success: false };
  }
}

async function claimPendingMessages(redisClient) {
  try {
    const pending = await redisClient.xPending(STREAM_NAME, config.consumerGroup);
    
    if (pending.pending === 0) {
      return;
    }
    
    const pendingRange = await redisClient.xPendingRange(
      STREAM_NAME,
      config.consumerGroup,
      '-',
      '+',
      10
    );
    
    const now = Date.now();
    const idleThreshold = 30000;
    
    for (const entry of pendingRange) {
      const idle = now - entry.lastDelivered.getTime();
      
      if (idle > idleThreshold) {
        logger.info(`Claiming idle message: ${entry.id}, idle: ${idle}ms`);
        
        try {
          await redisClient.xClaim(
            STREAM_NAME,
            config.consumerGroup,
            CONSUMER_NAME,
            idleThreshold,
            [entry.id]
          );
        } catch (claimErr) {
          logger.warn(`Failed to claim message ${entry.id}: ${claimErr.message}`);
        }
      }
    }
  } catch (err) {
    logger.error('Error claiming pending messages:', err.message);
  }
}

async function processLoop() {
  const redisClient = await redis.getClient();
  
  while (isRunning) {
    try {
      await claimPendingMessages(redisClient);
      
      const entries = await redisClient.xReadGroup(
        config.consumerGroup,
        CONSUMER_NAME,
        [{ key: STREAM_NAME, id: '>' }],
        { COUNT: 10, BLOCK: 5000 }
      );
      
      if (entries && entries.length > 0) {
        const stream = entries[0];
        
        for (const entry of stream.messages) {
          const result = await processMessage(entry);
          
          if (result.success || !result.retry) {
            await redisClient.xAck(STREAM_NAME, config.consumerGroup, [entry.id]);
          }
        }
      }
      
    } catch (err) {
      logger.error('Error in process loop:', err.message);
      await sleep(1000);
    }
  }
}

async function startPushWorker() {
  if (isRunning) {
    logger.warn('Push worker already running');
    return;
  }
  
  await redis.ensureStream(STREAM_NAME);
  
  isRunning = true;
  logger.info(`Starting push worker with consumer name: ${CONSUMER_NAME}`);
  
  processLoop().catch(err => {
    logger.error('Push worker crashed:', err);
    isRunning = false;
  });
}

function stopPushWorker() {
  logger.info('Stopping push worker...');
  isRunning = false;
}

module.exports = {
  startPushWorker,
  stopPushWorker,
};
