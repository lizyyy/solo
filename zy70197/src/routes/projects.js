const express = require('express');
const router = express.Router();
const ProjectService = require('../services/ProjectService');
const OrderService = require('../services/OrderService');

router.post('/', (req, res) => {
  try {
    const { name, agreementId } = req.body;
    const project = ProjectService.createProject({ name, agreementId });
    res.status(201).json(project);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/', (req, res) => {
  try {
    const projects = ProjectService.getAllProjects();
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const project = ProjectService.getProject(req.params.id);
    res.json(project);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

router.post('/:id/reserve', (req, res) => {
  try {
    const { amount } = req.body;
    const result = OrderService.reserveForProject(req.params.id, amount);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/:id/orders', (req, res) => {
  try {
    const orders = OrderService.getOrdersByProject(req.params.id);
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
