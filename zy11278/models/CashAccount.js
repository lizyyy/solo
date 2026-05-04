module.exports = (sequelize, DataTypes) => {
  const CashAccount = sequelize.define('CashAccount', {
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
    account_type: {
      type: DataTypes.ENUM('main', 'margin', 'frozen', 'other'),
      allowNull: false,
      defaultValue: 'main'
    },
    opening_balance: {
      type: DataTypes.DECIMAL(16, 2),
      allowNull: false,
      defaultValue: 0
    },
    closing_balance: {
      type: DataTypes.DECIMAL(16, 2),
      allowNull: true,
      defaultValue: 0
    },
    available_balance: {
      type: DataTypes.DECIMAL(16, 2),
      allowNull: false,
      defaultValue: 0
    },
    frozen_balance: {
      type: DataTypes.DECIMAL(16, 2),
      allowNull: false,
      defaultValue: 0
    },
    total_inflow: {
      type: DataTypes.DECIMAL(16, 2),
      allowNull: false,
      defaultValue: 0
    },
    total_outflow: {
      type: DataTypes.DECIMAL(16, 2),
      allowNull: false,
      defaultValue: 0
    },
    realized_pnl: {
      type: DataTypes.DECIMAL(16, 2),
      allowNull: false,
      defaultValue: 0
    },
    commission_paid: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0
    },
    tax_paid: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
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
    tableName: 'cash_accounts',
    indexes: [
      {
        unique: true,
        fields: ['trading_day_id', 'account_type']
      }
    ]
  });

  return CashAccount;
};
