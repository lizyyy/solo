const express = require('express');
const router = express.Router();
const { SignOff, Shipment } = require('../models');

router.get('/shipment/:shipmentId', async (req, res) => {
  try {
    const signOff = await SignOff.findOne({
      where: { shipmentId: req.params.shipmentId }
    });
    res.json({ success: true, data: signOff });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { shipmentId, ...signOffData } = req.body;
    
    const existing = await SignOff.findOne({ where: { shipmentId } });
    let signOff;
    
    if (existing) {
      await existing.update(signOffData);
      signOff = existing;
    } else {
      signOff = await SignOff.create({ shipmentId, ...signOffData });
    }

    const shipment = await Shipment.findByPk(shipmentId);
    if (shipment) {
      let newStatus = 'signed_off';
      if (signOffData.signOffResult === 'overtemp_warning' || 
          signOffData.signOffResult === 'overtemp_serious' ||
          signOffData.signOffResult === 'damaged') {
        newStatus = 'claim_pending';
      }
      await shipment.update({ status: newStatus });
    }

    res.json({ success: true, data: signOff });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const signOff = await SignOff.findByPk(req.params.id);
    if (!signOff) {
      return res.status(404).json({ success: false, message: '签收记录不存在' });
    }
    await signOff.update(req.body);
    res.json({ success: true, data: signOff });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
