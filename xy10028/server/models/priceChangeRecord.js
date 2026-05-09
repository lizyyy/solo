module.exports = (sequelize, Sequelize) => {
  const PriceChangeRecord = sequelize.define('PriceChangeRecord', {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true
    },
    inventoryId: {
      type: Sequelize.UUID,
      allowNull: false
    },
    oldPrice: {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false
    },
    newPrice: {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false
    },
    reason: {
      type: Sequelize.STRING,
      allowNull: false
    },
    userId: {
      type: Sequelize.UUID,
      allowNull: false
    },
    effectiveFrom: {
      type: Sequelize.DATE,
      defaultValue: Sequelize.NOW
    }
  });

  return PriceChangeRecord;
};
