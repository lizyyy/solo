const { DataTypes } = require('sequelize');
const sequelize = require('../db/database');

const InspectionResult = sequelize.define('InspectionResult', {
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
  arrivalNoteItemId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'arrival_note_item_id'
  },
  inspectorId: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'inspector_id'
  },
  inspectorName: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'inspector_name'
  },
  inspectionTime: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'inspection_time'
  },
  receivedQuantity: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'received_quantity'
  },
  qualifiedQuantity: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    field: 'qualified_quantity'
  },
  defectQuantity: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    field: 'defect_quantity'
  },
  discrepancyType: {
    type: DataTypes.ENUM('none', 'shortage', 'overage', 'spec_mismatch'),
    defaultValue: 'none',
    field: 'discrepancy_type'
  },
  notes: {
    type: DataTypes.TEXT
  }
}, {
  tableName: 'inspection_results'
});

module.exports = InspectionResult;
