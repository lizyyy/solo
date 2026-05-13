const sequelize = require('../config/database');

const User = require('./User');
const PalletCode = require('./PalletCode');
const Supplier = require('./Supplier');
const Store = require('./Store');
const SupplierHandover = require('./SupplierHandover');
const StoreCollection = require('./StoreCollection');
const DamagePhoto = require('./DamagePhoto');
const DepositFlow = require('./DepositFlow');
const CollectionTask = require('./CollectionTask');
const ModificationHistory = require('./ModificationHistory');
const OperationLog = require('./OperationLog');

// 定义关联关系
// 用户关联
User.hasMany(PalletCode, { foreignKey: 'created_by' });
User.hasMany(SupplierHandover, { foreignKey: 'created_by', as: 'CreatedHandovers' });
User.hasMany(SupplierHandover, { foreignKey: 'verified_by', as: 'VerifiedHandovers' });
User.hasMany(StoreCollection, { foreignKey: 'created_by', as: 'CreatedCollections' });
User.hasMany(StoreCollection, { foreignKey: 'verified_by', as: 'VerifiedCollections' });
User.hasMany(DamagePhoto, { foreignKey: 'created_by', as: 'CreatedPhotos' });
User.hasMany(DamagePhoto, { foreignKey: 'reviewed_by', as: 'ReviewedPhotos' });
User.hasMany(DepositFlow, { foreignKey: 'created_by', as: 'CreatedFlows' });
User.hasMany(DepositFlow, { foreignKey: 'processed_by', as: 'ProcessedFlows' });
User.hasMany(CollectionTask, { foreignKey: 'created_by', as: 'CreatedTasks' });
User.hasMany(CollectionTask, { foreignKey: 'assigned_to', as: 'AssignedTasks' });
User.hasMany(ModificationHistory, { foreignKey: 'modified_by' });
User.hasMany(OperationLog, { foreignKey: 'user_id' });

// 托盘编码关联
PalletCode.belongsTo(User, { foreignKey: 'created_by' });
PalletCode.hasMany(SupplierHandover, { foreignKey: 'pallet_code_id' });
PalletCode.hasMany(StoreCollection, { foreignKey: 'pallet_code_id' });
PalletCode.hasMany(CollectionTask, { foreignKey: 'pallet_code_id' });

// 供应商关联
Supplier.hasMany(SupplierHandover, { foreignKey: 'supplier_id' });

// 门店关联
Store.hasMany(StoreCollection, { foreignKey: 'store_id' });
Store.hasMany(CollectionTask, { foreignKey: 'store_id' });

// 供应商交接关联
SupplierHandover.belongsTo(Supplier, { foreignKey: 'supplier_id' });
SupplierHandover.belongsTo(PalletCode, { foreignKey: 'pallet_code_id' });
SupplierHandover.belongsTo(User, { foreignKey: 'created_by', as: 'Creator' });
SupplierHandover.belongsTo(User, { foreignKey: 'verified_by', as: 'Verifier' });

// 门店回收关联
StoreCollection.belongsTo(Store, { foreignKey: 'store_id' });
StoreCollection.belongsTo(PalletCode, { foreignKey: 'pallet_code_id' });
StoreCollection.belongsTo(User, { foreignKey: 'created_by', as: 'Creator' });
StoreCollection.belongsTo(User, { foreignKey: 'verified_by', as: 'Verifier' });
StoreCollection.hasMany(DamagePhoto, { foreignKey: 'store_collection_id' });

// 破损照片关联
DamagePhoto.belongsTo(StoreCollection, { foreignKey: 'store_collection_id' });
DamagePhoto.belongsTo(User, { foreignKey: 'created_by', as: 'Creator' });
DamagePhoto.belongsTo(User, { foreignKey: 'reviewed_by', as: 'Reviewer' });

// 押金流水关联
DepositFlow.belongsTo(User, { foreignKey: 'created_by', as: 'Creator' });
DepositFlow.belongsTo(User, { foreignKey: 'processed_by', as: 'Processor' });

// 回收任务关联
CollectionTask.belongsTo(Store, { foreignKey: 'store_id' });
CollectionTask.belongsTo(PalletCode, { foreignKey: 'pallet_code_id' });
CollectionTask.belongsTo(User, { foreignKey: 'created_by', as: 'Creator' });
CollectionTask.belongsTo(User, { foreignKey: 'assigned_to', as: 'Assignee' });

// 修改历史关联
ModificationHistory.belongsTo(User, { foreignKey: 'modified_by' });

// 操作日志关联
OperationLog.belongsTo(User, { foreignKey: 'user_id' });

module.exports = {
  sequelize,
  User,
  PalletCode,
  Supplier,
  Store,
  SupplierHandover,
  StoreCollection,
  DamagePhoto,
  DepositFlow,
  CollectionTask,
  ModificationHistory,
  OperationLog
};
