const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Collection = sequelize.define('Collection', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  collectionNo: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  contractId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  type: {
    type: DataTypes.ENUM('phone', 'sms', 'visit', 'letter', 'lawyer'),
    allowNull: false,
  },
  collector: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  collectionDate: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  result: {
    type: DataTypes.ENUM('contacted', 'no_answer', 'promise_pay', 'refused', 'coordinated'),
    allowNull: false,
  },
  promisePayDate: {
    type: DataTypes.DATE,
  },
  promisePayAmount: {
    type: DataTypes.DECIMAL(15, 2),
  },
  isFrozen: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '催收是否冻结',
  },
  freezeReason: {
    type: DataTypes.STRING,
  },
  freezeUntil: {
    type: DataTypes.DATE,
  },
  remark: {
    type: DataTypes.TEXT,
  },
});

module.exports = Collection;
