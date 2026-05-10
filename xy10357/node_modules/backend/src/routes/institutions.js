const express = require('express');
const { PrismaClient } = require('@prisma/client');
const router = express.Router();
const prisma = new PrismaClient();

router.get('/', async (req, res) => {
  try {
    const institutions = await prisma.receivingInstitution.findMany({
      include: {
        recipients: true,
        shipments: {
          select: { id: true, shipmentNumber: true, status: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(institutions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, address, contact, phone } = req.body;
    const institution = await prisma.receivingInstitution.create({
      data: { name, address, contact, phone }
    });
    res.status(201).json(institution);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, address, contact, phone } = req.body;
    const institution = await prisma.receivingInstitution.update({
      where: { id },
      data: { name, address, contact, phone }
    });
    res.json(institution);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const institution = await prisma.receivingInstitution.findUnique({
      where: { id },
      include: {
        recipients: true,
        shipments: {
          include: { batch: true, recipient: true }
        }
      }
    });
    if (!institution) {
      return res.status(404).json({ error: '接收机构不存在' });
    }
    res.json(institution);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
