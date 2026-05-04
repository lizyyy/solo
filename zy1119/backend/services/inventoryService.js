const { InventoryBatch, InventoryAllocation, OrderItem, Product, Freezer, Exception } = require('../models');
const { Op } = require('sequelize');
const dayjs = require('dayjs');

const getExpiryPriority = (expiryDate) => {
  if (!expiryDate) return 0;
  const daysUntilExpiry = dayjs(expiryDate).diff(dayjs(), 'day');
  if (daysUntilExpiry <= 0) return 3;
  if (daysUntilExpiry <= 3) return 2;
  if (daysUntilExpiry <= 7) return 1;
  return 0;
};

const allocateInventoryToOrderItem = async (orderItem, transaction) => {
  const product = await Product.findByPk(orderItem.product_id);
  if (!product) {
    throw new Error(`商品不存在: ${orderItem.product_id}`);
  }

  const availableInventory = await InventoryBatch.findAll({
    where: {
      product_id: orderItem.product_id,
      status: { [Op.in]: ['in_stock', 'partial_allocated'] },
      quantity: { [Op.gt]: sequelize.col('allocated_quantity') }
    },
    order: [['expiry_date', 'ASC']],
    transaction
  });

  let remainingQuantity = orderItem.quantity - orderItem.allocated_quantity;
  const allocations = [];

  const prioritizedInventory = [...availableInventory].sort((a, b) => {
    const priorityA = getExpiryPriority(a.expiry_date);
    const priorityB = getExpiryPriority(b.expiry_date);
    if (priorityB !== priorityA) return priorityB - priorityA;
    if (a.expiry_date && b.expiry_date) {
      return new Date(a.expiry_date) - new Date(b.expiry_date);
    }
    return 0;
  });

  for (const inventory of prioritizedInventory) {
    if (remainingQuantity <= 0) break;

    const availableQuantity = inventory.quantity - inventory.allocated_quantity;
    if (availableQuantity <= 0) continue;

    const allocateQuantity = Math.min(remainingQuantity, availableQuantity);
    
    const isExpiryPriority = inventory.expiry_date && 
      dayjs(inventory.expiry_date).diff(dayjs(), 'day') <= 7;

    const allocation = await InventoryAllocation.create({
      order_item_id: orderItem.id,
      inventory_batch_id: inventory.id,
      quantity: allocateQuantity,
      picked_quantity: 0,
      is_expiry_priority: isExpiryPriority
    }, { transaction });

    allocations.push(allocation);

    inventory.allocated_quantity += allocateQuantity;
    inventory.status = inventory.allocated_quantity >= inventory.quantity ? 'allocated' : 'partial_allocated';
    await inventory.save({ transaction });

    orderItem.allocated_quantity += allocateQuantity;
    remainingQuantity -= allocateQuantity;
  }

  if (orderItem.allocated_quantity === orderItem.quantity) {
    orderItem.status = 'allocated';
  } else if (orderItem.allocated_quantity > 0) {
    orderItem.status = 'partial_allocated';
  }

  await orderItem.save({ transaction });

  if (remainingQuantity > 0) {
    await Exception.create({
      order_id: orderItem.order_id,
      type: 'shortage',
      product_id: orderItem.product_id,
      affected_quantity: remainingQuantity,
      description: `订单商品缺货，订购${orderItem.quantity}，实际分配${orderItem.allocated_quantity}，缺货${remainingQuantity}`,
      action: 'pending',
      status: 'open'
    }, { transaction });
  }

  return {
    success: true,
    allocated: orderItem.allocated_quantity,
    shortage: remainingQuantity,
    allocations
  };
};

const checkFreezerCapacity = async (productId, quantity, transaction) => {
  const product = await Product.findByPk(productId, { transaction });
  if (!product) {
    return { success: false, message: '商品不存在' };
  }

  const freezers = await Freezer.findAll({
    where: {
      type: product.storage_temp === 'frozen' ? 'frozen' : { [Op.in]: ['refrigerated', 'frozen'] },
      status: 'active'
    },
    transaction
  });

  const totalAvailable = freezers.reduce((sum, f) => sum + (f.capacity - f.used_capacity), 0);

  if (totalAvailable < quantity) {
    return {
      success: false,
      message: `冰柜容量不足，需要${quantity}单位，可用${totalAvailable}单位`,
      totalCapacity: freezers.reduce((sum, f) => sum + f.capacity, 0),
      usedCapacity: freezers.reduce((sum, f) => sum + f.used_capacity, 0),
      availableCapacity: totalAvailable,
      requiredCapacity: quantity,
      freezers: freezers.map(f => ({
        id: f.id,
        name: f.name,
        capacity: f.capacity,
        used: f.used_capacity,
        available: f.capacity - f.used_capacity
      }))
    };
  }

  return {
    success: true,
    message: '冰柜容量充足',
    totalCapacity: freezers.reduce((sum, f) => sum + f.capacity, 0),
    usedCapacity: freezers.reduce((sum, f) => sum + f.used_capacity, 0),
    availableCapacity: totalAvailable,
    freezers: freezers.map(f => ({
      id: f.id,
      name: f.name,
      capacity: f.capacity,
      used: f.used_capacity,
      available: f.capacity - f.used_capacity
    }))
  };
};

const assignToFreezer = async (inventoryBatchId, freezerId, quantity, transaction) => {
  const inventory = await InventoryBatch.findByPk(inventoryBatchId, { 
    include: [Product],
    transaction 
  });
  
  if (!inventory) {
    return { success: false, message: '库存批次不存在' };
  }

  const freezer = await Freezer.findByPk(freezerId, { transaction });
  if (!freezer) {
    return { success: false, message: '冰柜不存在' };
  }

  if (freezer.status !== 'active') {
    return { success: false, message: '冰柜当前不可用' };
  }

  const availableSpace = freezer.capacity - freezer.used_capacity;
  if (availableSpace < quantity) {
    return { 
      success: false, 
      message: `冰柜容量不足，当前可用${availableSpace}单位，需要${quantity}单位` 
    };
  }

  inventory.freezer_id = freezerId;
  inventory.freezer_unit = inventory.Product?.unit || '件';
  await inventory.save({ transaction });

  freezer.used_capacity += quantity;
  if (freezer.used_capacity >= freezer.capacity) {
    freezer.status = 'full';
  }
  await freezer.save({ transaction });

  return {
    success: true,
    message: `已成功分配到冰柜: ${freezer.name}`,
    freezer: {
      id: freezer.id,
      name: freezer.name,
      used_capacity: freezer.used_capacity,
      available: freezer.capacity - freezer.used_capacity
    }
  };
};

const getExpiringInventory = async (daysThreshold = 7) => {
  const today = dayjs().format('YYYY-MM-DD');
  const thresholdDate = dayjs().add(daysThreshold, 'day').format('YYYY-MM-DD');

  const expiringItems = await InventoryBatch.findAll({
    where: {
      expiry_date: {
        [Op.between]: [today, thresholdDate]
      },
      status: { [Op.ne]: 'depleted' }
    },
    include: [Product],
    order: [['expiry_date', 'ASC']]
  });

  return expiringItems.map(item => ({
    ...item.toJSON(),
    daysUntilExpiry: dayjs(item.expiry_date).diff(dayjs(), 'day'),
    isExpiring: dayjs(item.expiry_date).diff(dayjs(), 'day') <= 3,
    isExpired: dayjs(item.expiry_date).diff(dayjs(), 'day') <= 0
  }));
};

const getInventorySummary = async (productId = null) => {
  const whereClause = productId ? { product_id: productId } : {};
  
  const inventory = await InventoryBatch.findAll({
    where: whereClause,
    include: [Product, Freezer],
    order: [['expiry_date', 'ASC']]
  });

  const summary = inventory.map(item => ({
    ...item.toJSON(),
    availableQuantity: item.quantity - item.allocated_quantity,
    daysUntilExpiry: item.expiry_date ? dayjs(item.expiry_date).diff(dayjs(), 'day') : null,
    isExpiring: item.expiry_date && dayjs(item.expiry_date).diff(dayjs(), 'day') <= 7
  }));

  return summary;
};

module.exports = {
  allocateInventoryToOrderItem,
  checkFreezerCapacity,
  assignToFreezer,
  getExpiringInventory,
  getInventorySummary,
  getExpiryPriority
};
