module.exports = (sequelize, DataTypes) => {
  const TradeHistory = sequelize.define('TradeHistory', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    order_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'orders',
        key: 'id'
      }
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
    trade_type: {
      type: DataTypes.ENUM('buy', 'sell'),
      allowNull: false
    },
    trade_no: {
      type: DataTypes.STRING(32),
      allowNull: false,
      unique: true
    },
    price: {
      type: DataTypes.DECIMAL(12, 4),
      allowNull: false,
      defaultValue: 0
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    amount: {
      type: DataTypes.DECIMAL(16, 2),
      allowNull: false,
      defaultValue: 0
    },
    commission: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0
    },
    tax: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0
    },
    total_cost: {
      type: DataTypes.DECIMAL(16, 2),
      allowNull: false,
      defaultValue: 0
    },
    realized_pnl: {
      type: DataTypes.DECIMAL(16, 2),
      allowNull: true
    },
    realized_pnl_percent: {
      type: DataTypes.DECIMAL(8, 4),
      allowNull: true
    },
    avg_cost_price: {
      type: DataTypes.DECIMAL(12, 4),
      allowNull: true
    },
    holding_days: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    trade_time: {
      type: DataTypes.DATE,
      allowNull: false
    },
    is_win: {
      type: DataTypes.BOOLEAN,
      allowNull: true
    },
    pnl_category: {
      type: DataTypes.ENUM('stop_loss', 'take_profit', 'normal', 'forced'),
      allowNull: true
    },
    remark: {
      type: DataTypes.TEXT,
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
    tableName: 'trade_histories',
    indexes: [
      {
        unique: true,
        fields: ['trade_no']
      },
      {
        fields: ['trading_day_id']
      },
      {
        fields: ['symbol']
      },
      {
        fields: ['trade_type']
      },
      {
        fields: ['trade_time']
      }
    ]
  });

  return TradeHistory;
};
