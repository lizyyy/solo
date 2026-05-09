module.exports = (sequelize, Sequelize) => {
  const Inventory = sequelize.define('Inventory', {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true
    },
    storeId: {
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
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    price: {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0
    },
    minStock: {
      type: Sequelize.INTEGER,
      defaultValue: 0
    },
    maxStock: {
      type: Sequelize.INTEGER,
      defaultValue: 99999
    },
    version: {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      allowNull: false
    },
    lastUpdatedAt: {
      type: Sequelize.DATE,
      defaultValue: Sequelize.NOW
    }
  });

  return Inventory;
};
