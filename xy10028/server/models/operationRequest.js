module.exports = (sequelize, Sequelize) => {
  const OperationRequest = sequelize.define('OperationRequest', {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true
    },
    requestId: {
      type: Sequelize.UUID,
      allowNull: false,
      unique: true
    },
    operationType: {
      type: Sequelize.STRING,
      allowNull: false
    },
    payload: {
      type: Sequelize.TEXT,
      allowNull: false
    },
    status: {
      type: Sequelize.ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'DUPLICATE'),
      defaultValue: 'PENDING'
    },
    userId: {
      type: Sequelize.UUID,
      allowNull: false
    },
    result: {
      type: Sequelize.TEXT
    },
    createdAt: {
      type: Sequelize.DATE,
      defaultValue: Sequelize.NOW
    },
    completedAt: {
      type: Sequelize.DATE
    }
  });

  return OperationRequest;
};
