const { sequelize, DataTypes } = require('../config/database');

const DamageReport = sequelize.define('DamageReport', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  reportNumber: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  },
  equipmentId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  meetingRoomId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  bookingId: {
    type: DataTypes.UUID
  },
  inspectionId: {
    type: DataTypes.UUID
  },
  reporterId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  reporterName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  reportTime: {
    type: DataTypes.DATE,
    allowNull: false
  },
  damageType: {
    type: DataTypes.ENUM('wear', 'accident', 'misuse', 'unknown'),
    defaultValue: 'unknown'
  },
  severity: {
    type: DataTypes.ENUM('minor', 'moderate', 'severe'),
    defaultValue: 'minor'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
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
  estimatedCost: {
    type: DataTypes.DECIMAL(10, 2)
  },
  status: {
    type: DataTypes.ENUM('pending', 'investigating', 'confirmed', 'resolved', 'duplicate'),
    defaultValue: 'pending'
  },
  liabilityStatus: {
    type: DataTypes.ENUM('unassigned', 'assigned', 'confirmed', 'appealed', 'waived'),
    defaultValue: 'unassigned'
  },
  liablePersonId: {
    type: DataTypes.STRING
  },
  liablePersonName: {
    type: DataTypes.STRING
  },
  parentReportId: {
    type: DataTypes.UUID
  },
  isDuplicate: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  createdBy: {
    type: DataTypes.STRING,
    allowNull: false
  },
  isDeleted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  timestamps: true
});

module.exports = DamageReport;
