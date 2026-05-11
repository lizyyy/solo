const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Shipment = require('./Shipment');

const SignOff = sequelize.define('SignOff', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  shipmentId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
    references: {
      model: Shipment,
      key: 'id'
    }
  },
  signOffTime: {
    type: DataTypes.DATE,
    allowNull: false
  },
  signOffResult: {
    type: DataTypes.ENUM('normal', 'overtemp_warning', 'overtemp_serious', 'damaged'),
    allowNull: false
  },
  isExempt: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  exemptReason: {
    type: DataTypes.TEXT
  },
  receiverName: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  receiverPhone: {
    type: DataTypes.STRING(20)
  },
  packageCondition: {
    type: DataTypes.ENUM('good', 'damaged', 'partial_damaged'),
    defaultValue: 'good'
  },
  temperatureAtSignoff: {
    type: DataTypes.DECIMAL(5, 2)
  },
  signOffRemarks: {
    type: DataTypes.TEXT
  },
  operatorName: {
    type: DataTypes.STRING(50)
  }
}, {
  tableName: 'sign_offs',
  timestamps: true
});

SignOff.belongsTo(Shipment, { foreignKey: 'shipmentId', as: 'shipment' });
Shipment.hasOne(SignOff, { foreignKey: 'shipmentId', as: 'signOff' });

module.exports = SignOff;
