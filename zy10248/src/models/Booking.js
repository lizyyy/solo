const { sequelize, DataTypes } = require('../config/database');

const Booking = sequelize.define('Booking', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  meetingRoomId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  organizerId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  organizerName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  startTime: {
    type: DataTypes.DATE,
    allowNull: false
  },
  endTime: {
    type: DataTypes.DATE,
    allowNull: false
  },
  attendees: {
    type: DataTypes.TEXT,
    get() {
      const rawValue = this.getDataValue('attendees');
      return rawValue ? JSON.parse(rawValue) : [];
    },
    set(value) {
      this.setDataValue('attendees', JSON.stringify(value));
    }
  },
  status: {
    type: DataTypes.ENUM('pending', 'confirmed', 'cancelled', 'completed'),
    defaultValue: 'pending'
  },
  preInspectionId: {
    type: DataTypes.UUID
  },
  postInspectionId: {
    type: DataTypes.UUID
  },
  hasLiability: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  liabilityNote: {
    type: DataTypes.TEXT
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

module.exports = Booking;
