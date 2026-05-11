const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Shipment = require('./Shipment');

const Claim = sequelize.define('Claim', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  claimNo: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  shipmentId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Shipment,
      key: 'id'
    }
  },
  claimType: {
    type: DataTypes.ENUM('overtemp', 'damaged', 'lost', 'other'),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('draft', 'pending_review', 'approved', 'rejected', 'paid', 'closed'),
    allowNull: false,
    defaultValue: 'draft'
  },
  claimAmount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0
  },
  approvedAmount: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0
  },
  claimReason: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  overtempSummary: {
    type: DataTypes.TEXT
  },
  responsibleNode: {
    type: DataTypes.STRING(100)
  },
  responsibleParty: {
    type: DataTypes.STRING(100)
  },
  overtempDuration: {
    type: DataTypes.INTEGER
  },
  isDuplicate: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  isExemptClaim: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  exceedsLimit: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  csEvidence: {
    type: DataTypes.TEXT
  }
}, {
  tableName: 'claims',
  timestamps: true
});

Claim.belongsTo(Shipment, { foreignKey: 'shipmentId', as: 'shipment' });
Shipment.hasMany(Claim, { foreignKey: 'shipmentId', as: 'claims' });

module.exports = Claim;
