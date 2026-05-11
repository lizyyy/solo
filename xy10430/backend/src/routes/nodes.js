const express = require('express');
const router = express.Router();
const { TransportNode } = require('../models');

router.get('/shipment/:shipmentId', async (req, res) => {
  try {
    const nodes = await TransportNode.findAll({
      where: { shipmentId: req.params.shipmentId },
      order: [['nodeOrder', 'ASC']]
    });
    res.json({ success: true, data: nodes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const nodes = Array.isArray(req.body) ? req.body : [req.body];
    const created = await TransportNode.bulkCreate(nodes);
    res.json({ success: true, data: created });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const node = await TransportNode.findByPk(req.params.id);
    if (!node) {
      return res.status(404).json({ success: false, message: '节点不存在' });
    }
    await node.update(req.body);
    res.json({ success: true, data: node });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await TransportNode.destroy({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
