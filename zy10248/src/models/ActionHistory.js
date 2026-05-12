const { sequelize, DataTypes } = require('../config/database');

const ActionHistory = sequelize.define('ActionHistory', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  entityType: {
    type: DataTypes.ENUM('meeting_room', 'equipment', 'booking', 'inspection', 'damage_report', 'liability_confirmation', 'compensation'),
    allowNull: false
  },
  entityId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  action: {
    type: DataTypes.STRING,
    allowNull: false
  },
  actionTime: {
    type: DataTypes.DATE,
    allowNull: false
  },
  operatorId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  operatorName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  oldValues: {
    type: DataTypes.TEXT,
    get() {
      const rawValue = this.getDataValue('oldValues');
      return rawValue ? JSON.parse(rawValue) : null;
    },
    set(value) {
      this.setDataValue('oldValues', value ? JSON.stringify(value) : null);
    }
  },
  newValues: {
    type: DataTypes.TEXT,
    get() {
      const rawValue = this.getDataValue('newValues');
      return rawValue ? JSON.parse(rawValue) : null;
    },
    set(value) {
      this.setDataValue('newValues', value ? JSON.stringify(value) : null);
    }
  },
  remark: {
    type: DataTypes.TEXT
  },
  ipAddress: {
    type: DataTypes.STRING
  }
}, {
  timestamps: false
});

module.exports = ActionHistory;
