const { DataTypes } = require('sequelize');
const sequelize = require('../db/database');

const ArrivalNoteItem = sequelize.define('ArrivalNoteItem', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  arrivalNoteId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'arrival_note_id'
  },
  poItemId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'po_item_id'
  },
  productCode: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'product_code'
  },
  productName: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'product_name'
  },
  spec: {
    type: DataTypes.STRING,
    allowNull: false
  },
  quantity: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  batchNo: {
    type: DataTypes.STRING,
    field: 'batch_no'
  }
}, {
  tableName: 'arrival_note_items'
});

module.exports = ArrivalNoteItem;
