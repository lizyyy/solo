const express = require('express');
const InterpreterService = require('../services/InterpreterService');
const { BusinessError } = require('../errors');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const interpreters = await InterpreterService.getAll();
    res.json({ success: true, data: interpreters });
  } catch (error) {
    if (error instanceof BusinessError) {
      res.status(error.status).json(error.toJSON());
    } else {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }
});

router.get('/active', async (req, res) => {
  try {
    const interpreters = await InterpreterService.getActive();
    res.json({ success: true, data: interpreters });
  } catch (error) {
    if (error instanceof BusinessError) {
      res.status(error.status).json(error.toJSON());
    } else {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }
});

router.get('/language/:language', async (req, res) => {
  try {
    const interpreters = await InterpreterService.getByLanguage(req.params.language);
    res.json({ success: true, data: interpreters });
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
    const interpreter = await InterpreterService.getById(req.params.id);
    res.json({ success: true, data: interpreter });
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
    const interpreter = await InterpreterService.create(req.body);
    res.status(201).json({ success: true, data: interpreter });
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
    const interpreter = await InterpreterService.update(req.params.id, req.body);
    res.json({ success: true, data: interpreter });
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
    const result = await InterpreterService.delete(req.params.id);
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
