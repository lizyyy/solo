const { PickupSlot, Order } = require('../models');
const { Op } = require('sequelize');
const dayjs = require('dayjs');

const checkSlotAvailability = async (slotId) => {
  const slot = await PickupSlot.findByPk(slotId, {
    include: [{
      model: Order,
      where: { status: { [Op.in]: ['paid', 'allocated'] } }
    }]
  });

  if (!slot) {
    return { success: false, message: '时段不存在' };
  }

  const currentOrders = slot.Orders ? slot.Orders.length : slot.current_orders;
  const available = currentOrders < slot.max_orders;

  return {
    success: true,
    slot: {
      id: slot.id,
      date: slot.date,
      startTime: slot.start_time,
      endTime: slot.end_time,
      maxOrders: slot.max_orders,
      currentOrders,
      available,
      remaining: slot.max_orders - currentOrders,
      status: available ? 'available' : 'full'
    }
  };
};

const checkTimeConflict = async (date, startTime, endTime, excludeSlotId = null) => {
  const whereClause = {
    date,
    [Op.or]: [
      {
        start_time: { [Op.lt]: endTime },
        end_time: { [Op.gt]: startTime }
      }
    ]
  };

  if (excludeSlotId) {
    whereClause.id = { [Op.ne]: excludeSlotId };
  }

  const conflictingSlots = await PickupSlot.findAll({
    where: whereClause,
    include: [{
      model: Order,
      where: { status: { [Op.in]: ['paid', 'allocated'] } },
      required: false
    }]
  });

  const conflicts = conflictingSlots.map(slot => ({
    id: slot.id,
    date: slot.date,
    startTime: slot.start_time,
    endTime: slot.end_time,
    currentOrders: slot.Orders ? slot.Orders.length : slot.current_orders,
    maxOrders: slot.max_orders
  }));

  return {
    hasConflict: conflicts.length > 0,
    conflicts,
    message: conflicts.length > 0 
      ? `发现${conflicts.length}个时间冲突时段` 
      : '无时间冲突'
  };
};

const assignOrderToSlot = async (orderId, slotId) => {
  const slotCheck = await checkSlotAvailability(slotId);
  if (!slotCheck.success) {
    return slotCheck;
  }

  if (!slotCheck.slot.available) {
    return {
      success: false,
      message: '时段已满，请选择其他时段',
      slot: slotCheck.slot
    };
  }

  const order = await Order.findByPk(orderId);
  if (!order) {
    return { success: false, message: '订单不存在' };
  }

  if (order.pickup_slot_id) {
    const oldSlot = await PickupSlot.findByPk(order.pickup_slot_id);
    if (oldSlot) {
      oldSlot.current_orders = Math.max(0, oldSlot.current_orders - 1);
      oldSlot.status = oldSlot.current_orders < oldSlot.max_orders ? 'available' : 'full';
      await oldSlot.save();
    }
  }

  order.pickup_slot_id = slotId;
  await order.save();

  const slot = await PickupSlot.findByPk(slotId);
  slot.current_orders += 1;
  slot.status = slot.current_orders >= slot.max_orders ? 'full' : 'available';
  await slot.save();

  return {
    success: true,
    message: '成功分配自提时段',
    order: {
      id: order.id,
      orderNo: order.order_no,
      pickupSlotId: slotId
    },
    slot: {
      id: slot.id,
      date: slot.date,
      startTime: slot.start_time,
      endTime: slot.end_time,
      currentOrders: slot.current_orders,
      maxOrders: slot.max_orders,
      remaining: slot.max_orders - slot.current_orders
    }
  };
};

const getAvailableSlots = async (date = null) => {
  const whereClause = date ? { date } : {};

  const slots = await PickupSlot.findAll({
    where: whereClause,
    include: [{
      model: Order,
      where: { status: { [Op.in]: ['paid', 'allocated'] } },
      required: false
    }],
    order: [['date', 'ASC'], ['start_time', 'ASC']]
  });

  return slots.map(slot => {
    const currentOrders = slot.Orders ? slot.Orders.length : slot.current_orders;
    return {
      id: slot.id,
      groupBatchId: slot.group_batch_id,
      date: slot.date,
      startTime: slot.start_time,
      endTime: slot.end_time,
      maxOrders: slot.max_orders,
      currentOrders,
      available: currentOrders < slot.max_orders,
      remaining: slot.max_orders - currentOrders,
      status: currentOrders >= slot.max_orders ? 'full' : 'available'
    };
  });
};

const getOverloadedSlots = async () => {
  const slots = await PickupSlot.findAll({
    include: [{
      model: Order,
      where: { status: { [Op.in]: ['paid', 'allocated'] } },
      required: false
    }],
    order: [['date', 'ASC'], ['start_time', 'ASC']]
  });

  const overloaded = slots
    .map(slot => {
      const currentOrders = slot.Orders ? slot.Orders.length : slot.current_orders;
      const loadRatio = currentOrders / slot.max_orders;
      return {
        id: slot.id,
        date: slot.date,
        startTime: slot.start_time,
        endTime: slot.end_time,
        currentOrders,
        maxOrders: slot.max_orders,
        loadRatio,
        isOverloaded: loadRatio >= 0.8,
        isFull: currentOrders >= slot.max_orders
      };
    })
    .filter(slot => slot.isOverloaded || slot.isFull);

  return {
    overloadedSlots: overloaded,
    count: overloaded.length,
    message: overloaded.length > 0 
      ? `发现${overloaded.length}个繁忙/已满时段，建议引导用户选择其他时段` 
      : '所有时段负荷正常'
  };
};

const suggestAlternativeSlots = async (slotId, alternativesCount = 3) => {
  const originalSlot = await PickupSlot.findByPk(slotId);
  if (!originalSlot) {
    return { success: false, message: '时段不存在' };
  }

  const allSlots = await getAvailableSlots(originalSlot.date);
  
  const alternatives = allSlots
    .filter(slot => slot.id !== slotId && slot.available)
    .slice(0, alternativesCount);

  return {
    success: true,
    originalSlot: {
      id: originalSlot.id,
      date: originalSlot.date,
      startTime: originalSlot.start_time,
      endTime: originalSlot.end_time
    },
    alternatives,
    message: alternatives.length > 0 
      ? `找到${alternatives.length}个可选替代时段` 
      : '暂无其他可用时段'
  };
};

module.exports = {
  checkSlotAvailability,
  checkTimeConflict,
  assignOrderToSlot,
  getAvailableSlots,
  getOverloadedSlots,
  suggestAlternativeSlots
};
