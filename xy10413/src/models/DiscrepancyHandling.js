const { DataTypes } = require('sequelize');
const sequelize = require('../db/database');

const DiscrepancyHandling = sequelize.define('DiscrepancyHandling', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  inspectionResultId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'inspection_result_id'
  },
  handlingType: {
    type: DataTypes.ENUM('pending', 'shortage_pending', 'concession', 'reject', 'normal'),
    allowNull: false,
    field: 'handling_type'
  },
  quantity: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  approvalStatus: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected'),
    defaultValue: 'pending',
    field: 'approval_status'
  },
  approverId: {
    type: DataTypes.STRING,
    field: 'approver_id'
  },
  approverName: {
    type: DataTypes.STRING,
    field: 'approver_name'
  },
  approvalTime: {
    type: DataTypes.DATE,
    field: 'approval_time'
  },
  notes: {
    type: DataTypes.TEXT
  },
  createdAt: {
    type: DataTypes.DATE,
    field: 'created_at'
  },
  updatedAt: {
    type: DataTypes.DATE,
    field: 'updated_at'
  }
}, {
  tableName: 'discrepancy_handlings'
});

module.exports = DiscrepancyHandling;
