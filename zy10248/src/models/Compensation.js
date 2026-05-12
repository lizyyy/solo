const { sequelize, DataTypes } = require('../config/database');

const Compensation = sequelize.define('Compensation', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  compensationNumber: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  },
  liabilityConfirmationId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  damageReportId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  payerId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  payerName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  paymentMethod: {
    type: DataTypes.ENUM('cash', 'bank_transfer', 'salary_deduction', 'other'),
    allowNull: false
  },
  paymentTime: {
    type: DataTypes.DATE
  },
  receivedById: {
    type: DataTypes.STRING
  },
  receivedByName: {
    type: DataTypes.STRING
  },
  receiptNumber: {
    type: DataTypes.STRING
  },
  remarks: {
    type: DataTypes.TEXT
  },
  status: {
    type: DataTypes.ENUM('pending', 'paid', 'cancelled', 'waived'),
    defaultValue: 'pending'
  },
  createdBy: {
    type: DataTypes.STRING,
    allowNull: false
  }
}, {
  timestamps: true
});

module.exports = Compensation;
