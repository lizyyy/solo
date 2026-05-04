const sequelize = require('../config/database');

const Product = require('./Product');
const GroupBatch = require('./GroupBatch');
const Order = require('./Order');
const OrderItem = require('./OrderItem');
const InventoryBatch = require('./InventoryBatch');
const Freezer = require('./Freezer');
const PickupSlot = require('./PickupSlot');
const Exception = require('./Exception');
const InventoryAllocation = require('./InventoryAllocation');

Product.hasMany(InventoryBatch, { foreignKey: 'product_id' });
InventoryBatch.belongsTo(Product, { foreignKey: 'product_id' });

Product.hasMany(OrderItem, { foreignKey: 'product_id' });
OrderItem.belongsTo(Product, { foreignKey: 'product_id' });

GroupBatch.hasMany(Order, { foreignKey: 'group_batch_id' });
Order.belongsTo(GroupBatch, { foreignKey: 'group_batch_id' });

GroupBatch.hasMany(InventoryBatch, { foreignKey: 'group_batch_id' });
InventoryBatch.belongsTo(GroupBatch, { foreignKey: 'group_batch_id' });

Order.hasMany(OrderItem, { foreignKey: 'order_id' });
OrderItem.belongsTo(Order, { foreignKey: 'order_id' });

Freezer.hasMany(InventoryBatch, { foreignKey: 'freezer_id' });
InventoryBatch.belongsTo(Freezer, { foreignKey: 'freezer_id' });

PickupSlot.hasMany(Order, { foreignKey: 'pickup_slot_id' });
Order.belongsTo(PickupSlot, { foreignKey: 'pickup_slot_id' });

Order.hasMany(Exception, { foreignKey: 'order_id' });
Exception.belongsTo(Order, { foreignKey: 'order_id' });

OrderItem.hasMany(InventoryAllocation, { foreignKey: 'order_item_id' });
InventoryAllocation.belongsTo(OrderItem, { foreignKey: 'order_item_id' });

InventoryBatch.hasMany(InventoryAllocation, { foreignKey: 'inventory_batch_id' });
InventoryAllocation.belongsTo(InventoryBatch, { foreignKey: 'inventory_batch_id' });

module.exports = {
  sequelize,
  Product,
  GroupBatch,
  Order,
  OrderItem,
  InventoryBatch,
  Freezer,
  PickupSlot,
  Exception,
  InventoryAllocation
};
