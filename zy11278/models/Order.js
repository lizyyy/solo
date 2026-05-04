module.exports = (sequelize, DataTypes) => {
  const Order = sequelize.define('Order', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    order_no: {
      type: DataTypes.STRING(32),
      allowNull: false,
      unique: true
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
    order_type: {
      type: DataTypes.ENUM('buy', 'sell'),
      allowNull: false
    },
    order_subtype: {
      type: DataTypes.ENUM('limit', 'market', 'stop_loss', 'take_profit'),
      allowNull: false,
      defaultValue: 'limit'
    },
    status: {
      type: DataTypes.ENUM('pending', 'submitted', 'partially_filled', 'filled', 'cancelled', 'rejected', 'expired'),
      allowNull: false,
      defaultValue: 'pending'
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
    filled_quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    filled_price: {
      type: DataTypes.DECIMAL(12, 4),
      allowNull: true
    },
    filled_amount: {
      type: DataTypes.DECIMAL(16, 2),
      allowNull: true,
      defaultValue: 0
    },
    commission: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      defaultValue: 0
    },
    tax: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      defaultValue: 0
    },
    trade_plan_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'trade_plans',
        key: 'id'
      }
    },
    trigger_type: {
      type: DataTypes.ENUM('manual', 'stop_loss', 'take_profit', 'auto'),
      allowNull: true,
      defaultValue: 'manual'
    },
    trigger_price: {
      type: DataTypes.DECIMAL(12, 4),
      allowNull: true
    },
    trigger_time: {
      type: DataTypes.DATE,
      allowNull: true
    },
    submit_time: {
      type: DataTypes.DATE,
      allowNull: true
    },
    fill_time: {
      type: DataTypes.DATE,
      allowNull: true
    },
    cancel_time: {
      type: DataTypes.DATE,
      allowNull: true
    },
    cancel_reason: {
      type: DataTypes.TEXT,
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
    tableName: 'orders',
    indexes: [
      {
        unique: true,
        fields: ['order_no']
      },
      {
        fields: ['trading_day_id']
      },
      {
        fields: ['symbol']
      },
      {
        fields: ['status']
      },
      {
        fields: ['created_at']
      }
    ]
  });

  return Order;
};
