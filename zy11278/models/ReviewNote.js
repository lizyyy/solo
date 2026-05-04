module.exports = (sequelize, DataTypes) => {
  const ReviewNote = sequelize.define('ReviewNote', {
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
    symbol: {
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
    note_type: {
      type: DataTypes.ENUM('daily_summary', 'trade_analysis', 'lesson_learned', 'improvement_plan', 'other'),
      allowNull: false,
      defaultValue: 'other'
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: true
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false
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
    importance: {
      type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
      allowNull: true,
      defaultValue: 'medium'
    },
    action_items: {
      type: DataTypes.TEXT,
      allowNull: true,
      get() {
        const value = this.getDataValue('action_items');
        return value ? JSON.parse(value) : [];
      },
      set(value) {
        this.setDataValue('action_items', value ? JSON.stringify(value) : null);
      }
    },
    resolved: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    resolved_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    resolution: {
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
    tableName: 'review_notes',
    indexes: [
      {
        fields: ['trading_day_id']
      },
      {
        fields: ['symbol']
      },
      {
        fields: ['note_type']
      },
      {
        fields: ['importance']
      },
      {
        fields: ['created_at']
      }
    ]
  });

  return ReviewNote;
};
