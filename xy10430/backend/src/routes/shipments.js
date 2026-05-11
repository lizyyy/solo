const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { Shipment, CargoType, TemperatureRecord, TransportNode, SignOff } = require('../models');
const temperatureAnalysisService = require('../services/TemperatureAnalysisService');

router.get('/', async (req, res) => {
  try {
    const { page = 1, pageSize = 10, status, customerName, shipmentNo } = req.query;
    const where = {};
    
    if (status) where.status = status;
    if (customerName) where.customerName = { [Op.like]: `%${customerName}%` };
    if (shipmentNo) where.shipmentNo = { [Op.like]: `%${shipmentNo}%` };

    const offset = (page - 1) * pageSize;
    const limit = parseInt(pageSize);

    const { count, rows } = await Shipment.findAndCountAll({
      where,
      include: ['cargoType'],
      order: [['createdAt', 'DESC']],
      offset,
      limit
    });

    res.json({
      success: true,
      data: rows,
      total: count,
      page: parseInt(page),
      pageSize: limit
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const shipment = await Shipment.findByPk(req.params.id, {
      include: ['cargoType']
    });
    
    if (!shipment) {
      return res.status(404).json({ success: false, message: '运单不存在' });
    }

    res.json({ success: true, data: shipment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const shipment = await Shipment.create(req.body);
    res.json({ success: true, data: shipment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const shipment = await Shipment.findByPk(req.params.id);
    if (!shipment) {
      return res.status(404).json({ success: false, message: '运单不存在' });
    }
    await shipment.update(req.body);
    res.json({ success: true, data: shipment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id/analysis', async (req, res) => {
  try {
    const shipment = await Shipment.findByPk(req.params.id, {
      include: ['cargoType']
    });
    
    if (!shipment) {
      return res.status(404).json({ success: false, message: '运单不存在' });
    }

    const analysis = await temperatureAnalysisService.analyzeOvertemp(
      shipment.id,
      shipment.cargoType
    );

    const temperatureRecords = await TemperatureRecord.findAll({
      where: { shipmentId: shipment.id },
      order: [['recordTime', 'ASC']]
    });

    const nodes = await TransportNode.findAll({
      where: { shipmentId: shipment.id },
      order: [['nodeOrder', 'ASC']]
    });

    const signOff = await SignOff.findOne({
      where: { shipmentId: shipment.id }
    });

    res.json({
      success: true,
      data: {
        shipment,
        analysis,
        temperatureRecords,
        nodes,
        signOff
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
