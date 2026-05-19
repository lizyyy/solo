const sequelize = require('../config/database');

const User = require('./User');
const Reagent = require('./Reagent');
const Inventory = require('./Inventory');
const Requisition = require('./Requisition');
const RequisitionItem = require('./RequisitionItem');
const ApprovalRecord = require('./ApprovalRecord');
const OutboundRecord = require('./OutboundRecord');
const ReturnRecord = require('./ReturnRecord');
const InventoryCheck = require('./InventoryCheck');
const InventoryCheckItem = require('./InventoryCheckItem');
const ImportRecord = require('./ImportRecord');
const ImportError = require('./ImportError');
const AuditLog = require('./AuditLog');

// 模型关联
function setupAssociations() {
  // 申领单关联
  Requisition.belongsTo(User, { as: 'applicant', foreignKey: 'applicant_id' });
  Requisition.hasMany(RequisitionItem, { as: 'items', foreignKey: 'requisition_id' });
  Requisition.hasMany(ApprovalRecord, { as: 'approvals', foreignKey: 'requisition_id' });
  Requisition.hasMany(OutboundRecord, { as: 'outbounds', foreignKey: 'requisition_id' });
  Requisition.hasMany(ReturnRecord, { as: 'returns', foreignKey: 'requisition_id' });

  // 申领单项关联
  RequisitionItem.belongsTo(Requisition, { foreignKey: 'requisition_id' });
  RequisitionItem.belongsTo(Reagent, { foreignKey: 'reagent_id' });
  RequisitionItem.hasMany(OutboundRecord, { as: 'outbounds', foreignKey: 'requisition_item_id' });
  RequisitionItem.hasMany(ReturnRecord, { as: 'returns', foreignKey: 'requisition_item_id' });

  // 试剂关联
  Reagent.hasMany(Inventory, { as: 'inventory', foreignKey: 'reagent_id' });
  Reagent.hasMany(RequisitionItem, { as: 'requisitionItems', foreignKey: 'reagent_id' });

  // 库存关联
  Inventory.belongsTo(Reagent, { foreignKey: 'reagent_id' });
  Inventory.hasMany(OutboundRecord, { as: 'outbounds', foreignKey: 'inventory_id' });
  Inventory.hasMany(ReturnRecord, { as: 'returns', foreignKey: 'inventory_id' });

  // 审批记录关联
  ApprovalRecord.belongsTo(Requisition, { foreignKey: 'requisition_id' });
  ApprovalRecord.belongsTo(RequisitionItem, { foreignKey: 'requisition_item_id' });
  ApprovalRecord.belongsTo(User, { as: 'approver', foreignKey: 'approver_id' });

  // 出库记录关联
  OutboundRecord.belongsTo(Requisition, { foreignKey: 'requisition_id' });
  OutboundRecord.belongsTo(RequisitionItem, { foreignKey: 'requisition_item_id' });
  OutboundRecord.belongsTo(Inventory, { foreignKey: 'inventory_id' });
  OutboundRecord.belongsTo(User, { as: 'receiver', foreignKey: 'receiver_id' });
  OutboundRecord.belongsTo(User, { as: 'handler', foreignKey: 'handler_id' });

  // 归还记录关联
  ReturnRecord.belongsTo(Requisition, { foreignKey: 'requisition_id' });
  ReturnRecord.belongsTo(RequisitionItem, { foreignKey: 'requisition_item_id' });
  ReturnRecord.belongsTo(OutboundRecord, { foreignKey: 'outbound_record_id' });
  ReturnRecord.belongsTo(Inventory, { foreignKey: 'inventory_id' });
  ReturnRecord.belongsTo(User, { as: 'returner', foreignKey: 'returner_id' });
  ReturnRecord.belongsTo(User, { as: 'receiver', foreignKey: 'receiver_id' });

  // 盘点关联
  InventoryCheck.belongsTo(User, { as: 'checker', foreignKey: 'checker_id' });
  InventoryCheck.belongsTo(User, { as: 'supervisor', foreignKey: 'supervisor_id' });
  InventoryCheck.hasMany(InventoryCheckItem, { as: 'items', foreignKey: 'check_id' });

  InventoryCheckItem.belongsTo(InventoryCheck, { foreignKey: 'check_id' });
  InventoryCheckItem.belongsTo(Inventory, { foreignKey: 'inventory_id' });
  InventoryCheckItem.belongsTo(Reagent, { foreignKey: 'reagent_id' });

  // 导入关联
  ImportRecord.hasMany(ImportError, { as: 'errors', foreignKey: 'import_id' });
  ImportError.belongsTo(ImportRecord, { foreignKey: 'import_id' });

  console.log('✅ 模型关联设置完成');
}

// 同步数据库
async function syncDatabase(force = false) {
  try {
    setupAssociations();
    await sequelize.sync({ force });
    console.log('✅ 数据库同步完成');
    return true;
  } catch (error) {
    console.error('❌ 数据库同步失败:', error);
    throw error;
  }
}

module.exports = {
  sequelize,
  syncDatabase,
  User,
  Reagent,
  Inventory,
  Requisition,
  RequisitionItem,
  ApprovalRecord,
  OutboundRecord,
  ReturnRecord,
  InventoryCheck,
  InventoryCheckItem,
  ImportRecord,
  ImportError,
  AuditLog
};
