const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DeliveryNote = sequelize.define('DeliveryNote', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  deliveryNo: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  orderId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  deliveryDate: {
    type: DataTypes.DATE,
    allowNull: false
  },
  deliveredQuantity: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  driverName: {
    type: DataTypes.STRING
  },
  vehicleNo: {
    type: DataTypes.STRING
  },
  batchNo: {
    type: DataTypes.STRING
  },
  status: {
    type: DataTypes.ENUM('pending', 'inspecting', 'accepted', 'rejected', 'partial_accepted', 'returned'),
    defaultValue: 'pending'
  },
  receivedBy: {
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
  tableName: 'delivery_notes'
});

module.exports = DeliveryNote;
