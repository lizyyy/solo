const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Claim = require('./Claim');

const ClaimApproval = sequelize.define('ClaimApproval', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  claimId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Claim,
      key: 'id'
    }
  },
  approvalStep: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  approverRole: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  approverName: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  action: {
    type: DataTypes.ENUM('submit', 'approve', 'reject', 'rework', 'pay'),
    allowNull: false
  },
  decision: {
    type: DataTypes.STRING(200)
  },
  remarks: {
    type: DataTypes.TEXT
  },
  createdAt: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'claim_approvals',
  timestamps: true
});

ClaimApproval.belongsTo(Claim, { foreignKey: 'claimId', as: 'claim' });
Claim.hasMany(ClaimApproval, { foreignKey: 'claimId', as: 'approvals' });

module.exports = ClaimApproval;
