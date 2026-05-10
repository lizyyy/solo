const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const HistoryRecord = sequelize.define('HistoryRecord', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  shortageId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  operationType: {
    type: DataTypes.ENUM('create', 'update', 'supplement', 'withdraw', 'commitment', 'urge', 'delivery', 'risk'),
    allowNull: false
  },
  operator: {
    type: DataTypes.STRING
  },
  content: {
    type: DataTypes.TEXT
  },
  beforeSnapshot: {
    type: DataTypes.TEXT
  },
  afterSnapshot: {
    type: DataTypes.TEXT
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
});

module.exports = HistoryRecord;
