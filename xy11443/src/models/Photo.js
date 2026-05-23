const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Photo = sequelize.define('Photo', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  batchId: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: '批次ID'
  },
  photoNo: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: '照片编号'
  },
  photoType: {
    type: DataTypes.ENUM('delivery', 'return_basket', 'bad_fruit', 'sorting', 'other', 'anomaly'),
    allowNull: false,
    comment: '照片类型：送货、退筐、坏果、分拣、其他、异常'
  },
  fileName: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '文件名'
  },
  filePath: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '文件路径'
  },
  fileSize: {
    type: DataTypes.INTEGER,
    comment: '文件大小(字节)'
  },
  mimeType: {
    type: DataTypes.STRING,
    comment: 'MIME类型'
  },
  thumbnailPath: {
    type: DataTypes.STRING,
    comment: '缩略图路径'
  },
  shootTime: {
    type: DataTypes.DATE,
    comment: '拍摄时间'
  },
  uploadTime: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    comment: '上传时间'
  },
  description: {
    type: DataTypes.TEXT,
    comment: '照片描述'
  },
  isAnomaly: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否异常照片'
  },
  anomalyRemark: {
    type: DataTypes.TEXT,
    comment: '异常备注'
  },
  status: {
    type: DataTypes.ENUM('active', 'deleted'),
    defaultValue: 'active',
    comment: '状态'
  },
  uploadedBy: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '上传人'
  }
}, {
  tableName: 'photos',
  indexes: [
    { fields: ['batch_id'] },
    { fields: ['photo_no'], unique: true },
    { fields: ['photo_type'] },
    { fields: ['is_anomaly'] },
    { fields: ['status'] }
  ]
});

module.exports = Photo;
