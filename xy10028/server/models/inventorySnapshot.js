module.exports = (sequelize, Sequelize) => {
  const InventorySnapshot = sequelize.define('InventorySnapshot', {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true
    },
    inventoryId: {
      type: Sequelize.UUID,
      allowNull: false
    },
    quantity: {
      type: Sequelize.INTEGER,
      allowNull: false
    },
    price: {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false
    },
    version: {
      type: Sequelize.INTEGER,
      allowNull: false
    },
    snapshotAt: {
      type: Sequelize.DATE,
      defaultValue: Sequelize.NOW
    }
  });

  return InventorySnapshot;
};
