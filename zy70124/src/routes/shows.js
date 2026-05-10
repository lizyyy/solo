const express = require('express');
const router = express.Router();
const { createShow, createTier, getTier, getAvailable } = require('../services/inventory');
const { listShows, getShowSalesReport } = require('../services/report');
const { listQueue } = require('../services/queue');

router.post('/', (req, res) => {
  const { name, description, startTime, endTime, venue } = req.body;
  
  if (!name || !startTime) {
    return res.status(400).json({
      success: false,
      message: '演出名称和开演时间必填'
    });
  }

  try {
    const showId = createShow({
      name,
      description,
      start_time: startTime,
      end_time: endTime,
      venue
    });

    res.json({
      success: true,
      message: '演出创建成功',
      data: { showId }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `创建演出失败: ${error.message}`
    });
  }
});

router.post('/:showId/tiers', (req, res) => {
  const { showId } = req.params;
  const { name, price, totalQuantity, perIdCardLimit, perAccountLimit, perPaymentLimit } = req.body;

  if (!name || price === undefined || !totalQuantity) {
    return res.status(400).json({
      success: false,
      message: '票档名称、价格、总票数必填'
    });
  }

  try {
    const tierId = createTier(showId, {
      name,
      price: Math.round(parseFloat(price) * 100),
      total_quantity: parseInt(totalQuantity),
      per_id_card_limit: perIdCardLimit,
      per_account_limit: perAccountLimit,
      per_payment_limit: perPaymentLimit
    });

    res.json({
      success: true,
      message: '票档创建成功',
      data: { tierId }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `创建票档失败: ${error.message}`
    });
  }
});

router.get('/', (req, res) => {
  const shows = listShows();
  res.json({
    success: true,
    data: shows
  });
});

router.get('/:showId/report', (req, res) => {
  const report = getShowSalesReport(req.params.showId);
  if (!report) {
    return res.status(404).json({ success: false, message: '演出不存在' });
  }
  res.json({ success: true, data: report });
});

router.get('/tiers/:tierId', (req, res) => {
  const tier = getTier(req.params.tierId);
  if (!tier) {
    return res.status(404).json({ success: false, message: '票档不存在' });
  }
  
  const avail = getAvailable(req.params.tierId);
  res.json({
    success: true,
    data: {
      ...tier,
      priceDisplay: `¥${(tier.price / 100).toFixed(2)}`,
      inventory: avail
    }
  });
});

router.get('/tiers/:tierId/queue', (req, res) => {
  const queue = listQueue(req.params.tierId);
  res.json({
    success: true,
    data: {
      total: queue.length,
      waiting: queue.filter(q => q.status === 'waiting').length,
      items: queue
    }
  });
});

module.exports = router;
