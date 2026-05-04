module.exports = (sequelize, DataTypes) => {
  const Watchlist = sequelize.define('Watchlist', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    symbol: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true
    },
    name: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    category: {
      type: DataTypes.ENUM('focus', 'watch', 'avoid', 'portfolio'),
      allowNull: false,
      defaultValue: 'watch'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    priority: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    tags: {
      type: DataTypes.TEXT,
      allowNull: true,
      get() {
        const value = this.getDataValue('tags');
        return value ? JSON.parse(value) : [];
      },
      set(value) {
        this.setDataValue('tags', value ? JSON.stringify(value) : null);
      }
    },
    last_price: {
      type: DataTypes.DECIMAL(12, 4),
      allowNull: true
    },
    price_change: {
      type: DataTypes.DECIMAL(8, 4),
      allowNull: true
    },
    price_change_percent: {
      type: DataTypes.DECIMAL(8, 4),
      allowNull: true
    },
    last_updated: {
      type: DataTypes.DATE,
      allowNull: true
    },
    metadata: {
      type: DataTypes.TEXT,
      allowNull: true,
      get() {
        const value = this.getDataValue('metadata');
        return value ? JSON.parse(value) : null;
      },
      set(value) {
        this.setDataValue('metadata', value ? JSON.stringify(value) : null);
      }
    }
  }, {
    tableName: 'watchlists',
    indexes: [
      {
        unique: true,
        fields: ['symbol']
      },
      {
        fields: ['category']
      },
      {
        fields: ['priority']
      }
    ]
  });

  return Watchlist;
};
