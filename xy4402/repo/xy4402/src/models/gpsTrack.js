const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');
const Batch = require('./batch');

class GPSTrack extends Model {}

GPSTrack.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  timestamp: {
    type: DataTypes.DATE,
    comment: '时间戳'
  },
  latitude: {
    type: DataTypes.FLOAT,
    comment: '纬度'
  },
  longitude: {
    type: DataTypes.FLOAT,
    comment: '经度'
  },
  speed: {
    type: DataTypes.FLOAT,
    comment: '速度(km/h)'
  },
  altitude: {
    type: DataTypes.FLOAT,
    comment: '海拔(m)'
  },
  rawData: {
    type: DataTypes.TEXT,
    field: 'raw_data',
    comment: '原始轨迹数据'
  },
  sequence: {
    type: DataTypes.INTEGER,
    comment: '轨迹点序号'
  }
}, {
  sequelize,
  modelName: 'GPSTrack',
  tableName: 'gps_tracks',
  comment: 'GPS轨迹表'
});

GPSTrack.belongsTo(Batch, { foreignKey: 'batchId', as: 'batch' });
Batch.hasMany(GPSTrack, { foreignKey: 'batchId', as: 'gpsTracks' });

module.exports = GPSTrack;
