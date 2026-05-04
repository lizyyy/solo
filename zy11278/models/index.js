const Sequelize = require('sequelize');
const sequelize = require('../config/database');

const db = {};
db.Sequelize = Sequelize;
db.sequelize = sequelize;

db.Quote = require('./Quote')(sequelize, Sequelize.DataTypes);
db.TradePlan = require('./TradePlan')(sequelize, Sequelize.DataTypes);
db.Order = require('./Order')(sequelize, Sequelize.DataTypes);
db.Position = require('./Position')(sequelize, Sequelize.DataTypes);
db.RiskAlert = require('./RiskAlert')(sequelize, Sequelize.DataTypes);
db.TradingDay = require('./TradingDay')(sequelize, Sequelize.DataTypes);
db.ReviewNote = require('./ReviewNote')(sequelize, Sequelize.DataTypes);
db.CashAccount = require('./CashAccount')(sequelize, Sequelize.DataTypes);
db.TradeHistory = require('./TradeHistory')(sequelize, Sequelize.DataTypes);
db.Watchlist = require('./Watchlist')(sequelize, Sequelize.DataTypes);

db.Order.belongsTo(db.TradePlan, { foreignKey: 'trade_plan_id', as: 'tradePlan' });
db.TradePlan.hasMany(db.Order, { foreignKey: 'trade_plan_id', as: 'orders' });

db.Position.belongsTo(db.TradingDay, { foreignKey: 'trading_day_id', as: 'tradingDay' });
db.TradingDay.hasMany(db.Position, { foreignKey: 'trading_day_id', as: 'positions' });

db.RiskAlert.belongsTo(db.TradingDay, { foreignKey: 'trading_day_id', as: 'tradingDay' });
db.TradingDay.hasMany(db.RiskAlert, { foreignKey: 'trading_day_id', as: 'riskAlerts' });

db.ReviewNote.belongsTo(db.TradingDay, { foreignKey: 'trading_day_id', as: 'tradingDay' });
db.TradingDay.hasMany(db.ReviewNote, { foreignKey: 'trading_day_id', as: 'reviewNotes' });

db.TradeHistory.belongsTo(db.Order, { foreignKey: 'order_id', as: 'order' });
db.Order.hasMany(db.TradeHistory, { foreignKey: 'order_id', as: 'tradeHistories' });

module.exports = db;
