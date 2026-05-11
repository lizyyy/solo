const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const { TemperatureRecord, Shipment, CargoType } = require('../models');
const temperatureAnalysisService = require('../services/TemperatureAnalysisService');

const upload = multer({ storage: multer.memoryStorage() });

router.get('/shipment/:shipmentId', async (req, res) => {
  try {
    const records = await TemperatureRecord.findAll({
      where: { shipmentId: req.params.shipmentId },
      order: [['recordTime', 'ASC']]
    });
    res.json({ success: true, data: records });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const records = Array.isArray(req.body) ? req.body : [req.body];
    const created = await TemperatureRecord.bulkCreate(records);
    res.json({ success: true, data: created, count: created.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/import/:shipmentId', upload.single('file'), async (req, res) => {
  try {
    const shipment = await Shipment.findByPk(req.params.shipmentId, {
      include: ['cargoType']
    });
    
    if (!shipment) {
      return res.status(404).json({ success: false, message: '运单不存在' });
    }

    const workbook = XLSX.read(req.file.buffer);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);

    const records = data.map(row => ({
      shipmentId: shipment.id,
      recordTime: row['时间'] || row['time'] || row['recordTime'],
      temperature: parseFloat(row['温度'] || row['temperature'] || row['temp']),
      humidity: row['湿度'] || row['humidity'] ? parseFloat(row['湿度'] || row['humidity']) : null,
      location: row['位置'] || row['location'] || null,
      source: 'import'
    })).filter(r => r.recordTime && !isNaN(r.temperature));

    if (shipment.cargoType) {
      const { minTemp, maxTemp } = shipment.cargoType;
      records.forEach(r => {
        r.isOvertemp = r.temperature < parseFloat(minTemp) || r.temperature > parseFloat(maxTemp);
      });
    }

    await TemperatureRecord.destroy({ where: { shipmentId: shipment.id, source: 'import' } });
    const created = await TemperatureRecord.bulkCreate(records);

    res.json({
      success: true,
      message: `成功导入${created.length}条温度记录`,
      count: created.length
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await TemperatureRecord.destroy({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
