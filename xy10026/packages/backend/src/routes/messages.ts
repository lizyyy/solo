import { Router, Request, Response } from 'express';
import Joi from 'joi';
import messageService from '../services/MessageService';
import { MessageType, MessageStatus } from '@live-push/shared';
import logger from '../utils/logger';

const router = Router();

const createMessageSchema = Joi.object({
  roomId: Joi.string().required(),
  type: Joi.string().valid(...Object.values(MessageType)).required(),
  content: Joi.string().required(),
  senderId: Joi.string().required(),
  senderName: Joi.string().required(),
  metadata: Joi.object().optional(),
  operatorId: Joi.string().optional(),
  operatorName: Joi.string().optional(),
  idempotencyKey: Joi.string().optional(),
});

const updateMessageSchema = Joi.object({
  content: Joi.string().optional(),
  metadata: Joi.object().optional(),
  expectedVersion: Joi.number().integer().optional(),
  operatorId: Joi.string().required(),
  operatorName: Joi.string().required(),
  reason: Joi.string().optional(),
});

const getMessagesSchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(50),
  offset: Joi.number().integer().min(0).default(0),
  status: Joi.string().valid(...Object.values(MessageStatus)).optional(),
  type: Joi.string().valid(...Object.values(MessageType)).optional(),
  startTime: Joi.string().optional(),
  endTime: Joi.string().optional(),
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { error, value } = createMessageSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const result = await messageService.createMessage({
      ...value,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    return res.status(201).json({
      message: result.message,
      isDuplicate: result.isDuplicate,
    });
  } catch (error) {
    logger.error('Create message failed', error as Error);
    return res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/room/:roomId', async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    const { error, value } = getMessagesSchema.validate(req.query);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const options: any = {
      limit: value.limit,
      offset: value.offset,
    };

    if (value.status) options.status = value.status;
    if (value.type) options.type = value.type;
    if (value.startTime) options.startTime = new Date(value.startTime);
    if (value.endTime) options.endTime = new Date(value.endTime);

    const result = await messageService.getMessagesByRoom(roomId, options);

    return res.json(result);
  } catch (error) {
    logger.error('Get messages failed', error as Error);
    return res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/:messageId', async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params;
    const message = await messageService.getMessageById(messageId);

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    return res.json(message);
  } catch (error) {
    logger.error('Get message failed', error as Error);
    return res.status(500).json({ error: (error as Error).message });
  }
});

router.put('/:messageId', async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params;
    const { error, value } = updateMessageSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const updates: any = {};
    if (value.content) updates.content = value.content;
    if (value.metadata) updates.metadata = value.metadata;

    const updatedMessage = await messageService.updateMessage({
      messageId,
      updates,
      expectedVersion: value.expectedVersion,
      operatorId: value.operatorId,
      operatorName: value.operatorName,
      reason: value.reason,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    return res.json(updatedMessage);
  } catch (error) {
    logger.error('Update message failed', error as Error);
    const errMsg = (error as Error).message;
    if (errMsg.includes('Version conflict')) {
      return res.status(409).json({ error: errMsg });
    }
    if (errMsg.includes('Message not found')) {
      return res.status(404).json({ error: errMsg });
    }
    return res.status(500).json({ error: errMsg });
  }
});

router.delete('/:messageId', async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params;
    const { operatorId, operatorName, reason } = req.body;

    if (!operatorId || !operatorName) {
      return res.status(400).json({ error: 'operatorId and operatorName are required' });
    }

    await messageService.deleteMessage({
      messageId,
      operatorId,
      operatorName,
      reason,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    return res.status(204).send();
  } catch (error) {
    logger.error('Delete message failed', error as Error);
    const errMsg = (error as Error).message;
    if (errMsg.includes('Message not found')) {
      return res.status(404).json({ error: errMsg });
    }
    return res.status(500).json({ error: errMsg });
  }
});

router.post('/:messageId/retry', async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params;
    const { operatorId, operatorName, traceId } = req.body;

    if (!operatorId || !operatorName) {
      return res.status(400).json({ error: 'operatorId and operatorName are required' });
    }

    const message = await messageService.retryMessage(
      messageId,
      operatorId,
      operatorName,
      traceId || `retry-${Date.now()}`
    );

    return res.json(message);
  } catch (error) {
    logger.error('Retry message failed', error as Error);
    const errMsg = (error as Error).message;
    if (errMsg.includes('Message not found')) {
      return res.status(404).json({ error: errMsg });
    }
    if (errMsg.includes('Max retries exceeded')) {
      return res.status(400).json({ error: errMsg });
    }
    return res.status(500).json({ error: errMsg });
  }
});

router.post('/:messageId/rollback', async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params;
    const { operatorId, operatorName, reason, traceId } = req.body;

    if (!operatorId || !operatorName || !reason) {
      return res.status(400).json({ error: 'operatorId, operatorName, and reason are required' });
    }

    const message = await messageService.rollbackMessage(
      messageId,
      operatorId,
      operatorName,
      reason,
      traceId || `rollback-${Date.now()}`
    );

    return res.json(message);
  } catch (error) {
    logger.error('Rollback message failed', error as Error);
    const errMsg = (error as Error).message;
    if (errMsg.includes('Message not found')) {
      return res.status(404).json({ error: errMsg });
    }
    if (errMsg.includes('Nothing to rollback')) {
      return res.status(400).json({ error: errMsg });
    }
    return res.status(500).json({ error: errMsg });
  }
});

export default router;
