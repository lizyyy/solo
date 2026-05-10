const express = require('express');
const { PrismaClient } = require('@prisma/client');
const router = express.Router();
const prisma = new PrismaClient();
const { AUDIT_ACTION_LABELS } = require('../utils/constants');

router.get('/:shipmentId', async (req, res) => {
  try {
    const { shipmentId } = req.params;

    const histories = await prisma.auditHistory.findMany({
      where: { shipmentId },
      orderBy: { actionTime: 'asc' }
    });

    const result = histories.map(h => ({
      ...h,
      actionLabel: AUDIT_ACTION_LABELS[h.action] || h.action,
      beforeSnapshot: h.beforeSnapshot ? JSON.parse(h.beforeSnapshot) : null,
      afterSnapshot: h.afterSnapshot ? JSON.parse(h.afterSnapshot) : null
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { 
      shipmentId, 
      batchId, 
      recipientId, 
      action, 
      operator,
      limit = 100 
    } = req.query;

    const where = {};
    if (shipmentId) where.shipmentId = shipmentId;
    if (batchId) where.batchId = batchId;
    if (recipientId) where.recipientId = recipientId;
    if (action) where.action = action;
    if (operator) where.operator = { contains: operator };

    const histories = await prisma.auditHistory.findMany({
      where,
      orderBy: { actionTime: 'desc' },
      take: parseInt(limit)
    });

    const result = histories.map(h => ({
      ...h,
      actionLabel: AUDIT_ACTION_LABELS[h.action] || h.action,
      beforeSnapshot: h.beforeSnapshot ? JSON.parse(h.beforeSnapshot) : null,
      afterSnapshot: h.afterSnapshot ? JSON.parse(h.afterSnapshot) : null
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
