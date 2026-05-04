module.exports = (sequelize, DataTypes) => {
  const Position = sequelize.define('Position', {
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
    direction: {
      type: DataTypes.ENUM('long', 'short'),
      allowNull: false,
      defaultValue: 'long'
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    available_quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    frozen_quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    avg_cost_price: {
      type: DataTypes.DECIMAL(12, 4),
      allowNull: false,
      defaultValue: 0
    },
    total_cost: {
      type: DataTypes.DECIMAL(16, 2),
      allowNull: false,
      defaultValue: 0
    },
    current_price: {
      type: DataTypes.DECIMAL(12, 4),
      allowNull: true
    },
    market_value: {
      type: DataTypes.DECIMAL(16, 2),
      allowNull: true,
      defaultValue: 0
    },
    floating_pnl: {
      type: DataTypes.DECIMAL(16, 2),
      allowNull: true,
      defaultValue: 0
    },
    floating_pnl_percent: {
      type: DataTypes.DECIMAL(8, 4),
      allowNull: true,
      defaultValue: 0
    },
    realized_pnl: {
      type: DataTypes.DECIMAL(16, 2),
      allowNull: true,
      defaultValue: 0
    },
    total_pnl: {
      type: DataTypes.DECIMAL(16, 2),
      allowNull: true,
      defaultValue: 0
    },
    position_ratio: {
      type: DataTypes.DECIMAL(8, 4),
      allowNull: true,
      defaultValue: 0
    },
    max_floating_pnl: {
      type: DataTypes.DECIMAL(16, 2),
      allowNull: true,
      defaultValue: 0
    },
    max_drawdown: {
      type: DataTypes.DECIMAL(8, 4),
      allowNull: true,
      defaultValue: 0
    },
    entry_date: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    holding_days: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
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
    tableName: 'positions',
    indexes: [
      {
        unique: true,
        fields: ['trading_day_id', 'symbol', 'direction']
      },
      {
        fields: ['symbol']
      }
    ]
  });

  return Position;
};
