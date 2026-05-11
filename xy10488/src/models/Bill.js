const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const House = require('./House');
const Room = require('./Room');
const Tenant = require('./Tenant');

const Bill = sequelize.define('Bill', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  houseId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: House,
      key: 'id'
    }
  },
  roomId: {
    type: DataTypes.UUID,
    references: {
      model: Room,
      key: 'id'
    }
  },
  tenantId: {
    type: DataTypes.UUID,
    references: {
      model: Tenant,
      key: 'id'
    }
  },
  billType: {
    type: DataTypes.ENUM('monthly', 'checkout'),
    defaultValue: 'monthly'
  },
  billingPeriodStart: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  billingPeriodEnd: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  waterUsage: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  waterCost: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  publicWaterCost: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  electricityUsage: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  electricityCost: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  publicElectricityCost: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  totalAmount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  sharingBasis: {
    type: DataTypes.TEXT
  },
  hasAbnormalReadings: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  status: {
    type: DataTypes.ENUM('generated', 'paid', 'settled'),
    defaultValue: 'generated'
  }
});

House.hasMany(Bill, { foreignKey: 'houseId' });
Bill.belongsTo(House, { foreignKey: 'houseId' });
Room.hasMany(Bill, { foreignKey: 'roomId' });
Bill.belongsTo(Room, { foreignKey: 'roomId' });
Tenant.hasMany(Bill, { foreignKey: 'tenantId' });
Bill.belongsTo(Tenant, { foreignKey: 'tenantId' });

module.exports = Bill;
