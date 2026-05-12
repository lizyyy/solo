const { sequelize, DataTypes } = require('../config/database');

const LiabilityConfirmation = sequelize.define('LiabilityConfirmation', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  damageReportId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  bookingId: {
    type: DataTypes.UUID
  },
  confirmedById: {
    type: DataTypes.STRING,
    allowNull: false
  },
  confirmedByName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  confirmationTime: {
    type: DataTypes.DATE,
    allowNull: false
  },
  liablePersonId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  liablePersonName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  liabilityType: {
    type: DataTypes.ENUM('direct', 'indirect', 'no_inspection', 'administrative'),
    allowNull: false
  },
  liabilityRatio: {
    type: DataTypes.INTEGER,
    defaultValue: 100
  },
  compensationAmount: {
    type: DataTypes.DECIMAL(10, 2)
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  evidence: {
    type: DataTypes.TEXT,
    get() {
      const rawValue = this.getDataValue('evidence');
      return rawValue ? JSON.parse(rawValue) : [];
    },
    set(value) {
      this.setDataValue('evidence', JSON.stringify(value));
    }
  },
  isLocked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  status: {
    type: DataTypes.ENUM('pending', 'confirmed', 'appealed', 'waived'),
    defaultValue: 'pending'
  },
  createdBy: {
    type: DataTypes.STRING,
    allowNull: false
  }
}, {
  timestamps: true
});

module.exports = LiabilityConfirmation;
