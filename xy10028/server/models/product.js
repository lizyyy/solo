module.exports = (sequelize, Sequelize) => {
  const Product = sequelize.define('Product', {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true
    },
    name: {
      type: Sequelize.STRING,
      allowNull: false
    },
    sku: {
      type: Sequelize.STRING,
      allowNull: false,
      unique: true
    },
    barcode: {
      type: Sequelize.STRING
    },
    category: {
      type: Sequelize.STRING
    },
    unit: {
      type: Sequelize.STRING,
      defaultValue: '件'
    },
    description: {
      type: Sequelize.TEXT
    },
    basePrice: {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0
    },
    isActive: {
      type: Sequelize.BOOLEAN,
      defaultValue: true
    }
  });

  return Product;
};
