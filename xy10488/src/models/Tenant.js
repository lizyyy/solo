const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Room = require('./Room');

const Tenant = sequelize.define('Tenant', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  roomId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: Room,
      key: 'id'
    }
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  phone: {
    type: DataTypes.STRING
  },
  checkInDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  checkOutDate: {
    type: DataTypes.DATEONLY
  },
  status: {
    type: DataTypes.ENUM('active', 'checked_out'),
    defaultValue: 'active'
  }
});

Room.hasMany(Tenant, { foreignKey: 'roomId' });
Tenant.belongsTo(Room, { foreignKey: 'roomId' });

module.exports = Tenant;
