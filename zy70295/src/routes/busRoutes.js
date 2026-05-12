const express = require('express');
const router = express.Router();
const busRouteService = require('../services/busRouteService');

router.post('/', (req, res) => {
  const result = busRouteService.createRoute(req.body);
  if (result.success) {
    res.status(201).json(result);
  } else {
    res.status(400).json(result);
  }
});

router.get('/', (req, res) => {
  const result = busRouteService.getRoutes(req.query);
  res.json(result);
});

router.get('/:id', (req, res) => {
  const result = busRouteService.getRouteById(req.params.id);
  if (result.success) {
    res.json(result);
  } else {
    res.status(404).json(result);
  }
});

module.exports = router;