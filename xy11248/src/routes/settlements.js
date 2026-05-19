const express = require('express');
const router = express.Router();
const settlementService = require('../services/settlementService');

router.post('/', async (req, res) => {
  try {
    const { group_leader_id, start_date, end_date, operator } = req.body;

    if (!group_leader_id || !start_date || !end_date) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const result = await settlementService.createSettlement(
      group_leader_id, start_date, end_date, operator
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/confirm', async (req, res) => {
  try {
    const result = await settlementService.confirmSettlement(req.params.id, req.body.operator);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/export', async (req, res) => {
  try {
    const { csv, settlement } = await settlementService.exportSettlement(req.params.id);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=${settlement.settlement_no}.csv`);
    res.send('\uFEFF' + csv);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const filters = {
      group_leader_id: req.query.group_leader_id,
      status: req.query.status
    };
    const settlements = await settlementService.getSettlements(filters);
    res.json(settlements);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const detail = await settlementService.getSettlementDetail(req.params.id);
    if (!detail) {
      return res.status(404).json({ error: '结算单不存在' });
    }
    res.json(detail);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
