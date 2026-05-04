const express = require('express');
const router = express.Router();
const { sequelize } = require('../models');

const productRoutes = require('./productRoutes');
const groupBatchRoutes = require('./groupBatchRoutes');
const orderRoutes = require('./orderRoutes');
const inventoryRoutes = require('./inventoryRoutes');

router.use('/products', productRoutes);
router.use('/group-batches', groupBatchRoutes);
router.use('/orders', orderRoutes);
router.use('/inventory', inventoryRoutes);

const fs = require('fs');
const path = require('path');

const freezerRoutesPath = path.join(__dirname, 'freezerRoutes.js');
const pickupSlotRoutesPath = path.join(__dirname, 'pickupSlotRoutes.js');
const exceptionRoutesPath = path.join(__dirname, 'exceptionRoutes.js');
const exportRoutesPath = path.join(__dirname, 'exportRoutes.js');

if (fs.existsSync(freezerRoutesPath)) {
  const freezerRoutes = require('./freezerRoutes');
  router.use('/freezers', freezerRoutes);
}

if (fs.existsSync(pickupSlotRoutesPath)) {
  const pickupSlotRoutes = require('./pickupSlotRoutes');
  router.use('/pickup-slots', pickupSlotRoutes);
}

if (fs.existsSync(exceptionRoutesPath)) {
  const exceptionRoutes = require('./exceptionRoutes');
  router.use('/exceptions', exceptionRoutes);
}

if (fs.existsSync(exportRoutesPath)) {
  const exportRoutes = require('./exportRoutes');
  router.use('/export', exportRoutes);
}

router.get('/dashboard/stats', async (req, res) => {
  try {
    const { Order, InventoryBatch, Exception, PickupSlot } = require('../models');
    const { Op } = require('sequelize');
    const dayjs = require('dayjs');

    const totalOrders = await Order.count();
    const pendingOrders = await Order.count({ where: { status: { [Op.in]: ['paid', 'allocated'] } } });
    const pickedOrders = await Order.count({ where: { status: 'picked' } });

    const expiringInventory = await InventoryBatch.count({
      where: {
        expiry_date: {
          [Op.between]: [dayjs().format('YYYY-MM-DD'), dayjs().add(7, 'day').format('YYYY-MM-DD')]
        },
        status: { [Op.ne]: 'depleted' }
      }
    });

    const openExceptions = await Exception.count({ where: { status: 'open' } });

    const overloadedSlots = await PickupSlot.count({
      include: [{
        model: Order,
        where: { status: { [Op.in]: ['paid', 'allocated'] } },
        required: false
      }],
      having: sequelize.literal('COUNT(`Orders`.`id`) >= `PickupSlot`.`max_orders` * 0.8')
    });

    res.json({
      success: true,
      data: {
        orders: {
          total: totalOrders,
          pending: pendingOrders,
          picked: pickedOrders
        },
        inventory: {
          expiring: expiringInventory
        },
        exceptions: {
          open: openExceptions
        },
        slots: {
          overloaded: overloadedSlots
        }
      }
    });
  } catch (error) {
    console.error('获取统计数据失败:', error);
    res.status(500).json({
      success: false,
      message: '获取统计数据失败',
      error: error.message
    });
  }
});

module.exports = router;
