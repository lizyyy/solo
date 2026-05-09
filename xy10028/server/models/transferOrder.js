module.exports = (sequelize, Sequelize) => {
  const TransferOrder = sequelize.define('TransferOrder', {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true
    },
    orderNo: {
      type: Sequelize.STRING,
      allowNull: false,
      unique: true
    },
    fromStoreId: {
      type: Sequelize.UUID,
      allowNull: false
    },
    toStoreId: {
      type: Sequelize.UUID,
      allowNull: false
    },
    productId: {
      type: Sequelize.UUID,
      allowNull: false
    },
    quantity: {
      type: Sequelize.INTEGER,
      allowNull: false,
      validate: {
        min: 1
      }
    },
    status: {
      type: Sequelize.ENUM('PENDING', 'APPROVED', 'SHIPPED', 'RECEIVED', 'CANCELLED', 'FAILED'),
      defaultValue: 'PENDING'
    },
    createdBy: {
      type: Sequelize.UUID,
      allowNull: false
    },
    approvedBy: {
      type: Sequelize.UUID
    },
    receivedBy: {
      type: Sequelize.UUID
    },
    remarks: {
      type: Sequelize.TEXT
    },
    createdAt: {
      type: Sequelize.DATE,
      defaultValue: Sequelize.NOW
    }
  });

  return TransferOrder;
};
