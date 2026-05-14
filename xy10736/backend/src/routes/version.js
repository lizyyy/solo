const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const stateMachine = require('../services/stateMachine');

router.get('/', async (req, res) => {
  const versions = await prisma.versionRelease.findMany({
    orderBy: { createdAt: 'desc' }
  });
  res.json(versions);
});

router.post('/', async (req, res) => {
  const version = await prisma.versionRelease.create({
    data: req.body
  });
  res.json(version);
});

router.post('/:id/approve', async (req, res) => {
  try {
    const { reviewer, reason } = req.body;
    const version = await stateMachine.transitionVersionStatus(
      req.params.id, 'approved', reviewer, reason
    );
    res.json(version);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/reject', async (req, res) => {
  try {
    const { reviewer, reason } = req.body;
    const version = await stateMachine.transitionVersionStatus(
      req.params.id, 'rejected', reviewer, reason
    );
    res.json(version);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
