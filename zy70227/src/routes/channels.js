const express = require('express');
const ChannelService = require('../services/ChannelService');
const { BusinessError } = require('../errors');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const channels = await ChannelService.getAll();
    res.json({ success: true, data: channels });
  } catch (error) {
    if (error instanceof BusinessError) {
      res.status(error.status).json(error.toJSON());
    } else {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }
});

router.get('/conference/:conferenceId', async (req, res) => {
  try {
    const channels = await ChannelService.getByConference(req.params.conferenceId);
    res.json({ success: true, data: channels });
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
    const channel = await ChannelService.getById(req.params.id);
    res.json({ success: true, data: channel });
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
    const channel = await ChannelService.create(req.body);
    res.status(201).json({ success: true, data: channel });
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
    const channel = await ChannelService.update(req.params.id, req.body);
    res.json({ success: true, data: channel });
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
    const result = await ChannelService.delete(req.params.id);
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
