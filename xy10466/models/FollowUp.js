const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const FollowUp = sequelize.define('FollowUp', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  complaintId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Complaints',
      key: 'id'
    }
  },
  followUpTime: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  followUpBy: {
    type: DataTypes.STRING,
    allowNull: false
  },
  customerResponse: {
    type: DataTypes.ENUM('satisfied', 'partial_satisfied', 'unsatisfied', 'no_response'),
    allowNull: false
  },
  responseDetail: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  isCompleted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  nextFollowUpTime: {
    type: DataTypes.DATE,
    allowNull: true
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  timestamps: true
});

module.exports = FollowUp;
