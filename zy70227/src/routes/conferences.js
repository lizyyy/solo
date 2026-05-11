const express = require('express');
const ConferenceService = require('../services/ConferenceService');
const { BusinessError } = require('../errors');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const conferences = await ConferenceService.getAll();
    res.json({ success: true, data: conferences });
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
    const conference = await ConferenceService.getById(req.params.id);
    res.json({ success: true, data: conference });
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
    const conference = await ConferenceService.create(req.body);
    res.status(201).json({ success: true, data: conference });
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
    const conference = await ConferenceService.update(req.params.id, req.body);
    res.json({ success: true, data: conference });
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
    const result = await ConferenceService.delete(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof BusinessError) {
      res.status(error.status).json(error.toJSON());
    } else {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }
});

router.post('/:id/start', async (req, res) => {
  try {
    const conference = await ConferenceService.start(req.params.id);
    res.json({ success: true, data: conference });
  } catch (error) {
    if (error instanceof BusinessError) {
      res.status(error.status).json(error.toJSON());
    } else {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }
});

router.post('/:id/complete', async (req, res) => {
  try {
    const conference = await ConferenceService.complete(req.params.id);
    res.json({ success: true, data: conference });
  } catch (error) {
    if (error instanceof BusinessError) {
      res.status(error.status).json(error.toJSON());
    } else {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }
});

router.post('/:id/cancel', async (req, res) => {
  try {
    const conference = await ConferenceService.cancel(req.params.id);
    res.json({ success: true, data: conference });
  } catch (error) {
    if (error instanceof BusinessError) {
      res.status(error.status).json(error.toJSON());
    } else {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }
});

module.exports = router;
