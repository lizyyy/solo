const { sequelize, DataTypes } = require('../config/database');

const Inspection = sequelize.define('Inspection', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  bookingId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  meetingRoomId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('pre', 'post'),
    allowNull: false
  },
  inspectorId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  inspectorName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  inspectionTime: {
    type: DataTypes.DATE,
    allowNull: false
  },
  equipmentStatus: {
    type: DataTypes.TEXT,
    get() {
      const rawValue = this.getDataValue('equipmentStatus');
      return rawValue ? JSON.parse(rawValue) : [];
    },
    set(value) {
      this.setDataValue('equipmentStatus', JSON.stringify(value));
    }
  },
  hasDamage: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  damageDescription: {
    type: DataTypes.TEXT
  },
  photos: {
    type: DataTypes.TEXT,
    get() {
      const rawValue = this.getDataValue('photos');
      return rawValue ? JSON.parse(rawValue) : [];
    },
    set(value) {
      this.setDataValue('photos', JSON.stringify(value));
    }
  },
  remarks: {
    type: DataTypes.TEXT
  },
  status: {
    type: DataTypes.ENUM('draft', 'submitted'),
    defaultValue: 'draft'
  },
  createdBy: {
    type: DataTypes.STRING,
    allowNull: false
  }
}, {
  timestamps: true
});

module.exports = Inspection;
