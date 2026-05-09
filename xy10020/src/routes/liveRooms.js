const express = require('express');
const LiveRoom = require('../models/LiveRoom');
const OperationLog = require('../models/OperationLog');
const { authenticate } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');

const router = express.Router();

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const rooms = LiveRoom.findActive();
    res.json(rooms);
  } catch (error) {
    next(error);
  }
});

router.get('/my', async (req, res, next) => {
  try {
    const rooms = LiveRoom.findByStreamerId(req.user.id);
    res.json(rooms);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const room = LiveRoom.findById(req.params.id);

    if (!room) {
      return res.status(404).json({
        error: '资源不存在',
        message: '直播间不存在'
      });
    }

    res.json(room);
  } catch (error) {
    next(error);
  }
});

router.post('/', validate(schemas.createLiveRoom), async (req, res, next) => {
  try {
    const { title } = req.body;

    const room = LiveRoom.create({
      title,
      streamerId: req.user.id
    });

    OperationLog.create({
      operationType: 'CREATE_LIVE_ROOM',
      entityType: 'live_room',
      entityId: room.id,
      userId: req.user.id,
      beforeData: null,
      afterData: room,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(201).json(room);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', validate(schemas.updateLiveRoom), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, status, version } = req.body;

    const existingRoom = LiveRoom.findById(id);
    if (!existingRoom) {
      return res.status(404).json({
        error: '资源不存在',
        message: '直播间不存在'
      });
    }

    if (existingRoom.streamerId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        error: '禁止访问',
        message: '无权修改此直播间'
      });
    }

    const updates = {};
    if (title !== undefined) updates.title = title;
    if (status !== undefined) updates.status = status;

    const updatedRoom = LiveRoom.updateWithOptimisticLock(id, updates, version);

    if (!updatedRoom) {
      return res.status(409).json({
        error: '并发冲突',
        message: '数据已被其他用户修改，请刷新后重试',
        currentVersion: LiveRoom.findById(id)?.version
      });
    }

    let operationType = 'UPDATE_LIVE_ROOM';
    if (status === 'live') {
      operationType = 'START_LIVE';
    } else if (status === 'ended') {
      operationType = 'END_LIVE';
    }

    OperationLog.create({
      operationType,
      entityType: 'live_room',
      entityId: id,
      userId: req.user.id,
      beforeData: existingRoom,
      afterData: updatedRoom,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json(updatedRoom);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const existingRoom = LiveRoom.findById(id);
    if (!existingRoom) {
      return res.status(404).json({
        error: '资源不存在',
        message: '直播间不存在'
      });
    }

    if (existingRoom.streamerId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        error: '禁止访问',
        message: '无权删除此直播间'
      });
    }

    const deleted = LiveRoom.delete(id);

    if (deleted) {
      OperationLog.create({
        operationType: 'DELETE_LIVE_ROOM',
        entityType: 'live_room',
        entityId: id,
        userId: req.user.id,
        beforeData: existingRoom,
        afterData: null,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
    }

    res.json({ success: deleted });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
