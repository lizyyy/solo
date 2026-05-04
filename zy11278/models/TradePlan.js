module.exports = (sequelize, DataTypes) => {
  const TradePlan = sequelize.define('TradePlan', {
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
    plan_type: {
      type: DataTypes.ENUM('buy', 'sell', 'watch'),
      allowNull: false,
      defaultValue: 'watch'
    },
    status: {
      type: DataTypes.ENUM('pending', 'active', 'partially_executed', 'completed', 'cancelled', 'expired'),
      allowNull: false,
      defaultValue: 'pending'
    },
    entry_price_min: {
      type: DataTypes.DECIMAL(12, 4),
      allowNull: true
    },
    entry_price_max: {
      type: DataTypes.DECIMAL(12, 4),
      allowNull: true
    },
    target_price: {
      type: DataTypes.DECIMAL(12, 4),
      allowNull: true
    },
    stop_loss_price: {
      type: DataTypes.DECIMAL(12, 4),
      allowNull: true
    },
    planned_quantity: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    executed_quantity: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    entry_reason: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    exit_reason: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    risk_level: {
      type: DataTypes.ENUM('low', 'medium', 'high'),
      allowNull: true,
      defaultValue: 'medium'
    },
    priority: {
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
    tableName: 'trade_plans',
    indexes: [
      {
        fields: ['trading_day_id']
      },
      {
        fields: ['symbol']
      },
      {
        fields: ['status']
      }
    ]
  });

  return TradePlan;
};
