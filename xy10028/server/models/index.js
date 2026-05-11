const Sequelize = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '../../inventory.db'),
  logging: process.env.NODE_ENV === 'development' ? console.log : false
});

const db = {};
db.Sequelize = Sequelize;
db.sequelize = sequelize;

db.User = require('./user')(sequelize, Sequelize);
db.Store = require('./store')(sequelize, Sequelize);
db.Product = require('./product')(sequelize, Sequelize);
db.Inventory = require('./inventory')(sequelize, Sequelize);
db.InventorySnapshot = require('./inventorySnapshot')(sequelize, Sequelize);
db.OperationLog = require('./operationLog')(sequelize, Sequelize);
db.OperationRequest = require('./operationRequest')(sequelize, Sequelize);
db.TransferOrder = require('./transferOrder')(sequelize, Sequelize);
db.PriceChangeRecord = require('./priceChangeRecord')(sequelize, Sequelize);
db.LockRecord = require('./lockRecord')(sequelize, Sequelize);

db.Store.hasMany(db.Inventory, { foreignKey: 'storeId' });
db.Inventory.belongsTo(db.Store, { foreignKey: 'storeId' });

db.Product.hasMany(db.Inventory, { foreignKey: 'productId' });
db.Inventory.belongsTo(db.Product, { foreignKey: 'productId' });

db.Inventory.hasMany(db.InventorySnapshot, { foreignKey: 'inventoryId' });
db.InventorySnapshot.belongsTo(db.Inventory, { foreignKey: 'inventoryId' });

db.Inventory.hasMany(db.OperationLog, { foreignKey: 'inventoryId' });
db.OperationLog.belongsTo(db.Inventory, { foreignKey: 'inventoryId' });

db.User.hasMany(db.OperationLog, { foreignKey: 'userId' });
db.OperationLog.belongsTo(db.User, { foreignKey: 'userId' });

db.Inventory.hasMany(db.PriceChangeRecord, { foreignKey: 'inventoryId' });
db.PriceChangeRecord.belongsTo(db.Inventory, { foreignKey: 'inventoryId' });

db.User.hasMany(db.PriceChangeRecord, { foreignKey: 'userId' });
db.PriceChangeRecord.belongsTo(db.User, { foreignKey: 'userId' });

db.Store.hasMany(db.TransferOrder, { as: 'OutgoingTransfers', foreignKey: 'fromStoreId' });
db.TransferOrder.belongsTo(db.Store, { as: 'FromStore', foreignKey: 'fromStoreId' });

db.Store.hasMany(db.TransferOrder, { as: 'IncomingTransfers', foreignKey: 'toStoreId' });
db.TransferOrder.belongsTo(db.Store, { as: 'ToStore', foreignKey: 'toStoreId' });

db.Product.hasMany(db.TransferOrder, { foreignKey: 'productId' });
db.TransferOrder.belongsTo(db.Product, { foreignKey: 'productId' });

module.exports = db;
