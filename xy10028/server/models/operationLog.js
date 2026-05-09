module.exports = (sequelize, Sequelize) => {
  const OperationLog = sequelize.define('OperationLog', {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true
    },
    inventoryId: {
      type: Sequelize.UUID,
      allowNull: false
    },
    userId: {
      type: Sequelize.UUID,
      allowNull: false
    },
    operationType: {
      type: Sequelize.ENUM('CREATE', 'UPDATE', 'DELETE', 'ADJUST', 'TRANSFER_IN', 'TRANSFER_OUT', 'PRICE_CHANGE', 'SYNC'),
      allowNull: false
    },
    requestId: {
      type: Sequelize.UUID,
      allowNull: false
    },
    beforeState: {
      type: Sequelize.TEXT,
      allowNull: false
    },
    afterState: {
      type: Sequelize.TEXT,
      allowNull: false
    },
    changeDetails: {
      type: Sequelize.TEXT,
      allowNull: false
    },
    status: {
      type: Sequelize.ENUM('PENDING', 'SUCCESS', 'FAILED', 'ROLLED_BACK'),
      defaultValue: 'PENDING'
    },
    errorMessage: {
      type: Sequelize.TEXT
    },
    sequence: {
      type: Sequelize.BIGINT,
      autoIncrement: true,
      unique: true
    },
    operationAt: {
      type: Sequelize.DATE,
      defaultValue: Sequelize.NOW
    }
  });

  return OperationLog;
};
