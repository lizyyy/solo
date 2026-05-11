const express = require('express');
const router = express.Router();
const shipService = require('../services/shipService');
const { handleError } = require('../utils/errors');

router.post('/', (req, res) => {
  try {
    const ship = shipService.createShip(req.body);
    res.json({ success: true, data: ship });
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/', (req, res) => {
  try {
    const ships = shipService.getAllShips();
    res.json({ success: true, data: ships });
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/:id', (req, res) => {
  try {
    const ship = shipService.getShip(req.params.id);
    res.json({ success: true, data: ship });
  } catch (error) {
    handleError(res, error);
  }
});

module.exports = router;
