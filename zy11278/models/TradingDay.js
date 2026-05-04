module.exports = (sequelize, DataTypes) => {
  const TradingDay = sequelize.define('TradingDay', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      unique: true
    },
    status: {
      type: DataTypes.ENUM('pending', 'active', 'closed', 'reviewed'),
      allowNull: false,
      defaultValue: 'pending'
    },
    initial_cash: {
      type: DataTypes.DECIMAL(16, 2),
      allowNull: false,
      defaultValue: 0
    },
    final_cash: {
      type: DataTypes.DECIMAL(16, 2),
      allowNull: true,
      defaultValue: 0
    },
    total_market_value: {
      type: DataTypes.DECIMAL(16, 2),
      allowNull: true,
      defaultValue: 0
    },
    total_asset: {
      type: DataTypes.DECIMAL(16, 2),
      allowNull: true,
      defaultValue: 0
    },
    daily_pnl: {
      type: DataTypes.DECIMAL(16, 2),
      allowNull: true,
      defaultValue: 0
    },
    daily_pnl_percent: {
      type: DataTypes.DECIMAL(8, 4),
      allowNull: true,
      defaultValue: 0
    },
    cumulative_pnl: {
      type: DataTypes.DECIMAL(16, 2),
      allowNull: true,
      defaultValue: 0
    },
    cumulative_pnl_percent: {
      type: DataTypes.DECIMAL(8, 4),
      allowNull: true,
      defaultValue: 0
    },
    max_drawdown: {
      type: DataTypes.DECIMAL(8, 4),
      allowNull: true,
      defaultValue: 0
    },
    position_ratio: {
      type: DataTypes.DECIMAL(8, 4),
      allowNull: true,
      defaultValue: 0
    },
    buy_count: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    sell_count: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    total_trades: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    win_count: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    lose_count: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    win_rate: {
      type: DataTypes.DECIMAL(8, 4),
      allowNull: true,
      defaultValue: 0
    },
    risk_alert_count: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    opened_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    closed_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    reviewed_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    summary: {
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
    tableName: 'trading_days',
    indexes: [
      {
        unique: true,
        fields: ['date']
      },
      {
        fields: ['status']
      }
    ]
  });

  return TradingDay;
};
