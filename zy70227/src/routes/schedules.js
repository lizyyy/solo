const express = require('express');
const ScheduleService = require('../services/ScheduleService');
const { BusinessError } = require('../errors');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const schedules = await ScheduleService.getAll();
    res.json({ success: true, data: schedules });
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
    const schedules = await ScheduleService.getByConference(req.params.conferenceId);
    res.json({ success: true, data: schedules });
  } catch (error) {
    if (error instanceof BusinessError) {
      res.status(error.status).json(error.toJSON());
    } else {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }
});

router.get('/interpreter/:interpreterId', async (req, res) => {
  try {
    const schedules = await ScheduleService.getByInterpreter(req.params.interpreterId);
    res.json({ success: true, data: schedules });
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
    const schedule = await ScheduleService.getById(req.params.id);
    res.json({ success: true, data: schedule });
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
    const schedule = await ScheduleService.create(req.body);
    res.status(201).json({ success: true, data: schedule });
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
    const schedule = await ScheduleService.update(req.params.id, req.body);
    res.json({ success: true, data: schedule });
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
    const result = await ScheduleService.delete(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof BusinessError) {
      res.status(error.status).json(error.toJSON());
    } else {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }
});

router.post('/:id/confirm', async (req, res) => {
  try {
    const schedule = await ScheduleService.confirm(req.params.id);
    res.json({ success: true, data: schedule });
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
    const schedule = await ScheduleService.start(req.params.id);
    res.json({ success: true, data: schedule });
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
    const schedule = await ScheduleService.complete(req.params.id);
    res.json({ success: true, data: schedule });
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
    const schedule = await ScheduleService.cancel(req.params.id);
    res.json({ success: true, data: schedule });
  } catch (error) {
    if (error instanceof BusinessError) {
      res.status(error.status).json(error.toJSON());
    } else {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }
});

module.exports = router;
