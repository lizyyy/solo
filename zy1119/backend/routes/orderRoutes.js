const express = require('express');
const router = express.Router();
const { sequelize } = require('../models');
const { Order, OrderItem, Product, GroupBatch, PickupSlot, InventoryAllocation, InventoryBatch, Exception } = require('../models');
const { Op } = require('sequelize');
const inventoryService = require('../services/inventoryService');
const pickupSlotService = require('../services/pickupSlotService');

router.get('/', async (req, res) => {
  try {
    const { status, group_batch_id, customer_name, date_from, date_to } = req.query;
    const whereClause = {};

    if (status) whereClause.status = status;
    if (group_batch_id) whereClause.group_batch_id = group_batch_id;
    if (customer_name) whereClause.customer_name = { [Op.like]: `%${customer_name}%` };
    if (date_from) whereClause.created_at = { [Op.gte]: date_from };
    if (date_to) {
      if (whereClause.created_at) {
        whereClause.created_at[Op.lte] = date_to;
      } else {
        whereClause.created_at = { [Op.lte]: date_to };
      }
    }

    const orders = await Order.findAll({
      where: whereClause,
      include: [
        {
          model: OrderItem,
          include: [
            Product,
            {
              model: InventoryAllocation,
              include: [InventoryBatch]
            }
          ]
        },
        GroupBatch,
        PickupSlot
      ],
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      data: orders
    });
  } catch (error) {
    console.error('获取订单列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取订单列表失败',
      error: error.message
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id, {
      include: [
        {
          model: OrderItem,
          include: [
            Product,
            {
              model: InventoryAllocation,
              include: [InventoryBatch]
            }
          ]
        },
        GroupBatch,
        PickupSlot,
        Exception
      ]
    });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: '订单不存在'
      });
    }

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('获取订单详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取订单详情失败',
      error: error.message
    });
  }
});

router.post('/', async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { group_batch_id, customer_name, customer_phone, customer_address, pickup_slot_id, items, note } = req.body;

    if (!customer_name || !items || items.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: '客户姓名和订单商品为必填项'
      });
    }

    let totalAmount = 0;
    const orderItems = [];

    for (const item of items) {
      const product = await Product.findByPk(item.product_id, { transaction });
      if (!product) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `商品不存在: ${item.product_id}`
        });
      }
      totalAmount += product.price * item.quantity;
      orderItems.push({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: product.price,
        status: 'pending'
      });
    }

    const pickupCode = String(Math.floor(100000 + Math.random() * 900000));
    
    const order = await Order.create({
      order_no: `ORD${Date.now()}`,
      group_batch_id,
      customer_name,
      customer_phone,
      customer_address,
      pickup_slot_id,
      pickup_code: pickupCode,
      total_amount: totalAmount,
      status: 'paid',
      note
    }, { transaction });

    for (const item of orderItems) {
      item.order_id = order.id;
    }

    const createdOrderItems = await OrderItem.bulkCreate(orderItems, { 
      returning: true,
      transaction 
    });

    for (const orderItem of createdOrderItems) {
      await inventoryService.allocateInventoryToOrderItem(orderItem, transaction);
    }

    if (pickup_slot_id) {
      await pickupSlotService.assignOrderToSlot(order.id, pickup_slot_id);
    }

    const allItemsAllocated = createdOrderItems.every(item => item.status === 'allocated');
    if (allItemsAllocated) {
      order.status = 'allocated';
      await order.save({ transaction });
    }

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: '订单创建成功',
      data: {
        order_id: order.id,
        order_no: order.order_no,
        total_amount: totalAmount,
        pickup_code: pickupCode
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error('创建订单失败:', error);
    res.status(500).json({
      success: false,
      message: '创建订单失败',
      error: error.message
    });
  }
});

router.put('/:id/pickup', async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const order = await Order.findByPk(req.params.id, {
      include: [
        {
          model: OrderItem,
          include: [InventoryAllocation]
        }
      ],
      transaction
    });
    
    if (!order) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: '订单不存在'
      });
    }

    if (order.status === 'picked') {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: '订单已自提'
      });
    }

    for (const orderItem of order.OrderItems) {
      for (const allocation of orderItem.InventoryAllocations) {
        allocation.picked_quantity = allocation.quantity;
        await allocation.save({ transaction });

        const inventoryBatch = await InventoryBatch.findByPk(allocation.inventory_batch_id, { transaction });
        if (inventoryBatch) {
          inventoryBatch.picked_quantity += allocation.quantity;
          if (inventoryBatch.picked_quantity >= inventoryBatch.quantity) {
            inventoryBatch.status = 'depleted';
          }
          await inventoryBatch.save({ transaction });
        }
      }

      orderItem.picked_quantity = orderItem.quantity;
      orderItem.status = 'picked';
      await orderItem.save({ transaction });
    }

    order.status = 'picked';
    order.pickup_time = new Date();
    await order.save({ transaction });

    await transaction.commit();

    res.json({
      success: true,
      message: '自提核销成功',
      data: {
        order_id: order.id,
        order_no: order.order_no,
        pickup_time: order.pickup_time
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error('自提核销失败:', error);
    res.status(500).json({
      success: false,
      message: '自提核销失败',
      error: error.message
    });
  }
});

router.put('/:id/pickup-slot', async (req, res) => {
  try {
    const { pickup_slot_id } = req.body;
    
    if (!pickup_slot_id) {
      return res.status(400).json({
        success: false,
        message: '自提时段ID为必填项'
      });
    }

    const result = await pickupSlotService.assignOrderToSlot(req.params.id, pickup_slot_id);
    
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('更新自提时段失败:', error);
    res.status(500).json({
      success: false,
      message: '更新自提时段失败',
      error: error.message
    });
  }
});

module.exports = router;
