module.exports = (sequelize, DataTypes) => {
  const Quote = sequelize.define('Quote', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    trading_day_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'trading_days',
        key: 'id'
      }
    },
    symbol: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    name: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    open: {
      type: DataTypes.DECIMAL(12, 4),
      allowNull: false,
      defaultValue: 0
    },
    high: {
      type: DataTypes.DECIMAL(12, 4),
      allowNull: false,
      defaultValue: 0
    },
    low: {
      type: DataTypes.DECIMAL(12, 4),
      allowNull: false,
      defaultValue: 0
    },
    close: {
      type: DataTypes.DECIMAL(12, 4),
      allowNull: false,
      defaultValue: 0
    },
    volume: {
      type: DataTypes.BIGINT,
      allowNull: true,
      defaultValue: 0
    },
    amount: {
      type: DataTypes.DECIMAL(16, 2),
      allowNull: true,
      defaultValue: 0
    },
    prev_close: {
      type: DataTypes.DECIMAL(12, 4),
      allowNull: true,
      defaultValue: 0
    },
    change: {
      type: DataTypes.DECIMAL(12, 4),
      allowNull: true,
      defaultValue: 0
    },
    change_percent: {
      type: DataTypes.DECIMAL(8, 4),
      allowNull: true,
      defaultValue: 0
    },
    source: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: 'import'
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
    tableName: 'quotes',
    indexes: [
      {
        unique: true,
        fields: ['trading_day_id', 'symbol']
      },
      {
        fields: ['symbol']
      }
    ]
  });

  return Quote;
};
