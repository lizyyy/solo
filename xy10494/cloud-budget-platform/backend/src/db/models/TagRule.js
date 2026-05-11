const { DataTypes } = require('sequelize');
const sequelize = require('../index');

const TagRule = sequelize.define('TagRule', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  projectId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Projects',
      key: 'id',
    },
  },
  tagKey: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  tagValue: {
    type: DataTypes.STRING(200),
    allowNull: false,
  },
  matchType: {
    type: DataTypes.ENUM('exact', 'contains', 'starts_with', 'regex'),
    allowNull: false,
    defaultValue: 'exact',
  },
  priority: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
});

module.exports = TagRule;
