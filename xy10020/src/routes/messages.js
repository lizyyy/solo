const express = require('express');
const Message = require('../models/Message');
const LiveRoom = require('../models/LiveRoom');
const OperationLog = require('../models/OperationLog');
const { authenticate } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');

const router = express.Router();

router.use(authenticate);

router.get('/live-room/:liveRoomId', async (req, res, next) => {
  try {
    const { liveRoomId } = req.params;
    const { sinceSequence, limit } = req.query;

    const room = LiveRoom.findById(liveRoomId);
    if (!room) {
      return res.status(404).json({
        error: '资源不存在',
        message: '直播间不存在'
      });
    }

    const messages = Message.findByLiveRoom(liveRoomId, {
      sinceSequence: parseInt(sinceSequence) || 0,
      limit: Math.min(parseInt(limit) || 100, 500)
    });

    res.json({
      messages,
      maxSequence: Message.getMaxSequence(liveRoomId)
    });
  } catch (error) {
    next(error);
  }
});

router.post('/live-room/:liveRoomId', validate(schemas.sendMessage), async (req, res, next) => {
  try {
    const { liveRoomId } = req.params;
    const { content, messageType } = req.body;

    const room = LiveRoom.findById(liveRoomId);
    if (!room) {
      return res.status(404).json({
        error: '资源不存在',
        message: '直播间不存在'
      });
    }

    const result = Message.create({
      liveRoomId,
      senderId: req.user.id,
      content,
      messageType
    });

    OperationLog.create({
      operationType: 'SEND_MESSAGE',
      entityType: 'message',
      entityId: result.id,
      userId: req.user.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const message = Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({
        error: '资源不存在',
        message: '消息不存在'
      });
    }

    res.json(message);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
