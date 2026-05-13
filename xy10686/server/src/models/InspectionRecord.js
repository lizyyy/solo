const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const InspectionRecord = sequelize.define('InspectionRecord', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  inspectionNo: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  deliveryId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  orderId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  inspectionDate: {
    type: DataTypes.DATE,
    allowNull: false
  },
  inspectedQuantity: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  acceptedQuantity: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  rejectedQuantity: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  inspectionResult: {
    type: DataTypes.ENUM('accepted', 'rejected', 'partial'),
    allowNull: false
  },
  rejectReason: {
    type: DataTypes.TEXT
  },
  photos: {
    type: DataTypes.TEXT
  },
  status: {
    type: DataTypes.ENUM('draft', 'submitted', 'reviewed', 'completed'),
    defaultValue: 'draft'
  },
  isReturnProcessed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  paymentNodeVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  inspector: {
    type: DataTypes.STRING,
    allowNull: false
  },
  reviewer: {
    type: DataTypes.STRING
  },
  remarks: {
    type: DataTypes.TEXT
  },
  createdBy: {
    type: DataTypes.STRING
  },
  updatedBy: {
    type: DataTypes.STRING
  }
}, {
  timestamps: true,
  tableName: 'inspection_records'
});

module.exports = InspectionRecord;
