const { DataTypes } = require('sequelize');
const sequelize = require('../db/database');

const ArrivalNote = sequelize.define('ArrivalNote', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  arrivalNo: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    field: 'arrival_no'
  },
  poId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'po_id'
  },
  supplierId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'supplier_id'
  },
  arrivalDate: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'arrival_date'
  },
  status: {
    type: DataTypes.ENUM('pending_inspection', 'in_inspection', 'inspected', 'partially_stocked', 'fully_stocked', 'rejected'),
    defaultValue: 'pending_inspection'
  },
  idempotencyKey: {
    type: DataTypes.STRING,
    field: 'idempotency_key'
  },
  createdBy: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'created_by'
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
  tableName: 'arrival_notes'
});

module.exports = ArrivalNote;
