const { v4: uuidv4 } = require('uuid');
const PushMessage = require('../models/PushMessage');
const redis = require('./redis');
const config = require('../config');
const logger = require('../utils/logger');
const auditService = require('./auditService');

const STREAM_NAME = 'push_messages';

async function enqueuePushMessage(messageData, user, req) {
  const { title, content, pushType = 'broadcast', targetUsers = [], priority = 0, scheduledAt = null } = messageData;
  const idempotencyKey = uuidv4();
  
  const message = new PushMessage({
    idempotencyKey,
    title,
    content,
    pushType,
    targetUsers,
    priority,
    scheduledAt,
    status: 'queued',
    createdBy: user._id,
  });
  
  await message.save();
  
  if (!scheduledAt || new Date(scheduledAt) <= new Date()) {
    await sendToStream(message);
  }
  
  await auditService.logAction({
    action: 'push_created',
    resourceType: 'push_message',
    resourceId: message._id,
    userId: user._id,
    username: user.username,
    req,
    after: message.toObject(),
    description: `Created push message: ${title}`,
  });
  
  return message;
}

async function sendToStream(message) {
  const redisClient = await redis.getClient();
  await redis.ensureStream(STREAM_NAME);
  
  const messagePayload = {
    messageId: message._id.toString(),
    title: message.title,
    content: message.content,
    pushType: message.pushType,
    targetUsers: JSON.stringify(message.targetUsers),
    priority: message.priority.toString(),
    idempotencyKey: message.idempotencyKey,
  };
  
  const streamId = await redisClient.xAdd(STREAM_NAME, '*', messagePayload);
  
  await PushMessage.findByIdAndUpdate(message._id, {
    streamMessageId: streamId,
    status: 'queued',
  });
  
  logger.info(`Message ${message._id} added to stream with ID ${streamId}`);
  return streamId;
}

async function getPushMessages(filters = {}, page = 1, limit = 20) {
  const query = {};
  
  if (filters.status) {
    query.status = filters.status;
  }
  
  if (filters.pushType) {
    query.pushType = filters.pushType;
  }
  
  if (filters.createdBy) {
    query.createdBy = filters.createdBy;
  }
  
  if (filters.keyword) {
    query.$or = [
      { title: { $regex: filters.keyword, $options: 'i' } },
      { content: { $regex: filters.keyword, $options: 'i' } },
    ];
  }
  
  const skip = (page - 1) * limit;
  
  const [messages, total] = await Promise.all([
    PushMessage.find(query)
      .sort({ priority: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'username role')
      .lean(),
    PushMessage.countDocuments(query),
  ]);
  
  return { messages, total };
}

async function getPushMessageById(id) {
  return PushMessage.findById(id)
    .populate('createdBy', 'username role')
    .lean();
}

async function updatePushMessage(id, updates, user, req) {
  const existing = await PushMessage.findById(id);
  
  if (!existing) {
    const error = new Error('Message not found');
    error.statusCode = 404;
    throw error;
  }
  
  if (['processing', 'sent', 'cancelled'].includes(existing.status)) {
    const error = new Error('Cannot update message in this status');
    error.statusCode = 400;
    throw error;
  }
  
  const beforeData = existing.toObject();
  
  const allowedFields = ['title', 'content', 'pushType', 'targetUsers', 'priority', 'scheduledAt'];
  const updateData = {};
  
  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      updateData[field] = updates[field];
    }
  }
  
  updateData.$inc = { version: 1 };
  
  const updated = await PushMessage.findByIdAndUpdate(
    id,
    updateData,
    { new: true }
  );
  
  if (!existing.scheduledAt && existing.status === 'queued') {
    await sendToStream(updated);
  }
  
  const afterData = updated.toObject();
  const changes = auditService.calculateChanges(beforeData, afterData);
  
  await auditService.logAction({
    action: 'push_updated',
    resourceType: 'push_message',
    resourceId: id,
    userId: user._id,
    username: user.username,
    req,
    before: beforeData,
    after: afterData,
    changes,
    description: `Updated push message: ${updated.title}`,
  });
  
  return updated;
}

async function cancelPushMessage(id, user, req) {
  const existing = await PushMessage.findById(id);
  
  if (!existing) {
    const error = new Error('Message not found');
    error.statusCode = 404;
    throw error;
  }
  
  if (!['pending', 'queued'].includes(existing.status)) {
    const error = new Error('Cannot cancel message in this status');
    error.statusCode = 400;
    throw error;
  }
  
  const beforeData = existing.toObject();
  
  const updated = await PushMessage.findByIdAndUpdate(
    id,
    { status: 'cancelled', $inc: { version: 1 } },
    { new: true }
  );
  
  await auditService.logAction({
    action: 'push_cancelled',
    resourceType: 'push_message',
    resourceId: id,
    userId: user._id,
    username: user.username,
    req,
    before: beforeData,
    after: updated.toObject(),
    description: `Cancelled push message: ${existing.title}`,
  });
  
  return updated;
}

async function retryPushMessage(id, user, req) {
  const existing = await PushMessage.findById(id);
  
  if (!existing) {
    const error = new Error('Message not found');
    error.statusCode = 404;
    throw error;
  }
  
  if (!['failed', 'partially_failed'].includes(existing.status)) {
    const error = new Error('Cannot retry message in this status');
    error.statusCode = 400;
    throw error;
  }
  
  if (existing.retryCount >= existing.maxRetries) {
    const error = new Error('Max retry attempts reached');
    error.statusCode = 400;
    throw error;
  }
  
  const beforeData = existing.toObject();
  
  const updated = await PushMessage.findByIdAndUpdate(
    id,
    {
      status: 'queued',
      retryCount: existing.retryCount + 1,
      $inc: { version: 1 },
      errorMessage: null,
      failedAt: null,
    },
    { new: true }
  );
  
  await sendToStream(updated);
  
  await auditService.logAction({
    action: 'push_retried',
    resourceType: 'push_message',
    resourceId: id,
    userId: user._id,
    username: user.username,
    req,
    before: beforeData,
    after: updated.toObject(),
    description: `Retried push message (attempt ${existing.retryCount + 1}): ${existing.title}`,
  });
  
  return updated;
}

async function deletePushMessage(id, user, req) {
  const existing = await PushMessage.findById(id);
  
  if (!existing) {
    const error = new Error('Message not found');
    error.statusCode = 404;
    throw error;
  }
  
  const beforeData = existing.toObject();
  await PushMessage.findByIdAndDelete(id);
  
  await auditService.logAction({
    action: 'push_deleted',
    resourceType: 'push_message',
    resourceId: id,
    userId: user._id,
    username: user.username,
    req,
    before: beforeData,
    description: `Deleted push message: ${existing.title}`,
  });
  
  return true;
}

async function getStatistics() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const [
    totalMessages,
    todayMessages,
    statusStats,
    typeStats,
  ] = await Promise.all([
    PushMessage.countDocuments(),
    PushMessage.countDocuments({ createdAt: { $gte: today } }),
    PushMessage.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    PushMessage.aggregate([
      { $group: { _id: '$pushType', count: { $sum: 1 } } },
    ]),
  ]);
  
  const statusCounts = {};
  for (const stat of statusStats) {
    statusCounts[stat._id] = stat.count;
  }
  
  const typeCounts = {};
  for (const stat of typeStats) {
    typeCounts[stat._id] = stat.count;
  }
  
  return {
    total: totalMessages,
    today: todayMessages,
    byStatus: statusCounts,
    byType: typeCounts,
  };
}

module.exports = {
  STREAM_NAME,
  enqueuePushMessage,
  getPushMessages,
  getPushMessageById,
  updatePushMessage,
  cancelPushMessage,
  retryPushMessage,
  deletePushMessage,
  getStatistics,
};
