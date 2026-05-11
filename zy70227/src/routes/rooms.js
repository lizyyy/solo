const express = require('express');
const RoomService = require('../services/RoomService');
const { BusinessError } = require('../errors');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const rooms = await RoomService.getAll();
    res.json({ success: true, data: rooms });
  } catch (error) {
    if (error instanceof BusinessError) {
      res.status(error.status).json(error.toJSON());
    } else {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }
});

router.get('/:id', async (req, res) => {
  try {
    const room = await RoomService.getById(req.params.id);
    res.json({ success: true, data: room });
  } catch (error) {
    if (error instanceof BusinessError) {
      res.status(error.status).json(error.toJSON());
    } else {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }
});

router.post('/', async (req, res) => {
  try {
    const room = await RoomService.create(req.body);
    res.status(201).json({ success: true, data: room });
  } catch (error) {
    if (error instanceof BusinessError) {
      res.status(error.status).json(error.toJSON());
    } else {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }
});

router.put('/:id', async (req, res) => {
  try {
    const room = await RoomService.update(req.params.id, req.body);
    res.json({ success: true, data: room });
  } catch (error) {
    if (error instanceof BusinessError) {
      res.status(error.status).json(error.toJSON());
    } else {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await RoomService.delete(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof BusinessError) {
      res.status(error.status).json(error.toJSON());
    } else {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }
});

module.exports = router;
