const sequelize = require('../config/database');

const User = require('./User');
const Warehouse = require('./Warehouse');
const Product = require('./Product');
const Inventory = require('./Inventory');
const CountTask = require('./CountTask');
const CountDetail = require('./CountDetail');
const HistoryRecord = require('./HistoryRecord');

// 关联关系
User.hasMany(CountTask, { foreignKey: 'createdBy', as: 'createdTasks' });
User.hasMany(CountTask, { foreignKey: 'completedBy', as: 'completedTasks' });
User.hasMany(CountDetail, { foreignKey: 'countedBy', as: 'countedDetails' });
User.hasMany(HistoryRecord, { foreignKey: 'changedBy', as: 'historyRecords' });

Warehouse.hasMany(Inventory, { foreignKey: 'warehouseId' });
Warehouse.hasMany(CountTask, { foreignKey: 'warehouseId' });

Product.hasMany(Inventory, { foreignKey: 'productId' });
Product.hasMany(CountDetail, { foreignKey: 'productId' });

Inventory.hasOne(CountDetail, { foreignKey: 'inventoryId' });

CountTask.hasMany(CountDetail, { foreignKey: 'taskId', onDelete: 'CASCADE' });
CountTask.belongsTo(Warehouse, { foreignKey: 'warehouseId' });
CountTask.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });
CountTask.belongsTo(User, { foreignKey: 'completedBy', as: 'completer' });

CountDetail.belongsTo(CountTask, { foreignKey: 'taskId' });
CountDetail.belongsTo(Product, { foreignKey: 'productId' });
CountDetail.belongsTo(Inventory, { foreignKey: 'inventoryId' });
CountDetail.belongsTo(User, { foreignKey: 'countedBy', as: 'counter' });

Inventory.belongsTo(Warehouse, { foreignKey: 'warehouseId' });
Inventory.belongsTo(Product, { foreignKey: 'productId' });

HistoryRecord.belongsTo(User, { foreignKey: 'changedBy', as: 'operator' });

module.exports = {
  sequelize,
  User,
  Warehouse,
  Product,
  Inventory,
  CountTask,
  CountDetail,
  HistoryRecord
};