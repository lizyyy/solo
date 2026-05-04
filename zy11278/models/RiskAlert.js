module.exports = (sequelize, DataTypes) => {
  const RiskAlert = sequelize.define('RiskAlert', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    trading_day_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'trading_days',
        key: 'id'
      }
    },
    alert_type: {
      type: DataTypes.ENUM(
        'over_position',
        'continuous_loss',
        'stop_loss_not_executed',
        'chase_high_buy',
        'max_drawdown_exceed',
        'single_stock_over_weight',
        'liquidity_warning',
        'rule_violation',
        'other'
      ),
      allowNull: false
    },
    severity: {
      type: DataTypes.ENUM('info', 'warning', 'danger', 'critical'),
      allowNull: false,
      defaultValue: 'warning'
    },
    status: {
      type: DataTypes.ENUM('active', 'acknowledged', 'resolved', 'ignored'),
      allowNull: false,
      defaultValue: 'active'
    },
    symbol: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    name: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    trigger_value: {
      type: DataTypes.DECIMAL(16, 4),
      allowNull: true
    },
    threshold_value: {
      type: DataTypes.DECIMAL(16, 4),
      allowNull: true
    },
    unit: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    order_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'orders',
        key: 'id'
      }
    },
    position_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'positions',
        key: 'id'
      }
    },
    acknowledged_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    acknowledged_by: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    resolved_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    resolution_note: {
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
    tableName: 'risk_alerts',
    indexes: [
      {
        fields: ['trading_day_id']
      },
      {
        fields: ['alert_type']
      },
      {
        fields: ['severity']
      },
      {
        fields: ['status']
      },
      {
        fields: ['symbol']
      },
      {
        fields: ['created_at']
      }
    ]
  });

  return RiskAlert;
};
