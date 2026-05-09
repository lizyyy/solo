module.exports = (sequelize, Sequelize) => {
  const LockRecord = sequelize.define('LockRecord', {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true
    },
    resourceType: {
      type: Sequelize.STRING,
      allowNull: false
    },
    resourceId: {
      type: Sequelize.STRING,
      allowNull: false
    },
    lockedBy: {
      type: Sequelize.UUID,
      allowNull: false
    },
    lockedAt: {
      type: Sequelize.DATE,
      defaultValue: Sequelize.NOW
    },
    expiresAt: {
      type: Sequelize.DATE,
      allowNull: false
    },
    operation: {
      type: Sequelize.STRING
    }
  }, {
    indexes: [
      {
        unique: true,
        fields: ['resourceType', 'resourceId']
      }
    ]
  });

  return LockRecord;
};
